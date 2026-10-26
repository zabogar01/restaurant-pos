import type { CategoryView, ItemView } from '@pos/contracts';

// BO-03's grouping and order, the pure half (DESIGN-019, "Grouping and row order"). Active
// categories come first, then archived ones; within a category, active items come before
// archived ones. Each set is in stored display order, ties broken by name with BO-05's
// collator (natural, case-insensitive), then by id. Every category and item stays visible.

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Stored order, then name, then id: the order inside one set. */
function byOrder<T extends { displayOrder: number; name: string }>(a: T, b: T, idA: string, idB: string): number {
  return a.displayOrder - b.displayOrder || collator.compare(a.name, b.name) || byId(idA, idB);
}

const activeFirst = (a: boolean, b: boolean): number => (a === b ? 0 : a ? -1 : 1);

export function orderedCategories(categories: readonly CategoryView[]): CategoryView[] {
  return [...categories].sort(
    (a, b) => activeFirst(a.isActive, b.isActive) || byOrder(a, b, a.categoryId, b.categoryId)
  );
}

export function orderedItems(items: readonly ItemView[]): ItemView[] {
  return [...items].sort((a, b) => activeFirst(a.isActive, b.isActive) || byOrder(a, b, a.itemId, b.itemId));
}

export interface Group {
  category: CategoryView;
  items: ItemView[];
}

/** The table's groups: every category in order, each with every item that belongs to it. */
export function groups(categories: readonly CategoryView[], items: readonly ItemView[]): Group[] {
  return orderedCategories(categories).map((category) => ({
    category,
    items: orderedItems(items.filter((item) => item.categoryId === category.categoryId)),
  }));
}

/** The reorder scope of the categories: the active ones, in stored order. Archived ones stay outside. */
export function scopeOfCategories(categories: readonly CategoryView[]): string[] {
  return categories
    .filter((c) => c.isActive)
    .sort((a, b) => byOrder(a, b, a.categoryId, b.categoryId))
    .map((c) => c.categoryId);
}

/** The reorder scope of one category's items: its active ones, in stored order. */
export function activeItemScope(items: readonly ItemView[], categoryId: string): string[] {
  return items
    .filter((i) => i.categoryId === categoryId && i.isActive)
    .sort((a, b) => byOrder(a, b, a.itemId, b.itemId))
    .map((i) => i.itemId);
}

/** Why the POS does not show an item: its category first, when both are archived. */
export function hiddenReason(item: ItemView, category: CategoryView | undefined): 'category' | 'item' | null {
  if (category !== undefined && !category.isActive) return 'category';
  return item.isActive ? null : 'item';
}

/** Whether two names are one name to the manager: the sort's collator, accents and case set aside. */
export const sameName = (a: string, b: string): boolean => collator.compare(a, b) === 0;
