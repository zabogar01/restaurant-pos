import type { Money } from '@pos/money';

// POS-03's order panel as fixtures, selected by ?state= as the reviewed
// artifact selects them (docs/design/visual-directions/frost/pos/order.html,
// on agent/design-direction). Lines, figures and copy are the artifact's.
// Nothing is computed here: every total is the artifact's own figure, written
// down as a bigint, because pricing is the server's and this slice has none.
//
// F2a built the panel and its six states. F2b adds three states that change
// only the menu region (eightysix, loading, catalog); the panel draws the table
// order in each, see ORDER_FIXTURES. The menu region's own fixtures are in
// menuFixtures.ts. F2c adds three sheet states, drawn over the table order;
// the sheets' own fixtures are in sheetFixtures.ts. The gated sheets and the
// approval PIN are F2g; the fire-error states are F2h.

export type LineStatus = 'pending' | 'fired' | 'voided';

export type Modifier = { name: string; delta?: Money };

export type OrderLine = {
  id: string;
  quantity: number;
  name: string;
  modifiers?: ReadonlyArray<Modifier>;
  /** A voided line's record: when, and who approved it. */
  note?: string;
  amount: Money;
  status: LineStatus;
};

export type RoundGroup =
  | { kind: 'fired'; round: number; firedAt: string; printed: boolean; lines: ReadonlyArray<OrderLine> }
  | { kind: 'pending'; lines: ReadonlyArray<OrderLine> };

export type Adjustment = { label: string; amount: Money };

export type Totals = {
  subtotal: Money;
  discount?: Adjustment;
  serviceCharge?: Adjustment;
  total: Money;
  taxIncluded?: Adjustment;
};

/** FR-G12 (this tab's tender draft) or FR-G13 (another client's lease). */
export type SettlementLock = 'draft' | 'lease';

export type OrderFixture = {
  title: string;
  groups: ReadonlyArray<RoundGroup>;
  totals: Totals;
  lock?: SettlementLock;
  /** The FIRED line drawn held down, because a fixture cannot hold a finger. */
  pressedLineId?: string;
  /** The artifact's figures after removing one PENDING line, by line id. */
  totalsWithout?: Readonly<Record<string, Totals>>;
};

export type OrderState =
  | 'default'
  | 'empty'
  | 'overflow'
  | 'pressed'
  | 'lock-draft'
  | 'lock-lease'
  | 'eightysix'
  | 'loading'
  | 'catalog'
  | 'sheet-item'
  | 'sheet-item86'
  | 'sheet-line';

export const ORDER_STATES: ReadonlyArray<{ id: OrderState; label: string }> = [
  { id: 'default', label: 'Two rounds fired, one line pending' },
  { id: 'empty', label: 'No lines' },
  { id: 'overflow', label: 'Overflow — long order' },
  { id: 'pressed', label: 'Pressed — fired line held' },
  { id: 'lock-draft', label: 'Locked — your payment' },
  { id: 'lock-lease', label: 'Locked — another client' },
  { id: 'eightysix', label: 'Item 86’d — disabled in place' },
  { id: 'loading', label: 'Loading the menu' },
  { id: 'catalog', label: 'Menu changed while ordering' },
  { id: 'sheet-item', label: 'Sheet — item configuration' },
  { id: 'sheet-item86', label: 'Sheet — item 86’d mid-choice' },
  { id: 'sheet-line', label: 'Sheet — line editor' },
];

// ruling C-5: the two locks never share a string.
export const LOCK_TAG: Record<SettlementLock, string> = {
  draft: 'FINISH PAYMENT FIRST',
  lease: 'ANOTHER CLIENT',
};

export const FIRED_TAG = 'MANAGER TO VOID';
export const PENDING_TAG = 'REMOVE FREELY';

// The row body's destination. The void sheet (FR-H4) is F2g and does not exist
// yet, so it names the artifact's fixture state and today resolves to the
// default state. The line editor is F2c's sheet-line.
export const VOID_LINE_HREF = '?state=sheet-voidline';
export const EDIT_LINE_HREF = '?state=sheet-line';

const serviceAndTax = (subtotal: Money, service: Money, total: Money, tax: Money, discount?: Adjustment): Totals => ({
  subtotal,
  ...(discount && { discount }),
  serviceCharge: { label: 'Service charge 5%', amount: service },
  total,
  taxIncluded: { label: 'Includes tax 10%', amount: tax },
});

// Rounds 1 and 2 and the pending Steak are the artifact's locked-state order;
// its default state is the same order with the Steak removed, which is why
// removing it lands on the artifact's default figures.
const tableOrder: ReadonlyArray<RoundGroup> = [
  {
    kind: 'fired',
    round: 1,
    firedAt: '19:42',
    printed: true,
    lines: [
      {
        id: 'burger',
        quantity: 1,
        name: 'Burger',
        modifiers: [
          { name: 'Large', delta: 20_000n },
          { name: 'Extra cheese', delta: 15_000n },
        ],
        amount: 135_000n,
        status: 'fired',
      },
    ],
  },
  {
    kind: 'fired',
    round: 2,
    firedAt: '19:58',
    printed: true,
    lines: [{ id: 'soda', quantity: 1, name: 'Soda', amount: 30_000n, status: 'fired' }],
  },
  {
    kind: 'pending',
    lines: [
      { id: 'steak', quantity: 1, name: 'Steak', modifiers: [{ name: 'Medium rare' }], amount: 240_000n, status: 'pending' },
    ],
  },
];

const tableTotals = serviceAndTax(405_000n, 18_225n, 382_725n, 33_136n, {
  label: 'Staff meal 10%',
  amount: -40_500n,
});

const tableTotalsWithout = {
  steak: serviceAndTax(165_000n, 7_425n, 155_925n, 13_500n, { label: 'Staff meal 10%', amount: -16_500n }),
};

export const ORDER_FIXTURES: Record<OrderState, OrderFixture> = {
  default: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, totalsWithout: tableTotalsWithout },

  empty: { title: 'Order · T1', groups: [], totals: { subtotal: 0n, total: 0n } },

  overflow: {
    title: 'Order · T1',
    groups: [
      {
        kind: 'fired',
        round: 1,
        firedAt: '19:42',
        printed: true,
        lines: [
          {
            id: 'of-burger',
            quantity: 2,
            name: 'Burger',
            modifiers: [{ name: 'Large' }, { name: 'Extra cheese' }],
            amount: 270_000n,
            status: 'fired',
          },
          { id: 'of-fish', quantity: 1, name: 'Fish & Chips', amount: 140_000n, status: 'fired' },
          { id: 'of-soda', quantity: 4, name: 'Soda', amount: 120_000n, status: 'fired' },
          {
            id: 'of-salad',
            quantity: 1,
            name: 'Caesar Salad',
            note: 'Voided 19:51 · approved by M. Iqbal',
            amount: 75_000n,
            status: 'voided',
          },
        ],
      },
      {
        kind: 'fired',
        round: 2,
        firedAt: '19:58',
        printed: true,
        lines: [
          { id: 'of-wings', quantity: 3, name: 'Chicken Wings', amount: 270_000n, status: 'fired' },
          { id: 'of-beer', quantity: 2, name: 'Beer', amount: 130_000n, status: 'fired' },
          { id: 'of-rings', quantity: 1, name: 'Onion Rings', amount: 45_000n, status: 'fired' },
        ],
      },
      {
        kind: 'pending',
        lines: [
          { id: 'of-coffee', quantity: 2, name: 'Coffee', amount: 70_000n, status: 'pending' },
          { id: 'of-cheese', quantity: 1, name: 'Cheesecake', amount: 60_000n, status: 'pending' },
          { id: 'of-wine', quantity: 1, name: 'House Wine', amount: 80_000n, status: 'pending' },
        ],
      },
    ],
    totals: serviceAndTax(1_185_000n, 59_250n, 1_244_250n, 107_727n),
    totalsWithout: {
      'of-coffee': serviceAndTax(1_115_000n, 55_750n, 1_170_750n, 101_364n),
      'of-cheese': serviceAndTax(1_125_000n, 56_250n, 1_181_250n, 102_273n),
      'of-wine': serviceAndTax(1_105_000n, 55_250n, 1_160_250n, 100_455n),
    },
  },

  pressed: {
    title: 'Order · T1',
    groups: tableOrder,
    totals: tableTotals,
    totalsWithout: tableTotalsWithout,
    pressedLineId: 'soda',
  },

  'lock-draft': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, lock: 'draft' },

  'lock-lease': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, lock: 'lease' },

  // F2b's states change the menu region. The panel draws the table order, as
  // the artifact's catalog state does. Its eightysix state also tags the
  // pending Steak line 86, and its loading state replaces the lines and totals
  // with a skeleton; both are panel markup this slice does not touch.
  eightysix: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, totalsWithout: tableTotalsWithout },
  loading: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, totalsWithout: tableTotalsWithout },
  catalog: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, totalsWithout: tableTotalsWithout },

  // F2c's sheets open over the table order, as the artifact draws them: the
  // panel beside a sheet is the order the cashier is acting on. The artifact
  // also tags the pending Steak line 86 in sheet-item86; the 86'd line in the
  // panel is F2h's.
  'sheet-item': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, totalsWithout: tableTotalsWithout },
  'sheet-item86': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, totalsWithout: tableTotalsWithout },
  'sheet-line': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, totalsWithout: tableTotalsWithout },
};

export type OrderView = { state: OrderState; gone?: string };

/** The query string that selects a view: the inverse of orderViewFrom. */
export function viewSearch({ state, gone }: OrderView): string {
  return gone ? `?state=${state}&gone=${encodeURIComponent(gone)}` : `?state=${state}`;
}

/** ?state= picks the fixture; ?gone= is a PENDING line the remove control took away. */
export function orderViewFrom(search: string): OrderView {
  const params = new URLSearchParams(search);
  const state = ORDER_STATES.find((s) => s.id === params.get('state'))?.id ?? 'default';
  const gone = params.get('gone');
  return gone ? { state, gone } : { state };
}
