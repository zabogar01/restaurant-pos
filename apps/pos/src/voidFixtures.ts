import { ORDER_FIXTURES, type OrderLine, type OrderState, type OrderView, type RoundGroup, type Totals } from './orderFixtures.js';
import type { VoidReason } from './void.js';

// POS-03's void sheets (F2j) as fixtures, selected by the same ?state= as the
// order screen. Reasons and copy are the reviewed artifact's
// (docs/design/visual-directions/frost/pos/order.html, the sheet-voidline,
// sheet-voidorder and sheet-voidorder-fired blocks, on agent/design-direction).
//
// A fixture says what is being voided and where the order goes afterwards. It
// says nothing about approval, reason or audit: that is voidRule, in void.ts,
// asked by the sheet about the order beside it. sheet-voidorder and
// sheet-voidorder-fired are the same fixture shape over different orders, and
// the sheet draws whichever variant the order calls for (SITEMAP §2: one
// "Void whole order" sheet, with an unfired variant and an approval path).
//
// No reason is chosen in any fixture. The artifact draws one chosen in each
// gated sheet, but ?state=sheet-voidline is where a fired row's body leads in
// the app, so a reason chosen here would be a default: a void recorded with a
// reason nobody gave (FR-H4).

export type VoidSheetFixture = {
  /** A FIRED line, by id, on the order beside the sheet; or the whole order. */
  target: { kind: 'line'; lineId: string } | { kind: 'order' };
  /** The reasons the sheet offers when a reason is required, in the artifact's order. "Other" is always last. */
  reasons: ReadonlyArray<VoidReason>;
  /** The control that opened the sheet, which takes focus back when it closes. */
  opener: string;
  cancel: OrderView;
  /** Where the order lands once the void is made, approved or not. */
  landsOn: OrderView;
};

export const LINE_REASONS: ReadonlyArray<VoidReason> = [
  { id: 'wrong-table', label: 'Sent to the wrong table', inline: 'sent to the wrong table' },
  { id: 'changed-mind', label: 'Customer changed their mind', inline: 'customer changed their mind' },
  { id: 'kitchen-cannot', label: 'Kitchen cannot make it', inline: 'kitchen cannot make it' },
];

export const ORDER_REASONS: ReadonlyArray<VoidReason> = [
  { id: 'customer-left', label: 'Customer left', inline: 'customer left' },
  { id: 'taken-in-error', label: 'Order taken in error', inline: 'order taken in error' },
];

// The artifact lands every void on something it can draw: the approval's
// confirm key on ?state=default, the unfired void on the floor plan, which
// this client does not have. No state draws the order once it is voided, so
// every void lands on default, as every undrawn result in F2i does. Cancel is
// default too; the artifact's "Keep order" on the unfired sheet goes to
// ?state=eightysix, which this does not copy (see the FE-008 handoff).
const settled = { cancel: { state: 'default' }, landsOn: { state: 'default' } } satisfies Pick<VoidSheetFixture, 'cancel' | 'landsOn'>;

// The close bar's Void order, which opens both order sheets.
const VOID_ORDER_OPENER = '.order-actions a[href="?state=sheet-voidorder"]';

export const VOID_FIXTURES: Partial<Record<OrderState, VoidSheetFixture>> = {
  // The artifact's line: the fired Burger. Focus returns to its row body, the
  // first FIRED row on the order.
  'sheet-voidline': {
    target: { kind: 'line', lineId: 'burger' },
    reasons: LINE_REASONS,
    opener: '.order-line[data-line-status="fired"] > .order-line__target',
    ...settled,
  },

  'sheet-voidorder': { target: { kind: 'order' }, reasons: ORDER_REASONS, opener: VOID_ORDER_OPENER, ...settled },

  'sheet-voidorder-fired': { target: { kind: 'order' }, reasons: ORDER_REASONS, opener: VOID_ORDER_OPENER, ...settled },
};

/** The order as the panel beside the sheet shows it. */
export type ShownOrder = { title: string; groups: ReadonlyArray<RoundGroup>; totals: Totals };

/**
 * The order the panel draws for a view, so the sheet reads the same lines and
 * the same total the cashier can see beside it. The panel's own rule
 * (OrderPanel.tsx): a ?gone= removal is honoured only where the fixture has
 * figures for it, and never under a lock. test/void.test.tsx holds the two to
 * each other.
 */
export function shownOrder({ state, gone }: OrderView): ShownOrder {
  const fixture = ORDER_FIXTURES[state];
  const removed = !fixture.lock && gone && fixture.totalsWithout?.[gone] ? gone : undefined;
  return {
    title: fixture.title,
    totals: removed ? fixture.totalsWithout![removed]! : fixture.totals,
    groups: fixture.groups
      .map((g) => ({ ...g, lines: g.lines.filter((l) => l.id !== removed) }))
      .filter((g) => g.lines.length > 0),
  };
}

/** Every line on a shown order, with the round group it sits in. */
export function linesOf(order: ShownOrder): ReadonlyArray<{ line: OrderLine; group: RoundGroup }> {
  return order.groups.flatMap((group) => group.lines.map((line) => ({ line, group })));
}
