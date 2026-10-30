import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { createCategory } from '../../apps/server/src/domain/catalog.js';
import { createPreset, listPresets } from '../../apps/server/src/domain/discount-preset.js';
import { rateFromPercent } from '@pos/money';
import { expect, signInAtBackOffice, test, type Person, type Profile } from '../support/fixtures.js';

// BO-07, Discount presets, in a real browser (PHASE1-S6b, consult C2 section 8, ADR-011 rules 27
// and 28). People come from the harness's domain functions with random credentials. The requests
// are the page's own; the database is read through the server's own domain function, as
// payment-methods.spec.ts reads through `listTenderMethods`. What is asserted is state,
// accessible names and codes, and changes rather than absolute counts. Nothing is deleted (there
// is no DELETE): names are made unique per run.

const rootState = (page: Page) => page.locator('#root');
const path = (suffix: string) => `/api/back-office/config/catalog/presets/${suffix}`;

const unique = (stem: string) => `${stem}-${randomBytes(4).toString('hex')}`;

const presetsLink = (page: Page) => page.getByRole('link', { name: 'Discount presets', exact: true });
const newPreset = (page: Page) => page.getByRole('button', { name: 'New preset', exact: true });
const nameField = (page: Page) => page.getByRole('textbox', { name: 'Preset name', exact: true });
const percentField = (page: Page) => page.getByRole('textbox', { name: 'Percentage', exact: true });
const amountField = (page: Page) => page.getByRole('textbox', { name: 'Fixed amount', exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page) => page.locator('#page-status');
const rowOf = (page: Page, name: string) =>
  page.locator('#preset-rows tr', { has: page.getByRole('button', { name: new RegExp(`^Edit ${name} — `) }) });

/** Signs the manager in and opens Discount presets from the rail, with the list read. */
async function openPresets(page: Page, manager: Person): Promise<void> {
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
  await presetsLink(page).click();
  await expect(page).toHaveURL(/\/back-office\/presets$/);
  await expect(page.getByRole('heading', { name: 'Discount presets', exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('#read-state')).toHaveCount(0);
  await expect(page.locator('#list-facts')).toBeVisible();
}

/** Every request this profile's pages sent to one presets route. */
const sent = (profile: Profile, suffix: string) =>
  profile.requests.filter((r) => r.method === 'POST' && new URL(r.url).pathname === path(suffix)).length;

/** A preset made through the domain, as another tab or the owner's own tool would. */
async function made(name: string, percent = '10') {
  const outcome = await createPreset(name, { kind: 'PERCENTAGE', ratePpm: rateFromPercent(percent) });
  if (outcome.kind !== 'OK') throw new Error(`could not make preset ${name}`);
  return outcome.record;
}

const stored = async (name: string) => (await listPresets()).presets.find((p) => p.name === name);

test('P1. a manager creates a percentage preset, edits it into a fixed amount, deactivates it through the confirmation, reactivates it, and the database agrees', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const name = unique('Happy');
  await openPresets(office, manager);

  // Create: a percentage typed 10, listed as 10%, announced, with its Edit focused.
  await newPreset(office).click();
  await expect(office.getByRole('dialog', { name: 'New preset', exact: true })).toBeVisible();
  await expect(nameField(office)).toBeFocused();
  await nameField(office).fill(name);
  await percentField(office).fill('10');
  await button(office, 'Save').click();
  await expect(status(office)).toHaveText(`${name} saved.`);
  await expect(button(office, `Edit ${name} — active`)).toBeFocused();
  await expect(rowOf(office, name).locator('td').nth(1)).toContainText('10%');
  expect(sent(oneProfile, 'create')).toBe(1);
  const created = await stored(name);
  expect(created?.isActive).toBe(true);
  expect(created?.value.kind).toBe('PERCENTAGE');
  expect(created?.value.kind === 'PERCENTAGE' && created.value.ratePpm.toString()).toBe('100000');

  // Edit it into a fixed amount: the whole preset, the new kind, no rate left behind.
  await button(office, `Edit ${name} — active`).click();
  await expect(office.getByRole('dialog', { name: `Edit ${name}`, exact: true })).toBeVisible();
  await office.getByRole('radio', { name: 'Fixed amount', exact: true }).check();
  await expect(amountField(office)).toBeFocused();
  await expect(amountField(office)).toHaveValue('');
  await amountField(office).fill('5.000');
  await button(office, 'Save').click();
  await expect(status(office)).toHaveText(`${name} saved.`);
  await expect(rowOf(office, name).locator('td').nth(1)).toContainText('5.000');
  await expect(rowOf(office, name).locator('td').nth(1)).toContainText('Fixed amount');
  expect(sent(oneProfile, 'update')).toBe(1);
  const edited = await stored(name);
  expect(edited?.value.kind).toBe('FIXED');
  expect(edited?.value.kind === 'FIXED' && edited.value.amount.toString()).toBe('5000');
  expect(edited?.value).not.toHaveProperty('ratePpm');

  // Deactivate through the confirmation: nothing is sent until its final action.
  await button(office, `Deactivate ${name}`).click();
  const dialog = office.getByRole('dialog', { name: `Deactivate “${name}”?`, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: `Keep active — ${name}`, exact: true })).toBeFocused();
  expect(sent(oneProfile, 'deactivate')).toBe(0);
  await dialog.getByRole('button', { name: `Deactivate ${name}`, exact: true }).click();
  await expect(status(office)).toHaveText(`${name} deactivated. It is hidden from the POS picker; existing orders keep it.`);
  await expect(rowOf(office, name).locator('td').nth(2)).toHaveText('Inactive');
  expect(sent(oneProfile, 'deactivate')).toBe(1);
  expect((await stored(name))?.isActive).toBe(false);

  // Reactivate at once, with no confirmation.
  await button(office, `Reactivate ${name}`).click();
  await expect(status(office)).toHaveText(`${name} reactivated. Staff can choose it at the POS.`);
  await expect(rowOf(office, name).locator('td').nth(2)).toHaveText('Active');
  expect(sent(oneProfile, 'reactivate')).toBe(1);
  expect((await stored(name))?.isActive).toBe(true);
});

test('P2. the catalog version is shared: a menu change refuses a preset edit as stale, once, and Keep my changes then saves it', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const name = unique('Staff');
  const renamed = unique('Crew');
  await made(name);
  await openPresets(office, manager);

  await button(office, `Edit ${name} — active`).click();
  // Only the menu changes, through the domain: the preset itself does not.
  const category = await createCategory(unique('Mains'));
  expect(category.kind).toBe('OK');
  await nameField(office).fill(renamed);
  await button(office, 'Save').click();

  const notice = office.locator('#form-notice');
  await expect(notice).toContainText('The catalog changed while you were editing');
  await expect(notice).toBeFocused();
  await expect(office.locator('#current-name')).toHaveText(`Current name: ${name} · Differs from your draft`);
  await expect(button(office, 'Save')).toHaveAttribute('aria-disabled', 'true');
  expect(sent(oneProfile, 'update')).toBe(1);
  expect(await stored(name)).toBeDefined();
  expect(await stored(renamed)).toBeUndefined();

  await button(office, 'Keep my changes').click();
  await expect(button(office, 'Save')).toBeFocused();
  expect(sent(oneProfile, 'update')).toBe(1);
  await button(office, 'Save').click();
  await expect(status(office)).toHaveText(`${renamed} saved.`);
  expect(sent(oneProfile, 'update')).toBe(2);
  expect(await stored(renamed)).toBeDefined();
  expect(await stored(name)).toBeUndefined();
});

test('P3. a stale save of a draft equal to the stored preset says the current preset has the same values', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const name = unique('Same');
  await made(name);
  await openPresets(office, manager);

  await button(office, `Edit ${name} — active`).click();
  expect((await createCategory(unique('Sides'))).kind).toBe('OK');
  await button(office, 'Save').click();
  await expect(office.locator('#current-same')).toHaveText('The current preset has the same values as your draft.');
  await expect(office.locator('#current-name')).toHaveCount(0);
  await expect(office.locator('#current-value')).toHaveCount(0);
  expect(sent(oneProfile, 'update')).toBe(1);
  expect((await stored(name))?.isActive).toBe(true);
});

test('P4. a name an active preset already holds is refused on the name, with one create sent and the holder marked', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const holder = unique('Holder');
  await made(holder);
  await openPresets(office, manager);
  await expect(office.locator('#preset-rows td:first-child').filter({ hasText: holder })).toHaveCount(1);
  const before = (await listPresets()).presets.length;

  await newPreset(office).click();
  await nameField(office).fill(holder.toLowerCase());
  await percentField(office).fill('10');
  await button(office, 'Save').click();

  await expect(office.getByText('An active preset already uses this name. Choose another name.', { exact: true })).toBeVisible();
  await expect(nameField(office)).toBeFocused();
  await expect(nameField(office)).toHaveValue(holder.toLowerCase());
  await expect(nameField(office)).toHaveAttribute('aria-invalid', 'true');
  expect(sent(oneProfile, 'create')).toBe(1);
  // The holder's row says so, as text and not as a link.
  const marked = office.locator('#preset-rows td:first-child').filter({ hasText: holder });
  await expect(marked).toContainText('Name in use');
  await expect(marked.locator('a, button')).toHaveCount(0);
  expect((await listPresets()).presets.length).toBe(before);
});
