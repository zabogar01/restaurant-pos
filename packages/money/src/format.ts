import type { Money } from './codec.js';

/** Renders minor units for display. Never used as an arithmetic input. */
export function formatMoney(m: Money, precision: number): string {
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
    throw new Error('precision must be an integer between 0 and 6');
  }
  if (precision === 0) return m.toString(10);

  const negative = m < 0n;
  const digits = (negative ? -m : m).toString(10).padStart(precision + 1, '0');
  const whole = digits.slice(0, digits.length - precision);
  const frac = digits.slice(digits.length - precision);

  return `${negative ? '-' : ''}${whole}.${frac}`;
}
