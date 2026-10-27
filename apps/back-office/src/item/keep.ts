import { identity, touched, type OptionKind, type Row } from './options.js';

// Keep my changes over the child rows (PHASE1-S4c2b ruling 10; DESIGN-020 round 2, F1 to F4, and
// the lead's ruling 4 of its handover; DESIGN.md, "The stale-draft refusal over a form with child
// rows"). One principle, a lead-ruled exception to DESIGN-018's "nothing is merged" for child
// rows only: a row the draft touched keeps the draft's values, whole; a row it did not touch
// follows the current item. Nothing is merged field by field inside a row. Both uses below ask
// `touched`, the one helper, so a position that shifted when an earlier row came or went is never
// mistaken for a change.

/** A changed row the current item no longer has: said before the choice, as DESIGN-020's 4(b). */
export interface Lost {
  kind: OptionKind;
  /** The name the row was saved under. */
  saved: string;
  /** The name the draft gives it. */
  name: string;
}

/**
 * The draft's touched, not-removed saved rows that the current item no longer holds. A row the
 * draft removes, or never touched, is not listed: the current item and the draft agree it goes.
 */
export function lostRows(original: readonly Row[], draft: readonly Row[], current: readonly Row[], kind: OptionKind): Lost[] {
  return draft.flatMap((row) => {
    const old = row.id === null ? undefined : original.find((x) => x.id === row.id);
    if (old === undefined || row.removed || current.some((c) => c.id === row.id) || !touched(row, original, kind)) return [];
    return [{ kind, saved: old.name, name: row.name.trim() }];
  });
}

/**
 * DESIGN-020's sentence, placed before *Choose which to keep.*: what each choice does to the
 * changed rows removed meanwhile. "named …" is omitted when the name is unchanged.
 */
export function lostSentence(lost: readonly Lost[]): string {
  if (lost.length === 0) return '';
  const one = lost.length === 1;
  const kinds = [...new Set(lost.map((r) => r.kind))];
  const said = lost.map((r) => `${r.kind} ${r.saved}`);
  const names = said.length === 1 ? said[0]! : `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]!}`;
  const added = one
    ? `a new ${lost[0]!.kind}${lost[0]!.name !== lost[0]!.saved ? ` named ${lost[0]!.name}` : ''}`
    : `new ${kinds.map((k) => `${k}s`).join(' and ')}`;
  const it = one ? 'it' : 'them';
  return ` The current item no longer has ${names}, which your draft changes. Keep my changes adds ${it} back as ${added}; Use current item leaves ${it} out.`;
}

/**
 * One list after Keep my changes. `original` is what the draft opened from, `draft` its rows and
 * `current` the item just read (its rows grouped for a draft, as `rowsOf(…, true)` gives them).
 *
 * - An untouched row takes the current values, and leaves if the current item no longer has it.
 * - A touched row that still exists keeps all the draft's values.
 * - A pending-removal row stays pending if it still exists, and leaves if it is gone.
 * - A touched row that is gone comes back as a new row: a fresh key, its draft values, no old id.
 * - A new row stays new. Rows the current item added are appended.
 * - Order: if the draft moved no row, the current order, the draft's new rows last in the order
 *   they were added; if it moved any, the draft's order, the current item's new rows last. A
 *   pending-removal row keeps its place either way.
 */
export function keepRows(
  kind: OptionKind,
  original: readonly Row[],
  draft: readonly Row[],
  current: readonly Row[],
  freshKey: () => string
): Row[] {
  const kept = draft.flatMap((row): Row[] => {
    if (row.id === null) return [row];
    const live = current.find((c) => c.id === row.id);
    if (!touched(row, original, kind)) return live === undefined ? [] : [live];
    if (live !== undefined) return [row];
    if (row.removed) return [];
    return [{ ...row, id: null, key: freshKey() }];
  });
  const added = current.filter((c) => !original.some((o) => o.id === c.id));
  // The draft moved a row: its order for the rows it holds, the current item's new rows last.
  if (draft.some((r) => r.moved)) return [...kept, ...added];
  // Otherwise the current order (a pending-removal row keeps its place), then the draft's new rows.
  const at = (row: Row): number => current.findIndex((c) => identity(c) === identity(row));
  const inCurrent = [...kept.filter((r) => at(r) >= 0), ...added].sort((a, b) => at(a) - at(b));
  return [...inCurrent, ...kept.filter((r) => at(r) < 0)];
}
