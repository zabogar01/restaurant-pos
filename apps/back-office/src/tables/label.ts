// The table form's own check of the label (DESIGN-017, `D` Validation and refusal): the
// value is trimmed, then refused if empty, over 32 UTF-16 units, or holding a control
// character (Unicode Cc), in that order. Nothing is truncated. The contract's `TableLabel`
// says the same in the other direction; a test holds the two in agreement, and
// `fieldsInError` is the gate before the core is called.

export type LabelError = 'empty' | 'long' | 'control';

export const LABEL_LIMIT = 32;

export function checkLabel(typed: string): { label: string; error: LabelError | null } {
  const label = typed.trim();
  if (label.length === 0) return { label, error: 'empty' };
  if (label.length > LABEL_LIMIT) return { label, error: 'long' };
  if (/\p{Cc}/u.test(label)) return { label, error: 'control' };
  return { label, error: null };
}
