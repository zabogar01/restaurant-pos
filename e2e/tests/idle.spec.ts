import type { Page } from '@playwright/test';
import { REAUTH_TITLE } from '../../apps/back-office/src/copy.js';
import { SESSION_POLICY } from '../../apps/server/src/domain/session.js';
import { ageSession } from '../support/clock.js';
import { expect, signInAtBackOffice, signInAtPos, test, type Person, type Profile } from '../support/fixtures.js';

// AC-28: the same idleness is shown two ways, and a read of the session extends
// neither. The server judges by its own clock (PostgreSQL's), so the test moves both:
// the session's idle clock back in the database by N seconds, and the page's clock
// forward by N seconds. The client then reaches its deadline, reads `me`, and the
// server gives the verdict. Limits are read from the policy, never typed here.

const rootState = (page: Page) => page.locator('#root');
const POS_ME = '/api/pos/auth/me';
const OFFICE_ME = '/api/back-office/auth/me';

const pathOf = (url: string) => new URL(url).pathname;
const reads = (profile: Profile, path: string) =>
  profile.requests.filter((request) => request.method === 'GET' && pathOf(request.url) === path);
const activity = (profile: Profile) =>
  profile.requests.filter((request) => pathOf(request.url).endsWith('/auth/activity')).length;

/** The page's own timers run on; this lets a just-settled answer reach the client before the clock moves again. */
const settle = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));

async function lastCodeOf(profile: Profile, path: string): Promise<string | null> {
  await profile.settled();
  const answers = profile.replies.filter((reply) => reply.method === 'GET' && reply.path === path);
  return answers.length === 0 ? null : answers[answers.length - 1]!.code;
}

async function signInPos(page: Page, cashier: Person): Promise<void> {
  await page.clock.install();
  await page.goto('/pos/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtPos(page, cashier);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
}

async function signInOffice(page: Page, manager: Person): Promise<void> {
  await page.clock.install();
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
}

test('B6. an idle POS session returns to POS-01', async ({ world, oneProfile }) => {
  const cashier = await world.people.cashier();
  const { pos } = oneProfile;
  await signInPos(pos, cashier);

  const seconds = SESSION_POLICY.POS.idleSeconds + 1;
  await ageSession('POS', cashier, seconds);
  await pos.clock.fastForward(seconds * 1000);

  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-out');
  await expect(pos.locator('[data-lock-state]')).toHaveAttribute('data-lock-state', 'resting');
  expect(await lastCodeOf(oneProfile, POS_ME)).toBe('SESSION_IDLE');
  // The deadline was reached by a read, not by a person acting.
  expect(activity(oneProfile)).toBe(0);
});

test('B7. an idle back-office session opens M-6 over the frame', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  await signInOffice(office, manager);

  const seconds = SESSION_POLICY.BACK_OFFICE.idleSeconds + 60;
  await ageSession('BACK_OFFICE', manager, seconds);
  await office.clock.fastForward(seconds * 1000);

  await expect(rootState(office)).toHaveAttribute('data-session', 'idle');
  await expect(office.getByRole('dialog', { name: REAUTH_TITLE })).toBeVisible();
  // The frame stays, visible and out of reach.
  for (const part of ['.bonav', '.botop', '.bocontent']) {
    await expect(office.locator(part)).toHaveAttribute('inert', '');
  }
  expect(await lastCodeOf(oneProfile, OFFICE_ME)).toBe('SESSION_IDLE');
  expect(activity(oneProfile)).toBe(0);
});

/**
 * The deadline read is not activity. The row is shifted so that the server has a
 * positive remainder left when the client first reaches its own deadline; that read
 * must find the session alive and extend nothing. Then the row and the page are
 * shifted past the remainder: a read that had extended the session would find it
 * alive again, and the page would stay as it is.
 */
async function polledTwice(
  profile: Profile,
  page: Page,
  audience: 'POS' | 'BACK_OFFICE',
  person: Person,
  mePath: string
): Promise<void> {
  const limit = SESSION_POLICY[audience].idleSeconds;
  const remainder = Math.floor(limit / 3);
  const readsBefore = reads(profile, mePath).length;

  await ageSession(audience, person, limit - remainder);
  const first = page.waitForResponse((r) => pathOf(r.url()) === mePath);
  await page.clock.fastForward((limit + 1) * 1000);
  expect((await first).status()).toBe(200);
  await settle(page);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
  expect(reads(profile, mePath)).toHaveLength(readsBefore + 1);

  await ageSession(audience, person, remainder + 1);
  await page.clock.fastForward((remainder + 1) * 1000);
}

test('B8. a POS read at the deadline extends nothing', async ({ world, oneProfile }) => {
  const cashier = await world.people.cashier();
  const { pos } = oneProfile;
  await signInPos(pos, cashier);

  await polledTwice(oneProfile, pos, 'POS', cashier, POS_ME);

  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-out');
  await expect(pos.locator('[data-lock-state]')).toHaveAttribute('data-lock-state', 'resting');
  expect(await lastCodeOf(oneProfile, POS_ME)).toBe('SESSION_IDLE');
  expect(activity(oneProfile)).toBe(0);
});

test('B8. and a back-office read at the deadline extends nothing', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  await signInOffice(office, manager);

  await polledTwice(oneProfile, office, 'BACK_OFFICE', manager, OFFICE_ME);

  await expect(rootState(office)).toHaveAttribute('data-session', 'idle');
  expect(await lastCodeOf(oneProfile, OFFICE_ME)).toBe('SESSION_IDLE');
  expect(activity(oneProfile)).toBe(0);
});

test('B-scan. the scan finds the credentials typed here in their own bodies', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { pos, office } = oneProfile;
  await pos.goto('/pos/');
  await office.goto('/back-office/');
  await signInAtPos(pos, manager);
  await signInAtBackOffice(office, manager);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  expect(world.credentialBodies('PIN', manager)).toBe(1);
  expect(world.credentialBodies('username', manager)).toBe(1);
  expect(world.credentialBodies('password', manager)).toBe(1);
});
