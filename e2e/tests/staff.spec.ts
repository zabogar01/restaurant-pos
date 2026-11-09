import type { Locator, Page } from '@playwright/test';
import { createStaffUser } from '../../apps/server/src/domain/pin.js';
import { listUsers } from '../../apps/server/src/domain/users.js';
import { expect, signInAtBackOffice, signInAtPos, test, type Person, type Profile } from '../support/fixtures.js';
import { drawName, drawPassword, drawPin, drawUsername, fillNewPerson, fillReactivationPin } from '../support/staff.js';

// BO-06, Staff, part 1, in a real browser (PHASE1-S8c1, consult C3 section S8c, ADR-011 rules 27 and
// 28). People come from the harness's domain functions with random credentials; the credentials a
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
  await expect(button(a.page, `Deactivate — ${cashier.name}`)).toBeFocused();
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
  await expect(button(a.page, `Deactivate — ${cashier.name}`)).toBeFocused();
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
