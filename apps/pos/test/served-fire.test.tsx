// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { POLL_MS } from '../src/catalog/catalogStore.js';
import { blockingLines, fireRefusal } from '../src/fire.js';
import {
  MEALS,
  NASI,
  SATE,
  TEA,
  makeCatalogHarness,
  menuOf,
  mountServed,
  ok,
  type CatalogHarness,
  type ServedItem,
} from './served-harness.js';

// PHASE1-S7b2: the fire refusal for real pending lines (consult C4 For DESIGN-021 5; DESIGN-021's plural),
// and R1 in the order panel. A line is added through M-2, so the line under test is the one the store
// creates, not a fixture's.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let h: CatalogHarness;
let screen: ReturnType<typeof mountServed> | undefined;
let version = 1;

afterEach(() => {
  screen?.unmount();
  screen = undefined;
  window.history.replaceState(null, '', '/pos/order');
});

async function open(items: ServedItem[], view?: Parameters<typeof mountServed>[1]) {
  h = makeCatalogHarness(menuOf(1, MEALS, items));
  version = 1;
  screen = mountServed(h, view);
  await h.settle();
}

async function change(items: ServedItem[]) {
  version += 1;
  h.revision(ok({ version }));
  h.menu(ok(menuOf(version, MEALS, items)));
  await h.advance(POLL_MS);
}

const q = (selector: string) => screen!.host.querySelector<HTMLElement>(selector);
const press = (el: Element | null) => act(() => (el as HTMLElement).click());
const addFromSheet = (itemId: string) => {
  press(q(`.menu-tile[data-item="${itemId}"]`));
  press([...screen!.host.querySelectorAll<HTMLButtonElement>('.sheet button')].find((b) => b.textContent === 'Add to order')!);
};
const send = () => q('[data-action="fire"]')!;
const refusal = () => q('#fire-refusal');
const bolds = () => [...(refusal()?.querySelectorAll('b') ?? [])].map((b) => b.textContent);

describe('9. fire blocked for a real pending line, cleared by restoring', () => {
  it('an 86 after Add blocks the fire and tags the line; restoring clears both', async () => {
    await open([NASI, SATE, TEA], { state: 'empty' });
    addFromSheet('nasi');
    expect(send().getAttribute('aria-disabled')).toBeNull();
    await change([{ ...NASI, available: false }, SATE, TEA]);
    expect(send().getAttribute('aria-disabled')).toBe('true');
    expect(refusal()!.querySelector('.notice__title')!.textContent).toBe('Cannot send to the kitchen');
    expect(refusal()!.textContent).toContain('1 pending line is no longer available: Nasi Goreng. Void that line or ask a manager to put the item back on.');
    expect(q('.order-line .tag-86')).not.toBeNull();
    await change([NASI, SATE, TEA]);
    expect(refusal()).toBeNull();
    expect(send().getAttribute('aria-disabled')).toBeNull();
    expect(q('.order-line .tag-86')).toBeNull();
  });

  it('two lines of one item count as lines and name the item once, in the singular for the item', async () => {
    await open([NASI, SATE, TEA], { state: 'empty' });
    addFromSheet('nasi');
    addFromSheet('nasi');
    await change([{ ...NASI, available: false }, SATE, TEA]);
    expect(refusal()!.textContent).toContain('2 pending lines are no longer available: Nasi Goreng. Void those lines or ask a manager to put the item back on.');
    expect(bolds()).toEqual(['Nasi Goreng']);
  });

  it('two items are named once each, in first-line order, and the items are plural', async () => {
    await open([NASI, SATE, TEA], { state: 'empty' });
    addFromSheet('sate');
    addFromSheet('nasi');
    addFromSheet('sate');
    await change([{ ...NASI, available: false }, { ...SATE, available: false }, TEA]);
    expect(refusal()!.textContent).toContain('3 pending lines are no longer available: Sate Ayam, Nasi Goreng. Void those lines or ask a manager to put the items back on.');
    expect(bolds()).toEqual(['Sate Ayam', 'Nasi Goreng']);
  });

  it('a fixture line with itemId steak beside a served 86’d item NAMED Steak does not block', async () => {
    // The default order holds a pending fixture Steak line (itemId 'steak'). The served menu's Steak has a UUID.
    const steak: ServedItem = { id: '6d1c3f6e-1b0a-4c43-9d57-8a4a3a7a0001', category: 'meals', name: 'Steak', price: '240000', available: false };
    await open([steak, SATE, TEA], { state: 'default' });
    expect(refusal()).toBeNull();
    expect(send().getAttribute('aria-disabled')).toBeNull();
    expect(q('.order-line[data-line-id="steak"] .tag-86')).toBeNull();
  });

  it('a pending line whose item was archived does not block and is not marked', async () => {
    await open([NASI, SATE, TEA], { state: 'empty' });
    addFromSheet('nasi');
    await change([SATE, TEA]);
    expect(refusal()).toBeNull();
    expect(send().getAttribute('aria-disabled')).toBeNull();
    expect(q('.order-line .tag-86')).toBeNull();
  });
});

describe('fire.ts: the plural counts lines, dedupes names by item id, and counts items by distinct items', () => {
  const line = (itemId: string, name: string) => ({ id: `${itemId}-${name}`, itemId, name, status: 'pending' as const });

  it('two different items that share a NAME are still two items (compared by id, not by name)', () => {
    const refusal = fireRefusal([line('a', 'Steak'), line('b', 'Steak')])!;
    expect(refusal.names).toEqual(['Steak', 'Steak']);
    expect(refusal.resolution).toBe('Void those lines or ask a manager to put the items back on.');
  });

  it('the same item on two lines is one name and one item', () => {
    const refusal = fireRefusal([line('a', 'Steak'), line('a', 'Steak')])!;
    expect(refusal.lead).toBe('2 pending lines are no longer available:');
    expect(refusal.names).toEqual(['Steak']);
    expect(refusal.resolution).toBe('Void those lines or ask a manager to put the item back on.');
  });

  it('keeps the reviewed singular word for word', () => {
    const refusal = fireRefusal([line('a', 'Steak')])!;
    expect(refusal.lead).toBe('1 pending line is no longer available:');
    expect(refusal.resolution).toBe('Void that line or ask a manager to put the item back on.');
  });

  it('a line with no item never blocks, whatever the names', () => {
    expect(blockingLines([{ status: 'pending' as const, name: 'Steak' }], ['Steak'])).toEqual([]);
  });
});

describe('13. R1 in the order panel: a long name wraps in full beside an intact quantity, amount and slot', () => {
  const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/pos.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) =>
    [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1]!.split(',').map((s) => s.trim()).includes(selector))
      .map((m) => m[2]!)
      .join(';');
  const W64 = 'W'.repeat(64);

  it('the line carries all 64 code points of the name, in the row’s name span', async () => {
    await open([{ ...NASI, name: W64 }, SATE, TEA], { state: 'empty' });
    addFromSheet('nasi');
    const row = q('.order-line[data-line-id^="nasi-"]')!;
    expect(row.querySelector('.order-line__name')!.textContent).toBe(W64);
    expect([...W64]).toHaveLength(64);
    expect(row.querySelector('.order-line__quantity')!.textContent).toBe('1');
    expect(row.querySelector('.order-line__amount')!.textContent).toBe('45.000');
    expect(row.querySelector('.order-line__slot .order-line__remove')).not.toBeNull();
  });

  it('is never ellipsized or clipped, and may break inside a name with no space, within a body that can shrink', () => {
    const name = rule('.order-line__name');
    expect(name).not.toMatch(/text-overflow\s*:\s*ellipsis/);
    expect(name).not.toMatch(/white-space\s*:\s*nowrap/);
    expect(name).not.toMatch(/-webkit-line-clamp/);
    expect(name).not.toMatch(/overflow\s*:\s*hidden/);
    expect(name).toMatch(/overflow-wrap\s*:\s*anywhere/);
    expect(rule('.order-line__body')).toMatch(/min-width\s*:\s*0/);
    expect(rule('.order-line__amount')).toMatch(/white-space\s*:\s*nowrap/);
    expect(rule('.order-line__quantity')).not.toMatch(/overflow/);
  });
});
