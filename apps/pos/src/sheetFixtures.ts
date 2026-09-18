import type { Money } from '@pos/money';
import type { OrderState, OrderView } from './orderFixtures.js';

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
    title: 'Steak — pending',
    quantity: 1,
    notes: [
      'This line has not been sent to the kitchen. Removing it needs no approval and is not recorded.',
      'You can also remove it straight from the order line without opening this sheet. This sheet exists for ' +
        'quantity, which has nowhere else to live.',
    ],
    opener: '.order-line[data-line-status="pending"] > .order-line__target',
    back: { state: 'eightysix' },
    remove: { state: 'default', gone: 'steak' },
  },
};
