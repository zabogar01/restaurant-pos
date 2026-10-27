import type { NameError } from '../menu/name.js';

// BO-04's item name, the pure half (DESIGN-020, "Names"; PHASE1-S4c2a ruling 6): the value is
// trimmed, then refused if empty, over 64 code points, or holding a control character (Unicode
// Cc), in that order. Lengths count code points, as the contract's `max` does and PostgreSQL's
// `char_length` does. Nothing is truncated. A test holds this and `ItemName` in agreement.
// Uniqueness is the server's.

export const ITEM_NAME_LIMIT = 64;

export function checkItemName(typed: string): { name: string; error: NameError | null } {
  const name = typed.trim();
  const length = [...name].length;
  if (length === 0) return { name, error: 'empty' };
  if (length > ITEM_NAME_LIMIT) return { name, error: 'long' };
  if (/\p{Cc}/u.test(name)) return { name, error: 'control' };
  return { name, error: null };
}
