import type { LineStatus } from './orderFixtures.js';

// The fire rules the POS draws from (FR-E1, FR-E4, B-17). Pure: no component,
// no fixture, no state. The panel asks this module; it never decides for
// itself whether a fire is refused.
//
// The module exists for the reason discount.ts and void.ts exist. A refusal
// drawn per state is correct only in the state the artifact happens to draw,
// and FR-E4 is a rule about what the order holds: "firing is blocked while any
// PENDING line holds an item that is 86'd, **until that line is voided or the
// item is restored**". A component that read a per-state flag would keep
// refusing the fire after the cashier removed the offending line, which is the
// half of the requirement nobody draws.

/** The close bar's fire control, named here as the discount and void actions are named by theirs. */
export const FIRE_ACTION = 'fire';

/** A line as this module reads it: its status, and the item it is for, if it has one. */
export type FireLine = { status: LineStatus; itemId?: string; name: string };

/**
 * Whether one line blocks the fire: it is PENDING and it holds an item that is
 * 86'd. This is the same fact the panel tags the line's name with, so the tag
 * and the refusal can never disagree.
 *
 * **A FIRED line never qualifies.** The item's availability has nothing to do
 * with work already in the kitchen — that work is cooked or cooking — and
 * FR-E2/B-16 mean a fire would not re-send it in any case. A VOIDED line is
 * not on the order any more.
 *
 * A line with no `itemId` can never block: not every line has a tile
 * (`overflow` holds a Cheesecake the grid does not sell), and an item nobody
 * can identify is not an item anybody has 86'd.
 */
export function holdsUnavailable<L extends FireLine>(line: L, unavailable: ReadonlyArray<string>): boolean {
  return line.status === 'pending' && line.itemId !== undefined && unavailable.includes(line.itemId);
}

/**
 * The lines a fire would send: every `PENDING` line, and only those.
 *
 * `FR-E1` has a fire collect *every* PENDING line; `FR-E2` and `B-16` send only
 * lines not previously fired. **So an order with no PENDING line has nothing a
 * fire could send**, and SCREEN-INVENTORY's *Must not invent* for POS-03 is
 * explicit about what a control offering to send it again would be: *"No
 * 'reprint the whole order to kitchen' control. Ever."*
 *
 * This is the same question as the block — what this order can send — which is
 * why it lives here rather than in the panel. It reads the same lines, and the
 * panel draws the control unavailable on either answer.
 *
 * The two differ in what they owe the cashier. A block is a **refusal** and
 * names its reason in a notice; an order with nothing pending is simply not
 * fireable yet, needs no explanation, and becomes fireable the moment a line is
 * added — so the control is drawn **inert in place, never absent** (ruling
 * C-1's distinction, as `empty` and `fireblocked` already draw it).
 *
 * It matters most in `fireerror`: a live *Send to kitchen* directly under a
 * banner saying the ticket did not print reads as *send it again*, and the real
 * reprint is POS-07's action (`FR-E3`), not this control.
 */
export function sendableLines<L extends FireLine>(lines: ReadonlyArray<L>): ReadonlyArray<L> {
  return lines.filter((line) => line.status === 'pending');
}

/** The PENDING lines that refuse the fire (FR-E4). Empty means the fire is available. */
export function blockingLines<L extends FireLine>(
  lines: ReadonlyArray<L>,
  unavailable: ReadonlyArray<string>
): ReadonlyArray<L> {
  return lines.filter((line) => holdsUnavailable(line, unavailable));
}

/**
 * The refusal as the panel prints it, in the artifact's three parts: a title, a
 * sentence that ends at the names, the names themselves (the artifact bolds
 * them), and the way out of it.
 *
 * Undefined when nothing blocks, which is the panel's whole test for whether
 * to draw the notice and whether *Send to kitchen* is available.
 */
export type FireRefusal = {
  title: string;
  /** "1 pending line is no longer available:" */
  lead: string;
  /** The blocking lines' names, in order. Drawn bold, as the artifact draws them. */
  names: ReadonlyArray<string>;
  /** "Void that line or ask a manager to put the item back on." */
  resolution: string;
};

export const FIRE_REFUSAL_TITLE = 'Cannot send to the kitchen';

/**
 * The artifact draws this notice with exactly one blocking line, so the
 * singular below is its own copy, word for word:
 *
 *   "1 pending line is no longer available: **Steak**.
 *    Void that line or ask a manager to put the item back on."
 *
 * The count and the name are read off the order rather than written down, so
 * the notice cannot outlive the line it names.
 *
 * **PROVISIONAL COPY — the plural.** No reviewed state has two blocking lines,
 * so the plural forms and the way several names are joined have no reviewed
 * wording. They follow the artifact's sentence exactly and change only what
 * English forces. Flagged in the FE-011 handoff; a designer owns the real copy.
 */
export function fireRefusal(blocking: ReadonlyArray<{ name: string }>): FireRefusal | undefined {
  if (blocking.length === 0) return undefined;
  const one = blocking.length === 1;
  return {
    title: FIRE_REFUSAL_TITLE,
    lead: `${blocking.length} pending line${one ? '' : 's'} ${one ? 'is' : 'are'} no longer available:`,
    names: blocking.map((l) => l.name),
    resolution: one
      ? 'Void that line or ask a manager to put the item back on.'
      : 'Void those lines or ask a manager to put the items back on.',
  };
}
