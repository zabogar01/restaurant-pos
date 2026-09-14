import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../frost.css');

describe('@pos/tokens', () => {
  const source = readFileSync(entry, 'utf8');
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');

  it('re-exports the registry rather than copying it', () => {
    const imports = [...withoutComments.matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(['../../docs/design/tokens/frost.css']);
    expect(existsSync(resolve(dirname(entry), imports[0]!))).toBe(true);
  });

  it('declares no custom property of its own', () => {
    expect(withoutComments).not.toMatch(/--[\w-]+\s*:/);
  });
});
