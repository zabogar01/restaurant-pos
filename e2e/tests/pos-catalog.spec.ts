import { randomBytes } from 'node:crypto';
import { readCatalog } from '../../apps/server/src/domain/catalog.js';
import {
  CATALOG_REVISION,
  archiveAtOffice,
  catalogReadsOf,
  createCategoryAtOffice,
  createItemAtOffice,
  makeAvailable,
  mark86,
  openOfficeMenu,
  openPosOrder,
  outstandingCatalogReads,
  pausePoll,
  tileNamed,
} from '../support/catalog.js';
import { expect, test } from '../support/fixtures.js';

// PHASE1-S7b1, consult C4 item 4 (AC-12's grid half, in two browsers). The back office is in one
// profile and the POS in the other, so each has a cookie jar of its own, and the menu is built through
// the back office's own screens. The POS's clock is installed before its first `goto` and then
// paused: a change can reach the POS only by its poll, and the time the poll is given is stated and
// spent exactly, by `runFor`, never by waiting on a real clock (ADR-011 rule 27). What is asserted
// is state, accessible names and `data-item`, never copy.

const unique = (stem: string) => `${stem}-${randomBytes(4).toString('hex')}`;

/** The budget (AC-12): an 86 reaches a POS tile within three seconds. The poll is every two. */
const BUDGET_MS = 3_000;
const PAGE_MS = 2_000;

const dataItems = (page: import('@playwright/test').Page) =>
  page.locator('.menu-grid > .menu-tile').evaluateAll((tiles) => tiles.map((t) => (t as HTMLElement).dataset.item));

test('P1. an 86 made in the back office reaches the POS tile in two seconds of page time, in place, and its reversal does too', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const cashier = await world.people.cashier();
  const { a: office, b: till } = twoProfiles;
  const category = unique('Mains');
  const names = [unique('Soup'), unique('Satay'), unique('Rice')];

  // 1. The menu, through the screens, and both people signed in.
  await openOfficeMenu(office.page, manager);
  await createCategoryAtOffice(office.page, category);
  for (const [i, name] of names.entries()) await createItemAtOffice(office.page, category, name, String(25_000 + i * 5_000));
  await openPosOrder(till.page, cashier);
  const pos = till.page;
  const soup = tileNamed(pos, names[0]!);
  const satay = tileNamed(pos, names[1]!);
  const rice = tileNamed(pos, names[2]!);
  await expect(soup).toBeVisible();
  await expect(satay).toBeVisible();
  await expect(rice).toBeVisible();
  // The grid of the served menu holds exactly the three, in the order the back office gave them.
  await expect(pos.locator('.menu-grid > .menu-tile')).toHaveCount(3);

  // 2. Pause the POS's clock and wait for it to have no catalog request outstanding.
  await pausePoll(till, pos);
  const order = await dataItems(pos);
  const slot = (await satay.boundingBox())!;
  const grid = (await pos.locator('.menu-grid').boundingBox())!;
  const band = pos.locator('.menu-status');
  const bandBox = (await band.boundingBox())!;
  expect(bandBox.height).toBe(72);
  const reads = catalogReadsOf(till, pos, CATALOG_REVISION);

  // 3. Mark one item 86 from its BO-03 row. The tile is still enabled: only the poll can bring it.
  await mark86(office.page, names[1]!);
  await expect(satay).not.toHaveAttribute('aria-disabled', 'true');
  expect(catalogReadsOf(till, pos, CATALOG_REVISION)).toBe(reads);

  // 4. Two seconds of page time, against a budget of three.
  expect(PAGE_MS).toBeLessThanOrEqual(BUDGET_MS);
  await pos.clock.runFor(PAGE_MS);
  await expect(satay).toHaveAttribute('aria-disabled', 'true');

  // 5. In place: no reflow, the tag the tile names, the grid and the reserved band where they were,
  //    and a press opens nothing.
  expect(await dataItems(pos)).toEqual(order);
  expect(await satay.boundingBox()).toEqual(slot);
  expect(await pos.locator('.menu-grid').boundingBox()).toEqual(grid);
  expect(await band.boundingBox()).toEqual(bandBox);
  const tagId = await satay.getAttribute('aria-describedby');
  expect(tagId).not.toBeNull();
  await expect(pos.locator(`[id="${tagId}"]`)).toHaveText('86');
  await expect(satay).toHaveAttribute('aria-label', /unavailable, 86$/);
  await expect(soup).not.toHaveAttribute('aria-disabled', 'true');
  const url = pos.url();
  // Forced: Playwright's own stability check waits on animation frames, which a paused clock does not deliver.
  await satay.click({ force: true });
  await expect(pos.getByRole('dialog')).toHaveCount(0);
  expect(pos.url()).toBe(url);

  // The reversal, the same way: still disabled until the poll, then enabled in the same slot.
  await expect.poll(() => outstandingCatalogReads(till, pos)).toBe(0);
  await makeAvailable(office.page, names[1]!);
  await expect(satay).toHaveAttribute('aria-disabled', 'true');
  await pos.clock.runFor(PAGE_MS);
  await expect(satay).not.toHaveAttribute('aria-disabled', 'true');
  expect(await dataItems(pos)).toEqual(order);
  expect(await satay.boundingBox()).toEqual(slot);
  expect(await pos.locator('.menu-grid').boundingBox()).toEqual(grid);
  await expect(pos.locator(`[id="${tagId}"]`)).toHaveCount(0);
});

test('P2. a focus on the window refreshes the menu with no page time spent', async ({ world, twoProfiles }) => {
  const manager = await world.people.manager();
  const cashier = await world.people.cashier();
  const { a: office, b: till } = twoProfiles;
  const category = unique('Mains');
  const names = [unique('Soup'), unique('Rice')];

  await openOfficeMenu(office.page, manager);
  await createCategoryAtOffice(office.page, category);
  for (const name of names) await createItemAtOffice(office.page, category, name, '25000');
  await openPosOrder(till.page, cashier);
  const pos = till.page;
  const rice = tileNamed(pos, names[1]!);
  await expect(rice).toBeVisible();
  await pausePoll(till, pos);

  // With the clock still paused, make a change and bring the window to the front.
  await mark86(office.page, names[1]!);
  await expect(rice).not.toHaveAttribute('aria-disabled', 'true');
  await pos.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(rice).toHaveAttribute('aria-disabled', 'true');
});

test('P3. the first 2xx body read in the page: the menu names its own version, and an archived item is absent', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const cashier = await world.people.cashier();
  const { a: office, b: till } = twoProfiles;
  const category = unique('Mains');
  const kept = unique('Soup');
  const archived = unique('Satay');

  await openOfficeMenu(office.page, manager);
  await createCategoryAtOffice(office.page, category);
  await createItemAtOffice(office.page, category, kept, '25000');
  await createItemAtOffice(office.page, category, archived, '30000');
  await archiveAtOffice(office.page, archived);
  await openPosOrder(till.page, cashier);
  const pos = till.page;

  // A request by the page itself; the harness reads error bodies only, so the body is read here.
  const served = await pos.evaluate(() => fetch('/api/pos/catalog/menu').then((r) => r.json()));
  const stored = await readCatalog();
  expect(served.version).toBe(stored.version);
  const names: string[] = served.items.map((i: { name: string }) => i.name);
  expect(names).toContain(kept);
  expect(names).not.toContain(archived);
  await expect(tileNamed(pos, kept)).toBeVisible();
  await expect(tileNamed(pos, archived)).toHaveCount(0);
});

test('P4. R1: the longest name and the largest price together keep the price line inside the tile, and the accessible name is whole', async ({
  world,
  twoProfiles,
}) => {
  const manager = await world.people.manager();
  const cashier = await world.people.cashier();
  const { a: office, b: till } = twoProfiles;
  const category = unique('Mains');
  const long = `${'W'.repeat(56)}${randomBytes(4).toString('hex')}`;

  await openOfficeMenu(office.page, manager);
  await createCategoryAtOffice(office.page, category);
  await createItemAtOffice(office.page, category, long, '99999999');
  await openPosOrder(till.page, cashier);
  const pos = till.page;
  const tile = tileNamed(pos, long);
  await expect(tile).toBeVisible();
  await expect(tile).toHaveAttribute('aria-label', `${long}, 99.999.999`);

  const box = (await tile.boundingBox())!;
  expect(box.width).toBe(150);
  expect(box.height).toBe(96);
  const price = (await tile.locator('.menu-tile__price').boundingBox())!;
  expect(price.x).toBeGreaterThanOrEqual(box.x);
  expect(price.y).toBeGreaterThanOrEqual(box.y);
  expect(price.x + price.width).toBeLessThanOrEqual(box.x + box.width);
  expect(price.y + price.height).toBeLessThanOrEqual(box.y + box.height);
  // Its price is whole: the text is not clipped within its own box.
  const clipped = await tile.locator('.menu-tile__price').evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(clipped).toBe(false);
  // The name is clamped by lines, not characters: two lines at most, whole lines, and never under the price.
  const nameBox = tile.locator('.menu-tile__name');
  const name = (await nameBox.boundingBox())!;
  expect(name.y + name.height).toBeLessThanOrEqual(price.y + 1);
  const lines = await nameBox.evaluate((el) => {
    const style = getComputedStyle(el);
    return { clamp: style.getPropertyValue('-webkit-line-clamp'), lineHeight: parseFloat(style.lineHeight), height: el.getBoundingClientRect().height };
  });
  expect(lines.clamp).toBe('2');
  expect(lines.height).toBeLessThanOrEqual(2 * lines.lineHeight + 1);
});
