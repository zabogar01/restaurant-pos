import type { LineStatus } from './orderFixtures.js';

// The void rules the POS draws from (FR-H1–H4, B-15, B-16). Pure: no
// component, no fixture, no state. The void sheets ask this module; they never
// decide a gate themselves.

/** What a void acts on: one line, or a whole OPEN order with every line on it (FR-H1). */
export type VoidTarget<L extends { status: LineStatus }> =
  | { kind: 'line'; line: L }
  | { kind: 'order'; lines: ReadonlyArray<L> };

export type VoidRule<L> = {
  /** The requirement that decided this void. */
  requirement: 'FR-H2' | 'FR-H3' | 'FR-H4';
  /** A manager PIN, through the approval prompt (M-1). */
  approval: boolean;
  /** A reason, chosen before the PIN and carried with the approval. */
  reason: boolean;
  /** An audit entry is written (FR-J3). */
  audited: boolean;
  /**
   * The previously fired work a cancellation ticket covers, and nothing else
   * (B-16). Empty when there is none. The ticket is created with the void and
   * printed after commit; printing never gates or rolls back the void (FR-H4,
   * B-15), so nothing here waits on it.
   */
  cancels: ReadonlyArray<L>;
};

/** The FIRED lines a void would cancel. A VOIDED line was fired work once and is not any more. */
export function firedWork<L extends { status: LineStatus }>(target: VoidTarget<L>): ReadonlyArray<L> {
  const lines = target.kind === 'line' ? [target.line] : target.lines;
  return lines.filter((l) => l.status === 'fired');
}

/**
 * FR-H2–H4. Approval and the reason read one fact: is fired work involved.
 * Never which sheet or control the cashier is standing on.
 *
 *   target                        approval  reason  audited
 *   a PENDING line                no        no      no       (FR-H2)
 *   an order with no FIRED line   no        no      yes      (FR-H3)
 *   a FIRED line                  yes       yes     yes      (FR-H4)
 *   an order holding a FIRED line yes       yes     yes      (FR-H4)
 *
 * FR-H2 and FR-H3 agree on approval and differ on audit: taking a pending line
 * off is not recorded, voiding an order is, fired work or not.
 */
export function voidRule<L extends { status: LineStatus }>(target: VoidTarget<L>): VoidRule<L> {
  if (target.kind === 'line' && target.line.status === 'voided') throw new Error('a voided line has nothing left to void');
  const cancels = firedWork(target);
  const fired = cancels.length > 0;
  return {
    requirement: fired ? 'FR-H4' : target.kind === 'line' ? 'FR-H2' : 'FR-H3',
    approval: fired,
    reason: fired,
    audited: fired || target.kind === 'order',
    cancels,
  };
}

/**
 * A reason the sheet offers. `label` is how the sheet lists it; `inline` is
 * the same words in running text, as the approval prompt sets them
 * ("… — reason: customer changed their mind"). Both are written down rather
 * than derived: lower-casing a string mangles names and acronyms.
 */
export type VoidReason = { id: string; label: string; inline: string };

/** What the cashier has chosen: one of the offered reasons, or their own words. */
export type ReasonChoice = { kind: 'listed'; reason: VoidReason } | { kind: 'other'; text: string };

/**
 * The reason a choice gives, or undefined if it gives none. A typed reason is
 * the cashier's own words, trimmed and otherwise untouched; typed and empty,
 * or only spaces, it is not a reason (FR-H4).
 */
export function givenReason(choice: ReasonChoice | undefined): string | undefined {
  if (!choice) return undefined;
  if (choice.kind === 'listed') return choice.reason.inline;
  const text = choice.text.trim();
  return text === '' ? undefined : text;
}
