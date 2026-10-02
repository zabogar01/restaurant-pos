// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discountAmount, orderTotals, snapshotOf, type DiscountSnapshot } from '../src/discount.js';
import type { DiscountChange, DiscountRefusal, DiscountThrough } from '../src/discountChange.js';
import { DISCOUNT_FIXTURES, OTHER_15, PRESETS, STAFF_MEAL } from '../src/discountFixtures.js';
import { DiscountSheet } from '../src/DiscountSheets.js';
import { MENU_ITEMS } from '../src/menuFixtures.js';
import { formatAmount } from '../src/money.js';
import { OrderScreen } from '../src/OrderPanel.js';
import type { OrderState, OrderView, Totals } from '../src/orderFixtures.js';
import { useOrderBook, type Locked, type LiveOrderStore, type OrderBook } from '../src/orderStore.js';
import { PosRoutes } from '../src/PosRoutes.js';
import { shownOrder, type ShownOrder } from '../src/voidFixtures.js';

// FE-035: the discount applies. The sheets read the order on screen, a choice in
// them writes that order, and everything downstream follows: the totals, the
// settlement, the closed order. The pure operation has its own file
// (discount-change.test.ts); this one holds the store, the sheets over it, and
// the screens that read what it wrote.

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

// ---- the DOM, as the other discount tests read it ----

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
const title = () => sheet()!.querySelector('h2')!.textContent;
const field = () => sheet()!.querySelector<HTMLInputElement>('#discount-value')!;
function typeValue(value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setValue.call(field(), value);
    field().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const digits = (d: string) => {
  for (const digit of d) press(inPrompt(digit));
};
const approve = () => {
  digits('123456');
  press(inPrompt('Continue'));
};
const discountButton = () => host.querySelector<HTMLElement>('.order-actions [data-action="discount"]')!;
const urlState = () => new URLSearchParams(window.location.search).get('state') ?? 'default';
const totalsRows = () =>
  [...host.querySelectorAll('.totals__row')].map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]);

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
const hasDiscountRow = () => totalsRows().length === rowsOf(orderTotals(1n, STAFF_MEAL)).length;

function render(state: OrderState) {
  window.history.replaceState(null, '', `/pos/order?state=${state}`);
  act(() => root.render(<OrderScreen key={++mount} view={{ state }} />));
}

function load(url: string) {
  window.history.replaceState(null, '', url);
  act(() => root.render(<PosRoutes key={++mount} />));
}

/** The subtotal the panel states, read back from its first totals row (the money display is dot-grouped digits). */
const shownSubtotal = () => BigInt(totalsRows()[0]![1]!.replace(/\./g, ''));

const TABLE_1_SUBTOTAL = 405_000n;
const REGULAR = snapshotOf(PRESETS.find((p) => p.id === 'regular')!);
const COMP = snapshotOf(PRESETS.find((p) => p.id === 'comp')!);
const SERVICE_RECOVERY = snapshotOf(PRESETS.find((p) => p.id === 'service-recovery')!);
const OTHER = (percent: string): DiscountSnapshot => ({ source: 'free-form', name: OTHER_15.name, value: { kind: 'percent', percent } });
const price = (itemId: string) => MENU_ITEMS.find((i) => i.id === itemId)!.price;

// ---- the store ----

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

const PRESET = (presetId: string): DiscountChange => ({ kind: 'preset', presetId });
const REMOVE: DiscountChange = { kind: 'remove' };
const FREE = (percent: string): DiscountChange => ({ kind: 'free-form', value: { kind: 'percent', percent } });

describe('the store writes the active order, and the totals follow (7)', () => {
  it('a preset replaces Staff meal; every total is orderTotals over the new snapshot', () => {
    const { out } = mountStore({ state: 'default' });
    expect(out.store.order.totals.discount!.label).toBe('Staff meal 10%');
    act(() => {
      expect(out.store.changeDiscount(PRESET('regular'), 'direct')).toEqual({});
    });
    expect(out.store.order.applied).toEqual(REGULAR);
    expect(out.store.order.totals).toEqual(orderTotals(TABLE_1_SUBTOTAL, REGULAR));
    expect(out.store.order.totals.discount).toEqual({ label: 'Regular customer 5%', amount: -20_250n });
  });

  it('writes the active order only: another order in the book keeps its discount', () => {
    const { out } = mountStore({ state: 'default' });
    act(() => out.book.openFixture('open-t12'));
    act(() => {
      out.store.changeDiscount(PRESET('regular'), 'direct');
    });
    expect(out.book.orderFor('table-12')!.applied).toEqual(REGULAR);
    expect(out.book.orderFor('table-1')!.applied).toEqual(STAFF_MEAL);
  });

  it('a gated change asked for directly is refused and changes nothing', () => {
    const { out } = mountStore({ state: 'other-discount' });
    const before = out.store.order;
    let result: unknown;
    act(() => {
      result = out.store.changeDiscount(PRESET('regular'), 'direct');
    });
    expect(result).toEqual({ refused: 'needs-manager' });
    expect(out.store.order.totals).toEqual(before.totals);
    expect(out.store.order.applied).toEqual(OTHER_15);
  });

  it('a fixed amount above the subtotal applies, and the total is 0 with the snapshot untouched (4)', () => {
    const { out } = mountStore({ state: 'quick-new' });
    act(() => out.store.addLine({ itemId: 'soda', name: 'Soda', quantity: 1 }));
    act(() => {
      expect(out.store.changeDiscount(PRESET('service-recovery'), 'direct')).toEqual({});
    });
    expect(out.store.order.applied).toEqual(SERVICE_RECOVERY);
    expect(out.store.order.totals.total).toBe(0n);
    expect(out.store.order.totals).toEqual(orderTotals(price('soda'), SERVICE_RECOVERY));
  });
});

describe('the lock (8)', () => {
  it('an active payment session on the order refuses, read at the moment of the call', () => {
    const { out, setLock } = mountStore({ state: 'default' }, (id) => id === 'never');
    const before = out.store.order.totals;
    setLock((id) => id === 'table-1');
    let result: unknown;
    act(() => {
      result = out.store.changeDiscount(PRESET('regular'), 'direct');
    });
    expect(result).toEqual({ refused: 'locked' });
    expect(out.store.order.totals).toEqual(before);
    expect(out.store.order.applied).toEqual(STAFF_MEAL);
    // The session ends: the same press now applies. Neither lock is remembered.
    setLock(false);
    act(() => {
      result = out.store.changeDiscount(PRESET('regular'), 'direct');
    });
    expect(result).toEqual({});
    expect(out.store.order.applied).toEqual(REGULAR);
  });

  it.each(['lock-draft', 'lock-lease'] as const)('a place that carries a %s refuses too', (state) => {
    const { out } = mountStore({ state });
    const before = out.store.order.totals;
    let result: unknown;
    act(() => {
      result = out.store.changeDiscount(PRESET('regular'), 'direct');
    });
    expect(result).toEqual({ refused: 'locked' });
    expect(out.store.order.totals).toEqual(before);
    expect(out.store.order.applied).toEqual(STAFF_MEAL);
  });
});

describe('a closed order (9)', () => {
  it('is refused closed, and its totals on the book do not move', () => {
    const { out } = mountStore({ state: 'open-t9' });
    act(() => {
      out.store.close!('2026-09-25T19:42:00.000Z', [{ id: 'd1', label: 'Card', amount: 173_250n }]);
    });
    const before = out.book.orderFor('table-9')!;
    let result: unknown;
    act(() => {
      result = out.store.changeDiscount(PRESET('regular'), 'direct');
    });
    expect(result).toEqual({ refused: 'closed' });
    expect(out.book.orderFor('table-9')).toEqual(before);
    expect(out.book.orders().find((o) => o.id === 'table-9')!.status).toBe('closed');
  });
});

describe('twice in one tick (10)', () => {
  it('the second remove finds the first one’s order and answers nothing-to-remove', () => {
    const { out } = mountStore({ state: 'default' });
    const results: unknown[] = [];
    act(() => {
      results.push(out.store.changeDiscount(REMOVE, 'direct'));
      results.push(out.store.changeDiscount(REMOVE, 'direct'));
    });
    expect(results).toEqual([{}, { refused: 'nothing-to-remove' }]);
    expect(out.store.order.applied).toBeUndefined();
    expect(out.store.order.totals).toEqual(orderTotals(TABLE_1_SUBTOTAL));
  });
});

describe('nothing chooses a discount but a press (21)', () => {
  it('a line added and a line removed leave the snapshot as it was', () => {
    const { out } = mountStore({ state: 'default' });
    act(() => out.store.addLine({ itemId: 'burger', name: 'Burger', quantity: 1 }));
    expect(out.store.order.applied).toBe(STAFF_MEAL);
    act(() => out.store.removeLine('steak'));
    expect(out.store.order.applied).toBe(STAFF_MEAL);
  });

  it('a line removed below a fixed discount leaves the snapshot unchanged and the total at 0', () => {
    const { out } = mountStore({ state: 'quick-new' });
    act(() => out.store.addLine({ itemId: 'burger', name: 'Burger', quantity: 1 }));
    act(() => out.store.addLine({ itemId: 'soda', name: 'Soda', quantity: 1 }));
    act(() => {
      out.store.changeDiscount(PRESET('service-recovery'), 'direct');
    });
    const burger = out.store.order.groups.flatMap((g) => g.lines).find((l) => l.itemId === 'burger')!;
    expect(out.store.order.totals.total).toBeGreaterThan(0n);
    act(() => out.store.removeLine(burger.id));
    expect(out.store.order.applied).toEqual(SERVICE_RECOVERY);
    expect(out.store.order.totals.total).toBe(0n);
    expect(discountAmount(price('soda'), SERVICE_RECOVERY.value)).toBe(price('soda'));
  });
});

// ---- the sheet reads the order on screen (11, 12) ----

const table = (n: number) => host.querySelector<HTMLElement>(`[data-table="${n}"]`)!;
const addBurger = () => {
  press(host.querySelector('[data-item="burger"]')!);
  press(buttons(host).find((b) => text(b) === 'Add to order')!);
};

describe('the sheet reads the order the panel shows', () => {
  it('Table 2 is not Table 1: the picker, not Table 1’s Staff meal (11)', () => {
    load('/pos/floor');
    press(table(2));
    addBurger();
    expect(host.querySelector('#order-title')!.textContent).toBe('Order · T2');
    press(discountButton());
    expect(title()).toBe('Discount');
    expect(sheet()!.querySelector('.discount-applied')).toBeNull();
    expect(text(sheet()!)).not.toContain('Currently applied');
    // The panel beside it states no discount either.
    expect(totalsRows().map((r) => r[0])).not.toContain('Staff meal 10%');
  });

  it('the change sheet takes its discount from the panel’s subtotal, not the fixture’s (12)', () => {
    render('default');
    addBurger();
    press(discountButton());
    const subtotal = shownSubtotal();
    expect(subtotal).toBeGreaterThan(TABLE_1_SUBTOTAL);
    expect(sheet()!.querySelector('.discount-applied__row')!.textContent).toBe(
      `Staff meal — 10%${formatAmount(-discountAmount(subtotal, STAFF_MEAL.value))}`
    );
  });
});

// ---- a choice changes the order (13 to 17) ----

describe('a preset applies at once (13)', () => {
  it('closes the sheet with no prompt, adds the row, leaves the URL and history alone, and focus returns to Discount', () => {
    load('/pos/floor');
    press(table(2));
    addBurger();
    const subtotal = shownSubtotal();
    press(discountButton());
    const where = `${window.location.pathname}${window.location.search}`;
    const length = window.history.length;
    press(inSheet('Staff meal — 10%'));
    expect(prompt()).toBeNull();
    expect(sheet()).toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(subtotal, STAFF_MEAL)));
    expect(`${window.location.pathname}${window.location.search}`).toBe(where);
    expect(window.history.length).toBe(length);
    expect(document.activeElement).toBe(discountButton());
  });
});

describe('replacing and removing a preset (14)', () => {
  it('another preset replaces it with no prompt', () => {
    render('default');
    press(discountButton());
    expect(title()).toBe('Change discount');
    press(inSheet('Replace with another preset'));
    press(inSheet('Regular customer — 5%'));
    expect(prompt()).toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, REGULAR)));
  });

  it('Remove the discount removes the row, and the total is the undiscounted one', () => {
    render('default');
    press(discountButton());
    press(inSheet('Remove the discount'));
    expect(prompt()).toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL)));
    expect(hasDiscountRow()).toBe(false);
    // The order is not the same one: reopening Discount offers the picker.
    press(discountButton());
    expect(title()).toBe('Discount');
  });

  it('the note of the discount that went is gone with it', () => {
    render('default');
    press(discountButton());
    expect(text(sheet()!)).toContain('Applied by Ana R. at 19:44. Preset, no approval.');
    press(inSheet('Replace with another preset'));
    press(inSheet('Regular customer — 5%'));
    press(discountButton());
    expect(title()).toBe('Change discount');
    expect(sheet()!.querySelector('.discount-applied__row')!.textContent).toBe('Regular customer — 5%−20.250');
    expect(sheet()!.querySelector('.discount-applied__note')).toBeNull();
    expect(text(sheet()!)).not.toContain('Ana R.');
  });
});

describe('a free-form discount goes through the manager prompt (15)', () => {
  it('nothing changes while it is open; the confirm key is off until six digits; then it applies', () => {
    render('default');
    press(discountButton());
    press(inSheet('Replace with another amount — needs a manager'));
    typeValue('15');
    press(inSheet('Apply'));
    expect(prompt()).not.toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, STAFF_MEAL)));
    expect(inPrompt('Continue').getAttribute('aria-disabled')).toBe('true');
    digits('12345');
    press(inPrompt('Continue'));
    expect(prompt()).not.toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, STAFF_MEAL)));
    digits('6');
    expect(inPrompt('Continue').getAttribute('aria-disabled')).toBeNull();
    press(inPrompt('Continue'));
    expect(prompt()).toBeNull();
    expect(sheet()).toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, OTHER('15'))));
    expect(totalsRows()[1]![0]).toBe('Other discount 15%');
  });

  it('with nothing applied it is an application, not a replacement, and still gated', () => {
    load('/pos/floor');
    press(table(2));
    addBurger();
    const subtotal = shownSubtotal();
    press(discountButton());
    press(inSheet('Other amount — needs a manager'));
    typeValue('15');
    press(inSheet('Apply'));
    expect(prompt()!.querySelector('.modal__request')!.textContent).toContain('Apply a discount');
    expect(hasDiscountRow()).toBe(false);
    approve();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(subtotal, OTHER('15'))));
  });
});

describe('cancelling the prompt changes nothing (16)', () => {
  it.each([
    ['Cancel', () => press(inPrompt('Cancel'))],
    ['Escape', () => escape()],
  ] as const)('%s returns to the sheet as it was, entry typed, order unchanged', (_how, leave) => {
    render('default');
    press(discountButton());
    press(inSheet('Replace with another amount — needs a manager'));
    typeValue('15');
    press(inSheet('Apply'));
    digits('123');
    leave();
    expect(prompt()).toBeNull();
    expect(title()).toBe('Other discount');
    expect(field().value).toBe('15');
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, STAFF_MEAL)));
    // Opened again, it is a fresh pad, and the same order still carries Staff meal.
    press(inSheet('Apply'));
    expect(host.querySelectorAll('.pin-dot--filled')).toHaveLength(0);
    press(inPrompt('Cancel'));
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, STAFF_MEAL)));
  });
});

describe('a free-form discount gates everything after it (17)', () => {
  it('replacing it with a preset asks first, and reads the preset after', () => {
    render('other-discount');
    press(discountButton());
    expect(title()).toBe('Change discount');
    press(inSheet('Replace with another preset — needs a manager'));
    press(inSheet('Staff meal — 10% — needs a manager'));
    expect(prompt()).not.toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, OTHER_15)));
    approve();
    expect(prompt()).toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, STAFF_MEAL)));
  });

  it('removing it asks first, and reads no discount after', () => {
    render('other-discount');
    press(discountButton());
    press(inSheet('Remove the discount — needs a manager'));
    expect(prompt()).not.toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, OTHER_15)));
    approve();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL)));
  });
});

describe('the digits go nowhere (18)', () => {
  const sheets = code('DiscountSheets.tsx');

  it('the prompt’s submit handler declares no parameter', () => {
    expect(sheets).toMatch(/onSubmit=\{\(\)\s*=>/);
    expect(sheets).not.toMatch(/onSubmit=\{\(\s*\w/);
    expect(sheets).not.toMatch(/\(\s*pin\b|\bpin\s*[:,)]/i);
  });

  it('the manager-prompt literal is written in that handler and nowhere else in the client', () => {
    const files = readdirSync(srcDir).filter((f) => /\.tsx?$/.test(f) && f !== 'discountChange.ts');
    const holders = files.filter((f) => code(f).includes("'manager-prompt'"));
    expect(holders).toEqual(['DiscountSheets.tsx']);
    expect(sheets.match(/'manager-prompt'/g)).toHaveLength(1);
    expect(sheets.split('\n').find((l) => l.includes("'manager-prompt'"))).toMatch(/onSubmit=\{\(\)\s*=>/);
  });

  it('the gate’s second argument is never placed in state, a ref or the URL, nor called approval', () => {
    expect(sheets).not.toMatch(/useState<[^>]*Through|useRef<[^>]*Through/);
    const naming = sheets.split('\n').filter((l) => /through/i.test(l));
    expect(naming.length).toBeGreaterThan(0);
    expect(naming.filter((l) => /approv|confirm/i.test(l))).toEqual([]);
  });
});

// ---- the four addresses are live (19) ----

describe('the four addresses write the order they stand over (19)', () => {
  it('sheet-discount: Regular customer lands on default, and the totals read it', () => {
    render('sheet-discount');
    press(inSheet('Regular customer — 5%'));
    expect(urlState()).toBe('default');
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, REGULAR)));
  });

  it('sheet-freeform: the typed 15 goes through the prompt, lands on default, and the order carries it', () => {
    render('sheet-freeform');
    press(inSheet('Apply'));
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, STAFF_MEAL)));
    approve();
    expect(urlState()).toBe('default');
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, OTHER('15'))));
  });

  it('sheet-remove: Comp lands on zero and the total is 0; Remove lands on default with no discount row', () => {
    render('sheet-remove');
    press(inSheet('Replace with another preset'));
    press(inSheet('Comp — 100%'));
    expect(urlState()).toBe('zero');
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, COMP)));
    expect(totalsRows().find((r) => r[0] === 'Total')![1]).toBe('0');

    render('sheet-remove');
    press(inSheet('Remove the discount'));
    expect(urlState()).toBe('default');
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL)));
    expect(hasDiscountRow()).toBe(false);
  });

  it.each([
    ['Regular customer — 5%', 'default', REGULAR],
    ['Comp — 100%', 'zero', COMP],
  ] as const)('sheet-remove-freeform: %s, confirmed through the prompt, lands on %s and the order carries it', (preset, lands, snapshot) => {
    render('sheet-remove-freeform');
    press(inSheet('Replace with another preset — needs a manager'));
    press(inSheet(`${preset} — needs a manager`));
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, OTHER_15)));
    approve();
    expect(urlState()).toBe(lands);
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, snapshot)));
  });
});

describe('a change step over an order with no discount (L3)', () => {
  it('draws the picker and does not throw', () => {
    load('/pos/order?state=sheet-remove');
    press(inSheet('Remove the discount'));
    expect(sheet()).toBeNull();
    expect(hasDiscountRow()).toBe(false);
    window.history.replaceState(null, '', '/pos/order?state=sheet-remove');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(title()).toBe('Discount');
    expect(sheet()!.querySelector('.discount-applied')).toBeNull();
  });
});

// ---- a refusal (20) ----

/** A discount sheet over an order, handed a store that answers every change with `refused`. */
function refusingSheet(state: OrderState, refused: DiscountRefusal) {
  const went: OrderView[] = [];
  const asked: Array<[DiscountChange, DiscountThrough]> = [];
  const order: ShownOrder = shownOrder({ state });
  act(() =>
    root.render(
      <div className="pos-device" key={++mount}>
        <DiscountSheet
          fixture={DISCOUNT_FIXTURES[state]!}
          order={order}
          changeDiscount={(change, through) => {
            asked.push([change, through]);
            return { refused };
          }}
          go={(v) => went.push(v)}
        />
      </div>
    )
  );
  return { went, asked };
}

describe('a refusal (20)', () => {
  it('an ungated press the store refuses leaves the sheet open, routes nowhere, and shows the order’s discount', () => {
    const { went, asked } = refusingSheet('sheet-remove', 'locked');
    press(inSheet('Remove the discount'));
    expect(asked).toEqual([[REMOVE, 'direct']]);
    expect(went).toEqual([]);
    expect(prompt()).toBeNull();
    expect(title()).toBe('Change discount');
    expect(sheet()!.querySelector('.discount-applied__row')!.textContent).toBe('Staff meal — 10%−40.500');
  });

  it('a prompt that is confirmed and then refused closes, and the sheet stays', () => {
    const { went, asked } = refusingSheet('sheet-remove-freeform', 'locked');
    const raising = inSheet('Remove the discount — needs a manager');
    press(raising);
    expect(prompt()).not.toBeNull();
    approve();
    expect(asked).toEqual([[REMOVE, 'manager-prompt']]);
    expect(went).toEqual([]);
    expect(prompt()).toBeNull();
    expect(title()).toBe('Change discount');
    expect(sheet()!.closest('[inert]')).toBeNull();
    expect(sheet()!.querySelector('.discount-applied__row')!.textContent).toBe('Other discount — 15%−60.750');
    expect(document.activeElement).toBe(inSheet('Remove the discount — needs a manager'));
  });

  it('a second attempt mounts a fresh prompt', () => {
    refusingSheet('sheet-remove-freeform', 'locked');
    press(inSheet('Remove the discount — needs a manager'));
    digits('123456');
    press(inPrompt('Continue'));
    press(inSheet('Remove the discount — needs a manager'));
    expect(host.querySelectorAll('.pin-dot--filled')).toHaveLength(0);
    expect(inPrompt('Continue').getAttribute('aria-disabled')).toBe('true');
  });
});

// ---- opening and cancelling choose nothing (21) ----

describe('nothing chooses a discount but a press, on screen (21)', () => {
  it.each([
    ['sheet-discount', STAFF_MEAL],
    ['sheet-freeform', STAFF_MEAL],
    ['sheet-remove', STAFF_MEAL],
    ['sheet-remove-freeform', OTHER_15],
  ] as const)('%s: mounting, then cancelling, leaves the order as the fixture seeded it', (state, applied) => {
    render(state);
    expect(prompt()).toBeNull();
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, applied)));
    press(buttons(sheet()!).find((b) => ['Cancel', 'Back'].includes(text(b)))!);
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, applied)));
  });

  it('opening Discount from the bar and leaving with Cancel changes nothing', () => {
    render('default');
    press(discountButton());
    press(inSheet('Cancel'));
    expect(totalsRows()).toEqual(rowsOf(orderTotals(TABLE_1_SUBTOTAL, STAFF_MEAL)));
  });
});

// ---- the rest of the client follows (22, 23) ----

const settle = () => press(host.querySelector('.order-actions [data-action="settle"]')!);
const closeButton = () => host.querySelector<HTMLElement>('[data-action="close-order"]')!;
const link = (label: string) => [...host.querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === label)!;
const TABLE_9_SUBTOTAL = 165_000n;

/** Table 9, opened from the floor, with a discount chosen on POS-03. */
function discountTable9(choose: () => void) {
  load('/pos/floor');
  press(table(9));
  press(discountButton());
  choose();
}

describe('the settlement follows (22)', () => {
  it('shows the discounted total as the amount due', () => {
    discountTable9(() => press(inSheet('Regular customer — 5%')));
    settle();
    expect(window.location.pathname).toBe('/pos/settlement');
    expect(text(host.querySelector('.settlement-balance__amount')!)).toBe(formatAmount(orderTotals(TABLE_9_SUBTOTAL, REGULAR).total));
    expect(orderTotals(TABLE_9_SUBTOTAL, REGULAR).total).not.toBe(orderTotals(TABLE_9_SUBTOTAL).total);
  });

  it('a 100% discount reaches the zero-total settlement and closes with no tenders', () => {
    discountTable9(() => press(inSheet('Comp — 100%')));
    settle();
    expect(text(host.querySelector('.settlement-balance__amount')!)).toBe('0');
    expect(closeButton().getAttribute('aria-disabled')).toBeNull();
    press(closeButton());
    expect(window.location.pathname).toBe('/pos/floor');
  });
});

/** The closed rows POS-05 draws: name, payment words and total. */
const closedRows = () =>
  [...host.querySelectorAll('.closed-row')].map((a) => {
    const [, name, pay, total] = [...a.children];
    return {
      name: text(name!),
      pay: [...pay!.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim(),
      total: text(total!),
    };
  });

describe('the closed orders follow (23)', () => {
  it('a discounted order paid by card lists with the discounted total, and POS-06 shows the discount with its label', () => {
    discountTable9(() => press(inSheet('Regular customer — 5%')));
    settle();
    press(host.querySelector('[data-method="card"]')!);
    press(host.querySelector('[data-action="add-tender"]')!);
    press(closeButton());
    press(link('Closed orders'));
    const total = formatAmount(orderTotals(TABLE_9_SUBTOTAL, REGULAR).total);
    expect(closedRows()[0]).toEqual({ name: 'Table 9', pay: `Card ${total}`, total });
    press(host.querySelector('.closed-row')!);
    expect(window.location.pathname).toBe('/pos/closed-order');
    expect(text(host)).toContain('Regular customer 5%');
    expect(text(host)).toContain(formatAmount(-discountAmount(TABLE_9_SUBTOTAL, REGULAR.value)));
  });

  it('a free-form 100% reads its own words, never Comp’s', () => {
    discountTable9(() => {
      press(inSheet('Other amount — needs a manager'));
      typeValue('100');
      press(inSheet('Apply'));
      approve();
    });
    settle();
    press(closeButton());
    press(link('Closed orders'));
    expect(closedRows()[0]).toEqual({ name: 'Table 9', pay: 'Other discount 100% · no payment taken', total: '0' });
  });

  it('the Comp preset still reads Comp 100% · no payment taken', () => {
    discountTable9(() => press(inSheet('Comp — 100%')));
    settle();
    press(closeButton());
    press(link('Closed orders'));
    expect(closedRows()[0]).toEqual({ name: 'Table 9', pay: 'Comp 100% · no payment taken', total: '0' });
  });
});
