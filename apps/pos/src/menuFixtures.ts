import type { Money } from '@pos/money';
import type { OrderState, OrderView, SettlementLock } from './orderFixtures.js';

// POS-03's menu region as fixtures (F2b), selected by the same ?state= as the
// panel. Categories, items, prices and every notice's copy are the reviewed
// artifact's (docs/design/visual-directions/frost/pos/order.html, on
// agent/design-direction). Nothing is fetched: the catalog is the server's and
// this slice has none.

export type MenuItem = { id: string; name: string; price: Money };

export const MENU_CATEGORIES = [
  { id: 'mains', name: 'Mains' },
  { id: 'sides', name: 'Sides' },
  { id: 'drinks', name: 'Drinks' },
  { id: 'desserts', name: 'Desserts' },
] as const;

export type CategoryId = (typeof MENU_CATEGORIES)[number]['id'];

/** The category the rail starts on, and the only one the artifact draws a grid for. */
export const SELECTED_CATEGORY: CategoryId = 'mains';

// The artifact's one grid, in its order. It is drawn under Mains although it
// holds sides and drinks; the artifact has no grid for any other category.
export const MENU_ITEMS: ReadonlyArray<MenuItem> = [
  { id: 'burger', name: 'Burger', price: 100_000n },
  { id: 'wings', name: 'Chicken Wings', price: 90_000n },
  { id: 'steak', name: 'Steak', price: 240_000n },
  { id: 'fish', name: 'Fish & Chips', price: 140_000n },
  { id: 'salad', name: 'Caesar Salad', price: 75_000n },
  { id: 'soup', name: 'Soup of the Day', price: 55_000n },
  { id: 'fries', name: 'Fries', price: 40_000n },
  { id: 'rings', name: 'Onion Rings', price: 45_000n },
  { id: 'soda', name: 'Soda', price: 30_000n },
  { id: 'coffee', name: 'Coffee', price: 35_000n },
  { id: 'beer', name: 'Beer', price: 65_000n },
  { id: 'wine', name: 'House Wine', price: 80_000n },
];

// A tile's destination: the item configuration sheet (M-2). The artifact
// configures Burger only, so every tile opens Burger's sheet.
export const ITEM_SEARCH = '?state=sheet-item';

// A category press has no destination. It is an [INLINE] change of POS-03
// (SITEMAP §1): the order stays exactly as it is and the history entry is
// replaced. It used to name ?state=default, which moved every order to the
// table order (fixed in F2k).
//
// Nothing else changes yet. The artifact has items for Mains only, so no other
// category has a grid to show — FE-004's accepted limitation — and the rail
// keeps SELECTED_CATEGORY rather than drawing a selection the grid
// contradicts (ruled 2026-09-21; see MenuRegion.tsx).

export type LockNotice = {
  title: string;
  body: string;
  action: { label: string; href: string };
  /** notice--soft: the cashier's own doing, on this tab (ruling C-5). */
  soft: boolean;
};

// Ruling C-5: the two locks never share a string, and each names its own route
// out. The artifact links to settlement.html?state=pending and ?state=takeover.
// Settlement (F3) is not built, so these are placeholder states on this screen,
// named after the artifact's, and today resolve to the default state.
export const LOCK_NOTICE: Record<SettlementLock, LockNotice> = {
  draft: {
    title: 'Finish this payment first',
    body:
      'You are collecting payment for this order on this tab. Adding items, changing the discount, firing, and ' +
      'voiding — including removing a line you have not sent yet — are unavailable until you finish or cancel ' +
      'it. You can still read the order.',
    action: { label: 'Back to payment', href: '?state=settle-pending' },
    soft: true,
  },
  lease: {
    title: 'Another client is settling this order',
    body:
      'Payment was started elsewhere and may involve a card charge already in progress. You cannot add items, ' +
      'discount, fire, or void this order — and that includes removing a line you have not sent yet. Reading ' +
      'it is still fine.',
    action: { label: 'Manager: take over payment', href: '?state=settle-takeover' },
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
  pressed: { pressedCategories: ['mains', 'sides'], pressedItem: 'fries' },
  'lock-draft': { lock: 'draft' },
  'lock-lease': { lock: 'lease' },
  eightysix: { eightySixed: ['steak'] },
  loading: { loading: true },
  catalog: { catalogChanged: true },
  // The grid behind each sheet is the artifact's. In sheet-item86 the artifact
  // 86s Steak in the grid, although the sheet's notice says Burger was 86'd.
  'sheet-item': {},
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
  // F2d. The menu region is untouched by the quick-sale variant — the rail
  // and grid are the artifact's default ones behind both states.
  quick: {},
  'quick-line': {},
};
