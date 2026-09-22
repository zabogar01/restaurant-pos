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

export type ItemSheetFixture = {
  kind: 'item';
  name: string;
  price: Money;
  sizes: ReadonlyArray<ItemOption>;
  extras: ReadonlyArray<ItemOption>;
  /** What the cashier had picked when the fixture was drawn. */
  chosen: { size: string; extras: ReadonlyArray<string> };
  /** FR-C6, AC-12: set when a manager 86'd the item while the sheet was open. */
  unavailable?: { title: string; body: string };
  /** The control that opened the sheet, which takes focus back when it closes. */
  opener: string;
  cancel: OrderView;
  add: OrderView;
};

export type LineSheetFixture = {
  kind: 'line';
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
 * FR-C2, AC-26: the resolved unit price floors at zero. Quantity on this sheet
 * is always one, so this is also the line total. Display only: the server
 * prices the line when it is added, and nothing here is sent anywhere.
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
const burger: Omit<ItemSheetFixture, 'unavailable'> = {
  kind: 'item',
  name: 'Burger',
  price: 100_000n,
  sizes: [
    { id: 'regular', name: 'Regular', delta: 0n },
    { id: 'large', name: 'Large', delta: 20_000n },
    { id: 'small', name: 'Small', delta: -10_000n },
  ],
  extras: [
    { id: 'cheese', name: 'Extra cheese', delta: 15_000n },
    { id: 'bacon', name: 'Bacon', delta: 20_000n },
    { id: 'no-onion', name: 'No onion', delta: 0n },
  ],
  chosen: { size: 'large', extras: ['cheese'] },
  opener: '.menu-tile[data-item="burger"]',
  cancel: { state: 'default' },
  add: { state: 'eightysix' },
};

export const SHEET_FIXTURES: Partial<Record<OrderState, SheetFixture>> = {
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
    title: quick ? line.name : lineEditorTitle(line.name),
    ...(quick && { tag: 'NOT SENT YET' }),
    quantity: line.quantity,
    notes: quick ? QUICK_NOTES : PENDING_NOTES,
    opener: lineBody(lineId),
    back: view,
    remove: { ...view, gone: lineId },
  };
}
