import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import {
  archiveCategory,
  createCategory,
  createItem,
  readCatalog,
  type CatalogCategory,
} from '../../apps/server/src/domain/catalog.js';
import { expect, signInAtBackOffice, test, type Person, type Profile } from '../support/fixtures.js';

// BO-03 Menu, in a real browser (PHASE1-S4c1, consult C2 section 6, ADR-011 rules 27 and 28).
// People come from the harness's domain functions with random credentials. The requests are the
// page's own; the database is read through the server's own domain function, as
// payment-methods.spec.ts reads through `listTenderMethods`. What is asserted is state,
// accessible names and codes, and changes rather than absolute counts. Nothing is deleted
// (there is no DELETE): names are made unique per run.

const rootState = (page: Page) => page.locator('#root');
const path = (suffix: string) => `/api/back-office/config/catalog/${suffix}`;

const unique = (stem: string) => `${stem}-${randomBytes(4).toString('hex')}`;

const menuLink = (page: Page) => page.getByRole('link', { name: 'Menu', exact: true });
const newCategory = (page: Page) => page.getByRole('button', { name: 'New category', exact: true });
const nameField = (page: Page) => page.getByRole('textbox', { name: 'Category name', exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page) => page.locator('#page-status');
const headings = (page: Page) => page.locator('#menu-rows h2');

/** Signs the manager in and opens Menu from the rail, with the list drawn. */
async function openMenu(page: Page, manager: Person): Promise<void> {
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
  await menuLink(page).click();
  await expect(page).toHaveURL(/\/back-office\/menu$/);
  await expect(page.getByRole('heading', { name: 'Menu', exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('#read-state')).toHaveCount(0);
}

/** The count line, as numbers: what a case asserts is the change, not an absolute. */
async function counts(page: Page): Promise<{ categories: number; items: number }> {
  const line = await page.locator('#menu-count').innerText();
  const found = /^(\d+) categories · (\d+) items$/.exec(line);
  expect(found, line).not.toBeNull();
  return { categories: Number(found![1]), items: Number(found![2]) };
}

/** Every request this profile's pages sent to one catalog route. */
const sent = (profile: Profile, suffix: string) =>
  profile.requests.filter((r) => r.method === 'POST' && new URL(r.url).pathname === path(suffix)).length;

/** A category made through the domain, as another tab or the owner's own tool would. */
async function made(name: string): Promise<CatalogCategory> {
  const outcome = await createCategory(name);
  if (outcome.kind !== 'OK') throw new Error(`could not make category ${name}`);
  return outcome.record;
}

const active = async (): Promise<string[]> =>
  (await readCatalog()).categories
    .filter((c) => c.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((c) => c.name);

test('M1. a manager creates a category, renames one, archives it after the active ones, restores it, and the database agrees', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const first = await made(unique('Mains'));
  const second = await made(unique('Sides'));
  const created = unique('Drinks');
  const renamed = unique('Starters');
  await openMenu(office, manager);
  await expect(headings(office)).toHaveText([first.name, second.name]);
  const before = await counts(office);

  // Create: listed after the others, announced, focus on the new category's Rename.
  await newCategory(office).click();
  await expect(office.getByRole('dialog', { name: 'New category', exact: true })).toBeVisible();
  await expect(nameField(office)).toBeFocused();
  await nameField(office).fill(created);
  await button(office, 'Create').click();
  await expect(status(office)).toHaveText(`${created} saved.`);
  await expect(button(office, `Rename category ${created}`)).toBeFocused();
  await expect(headings(office)).toHaveText([first.name, second.name, created]);
  expect(await counts(office)).toEqual({ categories: before.categories + 1, items: before.items });
  expect(sent(oneProfile, 'categories/create')).toBe(1);
  expect(await active()).toEqual([first.name, second.name, created]);

  // Rename the first category.
  await button(office, `Rename category ${first.name}`).click();
  await expect(office.getByRole('dialog', { name: `Rename ${first.name}`, exact: true })).toBeVisible();
  await nameField(office).fill(renamed);
  await button(office, 'Save').click();
  await expect(status(office)).toHaveText(`${renamed} saved.`);
  await expect(button(office, `Rename category ${renamed}`)).toBeFocused();
  expect(sent(oneProfile, 'categories/update')).toBe(1);
  expect(await active()).toEqual([renamed, second.name, created]);

  // Archive it: it moves after the active categories, with no confirmation and one request.
  await button(office, `Archive category ${renamed}`).click();
  await expect(status(office)).toHaveText(
    `${renamed} archived. Its items are hidden from the POS; their status and availability are unchanged.`
  );
  await expect(headings(office)).toHaveText([second.name, created, `${renamed} · Archived category`]);
  expect(sent(oneProfile, 'categories/archive')).toBe(1);
  expect((await readCatalog()).categories.find((c) => c.name === renamed)?.isActive).toBe(false);

  // Restore it: it keeps its stored position and rejoins the active group.
  await button(office, `Restore category ${renamed}`).click();
  await expect(status(office)).toHaveText(`${renamed} restored. Its active, available items are shown at the POS again.`);
  await expect(headings(office)).toHaveText([renamed, second.name, created]);
  expect(sent(oneProfile, 'categories/restore')).toBe(1);
  expect((await readCatalog()).categories.find((c) => c.name === renamed)?.isActive).toBe(true);
  expect(await active()).toEqual([renamed, second.name, created]);
});

test('M2. a reorder made stale by another write is refused, nothing is saved, and Keep my changes then Save order saves it', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const a = await made(unique('Alpha'));
  const b = await made(unique('Bravo'));
  await openMenu(office, manager);

  await button(office, 'Reorder categories').click();
  await expect(office.getByRole('dialog', { name: 'Reorder categories', exact: true })).toBeVisible();

  // Another tab writes: a category is made and archived, so the version advances and the
  // active scope is the one the panel opened with.
  const extra = await made(unique('Extra'));
  expect((await archiveCategory(extra.categoryId)).kind).toBe('OK');
  const version = (await readCatalog()).version;

  await button(office, `Move down ${a.name}`).click();
  await button(office, 'Save order').click();
  await expect(office.locator('#form-notice')).toHaveText(
    `The menu changed while you were editing. Nothing was saved. The menu has been read again at version ${version}. Your draft is kept. Choose which to keep.`
  );
  expect(sent(oneProfile, 'categories/reorder')).toBe(1);
  expect(await active()).toEqual([a.name, b.name]);
  await expect(button(office, 'Save order')).toHaveAttribute('aria-disabled', 'true');
  await expect(office.locator('#current-values')).toHaveText(`Current order: ${a.name} → ${b.name}`);

  await button(office, 'Keep my changes').click();
  await expect(button(office, 'Save order')).toBeFocused();
  expect(sent(oneProfile, 'categories/reorder')).toBe(1);
  await button(office, 'Save order').click();
  await expect(status(office)).toHaveText('Category order saved.');
  expect(sent(oneProfile, 'categories/reorder')).toBe(2);
  expect(await active()).toEqual([b.name, a.name]);
  await expect(headings(office)).toHaveText([b.name, a.name, `${extra.name} · Archived category`]);
});

test('M3. when the other write added a category to the scope, Keep my changes rebuilds the order with it last and Save order saves it', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const a = await made(unique('Alpha'));
  const b = await made(unique('Bravo'));
  await openMenu(office, manager);

  await button(office, 'Reorder categories').click();
  // A third active category joins the scope while the panel is open.
  const joined = await made(unique('Joined'));
  await button(office, `Move down ${a.name}`).click();
  await button(office, 'Save order').click();
  await expect(office.locator('#current-values')).toHaveText(`Current order: ${a.name} → ${b.name} → ${joined.name}`);
  expect(sent(oneProfile, 'categories/reorder')).toBe(1);

  expect(await active()).toEqual([a.name, b.name, joined.name]);

  // Keep my changes rebuilds the draft against the reread scope: the new category goes last, and
  // the merge is visible before Save order. Nothing is sent by Keep.
  await button(office, 'Keep my changes').click();
  await expect(office.locator('#draft-order .menu-order-name')).toHaveText([`1. ${b.name}`, `2. ${a.name}`, `3. ${joined.name}`]);
  expect(sent(oneProfile, 'categories/reorder')).toBe(1);
  await button(office, 'Save order').click();
  await expect(status(office)).toHaveText('Category order saved.');
  expect(sent(oneProfile, 'categories/reorder')).toBe(2);
  expect(await active()).toEqual([b.name, a.name, joined.name]);
  await expect(headings(office)).toHaveText([b.name, a.name, joined.name]);
});

test('M4. an item made through the domain shows its base price with dot grouping and no currency symbol', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const owner = await made(unique('Mains'));
  const name = unique('Steak');
  const outcome = await createItem({ categoryId: owner.categoryId, name, basePrice: 1234567n, variants: [], modifiers: [] });
  expect(outcome.kind).toBe('OK');
  await openMenu(office, manager);

  const row = office.locator('tr[data-item]', { hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row.locator('td.num')).toHaveText('1.234.567');
  await expect(row).toContainText('Available');
  await expect(row).toContainText('0 variants · 0 modifiers');
  expect((await counts(office)).items).toBeGreaterThanOrEqual(1);
});
