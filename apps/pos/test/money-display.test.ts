import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatAmount } from '../src/money.js';
import { ORDER_FIXTURES } from '../src/orderFixtures.js';

// B-1 on the glass. Money is a bigint all the way to Intl.NumberFormat; a
// Number() on the way silently rounds past 2^53, so 9007199254740993 renders
// as …992. The client source has no business converting anything to a double,
// so the check is blunt: no Number(, parseFloat or parseInt anywhere in src.
// A rule nothing checks is a rule an agent in a hurry will break.

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

const sources = (readdirSync(src, { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ name: f, text: readFileSync(join(src, f), 'utf8') }));

const TO_DOUBLE = /\bNumber\s*\(|\b(?:Number\s*\.\s*)?parse(?:Float|Int)\s*\(/g;

/** Every conversion to a double, outside comments. */
function doubleConversions(code: string): string[] {
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return [...stripped.matchAll(TO_DOUBLE)].map((m) => m[0]);
}

describe('the conversion detector can see a conversion', () => {
  it('flags Number(), parseFloat, parseInt and their Number.* forms', () => {
    expect(doubleConversions('formatAmount(Number(line.amount))')).toEqual(['Number(']);
    expect(doubleConversions('const n = Number (total);')).toEqual(['Number (']);
    expect(doubleConversions('parseFloat(s) + parseInt(t, 10)')).toEqual(['parseFloat(', 'parseInt(']);
    expect(doubleConversions('Number.parseFloat(s)')).toEqual(['Number.parseFloat(']);
  });

  it('ignores comments and names that merely contain the word', () => {
    expect(doubleConversions('// never Number(money)\n/* Number(x) */ const a = 1;')).toEqual([]);
    expect(doubleConversions('lineNumber(x); isNumber(y); Number.isInteger(z)')).toEqual([]);
  });
});

describe('POS source never converts to a double', () => {
  it('finds the sources', () => {
    expect(sources.map((s) => s.name)).toContain('money.ts');
  });

  for (const { name, text } of sources) {
    it(`${name}: no Number(, parseFloat or parseInt`, () => {
      expect(doubleConversions(text)).toEqual([]);
    });
  }
});

describe('formatAmount', () => {
  it('groups rupiah the Indonesian way, with no symbol, as the artifact sets them', () => {
    expect(formatAmount(0n)).toBe('0');
    expect(formatAmount(30_000n)).toBe('30.000');
    expect(formatAmount(1_244_250n)).toBe('1.244.250');
  });

  it('draws a negative with the artifact’s minus sign', () => {
    expect(formatAmount(-16_500n)).toBe('−16.500');
  });

  it('is exact past 2^53, where a double is not', () => {
    const past = 9_007_199_254_740_993n;
    expect(formatAmount(past)).toBe('9.007.199.254.740.993');
    // The route this test exists to forbid, shown to be wrong on this machine.
    expect(new Intl.NumberFormat('id-ID').format(Number(past))).toBe('9.007.199.254.740.992');
  });

  it('accepts only a bigint', () => {
    // @ts-expect-error money is never a number (B-1)
    formatAmount(165000);
  });

  it('every amount in the fixtures is a bigint', () => {
    const amounts = Object.values(ORDER_FIXTURES).flatMap((f) => [
      ...f.groups.flatMap((g) => g.lines.flatMap((l) => [l.amount, ...(l.modifiers ?? []).flatMap((m) => (m.delta === undefined ? [] : [m.delta]))])),
      ...[f.totals, ...Object.values(f.totalsWithout ?? {})].flatMap((t) => [
        t.subtotal,
        t.total,
        ...[t.discount, t.serviceCharge, t.taxIncluded].flatMap((a) => (a ? [a.amount] : [])),
      ]),
    ]);
    expect(amounts.length).toBeGreaterThan(30);
    expect(amounts.filter((a) => typeof a !== 'bigint')).toEqual([]);
  });
});
