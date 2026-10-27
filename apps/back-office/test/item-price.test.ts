import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BasePrice, ModifierPriceChange, VariantPriceChange } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { checkPrice, shownPrice, type PriceError, type PriceKind } from '../src/item/price.js';

// BO-04's price input (PHASE1-S4c2a ruling 7; DESIGN.md, "The money input"): one function for all
// three field kinds, exact on strings, never through a float (B-1). The contract's three price
// schemas and this check agree on every accepted input and on every bound.

const SCHEMA = { base: BasePrice, variant: VariantPriceChange, modifier: ModifierPriceChange } as const;

const refused = (typed: string, kind: PriceKind): PriceError | null => checkPrice(typed, kind).error;
const value = (typed: string, kind: PriceKind): string | null => checkPrice(typed, kind).value;

describe('accepted inputs are converted exactly, on strings', () => {
  it.each<[string, string, string]>([
    ['10000', '10000', 'plain digits'],
    ['00010', '10', 'leading zeros'],
    ['10.000', '10000', 'one group'],
    ['1.000.000', '1000000', 'two groups'],
    ['99.999.999', '99999999', 'the largest'],
    ['0', '0', 'zero'],
    ['000', '0', 'only zeros keep one'],
    ['  12.500  ', '12500', 'surrounding spaces are trimmed'],
    ['0.001', '1', 'a leading group of one digit that is zero'],
  ])('base %s is %s (%s)', (typed, canonical) => {
    expect(value(typed, 'base')).toBe(canonical);
    expect(refused(typed, 'base')).toBeNull();
    expect(value(typed, 'modifier')).toBe(canonical);
  });

  it.each<[string, string]>([
    ['-10.000', '-10000'],
    ['+5000', '5000'],
    ['-0', '0'],
    ['+0', '0'],
    ['-00', '0'],
    ['-99.999.999', '-99999999'],
    ['+99.999.999', '99999999'],
    ['-5', '-5'],
  ])('variant %s is %s', (typed, canonical) => {
    expect(value(typed, 'variant')).toBe(canonical);
  });
});

describe('the four refusals come in the table’s order', () => {
  it('1. empty, for every kind', () => {
    for (const kind of ['base', 'variant', 'modifier'] as const) {
      expect(refused('', kind)).toBe('empty');
      expect(refused('   ', kind)).toBe('empty');
    }
  });

  it('2. a leading minus where no negative is allowed, before the format is judged', () => {
    expect(refused('-1', 'base')).toBe('negative');
    expect(refused('-abc', 'base')).toBe('negative');
    expect(refused('-1', 'modifier')).toBe('negative');
    expect(refused('-0', 'base')).toBe('negative');
    expect(refused('-1', 'variant')).toBeNull();
  });

  // The 21 cases of "Refused under rule 3", and the format cases around them.
  const FORMAT: Array<[string, string]> = [
    ['1 000', 'a space inside'],
    ['10.00', 'a decimal part of two digits'],
    ['1000.5', 'a decimal part of one digit'],
    ['10,000', 'a comma'],
    ['10.000,5', 'a comma after a group'],
    ['1e3', 'an exponent'],
    ['1E3', 'an upper-case exponent'],
    ['−1', 'a Unicode minus'],
    ['- 1', 'a space after a sign (variant)'],
    ['+ 1', 'a space after a plus (variant)'],
    ['twelve', 'letters'],
    ['12a', 'a trailing letter'],
    ['1.00.000', 'a group that is not three digits'],
    ['.000', 'a lone group'],
    ['1.', 'a trailing dot'],
    ['1..000', 'two dots'],
    ['1.0000', 'a group of four'],
    ['٣٠٠٠', 'non-ASCII digits'],
    ['++5', 'two signs (variant)'],
    ['+-5', 'a plus then a minus (variant)'],
    ['5-', 'a trailing minus'],
  ];

  it.each(FORMAT)('3. %s is not such a number: %s', (typed) => {
    expect(refused(typed, 'variant')).toBe('format');
    // On the unsigned kinds the same text is also a format refusal (or a negative one when it
    // starts with a minus, which rule 2 judges first).
    const unsigned = typed.trim().startsWith('-') ? 'negative' : 'format';
    expect(refused(typed, 'base')).toBe(unsigned);
    expect(refused(typed, 'modifier')).toBe(unsigned);
  });

  it('3. a plus is a format refusal on base and modifier, and a sign alone is one on every kind', () => {
    expect(refused('+5000', 'base')).toBe('format');
    expect(refused('+5000', 'modifier')).toBe('format');
    expect(refused('+', 'variant')).toBe('format');
    expect(refused('-', 'variant')).toBe('format');
  });

  it('4. out of bounds, on the canonical string', () => {
    expect(refused('99.999.999', 'base')).toBeNull();
    expect(refused('100.000.000', 'base')).toBe('bounds');
    expect(refused('100000000', 'base')).toBe('bounds');
    expect(refused('000000000100000000', 'base')).toBe('bounds');
    expect(refused('100.000.000', 'modifier')).toBe('bounds');
    expect(refused('-99.999.999', 'variant')).toBeNull();
    expect(refused('-100.000.000', 'variant')).toBe('bounds');
    expect(refused('+100.000.000', 'variant')).toBe('bounds');
    // Larger than any double holds exactly: the comparison is on integers.
    expect(refused('99999999999999999999999999', 'base')).toBe('bounds');
    expect(refused('-99999999999999999999999999', 'variant')).toBe('bounds');
    expect(refused('0000000000000000000000000099999999', 'base')).toBeNull();
  });
});

describe('the check and the contract’s price schemas agree', () => {
  const INPUTS = [
    '0', '00', '5', '05', '10000', '00010', '10.000', '99.999.999', '99999999', '100.000.000', '100000000',
    '-0', '-1', '-10.000', '-99.999.999', '-100.000.000', '+0', '+5000', '+99.999.999', '+100.000.000',
    '1000.5', '1 000', '1e3', 'twelve', '', ' 7 ', '000099999999', '0.001',
  ];

  for (const kind of ['base', 'variant', 'modifier'] as const) {
    it.each(INPUTS)(`${kind}: %j is accepted only if its canonical string is accepted by the schema`, (typed) => {
      const checked = checkPrice(typed, kind);
      if (checked.error === null) {
        expect(SCHEMA[kind].safeParse(checked.value).success, `${typed} → ${checked.value}`).toBe(true);
      }
    });
  }

  it.each<[PriceKind, string, boolean]>([
    ['base', '99999999', true],
    ['base', '100000000', false],
    ['base', '-1', false],
    ['modifier', '99999999', true],
    ['modifier', '100000000', false],
    ['variant', '99999999', true],
    ['variant', '100000000', false],
    ['variant', '-99999999', true],
    ['variant', '-100000000', false],
  ])('%s: the bound value %s is %s in both', (kind, canonical, accepted) => {
    const shown = canonical.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    expect(checkPrice(shown, kind).error === null).toBe(accepted);
    expect(SCHEMA[kind].safeParse(canonical).success).toBe(accepted);
  });
});

describe('display', () => {
  it('a stored or accepted value is grouped with dots, a negative one with a minus and never a plus', () => {
    expect(shownPrice('10000', 'base')).toBe('10.000');
    expect(shownPrice('00010', 'base')).toBe('10');
    expect(shownPrice('+5000', 'variant')).toBe('5.000');
    expect(shownPrice('-10000', 'variant')).toBe('-10.000');
    expect(shownPrice('-0', 'variant')).toBe('0');
    expect(shownPrice('99999999', 'base')).toBe('99.999.999');
  });

  it('a refused value stays exactly as typed', () => {
    expect(shownPrice('1000.5', 'base')).toBe('1000.5');
    expect(shownPrice('  ', 'base')).toBe('  ');
    expect(shownPrice('100.000.000', 'base')).toBe('100.000.000');
    expect(shownPrice('-1', 'base')).toBe('-1');
  });
});

describe('B-1. no floating point anywhere under src/item', () => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/item');
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));

  it('reads the item sources, and the price module among them', () => {
    expect(files).toContain('price.ts');
  });

  for (const file of files) {
    it(`${file} calls no parseFloat, parseInt, Number(, Math.round, Math.floor or toFixed`, () => {
      const code = readFileSync(join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code.match(/parseFloat|parseInt|\bNumber\(|Math\.round|Math\.floor|toFixed/g) ?? []).toEqual([]);
    });
  }
});
