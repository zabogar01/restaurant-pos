import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RatePpm, SaveSettingsRequest } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { fieldsInError } from '../src/forms/fieldsInError.js';
import { checkRate, percentText, type RateError } from '../src/settings/rate.js';

// AC 3. The rate field, DESIGN-018's rate table as test vectors. The form's own check and
// the contract's `RatePpm` must agree: what the form accepts the schema accepts, and what the
// form refuses for being over 100 the schema refuses once converted. A source test holds the
// whole settings path free of floating point (B-1).

const ACCEPTED: ReadonlyArray<readonly [string, string]> = [
  ['05', '50000'],
  ['10,5', '105000'],
  ['10.50', '105000'],
  [',5', '5000'],
  ['.5', '5000'],
  ['10.', '100000'],
  ['10,50', '105000'],
  ['100,0000', '1000000'],
  ['0,0001', '1'],
  ['100', '1000000'],
  ['11%', '110000'],
  ['11 %', '110000'],
  [' 7 ', '70000'],
  [' 7 % ', '70000'],
  ['0', '0'],
  ['00', '0'],
  ['0,0', '0'],
  ['99,9999', '999999'],
];

const REFUSED: ReadonlyArray<readonly [string, RateError]> = [
  ['', 'empty'],
  ['   ', 'empty'],
  ['%', 'empty'],
  [' % ', 'empty'],
  ['-5', 'negative'],
  ['- 5', 'negative'],
  ['-0,5', 'negative'],
  ['-5,12345', 'negative'],
  ['-', 'format'],
  ['-%', 'format'],
  ['abc', 'format'],
  ['lima', 'format'],
  ['1.000,5', 'format'],
  ['+5', 'format'],
  ['1e2', 'format'],
  ['1 000', 'format'],
  ['−5', 'format'],
  [',', 'format'],
  ['.', 'format'],
  ['1,2,3', 'format'],
  ['5%%', 'format'],
  ['٣', 'format'],
  ['5,12345', 'decimals'],
  ['10.00000', 'decimals'],
  ['0,00001', 'decimals'],
  ['101', 'over'],
  ['100,0001', 'over'],
  ['110', 'over'],
  ['99999999999999999999', 'over'],
];

describe('the rate field accepts DESIGN-018’s vectors and converts them exactly', () => {
  it.each(ACCEPTED)('%j is %s parts per million', (typed, ppm) => {
    expect(checkRate(typed)).toEqual({ ok: true, ppm });
  });
});

describe('the rate field refuses each other vector, in DESIGN-018’s order', () => {
  it.each(REFUSED)('%j is refused as %s', (typed, error) => {
    expect(checkRate(typed)).toEqual({ ok: false, error });
  });
});

describe('the form’s check and the contract’s RatePpm agree', () => {
  it.each(ACCEPTED)('what %j becomes, RatePpm accepts', (typed, ppm) => {
    const checked = checkRate(typed);
    expect(checked.ok && checked.ppm).toBe(ppm);
    expect(RatePpm.safeParse(ppm).success).toBe(true);
  });

  it('refuses over 100 exactly where RatePpm does', () => {
    // 101 and 100,0001 become these; the form refuses them before they are sent.
    expect(RatePpm.safeParse('1010000').success).toBe(false);
    expect(RatePpm.safeParse('1000001').success).toBe(false);
    expect(RatePpm.safeParse('1000000').success).toBe(true);
  });

  it('a body built from an accepted rate passes the request schema for both rates', () => {
    const body = {
      expectedVersion: null,
      taxRatePpm: '105000',
      serviceChargeRatePpm: '50000',
      outletName: 'Warung',
      address: 'Jl. Melati',
      phone: '021 555',
      npwpd: null,
      footer: 'Terima kasih',
    };
    expect(fieldsInError(SaveSettingsRequest, body)).toEqual([]);
    expect(fieldsInError(SaveSettingsRequest, { ...body, taxRatePpm: '1010000' })).toEqual(['taxRatePpm']);
  });
});

describe('a stored rate is shown with a decimal comma and no trailing zeros', () => {
  it.each([
    ['0', '0'],
    ['1', '0,0001'],
    ['10', '0,001'],
    ['55000', '5,5'],
    ['100000', '10'],
    ['105000', '10,5'],
    ['999999', '99,9999'],
    ['1000000', '100'],
  ])('%s is %s', (ppm, shown) => {
    expect(percentText(ppm)).toBe(shown);
  });

  it('shows what it converts: every accepted vector comes back as its own display', () => {
    for (const [typed, ppm] of ACCEPTED) {
      const checked = checkRate(typed);
      expect(checked.ok, typed).toBe(true);
      const again = checkRate(percentText(ppm));
      expect(again, typed).toEqual({ ok: true, ppm });
    }
  });
});

describe('B-1. no floating point anywhere on the settings path', () => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/settings');
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));

  it('reads the settings sources, and the rate module among them', () => {
    expect(files).toContain('rate.ts');
  });

  for (const file of files) {
    it(`${file} calls no parseFloat, parseInt, Number(, Math.round or toFixed`, () => {
      const code = readFileSync(join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code.match(/parseFloat|parseInt|\bNumber\(|Math\.round|toFixed/g) ?? []).toEqual([]);
    });
  }
});
