// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OrderView } from '../src/orderFixtures.js';
import { useOrderBook, type OrderBook, type OrderStore } from '../src/orderStore.js';

// FE-026 rules 1 and 2: the book. A book holding one order is the old store
// (every pre-existing test is that proof); these hold what is new.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

/** Mounts the hook and hands back its latest value. */
function mountBook(initial: OrderView, showing = true) {
  const out: { store: OrderStore; book: OrderBook; view: OrderView } = {} as never;
  const setView: { current: (v: OrderView) => void } = { current: () => {} };
  function Probe() {
    const [view, set] = useState(initial);
    setView.current = set;
    Object.assign(out, useOrderBook(view, false, showing), { view });
    return null;
  }
  act(() => root.render(<Probe />));
  return { out, setView: (v: OrderView) => act(() => setView.current(v)) };
}

const lineIds = (o: { store: OrderStore }) => o.store.order.groups.flatMap((g) => g.lines).map((l) => l.id);

describe('the book', () => {
  it('seeds the initial order from the initial fixture, under that fixture’s id', () => {
    const { out } = mountBook({ state: 'open-t9' });
    expect(out.book.activeId).toBe('table-9');
    expect(out.store.order.title).toBe('Order · T9');
    expect(out.book.orderFor('table-1')).toBeUndefined();
  });

  it('seeds an order the first time it becomes active, and never again', () => {
    const { out } = mountBook({ state: 'default' });
    act(() => out.store.removeLine('steak'));
    expect(lineIds(out)).not.toContain('steak');
    act(() => out.book.openFixture('open-t12'));
    expect(out.book.activeId).toBe('table-12');
    expect(lineIds(out)).toContain('t12-fries');
    act(() => out.store.removeLine('t12-fries'));
    // Back to Table 1: its mutation persisted while Table 12 was active, and the fixture did not reseed it.
    act(() => out.book.openFixture('default'));
    expect(lineIds(out)).not.toContain('steak');
    act(() => out.book.openFixture('open-t12'));
    expect(lineIds(out)).not.toContain('t12-fries');
  });

  it('?state= changing inside an order never changes the active order or reseeds it', () => {
    const { out, setView } = mountBook({ state: 'open-t12' });
    act(() => out.store.removeLine('t12-fries'));
    setView({ state: 'sheet-item-burger', from: 'default' });
    setView({ state: 'default' });
    expect(out.book.activeId).toBe('table-12');
    expect(lineIds(out)).not.toContain('t12-fries');
    expect(out.store.order.title).toBe('Order · T12');
  });

  it('a floor page seeds nothing at mount, so no tile reads a book that was never opened', () => {
    const { out } = mountBook({ state: 'default' }, false);
    expect(out.book.orderFor('table-1')).toBeUndefined();
  });

  it('a free table is a new empty table order of its own, reused on the next visit', () => {
    const { out } = mountBook({ state: 'default' }, false);
    act(() => {
      out.book.openTable(2);
    });
    expect(out.book.activeId).toBe('table-2');
    expect(out.store.order.title).toBe('Order · T2');
    expect(out.store.order.groups).toEqual([]);
    act(() => out.store.addLine({ itemId: 'burger', name: 'Burger', quantity: 1 }));
    act(() => {
      out.book.openTable(3);
    });
    expect(lineIds(out)).toEqual([]);
    act(() => {
      out.book.openTable(2);
    });
    expect(lineIds(out)).toHaveLength(1);
  });

  it('every new quick sale has its own id and starts empty, and is never the fixture quick order', () => {
    const { out } = mountBook({ state: 'default' }, false);
    let a = '';
    let b = '';
    act(() => {
      a = out.book.newQuickSale();
    });
    act(() => out.store.addLine({ itemId: 'soda', name: 'Soda', quantity: 1 }));
    act(() => {
      b = out.book.newQuickSale();
    });
    expect(new Set([a, b, 'quick-1']).size).toBe(3);
    expect(out.store.order.type).toBe('quick_sale');
    expect(lineIds(out)).toEqual([]);
    expect(out.book.orderFor(a)!.groups).toHaveLength(1);
  });
});

// FE-027: the book keeps closed orders, and a table whose only order is closed is free.
describe('the book after a close', () => {
  const tenders = [{ id: 'd1', label: 'Card', amount: 173_250n }];

  it('marks the order closed, keeps it, and gives the table a new order under a new id', () => {
    const { out } = mountBook({ state: 'open-t9' });
    act(() => out.store.close!('2026-09-25T19:42:00.000Z', tenders));
    const [closed] = out.book.orders().filter((o) => o.status === 'closed');
    expect(closed).toMatchObject({ id: 'table-9', closedAt: '2026-09-25T19:42:00.000Z', change: 0n });
    expect(closed!.tenders).toEqual([{ label: 'Card', amount: 173_250n }]);
    expect(out.book.openOrderIdOf(9)).toBeUndefined();
    act(() => void out.book.openTable(9));
    expect(out.book.activeId).not.toBe('table-9');
    expect(out.book.openOrderIdOf(9)).toBe(out.book.activeId);
    expect(out.book.orders().filter((o) => o.id.startsWith('table-9'))).toHaveLength(2);
    expect(out.store.order.groups).toHaveLength(0);
  });

  it('a closed order accepts no mutation and no second close', () => {
    const { out } = mountBook({ state: 'open-t9' });
    act(() => out.store.close!('t1', tenders));
    act(() => out.book.openFixture('open-t9'));
    act(() => out.store.removeLine('t9-coffee'));
    act(() => out.store.close!('t2', tenders));
    expect(out.book.orders().filter((o) => o.status === 'closed')).toHaveLength(1);
    expect(out.book.orders().find((o) => o.id === 'table-9')).toMatchObject({ closedAt: 't1' });
    expect(out.book.orderFor('table-9')!.groups.flatMap((g) => g.lines).map((l) => l.id)).toContain('t9-coffee');
  });

  it('a refused close leaves the order open and unchanged', () => {
    const { out } = mountBook({ state: 'open-t9' });
    act(() => out.store.close!('t1', []));
    expect(out.book.orders().find((o) => o.id === 'table-9')!.status).toBe('open');
  });

  it('a quick sale’s pending lines become one queued round at close', () => {
    const { out } = mountBook({ state: 'quick-new' });
    act(() => out.store.addLine({ itemId: 'burger', name: 'Burger', quantity: 1 }));
    const total = out.store.order.totals.total;
    act(() => out.store.close!('t1', [{ id: 'd', label: 'Card', amount: total }]));
    const groups = out.book.orderFor(out.book.activeId)!.groups;
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: 'fired', delivery: 'queued', firedAt: 't1' });
  });
});
