import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  INSTALLATION_CURRENCY,
  INSTALLATION_MINOR_UNIT_PRECISION,
  decodeRate,
  encodeRate,
  rateFromPpm,
} from '../src/index.js';

describe('rate codec', () => {
  it('encodes to a canonical base-10 string of parts per million', () => {
    expect(encodeRate(rateFromPpm(0n))).toBe('0');
    expect(encodeRate(rateFromPpm(110000n))).toBe('110000');
    expect(encodeRate(rateFromPpm(1000000n))).toBe('1000000');
  });

  it('S2-18. decodes the canonical strings to the exact rate', () => {
    expect(decodeRate('0')).toBe(0n);
    expect(decodeRate('110000')).toBe(110000n);
    expect(decodeRate('1000000')).toBe(1000000n);
  });

  it('round-trips any rate', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 18n }), (ppm) => {
        const rate = rateFromPpm(ppm);
        return decodeRate(encodeRate(rate)) === rate;
      })
    );
  });

  it('decodes nothing but the canonical encoding of a rate', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), (s) => {
        let decoded: bigint;
        try {
          decoded = decodeRate(s);
        } catch {
          return true;
        }
        return encodeRate(rateFromPpm(decoded)) === s;
      })
    );
  });

  it.each([
    '-1',
    '+1',
    '01',
    '00',
    '1e6',
    '1E6',
    '1.5',
    '1.',
    '.5',
    '',
    ' 1',
    '1 ',
    '1\n',
    '1_000',
    '1,000',
    '0x10',
    '-0',
    '١٢',
    'abc',
    'Infinity',
    'NaN',
  ])('S2-18. rejects %j', (bad) => {
    expect(() => decodeRate(bad)).toThrow('invalid rate');
  });

  // The realistic way a non-string reaches the decoder: a client that sends a JSON
  // number, or a null, an array or an object, instead of the canonical string.
  it('S2-18. rejects a JSON number and any other non-string instead of coercing it', () => {
    const body = JSON.parse('{"rate": 110000, "none": null, "list": ["1"], "big": 1e6}') as Record<string, unknown>;
    for (const value of [body.rate, body.none, body.list, body.big, undefined, 0, 1n, {}]) {
      expect(() => decodeRate(value), String(value)).toThrow('invalid rate');
    }
  });

  it('does not bound the rate: the range a business allows is the caller\'s to check', () => {
    expect(decodeRate('1000001')).toBe(1000001n);
  });
});

describe('the installation constants', () => {
  it('S2-21. are IDR at precision 0 (owner, 2026-10-20)', () => {
    expect(INSTALLATION_CURRENCY).toBe('IDR');
    expect(INSTALLATION_MINOR_UNIT_PRECISION).toBe(0);
  });
});
