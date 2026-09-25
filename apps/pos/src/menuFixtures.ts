import type { Money } from '@pos/money';
import { ORDER_FIXTURES, type OrderState, type OrderView, type SettlementLock } from './orderFixtures.js';

// POS-03's menu region as fixtures (F2b), selected by the same ?state= as the
// panel. Categories, items, prices and every notice's copy are the reviewed
// artifact's (docs/design/visual-directions/frost/pos/order.html, on
// agent/design-direction). Nothing is fetched: the catalog is the server's and
// this slice has none.


export const MENU_CATEGORIES = [
  { id: 'mains', name: 'Mains' },
  { id: 'sides', name: 'Sides' },
  { id: 'drinks', name: 'Drinks' },
  { id: 'desserts', name: 'Desserts' },
] as const;

export type CategoryId = (typeof MENU_CATEGORIES)[number]['id'];

/** `category` is the single source of which grid an item is on: every item belongs to exactly one (FE-023). */
export type MenuItem = { id: string; name: string; price: Money; category: CategoryId };

/** The category a fresh load starts on. The selection itself lives beside the order store (`useOrderStore`), outside the URL. */
export const DEFAULT_CATEGORY: CategoryId = 'mains';

// The owner's ruling of 2026-09-24 (POS-03 question 8): a category press shows
// that category's items. The categorisation is the lead's (FE-023): beers and
// water are drinks, steak is a main. Order within a category is the grid's
// order. Prices are illustrative fixture data, like every price here; Mineral
// Water's 20.000 is invented (the owner named water, not a price), and
// Cheesecake's 60.000 is the one `overflow` already charges.
export const MENU_ITEMS: ReadonlyArray<MenuItem> = [
  { id: 'burger', name: 'Burger', price: 100_000n, category: 'mains' },
  { id: 'wings', name: 'Chicken Wings', price: 90_000n, category: 'mains' },
  { id: 'steak', name: 'Steak', price: 240_000n, category: 'mains' },
  { id: 'fish', name: 'Fish & Chips', price: 140_000n, category: 'mains' },
  { id: 'salad', name: 'Caesar Salad', price: 75_000n, category: 'sides' },
  { id: 'soup', name: 'Soup of the Day', price: 55_000n, category: 'sides' },
  { id: 'fries', name: 'Fries', price: 40_000n, category: 'sides' },
  { id: 'rings', name: 'Onion Rings', price: 45_000n, category: 'sides' },
  { id: 'soda', name: 'Soda', price: 30_000n, category: 'drinks' },
  { id: 'water', name: 'Mineral Water', price: 20_000n, category: 'drinks' },
  { id: 'coffee', name: 'Coffee', price: 35_000n, category: 'drinks' },
  { id: 'beer', name: 'Beer', price: 65_000n, category: 'drinks' },
  { id: 'wine', name: 'House Wine', price: 80_000n, category: 'drinks' },
  { id: 'cheesecake', name: 'Cheesecake', price: 60_000n, category: 'desserts' },
];

/** The items a category's grid shows, in the table's order. */
export const itemsIn = (category: CategoryId) => MENU_ITEMS.filter((i) => i.category === category);

/** A tile's destination: its own item's configuration sheet (M-2), one state per item (FE-021). */
export const itemDestination = (itemId: string, from?: OrderState) =>
  `?state=sheet-item-${itemId}${from && from !== 'default' && !from.startsWith('sheet-item') ? `&from=${from}` : ''}`;

// A category press has no destination. It is an [INLINE] change of POS-03
// (SITEMAP §1): the URL and history are untouched, the order stays exactly as
// it is, and the selection moves (FE-023, superseding the 2026-09-21 ruling
// that it did not).

export type LockNotice = {
  title: string;
  body: string;
  action: { label: string; href: string };
  /** notice--soft: the cashier's own doing, on this tab (ruling C-5). */
  soft: boolean;
};

// Ruling C-5: the two locks never share a string, and each names its own route
// out. The artifact links to settlement.html?state=pending and ?state=takeover.
// FE-015 reconciles the artifact's placeholder state names onto POS-04's real
// route. The state remains in the query so later slices can supply the pending
// and takeover compositions without another routing change.
export const LOCK_NOTICE: Record<SettlementLock, LockNotice> = {
  draft: {
    title: 'Finish this payment first',
    body:
      'You are collecting payment for this order on this tab. Adding items, changing the discount, firing, and ' +
      'voiding — including removing a line you have not sent yet — are unavailable until you finish or cancel ' +
      'it. You can still read the order.',
    action: { label: 'Back to payment', href: '/pos/settlement?state=settle-pending' },
    soft: true,
  },
  lease: {
    title: 'Another client is settling this order',
    body:
      'Payment was started elsewhere and may involve a card charge already in progress. You cannot add items, ' +
      'discount, fire, or void this order — and that includes removing a line you have not sent yet. Reading ' +
      'it is still fine.',
    action: { label: 'Manager: take over payment', href: '/pos/settlement?state=settle-takeover' },
    soft: false,
  },
};

export const CATALOG_NOTICE = {
  title: 'The menu changed while you were ordering',
  body: 'Nothing was added. Prices have been refreshed — check the item and add it again.',
};

/**
 * B-20, the `error` state: a command the server rejected. The copy is the
 * artifact's. **The whole claim is that nothing happened** — so the notice
 * carries no undo, no retry of the command, and nothing that touches the
 * order; its one control clears the notice and leaves the cashier on the order
 * they were already on, with the live grid to add the line again.
 *
 * `role="alert"`, not `role="status"`: this is the answer to something the
 * cashier just did, and F2e ruled that a failure a screen-reader user is never
 * told about is a real defect. CATALOG_NOTICE is the other shape — a standing
 * condition of the screen — and keeps `role="status"`.
 */
export const REJECTED_NOTICE = {
  title: 'Could not add that line',
  body: 'The order is exactly as it was. Nothing was half-applied.',
  action: 'Try again',
};

export const LOADING_LABEL = 'LOADING MENU';

export type MenuFixture = {
  /** Absent: the menu is replaced by the lock notice (AC-21, AC-29). */
  lock?: SettlementLock;
  loading?: boolean;
  catalogChanged?: boolean;
  /** Items 86'd: drawn disabled in place, never removed or moved (ruling C-3). */
  eightySixed?: ReadonlyArray<string>;
  /** Held down, because a fixture cannot hold a finger. */
  pressedCategories?: ReadonlyArray<CategoryId>;
  pressedItem?: string;
  /**
   * B-20: the order this state's rejection notice was drawn over, and so the
   * view *Try again* returns to. **On the fixture, never in the component.**
   * A control that named a state would land the cashier on that state's order
   * however they arrived — the defect F2k spent a slice removing from four
   * openers, and this would be the fifth place to reintroduce it.
   *
   * It is an [INLINE] change of POS-03 (SITEMAP §1), so it replaces the
   * history entry rather than pushing one, exactly as `sheetFixtures`' own
   * `remove: { state, gone }` does.
   */
  rejected?: OrderView;
};

export const MENU_FIXTURES: Record<OrderState, MenuFixture> = {
  default: {},
  empty: {},
  overflow: {},
  // The artifact holds the selected category and one other, so both ring
  // colours show: white on the ink fill, ink on white.
  // The pressed tile is a Main so it shows on a fresh load, which starts on Mains (FE-023).
  pressed: { pressedCategories: ['mains', 'sides'], pressedItem: 'burger' },
  'lock-draft': { lock: 'draft' },
  'lock-lease': { lock: 'lease' },
  eightysix: { eightySixed: ['steak'] },
  loading: { loading: true },
  catalog: { catalogChanged: true },
  // The grid behind each sheet is the artifact's. In sheet-item86 the artifact
  // 86s Steak in the grid, although the sheet's notice says Burger was 86'd.
  'sheet-item': {},
  'sheet-item-burger': {},
  'sheet-item-wings': {},
  'sheet-item-steak': {},
  'sheet-item-fish': {},
  'sheet-item-salad': {},
  'sheet-item-soup': {},
  'sheet-item-fries': {},
  'sheet-item-rings': {},
  'sheet-item-soda': {},
  'sheet-item-water': {},
  'sheet-item-coffee': {},
  'sheet-item-beer': {},
  'sheet-item-wine': {},
  'sheet-item-cheesecake': {},
  'sheet-item86': { eightySixed: ['steak'] },
  'sheet-line': {},
  // The approval prompt covers the whole screen; the grid behind it is the
  // artifact's default one.
  approval: {},
  'approval-error': {},
  'approval-throttled': {},
  'approval-denied': {},
  // The discount sheets and zero: the artifact's default grid behind each.
  'sheet-discount': {},
  'sheet-freeform': {},
  'sheet-remove': {},
  'sheet-remove-freeform': {},
  zero: {},
  'other-discount': {},
  // The void sheets: the artifact's default grid behind each.
  'sheet-voidline': {},
  'sheet-voidorder': {},
  'sheet-voidorder-fired': {},
  // F2h. fireblocked 86s Steak exactly as eightysix does — the state is that
  // one fact plus the order that holds a pending Steak; the refusal itself is
  // read off the order by fire.ts, never written here. error draws the
  // rejection over a live grid and returns to the order it was drawn over.
  // fireerror changes nothing on the menu: the banner is above the screen.
  fireblocked: { eightySixed: ['steak'] },
  // The same one fact over the long order, 86'ing an item it holds *one of
  // three* pending lines for. Coffee, because the grid sells one at 35.000 and
  // the order's of-coffee is 2 × 35.000 — the identification is the artifact's
  // own, as every other itemId is.
  'fireblocked-overflow': { eightySixed: ['coffee'] },
  // `default` is not a destination chosen here: it is the state that draws
  // *this* state's own order (ORDER_FIXTURES.error is the table order), which
  // is what B-20 promises is still there. A second rejection drawn over
  // another order names that order's state instead.
  error: { rejected: { state: 'default' } },
  fireerror: {},
  'fire-ready': {},
  'fire-queued': {},
  'fire-printed': {},
  'fire-failed': {},
  'fire-unknown': {},
  'fire-then-add': {},
  'fire-heading-width': {},
  // F2d. The menu region is untouched by the quick-sale variant — the rail
  // and grid are the artifact's default ones behind both states.
  quick: {},
  'quick-line': {},
  // F3c's settlement `error` seed only (orderFixtures.ts) — POS-04 draws no
  // menu region, so this fixture is never read; it exists only to satisfy
  // the exhaustive record.
  'settle-error': {},
  // FE-020's `ceiling-single` seed, on the same terms as `settle-error`.
  'settle-ceiling': {},
};

/**
 * The view-level facts an open item sheet takes from the state it was opened
 * from (`view.from`), in one place so a new one cannot be missed: an item
 * sheet's own fixture states none of them, and reading it would un-86 a held
 * line, drop the menu's notice, or hide the application-wide incident banner
 * (FR-E3) behind a sheet. Anything view-level that is *about the place, not the
 * sheet* is read here, never as `X[view.state]`.
 */
export function originFacts(view: OrderView) {
  const origin = view.from ?? view.state;
  return { menu: MENU_FIXTURES[origin], incident: ORDER_FIXTURES[origin].incident, lock: ORDER_FIXTURES[origin].lock };
}

/** The menu fixture a view draws: an item sheet draws the state it was opened from, so what was 86'd stays 86'd. */
export const menuFixtureFor = (view: OrderView): MenuFixture => originFacts(view).menu;
