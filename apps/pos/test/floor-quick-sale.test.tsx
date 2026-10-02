// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FLOOR_STATES, type FloorState } from '../src/floorFixtures.js';
import { statusOf } from '../src/FloorScreen.js';
import { countLines, orderCountLabel, type RoundGroup } from '../src/orderFixtures.js';
import { PosRoutes } from '../src/PosRoutes.js';

// FE-033: the floor's two after-close states, the open quick-sale strip, and lines
// (not units) wherever the floor and the order panel count an order.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const press = (el: Element) => act(() => (el as HTMLElement).click());
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

function load(url: string) {
  window.history.replaceState(null, '', url);
  act(() => root.render(<PosRoutes key={++mount} />));
}

const link = (name: string) => [...host.querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === name)!;
const button = (name: string) => [...host.querySelectorAll('button')].find((b) => text(b) === name)!;
const backToFloor = () => link('← Floor');
const path = () => `${window.location.pathname}${window.location.search}`;
const strip = () => host.querySelector('.floor-quick');
const controls = () => [...host.querySelectorAll<HTMLAnchorElement>('.floor-quick a')];
const controlTexts = () => controls().map(text);
const count = () => text(host.querySelector('.order-panel__count')!);
const grand = () => text(host.querySelector('.totals__row--grand dd')!);

const FIXTURE_SALE = 'Quick sale · 2 lines · 173.250 · Resume';
const addBurger = () => {
  press(host.querySelector('[data-item="burger"]')!);
  press(button('Add to order'));
};
const newSale = () => press(link('New quick sale'));

function closeThisOrder() {
  press(host.querySelector('.order-actions [data-action="settle"]')!);
  press(host.querySelector('[data-method="card"]')!);
  press(host.querySelector('[data-action="add-tender"]')!);
  press(host.querySelector('[data-action="close-order"]')!);
}

const line = (id: string, status: 'pending' | 'fired' | 'voided', quantity = 1) => ({ id, quantity, name: id, itemId: id, amount: 1_000n, status });

describe('lines: one count for the tile, the panel and the strip', () => {
  const fired = (...lines: ReturnType<typeof line>[]): RoundGroup => ({ kind: 'fired', round: 1, firedAt: '19:00', delivery: 'printed', lines });

  it('countLines counts lines not voided, across every group, and never a quantity', () => {
    const groups: RoundGroup[] = [fired(line('a', 'fired', 3), line('b', 'voided', 2)), { kind: 'pending', lines: [line('c', 'pending', 4)] }];
    expect(countLines(groups)).toBe(2);
    expect(countLines([])).toBe(0);
  });

  it('the tile status counts a fired order’s lines: one line, and a voided line not at all', () => {
    expect(statusOf([fired(line('a', 'fired', 5))])).toBe('1 round fired · 1 line');
    expect(statusOf([fired(line('a', 'fired'), line('b', 'voided'))])).toBe('1 round fired · 1 line');
    expect(statusOf([fired(line('a', 'fired'), line('b', 'fired'))])).toBe('1 round fired · 2 lines');
    // Pending is unchanged.
    expect(statusOf([fired(line('a', 'fired')), { kind: 'pending', lines: [line('p', 'pending'), line('q', 'pending')] }])).toBe(
      '1 round fired · 2 lines pending'
    );
  });

  it('the panel’s words', () => {
    expect(orderCountLabel('table', 1)).toBe('1 line');
    expect(orderCountLabel('table', 2)).toBe('2 lines');
    expect(orderCountLabel('quick_sale', 1)).toBe('1 line · not yet sent');
    expect(orderCountLabel('quick_sale', 2)).toBe('2 lines · not yet sent');
  });
});

describe('the two after-close states', () => {
  it('after-close draws Table 1 free, the three other occupied tables, no chip', () => {
    load('/pos/floor?state=after-close');
    expect(text(host.querySelector('[data-table="1"]')!)).toBe('Table 1FreeOpen table order');
    for (const n of [7, 9, 12]) expect(host.querySelector(`[data-table="${n}"]`)!.className).toContain('floor-table--open');
    expect(text(host.querySelector('.floor-toolbar')!)).toContain('3 open · 9 free');
    expect(host.querySelector('.floor-warning')).toBeNull();
  });

  it('after-close-receipt adds the chip, whose door goes to the incidents client side', () => {
    load('/pos/floor?state=after-close-receipt');
    expect(text(host.querySelector('.floor-warning')!)).toBe('Receipt printer: 1 unprinted receiptView receipts');
    press(link('View receipts'));
    expect(path()).toBe('/pos/incidents');
  });

  it('a free Table 1 opens a new empty order like any free tile', () => {
    load('/pos/floor?state=after-close');
    press(host.querySelector('[data-table="1"]')!);
    expect(path()).toBe('/pos/order?state=empty');
    expect(count()).toBe('Empty');
  });
});

describe('a live Close lands on the plain floor and reports no print', () => {
  it('replaceState to exactly /pos/floor, and no chip', () => {
    load('/pos/floor');
    press(host.querySelector('[data-table="1"]')!);
    for (let r = host.querySelector('.order-line__remove'); r; r = host.querySelector('.order-line__remove')) press(r);
    closeThisOrder();
    expect(path()).toBe('/pos/floor');
    expect(window.location.search).toBe('');
    expect(host.querySelector('.floor-warning')).toBeNull();
  });

  it('draws, in tiles, count and strip, what a fresh load of after-close draws', () => {
    load('/pos/floor');
    press(host.querySelector('[data-table="1"]')!);
    for (let r = host.querySelector('.order-line__remove'); r; r = host.querySelector('.order-line__remove')) press(r);
    closeThisOrder();
    const drawn = () => [host.querySelector('.floor-grid')!.innerHTML, text(host.querySelector('.floor-toolbar')!), strip()?.innerHTML];
    const live = drawn();
    load('/pos/floor?state=after-close');
    expect(live).toEqual(drawn());
    expect(live[1]).toContain('3 open · 9 free');
  });
});

describe('the closed-day header', () => {
  it('dayclosed names the day that is open; the other ten say 25 Sep', () => {
    for (const { id } of FLOOR_STATES) {
      load(`/pos/floor?state=${id}`);
      const head = text(host.querySelector('.floor-head')!);
      expect(head, id).toContain(id === 'dayclosed' ? 'Business day open · 26 Sep' : 'Business day open · 25 Sep');
      expect(head, id).not.toContain('closed ·');
    }
  });
});

describe('the open quick-sale strip', () => {
  const WITH: FloorState[] = ['default', 'incident', 'receipt-warning', 'overflow', 'after-close', 'after-close-receipt'];
  const WITHOUT: FloorState[] = ['clear', 'dayclosed', 'empty', 'loading', 'error'];

  it('a fresh load draws the fixture’s sale in six states and nothing in the other five', () => {
    for (const state of WITH) {
      load(`/pos/floor?state=${state}`);
      expect(text(host.querySelector('.floor-quick .floor-sub')!), state).toBe('Open quick sale');
      expect(controlTexts(), state).toEqual([FIXTURE_SALE]);
      expect(controls()[0]!.getAttribute('href'), state).toBe('/pos/order?state=quick');
    }
    for (const state of WITHOUT) {
      load(`/pos/floor?state=${state}`);
      expect(strip(), state).toBeNull();
      expect(text(host), state).not.toContain('Open quick sale');
    }
  });

  it('is its own element: .floor-tools still holds exactly its two doors', () => {
    load('/pos/floor');
    expect(strip()!.classList.contains('floor-tools')).toBe(false);
    expect([...host.querySelectorAll('.floor-tools a')].map(text)).toEqual(['Closed orders', 'New quick sale']);
  });

  it('Resume opens that order client side; a modified click opens nothing', () => {
    load('/pos/floor');
    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
    let preventedByUs: boolean | undefined;
    const observe = (e: Event) => {
      preventedByUs = e.defaultPrevented;
      e.preventDefault();
    };
    document.body.addEventListener('click', observe);
    act(() => {
      controls()[0]!.dispatchEvent(modified);
    });
    document.body.removeEventListener('click', observe);
    expect(preventedByUs).toBe(false);
    expect(path()).toBe('/pos/floor');
    press(controls()[0]!);
    expect(path()).toBe('/pos/order?state=quick');
    expect(text(host.querySelector('#order-title')!)).toBe('Order · counter');
    expect(count()).toBe('2 lines · not yet sent');
    expect(grand()).toBe('173.250');
  });

  it('reads the book: the fixture’s figures give way to what the order now holds, and it leaves when emptied', () => {
    load('/pos/floor');
    press(controls()[0]!);
    press(host.querySelector('[data-line-id="q-burger"] .order-line__remove')!);
    press(backToFloor());
    expect(controlTexts()).toEqual(['Quick sale · 1 line · 31.500 · Resume']);
    press(controls()[0]!);
    press(host.querySelector('[data-line-id="q-soda"] .order-line__remove')!);
    press(backToFloor());
    expect(strip()).toBeNull();
  });

  it('a new sale is its own control, after the fixture’s, at its own address', () => {
    load('/pos/floor');
    newSale();
    addBurger();
    press(backToFloor());
    expect(controlTexts()).toHaveLength(2);
    expect(controlTexts()[0]).toBe(FIXTURE_SALE);
    expect(controls()[1]!.getAttribute('href')).toBe('/pos/order?state=quick-new');
    press(controls()[1]!);
    expect(path()).toBe('/pos/order?state=quick-new');
    expect(count()).toBe('1 line · not yet sent');
  });

  it('a new sale left empty is not listed', () => {
    load('/pos/floor');
    newSale();
    press(backToFloor());
    expect(controlTexts()).toEqual([FIXTURE_SALE]);
  });

  it('on clear, the book’s sale is the only control', () => {
    load('/pos/floor');
    newSale();
    addBurger();
    window.history.pushState(null, '', '/pos/floor?state=clear');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(controlTexts()).toHaveLength(1);
    expect(controlTexts()[0]).not.toBe(FIXTURE_SALE);
  });

  it('a closed new sale leaves the strip, and so does the fixture’s once closed', () => {
    load('/pos/floor');
    newSale();
    addBurger();
    closeThisOrder();
    expect(controlTexts()).toEqual([FIXTURE_SALE]);
    press(controls()[0]!);
    closeThisOrder();
    expect(path()).toBe('/pos/floor');
    expect(strip()).toBeNull();
  });

  it('a sale being paid stays listed in the same words, and Resume opens it locked', () => {
    load('/pos/floor');
    newSale();
    addBurger();
    press(host.querySelector('.order-actions [data-action="settle"]')!);
    press(host.querySelector('[data-method="card"]')!);
    press(host.querySelector('[data-action="add-tender"]')!);
    window.history.pushState(null, '', '/pos/floor');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(controlTexts()).toHaveLength(2);
    expect(text(strip()!)).not.toContain('Payment in progress');
    press(controls()[1]!);
    expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBe('draft');
  });

  it('nothing read, nothing listed: loading and error draw no strip over a held sale; empty, clear and dayclosed list it', () => {
    load('/pos/floor');
    newSale();
    addBurger();
    const at = (state: string) => {
      window.history.pushState(null, '', `/pos/floor?state=${state}`);
      act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    };
    for (const state of ['loading', 'error']) {
      at(state);
      expect(strip(), state).toBeNull();
    }
    for (const state of ['empty', 'clear', 'dayclosed']) {
      at(state);
      expect(controlTexts(), state).toHaveLength(1);
    }
  });

  it('the toolbar’s Closed orders is plain from the new states', () => {
    for (const state of ['after-close', 'after-close-receipt']) {
      load(`/pos/floor?state=${state}`);
      expect(link('Closed orders').getAttribute('href')).toBe('/pos/closed-orders');
    }
  });
});
