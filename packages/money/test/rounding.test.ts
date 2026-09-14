import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { divHalfUp } from '../src/rounding.js';

describe('divHalfUp', () => {
  it('rounds an exact quotient to itself', () => {
    expect(divHalfUp(10n, 5n)).toBe(2n);
    expect(divHalfUp(-10n, 5n)).toBe(-2n);
    expect(divHalfUp(0n, 7n)).toBe(0n);
  });

  it('rounds a half up, away from zero', () => {
    expect(divHalfUp(5n, 2n)).toBe(3n);
    expect(divHalfUp(-5n, 2n)).toBe(-3n);
  });

  // Half-to-even would give 2 and -2 here; flooring would give -3 for -2.5
  // but -1 for -1.5. Only away-from-zero gives all four.
  it('rounds every exact half away from zero, on both sides of zero', () => {
    expect(divHalfUp(25n, 10n)).toBe(3n);
    expect(divHalfUp(-25n, 10n)).toBe(-3n);
    expect(divHalfUp(15n, 10n)).toBe(2n);
    expect(divHalfUp(-15n, 10n)).toBe(-2n);
    expect(divHalfUp(1n, 2n)).toBe(1n);
    expect(divHalfUp(-1n, 2n)).toBe(-1n);
  });

  it('rounds below a half toward zero', () => {
    expect(divHalfUp(4n, 3n)).toBe(1n);
    expect(divHalfUp(-4n, 3n)).toBe(-1n);
    expect(divHalfUp(149n, 100n)).toBe(1n);
    expect(divHalfUp(-149n, 100n)).toBe(-1n);
  });

  // A truncating implementation returns 1 and -1 for every case in this test.
  it('rounds above a half away from zero', () => {
    expect(divHalfUp(5n, 3n)).toBe(2n);
    expect(divHalfUp(-5n, 3n)).toBe(-2n);
    expect(divHalfUp(151n, 100n)).toBe(2n);
    expect(divHalfUp(-151n, 100n)).toBe(-2n);
  });

  it('rejects a non-positive denominator', () => {
    expect(() => divHalfUp(1n, 0n)).toThrow('denominator must be positive');
    expect(() => divHalfUp(1n, -2n)).toThrow('denominator must be positive');
  });

  it('never lands further than half a unit from the true quotient', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n }),
        fc.bigInt({ min: 1n, max: 10n ** 9n }),
        (n, d) => {
          const q = divHalfUp(n, d);
          // |n - q*d| * 2 <= d  proves q is the nearest integer, ties included
          const err = n - q * d;
          const abs = err < 0n ? -err : err;
          return abs * 2n <= d;
        }
      )
    );
  });

  it('breaks every tie away from zero', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 15n }),
        fc.bigInt({ min: 1n, max: 10n ** 9n }),
        (k, half) => {
          const d = half * 2n;
          const n = k * d + half; // exactly k + 0.5
          return divHalfUp(n, d) === k + 1n && divHalfUp(-n, d) === -(k + 1n);
        }
      )
    );
  });

  it('is symmetric about zero', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n }),
        fc.bigInt({ min: 1n, max: 10n ** 9n }),
        (n, d) => divHalfUp(-n, d) === -divHalfUp(n, d)
      )
    );
  });
});
