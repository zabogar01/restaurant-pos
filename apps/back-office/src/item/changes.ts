import type { ItemChanges } from '@pos/contracts';
import { changeKey, identity, type OptionKind, type Row } from './options.js';

// What one BO-04 save carries (PHASE1-S4c2b ruling 7; DESIGN-020, "What one save carries"), as
// pure functions so a test can hold every body. Names are trimmed and changes canonical: the rows
// reaching here have passed the form's checks, and the caller's `fieldsInError` guard is the
// second look.
//
// A create sends both lists, the active rows in display order. An edit sends, per list and only
// when that list changed, `added` (new rows in order), `edited` (a saved row's id and only the
// trimmed name and canonical change that differ from what the draft opened from), `removed` (ids
// of saved rows pending removal) and `order` (every active row, whenever that order differs from
// the opening order, which includes any add or removal). An empty array is never sent; a list
// with no change has no key at all.

export type ListChanges = NonNullable<ItemChanges['variants']>;
export interface Lists {
  variants: readonly Row[];
  modifiers: readonly Row[];
}

const wire = (rows: readonly Row[], kind: OptionKind) =>
  rows.filter((r) => !r.removed).map((r) => ({ name: r.name.trim(), priceDelta: changeKey(r.change, kind) }));

/** A create's two lists: the active rows, in the order they stand. */
export const createLists = (draft: Lists) => ({
  variants: wire(draft.variants, 'variant'),
  modifiers: wire(draft.modifiers, 'modifier'),
});

/** One list's change, or null when the draft's list equals what it opened from. */
export function listChanges(original: readonly Row[], draft: readonly Row[], kind: OptionKind): ListChanges | null {
  const active = draft.filter((r) => !r.removed);
  const added = active
    .filter((r) => r.id === null)
    .map((r) => ({ key: r.key, name: r.name.trim(), priceDelta: changeKey(r.change, kind) }));
  const edited = active.flatMap((r) => {
    const old = r.id === null ? undefined : original.find((o) => o.id === r.id);
    if (r.id === null || old === undefined) return [];
    const name = r.name.trim();
    const priceDelta = changeKey(r.change, kind);
    const patch = {
      id: r.id,
      ...(name !== old.name ? { name } : {}),
      ...(priceDelta !== old.change ? { priceDelta } : {}),
    };
    return Object.keys(patch).length > 1 ? [patch] : [];
  });
  const removed = draft.flatMap((r) => (r.removed && r.id !== null ? [r.id] : []));
  const opening = original.map(identity);
  const finalOrder = active.map(identity);
  const reordered = finalOrder.length > 0 && finalOrder.join('\u0000') !== opening.join('\u0000');
  const changes: ListChanges = {
    ...(added.length > 0 ? { added } : {}),
    ...(edited.length > 0 ? { edited } : {}),
    ...(removed.length > 0 ? { removed } : {}),
    ...(reordered ? { order: active.map((r) => (r.id === null ? { key: r.key } : { id: r.id })) } : {}),
  };
  return Object.keys(changes).length === 0 ? null : changes;
}

/** An edit's `changes`: the item's changed fields, then each list that changed. `{}` when nothing did. */
export function editChanges(
  fields: NonNullable<ItemChanges['fields']>,
  original: Lists,
  draft: Lists
): ItemChanges {
  const variants = listChanges(original.variants, draft.variants, 'variant');
  const modifiers = listChanges(original.modifiers, draft.modifiers, 'modifier');
  return {
    ...(Object.keys(fields).length > 0 ? { fields } : {}),
    ...(variants === null ? {} : { variants }),
    ...(modifiers === null ? {} : { modifiers }),
  };
}
