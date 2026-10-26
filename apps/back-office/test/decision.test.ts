import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// PHASE1-S4c1 ruling 15, criterion 14. The stay-or-discard decision is one component, in
// `forms/`, used by BO-05, BO-08 and BO-03, with the body chosen by the caller. A third copy
// was the point at which S3b said to extract it.

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const files = readdirSync(src, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ name: f.replaceAll('\\', '/'), text: readFileSync(join(src, f), 'utf8') }));

const DEFINITION = /\b(?:function|const|class)\s+Decision\b/g;

describe('the departure decision is defined once', () => {
  it('has exactly one definition of Decision in src, in forms/', () => {
    const found = files.flatMap((f) => (f.text.match(DEFINITION) ?? []).map(() => f.name));
    expect(found).toEqual(['forms/Decision.tsx']);
  });

  it('is imported by Tables, Settings and Menu', () => {
    for (const name of ['tables/Tables.tsx', 'settings/Settings.tsx', 'menu/Menu.tsx']) {
      const text = files.find((f) => f.name === name)?.text ?? '';
      expect(text, name).toMatch(/from '\.\.\/forms\/Decision\.js'/);
    }
  });
});
