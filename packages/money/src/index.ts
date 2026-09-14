import { divHalfUp } from './rounding.js';
import type { Money } from './codec.js';

export type { Money } from './codec.js';
export { encodeMoney, decodeMoney } from './codec.js';
export { divHalfUp } from './rounding.js';
export { formatMoney } from './format.js';

/** Rates are integers in parts per million (FR-M5). 10% === 100_000n. */
export type Rate = bigint;

export const RATE_SCALE = 1_000_000n;

const PPM_PER_PERCENT = RATE_SCALE / 100n;
const PPM_PERCENT_DIGITS = 4;

// A non-negative decimal percent: '0' or a digit string with no leading zero,
// optionally followed by a fraction. No sign, exponent, or separators.
const PERCENT = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

/**
 * Parses a decimal percent such as '10' or '0.0001' into parts per million.
 *
 * Takes a string, not a number (B-1): a rate typed into a form arrives as
 * text, and parsing it digit by digit is exact where binary floating point
 * silently accepts values finer than one part per million.
 */
export function rateFromPercent(percent: string): Rate {
  if (typeof percent === 'string' && percent.startsWith('-') && PERCENT.test(percent.slice(1))) {
    throw new Error('rate must not be negative');
  }
  const match = typeof percent === 'string' ? PERCENT.exec(percent) : null;
  if (!match) throw new Error(`invalid rate: ${JSON.stringify(percent)}`);

  const [, whole = '0', fraction = ''] = match;
  const significant = fraction.replace(/0+$/, '');
  if (significant.length > PPM_PERCENT_DIGITS) {
    throw new Error('rate precision is limited to one part per million');
  }

  return BigInt(whole) * PPM_PER_PERCENT + BigInt(significant.padEnd(PPM_PERCENT_DIGITS, '0'));
}

/** amount x rate, rounded half-up once. */
export function mulRate(amount: Money, rate: Rate): Money {
  if (rate < 0n) throw new Error('rate must not be negative');
  return divHalfUp(amount * rate, RATE_SCALE);
}

/**
 * The tax already contained in a tax-inclusive amount: amount x r / (1 + r).
 * Display only — it is a component of the amount, never added to it (B-4).
 */
export function taxIncludedIn(amount: Money, rate: Rate): Money {
  if (rate < 0n) throw new Error('rate must not be negative');
  if (rate === 0n) return 0n;
  return divHalfUp(amount * rate, RATE_SCALE + rate);
}
