import type { Money } from '@pos/money';
import { orderVariant, type OrderState, type OrderView } from './orderFixtures.js';
import { lineBody, linesOf, type ShownOrder } from './voidFixtures.js';

// POS-03's ungated sheets (F2c) as fixtures, selected by the same ?state= as
// the panel. Options, prices and copy are the reviewed artifact's
// (docs/design/visual-directions/frost/pos/order.html, on
// agent/design-direction). Every action here is one a cashier takes alone: no
// sheet in this file carries a control that leads to a manager PIN, a void or
// an approval (FR-F3, FR-F8, FR-H4 are F2g's). test/sheets.test.tsx proves it
// by pressing every control.

export type ItemOption = { id: string; name: string; delta: Money };

/** One option group: `many` is choose-any, otherwise choose-one. Option ids are unique within a sheet. */
export type ItemGroup = { id: string; name: string; many: boolean; options: ReadonlyArray<ItemOption> };

export type ItemSheetFixture = {
  kind: 'item';
  /** The menu item Add to order appends (FE-014). Each tile opens its own item's sheet (FE-021). */
  itemId: string;
  name: string;
  price: Money;
  /** The item's option groups, in the artifact's order. Empty for Soda: nothing is drawn, not even a label. */
  groups: ReadonlyArray<ItemGroup>;
  /** What the cashier had picked when the fixture was drawn: option ids by group id. */
  chosen: Readonly<Record<string, ReadonlyArray<string>>>;
  /** FR-C6, AC-12: set when a manager 86'd the item while the sheet was open. */
  unavailable?: { title: string; body: string };
  /** The control that opened the sheet, which takes focus back when it closes. */
  opener: string;
  cancel: OrderView;
  add: OrderView;
};

export type LineSheetFixture = {
  kind: 'line';
  /** The PENDING line this sheet edits: *Update to n* rewrites this line's quantity. */
  lineId: string;
  title: string;
  /** M-5: the quick form's `NOT SENT YET`, drawn where the table form draws nothing. */
  tag?: string;
  quantity: number;
  notes: ReadonlyArray<string>;
  opener: string;
  back: OrderView;
  remove: OrderView;
};

export type SheetFixture = ItemSheetFixture | LineSheetFixture;

/** FR-M5: a line's quantity is a whole number, at most 99. */
export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 99;

/**
 * FR-C2, AC-26: the resolved unit price floors at zero. The line total is this
 * × the sheet's quantity. Display only: the server prices the line when it is
 * added, and nothing here is sent anywhere.
 */
export function unitPrice(base: Money, deltas: ReadonlyArray<Money>): Money {
  const total = deltas.reduce((sum, d) => sum + d, base);
  return total < 0n ? 0n : total;
}

/** The editor's heading, as the artifact writes it over the pending Steak. */
const lineEditorTitle = (name: string) => `${name} — pending`;

// The artifact's two notes on the line editor. Both are about a PENDING line
// in general, not about the Steak, so every line's editor carries them.
const PENDING_NOTES: ReadonlyArray<string> = [
  'This line has not been sent to the kitchen. Removing it needs no approval and is not recorded.',
  'You can also remove it straight from the order line without opening this sheet. This sheet exists for ' +
    'quantity, which has nowhere else to live.',
];

// M-5's quick form: the same two facts, in the quick sale's own words
// (FR-E5) — nothing on a counter sale goes to the kitchen at all until
// settle, not merely "not yet".
const QUICK_NOTES: ReadonlyArray<string> = [
  'Nothing on a counter sale goes to the kitchen until you settle it, so removing this line needs no approval ' +
    'and is not recorded.',
  'You can also remove it straight from the order line. This sheet exists for quantity.',
];

// The artifact routes each sheet's actions to fixture states. Its Cancel is
// order.html (the default state); its Add goes to eightysix and its line
// editor's Back goes to eightysix too. Those are the artifact's choices, kept
// as they are. Remove line lands on the default figures without the Steak,
// which is what the artifact's order.html shows.
// FE-021: the twelve item sheets. Every option set, price and default is the
// artifact's (frost-order-flow.js, the `items` table) — illustrative fixture
// data, never a production catalogue; the real one is the server's.
type Def = { id: string; groups: ReadonlyArray<{ name: string; many: boolean; options: ReadonlyArray<[string, bigint]>; on: ReadonlyArray<number> }> };
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
  { id: 'coffee', name: 'Coffee', price: 35_000n, groups: [g('Size', false, [['Regular', 0n], ['Large', 10_000n]], [1]), g('Extras', true, [['Extra shot', 10_000n]], [])] },
  { id: 'beer', name: 'Beer', price: 65_000n, groups: [g('Size', false, [['Regular', 0n], ['Large', 25_000n]], [1])] },
  { id: 'wine', name: 'House Wine', price: 80_000n, groups: [g('Pour', false, [['Standard', 0n], ['Small', -20_000n]], [1])] },
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

/** The twelve `sheet-item-<id>` states, in tile order. `sheet-item` stays Burger's alias. */
const ITEM_SHEETS: Record<string, Omit<ItemSheetFixture, 'unavailable'>> = {
  'sheet-item-burger': { ...burger, add: { state: 'default' } },
  ...Object.fromEntries(OTHER_ITEMS.map((d) => [`sheet-item-${d.id}`, fromDef(d)])),
};
export const ITEM_SHEET_STATES = Object.keys(ITEM_SHEETS) as ReadonlyArray<OrderState>;

export const SHEET_FIXTURES: Partial<Record<OrderState, SheetFixture>> = {
  ...(ITEM_SHEETS as Partial<Record<OrderState, SheetFixture>>),
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

  // The table order holds one PENDING line, the Steak, and its row body is the
  // editor's opener.
  'sheet-line': {
    kind: 'line',
    lineId: 'steak',
    title: lineEditorTitle('Steak'),
    quantity: 1,
    notes: PENDING_NOTES,
    opener: '.order-line[data-line-status="pending"] > .order-line__target',
    back: { state: 'eightysix' },
    remove: { state: 'default', gone: 'steak' },
  },

  // M-5's quick form, over the counter order's Burger — the artifact's own
  // routing (Back and Remove line both stay on ?state=quick).
  'quick-line': {
    kind: 'line',
    lineId: 'q-burger',
    title: 'Burger',
    tag: 'NOT SENT YET',
    quantity: 1,
    notes: QUICK_NOTES,
    opener: lineBody('q-burger'),
    back: { state: 'quick' },
    remove: { state: 'quick', gone: 'q-burger' },
  },
};

/**
 * The line editor a PENDING row body opens: for the line the cashier tapped,
 * on the order on screen — never a fixture's line. Its title names that line
 * and its *Remove line* asks for that line, which is the same act the row's ×
 * performs, and the panel honours it the same way: only where the fixture has
 * figures for the removal, and never under a lock (OrderPanel.tsx). A removal
 * the fixtures cannot draw does nothing, exactly as it does from the ×.
 *
 * Back keeps the order the cashier was looking at, as a panel-opened void does
 * (the ruling of 2026-09-18). ?state=sheet-line keeps the artifact's own
 * routing for review.
 *
 * Undefined for a line that is not a PENDING line of the order on screen: only
 * a PENDING row body opens this sheet (I-12), so there is nothing to draw.
 *
 * **The form is the order's variant (FR-D2), not `view.state`.** A quick
 * sale's editor carries the tag and the copy M-5 gives it; a table order's
 * carries neither. Reading `order.type` (via `orderVariant`) rather than the
 * state name is what lets a table-order object handed the quick type draw the
 * quick affordances, and vice versa — the same discipline fire.ts's block
 * holds to.
 */
export function panelLine(lineId: string, view: OrderView, order: ShownOrder): LineSheetFixture | undefined {
  const line = linesOf(order).find((l) => l.line.id === lineId)?.line;
  if (!line || line.status !== 'pending') return undefined;
  const quick = orderVariant(order) === 'quick_sale';
  return {
    kind: 'line',
    lineId,
    title: quick ? line.name : lineEditorTitle(line.name),
    ...(quick && { tag: 'NOT SENT YET' }),
    quantity: line.quantity,
    notes: quick ? QUICK_NOTES : PENDING_NOTES,
    opener: lineBody(lineId),
    back: view,
    remove: { ...view, gone: lineId },
  };
}
