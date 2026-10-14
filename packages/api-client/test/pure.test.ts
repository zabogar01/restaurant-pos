import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'src');

// Strip comments so a word in prose is not a use.
const code = (file: string) =>
  readFileSync(join(SRC, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the package is a transport and nothing else', () => {
  const files = readdirSync(SRC).filter((name) => name.endsWith('.ts'));

  it('has source to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file}: no react, DOM, console, storage, cookie, beacon, wall clock or absolute URL`, () => {
      const text = code(file);
      for (const forbidden of [
        /\breact\b/,
        /\bdocument\b/,
        /\bwindow\b/,
        /\bconsole\b/,
        /\blocalStorage\b/,
        /\bsessionStorage\b/,
        /\bsendBeacon\b/,
        /\bcookie\b/i,
        /Date\.now|new Date\(/,
        /https?:/,
        /127\.0\.0\.1/,
        /\bimport\.meta\b/,
      ]) {
        expect(text, `${file} matches ${forbidden}`).not.toMatch(forbidden);
      }
    });
  }
});
