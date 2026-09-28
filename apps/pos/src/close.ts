import type { Money } from '@pos/money';
import { fireOrder } from './fire.js';
import { orderVariant, type OrderLine, type OrderVariant, type RoundGroup } from './orderFixtures.js';
import { settlementPosition } from './tender.js';

/**
 * The order shape `closeRefusal` needs: enough to read the type (FR-G10) and
 * every line's status. `ShownOrder` satisfies this without importing it,
 * keeping this module dependent only on `orderFixtures.ts`, as `tender.ts` is.
 */
export type CloseableOrder = { type?: OrderVariant; groups: ReadonlyArray<RoundGroup> };

export type CloseRefusal =
  | { reason: 'pending'; lines: ReadonlyArray<OrderLine> }
  | { reason: 'balance' };

/**
 * Whether the order may close, and why not (FR-G10, F3a's balance rule). A
 * table order refuses while any line is PENDING — read through `orderVariant`,
 * never `order.type === 'table'` directly, because the field defaults through
 * that function and a bare comparison would silently pass every table fixture
 * that omits it (rule 2's trap). A quick sale's lines are PENDING by nature
 * (F2d, FR-E5) and never block on that account.
 *
 * `pending` is checked first: at a zero-total table order still carrying a
 * pending line, the balance is already zero, so the balance check alone would
 * let it close (rule 5's ruling — FR-G10 wins where the two meet).
 */
export function closeRefusal(order: CloseableOrder, position: { balance: Money }): CloseRefusal | undefined {
  if (orderVariant(order) === 'table') {
    const pending = order.groups.flatMap((g) => g.lines).filter((line) => line.status === 'pending');
    if (pending.length > 0) return { reason: 'pending', lines: pending };
  }
  if (position.balance > 0n) return { reason: 'balance' };
  return undefined;
}

/** A tender as the closed order keeps it (FR-G9): what was keyed, not the draft's session id. */
export type Tender = { label: string; amount: Money };

export type CloseInput = CloseableOrder & {
  /** The order's total (B-6: what is recorded), never the amount tendered. */
  total: Money;
  /** FR-G13: another client holds the lease. Not this tab's own payment session, which is how a close is reached. */
  locked?: boolean;
  /** The items the menu has 86'd (B-17): a quick sale's lines fire at close, so they are read again here. */
  unavailable?: ReadonlyArray<string>;
};

export type ClosedOrder = {
  status: 'closed';
  closedAt: string;
  groups: ReadonlyArray<RoundGroup>;
  tenders: ReadonlyArray<Tender>;
  change: Money;
  total: Money;
};

export type CloseRefused = CloseRefusal | { reason: 'locked' } | { reason: 'unavailable' };

/**
 * The close (FR-G5 to FR-G10), applied. Either the refusal — `closeRefusal`'s
 * own, never a second copy of its rules — or the closed order: the drafts
 * become the tenders (FR-G9), change is `settlementPosition`'s (FR-G6, B-6),
 * and a zero-total order closes with no tenders.
 *
 * A quick sale's PENDING lines become one `queued` round (FR-E5), built by
 * `fireOrder` as every fire's round is. `queued` means sent, never printed
 * (ARCH-002). A table order cannot reach this with a pending line: `pending`
 * refuses it first. `closedAt` is an argument; this module reads no clock.
 *
 * A refusal changes nothing (B-20).
 */
export function closeOrder(
  order: CloseInput,
  drafts: ReadonlyArray<{ label: string; amount: Money }>,
  closedAt: string
): { closed: ClosedOrder; refused?: undefined } | { refused: CloseRefused; closed?: undefined } {
  if (order.locked) return { refused: { reason: 'locked' } };
  const kept = order.total === 0n ? [] : drafts;
  const position = settlementPosition(order.total, kept.map((d) => d.amount));
  const refused = closeRefusal(order, position);
  if (refused) return { refused };

  let groups = order.groups;
  if (orderVariant(order) === 'quick_sale') {
    const fired = fireOrder(order.groups, { type: 'table', unavailable: order.unavailable ?? [], locked: false, firedAt: closedAt });
    if (fired.refused && fired.refused !== 'nothing') return { refused: { reason: 'unavailable' } };
    if (!fired.refused) groups = fired.groups;
  }
  return {
    closed: {
      status: 'closed',
      closedAt,
      groups,
      tenders: kept.map(({ label, amount }) => ({ label, amount })),
      change: position.change,
      total: order.total,
    },
  };
}
