import type { Money } from '@pos/money';
import type { Tender } from './close.js';

// The full refund of a closed order (FR-H5, FE-032), applied. A STAND-IN for the
// server's full-refund command (ARCHITECTURE section 13): it runs in this tab's
// memory and is lost on reload. It is not a gate and it is not a record the
// restaurant can rely on. What it leaves out, the server owes:
//   - PIN verification, the actor and the approver: the client verifies no PIN
//     and a refund made here names no approver (ADR-007);
//   - the idempotency key and the expected order version (ADR-003);
//   - the business-day lock (ARCHITECTURE section 8): `dayClosed` is a fact the
//     caller passes, as `locked` is for `closeOrder`, and no book order sets it;
//   - the audit entry (ADR-007);
//   - persisted `Refund` and `RefundTender` rows.
// When the server's refund command exists this module is deleted, not kept as a
// fallback for an unreachable server.
//
// The refund is its own record (ARCHITECTURE sections 6.5 and 8): it never
// touches the order's lines, totals, tenders or change. `refundedAt` is an
// argument; this module reads no clock.

/** One tender's share of the money going back: the original tender's position and label, copied. */
export type RefundAllocation = { position: number; label: string; amount: Money };

/**
 * What a refund leaves behind. It has no approver, no actor and no approval flag
 * (O6): nothing here was verified, and `approver: null` would be ADR-007's failed
 * or cancelled approval, which this is not.
 */
export type RefundRecord = {
  refundedAt: string;
  /** Trimmed. */
  reason: string;
  /** Amounts above zero only, in the order the tenders were taken. */
  allocations: ReadonlyArray<RefundAllocation>;
  /** The order's total (FR-H5: the whole order, once). */
  amount: Money;
};

export type RefundRequest = {
  /** One row per original tender the cashier allocated to, by its position in the order's tenders. */
  allocations: ReadonlyArray<{ position: number; amount: Money }>;
  reason: string;
  /** The business day closed (B-9, FR-H7). An input fact the caller passes. */
  dayClosed?: boolean;
};

/** In the order the operation checks them. */
export type RefundRefusal =
  | 'unknown-order'
  | 'not-closed'
  | 'already-refunded'
  | 'zero-total'
  | 'day-closed'
  | 'no-reason'
  | 'not-a-tender'
  | 'invalid-amount'
  | 'sum-mismatch';

export type RefundResult = { record: RefundRecord; refused?: undefined } | { refused: RefundRefusal; record?: undefined };

/** The facts a refund is checked against. */
export type RefundableOrder = {
  /** Reached CLOSED. */
  closed: boolean;
  /** Already holds a refund record. */
  refunded: boolean;
  total: Money;
  tenders: ReadonlyArray<Tender>;
};

/**
 * What each tender contributed to the total, by the walk FR-G4 defines change
 * with: in the order taken, `contribution = min(tender, remaining)`, then
 * `remaining -= contribution`, from the order's total. A tender after the balance
 * is met contributes 0, and change comes off whichever tender went over. This is
 * the one rule for change in the client: the allocation sheet's defaults, its
 * *ALLOCATION EDITED* comparison and its arithmetic line all read it.
 */
export function contributions(tenders: ReadonlyArray<Tender>, total: Money): ReadonlyArray<Money> {
  let remaining = total;
  return tenders.map((t) => {
    const contribution = t.amount < remaining ? t.amount : remaining;
    remaining -= contribution;
    return contribution;
  });
}

/**
 * The refund, or the first refusal that applies (B-20: a refusal changes
 * nothing). Zero rows are discarded before the sum is checked and are never
 * stored (O3).
 */
export function refundOrder(order: RefundableOrder, request: RefundRequest, refundedAt: string): RefundResult {
  if (!order.closed) return { refused: 'not-closed' };
  if (order.refunded) return { refused: 'already-refunded' };
  if (order.total === 0n) return { refused: 'zero-total' };
  if (request.dayClosed) return { refused: 'day-closed' };
  const reason = request.reason.trim();
  if (reason === '') return { refused: 'no-reason' };

  const seen = new Set<number>();
  for (const { position } of request.allocations) {
    if (!Number.isInteger(position) || position < 0 || position >= order.tenders.length || seen.has(position)) return { refused: 'not-a-tender' };
    seen.add(position);
  }
  if (request.allocations.some((a) => a.amount < 0n)) return { refused: 'invalid-amount' };

  const kept = request.allocations.filter((a) => a.amount > 0n).sort((a, b) => a.position - b.position);
  if (kept.reduce((sum, a) => sum + a.amount, 0n) !== order.total) return { refused: 'sum-mismatch' };

  return {
    record: {
      refundedAt,
      reason,
      allocations: kept.map((a) => ({ position: a.position, label: order.tenders[a.position]!.label, amount: a.amount })),
      amount: order.total,
    },
  };
}
