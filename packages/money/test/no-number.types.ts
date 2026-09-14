/**
 * B-1, enforced by the compiler: a `number` is never accepted where money or a
 * rate belongs, and money never comes back as a `number`.
 *
 * Checked by `npm run typecheck`, never executed — the file name is outside
 * vitest's test pattern. Each `@ts-expect-error` asserts that the next line
 * does not compile. If a signature is ever widened to accept `number`, that
 * line starts compiling, the directive becomes unused, and tsc fails with
 * TS2578. A green typecheck therefore proves every line below is rejected.
 */
import {
  decodeMoney,
  divHalfUp,
  encodeMoney,
  formatMoney,
  mulRate,
  rateFromPercent,
  taxIncludedIn,
  type Money,
  type Rate,
} from '../src/index.js';

export function numbersAreNotMoney(): void {
  const amount: Money = 1485n;
  const rate: Rate = 100_000n;

  // @ts-expect-error a number is not Money
  const asMoney: Money = 1485;
  // @ts-expect-error a number is not a Rate
  const asRate: Rate = 100_000;

  // @ts-expect-error mulRate amount must not be a number
  mulRate(1485, rate);
  // @ts-expect-error mulRate rate must not be a number
  mulRate(amount, 100_000);
  // @ts-expect-error mulRate rate must not be a fractional number
  mulRate(amount, 0.1);

  // @ts-expect-error taxIncludedIn amount must not be a number
  taxIncludedIn(1485, rate);
  // @ts-expect-error taxIncludedIn rate must not be a number
  taxIncludedIn(amount, 0.1);

  // @ts-expect-error divHalfUp numerator must not be a number
  divHalfUp(5, 2n);
  // @ts-expect-error divHalfUp denominator must not be a number
  divHalfUp(5n, 2);

  // @ts-expect-error encodeMoney must not take a number
  encodeMoney(1559);
  // @ts-expect-error decodeMoney must not take a number off the wire
  decodeMoney(1559);

  // @ts-expect-error formatMoney must not take a number as the amount
  formatMoney(1559, 2);

  // @ts-expect-error rateFromPercent must not take a number
  rateFromPercent(10);
  // @ts-expect-error rateFromPercent must not take a fractional number
  rateFromPercent(0.0001);

  // @ts-expect-error mulRate returns Money, never a number
  const product: number = mulRate(amount, rate);
  // @ts-expect-error taxIncludedIn returns Money, never a number
  const tax: number = taxIncludedIn(amount, rate);
  // @ts-expect-error decodeMoney returns Money, never a number
  const decoded: number = decodeMoney('1559');
  // @ts-expect-error divHalfUp returns bigint, never a number
  const quotient: number = divHalfUp(5n, 2n);
  // @ts-expect-error rateFromPercent returns a Rate, never a number
  const parsed: number = rateFromPercent('10');

  void [asMoney, asRate, product, tax, decoded, quotient, parsed];
}
