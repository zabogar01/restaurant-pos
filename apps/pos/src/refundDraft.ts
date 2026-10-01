import type { Money } from '@pos/money';
import type { Tender } from './close.js';
import { formatAmount } from './money.js';
import { contributions } from './refund.js';

// POS-06's refund draft, as data (FE-032): the M-5 allocation sheet's copy and the
// working draft it edits, read from the artifact (frost/pos/closed.js:98–118 and
// :138–156). Nothing here decides an outcome: the book's refund operation does
// (refund.ts), and this module only says what the sheet shows and what an
// allocation sums to. Every figure is a `Money`; none is compared as a double.

/** The three presets and the free-text reason (closed.js:12). */
export const REASON_PRESETS: ReadonlyArray<string> = ['Wrong dish served', 'Customer complaint', 'Charged in error'];
export const OTHER_REASON = 'Other — type a reason';
export const REASON_MAX = 160;
export const AMOUNT_DIGITS = 9;

export const REFUND_COPY = {
  refund: 'Refund this order',
  tag: 'MANAGER REQUIRED',
  sheetTitle: 'Refund the whole order',
  notice: (total: string) => `Refund the whole order · ${total}`,
  noticeBody: 'Part of an order cannot be refunded. An order can be refunded once.',
  how: 'How the money goes back · tap an amount to edit',
  notRefunded: '· not refunded',
  allocated: 'Allocated',
  equal: 'Allocation equals the full order total.',
  zeroRow: 'A row at 0 is not refunded and is left out of the refund.',
  defaults: 'Defaults to each original tender less its change.',
  reasonHead: 'Reason — required',
  reasonMissing: 'Select a reason before continuing.',
  cancel: 'Cancel',
  continue: 'Continue to manager PIN',
  editTitle: 'Edit refund allocation',
  editNote: (total: string) => `This changes the allocation only. The refund remains the whole order, ${total}.`,
  cancelEdit: 'Cancel edit',
  keepAmount: 'Keep amount',
  otherLabel: 'Refund reason',
  cancelReason: 'Cancel reason',
  keepReason: 'Keep reason',
  space: 'Space',
  deleteLetter: 'Delete',
  clear: 'Clear',
  failed: 'Refund failed · the order is unchanged',
  failedKept: 'Your allocation and reason are kept. Review them, then enter a manager PIN for a new attempt.',
  nothing: 'Nothing was refunded.',
  review: 'Review refund',
  dayRefused: 'Refund refused · business day closed during this attempt',
  dayRefusedBody: 'Nothing was refunded. The order is unchanged. Reprinting still works.',
  returnToOrder: 'Return to order',
  edited: 'ALLOCATION EDITED',
  approvalNotRefunded: 'not refunded',
  approves: 'Approves this refund only.',
} as const;

/** The three letter rows of the on-screen keyboard (closed.js:144). */
export const LETTER_ROWS: ReadonlyArray<string> = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** What the cashier is drafting: the money back per original tender, by position, and why. */
export type Draft = { amounts: ReadonlyArray<Money>; reason: string };

/** What the sheet is showing. The editor and the reason keyboard live in the same sheet (closed.js:141–145). */
export type Panel = { kind: 'list' } | { kind: 'edit'; index: number; value: string } | { kind: 'other'; text: string };

export type Flow =
  | { kind: 'sheet'; draft: Draft; panel: Panel }
  | { kind: 'approval'; draft: Draft };

/** The default: every original tender's effective contribution, tendered less change (FR-H5, AC-25). */
export const defaultAmounts = (tenders: ReadonlyArray<Tender>, total: Money): ReadonlyArray<Money> => contributions(tenders, total);

export const startingDraft = (tenders: ReadonlyArray<Tender>, total: Money): Draft => ({ amounts: defaultAmounts(tenders, total), reason: '' });

/** What the rows sum to. */
export const allocated = (amounts: ReadonlyArray<Money>): Money => amounts.reduce((sum, a) => sum + a, 0n);

/** Positive when the rows fall short of the total, negative when they pass it. Only this is checked (O2). */
export const shortBy = (amounts: ReadonlyArray<Money>, total: Money): Money => total - allocated(amounts);

/** *ALLOCATION EDITED*: any row differing from its own default, row by row (closed.js:114). */
export function isEdited(amounts: ReadonlyArray<Money>, tenders: ReadonlyArray<Tender>, total: Money): boolean {
  const base = defaultAmounts(tenders, total);
  return amounts.length !== base.length || amounts.some((a, i) => a !== base[i]);
}

/** *Cash: 200.000 − 44.075 = 155.925.*, for each tender whose contribution is less than its amount. Computed from the walk, never copied. */
export function arithmetic(tenders: ReadonlyArray<Tender>, total: Money): ReadonlyArray<string> {
  const walk = contributions(tenders, total);
  return tenders.flatMap((t, i) => {
    const kept = walk[i]!;
    return t.amount > kept ? [`${t.label}: ${formatAmount(t.amount)} − ${formatAmount(t.amount - kept)} = ${formatAmount(kept)}.`] : [];
  });
}

/** The alert's first sentence: what to do about the difference. */
export const differenceText = (short: Money): string =>
  short > 0n ? `Allocate ${formatAmount(short)} more` : `Reduce allocations by ${formatAmount(-short)}`;

/** Digits keyed into the editor: shift in from the right, drop a leading zero, at most `max` (the keypad of FE-030's `keyed`). */
export function keyedAmount(value: string, key: string, max: number): string {
  if (key === 'Clear') return '';
  if (key === '←') return value.slice(0, -1);
  return (value === '0' ? '' : value).concat(key).slice(0, max);
}

/** The amount the editor keeps: the digits keyed, an empty field being 0. */
export const amountOf = (value: string): Money => BigInt(value === '' ? '0' : value);

// ---------------------------------------------------------------------------
// The fixture states (closed.js:90, :98–118)
// ---------------------------------------------------------------------------

/** The thirteen states this slice builds (closed-order.html:7), in the artifact's order. */
export type RefundState =
  | 'sheet-refund'
  | 'sheet-ac25'
  | 'sheet-custom'
  | 'sheet-edited'
  | 'sheet-invalid'
  | 'sheet-zero'
  | 'sheet-edit'
  | 'sheet-other'
  | 'approval'
  | 'approval-edited'
  | 'refund-error'
  | 'refund-error-cash'
  | 'day-refusal';

export const REFUND_STATES: ReadonlyArray<{ id: RefundState; label: string }> = [
  { id: 'sheet-refund', label: 'Default refund allocation' },
  { id: 'sheet-ac25', label: 'Cash contribution · AC-25' },
  { id: 'sheet-custom', label: 'Custom tender allocation' },
  { id: 'sheet-edited', label: 'Edited · exact sum' },
  { id: 'sheet-invalid', label: 'Edited · sum mismatch' },
  { id: 'sheet-zero', label: 'Edited · row set to 0' },
  { id: 'sheet-edit', label: 'Touch · edit amount' },
  { id: 'sheet-other', label: 'Touch · other reason' },
  { id: 'approval', label: 'Manager PIN · default allocation' },
  { id: 'approval-edited', label: 'Manager PIN · allocation edited' },
  { id: 'refund-error', label: 'Refund command failed' },
  { id: 'refund-error-cash', label: 'Cash-only refund failed · AC-25' },
  { id: 'day-refusal', label: 'Day closed during attempt' },
];

/** What a state pictures: the edit it carries, the reason already chosen and the overlay open. */
export type Starting = { draft: Draft; overlay: 'sheet' | 'approval' | undefined; panel: Panel; failed: boolean; dayRefused: boolean };

const MOVED = 20_000n;
const SHEET_EDIT_VALUE = '80000';
const OTHER_TEXT = 'Meal was cold';

/**
 * closed.js:98–118 for a state. The artifact's edits apply only to an order that
 * can be refunded; a zero-total, REFUNDED or closed-day order shows its defaults
 * and opens no overlay, whatever the state says. `refund-error-cash` behaves as
 * `refund-error` (closed.js:6).
 */
export function startingFlow(state: string, tenders: ReadonlyArray<Tender>, total: Money, refundable: boolean): Starting {
  const initial = state === 'refund-error-cash' ? 'refund-error' : state;
  const amounts = [...defaultAmounts(tenders, total)];
  if (refundable && amounts.length > 0) {
    if (['sheet-edited', 'refund-error', 'day-refusal'].includes(initial) && amounts.length > 1) {
      const moved = amounts[0]! < MOVED ? amounts[0]! : MOVED;
      amounts[0] = amounts[0]! - moved;
      amounts[amounts.length - 1] = amounts[amounts.length - 1]! + moved;
    }
    if (initial === 'sheet-invalid') amounts[0] = amounts[0]! - MOVED;
    if (['sheet-zero', 'approval-edited'].includes(initial) && (amounts.length > 1 || initial === 'sheet-zero')) {
      const moved = amounts[0]!;
      amounts[0] = 0n;
      // A sole zero row intentionally leaves the full total unallocated and blocks Continue.
      if (amounts.length > 1) amounts[amounts.length - 1] = amounts[amounts.length - 1]! + moved;
    }
  }
  const chosen = ['approval', 'approval-edited', 'refund-error', 'day-refusal', 'sheet-edited', 'sheet-invalid', 'sheet-edit', 'sheet-zero'].includes(initial);
  const draft: Draft = { amounts, reason: chosen ? REASON_PRESETS[0]! : '' };
  const overlay = !refundable ? undefined : initial.startsWith('sheet-') ? 'sheet' : initial === 'approval' || initial === 'approval-edited' ? 'approval' : undefined;
  const panel: Panel =
    initial === 'sheet-edit' ? { kind: 'edit', index: 0, value: SHEET_EDIT_VALUE } : initial === 'sheet-other' ? { kind: 'other', text: OTHER_TEXT } : { kind: 'list' };
  return { draft, overlay, panel, failed: initial === 'refund-error', dayRefused: initial === 'day-refusal' };
}
