import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Touch browsers synthesise :hover on tap and hold it after the finger lifts.
// Frost's tile hover is the ink selected fill, so an unscoped hover rule leaves
// a tapped control looking selected once the pressed ring goes (DESIGN-005,
// design-reviewer finding 1). A comment asking for @media (hover: hover) did
// not stop that; this test does.

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../src');

const cssFiles = (readdirSync(src, { recursive: true }) as string[])
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ name: f, text: readFileSync(join(src, f), 'utf8') }));

const HOVER_MEDIA = /^@media\s*\(\s*hover\s*:\s*hover\s*\)(\s+and\s+\([^()]*\))*\s*$/i;

/** Every selector containing :hover that is not inside @media (hover: hover). */
function unscopedHoverSelectors(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack: string[] = [];
  const found: string[] = [];
  let start = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '{') {
      const prelude = code.slice(start, i).trim().replace(/\s+/g, ' ');
      if (!prelude.startsWith('@') && /:hover\b/.test(prelude) && !stack.some((p) => HOVER_MEDIA.test(p))) {
        found.push(prelude);
      }
      stack.push(prelude);
      start = i + 1;
    } else if (c === '}') {
      stack.pop();
      start = i + 1;
    } else if (c === ';') {
      start = i + 1;
    }
  }
  return found;
}

describe('the hover detector can see a hover rule', () => {
  it('flags a hover rule at the top level', () => {
    expect(unscopedHoverSelectors('.tile:hover { color: red; }')).toEqual(['.tile:hover']);
  });

  it('flags a hover rule inside a media query that is not (hover: hover)', () => {
    expect(unscopedHoverSelectors('@media (min-width: 1px) { .a, .b:hover { color: red; } }')).toEqual(['.a, .b:hover']);
    expect(unscopedHoverSelectors('@media (hover: none) { .a:hover { color: red; } }')).toEqual(['.a:hover']);
    expect(unscopedHoverSelectors('@media not all and (hover: hover) { .a:hover { color: red; } }')).toEqual(['.a:hover']);
    expect(unscopedHoverSelectors('@media (hover: none), (hover: hover) { .a:hover { color: red; } }')).toEqual(['.a:hover']);
  });

  it('accepts a hover rule inside @media (hover: hover), including nested and narrowed', () => {
    expect(unscopedHoverSelectors('@media (hover: hover) { .a:hover { color: red; } }')).toEqual([]);
    expect(unscopedHoverSelectors('@media (hover:hover) and (pointer: fine) { .a:hover { x: y; } }')).toEqual([]);
    expect(unscopedHoverSelectors('@media (hover: hover) { @supports (display: grid) { .a:hover { x: y; } } }')).toEqual([]);
  });

  it('ignores :hover in a comment', () => {
    expect(unscopedHoverSelectors('/* .a:hover { } */ .a { x: y; }')).toEqual([]);
  });
});

describe('POS hover rules are scoped to devices that can hover', () => {
  it('finds the POS stylesheets', () => {
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  for (const { name, text } of cssFiles) {
    it(`${name}: every :hover sits inside @media (hover: hover)`, () => {
      expect(unscopedHoverSelectors(text)).toEqual([]);
    });
  }
});
