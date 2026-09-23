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

/** Forces a fresh mount (a real navigation), rather than a rerender that keeps stale state. */
function remount() {
  act(() => root.unmount());
  host.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<PosRoutes />));
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

  it('card refuses an over-balance draft through tender.ts and shows the invalid field', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[data-method="card"]')!);
    for (const digit of '155926') press(host.querySelector(`[data-digit="${digit}"]`)!);

    expect(host.querySelector('.tender-amount--invalid')!.textContent).toBe('155.926');
    expect(host.querySelector('.tender-field__message')!.textContent).toBe('Card maximum 155.925');
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

describe('F3b: cash and card diverge (POS-04)', () => {
  const key = (digits: string) => [...digits].forEach((d) => press(host.querySelector(`[data-digit="${d}"]`)!));
  const amount = () => host.querySelector('.tender-amount')!.textContent;
  const balance = () => host.querySelector('.settlement-balance__amount')!.textContent;
  const add = () => press(host.querySelector('[data-action="add-tender"]')!);
  const method = (name: 'cash' | 'card') => press(host.querySelector(`[data-method="${name}"]`)!);

  const totalText = () =>
    [...host.querySelectorAll('.settlement-totals dt')].find((dt) => dt.textContent === 'Total')!.nextElementSibling!
      .textContent;

  it('AC-5: cash over the balance closes the sale with change due, live Close', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));

    key('200000');
    add();

    expect(balance()).toBe('0');
    expect(host.querySelector('.settlement-change__amount')!.textContent).toBe('44.075');
    expect(totalText()).toBe('155.925');
    expect(host.querySelector('.draft-change')!.textContent).toBe('Change given−44.075');
    const close = host.querySelector<HTMLElement>('[data-action="close-order"]')!;
    expect(close.tagName).toBe('BUTTON');
  });

  it('AC-2a: removing the over-tender clears the derived change', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=change');
    act(() => root.render(<PosRoutes />));

    press(host.querySelector('.draft-tender__remove')!);

    expect(balance()).toBe('155.925');
    expect(host.querySelector('.settlement-change')).toBeNull();
  });

  it('AC-2b: removing an earlier tender from under a cash over-tender shrinks the change, then removes it', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=partial');
    act(() => root.render(<PosRoutes />));

    method('cash');
    key('100000');
    add();
    expect(host.querySelector('.settlement-change__amount')!.textContent).toBe('44.075');

    press(
      [...host.querySelectorAll('.draft-tender')].find((row) => row.textContent!.startsWith('Card'))!.querySelector(
        '.draft-tender__remove'
      )!
    );
    expect(balance()).toBe('55.925');
    expect(host.querySelector('.settlement-change')).toBeNull();
  });

  it('AC-3: cash over the balance is accepted, card over the balance is refused and names the maximum', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));

    method('cash');
    key('155926');
    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('BUTTON');

    method('card');
    key('155926');
    expect(host.querySelector('.tender-field__message')!.textContent).toBe('Card maximum 155.925');
    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('SPAN');
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(0);
  });

  it('AC-4: the ceiling is the balance plus the change limit, exact to one unit', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));

    method('card');
    key('100000');
    add();
    expect(balance()).toBe('55.925');

    method('cash');
    key('10055924');
    expect(amount()).toBe('10.055.924');
    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('BUTTON');
    expect(host.querySelector('.notice')).toBeNull();

    press(host.querySelector('[aria-label="Delete last digit"]')!);
    key('5');
    expect(amount()).toBe('10.055.925');
    expect(host.querySelector('.tender-field__message')!.textContent).toBe('Cash maximum 10.055.924');
    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('SPAN');
    expect(host.querySelector('.notice__title')!.textContent).toBe('Too much cash to give change for');
  });

  it('the ceiling fixture itself is already the rejected 99.999.999 the artifact draws', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=ceiling');
    act(() => root.render(<PosRoutes />));

    expect(amount()).toBe('99.999.999');
    expect(host.querySelector('.tender-amount--invalid')).not.toBeNull();
    expect(host.querySelector('.tender-field__message')!.textContent).toBe('Cash maximum 10.055.924');
    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('SPAN');
  });

  it('AC-5-single-tender-cap: the maximum is capped at 99,999,999 once the change limit would exceed it', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    const store: OrderStore = {
      order: { ...shownOrder({ state: 'default', gone: 'steak' }), totals: { subtotal: 95_000_000n, total: 95_000_000n } },
      addLine: () => {},
      removeLine: () => {},
      setQuantity: () => {},
    };
    act(() => root.render(<SettlementScreen store={store} />));

    key('99999999');
    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('BUTTON');
    expect(host.querySelector('.notice')).toBeNull();

    for (let i = 0; i < 8; i++) press(host.querySelector('[aria-label="Delete last digit"]')!);
    key('100000000');
    expect(amount()).toBe('100.000.000');
    expect(host.querySelector('.tender-field__message')!.textContent).toBe('Cash maximum 99.999.999');
    expect(host.querySelector('.notice')).toBeNull();
    expect(host.querySelector('.tender-help')).toBeNull();
  });

  it('AC-6: a rejected tender changes nothing (B-20)', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=ceiling');
    act(() => root.render(<PosRoutes />));
    key('5');
    const before = host.innerHTML;

    press(host.querySelector('[data-action="add-tender"]')!);

    expect(host.innerHTML).toBe(before);
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(1);
    expect(balance()).toBe('55.925');
  });

  it('rule 4: nothing can be added at zero balance, by either method (FR-M5)', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=change');
    act(() => root.render(<PosRoutes />));

    method('cash');
    key('9999999');

    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('SPAN');
    expect(host.querySelector('[data-action="add-tender"]')!.textContent).toBe('Nothing left');
    expect(host.querySelector('.tender-amount--invalid')).toBeNull();
    expect(host.querySelector('.tender-field__message')).toBeNull();
    expect(host.querySelector('.notice')).toBeNull();
    expect(host.querySelector('.tender-help')).toBeNull();
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(1);
    expect(host.querySelector('.settlement-change__amount')!.textContent).toBe('44.075');
  });

  it('rule 4: nothing can be added at zero balance from exactcash either', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=exactcash');
    act(() => root.render(<PosRoutes />));

    method('cash');
    key('9999999');

    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('SPAN');
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(1);
    expect(balance()).toBe('0');
    expect(host.querySelector('.settlement-change')).toBeNull();
  });

  it('AC-7: the caption tells the two pads apart and follows the method', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));

    expect(host.querySelector('.tender-help')!.textContent).toContain('Cash may be more than this');

    method('card');
    expect(host.querySelector('.tender-help')!.textContent).toContain('most card can take');

    method('cash');
    expect(host.querySelector('.tender-help')!.textContent).toContain('Cash may be more than this');
  });

  it('AC-8: draws live figures, never the artifact constants', () => {
    enterSettlementWithBurger();

    method('cash');
    key('400000');

    expect(host.querySelector('.tender-help')!.textContent).toContain('315.000 owing');
    expect(host.querySelector('.tender-help')!.textContent).toContain('85.000 change');

    add();

    expect(host.querySelector('.settlement-change__amount')!.textContent).toBe('85.000');
    expect(host.querySelector('.settlement-change__note')!.textContent).toContain('315.000');
    expect(host.querySelector('.settlement-change__note')!.textContent).toContain('400.000');
  });

  it('AC-11: the URL stops naming a fixture after a live mutation', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));

    add();
    expect(window.location.href).toMatch(/\/pos\/settlement$/);

    remount();
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(0);
  });

  it.each([
    ['card', 0, '155.925', '155.925'],
    ['cardsplit', 0, '155.925', '100.000'],
    ['cashover', 0, '155.925', '200.000'],
    ['change', 1, '0', '0'],
    ['cardover', 0, '155.925', '200.000'],
    ['ceiling', 1, '55.925', '99.999.999'],
    ['exactcash', 1, '0', '0'],
    ['exactsplit', 2, '0', '0'],
  ] as const)('%s draws its row of the F3b table', (state, draftCount, balanceValue, amountValue) => {
    window.history.replaceState(null, '', `/pos/settlement?state=${state}`);
    act(() => root.render(<PosRoutes />));

    expect(host.querySelectorAll('.draft-tender')).toHaveLength(draftCount);
    expect(balance()).toBe(balanceValue);
    expect(amount()).toBe(amountValue);
  });
});
