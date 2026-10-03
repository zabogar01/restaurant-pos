import { RATE_SCALE, rateFromPercent } from '@pos/money';
import {
  FREE_FORM_NAME,
  needsManager,
  snapshotOf,
  type DiscountSnapshot,
  type DiscountValue,
  type Preset,
} from './discount.js';

// FE-035: the discount change, as one pure operation. A STAND-IN for the
// server's apply, replace and remove discount command (ARCHITECTURE section 13):
// it runs in memory and is lost on reload. It leaves out PIN verification, the
// actor, the approver, the expected order version, the catalog version, the
// lease, the audit entry and a persisted OrderDiscount. When the server command
// exists this module is deleted, not kept as a fallback.
//
// Pure: no clock, no component, no fixture. It is handed the order's facts and
// the preset list, decides the manager gate itself (FR-F8) and answers a value
// rather than throwing. Every figure on screen still comes from discount.ts.

/** What a caller may ask for. Never a snapshot: the name, the value of a preset and the `source` are this module's to set (B-8). */
export type DiscountChange =
  | { kind: 'preset'; presetId: string }
  | { kind: 'free-form'; value: DiscountValue }
  | { kind: 'remove' };

/** How the request reached the operation. Required, with no default: only the manager prompt's submit passes `'manager-prompt'`. */
export type DiscountThrough = 'direct' | 'manager-prompt';

/** Checked in this order; the first that holds is the answer. */
export type DiscountRefusal = 'closed' | 'locked' | 'nothing-to-remove' | 'unknown-preset' | 'invalid-value' | 'needs-manager';

/** What the operation is told about the order's place, read by the caller at the moment of the call. */
export type DiscountFacts = {
  closed: boolean;
  /** An active payment session on this order, or a lock, draft or lease on the place (FR-G12, FR-G13). */
  locked: boolean;
  /** The presets as the back office holds them now; a deactivated one is not applied (FR-F5). */
  presets: ReadonlyArray<Preset>;
};

/** The two fields a discount change writes. Anything else an order carries passes through untouched. */
export type DiscountCarrier = { applied?: DiscountSnapshot; appliedNote?: string };

/** A refusal returns the very order it was given, so identity says nothing changed (B-20). */
export type DiscountResult<T> = { refused: DiscountRefusal; order: T } | { refused?: undefined; order: T };

/** The snapshot a request would write, or undefined for a removal or a preset that is unknown or not active (FR-F5). */
export function snapshotFor(change: DiscountChange, presets: ReadonlyArray<Preset>): DiscountSnapshot | undefined {
  if (change.kind === 'remove') return undefined;
  if (change.kind === 'free-form') return { source: 'free-form', name: FREE_FORM_NAME, value: change.value };
  const preset = presets.find((p) => p.id === change.presetId);
  return preset?.active ? snapshotOf(preset) : undefined;
}

/**
 * A percent the money package parses and that is at most 100%; a fixed amount
 * that is not negative. A fixed amount above the subtotal is valid: it applies
 * and `discountAmount` caps it (FR-M5). An invalid value written to the order
 * would make every later total throw.
 */
function valid(value: DiscountValue): boolean {
  if (value.kind === 'fixed') return value.amount >= 0n;
  try {
    return rateFromPercent(value.percent) <= RATE_SCALE;
  } catch {
    return false;
  }
}

export function changeDiscount<T extends DiscountCarrier>(
  order: T,
  change: DiscountChange,
  through: DiscountThrough,
  facts: DiscountFacts
): DiscountResult<T> {
  const refuse = (refused: DiscountRefusal): DiscountResult<T> => ({ refused, order });
  if (facts.closed) return refuse('closed');
  if (facts.locked) return refuse('locked');
  // Before needsManager, which throws on a removal with nothing applied.
  if (change.kind === 'remove' && !order.applied) return refuse('nothing-to-remove');
  const snapshot = snapshotFor(change, facts.presets);
  if (change.kind === 'preset' && !snapshot) return refuse('unknown-preset');
  // A preset's value is an input fact too, and is not trusted to be valid.
  if (snapshot && !valid(snapshot.value)) return refuse('invalid-value');
  // The gate is decided on the order about to be written, never on the sheet.
  const gated = needsManager(order.applied, change.kind === 'remove' ? 'remove' : { source: change.kind });
  if (gated && through !== 'manager-prompt') return refuse('needs-manager');

  // All or nothing: the discount and its note are written together. A
  // discount made in this session has no note; the change sheet draws the gap.
  const { applied: _applied, appliedNote: _note, ...rest } = order;
  return { order: { ...rest, ...(snapshot && { applied: snapshot }) } as T };
}
