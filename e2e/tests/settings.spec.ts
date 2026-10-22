import type { Page } from '@playwright/test';
import { rateFromPpm } from '@pos/money';
import { SESSION_ENDED } from '../../apps/back-office/src/copy.js';
import { ACTIVITY_WINDOW_MS } from '../../apps/back-office/src/session/activity.js';
import { readCurrentSettings, saveSettings, type SettingsValues } from '../../apps/server/src/domain/settings.js';
import { ageAbsolute } from '../support/absolute.js';
import { ageSession } from '../support/clock.js';
import { expect, signInAtBackOffice, test, type Person, type Profile } from '../support/fixtures.js';

// BO-08, the settings part, in a real browser (PHASE1-S2b, consult C2 section 7, ADR-011 rules
// 27 and 28). People come from the harness's domain functions with random credentials. The
// requests are the page's own; the database is read through the server's own domain function,
// as the other specs read through theirs. What is asserted is state, accessible names and codes.
//
// The last case is the one jsdom cannot see: a modal in a hidden working area is, by the
// specification, not drawn and still blocks everything behind it, BO-01's fields included. The
// rate confirmation is opened before the session ends, so the engine has a live modal to get wrong.

const rootState = (page: Page) => page.locator('#root');
const SAVE_PATH = '/api/back-office/config/settings/save';

const settingsLink = (page: Page) => page.getByRole('link', { name: 'Settings', exact: true });
const textbox = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });
const confirmation = (page: Page) => page.getByRole('dialog', { name: 'Save new rates?', exact: true });

const VERSION_ONE: SettingsValues = {
  taxRate: rateFromPpm(100_000n),
  serviceChargeRate: rateFromPpm(50_000n),
  outletName: 'Warung Sederhana',
  address: 'Jl. Melati No. 12\nKebayoran Baru',
  phone: '021 555 0134',
  npwpd: null,
  footer: 'Terima kasih',
};

/** Signs the manager in and opens Settings from the rail. */
async function openSettings(page: Page, manager: Person): Promise<void> {
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
  await settingsLink(page).click();
  await expect(page).toHaveURL(/\/back-office\/settings$/);
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
}

/** Saves version 1 through the domain function, as a person the page does not know about. */
async function seedVersionOne(actor: Person): Promise<void> {
  const outcome = await saveSettings({ actorId: actor.id, expectedVersion: null, values: VERSION_ONE });
  expect(outcome.kind).toBe('SAVED');
}

const savesSent = (profile: Profile) =>
  profile.requests.filter((r) => r.method === 'POST' && new URL(r.url).pathname === SAVE_PATH).length;

/**
 * The session outlives its absolute limit, and the tab's next request is caused the way the
 * other specs cause one: an input after the activity window, both clocks moved by the same
 * amount. The server answers `UNAUTHENTICATED`, and the tab reaches BO-01 *Session ended*.
 */
async function endAbsolutely(page: Page, profile: Profile, manager: Person): Promise<void> {
  const seconds = ACTIVITY_WINDOW_MS / 1000 + 1;
  await ageAbsolute(manager);
  await ageSession('BACK_OFFICE', manager, seconds);
  await page.clock.fastForward(seconds * 1000);
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/back-office/auth/activity' && r.request().method() === 'POST');
  await page.keyboard.press('Shift');
  await answered;
  await profile.settled();
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await expect(page.getByRole('alert').filter({ hasText: SESSION_ENDED.title })).toBeVisible();
}

test('S1. a manager saves settings with tax 10,5 and service 5: the page and the database agree', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  // The harness resets the database before each case, so this is the first version; if an
  // earlier case ever left one, the case asserts the next version instead.
  const before = await readCurrentSettings();
  const expected = (before?.version ?? 0) + 1;
  await openSettings(office, manager);

  if (before === null) await office.getByRole('button', { name: 'Enter settings', exact: true }).click();
  else await office.getByRole('button', { name: 'Change tax rate', exact: true }).click();
  await textbox(office, 'Tax rate').fill('10,5');
  await textbox(office, 'Service charge rate').fill('5');
  await textbox(office, 'Outlet name').fill('Warung Sederhana');
  await textbox(office, 'Address').fill('Jl. Melati No. 12\nKebayoran Baru');
  await textbox(office, 'Phone').fill('021 555 0134');
  await textbox(office, 'NPWPD').fill('');
  await textbox(office, 'Footer line').fill('Terima kasih');
  await save(office).click();
  // A change of rate asks first; the first save has no earlier rate to change.
  if (before !== null) {
    await expect(confirmation(office)).toBeVisible();
    await office.getByRole('button', { name: 'Save new rates', exact: true }).click();
  }

  await expect(office.getByText(`Settings saved as version ${expected}. Orders opened from now on use them.`)).toBeVisible();
  await expect(office.getByText(`Version ${expected} · In force since`, { exact: false })).toContainText(`Saved by ${manager.name}`);
  await expect(office.getByText('10,5%', { exact: true })).toBeVisible();
  await expect(office.getByText('5%', { exact: true })).toBeVisible();
  expect(savesSent(oneProfile)).toBe(1);

  const stored = await readCurrentSettings();
  expect(stored?.version).toBe(expected);
  expect(stored?.taxRate).toBe(105_000n);
  expect(stored?.serviceChargeRate).toBe(50_000n);
  expect(stored?.createdByName).toBe(manager.name);
});

test('S2. a second person saves first: the stale notice shows, the draft is kept, and exactly one save was sent', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const rival = await world.people.manager();
  const { office } = oneProfile;
  await seedVersionOne(manager);
  await openSettings(office, manager);
  await expect(office.getByText('Version 1 · In force since', { exact: false })).toBeVisible();

  await office.getByRole('button', { name: 'Change phone', exact: true }).click();
  await textbox(office, 'Phone').fill('021 555 0000');

  // Another person saves version 2 while the form is open.
  const second = await saveSettings({
    actorId: rival.id,
    expectedVersion: 1,
    values: { ...VERSION_ONE, footer: 'Sampai jumpa' },
  });
  expect(second.kind).toBe('SAVED');

  await save(office).click();
  await expect(office.getByRole('alert').filter({ hasText: 'Settings changed while you were editing' })).toBeVisible();
  expect(savesSent(oneProfile)).toBe(1);
  await expect(textbox(office, 'Phone')).toHaveValue('021 555 0000');
  await expect(office.getByText('Version 2 · In force since', { exact: false })).toContainText(`Saved by ${rival.name}`);
  await expect(office.getByText('Now in force: Sampai jumpa')).toBeVisible();
  await expect(save(office)).toHaveAttribute('aria-disabled', 'true');

  // Pressing the disabled Save sends nothing; neither does Keep my changes. Playwright waits for
  // an `aria-disabled` button to become enabled, so the press is forced: it is the point.
  await save(office).click({ force: true });
  await office.getByRole('button', { name: 'Keep my changes', exact: true }).click();
  await expect(save(office)).not.toHaveAttribute('aria-disabled', 'true');
  expect(savesSent(oneProfile)).toBe(1);
  const stored = await readCurrentSettings();
  expect(stored?.version).toBe(2);
  expect(stored?.phone).toBe(VERSION_ONE.phone);
});

test('S3. the rate confirmation is closed at BO-01 and back for the same manager, who must press Save new rates', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  await seedVersionOne(manager);
  await office.clock.install();
  await openSettings(office, manager);

  await office.getByRole('button', { name: 'Change tax rate', exact: true }).click();
  await textbox(office, 'Tax rate').fill('11');
  await save(office).click();
  await expect(confirmation(office)).toBeVisible();

  await endAbsolutely(office, oneProfile, manager);

  // The hazard: a live modal in a hidden area would draw nothing and still block these.
  await expect(confirmation(office)).toBeHidden();
  const username = office.getByLabel('Username');
  await username.pressSequentially('x');
  await expect(username).toHaveValue('x');
  await signInAtBackOffice(office, manager);

  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  await expect(confirmation(office)).toBeVisible();
  await expect(office.getByRole('button', { name: 'Back to editing', exact: true })).toBeFocused();
  // Signing in again sent nothing.
  expect(savesSent(oneProfile)).toBe(0);
  await office.getByRole('button', { name: 'Back to editing', exact: true }).click();
  await expect(confirmation(office)).toHaveCount(0);
  await expect(textbox(office, 'Tax rate')).toHaveValue('11');
  await expect(textbox(office, 'Tax rate')).toBeFocused();
  expect((await readCurrentSettings())?.version).toBe(1);
});
