import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { createTenderMethod, listTenderMethods } from '../../apps/server/src/domain/tender-method.js';
import { expect, signInAtBackOffice, test, type Person, type Profile } from '../support/fixtures.js';

// BO-08, the payment-methods part, in a real browser (PHASE1-S3b, consult C2 section 8, ADR-011
// rules 27 and 28). People come from the harness's domain functions with random credentials. The
// requests are the page's own; the database is read through the server's own domain function,
// as settings.spec.ts reads through `readCurrentSettings`. What is asserted is state, accessible
// names and codes. Nothing is deleted (there is no DELETE): names are made unique per run.

const rootState = (page: Page) => page.locator('#root');
const CREATE_PATH = '/api/back-office/config/tender-methods/create';

const unique = (stem: string) => `${stem}-${randomBytes(4).toString('hex')}`;

const settingsLink = (page: Page) => page.getByRole('link', { name: 'Settings', exact: true });
const newMethod = (page: Page) => page.getByRole('button', { name: 'New payment method', exact: true });
const nameField = (page: Page) => page.getByRole('textbox', { name: 'Method name', exact: true });
const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });
const nameCells = (page: Page) => page.locator('#methods-list tbody tr td:first-child');

/** Signs the manager in and opens Settings from the rail, with the methods list drawn. */
async function openSettings(page: Page, manager: Person): Promise<void> {
  await page.goto('/back-office/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(page, manager);
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-in');
  await settingsLink(page).click();
  await expect(page).toHaveURL(/\/back-office\/settings$/);
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment methods', exact: true })).toBeVisible();
  await expect(page.locator('#methods-list')).toBeVisible();
}

/** The count line, as numbers: what a case asserts is the change, not an absolute. */
async function counts(page: Page): Promise<{ active: number; inactive: number }> {
  const line = await page.locator('#method-count').innerText();
  const found = /^(\d+) active · (\d+) inactive custom methods$/.exec(line);
  expect(found, line).not.toBeNull();
  return { active: Number(found![1]), inactive: Number(found![2]) };
}

const createsSent = (profile: Profile) =>
  profile.requests.filter((r) => r.method === 'POST' && new URL(r.url).pathname === CREATE_PATH).length;

test('M1. a manager creates a method, sees it under Card, deactivates it, and the database agrees', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const name = unique('QRIS');
  await openSettings(office, manager);

  // Cash and card are always the first two rows, and hold no control.
  const first = await nameCells(office).allTextContents();
  expect(first.slice(0, 2)).toEqual(['Cash', 'Card']);
  await expect(office.locator('#methods-list tbody tr').nth(0).locator('button, a, input')).toHaveCount(0);
  await expect(office.locator('#methods-list tbody tr').nth(1).locator('button, a, input')).toHaveCount(0);
  const before = await counts(office);

  await newMethod(office).click();
  await expect(office.getByRole('dialog', { name: 'New payment method', exact: true })).toBeVisible();
  await expect(nameField(office)).toBeFocused();
  await nameField(office).fill(name);
  await save(office).click();

  await expect(office.getByText(`${name} saved.`, { exact: true })).toBeVisible();
  await expect(office.getByRole('button', { name: `Edit ${name} — active`, exact: true })).toBeFocused();
  const listed = await nameCells(office).allTextContents();
  expect(listed.slice(0, 2)).toEqual(['Cash', 'Card']);
  expect(listed).toContain(name);
  expect(createsSent(oneProfile)).toBe(1);
  expect(await counts(office)).toEqual({ active: before.active + 1, inactive: before.inactive });

  await office.getByRole('button', { name: `Deactivate ${name}`, exact: true }).click();
  await expect(office.getByText(`${name} deactivated. It is kept for history.`, { exact: true })).toBeVisible();
  const row = office.locator('#methods-list tbody tr', { has: office.getByRole('button', { name: `Edit ${name} — inactive`, exact: true }) });
  await expect(row.locator('td').nth(1)).toHaveText('Inactive');
  expect(await counts(office)).toEqual({ active: before.active, inactive: before.inactive + 1 });

  const stored = (await listTenderMethods()).find((method) => method.name === name);
  expect(stored?.isActive).toBe(false);
});

test('M2. a name an active method already holds is refused on the name, with one create sent and the holder marked', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { office } = oneProfile;
  const holder = unique('GoPay');
  const made = await createTenderMethod(holder);
  expect(made.kind).toBe('OK');
  await openSettings(office, manager);
  await expect(nameCells(office).filter({ hasText: holder })).toHaveCount(1);
  const methodsBefore = (await listTenderMethods()).length;

  await newMethod(office).click();
  await nameField(office).fill(holder.toLowerCase());
  await save(office).click();

  await expect(office.getByText('An active payment method already uses this name. Choose another name.', { exact: true })).toBeVisible();
  await expect(nameField(office)).toBeFocused();
  await expect(nameField(office)).toHaveValue(holder.toLowerCase());
  await expect(nameField(office)).toHaveAttribute('aria-invalid', 'true');
  expect(createsSent(oneProfile)).toBe(1);
  // The holder's row says so, as text and not as a link.
  const marked = nameCells(office).filter({ hasText: holder });
  await expect(marked).toContainText('Name in use');
  await expect(marked.locator('a, button')).toHaveCount(0);
  expect((await listTenderMethods()).length).toBe(methodsBefore);
});
