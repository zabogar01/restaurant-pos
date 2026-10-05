// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discountAmount, orderTotals, snapshotOf } from '../src/discount.js';
import { PRESETS, STAFF_MEAL } from '../src/discountFixtures.js';
import { MENU_ITEMS } from '../src/menuFixtures.js';
import { formatAmount } from '../src/money.js';
import { ControlledOrderScreen, OrderScreen } from '../src/OrderPanel.js';
import { orderViewFrom, type OrderState, type OrderView, type Totals } from '../src/orderFixtures.js';
import { noLongerOpen, reachedClosed, useOrderBook, type LiveOrderStore, type Locked, type OrderBook, type OrderStatus, type VoidOutcome } from '../src/orderStore.js';
import { PosRoutes } from '../src/PosRoutes.js';
import { LINE_REASONS, VOID_FIXTURES, shownOrder, type ShownOrder } from '../src/voidFixtures.js';
import { VoidSheet } from '../src/VoidSheets.js';

// FE-036: the void applies. The sheets read the order on screen, a void in them
// writes that order, and everything downstream follows: the row, the totals, the
// table, the floor. The pure operations have their own file (void-change.test.ts);
// this one holds the store, the sheets over it, and the screens that read what it
// wrote. None of it closes AC-3, AC-10, AC-11, AC-18, AC-21 or AC-22: those are
// proved against the real server.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '../src');
const code = (f: string) =>
  readFileSync(join(srcDir, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

let host: HTMLDivElement;
let root: Root;
let mount = 0;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  window.history.replaceState(null, '', '/pos/order');
});

// ---- the DOM ----

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const press = (el: Element) => act(() => (el as HTMLElement).click());
const escape = () => act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
const buttons = (in_: Element) => [...in_.querySelectorAll('button')];
const named = (in_: Element, name: string) => {
  const found = buttons(in_).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name);
  if (!found) throw new Error(`no button named ${JSON.stringify(name)} in ${buttons(in_).map((b) => b.textContent)}`);
  return found;
};
const sheet = () => host.querySelector<HTMLElement>('.sheet[role="dialog"]');
const prompt = () => host.querySelector<HTMLElement>('.modal[role="dialog"]');
const inSheet = (name: string) => named(sheet()!, name);
const inPrompt = (name: string) => named(prompt()!, name);
const digits = (d: string) => {
  for (const digit of d) press(inPrompt(digit));
};
const approve = () => {
  digits('123456');
  press(inPrompt('Continue'));
};
const urlState = () => new URLSearchParams(window.location.search).get('state') ?? 'default';
const table = (n: number) => host.querySelector<HTMLElement>(`[data-table="${n}"]`)!;
const rows = (status: string) => [...host.querySelectorAll<HTMLElement>(`.order-line[data-line-status="${status}"]`)];
const rowOf = (lineId: string) => host.querySelector<HTMLElement>(`.order-line[data-line-id="${lineId}"]`)!;
const rowName = (r: Element) => r.querySelector('.order-line__name')!.textContent;
const voidOrderButton = () => host.querySelector<HTMLElement>('.order-actions [data-action="void-order"]')!;
const fireButton = () => host.querySelector<HTMLElement>('.order-actions [data-action="fire"]')!;
const totalsRows = () =>
  [...host.querySelectorAll('.totals__row')].map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]);
const shownSubtotal = () => BigInt(totalsRows()[0]![1]!.replace(/\./g, ''));
const price = (itemId: string) => MENU_ITEMS.find((i) => i.id === itemId)!.price;

/** The rows the panel draws for a set of totals: the same fact, read from `orderTotals`. */
function rowsOf(t: Totals): string[][] {
  const row = (label: string, amount: bigint) => [label, formatAmount(amount)];
  return [
    row('Subtotal', t.subtotal),
    ...(t.discount ? [row(t.discount.label, t.discount.amount)] : []),
    ...(t.serviceCharge ? [row(t.serviceCharge.label, t.serviceCharge.amount)] : []),
    row('Total', t.total),
    ...(t.taxIncluded ? [row(t.taxIncluded.label, t.taxIncluded.amount)] : []),
  ];
}

function render(state: OrderState) {
  window.history.replaceState(null, '', `/pos/order?state=${state}`);
  act(() => root.render(<OrderScreen key={++mount} view={{ state }} />));
}

function load(url: string) {
  window.history.replaceState(null, '', url);
  act(() => root.render(<PosRoutes key={++mount} />));
}

const addItem = (itemId: string) => {
  press(host.querySelector(`[data-item="${itemId}"]`)!);
  press(buttons(host).find((b) => text(b) === 'Add to order')!);
};

/** Table 2, opened from the floor, holding two Burgers that have been sent to the kitchen. */
function firedTable2() {
  load('/pos/floor');
  press(table(2));
  addItem('burger');
  addItem('burger');
  press(fireButton());
  return rows('fired').map((r) => r.getAttribute('data-line-id')!);
}

const tapRow = (lineId: string) => press(rowOf(lineId).querySelector('.order-line__target')!);
const chooseReason = () => press(inSheet(LINE_REASONS[1]!.label));

// ---- a store, mounted on its own ----

function mountStore(initial: OrderView, lock: Locked = false) {
  const out = {} as { store: LiveOrderStore; book: OrderBook };
  const setLock: { current: (next: Locked) => void } = { current: () => {} };
  function Probe() {
    const [held, set] = useState<{ lock: Locked }>({ lock });
    setLock.current = (next) => set({ lock: next });
    Object.assign(out, useOrderBook(initial, held.lock));
    return null;
  }
  act(() => root.render(<Probe />));
  return { out, setLock: (next: Locked) => act(() => setLock.current(next)) };
}

/** The routed screen's own wiring over a book the test can read: `ControlledOrderScreen` over `useOrderBook`. */
function mountScreen(state: OrderState) {
  const out = {} as { book: OrderBook; store: LiveOrderStore };
  window.history.replaceState(null, '', `/pos/order?state=${state}`);
  function Screen() {
    const [view, setView] = useState<OrderView>({ state });
    const held = useOrderBook(view);
    Object.assign(out, held);
    return <ControlledOrderScreen view={view} store={held.store} onLocationChange={() => setView(orderViewFrom(window.location.search))} />;
  }
  act(() => root.render(<Screen key={++mount} />));
  return out;
}

const AT = '2026-10-03T12:00:00.000Z';
const REASON = 'customer changed their mind';
const statusesOf = (order: ShownOrder) => order.groups.flatMap((g) => g.lines).map((l) => [l.id, l.status]);

describe('the store: a line void and an order void (2)', () => {
  it('voidLine voids the line in the active order and answers the line it cancelled', () => {
    const { out } = mountStore({ state: 'default' });
    let result: VoidOutcome | undefined;
    act(() => {
      result = out.store.voidLine('burger', REASON, 'manager-prompt');
    });
    expect(result).toEqual({ cancels: ['burger'] });
    expect(statusesOf(out.store.order)).toEqual([
      ['burger', 'voided'],
      ['soda', 'fired'],
      ['steak', 'pending'],
    ]);
    expect(out.store.order.totals.subtotal).toBe(405_000n - 135_000n);
  });

  it('voidOrder voids the active order only; another order in the book is untouched', () => {
    const { out } = mountStore({ state: 'default' });
    act(() => out.book.openFixture('open-t12'));
    act(() => {
      expect(out.store.voidOrder(REASON, 'manager-prompt', AT)).toEqual({ cancels: ['t12-soup', 't12-soda'] });
    });
    const status = (id: string) => out.book.orders().find((o) => o.id === id)!.status;
    expect(status('table-12')).toBe('voided');
    expect(status('table-1')).toBe('open');
  });

  it('a gated void asked for directly is refused and changes nothing', () => {
    const { out } = mountStore({ state: 'default' });
    const before = out.store.order.groups;
    let line: VoidOutcome | undefined;
    let order: VoidOutcome | undefined;
    act(() => {
      line = out.store.voidLine('burger', REASON, 'direct');
      order = out.store.voidOrder(REASON, 'direct', AT);
    });
    expect(line).toEqual({ refused: 'needs-manager' });
    expect(order).toEqual({ refused: 'needs-manager' });
    expect(out.store.order.groups).toBe(before);
    expect(out.book.orders()[0]!.status).toBe('open');
  });
});

describe('the lock (8)', () => {
  it('an active payment session on the order refuses both, read at the moment of the call', () => {
    const { out, setLock } = mountStore({ state: 'default' }, (id) => id === 'never');
    const before = out.store.order.groups;
    setLock((id) => id === 'table-1');
    let line: VoidOutcome | undefined;
    let order: VoidOutcome | undefined;
    act(() => {
      line = out.store.voidLine('burger', REASON, 'manager-prompt');
      order = out.store.voidOrder(REASON, 'manager-prompt', AT);
    });
    expect(line).toEqual({ refused: 'locked' });
    expect(order).toEqual({ refused: 'locked' });
    expect(out.store.order.groups).toBe(before);
    // The session ends: the same press now applies. The lock is not remembered.
    setLock(false);
    act(() => {
      line = out.store.voidLine('burger', REASON, 'manager-prompt');
    });
    expect(line).toEqual({ cancels: ['burger'] });
  });

  it.each(['lock-draft', 'lock-lease'] as const)('a place whose lock is %s refuses both', (state) => {
    const { out } = mountStore({ state });
    const before = out.store.order.groups;
    let line: VoidOutcome | undefined;
    let order: VoidOutcome | undefined;
    act(() => {
      line = out.store.voidLine('burger', REASON, 'manager-prompt');
      order = out.store.voidOrder(REASON, 'manager-prompt', AT);
    });
    expect(line).toEqual({ refused: 'locked' });
    expect(order).toEqual({ refused: 'locked' });
    expect(out.store.order.groups).toBe(before);
  });
});

describe('twice in one tick (9)', () => {
  it('two voidLine calls for the same line: the first applies, the second answers not-fired', () => {
    const { out } = mountStore({ state: 'default' });
    const results: VoidOutcome[] = [];
    act(() => {
      results.push(out.store.voidLine('burger', REASON, 'manager-prompt'));
      results.push(out.store.voidLine('burger', REASON, 'manager-prompt'));
    });
    expect(results).toEqual([{ cancels: ['burger'] }, { refused: 'not-fired' }]);
  });

  it('two voidOrder calls: the second answers not-open', () => {
    const { out } = mountStore({ state: 'default' });
    const results: VoidOutcome[] = [];
    act(() => {
      results.push(out.store.voidOrder(REASON, 'manager-prompt', AT));
      results.push(out.store.voidOrder(REASON, 'manager-prompt', AT));
    });
    expect(results).toEqual([{ cancels: ['burger', 'soda'] }, { refused: 'not-open' }]);
  });
});

describe('a voided order is terminal (10)', () => {
  it('addLine, removeLine, setQuantity, fire, close and changeDiscount change nothing', () => {
    // Table 9 holds fired work only, so its drafts would close it were it open.
    const { out } = mountStore({ state: 'open-t9' });
    act(() => {
      out.store.voidOrder(REASON, 'manager-prompt', AT);
    });
    const held = out.store.order;
    let closed: boolean | undefined;
    let discount: unknown;
    act(() => {
      out.store.addLine({ itemId: 'soda', name: 'Soda', quantity: 1 });
      out.store.removeLine('t9-soda');
      out.store.setQuantity('t9-soda', 3);
      out.store.fire('19:00');
      closed = out.store.close!(AT, [{ id: 'd1', label: 'Card', amount: held.totals.total }]);
      discount = out.store.changeDiscount({ kind: 'preset', presetId: 'regular' }, 'direct');
    });
    expect(out.store.order.groups).toBe(held.groups);
    expect(out.store.order.applied).toBe(held.applied);
    expect(closed).toBe(false);
    expect(discount).toEqual({ refused: 'closed' });
    expect(out.book.orders()[0]!.status).toBe('voided');
  });

  it('the drafts that close an order before it is voided are the ones refused after it', () => {
    const { out } = mountStore({ state: 'open-t9' });
    const drafts = [{ id: 'd1', label: 'Card', amount: out.store.order.totals.total }];
    act(() => {
      expect(out.store.close!(AT, drafts)).toBe(true);
    });
    expect(out.book.orders()[0]!.status).toBe('closed');
  });

  it('a voided order cannot be voided again, line or order', () => {
    const { out } = mountStore({ state: 'default' });
    act(() => {
      out.store.voidOrder(REASON, 'manager-prompt', AT);
    });
    let line: VoidOutcome | undefined;
    act(() => {
      line = out.store.voidLine('burger', REASON, 'manager-prompt');
    });
    expect(line).toEqual({ refused: 'not-open' });
  });
});

describe('the book (11, O2)', () => {
  it('the two predicates: reachedClosed is closed or refunded; noLongerOpen is anything but open', () => {
    const statuses: OrderStatus[] = ['open', 'closed', 'refunded', 'voided'];
    expect(statuses.map(reachedClosed)).toEqual([false, true, true, false]);
    expect(statuses.map(noLongerOpen)).toEqual([false, true, true, true]);
  });

  it('a voided order reports voided, frees its table, and the next openTable makes a new order', () => {
    const { out } = mountStore({ state: 'default' });
    expect(out.book.openOrderIdOf(1)).toBe('table-1');
    act(() => {
      out.store.voidOrder(REASON, 'manager-prompt', AT);
    });
    const [voided] = out.book.orders();
    expect(voided).toMatchObject({ id: 'table-1', status: 'voided' });
    expect(reachedClosed(voided!.status)).toBe(false);
    expect(noLongerOpen(voided!.status)).toBe(true);
    expect(out.book.openOrderIdOf(1)).toBeUndefined();
    act(() => void out.book.openTable(1));
    expect(out.book.activeId).not.toBe('table-1');
    expect(out.book.orders().find((o) => o.id === 'table-1')!.status).toBe('voided');
  });

  it('refund answers not-closed for it', () => {
    const { out } = mountStore({ state: 'default' });
    act(() => {
      out.store.voidOrder(REASON, 'manager-prompt', AT);
    });
    let refund: unknown;
    act(() => {
      refund = out.book.refund('table-1', { allocations: [], reason: 'x' }, AT);
    });
    expect(refund).toEqual({ refused: 'not-closed' });
  });

  it('a voided order is not on POS-05 and not on the quick-sale strip', () => {
    load('/pos/closed-orders');
    const before = host.querySelectorAll('.closed-row').length;

    load('/pos/floor');
    press(host.querySelector('.floor-action--primary')!);
    addItem('burger');
    press(voidOrderButton());
    press(inSheet('Void order'));
    expect(window.location.pathname).toBe('/pos/floor');
    // The fixture's own sale may stand on the strip; the voided one does not.
    expect(host.querySelector('[data-order-id="quick-2"]')).toBeNull();
    press([...host.querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === 'Closed orders')!);
    expect(window.location.pathname).toBe('/pos/closed-orders');
    expect(host.querySelectorAll('.closed-row')).toHaveLength(before);
  });
});

// ---- the sheet reads the order on screen ----

describe('a line added in this session (12)', () => {
  it('the sheet shows that Burger and its amount, and voiding it strikes the row and drops the totals', () => {
    const [first] = firedTable2();
    const subtotal = shownSubtotal();
    // The item sheet's own choices price the line, so the figure is the row's.
    const amount = text(rowOf(first!).querySelector('.order-line__amount')!);
    tapRow(first!);
    const subject = text(sheet()!.querySelector('.void-subject__row')!);
    expect(subject.startsWith('Burger')).toBe(true);
    expect(subject.endsWith(amount)).toBe(true);
    chooseReason();
    press(inSheet('Continue'));
    expect(text(prompt()!.querySelector('.modal__request')!)).toBe(
      `Void a fired line — Burger ${amount} — reason: ${LINE_REASONS[1]!.inline}`
    );
    approve();
    expect(prompt()).toBeNull();
    expect(sheet()).toBeNull();
    expect(rows('voided').map(rowName)).toEqual(['Burger']);
    expect(rows('voided')[0]!.getAttribute('data-line-id')).toBe(first);
    expect(rows('fired')).toHaveLength(1);
    expect(totalsRows()).toEqual(rowsOf(orderTotals(subtotal - BigInt(amount.replaceAll('.', '')), undefined)));
  });
});

describe('Void order over a live order (13)', () => {
  it('on a table holding fired work: the gated variant, with the panel’s total and the panel’s fired count', () => {
    firedTable2();
    const total = text(host.querySelector('.totals__row--grand dd')!);
    press(voidOrderButton());
    expect(sheet()!.querySelector('.void-tag')!.textContent).toBe('MANAGER REQUIRED');
    expect(sheet()!.querySelector('.notice__title')!.textContent).toBe('2 lines have already been sent to the kitchen');
    expect(text(sheet()!.querySelector('.void-value__amount')!)).toBe(total);
  });

  it('on a table with only pending lines: the ungated variant', () => {
    load('/pos/floor');
    press(table(2));
    addItem('burger');
    press(voidOrderButton());
    expect(sheet()!.querySelector('.void-tag')).toBeNull();
    expect(sheet()!.querySelectorAll('.void-reason')).toHaveLength(0);
    expect(text(sheet()!.querySelector('.void-value__amount')!)).toBe(formatAmount(shownOrderTotal()));
  });
});

const shownOrderTotal = () => BigInt(text(host.querySelector('.totals__row--grand dd')!).replaceAll('.', ''));

describe('no subject, no sheet (14, R13)', () => {
  it('?state=sheet-voidline over an order with no fired burger draws no sheet, and the frame is not inert', () => {
    // A fresh table holds no line named burger; the address still names one.
    load('/pos/floor');
    press(table(2));
    window.history.replaceState(null, '', '/pos/order?state=sheet-voidline');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(sheet()).toBeNull();
    expect(prompt()).toBeNull();
    expect(host.querySelector('[inert]')).toBeNull();
  });

  it('over an order whose Burger was voided in this session, the same', () => {
    const { out } = mountStore({ state: 'sheet-voidline' });
    act(() => {
      out.store.voidLine('burger', REASON, 'manager-prompt');
    });
    const fixture = VOID_FIXTURES['sheet-voidline']!;
    act(() =>
      root.render(
        <div className="pos-device">
          <VoidSheet fixture={fixture} order={out.store.order} voidLine={out.store.voidLine} voidOrder={() => ({ cancels: [] })} go={() => {}} leave={() => {}} />
        </div>
      )
    );
    expect(sheet()).toBeNull();
  });

  it('through the screen: a voided Burger at ?state=sheet-voidline draws no sheet and nothing is inert', () => {
    render('default');
    tapRow('burger');
    chooseReason();
    press(inSheet('Continue'));
    approve();
    expect(rows('voided').map(rowName)).toEqual(['Burger']);
    // Reach the address again over the same store: nothing to void, so nothing drawn.
    window.history.replaceState(null, '', '/pos/order?state=sheet-voidline');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(sheet()).toBeNull();
    expect(host.querySelector('[inert]')).toBeNull();
  });
});

// ---- a void changes the order ----

describe('a fired line through the prompt (15, FR-H4, O1)', () => {
  it('nothing changes until the confirm key; it is off until six digits; then prompt and sheet close and the row is struck through', () => {
    render('default');
    const before = statusesOf(shownOrder({ state: 'default' }));
    tapRow('burger');
    chooseReason();
    press(inSheet('Continue'));
    expect(prompt()).not.toBeNull();
    expect(rows('voided')).toHaveLength(0);
    expect(rows('fired')).toHaveLength(2);
    const confirm = inPrompt('Continue');
    expect(confirm.getAttribute('aria-disabled')).toBe('true');
    digits('12345');
    press(confirm);
    expect(prompt()).not.toBeNull();
    expect(rows('voided')).toHaveLength(0);
    digits('6');
    press(inPrompt('Continue'));
    expect(prompt()).toBeNull();
    expect(sheet()).toBeNull();
    const voided = rowOf('burger');
    expect(voided.getAttribute('data-line-status')).toBe('voided');
    expect(voided.className).toContain('order-line--voided');
    expect(voided.querySelector('button')).toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(405_000n - 135_000n, STAFF_MEAL)));
    expect(before).toEqual([['burger', 'fired'], ['soda', 'fired'], ['steak', 'pending']]);
  });
});

describe('cancelling the prompt changes nothing (16, B-20)', () => {
  it.each(['Cancel', 'Escape'])('%s returns to the sheet as it was, reason kept, order unchanged', (how) => {
    render('default');
    tapRow('burger');
    chooseReason();
    press(inSheet('Continue'));
    digits('123456');
    if (how === 'Cancel') press(inPrompt('Cancel'));
    else escape();
    expect(prompt()).toBeNull();
    expect(sheet()).not.toBeNull();
    expect(sheet()!.closest('[inert]')).toBeNull();
    expect(inSheet(LINE_REASONS[1]!.label).getAttribute('aria-pressed')).toBe('true');
    expect(rows('voided')).toHaveLength(0);
    expect(totalsRows()).toEqual(rowsOf(orderTotals(405_000n, STAFF_MEAL)));
  });
});

describe('the reason submitted is the reason shown (17, R12)', () => {
  it('a typed reason is what the prompt displays', () => {
    render('default');
    tapRow('burger');
    press(inSheet('Other — type a reason'));
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    const field = sheet()!.querySelector<HTMLInputElement>('#void-reason-other')!;
    act(() => {
      setValue.call(field, '  Table left in a hurry ');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    press(inSheet('Continue'));
    expect(text(prompt()!.querySelector('.modal__request')!)).toBe('Void a fired line — Burger 135.000 — reason: Table left in a hurry');
  });

  it('the prompt’s onSubmit declares no parameter, and the manager-prompt literal is written there and nowhere else in the client', () => {
    const sheets = code('VoidSheets.tsx');
    expect(sheets).not.toMatch(/onSubmit=\{\(\s*\w/);
    expect(sheets).not.toMatch(/\(\s*pin\b|\bpin\s*[:,)]/i);
    expect(sheets.match(/'manager-prompt'/g)).toHaveLength(1);
    expect(sheets.split('\n').find((l) => l.includes("'manager-prompt'"))).toMatch(/onSubmit=\{\(\)\s*=>/);
    const holders = readdirSync(srcDir)
      .filter((f) => /\.tsx?$/.test(f) && !['discountChange.ts', 'voidChange.ts'].includes(f))
      .filter((f) => code(f).includes("'manager-prompt'"));
    expect(holders).toEqual(['DiscountSheets.tsx', 'VoidSheets.tsx']);
  });

  it('the gate’s second argument is never placed in state, a ref or the URL, nor called approval', () => {
    const sheets = code('VoidSheets.tsx');
    expect(sheets).not.toMatch(/useState<[^>]*Through|useRef<[^>]*Through/);
    const naming = sheets.split('\n').filter((l) => /through/i.test(l));
    expect(naming.length).toBeGreaterThan(0);
    expect(naming.filter((l) => /approv|confirm/i.test(l))).toEqual([]);
  });
});

describe('an order with nothing fired (18, FR-H3)', () => {
  it('Void order twice: no prompt, no reason; the floor replaces the entry, the table is free, Back and Forward never reopen it', () => {
    load('/pos/floor');
    press(table(2));
    addItem('burger');
    const length = window.history.length;
    press(voidOrderButton());
    press(inSheet('Void order'));
    expect(prompt()).toBeNull();
    expect(window.location.pathname).toBe('/pos/floor');
    expect(window.history.length).toBe(length);
    expect(table(2).getAttribute('aria-label')).toBe('Table 2, free, open new order');
    // Forward onto the voided order's route lands on the floor.
    window.history.pushState(null, '', '/pos/order?state=empty');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(window.location.pathname).toBe('/pos/floor');
    expect(host.querySelector('.order-panel')).toBeNull();
  });
});

describe('an order holding fired work (19, FR-H4)', () => {
  it('Void order, reason, prompt: the floor, with the table free; it is not voided before the confirm key', () => {
    firedTable2();
    const length = window.history.length;
    press(voidOrderButton());
    chooseOrderReason();
    press(inSheet('Continue'));
    expect(prompt()).not.toBeNull();
    expect(window.location.pathname).toBe('/pos/order');
    expect(host.querySelector('.order-panel')).not.toBeNull();
    approve();
    expect(window.location.pathname).toBe('/pos/floor');
    expect(window.history.length).toBe(length);
    expect(table(2).getAttribute('aria-label')).toBe('Table 2, free, open new order');
    expect(prompt()).toBeNull();
  });
});

const chooseOrderReason = () => press(inSheet('Customer left'));

describe('the three addresses are live (20, R13, R15)', () => {
  it('?state=sheet-voidline: approving voids the Burger in the book and lands on default', () => {
    render('sheet-voidline');
    chooseReason();
    press(inSheet('Continue'));
    approve();
    expect(urlState()).toBe('default');
    expect(rows('voided').map(rowName)).toEqual(['Burger']);
  });

  it.each(['sheet-voidorder', 'sheet-voidorder-fired'] as const)('%s: the void voids the order in the book the screen writes and lands on /pos/floor', (state) => {
    const out = mountScreen(state);
    expect(out.book.orders().map((o) => o.status)).toEqual(['open']);
    expect(sheet()).not.toBeNull();
    if (state === 'sheet-voidorder-fired') {
      chooseOrderReason();
      press(inSheet('Continue'));
      approve();
    } else {
      press(inSheet('Void order'));
    }
    expect(window.location.pathname).toBe('/pos/floor');
    expect(out.book.orders().map((o) => [o.id, o.status])).toEqual([['table-1', 'voided']]);
  });
});

describe('an opened target takes precedence over the address (F1)', () => {
  /** Table 2 with two fired Burgers, then an address naming a line the order does not hold. */
  function atDeadAddress() {
    const [first] = firedTable2();
    window.history.replaceState(null, '', '/pos/order?state=sheet-voidline');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(sheet()).toBeNull();
    return first!;
  }

  it('a tap on a live fired row opens that row’s sheet, and the void applies', () => {
    const first = atDeadAddress();
    tapRow(first);
    expect(sheet()).not.toBeNull();
    expect(sheet()!.querySelector('.void-subject__row')!.textContent).toContain('Burger');
    chooseReason();
    press(inSheet('Continue'));
    approve();
    expect(sheet()).toBeNull();
    expect(rowOf(first).getAttribute('data-line-status')).toBe('voided');
    expect(rows('fired')).toHaveLength(1);
  });

  it('Void order opens the order’s sheet, and the void applies', () => {
    atDeadAddress();
    press(voidOrderButton());
    expect(sheet()!.querySelector('h2')!.textContent).toBe('Void this order');
    chooseOrderReason();
    press(inSheet('Continue'));
    approve();
    expect(window.location.pathname).toBe('/pos/floor');
    expect(table(2).getAttribute('aria-label')).toBe('Table 2, free, open new order');
  });
});

describe('a refusal (21, R16)', () => {
  const refusing = (refused: 'locked' | 'needs-manager') => () => ({ refused }) as VoidOutcome;

  function mountRefused(fixtureState: 'sheet-voidline' | 'sheet-voidorder-fired') {
    const went: OrderView[] = [];
    const left: number[] = [];
    act(() =>
      root.render(
        <div className="pos-device">
          <VoidSheet
            fixture={VOID_FIXTURES[fixtureState]!}
            order={shownOrder({ state: fixtureState })}
            voidLine={refusing('locked')}
            voidOrder={refusing('locked')}
            go={(v) => went.push(v)}
            leave={() => left.push(0)}
          />
        </div>
      )
    );
    return { went, left };
  }

  it.each(['sheet-voidline', 'sheet-voidorder-fired'] as const)('%s: the prompt closes, the sheet stays, nothing routes', (state) => {
    const { went, left } = mountRefused(state);
    press(inSheet(state === 'sheet-voidline' ? LINE_REASONS[1]!.label : 'Customer left'));
    press(inSheet('Continue'));
    approve();
    expect(prompt()).toBeNull();
    expect(sheet()).not.toBeNull();
    expect(sheet()!.closest('[inert]')).toBeNull();
    expect(went).toEqual([]);
    expect(left).toEqual([]);
  });
});

describe('the approval addresses perform nothing (22, R17)', () => {
  it.each(['approval', 'approval-error', 'approval-throttled', 'approval-denied'] as const)('%s: no line’s status changes', (state) => {
    render(state);
    const before = rows('fired').length + ':' + rows('voided').length + ':' + rows('pending').length;
    if (state === 'approval') approve();
    else escape();
    expect(rows('fired').length + ':' + rows('voided').length + ':' + rows('pending').length).toBe(before);
    expect(rows('voided')).toHaveLength(0);
  });
});

describe('money (23)', () => {
  it('a percentage discount follows the lower subtotal and its snapshot is unchanged', () => {
    const { out } = mountStore({ state: 'default' });
    const snapshot = out.store.order.applied;
    act(() => {
      out.store.voidLine('burger', REASON, 'manager-prompt');
    });
    expect(out.store.order.applied).toBe(snapshot);
    expect(out.store.order.totals).toEqual(orderTotals(270_000n, STAFF_MEAL));
    expect(out.store.order.totals.discount!.amount).toBe(-discountAmount(270_000n, STAFF_MEAL.value));
  });

  it('a fixed discount above the remaining subtotal: the total is 0 and the snapshot is unchanged', () => {
    const { out } = mountStore({ state: 'default' });
    act(() => void out.book.openTable(2));
    act(() => {
      out.store.addLine({ itemId: 'burger', name: 'Burger', quantity: 1 });
      out.store.addLine({ itemId: 'soda', name: 'Soda', quantity: 1 });
    });
    act(() => out.store.fire('19:00'));
    const recovery = snapshotOf(PRESETS.find((p) => p.id === 'service-recovery')!);
    act(() => {
      out.store.changeDiscount({ kind: 'preset', presetId: 'service-recovery' }, 'direct');
    });
    expect(out.store.order.applied).toEqual(recovery);
    const burger = out.store.order.groups.flatMap((g) => g.lines).find((l) => l.itemId === 'burger')!;
    act(() => {
      expect(out.store.voidLine(burger.id, REASON, 'manager-prompt').refused).toBeUndefined();
    });
    expect(out.store.order.applied).toEqual(recovery);
    expect(out.store.order.totals.subtotal).toBe(price('soda'));
    expect(out.store.order.totals.total).toBe(0n);
  });

  it('a void under an active tender draft is refused by the operation', () => {
    const { out } = mountStore({ state: 'default' }, (id) => id === 'table-1');
    let line: VoidOutcome | undefined;
    act(() => {
      line = out.store.voidLine('burger', REASON, 'manager-prompt');
    });
    expect(line).toEqual({ refused: 'locked' });
  });
});

describe('nothing is said after the void (24, R18)', () => {
  const FORBIDDEN = /ticket|print|record|approv|cancel|confirm|void/i;
  const words = (el: Element) => {
    const found = new Set<string>();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) for (const w of (n.textContent ?? '').split(/[\s·—]+/)) if (w) found.add(w);
    return found;
  };

  it('a line void adds no text about a ticket, a print, a record or an approval', () => {
    render('default');
    const before = words(host);
    tapRow('burger');
    chooseReason();
    press(inSheet('Continue'));
    approve();
    expect([...words(host)].filter((w) => !before.has(w) && FORBIDDEN.test(w))).toEqual([]);
    expect(host.querySelector('[role="status"]')!.textContent).toBe('');
  });

  it('an order void leaves a floor that says nothing of it', () => {
    load('/pos/floor');
    press(table(2));
    addItem('burger');
    press(voidOrderButton());
    press(inSheet('Void order'));
    expect(text(host)).not.toMatch(/cancel|ticket|record|approv|void/i);
  });
});

describe('the sources (R9, R13, R18)', () => {
  it('the sheet no longer uses the approval prompt or the fixture-only order', () => {
    expect(code('VoidSheets.tsx')).not.toMatch(/ApprovalPrompt|STAY/);
    expect(code('OrderPanel.tsx')).not.toMatch(/<VoidSheet[^>]*order=\{order\}/);
  });

  it('nothing stores an approver, an actor or an approval flag for a void', () => {
    for (const f of ['voidChange.ts', 'VoidSheets.tsx']) {
      expect(code(f), f).not.toMatch(/approver|\bactor\b|approvedBy|isApproved/i);
    }
  });
});
