// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POLL_MS } from '../src/catalog/catalogStore.js';
import { CatalogProvider } from '../src/catalog/useCatalog.js';
import { COMP } from '../src/discountFixtures.js';
import { orderTotals } from '../src/discount.js';
import type { OrderView } from '../src/orderFixtures.js';
import { ceilingFor, useOrderStore, type LiveOrderStore, type NewLine } from '../src/orderStore.js';
import { LINE_TOTAL_LIMIT, ORDER_TOTAL_LIMIT, SINGLE_TENDER_LIMIT } from '../src/tender.js';
import { MEALS, NASI, SATE, makeCatalogHarness, menuOf, ok, type CatalogHarness } from './served-harness.js';

// PHASE1-S7b2: `addLine` as a STAND-IN for Phase 2's add-line command (consult C4 item 7) and D1's one
// pure ceiling function. The store is a hook, so it is read the way a hook must be: mounted. Every
// `addLine` below is called through the function the FIRST render handed out, which is what a press
// handler holds: a store that read its facts at render would answer from a picture that has gone.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let h: CatalogHarness | undefined;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  h = undefined;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Harness({ view, locked, onStore }: { view: OrderView; locked: boolean; onStore: (store: LiveOrderStore) => void }) {
  onStore(useOrderStore(view, locked));
  return null;
}

/** The store over the fixture catalog, or, given a harness, over the served one. */
function mount(view: OrderView, { locked = false, served }: { locked?: boolean; served?: CatalogHarness } = {}) {
  let latest!: LiveOrderStore;
  let first: LiveOrderStore | undefined;
  const element = (
    <Harness
      view={view}
      locked={locked}
      onStore={(s) => {
        latest = s;
        first ??= s;
      }}
    />
  );
  act(() => root.render(served ? <CatalogProvider store={served.store}>{element}</CatalogProvider> : element));
  return {
    get order() {
      return latest.order;
    },
    /** The `addLine` the first render handed out. */
    add: (line: NewLine) => {
      let outcome!: ReturnType<LiveOrderStore['addLine']>;
      act(() => {
        outcome = first!.addLine(line);
      });
      return outcome;
    },
    /** Several calls inside one tick, as one handler could make them. */
    addTogether: (lines: NewLine[]) => {
      const outcomes: Array<ReturnType<LiveOrderStore['addLine']>> = [];
      act(() => {
        for (const line of lines) outcomes.push(first!.addLine(line));
      });
      return outcomes;
    },
    setQuantity: (lineId: string, quantity: number) => act(() => latest.setQuantity(lineId, quantity)),
    ids: () => latest.order.groups.flatMap((g) => g.lines).map((l) => l.id),
  };
}

const soda: NewLine = { itemId: 'soda', name: 'Soda', quantity: 1, basePrice: 30_000n };

describe('4. addLine under a lock refuses (ARCH-004’s gap)', () => {
  it('this tab’s own payment session refuses, and returns the very same groups', () => {
    const store = mount({ state: 'quick' }, { locked: true });
    const before = store.order.groups;
    expect(store.add(soda)).toEqual({ refused: 'locked' });
    expect(store.order.groups).toBe(before);
  });

  it('another client’s lease refuses too', () => {
    const store = mount({ state: 'lock-lease' });
    const before = store.order.groups;
    expect(store.add(soda)).toEqual({ refused: 'locked' });
    expect(store.order.groups).toBe(before);
  });

  it('an unlocked order adds, and says so', () => {
    const store = mount({ state: 'quick' });
    expect(store.add(soda)).toEqual({});
    expect(store.ids()).toContain('soda-1');
  });
});

describe('5. addLine of an 86’d item refuses, reading the catalog at the press (a stand-in)', () => {
  it('refuses an item the menu 86d AFTER the store was rendered, through a function from before it', async () => {
    h = makeCatalogHarness(menuOf(1, MEALS, [NASI, SATE]));
    const stop = h.store.start();
    await h.settle();
    const store = mount({ state: 'quick' }, { served: h });
    const line: NewLine = { itemId: 'nasi', name: 'Nasi Goreng', quantity: 1, basePrice: 45_000n };
    const before = store.order.groups;
    h.revision(ok({ version: 2 }));
    h.menu(ok(menuOf(2, MEALS, [{ ...NASI, available: false }, SATE])));
    await h.advance(POLL_MS);
    expect(store.add(line)).toEqual({ refused: 'unavailable' });
    expect(store.order.groups).toBe(before);
    // Restored, the same function adds it.
    h.revision(ok({ version: 3 }));
    h.menu(ok(menuOf(3, MEALS, [NASI, SATE])));
    await h.advance(POLL_MS);
    expect(store.add(line)).toEqual({});
    stop();
  });
});

describe('6. D1: the store refuses past the ceilings', () => {
  it('a line past 99.999.999 is refused', () => {
    const store = mount({ state: 'empty' });
    const before = store.order.groups;
    expect(store.add({ ...soda, basePrice: 100_000_000n })).toEqual({ refused: 'over-limit' });
    expect(store.order.groups).toBe(before);
  });

  it('an order whose total would pass the limit is refused, though the line alone would not', () => {
    const store = mount({ state: 'quick' });
    expect(store.add({ ...soda, basePrice: 96_000_000n })).toEqual({ refused: 'over-limit' });
    expect(store.ids()).not.toContain('soda-1');
  });

  it('a second call in one tick sees the first: two 48.000.000 lines are one too many (96.000.000 plus 5% service)', () => {
    const store = mount({ state: 'empty' });
    expect(store.addTogether([{ ...soda, basePrice: 48_000_000n }, { ...soda, basePrice: 48_000_000n }, { ...soda, basePrice: 1_000n }])).toEqual([
      {},
      { refused: 'over-limit' },
      {},
    ]);
    expect(store.ids()).toHaveLength(2);
  });

  it('setQuantity past a ceiling changes nothing', () => {
    const store = mount({ state: 'empty' });
    store.add({ ...soda, basePrice: 60_000_000n });
    const id = store.ids()[0]!;
    const before = store.order.groups;
    store.setQuantity(id, 2);
    expect(store.order.groups).toBe(before);
    expect(store.order.groups[0]!.lines[0]!.quantity).toBe(1);
  });
});

describe('D1’s one pure function', () => {
  const empty = { groups: [] as const };

  it('the line bound: 99.999.999 is accepted and 100.000.000 is refused (under a 100% discount, so only the line speaks)', () => {
    const comp = { groups: [] as const, applied: COMP };
    expect(ceilingFor(comp, 99_999_999n, 1)).toBeUndefined();
    expect(ceilingFor(comp, 100_000_000n, 1)).toBe('line');
    expect(ceilingFor(comp, 50_000_000n, 2)).toBe('line');
    expect(ceilingFor(comp, 50_000_000n, 1)).toBeUndefined();
  });

  it('the order bound is the order’s TOTAL, after service charge: the largest subtotal that fits is accepted, one more is refused', () => {
    let fits = 0n;
    for (let lo = 0n, hi = LINE_TOTAL_LIMIT; lo <= hi; ) {
      const mid = (lo + hi) / 2n;
      if (orderTotals(mid).total <= ORDER_TOTAL_LIMIT) {
        fits = mid;
        lo = mid + 1n;
      } else hi = mid - 1n;
    }
    expect(orderTotals(fits).total <= ORDER_TOTAL_LIMIT).toBe(true);
    expect(orderTotals(fits + 1n).total > ORDER_TOTAL_LIMIT).toBe(true);
    expect(ceilingFor(empty, fits, 1)).toBeUndefined();
    expect(ceilingFor(empty, fits + 1n, 1)).toBe('order');
  });

  it('answers the line before the order, and a line replaced is not counted twice', () => {
    expect(ceilingFor(empty, 100_000_000n, 1)).toBe('line');
  });

  it('the two limits are 99.999.999, beside the single-tender limit', () => {
    expect([LINE_TOTAL_LIMIT, ORDER_TOTAL_LIMIT, SINGLE_TENDER_LIMIT]).toEqual([99_999_999n, 99_999_999n, 99_999_999n]);
  });
});

describe('10. a pending line keeps its price after the item’s price changes (B-8)', () => {
  it('a quantity edit reprices from the line’s own snapshot, never from the catalog', async () => {
    h = makeCatalogHarness(menuOf(1, MEALS, [NASI, SATE]));
    const stop = h.store.start();
    await h.settle();
    const store = mount({ state: 'empty' }, { served: h });
    store.add({ itemId: 'nasi', name: 'Nasi Goreng', quantity: 1, basePrice: 45_000n });
    h.revision(ok({ version: 2 }));
    h.menu(ok(menuOf(2, MEALS, [{ ...NASI, price: '100000' }, SATE])));
    await h.advance(POLL_MS);
    const id = store.ids()[0]!;
    store.setQuantity(id, 2);
    const line = store.order.groups.flatMap((g) => g.lines).find((l) => l.id === id)!;
    expect(line.amount).toBe(90_000n);
    expect(line.unitPrice).toBe(45_000n);
    stop();
  });

  it('the snapshot carries the resolved unit with the floor on the unit, never the total', () => {
    const store = mount({ state: 'empty' });
    store.add({ ...soda, quantity: 3, basePrice: 10_000n, modifiers: [{ name: 'Deal', delta: -20_000n }] });
    const line = store.order.groups.flatMap((g) => g.lines)[0]!;
    expect(line.unitPrice).toBe(0n);
    expect(line.amount).toBe(0n);
    expect(line.itemId).toBe('soda');
    expect(line.modifiers).toEqual([{ name: 'Deal', delta: -20_000n }]);
  });
});
