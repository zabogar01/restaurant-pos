// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POLL_MS } from '../src/catalog/catalogStore.js';
import type { CatalogSnapshot } from '../src/catalog/types.js';
import { FAILED, MEALS, NASI, REFUSED, SATE, TEA, UNAVAILABLE, makeCatalogHarness, menuOf, ok, type CatalogHarness } from './served-harness.js';

// The served catalog store (ARCH-021 consult C4 items 3, 5 and 10): a store with no React, its timer
// injected and exactly two read functions. Time moves only when `advance` says.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let h: CatalogHarness;
let stops: Array<() => void> = [];
const start = () => {
  const stop = h.store.start();
  stops.push(stop);
  return stop;
};

beforeEach(() => {
  h = makeCatalogHarness();
  stops = [];
});
afterEach(() => {
  for (const stop of stops) stop();
  stops = [];
});

const snap = (): CatalogSnapshot => h.store.getSnapshot();
const up = async () => {
  start();
  await h.settle();
};

describe('3. the poll: when it runs, and one cycle at a time', () => {
  it('makes no request before a sign-in starts it, and none after the stop', async () => {
    await h.advance(60_000);
    expect(h.calls).toEqual([]);
    const stop = start();
    await h.settle();
    expect(h.calls).toEqual(['menu']);
    stop();
    const before = h.calls.length;
    await h.advance(60_000);
    expect(h.calls.length).toBe(before);
    expect(h.timers()).toBe(0);
  });

  it('reads the menu straight away when none is held, and the revision first when one is', async () => {
    await up();
    expect(h.calls).toEqual(['menu']);
    await h.advance(POLL_MS);
    expect(h.calls).toEqual(['menu', 'revision']);
    expect(snap().menu?.version).toBe(1);
  });

  it('reads the menu only when the revision differs from the held version', async () => {
    await up();
    await h.advance(POLL_MS * 3);
    expect(h.count('menu')).toBe(1);
    h.revision(ok({ version: 2 }));
    h.menu(ok(menuOf(2, MEALS, [NASI, { ...SATE, price: '40000' }, TEA])));
    await h.advance(POLL_MS);
    expect(h.count('menu')).toBe(2);
    expect(snap().menu?.items.find((i) => i.id === 'sate')?.price).toBe(40000n);
  });

  it('times the next cycle two seconds after the previous settled, and never overlaps two', async () => {
    await up();
    const held = h.hold<{ version: number }>();
    h.revision({ held: held.held });
    await h.advance(POLL_MS);
    expect(h.count('revision')).toBe(1);
    // The answer is held: ten seconds pass and no second cycle starts (an interval would start five).
    await h.advance(10_000);
    expect(h.count('revision')).toBe(1);
    held.deliver(ok({ version: 1 }));
    await h.settle();
    expect(h.timers()).toBe(1);
    await h.advance(POLL_MS - 1);
    expect(h.count('revision')).toBe(1);
    await h.advance(1);
    expect(h.count('revision')).toBe(2);
  });

  it('pauses while the tab is hidden and resumes with an immediate cycle', async () => {
    await up();
    h.setVisible(false);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(h.timers()).toBe(0);
    await h.advance(20_000);
    expect(h.count('revision')).toBe(0);
    h.setVisible(true);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await h.settle();
    expect(h.count('revision')).toBe(1);
  });
});

describe('4. the store can reach no route but the two reads', () => {
  it('is given exactly two functions, and its folder names no other route', () => {
    expect(Object.keys(h.reads).sort()).toEqual(['menu', 'revision']);
    const folder = resolve(dirname(fileURLToPath(import.meta.url)), '../src/catalog');
    for (const f of readdirSync(folder).filter((n) => /\.tsx?$/.test(n))) {
      // Comments may name the route they promise not to reach; the code may not.
      const code = readFileSync(join(folder, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/activity|posActivity|sendActivity|posApi|PosApi|session\/api|createApiClient|\/api\/pos\/auth/);
    }
  });
});

describe('5. a sign-in, a focus and becoming visible each run a cycle at once', () => {
  it('a focus on the window', async () => {
    await up();
    act(() => void window.dispatchEvent(new Event('focus')));
    await h.settle();
    expect(h.count('revision')).toBe(1);
    expect(h.timers()).toBe(1);
  });

  it('a focus while hidden does nothing', async () => {
    await up();
    h.setVisible(false);
    act(() => void window.dispatchEvent(new Event('focus')));
    await h.settle();
    expect(h.count('revision')).toBe(0);
  });

  it('a refresh during a cycle joins it', async () => {
    await up();
    const held = h.hold<{ version: number }>();
    h.revision({ held: held.held });
    await h.advance(POLL_MS);
    act(() => void window.dispatchEvent(new Event('focus')));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await h.settle();
    expect(h.count('revision')).toBe(1);
    held.deliver(ok({ version: 1 }));
    await h.settle();
  });

  it('a sign-in after a lock reads at once and keeps the held menu on screen meanwhile', async () => {
    const stop = start();
    await h.settle();
    const held = snap().menu;
    expect(held).not.toBeNull();
    stop();
    const waiting = h.hold<{ version: number }>();
    h.revision({ held: waiting.held });
    start();
    await h.settle();
    expect(h.count('revision')).toBe(1);
    expect(snap().menu).toBe(held);
    waiting.deliver(ok({ version: 1 }));
    await h.settle();
  });
});

describe('6. failed checks: one is silent, two are out of date, a good one clears it', () => {
  it.each([
    ['failed', FAILED],
    ['unavailable', UNAVAILABLE],
    ['refused', REFUSED],
    ['invalid-request', { kind: 'invalid-request' } as const],
    ['session-gone', { kind: 'session-gone' } as const],
  ])('%s counts as a check that did not succeed, with no code read', async (_name, failure) => {
    await up();
    h.revision(failure);
    await h.advance(POLL_MS);
    expect(snap().outOfDate).toBe(false);
    await h.advance(POLL_MS);
    expect(snap().outOfDate).toBe(true);
    expect(snap().menu?.items).toHaveLength(3);
    expect(snap().read).toBe('ready');
  });

  it('the first good check that leaves the client current clears it', async () => {
    await up();
    h.revision(FAILED);
    await h.advance(POLL_MS * 2);
    expect(snap().outOfDate).toBe(true);
    h.revision(ok({ version: 1 }));
    await h.advance(POLL_MS);
    expect(snap().outOfDate).toBe(false);
  });

  it('two failures that are not in a row never show it', async () => {
    await up();
    for (let i = 0; i < 3; i += 1) {
      h.revision(FAILED);
      await h.advance(POLL_MS);
      h.revision(ok({ version: 1 }));
      await h.advance(POLL_MS);
    }
    expect(snap().outOfDate).toBe(false);
  });

  it('keeps polling every two seconds, with no backoff, while checks fail', async () => {
    await up();
    h.revision(FAILED);
    await h.advance(POLL_MS * 10);
    expect(h.count('revision')).toBe(10);
  });
});

describe('7. the first read failing', () => {
  it('enters failure on one failed read, in the variant the result names', async () => {
    h = makeCatalogHarness(null);
    h.menu(UNAVAILABLE);
    await up();
    expect(snap()).toMatchObject({ menu: null, read: 'failed', failure: 'unavailable' });
    h.menu(FAILED);
    await h.advance(POLL_MS);
    expect(snap()).toMatchObject({ read: 'failed', failure: 'failed' });
  });

  it('background retries never turn failure back into loading, and a later good read leaves it without a press', async () => {
    h = makeCatalogHarness(null);
    const seen: Array<CatalogSnapshot['read']> = [];
    h.store.subscribe(() => seen.push(snap().read));
    await up();
    await h.advance(POLL_MS * 4);
    expect(h.count('menu')).toBe(5);
    expect(seen).not.toContain('loading');
    h.menu(ok(menuOf(3, MEALS, [NASI])));
    await h.advance(POLL_MS);
    expect(snap()).toMatchObject({ read: 'ready', failure: null });
    expect(snap().menu?.version).toBe(3);
  });

  it('Try again shows loading and repeats only the read', async () => {
    h = makeCatalogHarness(null);
    await up();
    expect(snap().read).toBe('failed');
    const held = h.hold<ReturnType<typeof menuOf>>();
    h.menu({ held: held.held });
    act(() => h.store.retry());
    expect(snap().read).toBe('loading');
    held.deliver(ok(menuOf(1, MEALS, [NASI])));
    await h.settle();
    expect(snap().read).toBe('ready');
    expect(h.count('revision')).toBe(0);
  });

  it('Try again that fails again returns to failure', async () => {
    h = makeCatalogHarness(null);
    await up();
    act(() => h.store.retry());
    await h.settle();
    expect(snap().read).toBe('failed');
  });

  it('Try again does nothing once a menu is held', async () => {
    await up();
    act(() => h.store.retry());
    expect(snap().read).toBe('ready');
  });
});

describe('8. an empty catalog is not an error', () => {
  it('is a held menu with no categories, ready, and shows nothing else', async () => {
    h = makeCatalogHarness(menuOf(1, [], []));
    await up();
    expect(snap()).toMatchObject({ read: 'ready', failure: null, outOfDate: false });
    expect(snap().menu).toMatchObject({ categories: [], items: [] });
  });
});

describe('9. an answer that settles after a lock changes nothing', () => {
  it('drops a menu read that settles after the stop', async () => {
    h = makeCatalogHarness(null);
    const held = h.hold<ReturnType<typeof menuOf>>();
    h.menu({ held: held.held });
    const stop = start();
    await h.settle();
    stop();
    held.deliver(ok(menuOf(9, MEALS, [NASI])));
    await h.settle();
    expect(snap().menu).toBeNull();
    expect(snap().read).toBe('loading');
    expect(h.timers()).toBe(0);
  });

  it('drops a revision answer that settles after the stop, and starts no timer', async () => {
    await up();
    const held = h.hold<{ version: number }>();
    h.revision({ held: held.held });
    await h.advance(POLL_MS);
    stops.pop()!();
    held.deliver(ok({ version: 2 }));
    await h.settle();
    expect(h.count('menu')).toBe(1);
    expect(h.timers()).toBe(0);
  });

  it('a sign-in right after a stop is not blocked by the dead cycle still in flight', async () => {
    h = makeCatalogHarness(null);
    h.menu('hang');
    const stop = start();
    await h.settle();
    stop();
    h.menu(ok(menuOf(1, MEALS, [NASI])));
    start();
    await h.settle();
    expect(snap().menu?.version).toBe(1);
  });
});

describe('10. a new version and its contents appear together', () => {
  it('holds the version the menu read answered, never the one the poll last saw', async () => {
    await up();
    const held = h.hold<ReturnType<typeof menuOf>>();
    h.revision(ok({ version: 5 }));
    h.menu({ held: held.held });
    await h.advance(POLL_MS);
    // The poll has seen 5; the screen still shows 1 and its contents.
    expect(snap().menu?.version).toBe(1);
    expect(snap().menu?.items).toHaveLength(3);
    held.deliver(ok(menuOf(6, MEALS, [NASI])));
    await h.settle();
    expect(snap().menu?.version).toBe(6);
    expect(snap().menu?.items).toHaveLength(1);
  });

  it('replaces the whole object, and adopts a lower number: a restored database', async () => {
    await up();
    const before = snap().menu;
    h.revision(ok({ version: 0 }));
    h.menu(ok(menuOf(0, MEALS, [NASI])));
    await h.advance(POLL_MS);
    expect(snap().menu).not.toBe(before);
    expect(snap().menu?.version).toBe(0);
  });
});

describe('the one point money enters', () => {
  it('decodes a price and a delta to bigint, exactly', async () => {
    const response = menuOf(1, MEALS, [{ ...NASI, price: '99999999' }]);
    response.items[0]!.variants = [{ variantId: 'v', name: 'Small', priceDelta: '-10000' }];
    response.items[0]!.modifiers = [{ modifierId: 'm', name: 'Egg', priceDelta: '5000' }];
    h = makeCatalogHarness(response);
    await up();
    const item = snap().menu!.items[0]!;
    expect(item.price).toBe(99999999n);
    expect(item.variants[0]!.delta).toBe(-10000n);
    expect(item.modifiers[0]!.delta).toBe(5000n);
  });

  it('a body that does not decode is a failed check, not a crash', async () => {
    h = makeCatalogHarness(menuOf(1, MEALS, [{ ...NASI, price: '045' }]));
    await up();
    expect(snap()).toMatchObject({ menu: null, read: 'failed' });
  });
});

describe('availability changes are counted once for each accepted change', () => {
  it('counts an 86, none for an unchanged poll, and none for an archive', async () => {
    await up();
    expect(snap().availabilityChanges).toBe(0);
    h.revision(ok({ version: 2 }));
    h.menu(ok(menuOf(2, MEALS, [{ ...NASI, available: false }, SATE, TEA])));
    await h.advance(POLL_MS);
    expect(snap().availabilityChanges).toBe(1);
    await h.advance(POLL_MS * 3);
    expect(snap().availabilityChanges).toBe(1);
    h.revision(ok({ version: 3 }));
    h.menu(ok(menuOf(3, MEALS, [SATE, TEA])));
    await h.advance(POLL_MS);
    expect(snap().availabilityChanges).toBe(1);
  });
});
