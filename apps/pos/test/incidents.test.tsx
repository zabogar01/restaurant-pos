// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INCIDENT_FIXTURES, INCIDENT_STATES, incidentStateFrom } from '../src/incidentFixtures.js';
import { IncidentsScreen } from '../src/IncidentsScreen.js';
import { ORDER_FIXTURES } from '../src/orderFixtures.js';
import { PosRoutes } from '../src/PosRoutes.js';

// FE-025 / POS-07: print incidents. Every incident here is a fixture — there is
// no live source until the backend (task file, "What exists").

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

function visit(state?: string) {
  window.history.replaceState(null, '', `/pos/incidents${state ? `?state=${state}` : ''}`);
  act(() => root.render(<PosRoutes key={++mount} />));
}

const cards = () => [...host.querySelectorAll<HTMLElement>('[data-incident]')];
const card = (id: string) => host.querySelector<HTMLElement>(`[data-incident="${id}"]`)!;
const reprintButton = (id: string) => card(id).querySelector<HTMLButtonElement>('.incident__reprint')!;
const resultOf = (id: string) => card(id).querySelector<HTMLElement>('.notice')?.textContent ?? null;
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Criterion 1 — seven states as the artifact draws them
// ---------------------------------------------------------------------------

const K1 = 'Kitchen ticket did not print';
const K1_META = 'Table 1 · round 2 · 19:58 · 2 items · status FAILED';
const C1 = 'Cancellation ticket — delivery unknown';
const C1_META = 'Table 1 · Burger · 20:02 · status UNKNOWN';
const K2_META = 'Table 9 · round 1 · 20:04 · 5 items · status FAILED';
const R1 = 'Receipt did not print — Table 1, closed 20:14 · status FAILED';
const R2 = 'Receipt did not print — Counter, closed 20:11 · status UNKNOWN';

type Expected = { id: string; kind: string; contains: string[]; button: string };
const kitchen1: Expected = { id: 'kitchen-t1r2', kind: 'kitchen', contains: [K1, K1_META], button: 'Reprint ticket' };
const cancel1: Expected = {
  id: 'cancel-t1',
  kind: 'cancellation',
  contains: [C1, C1_META, 'This ticket tells the kitchen to stop work already sent.', 'Check the printer before reprinting'],
  button: 'Reprint cancellation',
};
const kitchen9: Expected = { id: 'kitchen-t9r1', kind: 'kitchen', contains: [K1, K2_META], button: 'Reprint ticket' };
const receipt1: Expected = { id: 'receipt-t1', kind: 'receipt', contains: [R1], button: 'Reprint receipt' };
const receipt2: Expected = { id: 'receipt-counter', kind: 'receipt', contains: [R2], button: 'Reprint receipt' };

const TABLE: Array<[string, Expected[]]> = [
  ['default', [kitchen1, receipt1]],
  ['cancel', [cancel1, receipt1]],
  ['reprint', [kitchen1, receipt1]],
  ['overflow', [kitchen1, cancel1, kitchen9, receipt1, receipt2]],
  ['empty', []],
  ['loading', []],
  ['error', []],
  ['reprint-cancel', [cancel1, receipt1]],
  ['reprint-receipt', [kitchen1, receipt1]],
  ['reprint-table9', [kitchen1, kitchen9, receipt1, receipt2]],
  ['reprint-counter', [kitchen1, kitchen9, receipt1, receipt2]],
  ['reprint-printed', [kitchen1, receipt1]],
];

// FE-028: the exact control set of a card. A stray extra control fails.
const controlsOf = (el: Element) =>
  [...el.querySelectorAll('button, input, a, select, textarea')].map((c) =>
    c instanceof HTMLInputElement ? c.type : (c.textContent ?? '').trim(),
  );
const expectedControls = (e: Expected) =>
  e.kind === 'receipt' ? [e.button, 'Dismiss'] : [e.button, 'checkbox', 'Clear incident'];

describe('the twelve fixture states (criterion 1, FE-028 criterion 7)', () => {
  it('names exactly the artifact’s twelve states, in its order', () => {
    expect(INCIDENT_STATES.map((s) => s.id)).toEqual([
      'default',
      'cancel',
      'empty',
      'reprint',
      'overflow',
      'loading',
      'error',
      'reprint-cancel',
      'reprint-receipt',
      'reprint-table9',
      'reprint-counter',
      'reprint-printed',
    ]);
  });

  it.each(TABLE)('%s draws its cards, titles, status words and buttons', (state, expected) => {
    visit(state);
    expect(cards().map((c) => c.dataset.incident)).toEqual(expected.map((e) => e.id));
    for (const e of expected) {
      expect(card(e.id).dataset.kind).toBe(e.kind);
      for (const fragment of e.contains) expect(text(card(e.id))).toContain(fragment);
      expect([...card(e.id).querySelectorAll('.incident__reprint')].map((b) => b.textContent)).toEqual([e.button]);
      expect(controlsOf(card(e.id))).toEqual(expectedControls(e));
    }
    expect(host.querySelectorAll('.incidents .incident__reprint').length).toBe(expected.length);
    // Two buttons a card (Reprint plus Clear or Dismiss), and error's Retry.
    expect(host.querySelectorAll('.incidents button').length).toBe(expected.length * 2 + (state === 'error' ? 1 : 0));
  });

  it('draws the title, and no other copy the artifact lacks, on every state', () => {
    for (const [state] of TABLE) {
      visit(state);
      expect(host.querySelector('h1')!.textContent).toBe('Printing');
      expect(text(host.querySelector('.settlement-bar')!)).toContain('Ana R. · Cashier');
      expect(text(host.querySelector('.settlement-bar')!)).toContain('90s');
    }
  });

  it('empty says nothing is outstanding', () => {
    visit('empty');
    expect(text(host)).toContain('Nothing outstanding');
    expect(text(host)).toContain('No unresolved print incidents.');
    expect(host.querySelector('.incidents__group')).toBeNull();
  });

  it('loading says LOADING and draws two skeleton bars', () => {
    visit('loading');
    expect(text(host)).toContain('LOADING');
    expect(host.querySelectorAll('.skel-bar').length).toBe(2);
  });

  it('error names the failure and offers Retry', () => {
    visit('error');
    expect(text(host)).toContain('Could not read printer state');
    expect(text(host)).toContain('Check the printer directly.');
    expect([...host.querySelectorAll('.notice button')].map((b) => b.textContent)).toEqual(['Retry']);
  });

  it('reprint draws the dispatch-only result, with no time, on Table 1 round 2 and only there', () => {
    visit('reprint');
    expect(resultOf('kitchen-t1r2')).toBe('Reprint sentCheck the kitchen has the paper before clearing this.');
    expect(resultOf('receipt-t1')).toBeNull();
  });

  it('an unknown or missing state resolves to default', () => {
    expect(incidentStateFrom('?state=nothing-of-the-sort')).toBe('default');
    expect(incidentStateFrom('')).toBe('default');
    expect(incidentStateFrom('?state=incidents')).toBe('default');
    for (const { id } of INCIDENT_STATES) expect(incidentStateFrom(`?state=${id}`)).toBe(id);
    visit('nothing-of-the-sort');
    expect(cards().map((c) => c.dataset.incident)).toEqual(['kitchen-t1r2', 'receipt-t1']);
  });
});

// ---------------------------------------------------------------------------
// Criterion 2 — class order is sorted in code, not by fixture position
// ---------------------------------------------------------------------------

describe('two urgency classes, emergency always first (FR-E6, AC-23; criterion 2)', () => {
  it.each(['default', 'cancel', 'reprint', 'overflow'] as const)('%s: emergency group precedes receipts, even with the fixture reversed', (state) => {
    const reversed = [...INCIDENT_FIXTURES[state].incidents].reverse();
    act(() => root.render(<IncidentsScreen key={++mount} state={state} incidents={reversed} />));
    const kinds = cards().map((c) => c.dataset.kind);
    const firstReceipt = kinds.indexOf('receipt');
    expect(firstReceipt).toBeGreaterThan(0);
    expect(kinds.slice(0, firstReceipt).every((k) => k === 'kitchen' || k === 'cancellation')).toBe(true);
    expect(kinds.slice(firstReceipt).every((k) => k === 'receipt')).toBe(true);
    const groups = [...host.querySelectorAll('.incidents__group')];
    expect(groups.map((g) => g.getAttribute('data-class'))).toEqual(['emergency', 'receipt']);
    expect(text(groups[0]!.querySelector('.incidents__heading')!)).toContain('Needs attention now');
    expect(text(groups[0]!.querySelector('.incidents__heading')!)).toContain('Check delivery with the kitchen');
    expect(text(groups[1]!.querySelector('.incidents__heading')!)).toContain('Receipts');
    expect(text(groups[1]!.querySelector('.incidents__heading')!)).toContain('Customer-service issue, not an emergency');
  });

  it('the two classes never share a class name', () => {
    visit('default');
    expect(card('kitchen-t1r2').className).not.toBe(card('receipt-t1').className);
    expect(card('kitchen-t1r2').className).toContain('incident--emergency');
    expect(card('receipt-t1').className).toContain('incident--receipt');
  });
});

// ---------------------------------------------------------------------------
// Criterion 3, 4 — reprint is per incident, and never claims a print
// ---------------------------------------------------------------------------

describe('a live Reprint press marks that incident only (criterion 3, ruling 6)', () => {
  it('receipt: title only; kitchen: both lines; URL and history untouched; all still listed', () => {
    visit('overflow');
    const url = window.location.href;
    const length = window.history.length;

    press(reprintButton('receipt-counter'));
    expect(resultOf('receipt-counter')).toBe('Reprint sent');
    for (const id of ['kitchen-t1r2', 'cancel-t1', 'kitchen-t9r1', 'receipt-t1']) expect(resultOf(id)).toBeNull();

    press(reprintButton('kitchen-t9r1'));
    expect(resultOf('kitchen-t9r1')).toBe('Reprint sentCheck the kitchen has the paper before clearing this.');
    expect(resultOf('receipt-counter')).toBe('Reprint sent');
    for (const id of ['kitchen-t1r2', 'cancel-t1', 'receipt-t1']) expect(resultOf(id)).toBeNull();

    expect(window.location.href).toBe(url);
    expect(window.history.length).toBe(length);
    expect(cards()).toHaveLength(5);
    // FR-E3: it stays until acted on, and the artifact draws no clear control.
    expect(host.querySelectorAll('.incidents__group .incident__reprint').length).toBe(5);
  });

  it('the fixture reprint state does not leak onto a live press elsewhere', () => {
    visit('reprint');
    press(reprintButton('receipt-t1'));
    expect(resultOf('receipt-t1')).toBe('Reprint sent');
    expect(resultOf('kitchen-t1r2')).not.toContain('printed at');
  });

  it('no live press ever produces “printed at” (criterion 4)', () => {
    for (const state of ['default', 'cancel', 'overflow']) {
      visit(state);
      for (const button of [...host.querySelectorAll<HTMLButtonElement>('.incidents__group .incident__reprint')]) press(button);
      expect(text(host)).not.toMatch(/printed at/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Criterion 5 — B-16
// ---------------------------------------------------------------------------

describe('a cancellation ticket is never a fire (B-16, FR-H4; criterion 5)', () => {
  it('its card and result never say send, kitchen again or order, but for the artifact’s own sentence', () => {
    visit('cancel');
    press(reprintButton('cancel-t1'));
    const own = 'it is a cancellation, never a new order';
    const full = text(card('cancel-t1'));
    expect(full).toContain(own);
    const rest = full.replace(own, '');
    expect(rest).not.toMatch(/\bsend(s|ing)?\b|kitchen again|\border\b|\bfire\b/i);
    expect(reprintButton('cancel-t1').textContent).toBe('Reprint cancellation');
    expect(resultOf('cancel-t1')).toBe('Reprint sentCheck the kitchen has the paper before clearing this.');
  });
});

// ---------------------------------------------------------------------------
// Criterion 6 — client-side navigation
// ---------------------------------------------------------------------------

describe('Open incidents navigates client-side (criterion 6, ruling 2)', () => {
  it('no href on any banner is ?state=incidents any more', () => {
    for (const state of ['fireerror', 'fire-failed', 'fire-unknown'] as const) {
      const banner = ORDER_FIXTURES[state].incident!;
      expect('href' in banner.action && banner.action.href).toBe('/pos/incidents');
    }
  });

  it('a plain click pushes /pos/incidents without a document load, and Back finds the Fries', async () => {
    window.history.replaceState(null, '', '/pos/order?state=fireerror');
    act(() => root.render(<PosRoutes key={++mount} />));
    const count = () => (text(host).match(/Burger/g) ?? []).length;
    const before = count();
    press(host.querySelector('[data-item="burger"]')!);
    press([...host.querySelectorAll('button')].find((b) => b.textContent === 'Add to order')!);
    expect(count()).toBe(before + 1);

    (window as unknown as { __sentinel?: number }).__sentinel = 7;
    const length = window.history.length;
    const anchor = host.querySelector<HTMLAnchorElement>('.emergency-banner__action')!;
    expect(anchor.tagName).toBe('A');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    act(() => {
      anchor.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(window.location.pathname).toBe('/pos/incidents');
    expect(window.history.length).toBe(length + 1);
    expect((window as unknown as { __sentinel?: number }).__sentinel).toBe(7);
    expect(host.querySelector('.incidents')).not.toBeNull();

    const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
    act(() => window.history.back());
    await act(async () => popped);
    expect(window.location.pathname).toBe('/pos/order');
    expect(count()).toBe(before + 1);
  });

  it('a modified click is left to the browser', () => {
    window.history.replaceState(null, '', '/pos/order?state=fireerror');
    act(() => root.render(<PosRoutes key={++mount} />));
    const anchor = host.querySelector<HTMLAnchorElement>('.emergency-banner__action')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    // Read after React's handler has run, then cancel jsdom's own "navigate" so it does not log.
    let preventedByUs: boolean | undefined;
    const observe = (e: Event) => {
      preventedByUs = e.defaultPrevented;
      e.preventDefault();
    };
    document.body.addEventListener('click', observe);
    act(() => {
      anchor.dispatchEvent(event);
    });
    document.body.removeEventListener('click', observe);
    expect(preventedByUs).toBe(false);
    expect(window.location.pathname).toBe('/pos/order');
  });

  it('← Floor is client-side too, and error’s Retry replaces rather than pushes', () => {
    visit('error');
    // A fresh entry at the tip: an earlier test's Back leaves forward entries a push would truncate.
    window.history.pushState(null, '', '/pos/incidents?state=error');
    const length = window.history.length;
    press(host.querySelector('.notice button')!);
    expect(window.location.search).toBe('');
    expect(window.history.length).toBe(length);
    expect(cards().map((c) => c.dataset.incident)).toEqual(['kitchen-t1r2', 'receipt-t1']);

    const back = host.querySelector<HTMLAnchorElement>('a.incidents__back')!;
    expect(back.getAttribute('href')).toBe('/pos/floor');
    press(back);
    expect(window.location.pathname).toBe('/pos/floor');
    expect(window.history.length).toBe(length + 1);
  });
});

// ---------------------------------------------------------------------------
// Criterion 7, 8 — nothing blocks; accessible names
// ---------------------------------------------------------------------------

describe('nothing blocks and every control is nameable (criteria 7, 8)', () => {
  it.each(TABLE.map(([state]) => state))('%s: ← Floor is a live link and nothing is modal or inert', (state) => {
    visit(state);
    const back = host.querySelector<HTMLAnchorElement>('a.incidents__back')!;
    expect(back.textContent).toBe('← Floor');
    expect(back.getAttribute('href')).toBe('/pos/floor');
    expect(back.getAttribute('aria-disabled')).toBeNull();
    expect(host.querySelector('[role="dialog"], [aria-modal], [inert]')).toBeNull();
    expect(host.querySelector('[disabled]')).toBeNull();
  });

  it('overflow: five Reprint buttons, each told apart by what they describe', () => {
    visit('overflow');
    const names = [...host.querySelectorAll<HTMLButtonElement>('.incidents__group .incident__reprint')].map((b) => {
      const ids = (b.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      expect(ids.length).toBeGreaterThan(0);
      const described = ids.map((id) => {
        const target = document.getElementById(id);
        expect(target).not.toBeNull();
        return text(target!);
      });
      return `${b.textContent} | ${described.join(' ')}`;
    });
    expect(new Set(names).size).toBe(5);
    expect(names[0]).toContain(K1_META);
    expect(names[2]).toContain(K2_META);
  });
});

// ---------------------------------------------------------------------------
// FE-028 — recovery: clear a kitchen incident, dismiss a receipt, say only what is known
// ---------------------------------------------------------------------------

const box = (id: string) => card(id).querySelector<HTMLInputElement>('input[type="checkbox"]')!;
const clearButton = (id: string) => card(id).querySelector<HTMLButtonElement>('.incident-recovery button')!;
const dismissButton = (id: string) => card(id).querySelector<HTMLButtonElement>('.incident-dismiss')!;
const ids = () => cards().map((c) => c.dataset.incident);

describe('clearing is per card (FE-028 criterion 1)', () => {
  it('checking Table 9 turns on only Table 9’s Clear, and it removes only Table 9', () => {
    visit('overflow');
    for (const id of ['kitchen-t1r2', 'cancel-t1', 'kitchen-t9r1']) expect(clearButton(id).getAttribute('aria-disabled')).toBe('true');
    press(box('kitchen-t9r1'));
    expect(clearButton('kitchen-t9r1').getAttribute('aria-disabled')).toBe('false');
    expect(clearButton('kitchen-t1r2').getAttribute('aria-disabled')).toBe('true');
    expect(clearButton('cancel-t1').getAttribute('aria-disabled')).toBe('true');
    press(clearButton('kitchen-t1r2'));
    expect(ids()).toHaveLength(5);
    press(clearButton('kitchen-t9r1'));
    expect(ids()).toEqual(['kitchen-t1r2', 'cancel-t1', 'receipt-t1', 'receipt-counter']);
  });

  it('the checkbox label reads as the artifact: ticket, and cancellation for a cancellation', () => {
    visit('overflow');
    expect(text(card('kitchen-t9r1').querySelector('label')!)).toBe('I checked: the kitchen has this ticket.');
    expect(text(card('cancel-t1').querySelector('label')!)).toBe('I checked: the kitchen has this cancellation.');
  });

  it('unchecking turns Clear off again', () => {
    visit('default');
    press(box('kitchen-t1r2'));
    press(box('kitchen-t1r2'));
    expect(clearButton('kitchen-t1r2').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('off Clear follows FE-024’s rule (FE-028 criterion 2)', () => {
  it('is a focusable aria-disabled button, never disabled, described by its own label, and does nothing', () => {
    visit('overflow');
    const btn = clearButton('cancel-t1');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.hasAttribute('disabled')).toBe(false);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('aria-describedby')).toBe('clear-reason-cancel-t1');
    const label = document.getElementById('clear-reason-cancel-t1')!;
    expect(label).toBe(card('cancel-t1').querySelector('label'));
    expect(btn.textContent).toBe('Clear incident');
    btn.focus();
    expect(document.activeElement).toBe(btn);
    press(btn);
    // Enter and Space on a button arrive as a click; a keydown must not clear it either.
    for (const key of ['Enter', ' ']) act(() => void btn.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
    expect(ids()).toHaveLength(5);
    expect(host.querySelector('[disabled]')).toBeNull();
  });
});

describe('reprint never clears (FE-028 criterion 3)', () => {
  it('a reprinted incident is still listed, even with its box checked', () => {
    visit('overflow');
    for (const id of ids()) press(reprintButton(id!));
    expect(ids()).toHaveLength(5);
  });
});

describe('dismissing a receipt (FE-028 criterion 4)', () => {
  it('is live with no check, removes that receipt, and leaves the kitchen cards', () => {
    visit('overflow');
    expect(dismissButton('receipt-t1').getAttribute('aria-disabled')).toBeNull();
    press(dismissButton('receipt-t1'));
    expect(ids()).toEqual(['kitchen-t1r2', 'cancel-t1', 'kitchen-t9r1', 'receipt-counter']);
    press(dismissButton('receipt-counter'));
    expect(ids()).toEqual(['kitchen-t1r2', 'cancel-t1', 'kitchen-t9r1']);
    expect(host.querySelector('[data-class="receipt"]')).toBeNull();
  });

  it('is told apart by what it dismisses', () => {
    visit('overflow');
    expect(dismissButton('receipt-t1').getAttribute('aria-describedby')).toBe('receipt-t1-title');
    expect(dismissButton('receipt-t1').textContent).toBe('Dismiss');
  });
});

describe('clearing everything reaches the empty composition (FE-028 criterion 5)', () => {
  it('draws Nothing outstanding and the new line, with no groups', () => {
    visit('default');
    press(box('kitchen-t1r2'));
    press(clearButton('kitchen-t1r2'));
    expect(text(host.querySelector('.incident-status')!)).toBe('Kitchen incident cleared.');
    expect(host.querySelector('.incidents__empty')).toBeNull();
    press(dismissButton('receipt-t1'));
    expect(ids()).toEqual([]);
    expect(host.querySelector('.incidents__group')).toBeNull();
    expect(text(host.querySelector('.incidents__empty')!)).toBe('Nothing outstandingNo unresolved print incidents.');
    expect(text(host.querySelector('.incident-status')!)).toBe('Nothing outstanding — no unresolved print incidents.');
  });

  it('loading and error do not draw the empty composition', () => {
    for (const state of ['loading', 'error']) {
      visit(state);
      expect(host.querySelector('.incidents__empty')).toBeNull();
    }
  });

  it('clearing draws no audit copy and leaves URL and history alone', () => {
    visit('default');
    const url = window.location.href;
    const length = window.history.length;
    press(box('kitchen-t1r2'));
    press(clearButton('kitchen-t1r2'));
    press(dismissButton('receipt-t1'));
    expect(text(host)).not.toMatch(/audit|logged|recorded/i);
    expect(window.location.href).toBe(url);
    expect(window.history.length).toBe(length);
  });
});

describe('B-16 holds on the recovery row (FE-028 criterion 6)', () => {
  it('the cancellation card, recovery row and result included, never says send, kitchen again or order', () => {
    visit('cancel');
    press(reprintButton('cancel-t1'));
    press(box('cancel-t1'));
    const full = text(card('cancel-t1'));
    expect(full).toContain('Clear incident');
    const rest = full.replace('it is a cancellation, never a new order', '').replace(/Reprint sent/g, '');
    expect(rest).not.toMatch(/\bsend(s|ing)?\b|kitchen again|\border\b|\bfire\b/i);
  });
});

describe('what each fixture state says and where (FE-028 criteria 4, 7)', () => {
  const RESULT_ON: Array<[string, string, string]> = [
    ['reprint', 'kitchen-t1r2', 'Reprint sentCheck the kitchen has the paper before clearing this.'],
    ['reprint-cancel', 'cancel-t1', 'Reprint sentCheck the kitchen has the paper before clearing this.'],
    ['reprint-receipt', 'receipt-t1', 'Reprint sent'],
    ['reprint-table9', 'kitchen-t9r1', 'Reprint sentCheck the kitchen has the paper before clearing this.'],
    ['reprint-counter', 'receipt-counter', 'Reprint sent'],
    ['reprint-printed', 'kitchen-t1r2', 'Server confirmed: printed at 20:03Check the kitchen has the paper before clearing this.'],
  ];
  it.each(RESULT_ON)('%s draws its result on %s only', (state, id, expected) => {
    visit(state);
    expect(resultOf(id)).toBe(expected);
    for (const other of ids().filter((i) => i !== id)) expect(resultOf(other!)).toBeNull();
  });

  it('only reprint-printed says “printed at”', () => {
    for (const { id } of INCIDENT_STATES) {
      visit(id);
      expect(/printed at/.test(text(host))).toBe(id === 'reprint-printed');
    }
  });
});

describe('copy that says only what is known (FE-028 item 4)', () => {
  it('the kitchen heading note, the Counter UNKNOWN line, and no claim the kitchen has not seen it', () => {
    visit('overflow');
    expect(text(host.querySelector('[data-class="emergency"] .incidents__heading')!)).toContain('Check delivery with the kitchen');
    expect(text(host)).not.toContain('has not seen this work');
    expect(text(card('receipt-counter'))).toContain('Delivery is UNKNOWN. Check the printer before reprinting.');
    expect(text(card('receipt-t1'))).not.toContain('Delivery is UNKNOWN');
  });
});
