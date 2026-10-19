import type { Page } from '@playwright/test';
import { DISCARD_TITLE, REAUTH_TITLE, RESUMED } from '../../apps/back-office/src/copy.js';
import { SESSION_POLICY } from '../../apps/server/src/domain/session.js';
import { ageSession } from '../support/clock.js';
import { ownerQuery } from '../support/database.js';
import {
  expect,
  reauthenticateAtOffice,
  signInAtBackOffice,
  test,
  type Person,
  type Profile,
} from '../support/fixtures.js';

// M-6, served: the session timed out, and the manager gets back in with a password.
// The same manager resumes the very session; another manager starts one of their own
// and the first manager's working area is destroyed (DECISIONS 2026-10-14).

const rootState = (page: Page) => page.locator('#root');
const REAUTHENTICATE = '/api/back-office/auth/reauthenticate';
const WORK = '.office-work';
const FRAME = ['.bonav', '.botop', '.bocontent'];

/** Signs the manager in at BO-01 and lets the session idle out, so that M-6 is open. */
async function idleOut(page: Page, manager: Person): Promise<void> {
  await page.clock.install();
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
  // Phase 0 mounts no form under M-6 (011d2): the working area is an empty element, and
  // what is kept or destroyed is that element itself, which this marks.
  await page.locator(WORK).evaluate((element) => {
    (element as unknown as Record<string, boolean>).kept = true;
  });
  const seconds = SESSION_POLICY.BACK_OFFICE.idleSeconds + 60;
  await ageSession('BACK_OFFICE', manager, seconds);
  await page.clock.fastForward(seconds * 1000);
  await expect(rootState(page)).toHaveAttribute('data-session', 'idle');
  await expect(page.getByRole('dialog', { name: REAUTH_TITLE })).toBeVisible();
}

const keptMark = (page: Page) =>
  page.locator(WORK).evaluate((element) => (element as unknown as Record<string, boolean>).kept === true);

async function openSession(manager: Person): Promise<{ id: string; token: string }[]> {
  return ownerQuery<{ id: string; token: string }>(
    `SELECT id, encode(token_hash, 'hex') AS token FROM actor_session
      WHERE audience = 'BACK_OFFICE' AND staff_user_id = $1 AND released_at IS NULL`,
    [manager.id]
  );
}

/** Waits for the page's answer to the next re-authentication it sends, and returns its code. */
function answerToReauthentication(page: Page, profile: Profile) {
  return async (act: () => Promise<void>): Promise<string | null> => {
    const answered = page.waitForResponse((r) => new URL(r.url()).pathname === REAUTHENTICATE);
    await act();
    await answered;
    await profile.settled();
    const replies = profile.replies.filter((reply) => reply.path === REAUTHENTICATE);
    return replies[replies.length - 1]?.code ?? null;
  };
}

test('B9. the same manager re-authenticates and resumes the same session', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  await idleOut(office, manager);
  const [open, ...others] = await openSession(manager);
  expect(others.length).toBe(0);

  const answer = answerToReauthentication(office, oneProfile);

  // A wrong password keeps M-6 up and counts against the manager.
  expect(await answer(() => reauthenticateAtOffice(office, { name: manager.name, password: world.wrongPassword() }))).toBe(
    'INVALID_CREDENTIALS'
  );
  await expect(rootState(office)).toHaveAttribute('data-session', 'idle');

  // The right one resumes.
  await answer(() => reauthenticateAtOffice(office, manager));
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  for (const part of FRAME) await expect(office.locator(part)).not.toHaveAttribute('inert');
  await expect(office.getByRole('status').filter({ hasText: RESUMED.title })).toBeVisible();
  // Same working area, not a rebuilt one.
  expect(await keptMark(office)).toBe(true);

  // The same session under a new token (ARCH-012 section 7).
  const [now, ...rest] = await openSession(manager);
  expect(rest.length).toBe(0);
  expect(now!.id === open!.id).toBe(true);
  expect(now!.token === open!.token).toBe(false);
});

test('B10. another manager signs in from M-6, and the first manager’s working area is destroyed', async ({
  world,
  oneProfile,
}) => {
  const first = await world.people.manager();
  const second = await world.people.manager();
  const { office } = oneProfile;
  await idleOut(office, first);

  const dialog = office.getByRole('dialog', { name: REAUTH_TITLE });
  await dialog.getByRole('button', { name: 'Sign in as a different manager' }).click();
  await office.getByRole('dialog').getByRole('button', { name: 'Continue to sign-in' }).click();
  await signInAtBackOffice(office, second);

  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  await expect(office.locator('.office-actor')).toHaveText(second.name);
  for (const part of FRAME) await expect(office.locator(part)).not.toHaveAttribute('inert');
  // A new element: nothing of the first manager's area survives into the second's.
  expect(await keptMark(office)).toBe(false);
  // They are two sessions of two people; the second is the one in this browser.
  expect((await openSession(second)).length).toBe(1);
});

test('B10. and discarding logs out and destroys the working area', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  await idleOut(office, manager);

  await office.getByRole('dialog', { name: REAUTH_TITLE }).getByRole('button', { name: 'Log out' }).click();
  await office
    .getByRole('dialog', { name: DISCARD_TITLE })
    .getByRole('button', { name: 'Discard changes and log out' })
    .click();

  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-out');
  await expect(office.getByLabel('Username')).toBeVisible();
  await expect(office.locator(WORK)).toHaveCount(0);
  expect((await openSession(manager)).length).toBe(0);
});

test('B-scan. the scan finds the password in both of its routes, once for each submission', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  await idleOut(office, manager);
  await answerToReauthentication(office, oneProfile)(() => reauthenticateAtOffice(office, manager));
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  expect(world.credentialBodies('username', manager)).toBe(1);
  expect(world.credentialBodies('password', manager)).toBe(2);
});
