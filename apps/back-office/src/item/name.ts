import type { NameError } from '../menu/name.js';
import type { Row } from './options.js';

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

// A variant's or a modifier's name (PHASE1-S4c2b ruling 3): the same shape at 32 code points, a
// test holds it and `OptionName` in agreement. Uniqueness is local, among the list's active rows,
// by `toLowerCase()` over the trimmed names to match the server's `lower(name)` index. It is not
// BO-03's collator, which folds accents the index does not: that would refuse names the server
// accepts.

export const OPTION_NAME_LIMIT = 32;

export function checkOptionName(typed: string): { name: string; error: NameError | null } {
  const name = typed.trim();
  const length = [...name].length;
  if (length === 0) return { name, error: 'empty' };
  if (length > OPTION_NAME_LIMIT) return { name, error: 'long' };
  if (/\p{Cc}/u.test(name)) return { name, error: 'control' };
  return { name, error: null };
}

/**
 * The keys of the rows that repeat an earlier row's name, in list order: the refusal sits on the
 * later row. A row pending removal neither holds a name nor is refused, and an empty name holds
 * nothing (it has its own refusal).
 */
export function duplicateKeys(rows: readonly Row[]): string[] {
  const seen = new Set<string>();
  const later: string[] = [];
  for (const row of rows) {
    if (row.removed) continue;
    const name = row.name.trim().toLowerCase();
    if (name === '') continue;
    if (seen.has(name)) later.push(row.key);
    else seen.add(name);
  }
  return later;
}
