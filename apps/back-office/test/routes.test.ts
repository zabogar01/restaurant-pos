import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MANIFEST, PATHS, screenAt } from '../src/routes.js';

// ADR-011 rule 11 and consult C2 section 7: the manifest holds only paths the server
// answers with the entry point, and a client path names a screen and nothing else.

describe('the route manifest', () => {
  it('lists the landing, Menu, the item editor, Tables, Discount presets and Settings', () => {
    expect(MANIFEST.map((m) => m.screen).sort()).toEqual(['item', 'landing', 'menu', 'presets', 'settings', 'tables']);
    expect(PATHS.menu).toBe('/back-office/menu');
    expect(PATHS.item).toBe('/back-office/menu/item');
    expect(PATHS.tables).toBe('/back-office/tables');
    expect(PATHS.presets).toBe('/back-office/presets');
    expect(PATHS.settings).toBe('/back-office/settings');
  });

  it('holds every path under /back-office/', () => {
    for (const { path } of MANIFEST) expect(path.startsWith('/back-office/'), path).toBe(true);
  });

  it('holds no path whose first segment is assets', () => {
    for (const { path } of MANIFEST) {
      expect(path.slice('/back-office/'.length).split('/')[0], path).not.toBe('assets');
    }
  });

  it('holds no path with a dot in its last segment', () => {
    for (const { path } of MANIFEST) {
      expect(path.split('/').pop()!.includes('.'), path).toBe(false);
    }
  });

  it('names a screen for each of its paths and for nothing else', () => {
    for (const { path, screen } of MANIFEST) expect(screenAt(path)).toBe(screen);
    for (const stray of ['/', '/back-office', '/back-office/tables/', '/back-office/tables.html', '/back-office/x'])
      expect(screenAt(stray), stray).toBeNull();
  });
});

describe('a client path names a screen and nothing else', () => {
  const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
  const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f));

  it('no source file reads the query string or the hash', () => {
    const offenders = files.filter((f) =>
      /location\.(search|hash)|URLSearchParams|useSearchParams/.test(readFileSync(join(src, f), 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
