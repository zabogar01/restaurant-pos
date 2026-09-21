import type { Money } from '@pos/money';
import { orderTotals, type DiscountSnapshot } from './discount.js';
import { COMP, OTHER_15, OTHER_15_NOTE, STAFF_MEAL, STAFF_MEAL_NOTE } from './discountFixtures.js';

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
// the sheets' own fixtures are in sheetFixtures.ts. F2g adds the manager
// approval prompt's four states, drawn over the table order; its fixtures are
// in approvalFixtures.ts. F2i adds the discount sheets and zero; the sheets'
// own fixtures are in discountFixtures.ts. Two of its states draw an order the
// artifact never figured — this order comped, and this order carrying a
// free-form discount — so their totals are computed by orderTotals from the
// discount they carry, the arithmetic test/discount.test.tsx holds to the
// artifact's own figures. F2j adds the three void sheets; their own fixtures
// are in voidFixtures.ts. The fire-error states are F2h.

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
  /**
   * The discount the order carries, snapshotted (FR-F4, B-8). `totals.discount`
   * is the same discount as the panel prints it — a label and an amount — and
   * carries no `source`, which is the one fact FR-F8's gate reads. The sheets
   * read this; test/discount.test.tsx holds the two to each other.
   */
  applied?: DiscountSnapshot;
  /**
   * Who applied that discount, when, and on what authority — the change
   * sheet's line under it. **Tied to the application it describes, never
   * derived**: the artifact attaches its actor and time to Staff meal on this
   * order (frost/pos/order.html:529-531) and to nothing else, and reusing the
   * sentence for another application asserts a fact nobody established. An
   * order whose discount has no reviewed application history carries none, and
   * the sheet draws the gap (see `zero`).
   */
  appliedNote?: string;
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
  | 'sheet-line'
  | 'approval'
  | 'approval-error'
  | 'approval-throttled'
  | 'approval-denied'
  | 'sheet-discount'
  | 'sheet-freeform'
  | 'sheet-remove'
  | 'sheet-remove-freeform'
  | 'zero'
  | 'other-discount'
  | 'sheet-voidline'
  | 'sheet-voidorder'
  | 'sheet-voidorder-fired';

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
  { id: 'approval', label: 'Modal — manager approval' },
  { id: 'approval-error', label: 'Modal — wrong PIN' },
  { id: 'approval-throttled', label: 'Modal — approval cooldown' },
  { id: 'approval-denied', label: 'Modal — cashier PIN refused' },
  { id: 'sheet-discount', label: 'Sheet — preset picker' },
  { id: 'sheet-freeform', label: 'Sheet — free-form discount' },
  { id: 'sheet-remove', label: 'Sheet — remove/replace discount' },
  { id: 'sheet-remove-freeform', label: 'Sheet — remove/replace a free-form discount' },
  { id: 'zero', label: 'Zero total (100% comp)' },
  { id: 'other-discount', label: 'Free-form discount applied' },
  { id: 'sheet-voidline', label: 'Sheet — void fired line' },
  { id: 'sheet-voidorder', label: 'Sheet — void order (unfired)' },
  { id: 'sheet-voidorder-fired', label: 'Sheet — void order (holds fired)' },
];

// ruling C-5: the two locks never share a string.
export const LOCK_TAG: Record<SettlementLock, string> = {
  draft: 'FINISH PAYMENT FIRST',
  lease: 'ANOTHER CLIENT',
};

export const FIRED_TAG = 'MANAGER TO VOID';
export const PENDING_TAG = 'REMOVE FREELY';

// Neither row body names a state. A PENDING row body opens the line editor
// (F2c) for its own line, and a FIRED row body the void sheet (FR-H4, F2j) for
// its own line: both as component state over the order on screen
// (OrderPanel.tsx), so a tap can only ever act on the line that was tapped.
// ?state=sheet-line still draws the artifact's own editor for review.

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

// The same three lines before anything was sent to the kitchen, for the one
// sheet that is only true of such an order: voiding an order with nothing
// fired (FR-H3). The artifact draws that sheet beside its two fired rounds,
// which contradicts the sheet's own notice; see the FE-008 handoff. Same
// lines, same figures: firing changes no price.
const unfiredTableOrder: ReadonlyArray<RoundGroup> = [
  {
    kind: 'pending',
    lines: tableOrder.flatMap((g) => g.lines).map((l) => ({ ...l, status: 'pending' as const })),
  },
];

const tableTotalsWithout = {
  steak: serviceAndTax(165_000n, 7_425n, 155_925n, 13_500n, { label: 'Staff meal 10%', amount: -16_500n }),
};

export const ORDER_FIXTURES: Record<OrderState, OrderFixture> = {
  default: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

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
    applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE,
    totalsWithout: tableTotalsWithout,
    pressedLineId: 'soda',
  },

  'lock-draft': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, lock: 'draft' },

  'lock-lease': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, lock: 'lease' },

  // F2b's states change the menu region. The panel draws the table order, as
  // the artifact's catalog state does. Its eightysix state also tags the
  // pending Steak line 86, and its loading state replaces the lines and totals
  // with a skeleton; both are panel markup this slice does not touch.
  eightysix: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  loading: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  catalog: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // F2c's sheets open over the table order, as the artifact draws them: the
  // panel beside a sheet is the order the cashier is acting on. The artifact
  // also tags the pending Steak line 86 in sheet-item86; the 86'd line in the
  // panel is F2h's.
  'sheet-item': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-item86': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-line': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // F2g's approval prompt opens over the table order: the artifact's request
  // is to void its fired Burger.
  approval: { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'approval-error': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'approval-throttled': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'approval-denied': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // F2i's sheets open over the table order and its Staff meal preset, as the
  // artifact draws them.
  'sheet-discount': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-freeform': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-remove': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },

  // The state FE-007 adds: the same order carrying a free-form discount, so the
  // panel beside the change sheet shows the discount the sheet says is applied.
  'sheet-remove-freeform': {
    title: 'Order · T1',
    groups: tableOrder,
    totals: orderTotals(405_000n, OTHER_15),
    applied: OTHER_15,
    appliedNote: OTHER_15_NOTE,
    totalsWithout: { steak: orderTotals(165_000n, OTHER_15) },
  },

  // The comp the picker's Comp lands on, over the order it was chosen on. The
  // artifact figures its own two-line order (165.000); this is the same
  // arithmetic over the table order the picker sits beside.
  //
  // **No appliedNote, deliberately.** The artifact gives this Comp no
  // application history: nothing says who comped this order or when, and
  // borrowing Staff meal's actor and time would assert a different event's
  // facts. Ruled 2026-09-21 — draw the gap rather than fill it, as A7's four
  // designed tokens carry an explicit null source rather than a plausible one.
  // **The composition is owed to a designer:** the artifact draws no change
  // sheet without the note.
  zero: {
    title: 'Order · T1',
    groups: tableOrder,
    totals: orderTotals(405_000n, COMP),
    applied: COMP,
    totalsWithout: { steak: orderTotals(165_000n, COMP) },
  },

  // The state F2k adds, and the only non-sheet order that carries a free-form
  // discount: exactly what sheet-remove-freeform draws, without the sheet. It
  // exists because the gate's answer only differs from a fixture's here —
  // FR-F8 gates the whole transition off a free-form discount, so from this
  // order every preset and the removal need a manager, and from every other
  // reachable order they do not. Same lines, same figures, same snapshot.
  'other-discount': {
    title: 'Order · T1',
    groups: tableOrder,
    totals: orderTotals(405_000n, OTHER_15),
    applied: OTHER_15,
    appliedNote: OTHER_15_NOTE,
    totalsWithout: { steak: orderTotals(165_000n, OTHER_15) },
  },

  // F2j's void sheets. The fired-line void and the order holding fired work
  // open over the table order, as every other sheet does; the unfired order's
  // void opens over that order with nothing yet sent.
  'sheet-voidline': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-voidorder': { title: 'Order · T1', groups: unfiredTableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
  'sheet-voidorder-fired': { title: 'Order · T1', groups: tableOrder, totals: tableTotals, applied: STAFF_MEAL, appliedNote: STAFF_MEAL_NOTE, totalsWithout: tableTotalsWithout },
};

/**
 * What POS-03 is showing: which fixture order, and which PENDING line the
 * remove control took away. A removal is an [INLINE] state of the screen
 * (SITEMAP §1), so reaching it replaces the history entry rather than pushing
 * one.
 *
 * **The rail's category is deliberately not here.** F2k briefly carried it, so
 * that pressing a category moved the rail's selection; ruled out 2026-09-21,
 * because the artifact has a grid for Mains only and a rail reading *Drinks*
 * over the Mains grid tells the cashier something false about what they are
 * looking at. A URL that asserted a category nothing honoured was the same
 * defect where nobody sees it, so both halves went together: nothing writes
 * ?category=, and nothing reads it. What a category press should do before
 * there is a second catalogue is a designer's question.
 */
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
