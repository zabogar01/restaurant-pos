// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STAFF_MEAL } from '../src/discountFixtures.js';
import { orderTotals } from '../src/discount.js';
import { FIRE_ACTION } from '../src/fire.js';
import { OrderScreen } from '../src/OrderPanel.js';
import { ORDER_FIXTURES, ORDER_STATES, type OrderState, type OrderView } from '../src/orderFixtures.js';
import { MENU_ITEMS } from '../src/menuFixtures.js';
import { useOrderStore, type OrderStore } from '../src/orderStore.js';
import { shownOrder } from '../src/voidFixtures.js';

// FE-014: the order store. What this file is for:
// - AC2: adding a line moves the total to `orderTotals`' own figure, not the
//   fixture's stored one;
// - AC3: removing a PENDING line reproduces the artifact's own reviewed
//   `totalsWithout` figure, field by field — the sharpest test in the slice;
// - AC4: a removal the fixture never pre-figured still works;
// - AC5: a quantity rewrite recomputes from the unit price and its own
//   modifier deltas, proven on a line that carries a modifier, never wired to
//   any control;
// - AC6: a settlement lock blocks a seeded removal, on purpose;
// - AC7: fire.ts keeps refusing or resolving against the store's own lines,
//   through the real remove control.
//
// The store is a hook, so it is read the way a hook must be: mounted, not
// called. `Harness` renders `useOrderStore` and hands the latest result out
// through a callback that fires every render, exactly the pattern
// `test/void.test.tsx` and `test/sheets.test.tsx` already use for `OrderScreen`.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Harness({ view, locked = false, onStore }: { view: OrderView; locked?: boolean; onStore: (store: OrderStore) => void }) {
  onStore(useOrderStore(view, locked));
  return null;
}

/**
 * Mounts the store fresh, over the given view, and hands back a live handle:
 * `order` always reads the latest render, and each mutator re-renders (via
 * `act`) before returning, so the handle never goes stale the way a plain
 * snapshot of one render's `OrderStore` would. `rerender` re-renders the
 * *same* mounted store over a new `view`/`locked` pair, for F3d's tests of
 * what the store does as those two change under it, without a fresh mount.
 */
function mountStore(view: OrderView, locked = false) {
  let latest!: OrderStore;
  const render = (v: OrderView, l: boolean) => act(() => root.render(<Harness view={v} locked={l} onStore={(s) => (latest = s)} />));
  render(view, locked);
  return {
    get order() {
      return latest.order;
    },
    addLine: (line: Parameters<OrderStore['addLine']>[0]) => act(() => latest.addLine(line)),
    removeLine: (lineId: string) => act(() => latest.removeLine(lineId)),
    setQuantity: (lineId: string, quantity: number) => act(() => latest.setQuantity(lineId, quantity)),
    rerender: (v: OrderView, l: boolean) => render(v, l),
  };
}

describe('AC2: adding a line moves the total to orderTotals’ own figure', () => {
  it('a Soda added to quick moves the subtotal from 165.000 to 195.000', () => {
    const store = mountStore({ state: 'quick' });
    expect(store.order.totals.subtotal).toBe(165_000n);

    store.addLine({ itemId: 'soda', name: 'Soda', quantity: 1 });

    expect(store.order.totals.subtotal).toBe(195_000n);
    expect(store.order.totals).toEqual(orderTotals(195_000n));
    expect(store.order.groups.flatMap((g) => g.lines)).toHaveLength(3);
  });

  it('carries the new line’s itemId, so fire.ts can always read it (FR-E4)', () => {
    const store = mountStore({ state: 'quick' });
    store.addLine({ itemId: 'soda', name: 'Soda', quantity: 1 });
    const added = store.order.groups.flatMap((g) => g.lines).find((l) => l.name === 'Soda' && l.status === 'pending');
    expect(added?.itemId).toBe('soda');
  });
});

describe('AC3: removal is computed, and it agrees with the artifact’s own reviewed figure', () => {
  it('removing the Steak on default equals tableTotalsWithout.steak, field by field', () => {
    const store = mountStore({ state: 'default', gone: 'steak' });
    expect(store.order.totals).toEqual(ORDER_FIXTURES.default.totalsWithout!.steak);
  });

  it('removing of-coffee on overflow equals overflowTotalsWithout, field by field', () => {
    const store = mountStore({ state: 'overflow', gone: 'of-coffee' });
    expect(store.order.totals).toEqual(ORDER_FIXTURES.overflow.totalsWithout!['of-coffee']);
  });

  it('removing q-burger on quick equals quickTotalsWithout, field by field', () => {
    const store = mountStore({ state: 'quick', gone: 'q-burger' });
    expect(store.order.totals).toEqual(ORDER_FIXTURES.quick.totalsWithout!['q-burger']);
  });
});

describe('AC4: removal works where no fixture pre-figured it', () => {
  // sheet-voidorder's totalsWithout is tableTotalsWithout, which carries only
  // 'steak'. Its own order (unfiredTableOrder) also holds 'burger' and 'soda'
  // as PENDING lines, and the old rule (voidFixtures.ts:122) silently ignored
  // ?gone= for either — test/void.test.tsx:314 pins exactly that, unchanged,
  // for shownOrder. The store must not inherit that limit.
  it('removing soda on sheet-voidorder, which totalsWithout never figured, still works', () => {
    expect(ORDER_FIXTURES['sheet-voidorder'].totalsWithout!.soda).toBeUndefined();
    const store = mountStore({ state: 'sheet-voidorder', gone: 'soda' });
    const ids = store.order.groups.flatMap((g) => g.lines).map((l) => l.id);
    expect(ids).toEqual(['burger', 'steak']);
    expect(store.order.totals).toEqual(orderTotals(375_000n, STAFF_MEAL));
  });
});

describe('AC5: a quantity rewrite recomputes from the unit price and its own modifier deltas', () => {
  // FR-C2: the unit price is max(0, base + modifier deltas) and a line's
  // amount is that unit × quantity. The Burger on quick carries Large
  // (+20.000) and Extra cheese (+15.000): unit 135.000. At quantity 3:
  //   unit × quantity:       (100.000 + 35.000) × 3 = 405.000
  // (The FE-014 version of this test pinned 335.000, which multiplied only the
  // base price; the lead ruled that a FR-C2 error on 2026-09-24, FE-021.)
  it('rewrites the line in place: same line count, amount from the unit price × quantity', () => {
    const store = mountStore({ state: 'quick' });
    const before = store.order.groups.flatMap((g) => g.lines);
    expect(before).toHaveLength(2);

    store.setQuantity('q-burger', 3);

    const lines = store.order.groups.flatMap((g) => g.lines);
    expect(lines).toHaveLength(2); // rewritten, not appended
    const burger = lines.find((l) => l.id === 'q-burger')!;
    expect(burger.quantity).toBe(3);
    expect(burger.amount).toBe(405_000n);
  });

  // The original purpose, kept alive: recompute from the unit, never multiply
  // the stored amount. At quantity 1 the two agree, so this rewrites 2 → 3:
  // multiplying the stored 270.000 by 3 would give 810.000.
  it('recomputes from the unit on a second rewrite, never by multiplying the stored amount', () => {
    const store = mountStore({ state: 'quick' });
    store.setQuantity('q-burger', 2);
    expect(store.order.groups.flatMap((g) => g.lines).find((l) => l.id === 'q-burger')!.amount).toBe(270_000n);
    store.setQuantity('q-burger', 3);
    expect(store.order.groups.flatMap((g) => g.lines).find((l) => l.id === 'q-burger')!.amount).toBe(405_000n);
    store.setQuantity('q-burger', 2);
    expect(store.order.groups.flatMap((g) => g.lines).find((l) => l.id === 'q-burger')!.amount).toBe(270_000n);
  });

  it('Add at quantity 2 with a modifier appends 2 × unit (FR-C2)', () => {
    const store = mountStore({ state: 'quick' });
    store.addLine({ itemId: 'burger', name: 'Burger', quantity: 2, modifiers: [{ name: 'Large', delta: 20_000n }] });
    const added = store.order.groups.flatMap((g) => g.lines).find((l) => l.id.startsWith('burger-'))!;
    expect(added.quantity).toBe(2);
    expect(added.amount).toBe(240_000n);
  });

  it('clamps the unit at zero, not the total', () => {
    const store = mountStore({ state: 'quick' });
    store.addLine({ itemId: 'soda', name: 'Soda', quantity: 3, modifiers: [{ name: 'Deal', delta: -40_000n }] });
    const added = store.order.groups.flatMap((g) => g.lines).find((l) => l.id.startsWith('soda-'))!;
    expect(added.amount).toBe(0n);
  });
});

describe('B-8/FR-D4: a line keeps the unit price it was added at', () => {
  it('a catalog change after Add does not reprice the line on a quantity edit', () => {
    const burger = MENU_ITEMS.find((i) => i.id === 'burger')!;
    const was = burger.price;
    try {
      const store = mountStore({ state: 'quick' });
      store.addLine({ itemId: 'burger', name: 'Burger', quantity: 1, modifiers: [{ name: 'Large', delta: 20_000n }, { name: 'Extra cheese', delta: 15_000n }] });
      (burger as { price: bigint }).price = 120_000n;
      const id = store.order.groups.flatMap((g) => g.lines).find((l) => l.id.startsWith('burger-'))!.id;
      store.setQuantity(id, 2);
      expect(store.order.groups.flatMap((g) => g.lines).find((l) => l.id === id)!.amount).toBe(270_000n);
    } finally {
      (burger as { price: bigint }).price = was;
    }
  });
});

describe('a line with no menu item reprices from its own unit', () => {
  it('overflow’s Cheesecake (no tile): 60.000 × 2 = 120.000, no throw', () => {
    const store = mountStore({ state: 'overflow' });
    store.setQuantity('of-cheese', 2);
    expect(store.order.groups.flatMap((g) => g.lines).find((l) => l.id === 'of-cheese')!.amount).toBe(120_000n);
  });
});

describe('AC6: a settlement lock blocks a seeded removal, on purpose', () => {
  it('lock-draft: seeding ?gone=steak leaves the Steak on the order', () => {
    const store = mountStore({ state: 'lock-draft', gone: 'steak' });
    const ids = store.order.groups.flatMap((g) => g.lines).map((l) => l.id);
    expect(ids).toContain('steak');
    expect(store.order.totals).toEqual(ORDER_FIXTURES['lock-draft'].totals);
  });

  it('lock-lease: seeding ?gone=steak leaves the Steak on the order', () => {
    const store = mountStore({ state: 'lock-lease', gone: 'steak' });
    const ids = store.order.groups.flatMap((g) => g.lines).map((l) => l.id);
    expect(ids).toContain('steak');
    expect(store.order.totals).toEqual(ORDER_FIXTURES['lock-lease'].totals);
  });
});

describe('F3d: the derived lock (`locked`), and the lead correction to its ?gone= guard', () => {
  it('a plain ?gone=steak refused under `locked` leaves the Steak on the order', () => {
    const store = mountStore({ state: 'default', gone: 'steak' }, true);
    expect(store.order.groups.flatMap((g) => g.lines).map((l) => l.id)).toContain('steak');
  });

  // Lead correction: the effect used to mark a refused `?gone=` as "applied"
  // before checking the lock, so it was silently consumed. A cashier who is
  // refused under the lock, then genuinely re-asks for the same removal once
  // the lock lifts (gone clears to undefined in between, as Cancel always
  // does), must still have it applied.
  it('a ?gone= refused under the lock still applies once it is asked for again after clearing', () => {
    const store = mountStore({ state: 'default', gone: 'steak' }, true);
    expect(store.order.groups.flatMap((g) => g.lines).map((l) => l.id)).toContain('steak');

    store.rerender({ state: 'default' }, false); // Cancel: unlocked, gone cleared
    expect(store.order.groups.flatMap((g) => g.lines).map((l) => l.id)).toContain('steak');

    store.rerender({ state: 'default', gone: 'steak' }, false); // asked for again, unlocked
    expect(store.order.groups.flatMap((g) => g.lines).map((l) => l.id)).not.toContain('steak');
  });

  // The other half of the same correction: the lock lifting on its own must
  // never replay a stale `?gone=` that was never cleared in between — nobody
  // re-asked for it, so nothing should move.
  it('the lock lifting on its own, with the same ?gone= still in view, does not drop the line', () => {
    const store = mountStore({ state: 'default', gone: 'steak' }, true);
    expect(store.order.groups.flatMap((g) => g.lines).map((l) => l.id)).toContain('steak');

    store.rerender({ state: 'default', gone: 'steak' }, false); // same view, only `locked` changes

    expect(store.order.groups.flatMap((g) => g.lines).map((l) => l.id)).toContain('steak');
  });
});

describe('AC7: fire.ts still resolves against the store’s own lines, through the real control', () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let mount = 0;
  function renderScreen(view: OrderView) {
    window.history.replaceState(null, '', `/pos/order?state=${view.state}${view.gone ? `&gone=${view.gone}` : ''}`);
    act(() => root.render(<OrderScreen key={++mount} view={view} />));
  }
  const device = () => host.querySelector('.pos-device')!;
  const fireControl = () => device().querySelector<HTMLElement>(`.order-actions [data-action="${FIRE_ACTION}"]`)!;
  const pendingNames = () =>
    [...device().querySelectorAll('.order-line[data-line-status="pending"] .order-line__name')].map(
      (n) => n.firstChild!.textContent
    );

  afterEach(() => window.history.replaceState(null, '', '/pos/order'));

  it('removing the 86’d Coffee through the real × brings Send to kitchen back while Cheesecake and House Wine are still pending', () => {
    renderScreen({ state: 'fireblocked-overflow' });
    expect(fireControl().tagName).toBe('SPAN');
    expect(pendingNames()).toEqual(['Coffee', 'Cheesecake', 'House Wine']);

    const remove = device().querySelector<HTMLElement>('.order-line[data-line-id="of-coffee"] .order-line__remove')!;
    act(() => remove.click());

    expect(pendingNames()).toEqual(['Cheesecake', 'House Wine']);
    expect(fireControl().tagName).toBe('BUTTON');
    expect(fireControl().hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('mutation 1: the item sheet’s own Add to order appends a real line', () => {
  let mount = 0;
  function renderScreen(view: OrderView) {
    window.history.replaceState(null, '', `/pos/order?state=${view.state}`);
    act(() => root.render(<OrderScreen key={++mount} view={view} />));
  }
  const device = () => host.querySelector('.pos-device')!;
  const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]');
  const buttonNamed = (name: string) =>
    [...dialog()!.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!;

  afterEach(() => window.history.replaceState(null, '', '/pos/order'));

  it('adding a Burger from the sheet appends it to the pending group, priced with its chosen modifiers', () => {
    renderScreen({ state: 'sheet-item' });
    expect(dialog()).not.toBeNull();

    act(() => buttonNamed('Add to order').click());

    // sheet.add lands on eightysix, the artifact's own routing (unchanged);
    // the store persists across it, so the added line is on screen there,
    // beside the table order's own fired Burger (round 1) — two rows named
    // Burger, one fired and one pending.
    const rows = [...device().querySelectorAll<HTMLElement>('.order-line')].filter(
      (r) => r.querySelector('.order-line__name')!.firstChild!.textContent === 'Burger'
    );
    expect(rows).toHaveLength(2);
    const added = rows.find((r) => r.dataset.lineStatus === 'pending')!;
    // The default selection (Large, Extra cheese): 100.000 + 20.000 + 15.000.
    expect(added.querySelector('.order-line__amount')!.textContent).toBe('135.000');
  });
});

// The parity sweep the lead asked for after finding `empty` diverge in the
// browser: OrderPanel's default (`order = shownOrder(view)`, what
// order-panel.test.tsx exercises) and the store (what OrderScreen actually
// hands the panel) must be the same thing wherever nothing has mutated. This
// pins the optional-prop ruling to a guarantee instead of a hope, and would
// have caught `empty` on the first run.
describe('the store, unmutated, is shownOrder — for every state, and for every pre-figured removal', () => {
  it.each(ORDER_STATES.map((s) => s.id))('%s: the store’s initial order deep-equals shownOrder', (state: OrderState) => {
    const store = mountStore({ state });
    expect(store.order).toEqual(shownOrder({ state }));
  });

  // AC3, generalised: every (state, lineId) a fixture pre-figures in
  // totalsWithout, not just the three spot-checked above.
  const removals = (Object.entries(ORDER_FIXTURES) as [OrderState, (typeof ORDER_FIXTURES)[OrderState]][]).flatMap(
    ([state, fixture]) => Object.keys(fixture.totalsWithout ?? {}).map((lineId) => [state, lineId] as const)
  );

  it.each(removals)('%s, gone=%s: the store’s totals deep-equal shownOrder’s', (state, lineId) => {
    const view = { state, gone: lineId };
    const store = mountStore(view);
    expect(store.order.totals).toEqual(shownOrder(view).totals);
  });
});
