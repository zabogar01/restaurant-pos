import type { Money } from '@pos/money';
import type { CatalogCategory } from './catalog/types.js';
import type { Preset } from './discount.js';
import type { OrderState, OrderView } from './orderFixtures.js';
import type { ItemSheetFixture } from './sheetFixtures.js';


// FIXTURE MODE ONLY. POS-03's menu region as fixtures (F2b), selected by the same
// ?state= as the panel, and the fixture item sheets (F2c, FE-021). Categories,
// items, prices and options are the reviewed artifact's
// (docs/design/visual-directions/frost/pos/order.html, on agent/design-direction).
// This module is reached only through session/source.ts behind
// `__FIXTURE_SESSION__`, so a built bundle holds none of it and the fixture menu
// can never stand in for a served one (B-24, ARCH-021 consult C4 item 5). It holds
// data and pure functions only, so the bundler can drop it; the bundle test is
// the proof, not that reasoning.

/** Exported only so the bundle test can prove this module is absent from a build. */
export const FIXTURE_MENU_MARKER = 'fixture-menu:rpos-b24c7e';

/** Exported only so the bundle test can prove the fixture preset list is absent from a build (B-24). */
export const FIXTURE_PRESETS_MARKER = 'fixture-presets:rpos-5d29e0';

// The artifact's four presets, in its order, all active (docs/design/visual-directions/frost/pos/order.html).
// The fixture catalog's menu carries them as the server's would (catalog/fixtureCatalog.ts), so the fixture
// picker and the store read them through the one path a served build reads its own. Like the rest of this
// module they are reached only through session/source.ts, so no built bundle holds them.
export const PRESETS: ReadonlyArray<Preset> = [
  { id: 'staff-meal', name: 'Staff meal', value: { kind: 'percent', percent: '10' }, active: true },
  { id: 'regular', name: 'Regular customer', value: { kind: 'percent', percent: '5' }, active: true },
  { id: 'service-recovery', name: 'Service recovery', value: { kind: 'fixed', amount: 50_000n }, active: true },
  { id: 'comp', name: 'Comp', value: { kind: 'percent', percent: '100' }, active: true },
];

export const MENU_CATEGORIES: ReadonlyArray<CatalogCategory> = [
  { id: 'mains', name: 'Mains' },
  { id: 'sides', name: 'Sides' },
  { id: 'drinks', name: 'Drinks' },
  { id: 'desserts', name: 'Desserts' },
];

/** `category` is the single source of which grid an item is on: every item belongs to exactly one (FE-023). */
export type MenuItem = { id: string; name: string; price: Money; category: string };

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
export const itemsIn = (category: string) => MENU_ITEMS.filter((i) => i.category === category);

// A category press has no destination. It is an [INLINE] change of POS-03
// (SITEMAP §1): the URL and history are untouched, the order stays exactly as
// it is, and the selection moves (FE-023, superseding the 2026-09-21 ruling
// that it did not).

export type MenuFixture = {
  loading?: boolean;
  catalogChanged?: boolean;
  /** Items 86'd: drawn disabled in place, never removed or moved (ruling C-3). */
  eightySixed?: ReadonlyArray<string>;
  /** Held down, because a fixture cannot hold a finger. */
  pressedCategories?: ReadonlyArray<string>;
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
  // The lock states: the place's lock is the order stand-in's (orderFixtures.ts, `originFacts`).
  'lock-draft': {},
  'lock-lease': {},
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
  // FE-026: the floor's entry snapshots. Table 7's grid is replaced by the lock notice, as lock-draft's is (the lock is orderFixtures.ts's).
  'open-t7': {},
  'open-t9': {},
  'open-t12': {},
  'quick-new': {},
  // F3c's settlement `error` seed only (orderFixtures.ts) — POS-04 draws no
  // menu region, so this fixture is never read; it exists only to satisfy
  // the exhaustive record.
  'settle-error': {},
  // FE-020's `ceiling-single` seed, on the same terms as `settle-error`.
  'settle-ceiling': {},
};

/** The menu fixture a view draws: an item sheet draws the state it was opened from, so what was 86'd stays 86'd. */
export const menuFixtureFor = (view: OrderView): MenuFixture => MENU_FIXTURES[view.from ?? view.state];

// ---- The fixture item sheets (F2c, FE-021) ----
// The artifact routes each sheet's actions to fixture states. Its Cancel is
// order.html (the default state); its Add goes to eightysix and its line
// editor's Back goes to eightysix too. Those are the artifact's choices, kept
// as they are. Remove line lands on the default figures without the Steak,
// which is what the artifact's order.html shows.
type Def = { id: string; groups: ReadonlyArray<{ name: string; many: boolean; options: ReadonlyArray<[string, bigint]>; on: ReadonlyArray<number> }> };

// The tables are built on the first read, not at load. A function nothing calls is
// dropped by the bundler, a top-level call is not: the fixture menu has to leave a
// build whole (B-24), and a table built at module level would stay.
let built: { fixtures: Partial<Record<OrderState, ItemSheetFixture>>; states: ReadonlyArray<OrderState> } | undefined;

function buildItemSheets() {
  // FE-021: the twelve item sheets. Every option set, price and default is the
  // artifact's (frost-order-flow.js, the `items` table) — illustrative fixture
  // data, never a production catalogue; the real one is the server's.
  const g = (name: string, many: boolean, options: Def['groups'][number]['options'], on: ReadonlyArray<number> = [0]) => ({ name, many, options, on });

  // Burger keeps the ids its tests and Add routing already use.
  const burger: Omit<ItemSheetFixture, 'unavailable'> = {
    kind: 'item',
    itemId: 'burger',
    name: 'Burger',
    price: 100_000n,
    groups: [
      {
        id: 'size',
        name: 'Size',
        many: false,
        options: [
          { id: 'regular', name: 'Regular', delta: 0n },
          { id: 'large', name: 'Large', delta: 20_000n },
          { id: 'small', name: 'Small', delta: -10_000n },
        ],
      },
      {
        id: 'extras',
        name: 'Extras',
        many: true,
        options: [
          { id: 'cheese', name: 'Extra cheese', delta: 15_000n },
          { id: 'bacon', name: 'Bacon', delta: 20_000n },
          { id: 'no-onion', name: 'No onion', delta: 0n },
        ],
      },
    ],
    chosen: { size: ['large'], extras: ['cheese'] },
    opener: '.menu-tile[data-item="burger"]',
    cancel: { state: 'default' },
    add: { state: 'eightysix' },
  };

  const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const OTHER_ITEMS: ReadonlyArray<Def & { name: string; price: bigint }> = [
    { id: 'wings', name: 'Chicken Wings', price: 90_000n, groups: [g('Sauce', false, [['Buffalo', 0n], ['BBQ', 0n], ['Garlic butter', 10_000n]])] },
    {
      id: 'steak',
      name: 'Steak',
      price: 240_000n,
      groups: [g('Doneness', false, [['Medium rare', 0n], ['Medium', 0n], ['Well done', 0n]]), g('Extras', true, [['Pepper sauce', 10_000n], ['Garlic butter', 15_000n]])],
    },
    { id: 'fish', name: 'Fish & Chips', price: 140_000n, groups: [g('Sauce', false, [['Tartare', 0n], ['Chilli mayo', 5_000n]]), g('Extras', true, [['Extra fish', 60_000n]])] },
    { id: 'salad', name: 'Caesar Salad', price: 75_000n, groups: [g('Extras', true, [['Grilled chicken', 25_000n], ['No croutons', 0n]])] },
    { id: 'soup', name: 'Soup of the Day', price: 55_000n, groups: [g('Bread', false, [['With bread', 0n], ['No bread', -5_000n]], [1])] },
    { id: 'fries', name: 'Fries', price: 40_000n, groups: [g('Seasoning', false, [['Salt', 0n], ['Chilli', 0n]]), g('Extras', true, [['Cheese sauce', 10_000n]], [])] },
    { id: 'rings', name: 'Onion Rings', price: 45_000n, groups: [g('Dip', false, [['Ketchup', 0n], ['Garlic mayo', 5_000n]], [1])] },
    { id: 'soda', name: 'Soda', price: 30_000n, groups: [] },
    { id: 'water', name: 'Mineral Water', price: 20_000n, groups: [] },
    { id: 'coffee', name: 'Coffee', price: 35_000n, groups: [g('Size', false, [['Regular', 0n], ['Large', 10_000n]], [1]), g('Extras', true, [['Extra shot', 10_000n]], [])] },
    { id: 'beer', name: 'Beer', price: 65_000n, groups: [g('Size', false, [['Regular', 0n], ['Large', 25_000n]], [1])] },
    { id: 'wine', name: 'House Wine', price: 80_000n, groups: [g('Pour', false, [['Standard', 0n], ['Small', -20_000n]], [1])] },
    { id: 'cheesecake', name: 'Cheesecake', price: 60_000n, groups: [] },
  ];

  function fromDef(d: (typeof OTHER_ITEMS)[number]): Omit<ItemSheetFixture, 'unavailable'> {
    const groups = d.groups.map((grp) => ({
      id: slug(grp.name),
      name: grp.name,
      many: grp.many,
      options: grp.options.map(([name, delta]) => ({ id: slug(name), name, delta })),
    }));
    return {
      kind: 'item',
      itemId: d.id,
      name: d.name,
      price: d.price,
      groups,
      chosen: Object.fromEntries(d.groups.map((grp, i) => [groups[i]!.id, grp.on.map((j) => groups[i]!.options[j]!.id)])),
      opener: `.menu-tile[data-item="${d.id}"]`,
      cancel: { state: 'default' },
      add: { state: 'default' },
    };
  }

  /** The fourteen `sheet-item-<id>` states, in tile order. `sheet-item` stays Burger's alias. */
  // `__PURE__`: these calls build the table once at load, and a bundle that never reads it must be able to drop it.
  const ITEM_SHEETS: Record<string, Omit<ItemSheetFixture, 'unavailable'>> = {
    'sheet-item-burger': { ...burger, add: { state: 'default' } },
    ...(Object.fromEntries(OTHER_ITEMS.map((d) => [`sheet-item-${d.id}`, fromDef(d)]))),
  };



  /** Every item-sheet state, in tile order: the twelve `sheet-item-<id>` ones, then the two aliases. */
  const ITEM_SHEET_FIXTURES: Partial<Record<OrderState, ItemSheetFixture>> = {
    ...(ITEM_SHEETS as Partial<Record<OrderState, ItemSheetFixture>>),
    'sheet-item': burger,

    'sheet-item86': {
      ...burger,
      unavailable: {
        title: 'Burger is no longer available',
        body:
          'A manager marked it 86 while you were choosing. Your selections are kept so you can note them, but it ' +
          'cannot be added.',
      },
    },
  };

  return { fixtures: ITEM_SHEET_FIXTURES, states: Object.keys(ITEM_SHEETS) as ReadonlyArray<OrderState> };
}

/** Every item-sheet state's sheet: the twelve `sheet-item-<id>` ones, then the two aliases. */
export const itemSheetFixtures = (): Partial<Record<OrderState, ItemSheetFixture>> => (built ??= buildItemSheets()).fixtures;

/** The `sheet-item-<id>` states, in tile order. */
export const itemSheetStates = (): ReadonlyArray<OrderState> => (built ??= buildItemSheets()).states;

/** A tile's destination: its own item's configuration sheet (M-2), one state per item (FE-021). */
export const itemDestination = (itemId: string, from?: OrderState) =>
  `?state=sheet-item-${itemId}${from && from !== 'default' && !from.startsWith('sheet-item') ? `&from=${from}` : ''}`;
