const MIN_PEPPER_LENGTH = 32;

/**
 * The key of the PIN lookup digest. Read from the environment on every call, so
 * importing this module never fails and a rotated value is never cached. Unset
 * or short is an error, never a default; the message names the variable and
 * never carries its value.
 */
export function pinPepper(): string {
  const value = process.env.PIN_PEPPER;
  if (!value) {
    throw new Error('PIN_PEPPER is not set; refusing to derive a PIN lookup without it');
  }
  if (value.length < MIN_PEPPER_LENGTH) {
    throw new Error(`PIN_PEPPER must be at least ${MIN_PEPPER_LENGTH} characters`);
  }
  return value;
}
