import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { REAUTH_TITLE, SESSION_ENDED } from '../../apps/back-office/src/copy.js';
import { ACTIVITY_WINDOW_MS } from '../../apps/back-office/src/session/activity.js';
import { SESSION_POLICY } from '../../apps/server/src/domain/session.js';
import { ageAbsolute } from '../support/absolute.js';
import { ageSession } from '../support/clock.js';
import {
  expect,
  reauthenticateAtOffice,
  signInAtBackOffice,
  test,
  type Person,
  type Profile,
} from '../support/fixtures.js';

// AC-35's last sentence, in a real browser (consult C2 section 7, cases C1 to C3; ADR-011
// rules 27 and 28): the same manager gets an unsaved edit back through M-6 and through
// BO-01, and a different manager never sees it. People come from the harness's domain
// functions with random credentials; the server judges by its own clock, so each case moves
// both: the session's rows in PostgreSQL and the page's clock by the same amount. The
// requests are the page's own. What is asserted is state, accessible names and codes.
//
// The case that cannot be seen in jsdom is the last: a modal dialog in a hidden working area
// is, by the specification, not drawn and still blocks everything behind it, BO-01's fields
// included. The decision is opened before the session ends, so the engine has a live modal
// to get wrong.

const rootState = (page: Page) => page.locator('#root');
const ACTIVITY = '/api/back-office/auth/activity';

const randomLabel = () => `T-${randomBytes(5).toString('hex')}`;
const editName = (label: string) => `Edit ${label} — active`;

const tablesLink = (page: Page) => page.getByRole('link', { name: 'Tables', exact: true });
const newTable = (page: Page) => page.getByRole('button', { name: 'New table', exact: true });
const labelField = (page: Page) => page.getByRole('textbox', { name: 'Table label', exact: true });
const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });
const editPanel = (page: Page, label: string) => page.getByRole('dialog', { name: `Edit ${label}`, exact: true });
const decision = (page: Page) => page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
const m6 = (page: Page) => page.getByRole('dialog', { name: REAUTH_TITLE, exact: true });

/** The text of every input on the page, to prove that a draft is nowhere. */
async function inputValues(page: Page): Promise<string[]> {
  return page.locator('input').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
}

/** Signs the manager in, opens Tables from the rail, and sees the empty starting state (B-24). */
async function openTables(page: Page, manager: Person): Promise<void> {
  await page.clock.install();
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
  await tablesLink(page).click();
  await expect(page).toHaveURL(/\/back-office\/tables$/);
  await expect(page.getByRole('heading', { name: 'Tables', exact: true })).toBeVisible();
  await expect(page.getByText('No tables yet')).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
}

/** Creates a table with a random label through the form, and sees its row. */
async function createTable(page: Page): Promise<string> {
  const label = randomLabel();
  await newTable(page).click();
  await expect(page.getByRole('dialog', { name: 'New table', exact: true })).toBeVisible();
  await labelField(page).fill(label);
  await save(page).click();
  await expect(page.getByRole('button', { name: editName(label), exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'New table', exact: true })).toHaveCount(0);
  return label;
}

/** Opens the table's edit form and types a new label, leaving the caret in the field without saving. */
async function editWithoutSaving(page: Page, label: string): Promise<string> {
  const unsaved = randomLabel();
  await page.getByRole('button', { name: editName(label), exact: true }).click();
  await expect(editPanel(page, label)).toBeVisible();
  await labelField(page).fill(unsaved);
  await expect(labelField(page)).toBeFocused();
  return unsaved;
}

/** The session idles out, with the page's clock moved by the same amount: M-6 is up over the form. */
async function idleOut(page: Page, manager: Person): Promise<void> {
  const seconds = SESSION_POLICY.BACK_OFFICE.idleSeconds + 1;
  await ageSession('BACK_OFFICE', manager, seconds);
  await page.clock.fastForward(seconds * 1000);
  await expect(rootState(page)).toHaveAttribute('data-session', 'idle');
  await expect(m6(page)).toBeVisible();
}

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
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === ACTIVITY && r.request().method() === 'POST');
  await page.keyboard.press('Shift');
  await answered;
  await profile.settled();
  const replies = profile.replies.filter((reply) => reply.path === ACTIVITY);
  expect(replies[replies.length - 1]?.code).toBe('UNAUTHENTICATED');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await expect(page.getByRole('alert').filter({ hasText: SESSION_ENDED.title })).toBeVisible();
}

test('C1. the same manager gets the unsaved edit back through M-6, and Save then succeeds', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  await openTables(office, manager);
  const label = await createTable(office);
  const unsaved = await editWithoutSaving(office, label);

  await idleOut(office, manager);
  await reauthenticateAtOffice(office, manager);

  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  await expect(editPanel(office, label)).toBeVisible();
  await expect(labelField(office)).toHaveValue(unsaved);
  await expect(labelField(office)).toBeFocused();

  // The first command after a renewal goes under the new anti-CSRF token.
  await save(office).click();
  await expect(office.getByRole('button', { name: editName(unsaved), exact: true })).toBeVisible();
  await expect(office.getByRole('button', { name: editName(label), exact: true })).toHaveCount(0);
  await expect(editPanel(office, label)).toHaveCount(0);
});

test('C2. another manager through M-6 never sees the unsaved edit', async ({ world, oneProfile }) => {
  const first = await world.people.manager();
  const second = await world.people.manager();
  const { office } = oneProfile;
  await openTables(office, first);
  const label = await createTable(office);
  const unsaved = await editWithoutSaving(office, label);

  await idleOut(office, first);
  await m6(office).getByRole('button', { name: 'Sign in as a different manager' }).click();
  await office.getByRole('dialog').getByRole('button', { name: 'Continue to sign-in' }).click();
  await signInAtBackOffice(office, second);

  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  await expect(office.locator('.office-actor')).toHaveText(second.name);
  await expect(office.getByRole('dialog', { name: /^Edit / })).toHaveCount(0);
  // The list is the server's: the table under its saved label only.
  await expect(office.getByRole('button', { name: editName(label), exact: true })).toBeVisible();
  await expect(office.getByRole('button', { name: editName(unsaved), exact: true })).toHaveCount(0);
  expect(await inputValues(office)).not.toContain(unsaved);
});

test('C3. the same manager gets the form back through BO-01, with a modal decision open before it ended', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  await openTables(office, manager);
  const label = await createTable(office);
  const unsaved = await editWithoutSaving(office, label);
  await office.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(decision(office)).toBeVisible();

  await endAbsolutely(office, oneProfile, manager);

  // The hazard: a live modal in a hidden area would draw nothing and still block these.
  await expect(decision(office)).toBeHidden();
  const username = office.getByLabel('Username');
  await username.pressSequentially('x');
  await expect(username).toHaveValue('x');
  await signInAtBackOffice(office, manager);

  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  await expect(decision(office)).toBeVisible();
  await expect(office.getByRole('button', { name: 'Stay', exact: true })).toBeFocused();
  await office.getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(decision(office)).toHaveCount(0);
  await expect(editPanel(office, label)).toBeVisible();
  await expect(labelField(office)).toHaveValue(unsaved);
  await expect(labelField(office)).toBeFocused();
});

test('C3. and with the form open and no decision, the panel comes back with the unsaved value focused', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  await openTables(office, manager);
  const label = await createTable(office);
  const unsaved = await editWithoutSaving(office, label);

  await endAbsolutely(office, oneProfile, manager);
  await expect(office.locator('main.bocontent')).toBeHidden();
  await signInAtBackOffice(office, manager);

  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  await expect(editPanel(office, label)).toBeVisible();
  await expect(labelField(office)).toHaveValue(unsaved);
  await expect(labelField(office)).toBeFocused();
});

test('C3. another manager through BO-01 never sees the unsaved edit or the decision', async ({ world, oneProfile }) => {
  const first = await world.people.manager();
  const second = await world.people.manager();
  const { office } = oneProfile;
  await openTables(office, first);
  const label = await createTable(office);
  const unsaved = await editWithoutSaving(office, label);
  await office.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(decision(office)).toBeVisible();

  await endAbsolutely(office, oneProfile, first);
  await signInAtBackOffice(office, second);

  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  await expect(office.locator('.office-actor')).toHaveText(second.name);
  await expect(decision(office)).toHaveCount(0);
  await expect(office.getByRole('dialog', { name: /^Edit / })).toHaveCount(0);
  await expect(office.getByRole('button', { name: editName(label), exact: true })).toBeVisible();
  await expect(office.getByRole('button', { name: editName(unsaved), exact: true })).toHaveCount(0);
  expect(await inputValues(office)).not.toContain(unsaved);
});
