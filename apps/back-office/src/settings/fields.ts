import { checkRate, percentText, type RateError } from './rate.js';

// The settings form's own checks (DESIGN-018, "Lengths and charsets", with DESIGN-018b's phone
// row). A text is trimmed, then refused in the table's order: empty, too long, too many lines
// (the address), the phone charset, a control character. Lengths are counted in code points,
// as the contracts' `min` and `max` count them (zod 4) and as the database's `char_length`
// does; DESIGN-018 says "UTF-16 units", which differs only for a character outside the Basic
// Multilingual Plane such as an emoji, and the contract is what refuses. A blank NPWPD is not
// a refusal: it is sent as null. The contracts' field
// schemas say the same in the other direction; a test holds the two in agreement, and
// `fieldsInError` is the gate before the core is called.

export type RateKey = 'tax' | 'service';
export type TextKey = 'outlet' | 'address' | 'phone' | 'npwpd' | 'footer';
export type FieldKey = RateKey | TextKey;

/** The form's order: the order focus goes to the first invalid field, and the order the fields are drawn. */
export const FIELD_ORDER: readonly FieldKey[] = ['tax', 'service', 'outlet', 'address', 'phone', 'npwpd', 'footer'];
export const RATE_KEYS: readonly RateKey[] = ['tax', 'service'];
export const TEXT_KEYS: readonly TextKey[] = ['outlet', 'address', 'phone', 'npwpd', 'footer'];

export type TextError = 'empty' | 'long' | 'lines' | 'charset' | 'control';
export type FieldError = RateError | TextError;

const LIMIT: Record<TextKey, number> = { outlet: 64, address: 200, phone: 32, npwpd: 32, footer: 120 };
const REQUIRED: Record<TextKey, boolean> = { outlet: true, address: true, phone: true, npwpd: false, footer: true };
const MAX_LINES = 3;
const PHONE_CHARSET = /^[0-9 +\-.()]+$/;

export const isRate = (key: FieldKey): key is RateKey => key === 'tax' || key === 'service';

/** The trimmed value, and the first refusal in the table's order, or none. A blank NPWPD has the value null. */
export function checkText(key: TextKey, typed: string): { value: string | null; error: TextError | null } {
  const value = typed.trim();
  if (value === '') return REQUIRED[key] ? { value, error: 'empty' } : { value: null, error: null };
  if ([...value].length > LIMIT[key]) return { value, error: 'long' };
  if (key === 'address' && value.split('\n').length > MAX_LINES) return { value, error: 'lines' };
  if (key === 'phone') return PHONE_CHARSET.test(value) ? { value, error: null } : { value, error: 'charset' };
  // The address may hold line feeds and no other control character.
  const inspected = key === 'address' ? value.replaceAll('\n', '') : value;
  if (/\p{Cc}/u.test(inspected)) return { value, error: 'control' };
  return { value, error: null };
}

/** The draft text of every field, as the form holds it. */
export type Drafts = Record<FieldKey, string>;

/** What each field's check produced: parts per million for a rate, the trimmed text for the rest. */
export type Checked =
  | { ok: true; values: { tax: string; service: string; outlet: string; address: string; phone: string; npwpd: string | null; footer: string } }
  | { ok: false; errors: Partial<Record<FieldKey, FieldError>>; trimmed: Partial<Record<TextKey, string>> };

/** Checks every field. Nothing is sent unless all of them pass. */
export function checkDrafts(drafts: Drafts): Checked {
  const errors: Partial<Record<FieldKey, FieldError>> = {};
  const trimmed: Partial<Record<TextKey, string>> = {};
  const text: Partial<Record<TextKey, string | null>> = {};
  const rates: Partial<Record<RateKey, string>> = {};
  for (const key of FIELD_ORDER) {
    if (isRate(key)) {
      const checked = checkRate(drafts[key]);
      if (checked.ok) rates[key] = checked.ppm;
      else errors[key] = checked.error;
    } else {
      const checked = checkText(key, drafts[key]);
      trimmed[key] = checked.value ?? '';
      if (checked.error !== null) errors[key] = checked.error;
      else text[key] = checked.value;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors, trimmed };
  return {
    ok: true,
    values: {
      tax: rates.tax!,
      service: rates.service!,
      outlet: text.outlet!,
      address: text.address!,
      phone: text.phone!,
      npwpd: text.npwpd ?? null,
      footer: text.footer!,
    },
  };
}

/** The rate as the field holds it (a decimal comma, no percent sign) or the text as it was saved. */
export const draftOf = (key: FieldKey, saved: string | null): string =>
  saved === null ? '' : isRate(key) ? percentText(saved) : saved;
