// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PosRoutes } from '../src/PosRoutes.js';
import { SettlementScreen } from '../src/SettlementScreen.js';
import type { OrderStore } from '../src/orderStore.js';
import { shownOrder } from '../src/voidFixtures.js';

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/pos.css'), 'utf8');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  window.history.replaceState(null, '', '/pos/order?state=quick');
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  window.history.replaceState(null, '', '/pos/order');
});

const press = (element: Element) => act(() => (element as HTMLElement).click());
const buttonNamed = (name: string) =>
  [...host.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === name)!;

function enterSettlementWithBurger() {
  act(() => root.render(<PosRoutes />));
  press(host.querySelector('[data-item="burger"]')!);
  press(buttonNamed('Add to order'));
  press(host.querySelector('[data-action="settle"]')!);
}

async function back() {
  const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
  act(() => window.history.back());
  await act(async () => popped);
}

describe('POS-03 to POS-04 routing', () => {
  it('settles the live order the cashier built, never a settlement fixture', () => {
    enterSettlementWithBurger();

    expect(window.location.pathname).toBe('/pos/settlement');
    expect(host.querySelector('.settlement-screen')).not.toBeNull();
    expect([...host.querySelectorAll('.settlement-totals dd')].map((value) => value.textContent)).toEqual([
      '300.000',
      '15.000',
      '315.000',
      '27.273',
    ]);
  });

  it('Back returns to POS-03 with the added line still on the order', async () => {
    enterSettlementWithBurger();

    await back();

    expect(window.location.pathname).toBe('/pos/order');
    expect([...host.querySelectorAll('.order-line__name')].map((line) => line.firstChild!.textContent)).toEqual([
      'Burger',
      'Soda',
      'Burger',
    ]);
    expect(host.querySelector('.totals__row--grand dd')!.textContent).toBe('315.000');
  });

  it.each([
    ['lock-draft', 'Back to payment', 'settle-pending'],
    ['lock-lease', 'Manager: take over payment', 'settle-takeover'],
  ] as const)('%s routes its placeholder action to POS-04', (state, label, settlementState) => {
    window.history.replaceState(null, '', `/pos/order?state=${state}`);
    act(() => root.render(<PosRoutes />));

    press([...host.querySelectorAll('a')].find((anchor) => anchor.textContent === label)!);

    expect(window.location.pathname).toBe('/pos/settlement');
    expect(window.location.search).toBe(`?state=${settlementState}`);
    expect(host.querySelector('.settlement-screen')).not.toBeNull();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('tender entry', () => {
  it.each([
    ['empty', 0, '155.925', 'SPAN'],
    ['pressed', 0, '155.925', 'SPAN'],
    ['partial', 1, '55.925', 'SPAN'],
    ['exact', 1, '0', 'BUTTON'],
    ['overflow', 6, '0', 'BUTTON'],
  ] as const)('%s draws its reviewed draft and exact-close state', (state, draftCount, balance, closeTag) => {
    window.history.replaceState(null, '', `/pos/settlement?state=${state}`);
    act(() => root.render(<PosRoutes />));

    expect(host.querySelectorAll('.draft-tender')).toHaveLength(draftCount);
    expect(host.querySelector('.settlement-balance__amount')!.textContent).toBe(balance);
    expect(host.querySelector('[data-action="close-order"]')!.tagName).toBe(closeTag);
  });

  it('pressed holds the Cash chip, 5 key, and Add cash control only in that fixture', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=pressed');
    act(() => root.render(<PosRoutes />));
    expect(
      [...host.querySelectorAll('.is-pressed')].map((element) =>
        element.getAttribute('data-method') ?? element.getAttribute('data-digit') ?? element.getAttribute('data-action')
      )
    ).toEqual(['cash', 'add-tender', '5']);
  });

  it('prefills the whole remaining balance for Cash and again for Card', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));

    const amount = () => host.querySelector('.tender-amount')!;
    const method = (name: 'cash' | 'card') => host.querySelector(`[data-method="${name}"]`)!;

    expect(amount().textContent).toBe('155.925');
    expect(method('cash').getAttribute('aria-pressed')).toBe('true');

    press(method('card'));

    expect(amount().textContent).toBe('155.925');
    expect(method('card').getAttribute('aria-pressed')).toBe('true');
  });

  it('two successive below-balance tenders reduce the balance and re-prefill the field each time', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));

    const key = (digit: string) => press(host.querySelector(`[data-digit="${digit}"]`)!);
    const keyAmount = (digits: string) => [...digits].forEach(key);
    const amount = () => host.querySelector('.tender-amount')!.textContent;
    const balance = () => host.querySelector('.settlement-balance__amount')!.textContent;

    press(host.querySelector('[data-method="card"]')!);
    keyAmount('100000');
    press(host.querySelector('[data-action="add-tender"]')!);

    expect([...host.querySelectorAll('.draft-tender')].map((row) => row.textContent)).toEqual(['Card100.000Remove']);
    expect(balance()).toBe('55.925');
    expect(amount()).toBe('55.925');

    press(host.querySelector('[data-method="cash"]')!);
    keyAmount('50000');
    press(host.querySelector('[data-action="add-tender"]')!);

    expect([...host.querySelectorAll('.draft-tender__amount')].map((value) => value.textContent)).toEqual([
      '100.000',
      '50.000',
    ]);
    expect(balance()).toBe('5.925');
    expect(amount()).toBe('5.925');
  });

  it('keeps Close unavailable one minor unit short and makes it live only at exact zero', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));

    for (const digit of '155924') press(host.querySelector(`[data-digit="${digit}"]`)!);
    press(host.querySelector('[data-action="add-tender"]')!);

    let close = host.querySelector<HTMLElement>('[data-action="close-order"]')!;
    expect(host.querySelector('.settlement-balance__amount')!.textContent).toBe('1');
    expect(close.tagName).toBe('SPAN');
    expect(close.getAttribute('aria-disabled')).toBe('true');

    press(host.querySelector('[data-digit="1"]')!);
    press(host.querySelector('[data-action="add-tender"]')!);

    close = host.querySelector<HTMLElement>('[data-action="close-order"]')!;
    expect(host.querySelector('.settlement-balance__amount')!.textContent).toBe('0');
    expect(close.tagName).toBe('BUTTON');
  });

  it('labels drafted lines as tab-local and never presents one as saved, submitted, or recorded', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[data-action="add-tender"]')!);

    expect(host.querySelector('.drafts-heading')!.textContent).toContain('NOTHING RECORDED YET');
    const draft = host.querySelector('.draft-tender')!.textContent!.toLowerCase();
    expect(draft).not.toMatch(/saved|submitted|recorded/);
  });

  it.each(['cash', 'card'] as const)('%s refuses an over-balance draft through tender.ts and shows the invalid field', (method) => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector(`[data-method="${method}"]`)!);
    for (const digit of '155926') press(host.querySelector(`[data-digit="${digit}"]`)!);

    expect(host.querySelector('.tender-amount--invalid')!.textContent).toBe('155.926');
    expect(host.querySelector('.tender-field__message')!.textContent).toContain('cannot be added');
    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('SPAN');
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(0);
  });

  it('Close at exact settlement intentionally produces no visible result in F3a', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=exact');
    act(() => root.render(<PosRoutes />));
    const before = host.innerHTML;

    press(host.querySelector('[data-action="close-order"]')!);

    expect(host.innerHTML).toBe(before);
    expect(window.location.pathname).toBe('/pos/settlement');
  });

  it('renders overflow as a scrolling draft region beside pinned total and balance regions', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=overflow');
    act(() => root.render(<PosRoutes />));

    expect(host.querySelectorAll('.draft-tender')).toHaveLength(6);
    expect(host.querySelector('.drafts-list')!.parentElement!.className).toBe('drafts-region');
    expect(host.querySelector('.settlement-totals')!.closest('.drafts-list')).toBeNull();
    expect(host.querySelector('.settlement-balance')!.closest('.drafts-list')).toBeNull();
    expect(host.querySelector('.settlement-balance__amount')!.textContent).toBe('0');
    expect(host.querySelector('[data-action="close-order"]')!.tagName).toBe('BUTTON');
  });

  it('makes only the draft list scroll while the summary totals and balance stay pinned', () => {
    expect(css).toMatch(/\.settlement-summary\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
    expect(css).toMatch(/\.settlement-totals\s*\{[^}]*flex:\s*none;/s);
    expect(css).toMatch(/\.settlement-balance\s*\{[^}]*flex:\s*none;/s);
    expect(css).toMatch(/\.drafts-list\s*\{[^}]*overflow-y:\s*auto;/s);
  });

  it('delegates Add availability to the tender rule', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    const store: OrderStore = {
      order: shownOrder({ state: 'default', gone: 'steak' }),
      addLine: () => {},
      removeLine: () => {},
      setQuantity: () => {},
    };
    act(() => root.render(<SettlementScreen store={store} addRule={() => false} />));

    const add = host.querySelector<HTMLElement>('[data-action="add-tender"]')!;
    expect(add.tagName).toBe('SPAN');
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(0);
  });
});
