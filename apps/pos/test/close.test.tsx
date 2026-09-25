// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PosRoutes } from '../src/PosRoutes.js';

// FE-027 / POS-04: Close actually closes, and the table comes free.

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
const tile = (n: number) => host.querySelector<HTMLAnchorElement>(`[data-table="${n}"]`)!;
const tileText = (n: number) => [...tile(n).querySelectorAll('strong, .floor-sub, .floor-table-amount')].map(text).join(' ');
const heading = () => text(host.querySelector('#order-title')!);
const backToFloor = () => [...host.querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === '← Floor')!;
const settle = () => press(host.querySelector('.order-actions [data-action="settle"]')!);
const closeButton = () => host.querySelector<HTMLElement>('[data-action="close-order"]')!;
const button = (label: string) => [...host.querySelectorAll('button')].find((b) => text(b) === label)!;
const path = () => `${window.location.pathname}${window.location.search}`;
const back = async () => {
  const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
  act(() => window.history.back());
  await act(async () => popped);
};

/** Table 9 → Settle → Card, whole balance (173.250), stopped before Close. */
function payTable9ByCard() {
  press(tile(9));
  settle();
  press(host.querySelector('[data-method="card"]')!);
  press(host.querySelector('[data-action="add-tender"]')!);
}

describe('FE-027: the walk', () => {
  it('Table 9 → Settle → Card 173.250 → Close: the floor, Table 9 Free, a new empty Order · T9', () => {
    load('/pos/floor');
    payTable9ByCard();
    expect(text(host)).toContain('173.250');
    expect(closeButton().getAttribute('aria-disabled')).toBeNull();
    press(closeButton());
    expect(window.location.pathname).toBe('/pos/floor');
    expect(host.querySelector('.floor')).not.toBeNull();
    expect(tileText(9)).toBe('Table 9 Free Open table order');
    press(tile(9));
    expect(heading()).toBe('Order · T9');
    expect(host.querySelectorAll('.order-line')).toHaveLength(0);
  });

  it('the new order is its own: adding to it moves only the new Table 9', () => {
    load('/pos/floor');
    payTable9ByCard();
    press(closeButton());
    press(tile(9));
    press(host.querySelector('[data-item="burger"]')!);
    press(button('Add to order'));
    press([...host.querySelectorAll<HTMLAnchorElement>('a')].find((x) => text(x) === '← Floor')!);
    expect(tileText(9)).toBe('Table 9 1 line pending Open 141.750');
  });

  it('Close is a replaceState, not a push', () => {
    load('/pos/floor');
    const before = window.history.length;
    payTable9ByCard();
    const atSettle = window.history.length;
    expect(atSettle).toBeGreaterThan(before);
    press(closeButton());
    expect(window.history.length).toBe(atSettle);
  });

  it('a payment on another table is untouched by this close', async () => {
    load('/pos/floor');
    press(tile(1));
    act(() => {
      window.history.pushState(null, '', '/pos/settlement?state=partial');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await back();
    press(backToFloor());
    expect(tileText(1)).toContain('Payment in progress');
    payTable9ByCard();
    press(closeButton());
    expect(tileText(1)).toContain('Payment in progress');
    expect(tileText(9)).toContain('Free');
    press(tile(1));
    expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBe('draft');
  });
});

describe('FE-027 rule 6: a closed order is never editable or re-closable', () => {
  it('close Table 9, then Back twice: no second close, and exactly one closed Table 9', async () => {
    load('/pos/floor');
    payTable9ByCard();
    press(closeButton());
    await back();
    // Back lands on the order route of the closed order: it replaces itself with the floor.
    expect(window.location.pathname).toBe('/pos/floor');
    expect(host.querySelector('[data-action="close-order"]')).toBeNull();
    expect(host.querySelector('[data-action="settle"], [data-action="fire"]')).toBeNull();
    await back();
    expect(host.querySelector('[data-action="close-order"]')).toBeNull();
    expect(tileText(9)).toContain('Free');
  });

  it('a double press closes once', () => {
    load('/pos/floor');
    payTable9ByCard();
    const b = closeButton();
    act(() => {
      b.click();
      b.click();
    });
    expect(window.location.pathname).toBe('/pos/floor');
    expect(tileText(9)).toContain('Free');
  });

  it('a refused close (balance outstanding) does nothing and stays on the settlement', () => {
    load('/pos/floor');
    press(tile(9));
    settle();
    press(closeButton());
    expect(window.location.pathname).toBe('/pos/settlement');
    expect(host.querySelector('.floor')).toBeNull();
  });
});
