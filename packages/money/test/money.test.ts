import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  RATE_SCALE,
  rateFromPercent,
  mulRate,
  taxIncludedIn,
  formatMoney,
} from '../src/index.js';

describe('rateFromPercent', () => {
  it('converts a decimal percent string to parts per million', () => {
    expect(rateFromPercent('10')).toBe(100_000n);
    expect(rateFromPercent('5')).toBe(50_000n);
    expect(rateFromPercent('11')).toBe(110_000n);
    expect(rateFromPercent('12.5')).toBe(125_000n);
    expect(rateFromPercent('100')).toBe(1_000_000n);
    expect(rateFromPercent('0')).toBe(0n);
  });

  it('supports precision to one part per million', () => {
    expect(rateFromPercent('0.0001')).toBe(1n);
    expect(rateFromPercent('7.1234')).toBe(71_234n);
  });

  it('accepts trailing zeros, which name the same exact rate', () => {
    expect(rateFromPercent('10.0')).toBe(100_000n);
    expect(rateFromPercent('0.00010')).toBe(1n);
  });

  // A number-based conversion accepted 1.0000000000001 as exactly 1% and
  // turned 1e21 into 10000000000000000905969664n. Neither may happen.
  it('rejects a rate finer than one part per million rather than rounding it', () => {
    expect(() => rateFromPercent('0.00001')).toThrow('rate precision');
    expect(() => rateFromPercent('1.0000000000001')).toThrow('rate precision');
  });

  it('keeps every digit of a large rate', () => {
    expect(rateFromPercent('100000000000000000000')).toBe(10n ** 24n);
  });

  it('rejects a negative rate', () => {
    expect(() => rateFromPercent('-5')).toThrow('rate must not be negative');
  });

  it.each(['', ' 10', '10 ', '10%', '1e1', '.5', '5.', '010', '+5', '1,5', 'NaN', 'Infinity', '0x10'])(
    'rejects %j',
    (bad) => {
      expect(() => rateFromPercent(bad)).toThrow('invalid rate');
    }
  );

  it('rejects a JSON number instead of coercing it', () => {
    const body: { taxPercent: string } = JSON.parse('{"taxPercent": 10}');
    expect(() => rateFromPercent(body.taxPercent)).toThrow('invalid rate');
  });
});

describe('mulRate', () => {
  it('applies a rate and rounds half-up once', () => {
    // 1485 * 5% = 74.25 -> 74
    expect(mulRate(1485n, rateFromPercent('5'))).toBe(74n);
    // 1490 * 5% = 74.5 -> 75
    expect(mulRate(1490n, rateFromPercent('5'))).toBe(75n);
    // 1650 * 10% = 165 exactly
    expect(mulRate(1650n, rateFromPercent('10'))).toBe(165n);
  });

  it('rounds a negative amount away from zero', () => {
    expect(mulRate(-1485n, rateFromPercent('5'))).toBe(-74n);
    expect(mulRate(-1490n, rateFromPercent('5'))).toBe(-75n);
  });

  it('rejects a negative rate', () => {
    expect(() => mulRate(1485n, -1n)).toThrow('rate must not be negative');
  });

  it('returns the amount unchanged at 100%', () => {
    const full = rateFromPercent('100');
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }), (amount) =>
        mulRate(amount, full) === amount
      )
    );
  });

  it('never exceeds the base amount for rates at or below 100%', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 12n }),
        fc.bigInt({ min: 0n, max: RATE_SCALE }),
        (amount, rate) => mulRate(amount, rate) <= amount
      )
    );
  });
});

describe('taxIncludedIn', () => {
  it('extracts the tax already inside a tax-inclusive amount', () => {
    // 1485 inclusive of 10% -> net 1350, tax 135. Dividing by the rate scale
    // alone, as for an exclusive price, would give 148.5 -> 149.
    expect(taxIncludedIn(1485n, rateFromPercent('10'))).toBe(135n);
  });

  it('rounds an exact half of included tax away from zero', () => {
    // 3 inclusive of 100% -> tax 1.5 -> 2
    expect(taxIncludedIn(3n, rateFromPercent('100'))).toBe(2n);
    expect(taxIncludedIn(-3n, rateFromPercent('100'))).toBe(-2n);
  });

  it('extracts nothing at a zero rate', () => {
    expect(taxIncludedIn(1485n, 0n)).toBe(0n);
  });

  it('rejects a negative rate', () => {
    expect(() => taxIncludedIn(1485n, -1n)).toThrow('rate must not be negative');
  });

  it('lands within half a unit of amount x r / (1 + r)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 12n }),
        fc.bigInt({ min: 0n, max: 10n * RATE_SCALE }),
        (amount, rate) => {
          const tax = taxIncludedIn(amount, rate);
          // tax ~ amount*rate / (SCALE + rate), so compare without dividing
          const err = tax * (RATE_SCALE + rate) - amount * rate;
          const abs = err < 0n ? -err : err;
          return abs * 2n <= RATE_SCALE + rate;
        }
      )
    );
  });

  it('never returns more than the amount it is extracted from', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 12n }),
        fc.bigInt({ min: 0n, max: 10n * RATE_SCALE }),
        (amount, rate) => taxIncludedIn(amount, rate) <= amount
      )
    );
  });
});

describe('the PRD worked example', () => {
  // PRD §4: tax 10% inclusive, service charge 5% untaxed, 2-decimal currency.
  it('reproduces subtotal 16.50 to total 15.59', () => {
    const tax = rateFromPercent('10');
    const service = rateFromPercent('5');

    const burger = 1000n + 200n + 150n; // burger, Large variant, extra cheese
    expect(burger).toBe(1350n);
    const soda = 300n;

    const subtotal = burger + soda;
    expect(subtotal).toBe(1650n);

    const discount = mulRate(subtotal, rateFromPercent('10'));
    expect(discount).toBe(165n);

    const d = subtotal - discount;
    expect(d).toBe(1485n);

    const includedTax = taxIncludedIn(d, tax);
    expect(includedTax).toBe(135n);

    const serviceCharge = mulRate(d, service);
    expect(serviceCharge).toBe(74n);

    const total = d + serviceCharge;
    expect(total).toBe(1559n);

    // The receipt figures, exactly as the PRD prints them.
    expect(
      [subtotal, discount, d, includedTax, serviceCharge, total].map((m) => formatMoney(m, 2))
    ).toEqual(['16.50', '1.65', '14.85', '1.35', '0.74', '15.59']);
  });
});

describe('formatMoney', () => {
  it('formats zero-decimal currency such as IDR', () => {
    expect(formatMoney(15590n, 0)).toBe('15590');
    expect(formatMoney(-15590n, 0)).toBe('-15590');
    expect(formatMoney(0n, 0)).toBe('0');
  });

  it('formats two-decimal currency', () => {
    expect(formatMoney(1559n, 2)).toBe('15.59');
    expect(formatMoney(5n, 2)).toBe('0.05');
    expect(formatMoney(0n, 2)).toBe('0.00');
    expect(formatMoney(-1559n, 2)).toBe('-15.59');
    expect(formatMoney(-5n, 2)).toBe('-0.05');
  });

  it('formats any precision the module supports', () => {
    expect(formatMoney(1234567n, 3)).toBe('1234.567');
    expect(formatMoney(1n, 6)).toBe('0.000001');
  });

  it.each([-1, 7, 1.5, Number.NaN])('rejects precision %s', (bad) => {
    expect(() => formatMoney(1559n, bad)).toThrow('precision must be an integer between 0 and 6');
  });
});
