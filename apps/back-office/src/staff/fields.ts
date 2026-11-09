// The four field checks of BO-06's create form (PHASE1-S8c1 ruling 4, DESIGN-023 "Rules for
// S8c"). Each is a pure function of what was typed, and each refuses in the copy table's order.
// Every length is in code points (`[...value].length`), never UTF-16 units. A check here is the
// form's own: the contract schemas of `@pos/contracts` are what the server enforces, and a test
// holds the two together over the boundary values.
//
// A credential is passed in only to be checked, at the moment of submit. Nothing here keeps one.

export type NameError = 'empty' | 'long' | 'control';

/** The name as it is sent: trimmed. `error` is the first refusal in the copy table's order. */
export function checkName(typed: string): { name: string; error: NameError | null } {
  const name = typed.trim();
  if (name === '') return { name, error: 'empty' };
  if ([...name].length > 64) return { name, error: 'long' };
  if (/\p{Cc}/u.test(name)) return { name, error: 'control' };
  return { name, error: null };
}

/** A PIN is exactly six ASCII digits: no trimming, no truncation, no numeric conversion. */
export function checkPin(typed: string): 'invalid' | null {
  return /^[0-9]{6}$/.test(typed) ? null : 'invalid';
}

/**
 * The username in its stored form: trimmed, and ASCII letters lower-cased (nothing else changes
 * case). This is what the field shows on blur and on submit, and what the request carries.
 */
export function storedUsername(typed: string): string {
  return typed.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function checkUsername(typed: string): { username: string; error: 'invalid' | null } {
  const username = storedUsername(typed);
  return { username, error: /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) ? null : 'invalid' };
}

/** A new password is 8 to 128 code points and is never trimmed. */
export function checkPassword(typed: string): 'invalid' | null {
  const length = [...typed].length;
  return length >= 8 && length <= 128 ? null : 'invalid';
}
