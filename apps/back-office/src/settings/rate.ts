import { RATE_SCALE, encodeRate, rateFromPercent } from '@pos/money';

// The rate field (DESIGN-018, "The rate field"; BO-07's percentage preset reuses it). A rate
// is typed as a percent, read digit by digit and converted by `rateFromPercent`, never
// through a float (B-1). Nothing on this path reads a number from text: the whole and the
// fraction stay strings until `rateFromPercent` turns them into parts per million, and the
// bound is a bigint comparison. A test scans this directory for the calls that would.

export type RateError = 'empty' | 'negative' | 'format' | 'decimals' | 'over';

export type RateCheck = { ok: true; ppm: string } | { ok: false; error: RateError };

const SHAPE = /^([0-9]*)(?:[.,]([0-9]*))?$/;
const NEGATIVE = /^-\s*(.*)$/s;

/** Trim; one trailing `%` goes, and the text is trimmed again. */
function normalise(typed: string): string {
  const trimmed = typed.trim();
  return trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
}

/** The whole and the fraction of a text of digits with at most one separator, or null. */
function split(text: string): { whole: string; fraction: string } | null {
  const match = SHAPE.exec(text);
  if (match === null || !/[0-9]/.test(text)) return null;
  return { whole: match[1] ?? '', fraction: match[2] ?? '' };
}

/**
 * The refusal order is empty, negative, not a number, more than four decimal places, over 100.
 * An accepted rate comes back as its canonical parts per million, ready for the request.
 */
export function checkRate(typed: string): RateCheck {
  const text = normalise(typed);
  if (text === '') return { ok: false, error: 'empty' };

  const negative = NEGATIVE.exec(text);
  if (negative !== null && split(negative[1] ?? '') !== null) return { ok: false, error: 'negative' };

  const parts = split(text);
  if (parts === null) return { ok: false, error: 'format' };
  // Counted as typed: `10.00000` is five places, though the last four add nothing.
  if (parts.fraction.length > 4) return { ok: false, error: 'decimals' };

  const whole = parts.whole.replace(/^0+(?=[0-9])/, '') || '0';
  const percent = parts.fraction === '' ? whole : `${whole}.${parts.fraction}`;
  const rate = rateFromPercent(percent);
  if (rate > RATE_SCALE) return { ok: false, error: 'over' };
  return { ok: true, ppm: encodeRate(rate) };
}

/** A stored rate (canonical parts per million) as a percent: a decimal comma, no trailing zeros. */
export function percentText(ppm: string): string {
  const padded = ppm.padStart(5, '0');
  const whole = padded.slice(0, -4).replace(/^0+(?=[0-9])/, '');
  const fraction = padded.slice(-4).replace(/0+$/, '');
  return fraction === '' ? whole : `${whole},${fraction}`;
}
