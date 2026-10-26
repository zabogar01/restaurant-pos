import { Screens } from '../src/Screens.js';
import { HEALTH, ME, VIEW, makeHarness, mount, ok } from './session-harness.js';
import { named, tap } from './tables-support.js';

// Shared by the BO-03 client tests: the eleven catalog routes, a menu of three categories and
// seven items, and the few ways a test reaches a row, a panel and a request body.

export const READ = 'GET /api/back-office/config/catalog';
export const CATEGORY_CREATE = 'POST /api/back-office/config/catalog/categories/create';
export const CATEGORY_UPDATE = 'POST /api/back-office/config/catalog/categories/update';
export const CATEGORY_REORDER = 'POST /api/back-office/config/catalog/categories/reorder';
export const CATEGORY_ARCHIVE = 'POST /api/back-office/config/catalog/categories/archive';
export const CATEGORY_RESTORE = 'POST /api/back-office/config/catalog/categories/restore';
export const ITEM_REORDER = 'POST /api/back-office/config/catalog/items/reorder';
export const ITEM_ARCHIVE = 'POST /api/back-office/config/catalog/items/archive';
export const ITEM_RESTORE = 'POST /api/back-office/config/catalog/items/restore';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export interface Cat {
  categoryId: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}
export interface Opt {
  variantId?: string;
  modifierId?: string;
  name: string;
  priceDelta: string;
  displayOrder: number;
  isActive: boolean;
}
export interface Item {
  itemId: string;
  categoryId: string;
  name: string;
  basePrice: string;
  displayOrder: number;
  isAvailable: boolean;
  isActive: boolean;
  variants: Opt[];
  modifiers: Opt[];
}

export const cat = (n: number, name: string, displayOrder: number, isActive = true): Cat => ({
  categoryId: id(n),
  name,
  displayOrder,
  isActive,
});

export const item = (
  n: number,
  categoryId: string,
  name: string,
  displayOrder: number,
  more: Partial<Item> = {}
): Item => ({
  itemId: id(100 + n),
  categoryId,
  name,
  basePrice: '40000',
  displayOrder,
  isAvailable: true,
  isActive: true,
  variants: [],
  modifiers: [],
  ...more,
});

const option = (n: number, name: string, isActive: boolean, kind: 'variant' | 'modifier'): Opt => ({
  [kind === 'variant' ? 'variantId' : 'modifierId']: id(900 + n),
  name,
  priceDelta: '0',
  displayOrder: n,
  isActive,
});

// An archived category sits between two active ones; Mains holds `Item 10` and `Item 2` tied on
// their display order, an archived `Apple`, and a Burger with two variants (one removed) and one
// modifier. Seasonal is archived and holds an offered item and an archived one.
export const MAINS = cat(1, 'Mains', 0);
export const SEASONAL = cat(2, 'Seasonal', 1, false);
export const DRINKS = cat(3, 'Drinks', 2);

export const BURGER = item(1, MAINS.categoryId, 'Burger', 0, {
  basePrice: '99999999',
  variants: [option(1, 'Large', true, 'variant'), option(2, 'Small', false, 'variant')],
  modifiers: [option(3, 'Cheese', true, 'modifier')],
});
export const ITEM_10 = item(2, MAINS.categoryId, 'Item 10', 1);
export const ITEM_2 = item(3, MAINS.categoryId, 'Item 2', 1, { basePrice: '0' });
export const APPLE = item(4, MAINS.categoryId, 'Apple', 0, { isActive: false });
export const PIE = item(5, SEASONAL.categoryId, 'Pie', 0, { basePrice: '65000' });
export const STEW = item(6, SEASONAL.categoryId, 'Stew', 1, { isActive: false });
export const SODA = item(7, DRINKS.categoryId, 'Soda', 0, { isAvailable: false, basePrice: '30000' });

export const MENU_ITEMS = [BURGER, ITEM_10, ITEM_2, APPLE, PIE, STEW, SODA];

export const catalog = (version: number, categories: Cat[] = [MAINS, SEASONAL, DRINKS], items: Item[] = MENU_ITEMS) =>
  ok({ version, categories, items });
export const category = (version: number, record: Cat) => ok({ version, category: record });
export const categories = (version: number, rows: Cat[]) => ok({ version, categories: rows });
export const itemAnswer = (version: number, record: Item) => ok({ version, item: record });
export const itemsAnswer = (version: number, rows: Item[]) => ok({ version, items: rows });

/** A harness whose health read answers, at the address BO-03 lives at. */
export function harness(path = '/back-office/menu') {
  const h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
  window.history.pushState(null, '', path);
  return h;
}

/** Mounts the real screens for a signed-in manager; `first` is the answer to the first catalog read. */
export async function openMenu(h: ReturnType<typeof harness>, first = catalog(5)) {
  h.reply(ME, ok(VIEW));
  h.reply(READ, first);
  const view = mount(h.store, <Screens />);
  await h.settle();
  return view;
}

/** Like `openMenu`, with the first catalog read held until the test delivers it. */
export async function openMenuHeld(h: ReturnType<typeof harness>) {
  h.reply(ME, ok(VIEW));
  h.reply(READ, catalog(5));
  const held = h.hold(READ);
  const view = mount(h.store, <Screens />);
  await h.settle();
  return { view, held };
}

export { named, tap };

/** The body of the first request sent to `key`, parsed. */
export const bodyOf = (h: ReturnType<typeof harness>, key: string, n = 0): Record<string, unknown> =>
  JSON.parse(h.keyed(key)[n]!.body!) as Record<string, unknown>;

export const nameField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#menu-name');
export const panel = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="dialog"][aria-modal="false"]');
export const panelName = (host: HTMLElement) => host.querySelector('#editor-title')?.textContent ?? null;
export const pageStatus = (host: HTMLElement) => host.querySelector('#page-status');
export const formNotice = (host: HTMLElement) => host.querySelector('#form-notice');
export const nameError = (host: HTMLElement) => host.querySelector('#name-error');
export const comparison = (host: HTMLElement) => host.querySelector('#comparison');
export const count = (host: HTMLElement) => host.querySelector('#menu-count');
export const rail = (host: HTMLElement) => host.querySelector<HTMLElement>('.bonav')!;
export const aria = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';

/** The category headings in the order drawn. */
export const headings = (host: HTMLElement) => [...host.querySelectorAll('#menu-rows h2')].map((h2) => h2.textContent);

/** The item names of one category, in the order drawn (the name only, without its notes). */
export function itemNames(host: HTMLElement, categoryId: string): string[] {
  const rows = [...host.querySelectorAll<HTMLElement>('#menu-rows tr')];
  const start = rows.findIndex((tr) => tr.getAttribute('data-category') === categoryId);
  const names: string[] = [];
  for (const tr of rows.slice(start + 1)) {
    if (tr.classList.contains('category-row')) break;
    if (tr.hasAttribute('data-item')) names.push(tr.querySelector('td')!.firstChild!.textContent!);
  }
  return names;
}

export const itemRow = (host: HTMLElement, itemId: string) => host.querySelector<HTMLElement>(`tr[data-item="${itemId}"]`)!;
export const categoryRow = (host: HTMLElement, categoryId: string) =>
  host.querySelector<HTMLElement>(`tr[data-category="${categoryId}"]`)!;
export const rowText = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The order drawn in the reorder panel, as names without their position. */
export const draftNames = (host: HTMLElement) =>
  [...host.querySelectorAll('#draft-order .menu-order-name')].map((s) => s.textContent!.replace(/^\d+\. /, ''));
