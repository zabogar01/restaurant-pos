import type { Page } from '@playwright/test';
import { expect, signInAtBackOffice, signInAtPos, type Person, type Profile } from './fixtures.js';

// What the served POS menu's browser cases share (PHASE1-S7b1, consult C4 item 4). Requests are only
// the page's own, and nothing here waits on a real clock: the poll is moved by the page's clock, which
// a case pauses and then advances by an exact number of milliseconds.

export const CATALOG_REVISION = '/api/pos/catalog/revision';
export const CATALOG_MENU = '/api/pos/catalog/menu';
const CATALOG = '/api/pos/catalog/';

const pathOf = (url: string) => new URL(url).pathname;

/** The catalog requests a page has sent and not yet had an answer to, from the profile's own two lists. */
export function outstandingCatalogReads(profile: Profile, page: Page): number {
  const sent = profile.requests.filter((r) => r.page === page && pathOf(r.url).startsWith(CATALOG)).length;
  const answered = profile.replies.filter((r) => r.page === page && r.path.startsWith(CATALOG)).length;
  return sent - answered;
}

/** How many times a page has asked a catalog route. */
export const catalogReadsOf = (profile: Profile, page: Page, path: string): number =>
  profile.requests.filter((r) => r.page === page && r.method === 'GET' && pathOf(r.url) === path).length;

/**
 * Pauses the page's clock and waits until the page has no catalog request outstanding, so that the
 * next thing that happens to it is what the case does. The clock must have been installed before
 * the page's first `goto`. Whether it flows by itself after `install()` is a matter on which the
 * documentation and the source of the installed version differ, so nothing here depends on it: the
 * pause is explicit, and the case advances time only with `runFor` or `fastForward`.
 */
export async function pausePoll(profile: Profile, page: Page): Promise<void> {
  // The page's own time, not the runner's: a case that has already moved the page's clock is ahead of it.
  const pageNow = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(pageNow + 500));
  await expect.poll(() => outstandingCatalogReads(profile, page)).toBe(0);
  // Lets the answer that settled the last cycle reach the client, so its next timer exists.
  await page.evaluate(() => 0);
}

/** Every code the server answered the POS tab's session-bearing reads with: `me` and the two catalog reads. */
export async function sessionVerdicts(profile: Profile, mePath: string): Promise<string[]> {
  await profile.settled();
  return profile.replies
    .filter((r) => r.method === 'GET' && (r.path === mePath || r.path === CATALOG_REVISION || r.path === CATALOG_MENU))
    .flatMap((r) => (r.code === null ? [] : [r.code]));
}

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
export const officeStatus = (page: Page) => page.locator('#page-status');

/** Signs the manager in at the back office and opens Menu, with the list drawn. */
export async function openOfficeMenu(office: Page, manager: Person): Promise<void> {
  await office.goto('/back-office/');
  await expect(office.locator('#root')).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(office, manager);
  await expect(office.locator('#root')).toHaveAttribute('data-session', 'signed-in');
  await office.getByRole('link', { name: 'Menu', exact: true }).click();
  await expect(office).toHaveURL(/\/back-office\/menu$/);
  await expect(office.getByRole('heading', { name: 'Menu', exact: true, level: 1 })).toBeVisible();
  await expect(office.locator('#read-state')).toHaveCount(0);
}

/** BO-03's New category, through the screen. */
export async function createCategoryAtOffice(office: Page, name: string): Promise<void> {
  await button(office, 'New category').click();
  await office.getByRole('textbox', { name: 'Category name', exact: true }).fill(name);
  await button(office, 'Create').click();
  await expect(officeStatus(office)).toContainText(name);
}

/** BO-03's New item in a category, through the screen: a name and a price as the manager types it. */
export async function createItemAtOffice(office: Page, category: string, name: string, price: string): Promise<void> {
  await button(office, `New item in ${category}`).click();
  await expect(office).toHaveURL(/\/back-office\/menu\/item$/);
  await office.getByRole('textbox', { name: 'Item name', exact: true }).fill(name);
  await office.getByRole('textbox', { name: 'Base price', exact: true }).fill(price);
  await button(office, 'Save').click();
  await expect(office).toHaveURL(/\/back-office\/menu$/);
  await expect(officeStatus(office)).toContainText(name);
}

/** Presses a control and waits for the server's answer to the one request it sends: a page status can still hold the last action's words. */
async function pressAndAwait(office: Page, name: string, route: string): Promise<void> {
  const answered = office.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/back-office/config/catalog/${route}`
  );
  await button(office, name).click();
  expect((await answered).status()).toBe(200);
}

/** A row's own 86 and restore controls: the answer is awaited, then the row says so. */
export async function mark86(office: Page, name: string): Promise<void> {
  await pressAndAwait(office, `Mark ${name} 86`, 'items/mark-unavailable');
  await expect(office.locator('tr[data-item]', { hasText: name })).toContainText('Unavailable');
}

export async function makeAvailable(office: Page, name: string): Promise<void> {
  await pressAndAwait(office, `Make available ${name}`, 'items/mark-available');
  await expect(office.locator('tr[data-item]', { hasText: name })).not.toContainText('Unavailable');
}

export async function archiveAtOffice(office: Page, name: string): Promise<void> {
  await pressAndAwait(office, `Archive item ${name}`, 'items/archive');
}

// BO-07, Discount presets, through its own controls (the ones e2e/tests/presets.spec.ts drives): the S7b3
// case makes and retires a preset at the back office and watches the POS picker follow.

const officePresetsLink = (office: Page) => office.getByRole('link', { name: 'Discount presets', exact: true });

/** Signs the manager in and opens Discount presets from the rail, with the list read. */
export async function openOfficePresets(office: Page, manager: Person): Promise<void> {
  await office.goto('/back-office/');
  await expect(office.locator('#root')).toHaveAttribute('data-session', 'signed-out');
  await signInAtBackOffice(office, manager);
  await expect(office.locator('#root')).toHaveAttribute('data-session', 'signed-in');
  await officePresetsLink(office).click();
  await expect(office).toHaveURL(/\/back-office\/presets$/);
  await expect(office.getByRole('heading', { name: 'Discount presets', exact: true, level: 1 })).toBeVisible();
  await expect(office.locator('#read-state')).toHaveCount(0);
  await expect(office.locator('#list-facts')).toBeVisible();
}

/** BO-07's New preset, a percentage typed as the manager types it, through the screen. */
export async function createPresetAtOffice(office: Page, name: string, percent: string): Promise<void> {
  await button(office, 'New preset').click();
  await office.getByRole('textbox', { name: 'Preset name', exact: true }).fill(name);
  await office.getByRole('textbox', { name: 'Percentage', exact: true }).fill(percent);
  await button(office, 'Save').click();
  await expect(officeStatus(office)).toHaveText(`${name} saved.`);
}

/** BO-07's Deactivate, through its confirmation. */
export async function deactivatePresetAtOffice(office: Page, name: string): Promise<void> {
  await button(office, `Deactivate ${name}`).click();
  const dialog = office.getByRole('dialog', { name: `Deactivate “${name}”?`, exact: true });
  await dialog.getByRole('button', { name: `Deactivate ${name}`, exact: true }).click();
  await expect(officeStatus(office)).toContainText(`${name} deactivated.`);
}

/**
 * Installs the page's clock before its first `goto`, opens POS-03 and signs the cashier in. The URL
 * is kept through POS-01, so signing in draws the order screen.
 */
export async function openPosOrder(pos: Page, cashier: Person): Promise<void> {
  await pos.clock.install();
  await pos.goto('/pos/order');
  await expect(pos.locator('#root')).toHaveAttribute('data-session', 'signed-out');
  await signInAtPos(pos, cashier);
  await expect(pos.locator('#root')).toHaveAttribute('data-session', 'signed-in');
}

/** A served tile, by the name the back office gave the item. */
export const tileNamed = (page: Page, name: string) =>
  page.locator('button.menu-tile', { has: page.locator('.menu-tile__name', { hasText: name }) });

/**
 * One turn of the page's event loop, for a page whose clock is paused: a `setTimeout` never fires there,
 * so the usual short wait would never end. A message turn lets a just-delivered answer reach the client.
 */
export const turn = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(0);
      })
  );
