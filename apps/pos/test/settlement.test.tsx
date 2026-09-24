// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeRefusal } from '../src/close.js';
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

  // F3d changed this test: `settle-takeover` no longer draws a bare fixture
  // shell — rule 10 gives it the takeover modal for real — so the dialog it
  // used to assert absent is now the whole point of visiting that route
  // (test/settlement.test.tsx, describe('F3d: ...') AC-11 pins the modal's
  // own content). `settle-pending` is unchanged: it draws no modal of its
  // own, only the live session's drafts.
  it.each([
    ['lock-draft', 'Back to payment', 'settle-pending', false],
    ['lock-lease', 'Manager: take over payment', 'settle-takeover', true],
  ] as const)('%s routes its placeholder action to POS-04', (state, label, settlementState, drawsDialog) => {
    window.history.replaceState(null, '', `/pos/order?state=${state}`);
    act(() => root.render(<PosRoutes />));

    press([...host.querySelectorAll('a')].find((anchor) => anchor.textContent === label)!);

    expect(window.location.pathname).toBe('/pos/settlement');
    expect(window.location.search).toBe(`?state=${settlementState}`);
    expect(host.querySelector('.settlement-screen')).not.toBeNull();
    expect(host.querySelector('[role="dialog"]') !== null).toBe(drawsDialog);
  });

  // F3a regression (cda4d4e), fixed in F3c: lifting the store to PosRoutes
  // left a same-screen mutation — a pending row's × — unable to reach it,
  // because only a `leaves` navigate told the parent to re-read the URL. Pins
  // both ends: the panel itself (so the defect is caught even if a future
  // change makes POS-04 stop trusting the panel), and what POS-04 reads after
  // it. Red case: with `onLocationChange?.()` moved back under `if (leaves)`,
  // this fails on the panel's own line list and total — not only on
  // settlement's figure — which is what proves the panel, not just the
  // store's internal effect, was the thing not re-rendering.
  it('a pending row removed on POS-03 stays removed on the panel and carries through to POS-04', () => {
    window.history.replaceState(null, '', '/pos/order');
    act(() => root.render(<PosRoutes />));

    press(host.querySelector('[aria-label="Remove Steak"]')!);

    expect([...host.querySelectorAll('.order-line__name')].map((line) => line.firstChild!.textContent)).toEqual([
      'Burger',
      'Soda',
    ]);
    expect(host.querySelector('.totals__row--grand dd')!.textContent).toBe('155.925');

    press(host.querySelector('[data-action="settle"]')!);

    expect(host.querySelector('.settlement-totals .totals__row--grand dd')!.textContent).toBe('155.925');
  });

  // F3 review finding 1, red case: today's `OrderScreen` kept `view` in its
  // own `useState(initial)` and disabled its own `popstate` listener whenever
  // `PosRoutes` supplied `onLocationChange`, so browser Back between two
  // `/pos/order` URLs left the mounted panel stale — unlocked, with a live
  // Settle, at a URL that a direct visit draws locked. FE-019 removes that
  // second `view` owner: `PosRoutes` alone reads the URL, on every render and
  // on every `popstate`, and hands the controlled order screen whatever it
  // reads.
  it("AC-1/2 (finding 1): browser Back to a lease-locked URL below the mounted one re-reads the lock, and Forward reverses it", async () => {
    window.history.pushState(null, '', '/pos/order?state=lock-lease');
    window.history.pushState(null, '', '/pos/order?state=default');
    act(() => root.render(<PosRoutes />));

    async function forward() {
      const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
      act(() => window.history.forward());
      await act(async () => popped);
    }

    await back();

    expect(window.location.search).toBe('?state=lock-lease');
    expect(host.querySelector('.menu-notice .notice__title')!.textContent).toBe(
      'Another client is settling this order'
    );
    expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBe('lease');
    expect(host.querySelector('[data-action="settle"]')!.tagName).toBe('SPAN');

    // AC-2: Forward from the locked state above returns to a live, unlocked
    // `default` — checked before the takeover click below, which pushes a new
    // entry and would truncate this one out of the forward stack.
    await forward();
    expect(window.location.search).toBe('?state=default');
    expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBeNull();
    expect(host.querySelector('[data-action="settle"]')!.tagName).toBe('BUTTON');
    expect(host.querySelector('[aria-label="Remove Steak"]')).not.toBeNull();

    // Back to the lease lock, then press its one available control (AC-1's
    // last step: it must land on the takeover modal).
    await back();
    press([...host.querySelectorAll('a')].find((a) => a.textContent === 'Manager: take over payment')!);
    expect(window.location.pathname).toBe('/pos/settlement');
    expect(window.location.search).toBe('?state=settle-takeover');
    expect(host.querySelector('.modal__title')!.textContent).toBe('Take over this payment');
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
    // FE-020 changed this: FE-016 drew no notice or caption here because no copy
    // existed. It does now, and it names the single-tender cap, never the change limit.
    expect(host.querySelector('.notice__title')!.textContent).toBe('Cash exceeds the single-tender limit');
    expect(host.querySelector('.tender-help')!.textContent).toContain('key 99.999.999 or less.');
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

describe('F3c: close outcomes (POS-04)', () => {
  const key = (digits: string) => [...digits].forEach((d) => press(host.querySelector(`[data-digit="${d}"]`)!));
  const balance = () => host.querySelector('.settlement-balance__amount')!.textContent;
  const amount = () => host.querySelector('.tender-amount')!.textContent;
  const add = () => press(host.querySelector('[data-action="add-tender"]')!);
  const method = (name: 'cash' | 'card') => press(host.querySelector(`[data-method="${name}"]`)!);
  const close = () => host.querySelector<HTMLElement>('[data-action="close-order"]')!;
  const totalsRow = () => [...host.querySelectorAll('.settlement-totals dd')].map((dd) => dd.textContent);

  it('AC-1: the live walk refuses the close on a table order with a pending line, naming it', () => {
    window.history.replaceState(null, '', '/pos/order');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[data-action="settle"]')!);

    add();

    expect(balance()).toBe('0');
    const button = close();
    expect(button.tagName).toBe('SPAN');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent).toBe('Close order & print receipt');
    expect(button.getAttribute('aria-describedby')).toBe('close-pending-notice');
    const notice = host.querySelector('.notice')!;
    expect(notice.id).toBe('close-pending-notice');
    expect(notice.textContent).toContain('Steak');
  });

  it('AC-2: a quick sale still closes, even though every line on it is PENDING', () => {
    enterSettlementWithBurger();

    add();

    expect(balance()).toBe('0');
    expect(close().tagName).toBe('BUTTON');
  });

  it('AC-3 (close.ts): classifies by the order type, never the state name', () => {
    const pendingLine = { id: 'l1', quantity: 1, name: 'X', amount: 1_000n, status: 'pending' as const };
    const tableOrder = { type: 'table' as const, groups: [{ kind: 'pending' as const, lines: [pendingLine] }] };
    const quickOrder = { type: 'quick_sale' as const, groups: [{ kind: 'pending' as const, lines: [pendingLine] }] };

    expect(closeRefusal(tableOrder, { balance: 0n })).toEqual({ reason: 'pending', lines: [pendingLine] });
    expect(closeRefusal(quickOrder, { balance: 0n })).toBeUndefined();
  });

  it('AC-4: pending blocks only the close — Add stays live, the field reads the live total, and a part tender works', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=pending');
    act(() => root.render(<PosRoutes />));

    expect(amount()).toBe('382.725');
    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('BUTTON');

    method('card');
    key('100000');
    add();

    expect(host.querySelectorAll('.draft-tender')).toHaveLength(1);
    expect(balance()).toBe('282.725');
    expect(close().tagName).toBe('SPAN');
  });

  it('AC-5: removing the pending line from POS-03 un-blocks the close', () => {
    window.history.replaceState(null, '', '/pos/order');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[aria-label="Remove Steak"]')!);
    press(host.querySelector('[data-action="settle"]')!);

    expect(host.querySelector('.totals__row--grand dd')!.textContent).toBe('155.925');

    add();

    expect(balance()).toBe('0');
    expect(close().tagName).toBe('BUTTON');
  });

  it('AC-6a: removing the pending line from a zero-total order leaves the zero composition with Close live', () => {
    window.history.replaceState(null, '', '/pos/order?state=zero');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[aria-label="Remove Steak"]')!);
    press(host.querySelector('[data-action="settle"]')!);

    expect(balance()).toBe('0');
    expect(host.querySelectorAll('.notice')).toHaveLength(1);
    expect(host.querySelector('.notice__title')!.textContent).toBe('Nothing to collect');
    expect(host.querySelector('.tender-empty__title')!.textContent).toBe('No payment to take');
    expect(close().tagName).toBe('BUTTON');
  });

  it('AC-6b (rule 5): a zero-total table order that still carries the pending line keeps Close inert', () => {
    window.history.replaceState(null, '', '/pos/order?state=zero');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[data-action="settle"]')!);

    expect(balance()).toBe('0');
    const notices = [...host.querySelectorAll('.notice')];
    expect(notices).toHaveLength(2);
    expect(notices[0]!.textContent).toContain('Nothing to collect');
    expect(notices[1]!.textContent).toContain('Steak');
    expect(close().tagName).toBe('SPAN');
    expect(close().textContent).toBe('Close order & print receipt');
  });

  it('AC-7: the zero composition draws no field, no keypad and no Add, and no header NOTHING RECORDED YET tag', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=zero');
    act(() => root.render(<PosRoutes />));

    expect(host.querySelector('.tender-amount')).toBeNull();
    expect(host.querySelector('.tender-keypad')).toBeNull();
    expect(host.querySelector('[data-action="add-tender"]')).toBeNull();
    expect(host.querySelector('.drafts-heading')).toBeNull();
    expect(host.querySelector('.settlement-bar .settlement-tag')).toBeNull();
    expect(close().tagName).toBe('BUTTON');
  });

  it('AC-8: error derives 37.800 from the live order, survives a partial correction, and never returns once answered', () => {
    // F3 review finding 3, red case: `showErrorNotice` used to read
    // `state === 'error'`, and `addDraft` rewrites the URL to bare
    // `/pos/settlement` on every Add — so the *first* partial Add cleared the
    // notice while 27.800 was still owing. FE-019 moves the fact into the
    // payment session (`session.rejected`), cleared only once the balance
    // itself reaches zero.
    window.history.replaceState(null, '', '/pos/settlement?state=error');
    act(() => root.render(<PosRoutes />));

    expect(totalsRow()).toEqual(['205.000', '−20.500', '9.225', '193.725', '16.773']);
    expect(balance()).toBe('37.800');
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(1);
    expect(host.querySelector('.draft-tender__amount')!.textContent).toBe('155.925');
    expect(amount()).toBe('37.800');
    expect(host.querySelector('[data-action="add-tender"]')!.tagName).toBe('BUTTON');
    expect(close().tagName).toBe('SPAN');
    expect(host.querySelector('.notice__title')!.textContent).toBe('Close was rejected');

    // A partial correction: Card 10.000, 27.800 still owed. The notice must
    // survive this — criterion 7's red case.
    method('card');
    key('10000');
    add();

    expect(balance()).toBe('27.800');
    expect(host.querySelector('.notice__title')!.textContent).toBe('Close was rejected');
    expect(host.querySelector('.notice')!.textContent).toContain('27.800');
    expect(close().tagName).toBe('SPAN');

    // The remaining 27.800: the notice goes and Close goes live.
    add();

    expect(balance()).toBe('0');
    expect(host.querySelector('.notice')).toBeNull();
    expect(close().tagName).toBe('BUTTON');

    // Criterion 8: removing a draft reopens the balance, but the rejection
    // was answered once — it must not come back.
    press(host.querySelector('.draft-tender__remove')!);

    expect(Number(balance().replace(/\./g, ''))).toBeGreaterThan(0);
    expect(host.querySelector('.notice')).toBeNull();
  });

  it('AC-9: loading cannot be reached by pressing Close', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=exact');
    act(() => root.render(<PosRoutes />));
    const before = host.innerHTML;

    press(close());

    expect(host.innerHTML).toBe(before);
    expect(window.location.pathname).toBe('/pos/settlement');
    expect(host.querySelector('.menu-loading__label')).toBeNull();
  });

  it('AC-9b: a direct visit to loading draws the fixture composition', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=loading');
    act(() => root.render(<PosRoutes />));

    expect(host.querySelector('.menu-loading__label')!.textContent).toBe('CLOSING ORDER');
    expect(host.querySelectorAll('.skel-bar')).toHaveLength(2);
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(1);
    expect(balance()).toBe('0');
    expect(close().tagName).toBe('SPAN');
    expect(close().textContent).toBe('Closing…');
  });

  it('AC-10: the refusal rule lives in close.ts — a rule that refuses everything needs no component change', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=exact');
    const store: OrderStore = {
      order: shownOrder({ state: 'default', gone: 'steak' }),
      addLine: () => {},
      removeLine: () => {},
      setQuantity: () => {},
    };
    act(() => root.render(<SettlementScreen store={store} closeRule={() => ({ reason: 'balance' })} />));

    expect(close().tagName).toBe('SPAN');
    expect(close().textContent).toBe('Close order — balance outstanding');
  });

  it('AC-11: two PENDING lines are both named, in the plural', () => {
    const lines = [
      { id: 'a', quantity: 1, name: 'Steak', amount: 1_000n, status: 'pending' as const },
      { id: 'b', quantity: 1, name: 'Fries', amount: 1_000n, status: 'pending' as const },
    ];
    const store: OrderStore = {
      order: {
        title: 'Order · T1',
        type: 'table',
        groups: [{ kind: 'pending', lines }],
        totals: { subtotal: 2_000n, total: 2_000n },
      },
      addLine: () => {},
      removeLine: () => {},
      setQuantity: () => {},
    };
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<SettlementScreen store={store} />));

    const notice = host.querySelector('.notice')!;
    expect(notice.querySelector('.notice__title')!.textContent).toBe(
      'Cannot close — 2 items have not been sent to the kitchen'
    );
    expect(notice.textContent).toContain('Steak');
    expect(notice.textContent).toContain('Fries');
    expect(notice.textContent).toContain('Steak and Fries');
  });
});

describe('F3d: the payment session', () => {
  const key = (digits: string) => [...digits].forEach((d) => press(host.querySelector(`[data-digit="${d}"]`)!));
  const method = (name: 'cash' | 'card') => press(host.querySelector(`[data-method="${name}"]`)!);
  const add = () => press(host.querySelector('[data-action="add-tender"]')!);
  const balance = () => host.querySelector('.settlement-balance__amount')!.textContent;
  const amount = () => host.querySelector('.tender-amount')!.textContent;
  const anchorNamed = (name: string) => [...host.querySelectorAll('a')].find((a) => a.textContent === name)!;
  const buttonInDialog = (name: string) => [...host.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === name)!;
  const lockTitle = () => host.querySelector('.menu-notice .notice__title')?.textContent;
  const dataLock = () => host.querySelector('.order-panel')!.getAttribute('data-lock');
  const openCancel = () => press(host.querySelector('.settlement-cancel button')!);
  const keepCollecting = () => press(host.querySelector('[role="dialog"] .action:not(.action--primary)')!);
  const confirmCancel = () => press(host.querySelector('[role="dialog"] .action--primary')!);

  /** `← Order` and `Leave payment` both call `window.history.back()`, which pops asynchronously (as `back()` above awaits). */
  async function pressBack(button: Element) {
    const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
    press(button);
    await act(async () => popped);
  }

  it('AC-1: drafts survive the trip to POS-03 and back', async () => {
    enterSettlementWithBurger(); // Settle at 315.000 (quick sale + Burger)
    method('card');
    key('100000');
    add();
    expect(balance()).toBe('215.000');

    await pressBack(host.querySelector('.settlement-back')!);

    expect(window.location.pathname).toBe('/pos/order');
    expect(dataLock()).toBe('draft');
    expect(lockTitle()).toBe('Finish this payment first');
    expect(host.querySelectorAll('.order-actions a, .order-actions button')).toHaveLength(0);
    expect(host.querySelector('[data-action="settle"]')!.tagName).toBe('SPAN');

    press(anchorNamed('Back to payment'));

    expect(window.location.pathname).toBe('/pos/settlement');
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(1);
    expect(host.querySelector('.draft-tender__amount')!.textContent).toBe('100.000');
    expect(balance()).toBe('215.000');
    expect(amount()).toBe('215.000');
  });

  it('AC-2: the lock is derived, not addressed — a plain ?state=default is locked once a session is active', () => {
    enterSettlementWithBurger();
    window.history.replaceState(null, '', '/pos/order?state=default');
    act(() => root.render(<PosRoutes />));

    expect(dataLock()).toBe('draft');
    expect(lockTitle()).toBe('Finish this payment first');
  });

  it("AC-3: the own-tab words are never the lease's", async () => {
    enterSettlementWithBurger();
    await pressBack(host.querySelector('.settlement-back')!);

    expect(host.textContent).not.toContain('Another client');
  });

  it('AC-4: the guard holds against ?gone= under the derived lock', () => {
    window.history.replaceState(null, '', '/pos/order');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[data-action="settle"]')!);

    window.history.replaceState(null, '', '/pos/order?state=default&gone=steak');
    act(() => root.render(<PosRoutes />));

    expect(host.textContent).toContain('Steak');
    expect(dataLock()).toBe('draft');
  });

  it('AC-5: Cancel releases the order, ungated, with no approval prompt', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    act(() => root.render(<PosRoutes />));
    method('card');
    key('100000');
    add();
    method('cash');
    key('55925');
    add();
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(2);

    openCancel();
    expect(host.querySelector('[role="dialog"]')!.textContent).toContain('2 drafted payment lines will be discarded.');
    keepCollecting();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(2);

    openCancel();
    expect(host.querySelector('[data-action="take-over"]')).toBeNull();
    confirmCancel();

    expect(window.location.pathname).toBe('/pos/order');
    expect(dataLock()).toBeNull();
    expect(host.querySelector('[data-action="settle"]')!.tagName).toBe('BUTTON');
    press(host.querySelector('[data-action="settle"]')!);
    expect(host.querySelector('.drafts-empty')!.textContent).toBe('Nothing drafted yet');
    expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });

  it('AC-6: the count sentence follows the drafts, and zero omits it', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=exact');
    act(() => root.render(<PosRoutes />));
    openCancel();
    expect(host.querySelector('[role="dialog"]')!.textContent).toContain('One drafted payment line will be discarded.');
    keepCollecting();

    press(host.querySelector('.draft-tender__remove')!);
    openCancel();
    expect(host.querySelector('[role="dialog"]')!.textContent).not.toContain('drafted payment line');
  });

  it('AC-7: history cannot resurrect the payment after Cancel', async () => {
    window.history.replaceState(null, '', '/pos/order');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[data-action="settle"]')!);
    add(); // whole balance in one cash tender
    openCancel();
    confirmCancel();
    expect(window.location.pathname).toBe('/pos/order');

    await back();

    expect(window.location.pathname).toBe('/pos/order');
    expect(dataLock()).toBeNull();
    expect(host.querySelector('.draft-tender')).toBeNull();
  });

  it('AC-8: F3c pending path, walkable end to end under the lock', async () => {
    window.history.replaceState(null, '', '/pos/order');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[data-action="settle"]')!);
    expect(host.querySelector('.notice__title')!.textContent).toContain('has not been sent to the kitchen');

    await pressBack(host.querySelector('.settlement-back')!);
    expect(dataLock()).toBe('draft');
    expect(host.querySelector('[aria-label="Remove Steak"]')).toBeNull();

    press(anchorNamed('Back to payment'));
    openCancel();
    confirmCancel();

    expect(dataLock()).toBeNull();
    press(host.querySelector('[aria-label="Remove Steak"]')!);
    press(host.querySelector('[data-action="settle"]')!);
    expect(balance()).toBe('155.925');
    add();
    expect(balance()).toBe('0');
    expect(host.querySelector('[data-action="close-order"]')!.tagName).toBe('BUTTON');
  });

  it('AC-9: reauth keeps the draft alive through Leave payment and Back to payment', async () => {
    // Rule 8: reauth is reached by a direct visit, never a live control — a
    // fresh page load with its own history entry already under it (the
    // order screen the cashier idled out on), never a same-session
    // pushState from a still-mounted PosRoutes. `history.back()` needs that
    // real prior entry to land on.
    window.history.pushState(null, '', '/pos/order');
    window.history.pushState(null, '', '/pos/settlement?state=reauth');
    act(() => root.render(<PosRoutes />));

    expect(host.querySelector('.settlement-actor .settlement-tag')!.textContent).toBe('SIGNED OUT');
    expect(host.querySelector('.modal__title')!.textContent).toBe('Sign in to finish this payment');
    expect(host.querySelector('.settlement-close__action')!.textContent).toBe('Sign in to close');
    expect(host.querySelector('.draft-tender__amount')!.textContent).toBe('155.925');

    // B-12: pressing a digit advances the *count* of filled dots and nothing
    // else — never the digit itself, which appears nowhere in the DOM.
    // FE-019 finding 2's correction: the two seeded dots are drawn, never
    // entered, so the first real digit shows a count of 1, not the seed's 2
    // plus 1 — a seeded pad must still accept six real digits and submit only
    // those (test/pin-pad.test.tsx pins the submitted value).
    expect(host.querySelectorAll('.pin-dot--filled')).toHaveLength(2);
    press(host.querySelector('[role="dialog"] .key')!);
    expect(host.querySelectorAll('.pin-dot--filled')).toHaveLength(1);

    await pressBack(buttonInDialog('Leave payment'));

    expect(window.location.pathname).toBe('/pos/order');
    expect(dataLock()).toBe('draft');

    press(anchorNamed('Back to payment'));
    expect(host.querySelector('.draft-tender__amount')!.textContent).toBe('155.925');
  });

  it('AC-10: leaselost draws the modal, with no Cancel payment and no drafts, and Back to floor goes to the placeholder', () => {
    window.history.replaceState(null, '', '/pos/settlement?state=leaselost');
    act(() => root.render(<PosRoutes />));

    expect(host.querySelector('.modal__title')!.textContent).toBe('A manager took over this payment');
    expect(host.querySelector('.settlement-cancel')).toBeNull();
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(0);

    press(buttonInDialog('Back to floor'));

    // FE-019 finding 4 (P3): the invented sentence is gone — the placeholder
    // route renders the bare device frame and no copy at all.
    expect(window.location.pathname).toBe('/pos/floor');
    expect(host.textContent).toBe('');
  });

  it('AC-11: takeover, reached for real, draws MANAGER REQUIRED with no Cancel payment and an inert confirm', () => {
    window.history.replaceState(null, '', '/pos/order?state=lock-lease');
    act(() => root.render(<PosRoutes />));

    press(anchorNamed('Manager: take over payment'));

    expect(window.location.search).toBe('?state=settle-takeover');
    expect(host.querySelector('.modal__title')!.textContent).toBe('Take over this payment');
    expect(host.querySelector('.modal .settlement-tag')!.textContent).toBe('MANAGER REQUIRED');
    expect(host.querySelector('.settlement-cancel')).toBeNull();
    // FE-020 changed this: the inert *I understand — take over* span is gone.
    // Step one is the acknowledgement (see the FE-020 takeover test); Cancel still leaves.
    expect(host.querySelector('[data-action="take-over"]')).toBeNull();
    expect(buttonInDialog('I understand').tagName).toBe('BUTTON');

    press(buttonInDialog('Cancel'));

    expect(window.location.pathname).toBe('/pos/order');
    expect(window.location.search).toBe('?state=lock-lease');
    expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBe('lease');
  });

  it('AC-12: one session path — breaking the shared hook fails both a direct SettlementScreen test and a PosRoutes test', () => {
    // This test documents the proof rather than re-running it live: the hook
    // both paths share is `paymentSession.ts`'s `usePaymentSession`. Breaking
    // its `addDraft` (e.g. making it a no-op) was proven by hand to fail both
    // "two successive below-balance tenders..." (a PosRoutes-rendered test
    // above) and any direct `<SettlementScreen store={...} />` add-a-draft
    // assertion (e.g. "delegates Add availability to the tender rule"'s
    // sibling paths) — see the handoff for the exact mutation and both
    // failures. What this test pins going forward is the *architecture* that
    // makes that true: a direct SettlementScreen mount uses the same
    // `usePaymentSession` hook PosRoutes uses, not a second bespoke default.
    window.history.replaceState(null, '', '/pos/settlement?state=empty');
    const store: OrderStore = {
      order: shownOrder({ state: 'default', gone: 'steak' }),
      addLine: () => {},
      removeLine: () => {},
      setQuantity: () => {},
    };
    act(() => root.render(<SettlementScreen store={store} />));
    add();
    expect(host.querySelectorAll('.draft-tender')).toHaveLength(1);
  });

  // Lead correction (walked in the browser): a `?gone=` refused under the
  // lock must not be consumed — it has to still apply once the cashier
  // genuinely re-asks for it after the lock lifts. orderStore.ts used to mark
  // `appliedGone.current` before the lock check, so the refused attempt below
  // silently satisfied the later, real one.
  it('a ?gone= refused under the lock still removes the line once asked for again after Cancel', async () => {
    window.history.replaceState(null, '', '/pos/order');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('[data-action="settle"]')!);
    method('card');
    key('100000');
    add();

    await pressBack(host.querySelector('.settlement-back')!); // locked

    window.history.pushState(null, '', '/pos/order?state=default&gone=steak');
    act(() => root.render(<PosRoutes />));
    expect(host.textContent).toContain('Steak'); // refused: still locked, still there

    await back(); // back to the locked order screen, pre-mutation
    press(anchorNamed('Back to payment'));
    openCancel();
    confirmCancel();

    press(host.querySelector('[aria-label="Remove Steak"]')!);
    press(host.querySelector('[data-action="settle"]')!);

    expect(host.querySelector('.settlement-totals .totals__row--grand dd')!.textContent).toBe('155.925');
  });
});

describe('FE-020: DESIGN-006 corrections to POS-04', () => {
  const key = (digits: string) => [...digits].forEach((d) => press(host.querySelector(`[data-digit="${d}"]`)!));
  const method = (name: 'cash' | 'card') => press(host.querySelector(`[data-method="${name}"]`)!);
  const add = () => press(host.querySelector('[data-action="add-tender"]')!);
  const visit = (search: string) => {
    window.history.replaceState(null, '', `/pos/settlement${search}`);
    act(() => root.render(<PosRoutes />));
  };
  const buttonInDialog = (name: string) => [...host.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === name);
  const openCancelFromNotice = () => press(host.querySelector('[data-action="cancel-payment-from-notice"]')!);

  describe('the refusal composition: keypad beside the notice', () => {
    it.each(['cardover', 'ceiling', 'ceiling-single'])('%s: notice and caption sit in a column beside the keypad, below the amount', (state) => {
      visit(`?state=${state}`);

      const refusal = host.querySelector('.tender-refusal')!;
      const keypad = refusal.querySelector(':scope > .tender-keypad')!;
      const guidance = refusal.querySelector(':scope > .tender-guidance')!;
      expect(keypad.querySelector('[aria-label="Delete last digit"]')).not.toBeNull();
      expect(guidance.querySelector('.notice')).not.toBeNull();
      expect(guidance.querySelector('.tender-help')).not.toBeNull();
      // Nothing above the amount: the notice no longer precedes the control that pushes the keypad down.
      expect(host.querySelector('.tender-entry__body > .notice')).toBeNull();
      const body = host.querySelector('.tender-entry__body')!;
      expect(body.firstElementChild!.classList.contains('tender-control')).toBe(true);
      expect(host.querySelector('.tender-control')!.compareDocumentPosition(refusal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('every other state keeps its composition: no refusal wrapper, caption above the keypad', () => {
      visit('?state=cardsplit');

      expect(host.querySelector('.tender-refusal')).toBeNull();
      const body = host.querySelector('.tender-entry__body')!;
      expect([...body.children].map((c) => c.className)).toEqual(['tender-control', 'tender-help', 'tender-keypad']);
    });
  });

  describe('the single-tender cap gets its notice and caption', () => {
    it('ceiling-single seeds from orderTotals: 94.500.000 owing on a 100.000.000 subtotal', () => {
      visit('?state=ceiling-single');

      expect([...host.querySelectorAll('.settlement-totals dd')].map((dd) => dd.textContent)).toEqual([
        '100.000.000',
        '−10.000.000',
        '4.500.000',
        '94.500.000',
        '8.181.818',
      ]);
      expect(host.querySelector('.settlement-balance__amount')!.textContent).toBe('94.500.000');
    });

    it('draws the artifact copy with live figures, and none of the change-limit copy', () => {
      visit('?state=ceiling-single');

      expect(host.querySelector('.notice__title')!.textContent).toBe('Cash exceeds the single-tender limit');
      expect(host.querySelector('.notice')!.textContent).toContain(
        'You entered 100.000.000. One payment line can hold at most 99.999.999, even when the change would be within 9.999.999. Nothing has been recorded; the draft is unchanged.'
      );
      expect(host.querySelector('.tender-help')!.textContent).toBe(
        'The 94.500.000 balance plus the 9.999.999 change limit is 104.499.999. The lower, single-tender cap applies: key 99.999.999 or less.'
      );
      expect(host.querySelector('.tender-field__message')!.textContent).toBe('Cash maximum 99.999.999');
      expect(host.textContent).not.toContain('Too much cash to give change for');
      expect(host.textContent).not.toContain('can accept');
    });

    it('follows the binding limit: the change limit binding draws its own copy, not the single-tender one', () => {
      visit('?state=ceiling');

      expect(host.querySelector('.notice__title')!.textContent).toBe('Too much cash to give change for');
      expect(host.textContent).not.toContain('single-tender');
    });

    it('a keyed 0 against the single-tender cap is not "over" it', () => {
      visit('?state=ceiling-single');
      for (let i = 0; i < 9; i++) press(host.querySelector('[aria-label="Delete last digit"]')!);

      expect(host.querySelector('.tender-amount')!.textContent).toBe('0');
      expect(host.textContent).not.toContain('single-tender');
    });
  });

  describe('the pending notice routes through Cancel', () => {
    const noticeText = () => host.querySelector('#close-pending-notice')!.textContent!;

    it('names Cancel payment, drops Back to the order, and omits the discard sentence with no drafts', () => {
      window.history.replaceState(null, '', '/pos/order');
      act(() => root.render(<PosRoutes />));
      press(host.querySelector('[data-action="settle"]')!);

      expect(noticeText()).toContain('Steak is still pending. Cancel payment before sending or voiding it; payment in progress blocks both.');
      expect(noticeText()).not.toContain('Cancelling discards');
      expect(noticeText()).not.toContain('Back to the order');
      expect(host.querySelector('[data-action="cancel-payment-from-notice"]')!.textContent).toBe('Cancel payment to edit the order');
    });

    it('one draft: names it; two or more: counts them', () => {
      visit('?state=pending');
      add();
      expect(noticeText()).toContain('Cancelling discards the Cash 382.725 draft.');

      press(host.querySelector('.draft-tender__remove')!);
      method('card');
      key('100000');
      add();
      method('cash');
      add();
      expect(host.querySelectorAll('.draft-tender')).toHaveLength(2);
      expect(noticeText()).toContain('Cancelling discards 2 drafted payment lines.');
    });

    it('walks: Settle, Cancel payment to edit the order, confirm, Remove Steak, Settle, 155.925', () => {
      window.history.replaceState(null, '', '/pos/order');
      act(() => root.render(<PosRoutes />));
      press(host.querySelector('[data-action="settle"]')!);

      openCancelFromNotice();
      expect(host.querySelector('[role="dialog"]')!.querySelector('#cancel-payment-title')!.textContent).toBe('Cancel this payment?');
      press(buttonInDialog('Cancel payment')!);

      expect(window.location.pathname).toBe('/pos/order');
      expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBeNull();
      press(host.querySelector('[aria-label="Remove Steak"]')!);
      press(host.querySelector('[data-action="settle"]')!);
      expect(host.querySelector('.settlement-totals .totals__row--grand dd')!.textContent).toBe('155.925');
    });
  });

  describe('the cancel modal lists what it will discard', () => {
    const dialog = () => host.querySelector('[role="dialog"]')!;
    const rows = () => [...dialog().querySelectorAll('.cancel-drafts__row')].map((row) => row.textContent);

    it('two drafts: two read-only rows, no Remove control, and the count sentence', () => {
      visit('?state=exactsplit');
      press(host.querySelector('.settlement-cancel button')!);

      expect(rows()).toEqual(['Card100.000', 'Cash55.925']);
      expect(dialog().querySelector('.draft-tender__remove')).toBeNull();
      expect(dialog().querySelector('.cancel-drafts button')).toBeNull();
      expect(dialog().textContent).toContain('2 drafted payment lines will be discarded.');
    });

    it('a Change given row is shown and not counted', () => {
      visit('?state=change');
      press(host.querySelector('.settlement-cancel button')!);

      expect(rows()).toEqual(['Cash200.000', 'Change given−44.075']);
      expect(dialog().textContent).toContain('One drafted payment line will be discarded.');
    });

    it('no drafts: no list at all', () => {
      visit('?state=empty');
      press(host.querySelector('.settlement-cancel button')!);

      expect(dialog().querySelector('.cancel-drafts')).toBeNull();
    });
  });

  describe('the takeover is two steps', () => {
    const visitTakeover = () => {
      window.history.replaceState(null, '', '/pos/order?state=lock-lease');
      act(() => root.render(<PosRoutes />));
      press([...host.querySelectorAll('a')].find((a) => a.textContent === 'Manager: take over payment')!);
    };
    const pinControls = () => host.querySelectorAll('.modal .keypad button');

    it('step one draws the acknowledgement and no PIN pad; I understand draws all 12 controls and the caption', () => {
      visitTakeover();

      expect(host.querySelector('.modal')!.textContent).toContain('Acknowledge this risk before entering your PIN.');
      expect(pinControls()).toHaveLength(0);
      expect(host.querySelector('.pin-dots')).toBeNull();

      press(buttonInDialog('I understand')!);

      expect(pinControls()).toHaveLength(12);
      expect(host.querySelector('.keypad--approval')).not.toBeNull();
      expect(host.querySelector('.modal__foot')!.textContent).toContain(
        'Risk acknowledged. Continue submits the manager PIN for this takeover only.'
      );
      expect(buttonInDialog('I understand')).toBeUndefined();
      expect(buttonInDialog('Cancel')).toBeDefined();
    });

    // Lead correction: step two measured 758px tall and its Cancel fell below the
    // 800px device, because the modal centred on the viewport rather than the frame.
    // JSDOM has no layout, so this pins the structure that decides it, not pixels.
    it('the modal sits inside the device frame and takes the artifact\'s compact spacing', () => {
      visitTakeover();
      press(buttonInDialog('I understand')!);

      const modal = host.querySelector('.modal')!;
      expect(modal.closest('.pos-device')).not.toBeNull();
      expect(modal.classList.contains('takeover-modal')).toBe(true);
      expect(host.querySelector('.modal-scrim')!.closest('.pos-device')).not.toBeNull();
      expect(css).toMatch(/\.takeover-modal \.notice\s*\{\s*margin-bottom: var\(--frost-space-3\)/);
      expect(css).toMatch(/\.takeover-modal \.pin-dots\s*\{\s*margin: var\(--frost-space-3\) 0/);
    });

    it('remounting starts at step one again', () => {
      visitTakeover();
      press(buttonInDialog('I understand')!);
      expect(pinControls()).toHaveLength(12);

      remount();

      expect(pinControls()).toHaveLength(0);
      expect(buttonInDialog('I understand')).toBeDefined();
    });
  });

  it('the chips stay live: no "Not drawn" text anywhere in apps/', () => {
    const roots = ['../src', '../../server/src'].map((r) => resolve(dirname(fileURLToPath(import.meta.url)), r));
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? (e.name === 'node_modules' ? [] : files(resolve(dir, e.name))) : [resolve(dir, e.name)]
      );
    const hits = roots.flatMap(files).filter((f) => readFileSync(f, 'utf8').includes('Not drawn'));
    expect(hits).toEqual([]);
  });
});
