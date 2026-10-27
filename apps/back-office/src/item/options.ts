import type { ItemView } from '@pos/contracts';
import { priceText } from '../menu/money.js';
import { checkPrice } from './price.js';

// BO-04's two option lists, the pure half (PHASE1-S4c2b rulings 2 and 8; DESIGN-020, "Options").
// A variant (single-select, a signed change) and a modifier (multi-select, a change of zero or
// more) are two lists with one row shape. A row is the draft's own thing: `id` is the saved
// option's id or null for a new one, `key` is the client's name for it (the id of a saved row, a
// counter for a new one; never visible text), `change` is as typed in a draft and canonical in
// `original`, `removed` marks a saved row pending removal, and `moved` is set on the row whose
// Move up or Move down was pressed, and only on that row (DESIGN-020 round 2, F1).

export type OptionKind = 'variant' | 'modifier';
export type ListKey = 'variants' | 'modifiers';

export interface Row {
  id: string | null;
  key: string;
  name: string;
  change: string;
  removed: boolean;
  moved: boolean;
}

export const KINDS: readonly OptionKind[] = ['variant', 'modifier'];
export const listKey = (kind: OptionKind): ListKey => (kind === 'variant' ? 'variants' : 'modifiers');

/** What a row is called to the server and to the other rows: its saved id, or the key of a new row. */
export const identity = (row: Row): string => row.id ?? row.key;

/** A change as the form compares it: canonical when it is a price, otherwise exactly as typed. */
export const changeKey = (typed: string, kind: OptionKind): string => {
  const checked = checkPrice(typed, kind);
  return checked.error === null ? checked.value : typed;
};

/**
 * The item's active options of one kind in stored display order. An inactive option is history and
 * is never shown or sent. `display` groups the change for a draft; `original` keeps it canonical.
 */
export function rowsOf(item: ItemView, kind: OptionKind, display: boolean): Row[] {
  const source =
    kind === 'variant'
      ? item.variants.map((o) => ({ id: o.variantId, name: o.name, change: o.priceDelta, order: o.displayOrder, active: o.isActive }))
      : item.modifiers.map((o) => ({ id: o.modifierId, name: o.name, change: o.priceDelta, order: o.displayOrder, active: o.isActive }));
  return source
    .filter((o) => o.active)
    .sort((a, b) => a.order - b.order)
    .map((o) => ({
      id: o.id,
      key: o.id,
      name: o.name,
      change: display ? priceText(o.change) : o.change,
      removed: false,
      moved: false,
    }));
}

/**
 * Whether the draft touched a row, which is the one question Keep my changes and the removed-option
 * sentence both ask (DESIGN-020 round 2, F1): the row is new, is pending removal, has a trimmed
 * name or a canonical change that differs from `before`, or had Move pressed on it. A position that
 * shifted because an earlier row came or went is never a touch.
 */
export function touched(row: Row, before: readonly Row[], kind: OptionKind): boolean {
  const old = row.id === null ? undefined : before.find((x) => x.id === row.id);
  return (
    old === undefined ||
    row.removed ||
    row.moved ||
    old.name !== row.name.trim() ||
    old.change !== changeKey(row.change, kind)
  );
}

/** The values a list holds, for comparing a draft with what it opened from: flags that are not values are left out. */
export const plainRows = (rows: readonly Row[], kind: OptionKind): Array<[string, string, string, boolean]> =>
  rows.map((r) => [identity(r), r.name.trim(), changeKey(r.change, kind), r.removed]);

/** The id of an element of one option row, or of a list's Add: the screen and its focus requests share it. */
export const optionId = (kind: OptionKind, key: string | null, part: string): string =>
  part === 'add' ? `add-${kind}` : `${kind}-${key ?? ''}-${part}`;
