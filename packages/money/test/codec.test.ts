import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encodeMoney, decodeMoney } from '../src/codec.js';

describe('money codec', () => {
  it('encodes to a canonical base-10 string', () => {
    expect(encodeMoney(1559n)).toBe('1559');
    expect(encodeMoney(0n)).toBe('0');
    expect(encodeMoney(-250n)).toBe('-250');
  });

  it('decodes a canonical string to the exact value', () => {
    expect(decodeMoney('1559')).toBe(1559n);
    expect(decodeMoney('0')).toBe(0n);
    expect(decodeMoney('-250')).toBe(-250n);
  });

  // 2^53 + 1: the first integer a JSON number cannot carry. Money crosses the
  // wire as a string precisely so this survives.
  it('carries values beyond double precision without loss', () => {
    expect(decodeMoney('9007199254740993')).toBe(9007199254740993n);
    expect(encodeMoney(9007199254740993n)).toBe('9007199254740993');
  });

  it('round-trips any value', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 18n), max: 10n ** 18n }), (m) =>
        decodeMoney(encodeMoney(m)) === m
      )
    );
  });

  it('decodes nothing but the canonical encoding of a value', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), (s) => {
        let decoded: bigint;
        try {
          decoded = decodeMoney(s);
        } catch {
          return true;
        }
        return encodeMoney(decoded) === s;
      })
    );
  });

  it.each([
    '1.5',
    '1e3',
    '',
    ' 12',
    '12 ',
    '12\n',
    '+12',
    '01',
    '-0',
    '-',
    '--1',
    '1_000',
    '1,000',
    '0x10',
    '١٢',
    'abc',
    'Infinity',
    'NaN',
  ])('rejects %j', (bad) => {
    expect(() => decodeMoney(bad)).toThrow('invalid money');
  });

  // The realistic way a non-string reaches the decoder: a client that sends a
  // JSON number instead of the canonical string.
  it('rejects a JSON number instead of coercing it', () => {
    const body: { total: string } = JSON.parse('{"total": 1559}');
    expect(() => decodeMoney(body.total)).toThrow('invalid money');
  });
});
