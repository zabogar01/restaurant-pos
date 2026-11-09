import type { Locator, Page } from '@playwright/test';
import { SESSION_ENDED } from '../../apps/back-office/src/copy.js';
import { createStaffUser } from '../../apps/server/src/domain/pin.js';
import { SESSION_POLICY } from '../../apps/server/src/domain/session.js';
import { listUsers } from '../../apps/server/src/domain/users.js';
import { ageSession } from '../support/clock.js';
import { ledger } from '../support/scan.js';
import {
  expect,
  signInAtBackOffice,
  signInAtPos,
  test,
  type Person,
  type Profile,
} from '../support/fixtures.js';
import {
  drawName,
  drawPassword,
  drawPin,
  drawUsername,
  fillNewPerson,
  fillOwnChange,
  fillPromotion,
  fillReactivationPin,
  fillResetPassword,
  fillResetPin,
} from '../support/staff.js';

// BO-06, Staff, in a real browser (PHASE1-S8c1 and S8c2, consult C3 section S8c, ADR-011 rules 27
// and 28). People come from the harness's domain functions with random credentials; the credentials a
// spec types into the screen are drawn by `support/staff.ts` and recorded as submitted, so the
// AC-18 scan counts them. The requests are the page's own; the database is read through the
// server's own `listUsers`. What is asserted is state, accessible names and codes, and changes
// rather than absolute counts. Nothing is deleted: names are random per run.

const rootState = (page: Page) => page.locator('#root');
const path = (suffix: string) => `/api/back-office/config/users/${suffix}`;
const ACTIVITY = '/api/pos/auth/activity';

const staffLink = (page: Page) => page.getByRole('link', { name: 'Staff', exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page) => page.locator('#page-status');

/** Signs the manager in and opens Staff from the rail, with the list read. */
async function openStaff(page: Page, manager: Person): Promise<void> {
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
  await staffLink(page).click();
  await expect(page).toHaveURL(/\/back-office\/staff$/);
  await expect(page.getByRole('heading', { name: 'Staff', exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('#read-state')).toHaveCount(0);
  await expect(page.locator('#list-facts')).toBeVisible();
}

/** Every request this profile's pages sent to one users route. */
const sent = (profile: Profile, suffix: string) =>
  profile.requests.filter((r) => r.method === 'POST' && new URL(r.url).pathname === path(suffix));

const stored = async (name: string) => (await listUsers()).find((u) => u.name === name);

/** The person is wholly inside the window: nothing of the control is below the fold. */
async function inViewport(page: Page, control: Locator): Promise<void> {
  const box = await control.boundingBox();
  const size = page.viewportSize();
  expect(box).not.toBeNull();
  expect(size).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(size!.height);
}

/** Deactivates through the confirmation, by the accessible names DESIGN-023 lists. */
async function deactivate(page: Page, name: string): Promise<void> {
  await button(page, `Deactivate — ${name}`).click();
  const dialog = page.getByRole('dialog', { name: `Deactivate ${name}?`, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: `Keep active — ${name}`, exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: `Deactivate ${name}`, exact: true }).click();
  await expect(status(page)).toHaveText(`${name} deactivated.`);
}

test('D1. AC-32, the POS half: a manager deactivates a signed-in cashier and the cashier’s next request ends their POS session', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const cashier = await world.people.cashier();
  const { a, b } = twoProfiles;

  await openStaff(a.page, manager);
  await b.page.goto('/pos/');
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtPos(b.page, cashier);
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-in');

  // Nothing is sent until the confirmation's final action.
  await button(a.page, `Deactivate — ${cashier.name}`).click();
  const dialog = a.page.getByRole('dialog', { name: `Deactivate ${cashier.name}?`, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: `Keep active — ${cashier.name}`, exact: true })).toBeFocused();
  await expect(dialog).toContainText(`${cashier.name}’s POS sessions will end on their next action.`);
  expect(sent(a, 'deactivate')).toHaveLength(0);
  await dialog.getByRole('button', { name: `Deactivate ${cashier.name}`, exact: true }).click();
  await expect(status(a.page)).toHaveText(`${cashier.name} deactivated.`);
  await expect(button(a.page, `Reactivate — ${cashier.name}`)).toBeFocused();
  expect(sent(a, 'deactivate')).toHaveLength(1);
  expect((await stored(cashier.name))?.isActive).toBe(false);

  // The cashier's next request is refused, and the POS shows POS-01, session invalidated.
  const refused = b.page.waitForResponse((r) => new URL(r.url()).pathname === ACTIVITY);
  await b.page.getByText(cashier.name).click();
  await refused;
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-out');
  await expect(b.page.locator('[data-lock-state]')).toHaveAttribute('data-lock-state', 'invalidated');

  await b.settled();
  const taps = b.replies.filter((reply) => reply.method === 'POST' && reply.path === ACTIVITY);
  expect(taps.map((reply) => reply.code)).toEqual(['UNAUTHENTICATED']);
});

test('D1b. a manager creates a cashier and a manager for real, and each signs in with what was typed', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const { a, b } = twoProfiles;
  await openStaff(a.page, manager);

  // A cashier: a name and a PIN.
  const cashier = { name: drawName(), pin: drawPin() };
  await button(a.page, 'Add person').click();
  await expect(a.page.getByRole('dialog', { name: 'Add person', exact: true })).toBeVisible();
  await expect(a.page.getByLabel('Name', { exact: true })).toBeFocused();
  await fillNewPerson(a.page, { classification: 'CASHIER', ...cashier });
  await button(a.page, 'Save').click();
  await expect(status(a.page)).toHaveText(`${cashier.name} added.`);
  await expect(button(a.page, `Change role — ${cashier.name}`)).toBeFocused();
  expect(sent(a, 'create')).toHaveLength(1);
  const madeCashier = await stored(cashier.name);
  expect(madeCashier?.classification).toBe('CASHIER');
  expect(madeCashier?.isActive).toBe(true);
  expect(madeCashier?.username).toBeNull();

  // A manager: a username typed in capitals and padded, stored in lower case.
  const made = { name: drawName(), pin: drawPin(), username: drawUsername(), password: drawPassword() };
  await button(a.page, 'Add person').click();
  await fillNewPerson(a.page, {
    classification: 'MANAGER',
    name: made.name,
    pin: made.pin,
    typedUsername: `  ${made.username.toUpperCase()}  `,
    username: made.username,
    password: made.password,
  });
  // The longest form: the commit controls stay in view while the field body scrolls (ruling 15).
  await inViewport(a.page, button(a.page, 'Save'));
  await inViewport(a.page, button(a.page, 'Cancel'));
  await button(a.page, 'Save').click();
  await expect(status(a.page)).toHaveText(`${made.name} added.`);
  expect(sent(a, 'create')).toHaveLength(2);
  const madeManager = await stored(made.name);
  expect(madeManager?.classification).toBe('MANAGER');
  expect(madeManager?.username).toBe(made.username);
  await expect(a.page.locator('#staff-rows tr', { hasText: made.name })).toContainText(`Username: ${made.username}`);

  // The new cashier signs in at the POS with the PIN typed at the screen.
  await b.page.goto('/pos/');
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtPos(b.page, cashier);
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-in');

  // The new manager signs in at the back office with the stored username and the typed password.
  await b.page.goto('/back-office/');
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(b.page, { name: made.name, username: made.username, password: made.password });
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-in');
});

test('D1d. after M-6 and a same-manager recovery the manager form still shows Save and Cancel, and focus is on Name', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const page = oneProfile.office;
  await page.clock.install();
  await openStaff(page, manager);
  await button(page, 'Add person').click();
  await page.getByLabel('Classification', { exact: true }).selectOption('MANAGER');
  await page.getByLabel('Name', { exact: true }).fill(drawName());
  await inViewport(page, button(page, 'Save'));

  const seconds = SESSION_POLICY.BACK_OFFICE.idleSeconds + 60;
  await ageSession('BACK_OFFICE', manager, seconds);
  await page.clock.fastForward(seconds * 1000);
  await expect(rootState(page)).toHaveAttribute('data-session', 'idle');
  // The shared helper's `getByLabel('Password')` would also match the open form's New password,
  // so M-6's own field is reached inside its dialog; the ledger counts the submission as usual.
  const gate = page.getByRole('dialog', { name: 'Your session timed out' });
  await gate.getByLabel('Password', { exact: true }).fill(manager.password!);
  ledger().submitted('password', manager.password!);
  await gate.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');

  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await inViewport(page, button(page, 'Save'));
  await inViewport(page, button(page, 'Cancel'));
});

test('D1c. reactivating a person whose PIN is now held asks for a new PIN, sends it once, and the person signs in with it', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const cashier = await world.people.cashier();
  const { a, b } = twoProfiles;
  await openStaff(a.page, manager);

  await deactivate(a.page, cashier.name);
  expect((await stored(cashier.name))?.isActive).toBe(false);
  // Another cashier, made through the domain, now holds the PIN the first one had.
  await createStaffUser({ name: drawName(), role: 'CASHIER', pin: cashier.pin });

  // The plain reactivation is refused for the held PIN: the form asks for a new one.
  await button(a.page, `Reactivate — ${cashier.name}`).click();
  await expect(a.page.getByRole('dialog', { name: `Reactivate — ${cashier.name}`, exact: true })).toBeVisible();
  await expect(a.page.getByLabel('New PIN', { exact: true })).toBeFocused();
  await expect(a.page.getByLabel('New PIN', { exact: true })).toHaveValue('');
  await expect(a.page.getByText('That PIN is already in use. Enter a new PIN to reactivate this person.', { exact: true })).toBeVisible();
  await expect(a.page.getByText(`Set a new PIN to reactivate ${cashier.name}.`, { exact: true })).toBeVisible();
  expect((await stored(cashier.name))?.isActive).toBe(false);

  const fresh = drawPin();
  await fillReactivationPin(a.page, fresh);
  await button(a.page, 'Reactivate with new PIN').click();
  await expect(status(a.page)).toHaveText(`${cashier.name} reactivated.`);
  await expect(button(a.page, `Change role — ${cashier.name}`)).toBeFocused();
  expect((await stored(cashier.name))?.isActive).toBe(true);

  // Exactly one plain reactivation and one with a PIN were sent.
  const reactivations = sent(a, 'reactivate').map((r) => JSON.parse(r.body ?? '{}') as Record<string, unknown>);
  expect(reactivations).toHaveLength(2);
  expect(reactivations.filter((body) => !('pin' in body))).toHaveLength(1);
  expect(reactivations.filter((body) => body.pin === fresh)).toHaveLength(1);

  await b.page.goto('/pos/');
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtPos(b.page, { name: cashier.name, pin: fresh });
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-in');
});

const LIST = '/api/back-office/config/users';

/** Signs a manager in at the back office in a second profile, and leaves it at the landing. */
async function signInSecond(page: Page, manager: Pick<Person, 'name' | 'username' | 'password'>): Promise<void> {
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
}

/**
 * The tab's next request is a read of the staff list, caused by the Staff link. The server
 * answers `UNAUTHENTICATED` and the tab reaches BO-01 *Session ended*, with the working area held.
 */
async function nextRequestEnds(profile: Profile & { page: Page }): Promise<void> {
  await staffLink(profile.page).click();
  await expect(rootState(profile.page)).toHaveAttribute('data-session', 'signed-out');
  await expect(profile.page.getByRole('alert').filter({ hasText: SESSION_ENDED.title })).toBeVisible();
  await expect(profile.page.locator('.office-work')).toHaveCount(1);
  await profile.settled();
  const reads = profile.replies.filter((reply) => reply.method === 'GET' && reply.path === LIST);
  expect(reads[reads.length - 1]?.code).toBe('UNAUTHENTICATED');
}

test('D2. AC-32, the back-office half: resetting another manager’s password ends their session in another profile, and the new password signs them in', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const other = await world.people.manager();
  const { a, b } = twoProfiles;
  await openStaff(a.page, manager);
  await signInSecond(b.page, other);

  // A resets B's password after reading the warning; nothing is sent before Save.
  await button(a.page, `Reset password — ${other.name}`).click();
  const form = a.page.getByRole('dialog', { name: `Reset password — ${other.name}`, exact: true });
  await expect(form).toBeVisible();
  await expect(a.page.getByLabel('New password', { exact: true })).toBeFocused();
  await expect(form).toContainText(
    `${other.name}’s POS and back-office sessions will end on their next action. They must sign in again.`
  );
  expect(sent(a, 'set-password')).toHaveLength(0);
  const fresh = drawPassword();
  await fillResetPassword(a.page, fresh);
  await inViewport(a.page, button(a.page, 'Save'));
  await button(a.page, 'Save').click();
  await expect(status(a.page)).toHaveText(`${other.name}’s password changed.`);
  await expect(button(a.page, `Change role — ${other.name}`)).toBeFocused();

  // B's next request is refused: BO-01 Session ended, the working area held.
  await nextRequestEnds(b);
  expect(sent(a, 'set-password')).toHaveLength(1);

  // B signs in with the new password and is signed in.
  await signInAtBackOffice(b.page, { name: other.name, username: other.username, password: fresh });
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-in');
});

test('D3. an own password change keeps this profile signed in, and ends the manager’s session in another', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const { a, b } = twoProfiles;
  await openStaff(a.page, manager);
  await signInSecond(b.page, manager);

  await button(a.page, `Change my password — ${manager.name}`).click();
  const form = a.page.getByRole('dialog', { name: `Change my password — ${manager.name}`, exact: true });
  await expect(form).toBeVisible();
  await expect(a.page.getByLabel('Current password', { exact: true })).toBeFocused();
  await expect(form).toContainText(
    'Your other POS and back-office sessions will end on their next action. This back-office session will continue.'
  );
  const fresh = drawPassword();
  await fillOwnChange(a.page, { current: manager.password!, password: fresh });
  await button(a.page, 'Save').click();
  // This profile stays signed in, with no sign-in in between, and its next command succeeds.
  await expect(rootState(a.page)).toHaveAttribute('data-session', 'signed-in');
  await expect(status(a.page)).toHaveText(`${manager.name}’s password changed. This back-office session continues.`);
  await expect(button(a.page, `Change my password — ${manager.name}`)).toBeFocused();
  expect(sent(a, 'own-password')).toHaveLength(1);
  await expect(rootState(a.page)).toHaveAttribute('data-session', 'signed-in');
  const next = drawName();
  await button(a.page, 'Add person').click();
  await fillNewPerson(a.page, { classification: 'KITCHEN', name: next });
  await button(a.page, 'Save').click();
  await expect(status(a.page)).toHaveText(`${next} added.`);
  await expect(rootState(a.page)).toHaveAttribute('data-session', 'signed-in');
  const posts = (profile: Profile, url: string) =>
    profile.requests.filter((r) => r.method === 'POST' && new URL(r.url).pathname === url);
  expect(posts(a, '/api/back-office/auth/login')).toHaveLength(1);
  expect(posts(a, '/api/back-office/auth/reauthenticate')).toHaveLength(0);

  // The manager's session in the other profile ends on its next request, and the new password signs in.
  await nextRequestEnds(b);
  await signInAtBackOffice(b.page, { name: manager.name, username: manager.username, password: fresh });
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-in');
});

test('D3b. an own PIN change keeps this profile signed in, and the new PIN signs in at the POS', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const { a, b } = twoProfiles;
  await openStaff(a.page, manager);

  await button(a.page, `Change my PIN — ${manager.name}`).click();
  await expect(a.page.getByRole('dialog', { name: `Change my PIN — ${manager.name}`, exact: true })).toBeVisible();
  await expect(a.page.getByLabel('Current password', { exact: true })).toBeFocused();
  const fresh = drawPin();
  await fillOwnChange(a.page, { current: manager.password!, pin: fresh });
  await button(a.page, 'Save').click();
  await expect(status(a.page)).toHaveText(`${manager.name}’s PIN changed. This back-office session continues.`);
  await expect(rootState(a.page)).toHaveAttribute('data-session', 'signed-in');
  expect(sent(a, 'own-pin')).toHaveLength(1);

  await b.page.goto('/pos/');
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtPos(b.page, { name: manager.name, pin: fresh });
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-in');
});

test('D2b. resetting a cashier’s PIN sends the new PIN once, and the cashier signs in with it', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const cashier = await world.people.cashier();
  const { a, b } = twoProfiles;
  await openStaff(a.page, manager);

  await button(a.page, `Reset PIN — ${cashier.name}`).click();
  const form = a.page.getByRole('dialog', { name: `Reset PIN — ${cashier.name}`, exact: true });
  await expect(form).toBeVisible();
  await expect(a.page.getByLabel('New PIN', { exact: true })).toBeFocused();
  await expect(form).toContainText(`${cashier.name}’s POS sessions will end on their next action. They must sign in again.`);
  const fresh = drawPin();
  await fillResetPin(a.page, fresh);
  await button(a.page, 'Save').click();
  await expect(status(a.page)).toHaveText(`${cashier.name}’s PIN changed.`);
  await expect(button(a.page, `Change role — ${cashier.name}`)).toBeFocused();
  expect(sent(a, 'set-pin')).toHaveLength(1);

  await b.page.goto('/pos/');
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtPos(b.page, { name: cashier.name, pin: fresh });
  await expect(rootState(b.page)).toHaveAttribute('data-session', 'signed-in');
});

test('D4. a cashier with no username is promoted to manager for real, and signs in at the back office with what was typed', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const cashier = await world.people.cashier();
  const { a, b } = twoProfiles;
  await openStaff(a.page, manager);

  await button(a.page, `Change role — ${cashier.name}`).click();
  const form = a.page.getByRole('dialog', { name: `Change role — ${cashier.name}`, exact: true });
  await expect(form).toBeVisible();
  // It opens with no destination: the select is focused, and Save is off.
  await expect(a.page.getByLabel('Classification', { exact: true })).toBeFocused();
  await expect(button(a.page, 'Save')).toHaveAttribute('aria-disabled', 'true');
  await expect(form).toContainText('Current classification: Cashier.');

  // A username with upper-case letters and padding, stored in lower case, and a new password.
  const made = { username: drawUsername(), password: drawPassword() };
  await fillPromotion(a.page, {
    typedUsername: `  ${made.username.toUpperCase()}  `,
    username: made.username,
    password: made.password,
  });
  await expect(form).toContainText(`${cashier.name}’s POS sessions will end on their next action. They must sign in again.`);
  await inViewport(a.page, button(a.page, 'Save'));
  await button(a.page, 'Save').click();
  await expect(status(a.page)).toHaveText(`${cashier.name} changed to Manager.`);
  await expect(button(a.page, `Change role — ${cashier.name}`)).toBeFocused();
  expect(sent(a, 'change-role')).toHaveLength(1);

  // The database holds the role and the stored username.
  const promoted = await stored(cashier.name);
  expect(promoted?.classification).toBe('MANAGER');
  expect(promoted?.username).toBe(made.username);

  await signInSecond(b.page, { name: cashier.name, username: made.username, password: made.password });
});
