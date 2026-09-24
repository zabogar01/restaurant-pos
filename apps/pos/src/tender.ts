import type { Money } from '@pos/money';

export type TenderMethod = 'cash' | 'card';

/** FR-M5: the most change a single close can give, and the most any one tender may be. */
export const CASH_CHANGE_LIMIT: Money = 9_999_999n;
export const SINGLE_TENDER_LIMIT: Money = 99_999_999n;

/**
 * The most a method may be keyed against a balance (FR-G3, FR-G4, FR-M5,
 * B-5). Cash is the only exception: capped at the balance plus the change
 * limit, itself capped at the single-tender limit. Every other method,
 * including a future custom one, falls through to the balance uncapped by
 * nothing — the default is capped, not the exception.
 */
export function tenderMaximum(method: TenderMethod, balance: Money): Money {
  if (balance <= 0n) return 0n;
  if (method === 'cash') {
    const changeLimited = cashChangeLimitedMaximum(balance);
    return changeLimited < SINGLE_TENDER_LIMIT ? changeLimited : SINGLE_TENDER_LIMIT;
  }
  return balance;
}

/** The balance plus the change limit, before the single-tender cap is applied (FR-M5). */
export function cashChangeLimitedMaximum(balance: Money): Money {
  return balance + CASH_CHANGE_LIMIT;
}

/** True when the cash ceiling is the change limit rather than the single-tender cap (FR-M5). */
export function cashCeilingBoundByChangeLimit(balance: Money): boolean {
  return cashChangeLimitedMaximum(balance) <= SINGLE_TENDER_LIMIT;
}

/**
 * The one gate for adding a drafted tender. Components do not carry a second
 * copy of it.
 */
export function mayAddTender(method: TenderMethod, amount: Money, balance: Money): boolean {
  return amount > 0n && amount <= tenderMaximum(method, balance);
}

/**
 * The balance and change derived from the total and the drafted tenders
 * (FR-G4, B-6). Never stored at the moment of Add: removing a tender must
 * move both, because only the last Add can ever overshoot (card is capped at
 * the balance, and Add is refused once the balance reaches zero).
 */
export function settlementPosition(
  total: Money,
  drafts: ReadonlyArray<Money>
): { balance: Money; change: Money; tendered: Money } {
  const tendered = drafts.reduce((sum, amount) => sum + amount, 0n);
  const diff = total - tendered;
  return {
    balance: diff > 0n ? diff : 0n,
    change: diff < 0n ? -diff : 0n,
    tendered,
  };
}
