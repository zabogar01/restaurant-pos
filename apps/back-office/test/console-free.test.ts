import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// B-12 as a habit: the client source has no console call and no persistence API at
// all, so no debugging line can carry a password out of the field. Recursive: a
// file in a subdirectory of src (session/) is read like any other.
const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const sources = () => readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f));

it('back-office source never calls console, storage, a cookie, a beacon or the network', () => {
  const files = sources();
  expect(files).toContain(join('session', 'realSession.ts'));
  const offenders = files
    .flatMap((f) =>
      readFileSync(join(src, f), 'utf8')
        .split('\n')
        .map((line, i) => ({ where: `${f}:${i + 1}`, line }))
        .filter(({ line }) => /\bconsole\.|localStorage|sessionStorage|indexedDB|document\.cookie|\bfetch\(|XMLHttpRequest|sendBeacon|navigator\.sendBeacon|new WebSocket|new EventSource/.test(line))
    )
    .map((o) => o.where);
  expect(offenders).toEqual([]);
});

it('exactly one module constructs the API client', () => {
  const constructing = sources().filter((f) => /\bcreateApiClient\(/.test(readFileSync(join(src, f), 'utf8')));
  expect(constructing).toEqual([join('session', 'realSession.ts')]);
});

it('the page’s own fetch is named in one module, and as a value, never called', () => {
  const naming = sources().filter((f) => /\bfetch\b/.test(readFileSync(join(src, f), 'utf8').replace(/\/\/.*$/gm, '')));
  expect(naming).toEqual([join('session', 'realSession.ts')]);
});
