import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The pressed order-line ring borrows a spacing token for its offset
// (frost-states.css:58, token form per DESIGN-005, lead ruling 2026-09-16).
// That is right — the offset is carved out of the row's own padding, so it
// should track the spacing scale — but it couples two things nothing else
// watches. Retune --frost-space-2 for layout and the ring silently crosses
// the gap into the trailing slot, and I-12 breaks on screen with every other
// test green. This file makes the coupling a checked one: the offset stays
// within the row's padding and short of the row gap to the slot.

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../src/pos.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const registry = readFileSync(resolve(here, '../../../docs/design/tokens/frost.css'), 'utf8');
const tokens = new Map([...registry.matchAll(/(--frost-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));

type Rule = { selectors: string[]; decls: Map<string, string> };

// Innermost blocks only, which is every style rule in this sheet.
const rules: Rule[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selectors: m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
  decls: new Map(
    m[2]!
      .split(';')
      .map((d) => d.split(/:(.*)/s).map((p) => p.trim()))
      .filter((p): p is [string, string] => Boolean(p[0] && p[1]))
      .map(([k, v]) => [k, v] as const)
  ),
}));

const ruleFor = (selector: string) => rules.filter((r) => r.selectors.includes(selector));

/** Pixel lengths of a registry token, e.g. --frost-line-padding → [10, 16]. */
function px(token: string): number[] {
  const value = tokens.get(token);
  if (value === undefined) throw new Error(`${token} is not in the registry`);
  const parts = value.split(/\s+/).map((p) => /^(\d*\.?\d+)px$/.exec(p));
  if (parts.some((p) => !p)) throw new Error(`${token} is not a pixel length: ${value}`);
  return parts.map((p) => Number.parseFloat(p![1]!));
}

const varName = (value: string | undefined, shape: RegExp) => shape.exec(value ?? '')?.[1];

/** Whether a ring pushed `offset` out from the target stays in the row's padding and short of the slot gap. */
function ringClears({ offset, rowPadding, gap }: { offset: number; rowPadding: number[]; gap: number }) {
  return offset > 0 && offset <= Math.min(...rowPadding) && offset < gap;
}

describe('the clearance rule can fail', () => {
  it('accepts the designed 8px inside 10px 16px padding and a 12px gap', () => {
    expect(ringClears({ offset: 8, rowPadding: [10, 16], gap: 12 })).toBe(true);
  });

  it('rejects an offset that reaches the slot gap, or leaves the row padding', () => {
    expect(ringClears({ offset: 12, rowPadding: [10, 16], gap: 12 })).toBe(false);
    expect(ringClears({ offset: 16, rowPadding: [16, 16], gap: 20 })).toBe(true);
    expect(ringClears({ offset: 16, rowPadding: [16, 16], gap: 16 })).toBe(false);
    expect(ringClears({ offset: 11, rowPadding: [10, 16], gap: 24 })).toBe(false);
  });
});

describe('the pressed order-line ring stays off the trailing slot', () => {
  const row = ruleFor('.order-line');
  const ringSelectors = ['a.order-line__target:active', '.order-line__target.is-pressed'];

  it('reads the row geometry from registry tokens', () => {
    expect(row).toHaveLength(1);
  });

  for (const selector of ringSelectors) {
    it(`${selector}: offset is one token, applied as an equal negative margin and padding`, () => {
      const geometry = ruleFor(selector).filter((r) => r.decls.has('margin') || r.decls.has('padding'));
      expect(geometry).toHaveLength(1);
      const { decls } = geometry[0]!;
      const padding = varName(decls.get('padding'), /^var\((--frost-[\w-]+)\)$/);
      const margin = varName(decls.get('margin'), /^calc\(\s*-1\s*\*\s*var\((--frost-[\w-]+)\)\s*\)$/);
      expect(padding).toBeDefined();
      expect(margin).toBe(padding);
      expect(decls.get('border-radius')).toBe('var(--frost-radius-surface)');
    });

    it(`${selector}: offset stays within the row padding and short of the gap to the slot`, () => {
      const [geometry] = ruleFor(selector).filter((r) => r.decls.has('padding'));
      const offsetToken = varName(geometry!.decls.get('padding'), /^var\((--frost-[\w-]+)\)$/)!;
      const paddingToken = varName(row[0]!.decls.get('padding'), /^var\((--frost-[\w-]+)\)$/)!;
      const gapToken = varName(row[0]!.decls.get('gap'), /^var\((--frost-[\w-]+)\)$/)!;

      const [offset] = px(offsetToken);
      const rowPadding = px(paddingToken);
      const [gap] = px(gapToken);

      expect({ offsetToken, offset, paddingToken, rowPadding, gapToken, gap, clears: ringClears({ offset: offset!, rowPadding, gap: gap! }) })
        .toMatchObject({ clears: true });
    });
  }
});

describe('the round-group tag', () => {
  it('is set at --frost-round-tag-size, 13px (A7)', () => {
    const [tag] = ruleFor('.round-head__tag');
    expect(tag!.decls.get('font-size')).toBe('var(--frost-round-tag-size)');
    expect(px('--frost-round-tag-size')).toEqual([13]);
  });

  it('carries its push to the right in a class, not an inline style', () => {
    const [tag] = ruleFor('.round-head__tag');
    expect(tag!.decls.get('margin-left')).toBe('auto');
  });
});
