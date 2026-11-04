import type { ItemGroup } from '../sheetFixtures.js';
import { CHANGED_NOTICE, GONE_NOTICE, REMOVED_NOTICE, SERVED_GROUPS, UNAVAILABLE_NOTICE } from './menuCopy.js';
import type { CatalogItem, CatalogOption } from './types.js';

// M-2 over a served item (consult C4 items 7 and 8). Pure: the adapter that gives the item sheet its groups
// from the live item, and the rule by which an open sheet follows that item between polls. The component
// owns what the cashier chose and how many; this module owns what the item is and what changed about it.

/** The sheet's groups, built from the item as it is now: at most two, in the fixed order, and none for an empty list. */
export function groupsOf(item: CatalogItem): ReadonlyArray<ItemGroup> {
  const groups: ItemGroup[] = [];
  if (item.variants.length > 0) groups.push({ ...SERVED_GROUPS.variant, many: false, options: item.variants });
  if (item.modifiers.length > 0) groups.push({ ...SERVED_GROUPS.modifiers, many: true, options: item.modifiers });
  return groups;
}

/** What the cashier has chosen, by group id and option id. Option ids only: a line snapshots names and deltas, not ids. */
export type Picked = Readonly<Record<string, ReadonlyArray<string>>>;

/** An item's options in the order the sheet draws them. */
const optionsOf = (item: CatalogItem): ReadonlyArray<CatalogOption> => [...item.variants, ...item.modifiers];

/** The chosen ids that are still options of the item, so a removed option leaves the choices and cannot return selected. */
export function prune(picked: Picked, item: CatalogItem): Picked {
  const alive = new Set(optionsOf(item).map((o) => o.id));
  return Object.fromEntries(Object.entries(picked).map(([group, ids]) => [group, ids.filter((id) => alive.has(id))]));
}

/**
 * What the open sheet remembers about the item it follows. `known` is the last-known item: the live one while
 * the item is on the menu, and the last one seen after it leaves the projection. `changed` and `removed` are
 * sticky: the notice stays until the sheet closes, whatever the item does next (C4 item 8).
 */
export type Follow = {
  known: CatalogItem;
  changed: boolean;
  /** The names of chosen options that were removed, in the order they went. */
  removed: ReadonlyArray<string>;
};

export const startFollowing = (opened: CatalogItem): Follow => ({ known: opened, changed: false, removed: [] });

/** Whether anything the cashier is shown, and priced from, is different: a name, the price, an option's name or delta. */
function differs(was: CatalogItem, now: CatalogItem): boolean {
  if (was.name !== now.name || was.price !== now.price) return true;
  const after = new Map(optionsOf(now).map((o) => [o.id, o]));
  // Only an option present in both can have *changed*; one added or removed, or the order, is not a change here.
  return optionsOf(was).some((o) => {
    const next = after.get(o.id);
    return next !== undefined && (next.name !== o.name || next.delta !== o.delta);
  });
}

/**
 * The sheet's memory after a poll. An item absent from the projection (`live` undefined) changes nothing: the
 * sheet keeps the last-known details. An item present is compared with the last-known one, and a difference
 * raises the one notice. A *chosen* option that is gone is named in it; an unchosen one going, an option being
 * added and a reorder raise nothing. Availability is not a change of the item and is read from `live` directly.
 */
export function follow(was: Follow, live: CatalogItem | undefined, picked: Picked): Follow {
  if (live === undefined || live === was.known) return was;
  const chosen = new Set(Object.values(picked).flat());
  const now = new Set(optionsOf(live).map((o) => o.id));
  const gone = optionsOf(was.known)
    .filter((o) => chosen.has(o.id) && !now.has(o.id))
    .map((o) => o.name);
  return {
    known: live,
    changed: was.changed || gone.length > 0 || differs(was.known, live),
    removed: [...was.removed, ...gone],
  };
}

/**
 * The one notice, or nothing. The availability sentence comes first, then the change sentence, so an 86 and a
 * price change arriving together are one notice, and a restoration removes only the availability part.
 */
export function noticeOf(f: Follow, availability: 'available' | 'unavailable' | 'gone'): string {
  const parts: string[] = [];
  if (availability === 'gone') parts.push(GONE_NOTICE(f.known.name));
  else if (availability === 'unavailable') parts.push(UNAVAILABLE_NOTICE(f.known.name));
  if (f.changed) parts.push(f.removed.length > 0 ? REMOVED_NOTICE(f.removed) : CHANGED_NOTICE);
  return parts.join(' ');
}
