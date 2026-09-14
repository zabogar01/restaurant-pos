import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// B-12 as a habit: the client source has no console call and no persistence
// API at all, so no debugging line can carry a PIN out of the pad.
const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

it('POS source never calls console, storage, or the network', () => {
  const offenders = readdirSync(src)
    .filter((f) => /\.tsx?$/.test(f))
    .flatMap((f) =>
      readFileSync(join(src, f), 'utf8')
        .split('\n')
        .map((line, i) => ({ where: `${f}:${i + 1}`, line }))
        .filter(({ line }) => /\bconsole\.|localStorage|sessionStorage|indexedDB|document\.cookie|\bfetch\(|XMLHttpRequest|sendBeacon/.test(line))
    )
    .map((o) => o.where);
  expect(offenders).toEqual([]);
});
