/**
 * Integer division rounding halves away from zero.
 *
 * This is the ONLY rounding function in the system (B-2). Every monetary
 * calculation routes through it, so "half-up" has exactly one meaning and two
 * code paths can never disagree on a total.
 */
export function divHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('denominator must be positive');

  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;

  const quotient = n / denominator;
  const remainder = n % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;

  return negative ? -rounded : rounded;
}
