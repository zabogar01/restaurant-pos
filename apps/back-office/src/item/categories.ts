import type { CategoryView } from '@pos/contracts';
import { orderedCategories } from '../menu/group.js';

// BO-04's category field, the pure half (PHASE1-S4c2a ruling 8; DESIGN-020's copy table, row
// *Category*). The options are every active category in BO-03's order, plus the draft's category
// and the stored item's category when archived; an archived one other than the stored item's is
// listed disabled, so it can be seen and not chosen.

export type CategoryFault = 'none' | 'archived';

export interface CategoryOption {
  categoryId: string;
  name: string;
  archived: boolean;
  disabled: boolean;
}

export function categoryOptions(
  categories: readonly CategoryView[],
  draftId: string,
  storedId: string | null
): CategoryOption[] {
  return orderedCategories(categories)
    .filter((c) => c.isActive || c.categoryId === draftId || c.categoryId === storedId)
    .map((c) => ({
      categoryId: c.categoryId,
      name: c.name,
      archived: !c.isActive,
      disabled: !c.isActive && c.categoryId !== storedId,
    }));
}

/**
 * None chosen is *Choose a category.*; an archived category is refused, except the stored item's
 * own on an edit, where the item may stay. A create has no stored category.
 */
export function checkCategory(
  categories: readonly CategoryView[],
  draftId: string,
  storedId: string | null
): CategoryFault | null {
  const chosen = categories.find((c) => c.categoryId === draftId);
  if (chosen === undefined) return 'none';
  if (!chosen.isActive && draftId !== storedId) return 'archived';
  return null;
}
