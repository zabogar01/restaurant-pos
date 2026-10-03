import { voidRule } from './void.js';

// FE-036: the void, as two pure operations. A STAND-IN for the server's two void
// commands, the fired-line void and the whole-order void (ARCHITECTURE sections
// 6.1 and 13): it runs in memory and is lost on reload. It leaves out PIN
// verification, the actor, the approver, the idempotency key, the expected order
// version, the lease, the business-day lock, the audit entry, the cancellation
// ticket and its print, and a persisted VOIDED state. When the server's commands
// exist this module is deleted, not kept as a fallback.
//
// Pure: no clock, no component, no fixture. It is handed the order and the
// place's facts, asks `voidRule` (void.ts) what the target needs, decides the
// manager gate and the reason itself (FR-H3, FR-H4) and answers a value rather
// than throwing. The reason is checked and dropped: nothing here keeps it.

/** How the request reached the operation. Required, with no default: only the manager prompt's submit passes `'manager-prompt'`. */
export type VoidThrough = 'direct' | 'manager-prompt';

/** Checked in this order; the first that holds is the answer. `unknown-line` and `not-fired` belong to the line void only. */
export type VoidRefusal = 'not-open' | 'locked' | 'unknown-line' | 'not-fired' | 'no-reason' | 'needs-manager';

/** What the operation is told about the order's place, read by the caller at the moment of the call. */
export type VoidFacts = {
  /** The order is neither closed, refunded nor voided, and there is one. */
  open: boolean;
  /** An active payment session on this order, or a lock, draft or lease on the place (FR-G12, FR-G13). */
  locked: boolean;
};

type Line = { id: string; status: 'pending' | 'fired' | 'voided' };

/** What a void reads and writes. Anything else an order carries passes through untouched. */
export type VoidCarrier = {
  groups: ReadonlyArray<{ lines: ReadonlyArray<Line> }>;
  voided?: { voidedAt: string };
};

/**
 * A refusal returns the very order it was given, so identity says nothing
 * changed (B-20). `cancels` are the ids of the FIRED lines the void cancelled:
 * a fact for the caller, stored nowhere (B-15, B-16).
 */
export type VoidResult<T> =
  | { refused: VoidRefusal; order: T }
  | { refused?: undefined; order: T; cancels: ReadonlyArray<string> };

/** The gate and the reason, decided on the target as the order holds it now. */
function gateRefusal(
  rule: { approval: boolean; reason: boolean },
  reason: string | undefined,
  through: VoidThrough
): VoidRefusal | undefined {
  if (rule.reason && (reason ?? '').trim() === '') return 'no-reason';
  if (rule.approval && through !== 'manager-prompt') return 'needs-manager';
  return undefined;
}

/** Voids one FIRED line, in place: its status becomes `voided` and nothing else about it, or its round, changes. */
export function voidLine<T extends VoidCarrier>(
  order: T,
  lineId: string,
  reason: string | undefined,
  through: VoidThrough,
  facts: VoidFacts
): VoidResult<T> {
  const refuse = (refused: VoidRefusal): VoidResult<T> => ({ refused, order });
  if (!facts.open) return refuse('not-open');
  if (facts.locked) return refuse('locked');
  const line = order.groups.flatMap((g) => g.lines).find((l) => l.id === lineId);
  if (!line) return refuse('unknown-line');
  // Before voidRule, which throws on a voided line. A PENDING line leaves by its
  // row's remove control (FR-H2); the void never quietly removes it.
  if (line.status !== 'fired') return refuse('not-fired');
  const rule = voidRule({ kind: 'line', line });
  const refused = gateRefusal(rule, reason, through);
  if (refused) return refuse(refused);

  const groups = order.groups.map((g) =>
    g.lines.some((l) => l.id === lineId) ? { ...g, lines: g.lines.map((l) => (l.id === lineId ? { ...l, status: 'voided' } : l)) } : g
  );
  return { order: { ...order, groups } as T, cancels: rule.cancels.map((l) => l.id) };
}

/** Voids the whole order: `voided` is set once, and the lines and the discount are left as they are. */
export function voidOrder<T extends VoidCarrier>(
  order: T,
  reason: string | undefined,
  through: VoidThrough,
  voidedAt: string,
  facts: VoidFacts
): VoidResult<T> {
  const refuse = (refused: VoidRefusal): VoidResult<T> => ({ refused, order });
  if (!facts.open) return refuse('not-open');
  if (facts.locked) return refuse('locked');
  const rule = voidRule({ kind: 'order', lines: order.groups.flatMap((g) => g.lines) });
  const refused = gateRefusal(rule, reason, through);
  if (refused) return refuse(refused);
  return { order: { ...order, voided: { voidedAt } }, cancels: rule.cancels.map((l) => l.id) };
}
