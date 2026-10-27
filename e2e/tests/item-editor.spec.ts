import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { createCategory, editItem, readCatalog, type CatalogCategory } from '../../apps/server/src/domain/catalog.js';
import { expect, signInAtBackOffice, test, type Person, type Profile } from '../support/fixtures.js';

// BO-04 Item editor, the item's own fields, in a real browser (PHASE1-S4c2a, consult C2 section 6,
// ADR-011 rules 27 and 28). People come from the harness's domain functions with random
// credentials. The requests are the page's own; the database is read through the server's own
// domain function, as menu.spec.ts reads through `readCatalog`. What is asserted is state,
// accessible names and codes, and changes rather than absolute counts. Nothing is deleted (there
// is no DELETE): names are made unique per run.

const rootState = (page: Page) => page.locator('#root');
const route = (suffix: string) => `/api/back-office/config/catalog/${suffix}`;
const unique = (stem: string) => `${stem}-${randomBytes(4).toString('hex')}`;

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page) => page.locator('#page-status');
const nameField = (page: Page) => page.getByRole('textbox', { name: 'Item name', exact: true });
const priceField = (page: Page) => page.getByRole('textbox', { name: 'Base price', exact: true });

/** Signs the manager in and opens Menu from the rail, with the list drawn. */
async function openMenu(page: Page, manager: Person): Promise<void> {
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
  await page.getByRole('link', { name: 'Menu', exact: true }).click();
  await expect(page).toHaveURL(/\/back-office\/menu$/);
  await expect(page.getByRole('heading', { name: 'Menu', exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('#read-state')).toHaveCount(0);
}

/** Every request this profile's pages sent to one catalog route. */
const sent = (profile: Profile, suffix: string) =>
  profile.requests.filter((r) => r.method === 'POST' && new URL(r.url).pathname === route(suffix)).length;

async function made(name: string): Promise<CatalogCategory> {
  const outcome = await createCategory(name);
  if (outcome.kind !== 'OK') throw new Error(`could not make category ${name}`);
  return outcome.record;
}

const stored = async (name: string) => (await readCatalog()).items.find((i) => i.name === name);

/** Makes an item through the screen: the manager presses the category's New item and saves. */
async function createThroughScreen(office: Page, category: string, name: string, price: string): Promise<void> {
  await button(office, `New item in ${category}`).click();
  await expect(office).toHaveURL(/\/back-office\/menu\/item$/);
  await expect(office.getByRole('heading', { name: 'New item', exact: true, level: 1 })).toBeVisible();
  await expect(nameField(office)).toBeFocused();
  await nameField(office).fill(name);
  await priceField(office).fill(price);
  await button(office, 'Save').click();
  await expect(office).toHaveURL(/\/back-office\/menu$/);
}

test('I1. a manager makes an item with New item, edits it with Edit, and the database agrees each time', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const category = await made(unique('Mains'));
  const name = unique('Satay');
  const renamed = unique('Sate');
  await openMenu(office, manager);

  // (a) Create: the category's New item, a name and 12.500, Save.
  await createThroughScreen(office, category.name, name, '12.500');
  await expect(status(office)).toHaveText(`${name} saved.`);
  const row = office.locator('tr[data-item]', { hasText: name });
  await expect(row.locator('td.num')).toHaveText('12.500');
  await expect(button(office, `Edit ${name}`)).toBeFocused();
  expect(sent(oneProfile, 'items/create')).toBe(1);
  const created = await stored(name);
  expect(created?.basePrice).toBe(12500n);
  expect(created?.categoryId).toBe(category.categoryId);
  expect(created?.variants).toEqual([]);
  expect(created?.modifiers).toEqual([]);

  // (b) Edit: the name and the price, Save, exactly one update.
  await button(office, `Edit ${name}`).click();
  await expect(office).toHaveURL(/\/back-office\/menu\/item$/);
  await expect(office.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
  await expect(priceField(office)).toHaveValue('12.500');
  await nameField(office).fill(renamed);
  await priceField(office).fill('15000');
  await button(office, 'Save').click();
  await expect(office).toHaveURL(/\/back-office\/menu$/);
  await expect(status(office)).toHaveText(`${renamed} saved.`);
  await expect(office.locator('tr[data-item]', { hasText: renamed }).locator('td.num')).toHaveText('15.000');
  expect(sent(oneProfile, 'items/update')).toBe(1);
  expect(await stored(name)).toBeUndefined();
  expect((await stored(renamed))?.basePrice).toBe(15000n);
});

test('I2. an item changed meanwhile: the save is refused, nothing is written, and Keep my changes then Save saves the manager’s price', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const category = await made(unique('Mains'));
  const name = unique('Rice');
  await openMenu(office, manager);
  await createThroughScreen(office, category.name, name, '20.000');
  const before = await stored(name);

  await button(office, `Edit ${name}`).click();
  await expect(priceField(office)).toHaveValue('20.000');
  const version = (await readCatalog()).version;

  // Another tab writes: the domain changes the price and advances the version.
  const other = await editItem(before!.itemId, version, { fields: { basePrice: 30000n } });
  expect(other.kind).toBe('OK');
  const current = (await readCatalog()).version;

  await priceField(office).fill('25.000');
  await button(office, 'Save').click();
  await expect(office.locator('#form-notice')).toContainText(
    `Nothing was saved. The menu has been read again at version ${current}. Your draft is kept. Choose which to keep.`
  );
  await expect(office.locator('#form-notice')).toBeFocused();
  expect(sent(oneProfile, 'items/update')).toBe(1);
  expect((await stored(name))?.basePrice).toBe(30000n);
  await expect(office.locator('#current-values')).toContainText('30.000');
  await expect(button(office, 'Save')).toHaveAttribute('aria-disabled', 'true');

  await button(office, 'Keep my changes').click();
  await expect(button(office, 'Save')).toBeFocused();
  expect(sent(oneProfile, 'items/update')).toBe(1);
  await button(office, 'Save').click();
  await expect(office).toHaveURL(/\/back-office\/menu$/);
  await expect(status(office)).toHaveText(`${name} saved.`);
  expect(sent(oneProfile, 'items/update')).toBe(2);
  expect((await stored(name))?.basePrice).toBe(25000n);
});

test('I3. a reload on the item editor leaves no subject: the sentence, Return to menu, and the way back to Menu', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const category = await made(unique('Mains'));
  const name = unique('Soup');
  await openMenu(office, manager);
  await createThroughScreen(office, category.name, name, '9.000');
  await button(office, `Edit ${name}`).click();
  await expect(office).toHaveURL(/\/back-office\/menu\/item$/);

  // A reload destroys the working area, and the session is the cookie's, so the manager is still in.
  await office.reload();
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  await expect(office).toHaveURL(/\/back-office\/menu\/item$/);
  await expect(office.getByRole('heading', { name: 'Item editor', exact: true, level: 1 })).toBeVisible();
  await expect(office.getByText('Choose an item on Menu to edit it.')).toBeVisible();
  await expect(office.getByRole('link', { name: 'Return to menu', exact: true })).toBeFocused();
  await expect(office.getByRole('link', { name: 'Menu', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(office.url()).not.toContain('?');

  await office.getByRole('link', { name: 'Return to menu', exact: true }).click();
  await expect(office).toHaveURL(/\/back-office\/menu$/);
  await expect(office.getByRole('heading', { name: 'Menu', exact: true, level: 1 })).toBeVisible();
});
