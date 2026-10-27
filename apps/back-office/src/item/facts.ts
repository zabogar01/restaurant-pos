import type { CategoryView, ItemView } from '@pos/contracts';
import {
  ARCHIVED_PREFIX,
  AVAILABLE,
  CONTEXT_ARCHIVED,
  CONTEXT_CATEGORY_ARCHIVED,
  CONTEXT_EIGHTYSIX,
  CONTEXT_ORDINARY,
  HIDDEN_FROM_POS,
  UNAVAILABLE,
} from './copy.js';

// BO-04's status and context, the pure half (DESIGN-020 round 2, F5; PHASE1-S4c2a ruling 17).
// Availability and archive status are facts here; changing them is Menu's.

/** `[Archived item · ]Available` or `[Archived item · ]86 · Unavailable`, as the comparison also reads it. */
export const itemFacts = (item: ItemView): string =>
  `${item.isActive ? '' : ARCHIVED_PREFIX}${item.isAvailable ? AVAILABLE : UNAVAILABLE}`;

/** The stored item's status, then ` · Hidden from the POS · category archived` when its category is archived. */
export function statusText(item: ItemView, category: CategoryView | undefined): string {
  return `${itemFacts(item)}${category !== undefined && !category.isActive ? HIDDEN_FROM_POS : ''}`;
}

/**
 * The context paragraph: the first that applies of the archived-category sentence (an active item
 * in an archived category), the archived-item sentence, the 86'd sentence, and the ordinary one.
 */
export function contextText(item: ItemView | null, category: CategoryView | undefined): string {
  if (item === null) return CONTEXT_ORDINARY;
  if (item.isActive && category !== undefined && !category.isActive) return CONTEXT_CATEGORY_ARCHIVED;
  if (!item.isActive) return CONTEXT_ARCHIVED;
  if (!item.isAvailable) return CONTEXT_EIGHTYSIX;
  return CONTEXT_ORDINARY;
}
