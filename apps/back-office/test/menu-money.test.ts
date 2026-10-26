import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { priceText } from '../src/menu/money.js';

// BO-03's prices (PHASE1-S4c1 ruling 7, criterion 3): the stored tax-inclusive base price as
// whole rupiah with dot grouping and no currency symbol, never through a double (B-1).

describe('priceText', () => {
  it('groups with dots and carries no currency symbol', () => {
    expect(priceText('99999999')).toBe('99.999.999');
    expect(priceText('0')).toBe('0');
    expect(priceText('100000')).toBe('100.000');
    expect(priceText('40000')).toBe('40.000');
    expect(priceText('5')).toBe('5');
    expect(priceText('1000')).toBe('1.000');
  });
});

describe('B-1. no floating point anywhere on the menu path', () => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/menu');
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));

  it('reads the menu sources, and the money module among them', () => {
    expect(files).toContain('money.ts');
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
