import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// PHASE1-S8b criterion 10: the session re-stamp exists only for the acting manager's own
// session (ADR-009 section 5), so exactly one module may call it. A scan of every source
// file under apps/server/src and apps/server/scripts holds the list: the function's own
// module defines it and the users module is its only caller.

const NAME = 'restampOwnSession';
const server = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED = ['src/domain/session.ts', 'src/domain/users.ts'];

function sources(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(dir, file));
}

describe('the re-stamp has one caller', () => {
  const files = [...sources(join(server, 'src')), ...sources(join(server, 'scripts'))];

  it('10. is named by the session module and the users module, and by no other file under src or scripts', () => {
    expect(files.length).toBeGreaterThan(20);
    const naming = files
      .filter((file) => readFileSync(file, 'utf8').includes(NAME))
      .map((file) => relative(server, file))
      .sort();
    expect(naming).toEqual(ALLOWED);
  });
});
