// BO-03's category name, the pure half (DESIGN-019, "Category names"): the value is trimmed,
// then refused if empty, over 32 code points, or holding a control character (Unicode Cc), in
// that order. Lengths count code points, as the contract's `max` does and PostgreSQL's
// `char_length` does. Nothing is truncated. A test holds this and `CategoryName` in agreement.
// Uniqueness is the server's.

export type NameError = 'empty' | 'long' | 'control';

export const NAME_LIMIT = 32;

export function checkCategoryName(typed: string): { name: string; error: NameError | null } {
  const name = typed.trim();
  const length = [...name].length;
  if (length === 0) return { name, error: 'empty' };
  if (length > NAME_LIMIT) return { name, error: 'long' };
  if (/\p{Cc}/u.test(name)) return { name, error: 'control' };
  return { name, error: null };
}
