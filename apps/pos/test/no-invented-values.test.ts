import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Acceptance criterion 5: every value traces to docs/DESIGN.md or the token
// registry. Checked against the source, so a retyped value fails here rather
// than in a review.

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../src');
const registry = readFileSync(resolve(here, '../../../docs/design/tokens/frost.css'), 'utf8');
const known = new Set([...registry.matchAll(/(--frost-[\w-]+)\s*:/g)].map((m) => m[1]));

const files = readdirSync(src)
  .filter((f) => /\.(css|tsx?)$/.test(f))
  .map((f) => ({ name: f, text: readFileSync(join(src, f), 'utf8') }));

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('POS styles use the Frost registry only', () => {
  it('reads a registry with tokens in it', () => {
    expect(known.size).toBeGreaterThan(100);
  });

  for (const { name, text } of files) {
    const code = stripComments(text);

    it(`${name}: no literal colour`, () => {
      expect(code.match(/#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch)\(/gi) ?? []).toEqual([]);
    });

    it(`${name}: no literal length other than a 1px border`, () => {
      const lengths = [...code.matchAll(/(?<![\w-])(\d*\.?\d+)(px|rem|em|pt)\b/g)].map((m) => m[0]);
      expect(lengths.filter((l) => l !== '1px')).toEqual([]);
    });

    it(`${name}: no literal font weight, size or line height`, () => {
      expect(code.match(/(font-weight|font-size|line-height|letter-spacing)\s*:\s*[\d.]/g) ?? []).toEqual([]);
      expect(code.match(/(fontWeight|fontSize|lineHeight)\s*:/g) ?? []).toEqual([]);
    });

    it(`${name}: every var(--frost-*) exists in the registry`, () => {
      const used = [...code.matchAll(/var\((--frost-[\w-]+)\)/g)].map((m) => m[1]!);
      expect(used.filter((t) => !known.has(t))).toEqual([]);
    });
  }
});
