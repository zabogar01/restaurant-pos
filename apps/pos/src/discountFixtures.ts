import type { Money } from '@pos/money';
import { snapshotOf, type DiscountSnapshot, type FreeFormEntry, type Preset } from './discount.js';
import type { OrderState, OrderView } from './orderFixtures.js';

// POS-03's discount sheets (M-3, F2i) as fixtures, selected by the same
// ?state= as the order screen. Presets and copy are the reviewed artifact's
// (docs/design/visual-directions/frost/pos/order.html, the sheet-discount,
// sheet-freeform, sheet-remove and zero blocks, on agent/design-direction).
//
// A fixture says what the order carries and which sheet is showing. It says
// nothing about which controls are gated: that is FR-F8's table, in
// discount.ts, applied to `applied` by the sheet itself.

export type DiscountStep = 'picker' | 'free-form' | 'change';

export type DiscountSheetFixture = {
  /** What the order carries now (FR-F4). Undefined for an order with no discount. */
  applied?: DiscountSnapshot;
  /** The change sheet's line under the applied discount: who applied it, when, and on what authority. */
  appliedNote?: string;
  /** The subtotal of the order the sheet acts on, which a discount is taken from. */
  subtotal: Money;
  /** The presets as the back office holds them; the picker shows the active ones (FR-F5). */
  presets: ReadonlyArray<Preset>;
  /** The sheets the cashier has come through, last one showing. Back returns along it. */
  trail: ReadonlyArray<DiscountStep>;
  /** What the free-form sheet holds when the fixture opens on it. */
  entry?: FreeFormEntry;
  /** The control that opened the sheet, which takes focus back when it closes. */
  opener: string;
  cancel: OrderView;
  /** Where the order lands once a change is made, approved or not. */
  landsOn: (change: DiscountSnapshot | 'remove') => OrderView;
};

// The artifact's four presets, in its order. All active.
export const PRESETS: ReadonlyArray<Preset> = [
  { id: 'staff-meal', name: 'Staff meal', value: { kind: 'percent', percent: '10' }, active: true },
  { id: 'regular', name: 'Regular customer', value: { kind: 'percent', percent: '5' }, active: true },
  { id: 'service-recovery', name: 'Service recovery', value: { kind: 'fixed', amount: 50_000n }, active: true },
  { id: 'comp', name: 'Comp', value: { kind: 'percent', percent: '100' }, active: true },
];

const preset = (id: string) => snapshotOf(PRESETS.find((p) => p.id === id)!);

/** The table order's discount, as every other state draws it: "Staff meal 10%". */
export const STAFF_MEAL: DiscountSnapshot = preset('staff-meal');

/** The comp that zero draws: "Comp 100%". */
export const COMP: DiscountSnapshot = preset('comp');

/** The free-form sheet's title, which is also the name a free-form discount carries. */
export const FREE_FORM_NAME = 'Other discount';

/**
 * The one state this slice adds (FE-007): the same order carrying a free-form
 * discount instead of a preset, so that the change sheet has to gate all three
 * of its controls. 15% is the value the artifact's free-form sheet holds.
 */
export const OTHER_15: DiscountSnapshot = { source: 'free-form', name: FREE_FORM_NAME, value: { kind: 'percent', percent: '15' } };

/** The table order's subtotal (orderFixtures.ts), which every discount sheet here acts on. */
export const TABLE_SUBTOTAL: Money = 405_000n;

// The artifact routes its presets to ?state=default, except Comp, which it
// routes to zero; the confirm key after an approval lands on default too.
// Removing a discount it routes to ?state=empty — the order with no lines —
// which this does not copy: see the FE-007 handoff. No state draws the order
// once its discount has gone, so a removal lands on default like every other
// change the fixtures cannot draw.
const landsOn = (change: DiscountSnapshot | 'remove'): OrderView =>
  change !== 'remove' && change.presetId === 'comp' ? { state: 'zero' } : { state: 'default' };

const onTableOrder = {
  applied: STAFF_MEAL,
  appliedNote: 'Applied by Ana R. at 19:44. Preset, no approval.',
  subtotal: TABLE_SUBTOTAL,
  presets: PRESETS,
  // The close bar's Discount. The artifact also opens the change sheet from a
  // "change" link on the totals' discount row, which the panel (F2a) does not
  // draw; see the handoff.
  opener: '.order-actions [data-action="discount"]',
  cancel: { state: 'default' },
  landsOn,
} satisfies Omit<DiscountSheetFixture, 'trail'>;

export const DISCOUNT_FIXTURES: Partial<Record<OrderState, DiscountSheetFixture>> = {
  'sheet-discount': { ...onTableOrder, trail: ['picker'] },

  // The artifact's free-form sheet, reached from the picker's Other amount: its
  // Back returns there. Percent chosen and 15 typed is the picture it draws of
  // a cashier mid-entry, not a default (B-21): reached in the app, the sheet
  // opens empty.
  'sheet-freeform': { ...onTableOrder, trail: ['picker', 'free-form'], entry: { kind: 'percent', text: '15' } },

  'sheet-remove': { ...onTableOrder, trail: ['change'] },

  // PROVISIONAL COPY in appliedNote: the artifact draws only a preset applied.
  // The approver's name is the one the artifact's voided line carries.
  'sheet-remove-freeform': {
    ...onTableOrder,
    applied: OTHER_15,
    appliedNote: 'Applied by Ana R. at 19:44. Free-form, approved by M. Iqbal.',
    trail: ['change'],
  },
};
