import { priceText } from '../menu/money.js';

// BO-04's price input, the pure half (DESIGN.md, "The money input"; PHASE1-S4c2a ruling 7). One
// function serves all three field kinds: a base price, a variant's price change and a modifier's
// price change. The manager types whole rupiah. Everything here is exact on strings and BigInt,
// never through a double (B-1): the value crosses the API as a canonical integer string, and a
// test scans this folder for floating point. A test holds this and the contract's three price
// schemas in agreement on every accepted input and every bound.

export type PriceKind = 'base' | 'variant' | 'modifier';
export type PriceError = 'empty' | 'negative' | 'format' | 'bounds';
export type PriceCheck = { value: string; error: null } | { value: null; error: PriceError };

/** Whole minor units: digits only (leading zeros allowed), or `.` groups of exactly three. */
const UNSIGNED = /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/;
/** A variant's change may carry one ASCII `+` or `-` directly before the digits. */
const SIGNED = /^([+-]?)(\d+|\d{1,3}(?:\.\d{3})+)$/;

const BOUND = 99_999_999n;

/**
 * Trim, then refuse in the table's order: empty, a leading `-` where no negative is allowed, not
 * such a number, out of bounds. An accepted value is the canonical integer string: no `.`, no
 * `+`, no leading zero but one, and `-0` written `0`. The bound is checked on that string as an
 * integer.
 */
export function checkPrice(typed: string, kind: PriceKind): PriceCheck {
  const text = typed.trim();
  if (text === '') return { value: null, error: 'empty' };
  const signed = kind === 'variant';
  if (!signed && text.startsWith('-')) return { value: null, error: 'negative' };
  const found = signed ? SIGNED.exec(text) : UNSIGNED.test(text) ? (['', '', text] as const) : null;
  if (found === null) return { value: null, error: 'format' };
  const digits = found[2]!.replaceAll('.', '').replace(/^0+(?=\d)/, '');
  const canonical = found[1] === '-' && digits !== '0' ? `-${digits}` : digits;
  const amount = BigInt(canonical);
  if (amount > BOUND || amount < -BOUND) return { value: null, error: 'bounds' };
  return { value: canonical, error: null };
}

/**
 * What a field shows: an accepted value grouped with dots (a negative one with a minus, never a
 * plus), anything else exactly as typed. The form never regroups text it has refused.
 */
export function shownPrice(typed: string, kind: PriceKind): string {
  const checked = checkPrice(typed, kind);
  return checked.error === null ? priceText(checked.value) : typed;
}
