// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalDialog } from '../src/Approval.js';
import type { ApprovalRequest } from '../src/approvalFixtures.js';
import { ClosedOrderScreen } from '../src/ClosedOrderScreen.js';
import { orderTotals } from '../src/discount.js';
import type { OrderLine } from '../src/orderFixtures.js';
import { useOrderBook, type BookOrder, type OrderBook, type OrderStore } from '../src/orderStore.js';
import { PosRoutes } from '../src/PosRoutes.js';
import type { RefundRecord, RefundRefusal, RefundResult } from '../src/refund.js';
import { REFUND_STATES } from '../src/refundDraft.js';
import type { ShownOrder } from '../src/voidFixtures.js';

// FE-032 / POS-06: the refund. These prove the client's behaviour: what the sheet
// and the approval draw, what the screen asks the book for and what it draws from
// the answer. They do not close AC-11, AC-14, AC-18, AC-25 or AC-34, which need the
// server and PostgreSQL (ADR-002): the operation under test is an in-memory stand-in.

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
  vi.useRealTimers();
  window.history.replaceState(null, '', '/pos/order');
});

const press = (el: Element) => act(() => (el as HTMLElement).click());
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const path = () => `${window.location.pathname}${window.location.search}`;
const escape = () => act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

function load(url: string) {
  window.history.replaceState(null, '', url);
  act(() => root.render(<PosRoutes key={++mount} />));
}

const screen = () => host.querySelector<HTMLElement>('.closed-order')!;
const sheet = () => host.querySelector<HTMLElement>('.sheet');
const modal = () => host.querySelector<HTMLElement>('.modal');
const refundButton = () => screen().querySelector<HTMLButtonElement>('[data-action="refund"]');
const action = (name: string, within: ParentNode = host) => within.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
const buttonNamed = (within: ParentNode, name: string) =>
  [...within.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? text(b)) === name)!;
const off = (b: Element) => b.getAttribute('aria-disabled') === 'true';

// ---- what the sheet, the approval and the page draw ----

const NOTE_REVIEW = 'Your allocation and reason are kept. Review them, then enter a manager PIN for a new attempt.';
const FAILED = 'Refund failed · the order is unchanged';
const DAY_CLOSED = 'This order’s business day is closed' + 'Reprinting still works. Refunds are unavailable.';
const DAY_REFUSED = 'Refund refused · business day closed during this attempt' + 'Nothing was refunded. The order is unchanged. Reprinting still works. Return to order';

function sheetFacts() {
  const s = sheet()!;
  return {
    title: text(s.querySelector('.sheet__title')!),
    banner: text(s.querySelector('.refund-banner')!),
    rows: [...s.querySelectorAll('.refund-allocation')].map((r) => `${text(r.firstElementChild!)}|${text(r.querySelector('button')!)}`),
    allocated: text(s.querySelector('.closed-totalrow')!),
    alert: s.querySelector('[role="alert"]') ? text(s.querySelector('[role="alert"]')!) : null,
    reason: [...s.querySelectorAll('.closed-options [aria-pressed="true"]')].map(text)[0] ?? null,
    notes: [...s.querySelectorAll('.closed-muted')].map(text),
    cont: action('continue', s),
  };
}

function modalFacts() {
  const m = modal()!;
  return {
    title: text(m.querySelector('.modal__title')!),
    request: text(m.querySelector('.modal__request')!),
    back: text(m.querySelector('.modal__split')!),
    tag: m.querySelector('.closed-tag') ? text(m.querySelector('.closed-tag')!) : null,
    dots: m.querySelector('.pin-dots')!.getAttribute('aria-label'),
    note: text(m.querySelector('.modal__note')!),
  };
}

/** The page behind the overlay: the tag, the notices, the money returned and the actions' notes. */
function page() {
  const s = screen();
  const returned: string[] = [];
  let inside = false;
  for (const el of s.querySelectorAll('.closed-content > .closed-group, .closed-content > .closed-line')) {
    if (el.classList.contains('closed-group')) inside = text(el) === 'Money returned · full order';
    else if (inside) returned.push(text(el));
  }
  const payment: string[] = [];
  inside = false;
  for (const el of s.querySelectorAll('.closed-content > .closed-group, .closed-content > .closed-line')) {
    if (el.classList.contains('closed-group')) inside = text(el) === 'Original payment';
    else if (inside) payment.push(text(el));
  }
  return {
    name: text(s.querySelector('h1')!),
    tag: text(s.querySelector('.closed-head .closed-tag')!),
    notices: [...s.querySelectorAll('.closed-content .closed-notice')].map(text),
    returned,
    payment,
    totals: [...s.querySelectorAll('.closed-summary dl > div')].map(text),
    why: [...s.querySelectorAll('.closed-actions p')].map(text),
  };
}

const typePin = (digits: string) => {
  for (const d of digits) press(buttonNamed(modal()!, d));
};
const confirmKey = () => buttonNamed(modal()!, 'Continue');
const preset = (name: string) => buttonNamed(sheet()!, name);
const rowButton = (i: number) => sheet()!.querySelectorAll<HTMLButtonElement>('.refund-allocation button')[i]!;
const pad = (keys: string) => {
  for (const k of keys === 'Clear' ? ['Clear'] : [...keys]) press(sheet()!.querySelector(`.keypad [data-key="${k}"]`)!);
};
const editRow = (i: number, digits: string) => {
  press(rowButton(i));
  pad('Clear');
  if (digits) pad(digits);
  press(action('save-edit'));
};

// ---------------------------------------------------------------------------
// Criterion 1 — the thirteen states
// ---------------------------------------------------------------------------

const T = '155.925';
const CUSTOM_ROWS = ['Card|40.000', 'Card|30.000', 'Meal voucher|20.000', 'Card|10.000', 'Staff account|20.000', 'Cash|35.925'];
const PRESET = 'Wrong dish served';
const NEED_REASON = 'Select a reason before continuing.';
const DEFAULTS_LINE = 'Defaults to each original tender less its change.';

type SheetExpect = { name: string; rows: string[]; allocated: string; alert: string | null; reason: string | null; on: boolean; notes: string[]; absent?: string[] };

const SHEETS: Record<string, SheetExpect> = {
  'sheet-refund': { name: 'Table 1', rows: ['Card|100.000', 'Cash|55.925'], allocated: `Allocated${T} of ${T}`, alert: null, reason: null, on: false, notes: ['Allocation equals the full order total.', DEFAULTS_LINE, NEED_REASON], absent: ['A row at 0 is not refunded and is left out of the refund.'] },
  'sheet-ac25': { name: 'Table 7', rows: ['Cash|155.925'], allocated: `Allocated${T} of ${T}`, alert: null, reason: null, on: false, notes: [`${DEFAULTS_LINE} Cash: 200.000 − 44.075 = 155.925.`, NEED_REASON] },
  'sheet-custom': { name: 'Table 4', rows: CUSTOM_ROWS, allocated: `Allocated${T} of ${T}`, alert: null, reason: null, on: false, notes: [DEFAULTS_LINE, NEED_REASON] },
  'sheet-edited': { name: 'Table 1', rows: ['Card|80.000', 'Cash|75.925'], allocated: `Allocated${T} of ${T}`, alert: null, reason: PRESET, on: true, notes: ['Allocation equals the full order total.', DEFAULTS_LINE], absent: [NEED_REASON] },
  'sheet-invalid': { name: 'Table 1', rows: ['Card|80.000', 'Cash|55.925'], allocated: `Allocated135.925 of ${T}`, alert: `Allocate 20.000 more. Allocations must equal ${T} exactly.`, reason: PRESET, on: false, notes: [DEFAULTS_LINE], absent: ['Allocation equals the full order total.'] },
  'sheet-zero': { name: 'Table 1', rows: ['Card · not refunded|0', 'Cash|155.925'], allocated: `Allocated${T} of ${T}`, alert: null, reason: PRESET, on: true, notes: ['A row at 0 is not refunded and is left out of the refund.', DEFAULTS_LINE] },
};

describe('criterion 1: the thirteen refund states draw what the artifact draws', () => {
  it('declares the thirteen, in the artifact’s order', () => {
    expect(REFUND_STATES.map((s) => s.id)).toEqual([
      'sheet-refund',
      'sheet-ac25',
      'sheet-custom',
      'sheet-edited',
      'sheet-invalid',
      'sheet-zero',
      'sheet-edit',
      'sheet-other',
      'approval',
      'approval-edited',
      'refund-error',
      'refund-error-cash',
      'day-refusal',
    ]);
  });

  for (const [id, want] of Object.entries(SHEETS)) {
    it(`${id}: the order’s own tenders, the sum, the alert, the reason and whether Continue is on`, () => {
      load(`/pos/closed-order?state=${id}`);
      const shown = sheetFacts();
      expect(page().name).toBe(want.name);
      expect(shown.title).toBe('Refund the whole order');
      expect(shown.banner).toBe(`Refund the whole order · ${T}Part of an order cannot be refunded. An order can be refunded once.`);
      expect(shown.rows).toEqual(want.rows);
      expect(shown.allocated).toBe(want.allocated);
      expect(shown.alert).toBe(want.alert);
      expect(shown.reason).toBe(want.reason);
      expect(off(shown.cont)).toBe(!want.on);
      expect(shown.cont.hasAttribute('disabled')).toBe(false);
      for (const n of want.notes) expect(shown.notes).toContain(n);
      for (const n of want.absent ?? []) expect(shown.notes).not.toContain(n);
      // The sheet leaves What was charged visible: the summary is outside it, and the page is still behind.
      expect(screen().querySelector('.closed-summary')!.contains(sheet())).toBe(false);
      expect(text(screen().querySelector('.closed-summary')!)).toContain(`Total${T}`);
    });
  }

  it('sheet-edit: the editor for the first row, over its own order', () => {
    load('/pos/closed-order?state=sheet-edit');
    const s = sheet()!;
    expect(text(s.querySelector('.sheet__title')!)).toBe('Edit refund allocation');
    expect(text(s.querySelector('h3')!)).toBe('Card · money back');
    expect(text(s.querySelector('.refund-editor')!)).toContain(`This changes the allocation only. The refund remains the whole order, ${T}.`);
    expect(text(s.querySelector('output')!)).toBe('80.000');
    expect(text(s.querySelector('.refund-editor')!)).toContain('Other allocations: 55.925');
    expect(text(s.querySelector('.refund-editor')!)).toContain(`Required total: ${T}`);
    expect([...s.querySelectorAll('.sheet__foot button')].map(text)).toEqual(['Cancel edit', 'Keep amount']);
  });

  it('sheet-other: the typed reason and the keyboard, Keep reason on', () => {
    load('/pos/closed-order?state=sheet-other');
    const s = sheet()!;
    expect(text(s.querySelector('.sheet__title')!)).toBe('Reason — required');
    expect(s.querySelector<HTMLInputElement>('input')!.value).toBe('Meal was cold');
    expect([...s.querySelectorAll('.refund-keyboard > div')].map((r) => [...r.querySelectorAll('button')].map(text).join(''))).toEqual(['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM', 'SpaceDeleteClear']);
    expect(off(action('save-other', s))).toBe(false);
    expect([...s.querySelectorAll('.sheet__foot button')].map(text)).toEqual(['Cancel reason', 'Keep reason']);
  });

  it('approval: the subject, the reason and the money back in sheet order, six empty dots, no tag', () => {
    load('/pos/closed-order?state=approval');
    expect(modalFacts()).toEqual({
      title: 'Manager PIN',
      request: `Refund Table 1, ${T} — reason: Wrong dish served`,
      back: 'Money back: Card 100.000 · Cash 55.925',
      tag: null,
      dots: '0 of 6 digits entered',
      note: 'Cancelling changes nothing on the order.',
    });
    expect(text(modal()!.querySelector('.modal__approves')!)).toBe('Approves this refund only.');
    expect(sheet()).toBeNull();
  });

  it('approval-edited: a row at 0 reads not refunded, with the ALLOCATION EDITED tag', () => {
    load('/pos/closed-order?state=approval-edited');
    expect(modalFacts()).toMatchObject({
      request: `Refund Table 1, ${T} — reason: Wrong dish served`,
      back: 'Money back: Card not refunded · Cash 155.925 ALLOCATION EDITED',
      tag: 'ALLOCATION EDITED',
    });
  });

  it('refund-error: the amber notice with Review refund, which reopens the sheet with the edited allocation and reason', () => {
    load('/pos/closed-order?state=refund-error');
    expect(sheet()).toBeNull();
    expect(page().notices).toEqual([`${FAILED}${NOTE_REVIEW} Review refund`]);
    expect(screen().querySelector('.closed-notice')!.className).toBe('closed-notice');
    press(action('review-refund'));
    expect(sheetFacts()).toMatchObject({ rows: ['Card|80.000', 'Cash|75.925'], reason: PRESET });
    expect(off(sheetFacts().cont)).toBe(false);
  });

  it('refund-error-cash: Table 7 whatever order says, and the cash row in full', () => {
    load('/pos/closed-order?state=refund-error-cash&order=custom');
    expect(page().name).toBe('Table 7');
    expect(page().notices).toEqual([`${FAILED}${NOTE_REVIEW} Review refund`]);
    press(action('review-refund'));
    expect(sheetFacts().rows).toEqual(['Cash|155.925']);
    expect(sheetFacts().reason).toBe(PRESET);
  });

  it('day-refusal: the closed-day notice and the refusal, no Refund control and no retry; Return to order leaves the standing closed-day picture', () => {
    load('/pos/closed-order?state=day-refusal');
    expect(page().notices).toEqual([DAY_CLOSED, DAY_REFUSED]);
    expect(refundButton()).toBeNull();
    expect([...screen().querySelectorAll('button')].map(text)).toEqual(['Return to order', 'Reprint receipt']);
    expect(page().why).toEqual(['Refund unavailable · business day closed.']);
    expect(screen().querySelector('.closed-head a')!.getAttribute('href')).toBe('/pos/closed-orders?state=dayclosed');
    press(action('return-to-order'));
    expect(page().notices).toEqual([DAY_CLOSED]);
    expect(refundButton()).toBeNull();
    expect(screen().getAttribute('data-closed-state')).toBe('dayclosed');
  });

  it('a state’s overlay is the order’s own: no other order’s tenders in any refund state (DESIGN-010)', () => {
    // An order named in the address wins over the state's own (closed.js:90), except for the cash-only failure.
    for (const { id } of REFUND_STATES) {
      load(`/pos/closed-order?state=${id}&order=custom`);
      expect(page().name, id).toBe(id === 'refund-error-cash' ? 'Table 7' : 'Table 4');
    }
    load('/pos/closed-order?state=sheet-ac25');
    expect(page().name).toBe('Table 7');
    load('/pos/closed-order?state=sheet-zero&order=cash');
    // A sole zero row leaves the full total unallocated and blocks Continue (closed.js:111).
    expect(sheetFacts().rows).toEqual(['Cash · not refunded|0']);
    expect(sheetFacts().alert).toBe(`Allocate ${T} more. Allocations must equal ${T} exactly.`);
    expect(off(sheetFacts().cont)).toBe(true);
  });

  it('no sheet or approval opens on a zero-total, REFUNDED or closed-day order, whatever the state says', () => {
    for (const order of ['zero', 'refunded']) {
      for (const state of ['sheet-refund', 'sheet-edit', 'sheet-other', 'approval', 'approval-edited']) {
        load(`/pos/closed-order?state=${state}&order=${order}`);
        expect(screen().querySelectorAll('[role="dialog"]'), `${state} ${order}`).toHaveLength(0);
        expect(refundButton(), `${state} ${order}`).toBeNull();
      }
    }
  });

  it('refund-error on an order that cannot be refunded says Nothing was refunded. and offers no control', () => {
    for (const order of ['zero', 'refunded']) {
      load(`/pos/closed-order?state=refund-error&order=${order}`);
      const notice = page().notices.find((n) => n.startsWith(FAILED))!;
      expect(notice).toBe(`${FAILED}Nothing was refunded.`);
      expect(screen().querySelector('[data-action="review-refund"]')).toBeNull();
      expect(refundButton()).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Criteria 2, 3 — the control, and the default
// ---------------------------------------------------------------------------

describe('criterion 2: Refund is offered exactly where the order is refundable', () => {
  it('present on the five refundable fixtures and on the new-day order; never disabled', () => {
    const urls = [
      '?state=default',
      '?state=cash',
      '?state=custom',
      '?state=quick',
      '?state=overflow',
      '?state=quick&order=quick&time=23%3A40&list=dayclosed',
    ];
    for (const url of urls) {
      load(`/pos/closed-order${url}`);
      const b = refundButton();
      expect(b, url).not.toBeNull();
      expect(b!.hasAttribute('disabled'), url).toBe(false);
      expect(b!.getAttribute('aria-disabled'), url).toBeNull();
    }
  });

  it('absent, with its note, on zero, refunded and closed-day; and on a book order of total 0', () => {
    const notes: Record<string, string> = {
      zero: 'No payment taken · fully discounted.',
      refunded: 'Already refunded · this order is final.',
      dayclosed: 'Refund unavailable · business day closed.',
    };
    for (const [state, note] of Object.entries(notes)) {
      load(`/pos/closed-order?state=${state}`);
      expect(refundButton(), state).toBeNull();
      expect(page().why, state).toEqual([note]);
    }
    const comp = { name: 'Comp', value: { kind: 'percent', percent: '100' } } as Parameters<typeof orderTotals>[1];
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={stubBook([entry('table-5', [], 0n, comp)])} />));
    expect(refundButton()).toBeNull();
    expect(page().why).toEqual(['No payment taken · fully discounted.']);
  });
});

describe('criterion 3: the default is each tender’s effective contribution', () => {
  it('the cash order defaults to Cash 155.925, never the 200.000 note', () => {
    load('/pos/closed-order?state=cash');
    press(refundButton()!);
    expect(sheetFacts().rows).toEqual(['Cash|155.925']);
    expect(sheetFacts().allocated).toBe(`Allocated${T} of ${T}`);
    // The note is shown only as the arithmetic that explains the default.
    expect(sheetFacts().notes).toContain(`${DEFAULTS_LINE} Cash: 200.000 − 44.075 = 155.925.`);
  });

  it('a book order of two cash tenders, 50.000 and 150.000, on 155.925 defaults to 50.000 and 105.925', () => {
    // A 148.500 subtotal and the 5% service charge: a 155.925 total, and 44.075 of change.
    const book = stubBook([entry('table-5', [{ label: 'Cash', amount: 50_000n }, { label: 'Cash', amount: 150_000n }], 44_075n, undefined, 148_500n)]);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    expect(page().payment).toEqual(['Cash50.000', 'Cash150.000', 'Change given−44.075', 'Cash contribution155.925']);
    press(refundButton()!);
    expect(sheetFacts().rows).toEqual(['Cash|50.000', 'Cash|105.925']);
    expect(sheetFacts().allocated).toBe(`Allocated${T} of ${T}`);
    expect(sheetFacts().notes).toContain(`${DEFAULTS_LINE} Cash: 150.000 − 44.075 = 105.925.`);
  });

  it('a book order paid by card, then cash with change, defaults to the card’s amount and the cash tendered less the change', () => {
    closeAt('2026-09-25T14:30:00.000Z');
    load('/pos/floor');
    closeTable(9, cardThenCashWithChange);
    press(listLink());
    const total = BigInt(text(host.querySelector('.closed-row')!.lastElementChild!).replaceAll('.', ''));
    press(host.querySelector('.closed-row')!);
    press(refundButton()!);
    const rows = sheetFacts().rows;
    expect(rows).toEqual(['Card|1', `Cash|${format(total - 1n)}`]);
    expect(sheetFacts().notes.join(' ')).toContain(`Cash: 9.999.999 − ${format(9_999_999n - (total - 1n))} = ${format(total - 1n)}.`);
  });
});

// ---------------------------------------------------------------------------
// Criteria 4–7 — what the cashier can and cannot do on the sheet
// ---------------------------------------------------------------------------

describe('criterion 4: only the original tenders', () => {
  it('one row per tender, in the order taken, repeated names kept, and no control adds a row', () => {
    load('/pos/closed-order?state=sheet-custom');
    expect(sheetFacts().rows).toEqual(CUSTOM_ROWS);
    const controls = [...sheet()!.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? text(b));
    expect(controls.filter((c) => /add|new|another|split/i.test(c))).toEqual([]);
    expect(controls.filter((c) => c.startsWith('Edit '))).toHaveLength(6);
  });
});

describe('criterion 5: only the sum is checked', () => {
  it('short by 20.000 reads Allocate 20.000 more; over by 5.000 reads Reduce allocations by 5.000; either turns Continue off', () => {
    load('/pos/closed-order?state=sheet-edited');
    editRow(0, '60000');
    expect(sheetFacts().rows).toEqual(['Card|60.000', 'Cash|75.925']);
    // 60.000 + 75.925 is 135.925: short by 20.000.
    expect(sheetFacts().alert).toBe(`Allocate 20.000 more. Allocations must equal ${T} exactly.`);
    expect(off(sheetFacts().cont)).toBe(true);
    editRow(0, '85000');
    expect(sheetFacts().alert).toBe(`Reduce allocations by 5.000. Allocations must equal ${T} exactly.`);
    expect(off(sheetFacts().cont)).toBe(true);
    // Continue does nothing while off.
    press(sheetFacts().cont);
    expect(modal()).toBeNull();
  });

  it('a row above its tender’s contribution is accepted when the sum is exact', () => {
    load('/pos/closed-order?state=sheet-edited');
    editRow(0, '0');
    editRow(1, '155925');
    expect(sheetFacts().rows).toEqual(['Card · not refunded|0', 'Cash|155.925']);
    expect(sheetFacts().alert).toBeNull();
    expect(off(sheetFacts().cont)).toBe(false);
    // Over the cash row's own contribution (55.925) and nothing capped it.
    load('/pos/closed-order?state=sheet-edited');
    editRow(0, '20000');
    editRow(1, '135925');
    expect(sheetFacts().rows).toEqual(['Card|20.000', 'Cash|135.925']);
    expect(off(sheetFacts().cont)).toBe(false);
  });

  it('the editor: digits shift in from the right, a leading zero is dropped, nine digits at most, Delete and Clear', () => {
    load('/pos/closed-order?state=sheet-refund');
    press(rowButton(0));
    const field = () => text(sheet()!.querySelector('output')!);
    pad('Clear');
    expect(field()).toBe('0');
    pad('0');
    pad('7');
    expect(field()).toBe('7');
    pad('1234567890');
    expect(field()).toBe('712.345.678');
    press(sheet()!.querySelector('[data-key="←"]')!);
    expect(field()).toBe('71.234.567');
    pad('Clear');
    expect(field()).toBe('0');
    expect(text(sheet()!)).toContain('Other allocations: 55.925');
  });

  it('Keep amount writes the row; an empty field is 0; Cancel edit leaves the row as it was', () => {
    load('/pos/closed-order?state=sheet-refund');
    press(rowButton(0));
    pad('Clear');
    pad('5');
    press(action('cancel-edit'));
    expect(sheetFacts().rows).toEqual(['Card|100.000', 'Cash|55.925']);
    expect(sheetFacts().title).toBe('Refund the whole order');
    editRow(0, '');
    expect(sheetFacts().rows[0]).toBe('Card · not refunded|0');
  });
});

describe('criterion 6: a zero row is dropped', () => {
  it('the sheet and M-1 say not refunded, and the refund asked for and the Money returned list carry no row at 0', () => {
    const refund = vi.fn(() => REFUNDED_ANSWER);
    const book = stubBook([entry('table-5', CARD_CASH, 5_000n)], refund);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    press(refundButton()!);
    editRow(0, '');
    editRow(1, '105000');
    expect(sheetFacts().rows[0]).toBe('Card · not refunded|0');
    expect(sheetFacts().notes).toContain('A row at 0 is not refunded and is left out of the refund.');
    press(preset(PRESET));
    press(sheetFacts().cont);
    expect(modalFacts().back).toBe('Money back: Card not refunded · Cash 105.000 ALLOCATION EDITED');
    typePin('123456');
    press(confirmKey());
    expect(refund).toHaveBeenCalledTimes(1);
    expect((refund.mock.calls[0] as unknown[])[1]).toEqual({ allocations: [{ position: 1, amount: 105_000n }], reason: PRESET });
  });

  it('a fixture’s REFUNDED composition lists only the rows above 0', () => {
    load('/pos/closed-order?state=approval-edited');
    typePin('123456');
    press(confirmKey());
    expect(page().returned).toEqual(['Cash155.925']);
  });
});

describe('criterion 7: a reason is required', () => {
  it('no reason, or a reason only of spaces, cannot continue, and the sheet says why', () => {
    load('/pos/closed-order?state=sheet-refund');
    expect(off(sheetFacts().cont)).toBe(true);
    expect(sheetFacts().notes).toContain(NEED_REASON);
    expect(sheetFacts().cont.getAttribute('aria-describedby')).toBe('refund-reason-note');
    press(sheetFacts().cont);
    expect(modal()).toBeNull();
    // Empty, then only spaces: Keep reason stays off, and pressing it keeps nothing.
    press(action('other'));
    expect(off(action('save-other'))).toBe(true);
    press(sheet()!.querySelector('[data-key=" "]')!);
    press(sheet()!.querySelector('[data-key=" "]')!);
    expect(off(action('save-other'))).toBe(true);
    expect(action('save-other').hasAttribute('disabled')).toBe(false);
    press(action('save-other'));
    expect(text(sheet()!.querySelector('.sheet__title')!)).toBe('Reason — required');
    press(action('cancel-other'));
    expect(sheetFacts().reason).toBeNull();
    expect(off(sheetFacts().cont)).toBe(true);
  });

  it('a typed reason is trimmed, held to 160 characters, and chosen; the presets and Other are one choice', () => {
    load('/pos/closed-order?state=sheet-refund');
    press(action('other'));
    for (const k of [' ', 'A', ' ', ' ']) press(sheet()!.querySelector(`[data-key="${k}"]`)!);
    press(sheet()!.querySelector('[data-key="B"]')!);
    press(sheet()!.querySelector('[data-key=" "]')!);
    expect(off(action('save-other'))).toBe(false);
    press(action('save-other'));
    expect(sheetFacts().reason).toBe('Other — type a reason');
    expect([...sheet()!.querySelectorAll('p')].map(text)).toContain('A B');
    expect(off(sheetFacts().cont)).toBe(false);
    press(preset('Customer complaint'));
    expect(sheetFacts().reason).toBe('Customer complaint');

    press(action('other'));
    for (let i = 0; i < 165; i++) press(sheet()!.querySelector('[data-key="A"]')!);
    expect(sheet()!.querySelector<HTMLInputElement>('input')!.value).toHaveLength(160);
    press(action('save-other'));
    expect(sheet()!.querySelector('.closed-options')!.nextElementSibling!.textContent).toHaveLength(160);
  });

  it('Cancel reason keeps whatever reason was set before', () => {
    load('/pos/closed-order?state=sheet-edited');
    press(action('other'));
    press(sheet()!.querySelector('[data-key="Q"]')!);
    press(action('cancel-other'));
    expect(sheetFacts().reason).toBe(PRESET);
    load('/pos/closed-order?state=sheet-other');
    press(action('cancel-other'));
    expect(sheetFacts().reason).toBeNull();
    expect(sheetFacts().notes).toContain(NEED_REASON);
  });
});

// ---------------------------------------------------------------------------
// Criterion 8 — Cancel leaves nothing behind
// ---------------------------------------------------------------------------

describe('criterion 8: Cancel leaves nothing behind', () => {
  it('Cancel on the sheet discards the draft: reopening starts from the default allocation with no reason, and the order is as it was', () => {
    const refund = vi.fn(() => REFUNDED_ANSWER);
    const held = [entry('table-5', CARD_CASH, 5_000n)];
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={stubBook(held, refund)} />));
    const before = page();
    press(refundButton()!);
    editRow(0, '50000');
    editRow(1, '55000');
    press(preset('Customer complaint'));
    press(action('cancel-sheet'));
    expect(sheet()).toBeNull();
    expect(page()).toEqual(before);
    expect(page().tag).toBe('CLOSED');
    press(refundButton()!);
    expect(sheetFacts().rows).toEqual(['Card|60.000', 'Cash|45.000']);
    expect(sheetFacts().reason).toBeNull();
    expect(refund).not.toHaveBeenCalled();
    expect(held[0]!.status).toBe('closed');
  });

  it('Escape closes the sheet as Cancel does, and the editor as Cancel edit does', () => {
    load('/pos/closed-order?state=sheet-edit');
    escape();
    expect(sheetFacts().title).toBe('Refund the whole order');
    escape();
    expect(sheet()).toBeNull();
  });

  it('Cancel in M-1 returns to the sheet with every allocation and the reason kept and the digits gone, and writes nothing', () => {
    const refund = vi.fn(() => REFUNDED_ANSWER);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={stubBook([entry('table-5', CARD_CASH, 5_000n)], refund)} />));
    press(refundButton()!);
    editRow(0, '50000');
    editRow(1, '55000');
    press(preset('Charged in error'));
    press(sheetFacts().cont);
    typePin('1234');
    expect(modalFacts().dots).toBe('4 of 6 digits entered');
    press(buttonNamed(modal()!, 'Cancel'));
    expect(modal()).toBeNull();
    expect(sheetFacts()).toMatchObject({ rows: ['Card|50.000', 'Cash|55.000'], reason: 'Charged in error' });
    press(sheetFacts().cont);
    expect(modalFacts().dots).toBe('0 of 6 digits entered');
    expect(off(confirmKey())).toBe(true);
    // Escape cancels the approval the same way.
    typePin('12');
    escape();
    expect(modal()).toBeNull();
    expect(sheetFacts()).toMatchObject({ rows: ['Card|50.000', 'Cash|55.000'], reason: 'Charged in error' });
    expect(refund).not.toHaveBeenCalled();
    expect(page().tag).toBe('CLOSED');
  });

  it('the scrim takes no click: nothing leaves M-1 but Cancel and Escape', () => {
    load('/pos/closed-order?state=approval');
    press(screen().querySelector('.modal-scrim')!);
    expect(modal()).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Criterion 9, 10, 15 — an approved refund, once, and Back
// ---------------------------------------------------------------------------

describe('criterion 9: an approved refund leaves the order REFUNDED, from the record', () => {
  /** Table 9 closed through the real route: one rupiah by card, the rest in cash with change. Then to its POS-06. */
  function closedTable() {
    closeAt('2026-09-25T14:30:00.000Z');
    load('/pos/floor');
    closeTable(9, cardThenCashWithChange);
    press(listLink());
    const rows = host.querySelectorAll('.closed-row').length;
    press(host.querySelector('.closed-row')!);
    return { total: BigInt(text(screen().querySelector('.closed-summary .closed-grand dd')!).replaceAll('.', '')), rows };
  }

  it('an edited allocation: the rows shown are the record’s, the notice names no approver, the lines, totals and tenders are unchanged, and POS-05 tags the row', () => {
    const { total, rows: rowsBefore } = closedTable();
    const before = page();
    expect(before.tag).toBe('CLOSED');
    press(refundButton()!);
    // Default is Card 1 and the cash less change; edit it: the card row to 0 and the whole total on cash (above its contribution).
    expect(sheetFacts().rows).toEqual(['Card|1', `Cash|${format(total - 1n)}`]);
    editRow(0, '');
    editRow(1, String(total));
    press(preset('Charged in error'));
    press(sheetFacts().cont);
    expect(modalFacts().back).toBe(`Money back: Card not refunded · Cash ${format(total)} ALLOCATION EDITED`);
    vi.setSystemTime(new Date('2026-09-25T15:05:00.000Z'));
    typePin('246810');
    press(confirmKey());

    expect(modal()).toBeNull();
    expect(sheet()).toBeNull();
    const after = page();
    expect(after.tag).toBe('REFUNDED');
    expect(after.notices).toEqual(['REFUNDED · 22:05The whole order was refunded. Reason: Charged in error.']);
    expect(after.notices.join()).not.toMatch(/approv|M\. Iqbal/i);
    // The rows are the record's, never the default's: nothing went back to the card.
    expect(after.returned).toEqual([`Cash${format(total)}`]);
    expect(after.returned).not.toContain(`Cash${format(total - 1n)}`);
    expect(after.returned.join()).not.toContain('Card');
    // Nothing about the sale changed.
    expect(after.payment).toEqual(before.payment);
    expect(after.totals).toEqual(before.totals);
    expect(text(screen().querySelector('.closed-content')!)).toContain('Closed 21:30');
    // Once: no Refund control, no second path, and the note says why.
    expect(refundButton()).toBeNull();
    expect(after.why).toEqual(['Already refunded · this order is final.']);
    // Reprint still works.
    press(action('reprint'));
    expect(page().notices.at(-1)).toBe('Reprint sent');
    // POS-05's row tags it REFUNDED and the order stays in the list.
    press([...screen().querySelectorAll('a')].find((a) => text(a) === '← Closed orders')!);
    expect(host.querySelectorAll('.closed-row')).toHaveLength(rowsBefore);
    const row = host.querySelector('.closed-row')!;
    expect(text(row.querySelector('.closed-tag')!)).toBe('REFUNDED');
    expect(text(row.children[2]!)).toContain('Card 1 · Cash');
  });

  it('a default allocation records the contributions as the walk gave them', () => {
    const { total } = closedTable();
    press(refundButton()!);
    press(preset(PRESET));
    press(sheetFacts().cont);
    typePin('000000');
    press(confirmKey());
    expect(page().returned).toEqual(['Card1', `Cash${format(total - 1n)}`]);
    expect(page().notices).toEqual([expect.stringMatching(/^REFUNDED · \d\d:\d\dThe whole order was refunded\. Reason: Wrong dish served\.$/)]);
  });
});

describe('criterion 15: Back cannot revive a refunded order', () => {
  it('with the refunded order still active, its order and settlement routes draw no live control', () => {
    closeAt('2026-09-25T14:30:00.000Z');
    load('/pos/floor');
    closeTable(9, cardThenCashWithChange);
    press(listLink());
    press(host.querySelector('.closed-row')!);
    press(refundButton()!);
    press(preset(PRESET));
    press(sheetFacts().cont);
    typePin('123456');
    press(confirmKey());
    expect(page().tag).toBe('REFUNDED');

    for (const route of ['/pos/order', '/pos/settlement']) {
      window.history.pushState(null, '', route);
      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(path(), route).toBe('/pos/floor');
      expect(host.querySelector('.order-actions, [data-action="settle"], [data-action="close-order"], [data-item]'), route).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Criteria 12, 13, 14 — the approval, the book's answer, a fixture address
// ---------------------------------------------------------------------------

const CARD_CASH = [{ label: 'Card', amount: 60_000n }, { label: 'Cash', amount: 50_000n }];
const record = (over: Partial<RefundRecord> = {}): RefundRecord => ({
  refundedAt: '2026-09-25T15:05:00.000Z',
  reason: PRESET,
  allocations: [{ position: 0, label: 'Card', amount: 105_000n }],
  amount: 105_000n,
  ...over,
});
const REFUNDED_ANSWER: RefundResult = { record: record() };

/** Open the sheet, choose a reason, continue to the approval, key six digits and confirm. */
function approveWith(digits: string) {
  press(refundButton()!);
  press(preset(PRESET));
  press(sheetFacts().cont);
  typePin(digits);
  press(confirmKey());
}

describe('criterion 12: the approval is this refund’s alone', () => {
  it('shows a count of digits and never a digit; reopening starts empty; the confirm key is off below six', () => {
    load('/pos/closed-order?state=approval');
    expect(off(confirmKey())).toBe(true);
    typePin('777');
    expect(modalFacts().dots).toBe('3 of 6 digits entered');
    expect(modal()!.querySelectorAll('.pin-dot--filled')).toHaveLength(3);
    expect(host.innerHTML).not.toContain('777');
    expect(off(confirmKey())).toBe(true);
    expect(confirmKey().hasAttribute('disabled')).toBe(false);
    expect(confirmKey().getAttribute('aria-describedby')).toBe('pin-dots');
    press(confirmKey());
    expect(modal()).not.toBeNull();
    typePin('777');
    expect(off(confirmKey())).toBe(false);
    // Cancel, and reopen: nothing is carried.
    press(buttonNamed(modal()!, 'Cancel'));
    press(sheetFacts().cont);
    expect(modalFacts().dots).toBe('0 of 6 digits entered');
    expect(off(confirmKey())).toBe(true);
  });

  it('any six digits behave alike: the book is asked the same thing, and no digit is passed to it', () => {
    const asked: unknown[][] = [];
    for (const digits of ['123456', '000000', '987654']) {
      const refund = vi.fn(() => REFUNDED_ANSWER);
      act(() => root.render(<ClosedOrderScreen key={digits} search="?order=table-5" book={stubBook([entry('table-5', CARD_CASH, 5_000n)], refund)} />));
      approveWith(digits);
      expect(refund).toHaveBeenCalledTimes(1);
      asked.push(refund.mock.calls[0] as unknown[]);
    }
    const [first, ...rest] = asked as [string, unknown, string][];
    expect(first![0]).toBe('table-5');
    expect(first![1]).toEqual({ allocations: [{ position: 0, amount: 60_000n }, { position: 1, amount: 45_000n }], reason: PRESET });
    expect(Object.keys(first![1] as object)).toEqual(['allocations', 'reason']);
    // The third argument is the time of the press, an argument as `closedAt` is; the rest is identical whatever was keyed.
    for (const r of rest) expect(r.slice(0, 2)).toEqual(first!.slice(0, 2));
    expect(first).toHaveLength(3);
  });

  it('nothing is stored: no storage, no cookie', () => {
    load('/pos/closed-order?state=approval');
    typePin('654321');
    press(confirmKey());
    expect(document.cookie).toBe('');
    expect(window.location.search).toBe('?state=approval');
  });
});

describe('ApprovalDialog: one M-1, controlled', () => {
  const REQUEST: ApprovalRequest = { action: 'refund', description: 'Refund Table 1, 155.925', reason: 'Wrong dish served' };
  const dialog = (props: Partial<Parameters<typeof ApprovalDialog>[0]> = {}) => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    act(() => root.render(<ApprovalDialog request={REQUEST} onSubmit={onSubmit} onCancel={onCancel} {...props} />));
    return { onSubmit, onCancel };
  };
  const key = (name: string) => buttonNamed(host, name);

  it('Cancel and Escape are the caller’s onCancel, and the scrim has no click', () => {
    const { onCancel } = dialog();
    press(host.querySelector('.modal-scrim')!);
    expect(onCancel).not.toHaveBeenCalled();
    press(key('Cancel'));
    escape();
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('with requireFull the confirm key is aria-disabled until six digits, then one submit carries the entry and the pad empties', () => {
    const { onSubmit } = dialog({ requireFull: true });
    for (const d of '12345') press(key(d));
    expect(off(key('Continue'))).toBe(true);
    press(key('Continue'));
    expect(onSubmit).not.toHaveBeenCalled();
    press(key('6'));
    expect(off(key('Continue'))).toBe(false);
    press(key('Continue'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(off(key('Continue'))).toBe(true);
    press(key('Continue'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('without requireFull it behaves as POS-03’s approval always has: Continue is live from the start', () => {
    const { onSubmit } = dialog();
    expect(off(key('Continue'))).toBe(false);
    press(key('Continue'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('a throttled prompt stays inert whatever is keyed, and the caller’s notice is drawn', () => {
    const { onSubmit } = dialog({ throttled: true, requireFull: true, notice: { title: 'Locked', body: 'Wait', failure: true } });
    for (const d of '123456') press(key(d));
    expect(off(key('Continue'))).toBe(true);
    press(key('Continue'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(text(host.querySelector('.notice')!)).toBe('LockedWait');
  });

  it('shows the request it is given, and the detail the caller adds', () => {
    dialog({ detail: <p className="x">Money back: Card 1</p> });
    expect(text(host.querySelector('.modal__request')!)).toBe('Refund Table 1, 155.925 — reason: Wrong dish served');
    expect(text(host.querySelector('.x')!)).toBe('Money back: Card 1');
  });
});

describe('criterion 13: the screen draws the book’s answer', () => {
  it('already-refunded: the existing record, never the draft, with the failure notice and no control', () => {
    const held = [entry('table-5', CARD_CASH, 5_000n)];
    const refund = vi.fn(() => {
      // Another client refunded it first: the book now holds the other refund.
      held[0] = { ...held[0]!, status: 'refunded', refunded: record({ reason: 'Customer complaint', allocations: [{ position: 1, label: 'Cash', amount: 105_000n }] }) };
      return { refused: 'already-refunded' as RefundRefusal };
    });
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={stubBook(held, refund)} />));
    approveWith('123456');
    expect(modal()).toBeNull();
    const shown = page();
    expect(shown.tag).toBe('REFUNDED');
    expect(shown.notices).toEqual(['REFUNDED · 22:05The whole order was refunded. Reason: Customer complaint.', `${FAILED}Nothing was refunded.`]);
    expect(shown.returned).toEqual(['Cash105.000']);
    expect(refundButton()).toBeNull();
    expect(screen().querySelector('[data-action="review-refund"]')).toBeNull();
  });

  it('a request refusal shows refund-error with the allocation and reason kept for Review refund, and a fresh M-1 for a new attempt', () => {
    for (const refused of ['no-reason', 'not-a-tender', 'invalid-amount', 'sum-mismatch'] as const) {
      const refund = vi.fn(() => ({ refused }));
      act(() => root.render(<ClosedOrderScreen key={refused} search="?order=table-5" book={stubBook([entry('table-5', CARD_CASH, 5_000n)], refund)} />));
      press(refundButton()!);
      editRow(0, '50000');
      editRow(1, '55000');
      press(preset('Customer complaint'));
      press(sheetFacts().cont);
      typePin('123456');
      press(confirmKey());
      expect(modal(), refused).toBeNull();
      expect(page().tag, refused).toBe('CLOSED');
      expect(page().notices, refused).toEqual([`${FAILED}${NOTE_REVIEW} Review refund`]);
      press(action('review-refund'));
      expect(sheetFacts(), refused).toMatchObject({ rows: ['Card|50.000', 'Cash|55.000'], reason: 'Customer complaint' });
      press(sheetFacts().cont);
      expect(modalFacts().dots, refused).toBe('0 of 6 digits entered');
      typePin('123456');
      press(confirmKey());
      // The client never re-sends on its own: one attempt per PIN entry.
      expect(refund, refused).toHaveBeenCalledTimes(2);
    }
  });

  it('Cancel on the sheet after Review refund leaves the failure notice and its kept draft; a fresh Refund starts from the default', () => {
    const refund = vi.fn(() => ({ refused: 'sum-mismatch' as RefundRefusal }));
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={stubBook([entry('table-5', CARD_CASH, 5_000n)], refund)} />));
    press(refundButton()!);
    editRow(0, '50000');
    editRow(1, '55000');
    press(preset(PRESET));
    press(sheetFacts().cont);
    typePin('123456');
    press(confirmKey());
    press(action('review-refund'));
    press(action('cancel-sheet'));
    expect(page().notices).toEqual([`${FAILED}${NOTE_REVIEW} Review refund`]);
    press(refundButton()!);
    expect(sheetFacts().rows).toEqual(['Card|60.000', 'Cash|45.000']);
    press(action('cancel-sheet'));
    press(action('review-refund'));
    expect(sheetFacts().rows).toEqual(['Card|50.000', 'Cash|55.000']);
  });

  it('zero-total, not-closed and unknown-order refusals: the same notice, no control, over whatever the book holds', () => {
    const refund = vi.fn(() => ({ refused: 'zero-total' as RefundRefusal }));
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={stubBook([entry('table-5', CARD_CASH, 5_000n)], refund)} />));
    approveWith('123456');
    expect(page().notices).toEqual([`${FAILED}Nothing was refunded.`]);
    expect(screen().querySelector('[data-action="review-refund"]')).toBeNull();
    // The book still holds a refundable order, and the cashier may start again; nothing was drawn as refunded.
    expect(page().tag).toBe('CLOSED');
  });

  it('day-closed: the day-refusal picture, then the standing closed-day picture, never a retry', () => {
    const refund = vi.fn(() => ({ refused: 'day-closed' as RefundRefusal }));
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={stubBook([entry('table-5', CARD_CASH, 5_000n)], refund)} />));
    approveWith('123456');
    expect(page().notices).toEqual([DAY_CLOSED, DAY_REFUSED]);
    expect(page().tag).toBe('CLOSED');
    expect(refundButton()).toBeNull();
    expect(screen().querySelector('[data-action="review-refund"]')).toBeNull();
    expect(screen().querySelector('.closed-head a')!.getAttribute('href')).toBe('/pos/closed-orders?state=dayclosed');
    press(action('return-to-order'));
    expect(page().notices).toEqual([DAY_CLOSED]);
    expect(page().why).toEqual(['Refund unavailable · business day closed.']);
    expect(refundButton()).toBeNull();
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it('the screen decides nothing: handed a book that accepts, it shows the refund the book holds, not the draft', () => {
    const held = [entry('table-5', CARD_CASH, 5_000n)];
    const refund = vi.fn(() => {
      held[0] = { ...held[0]!, status: 'refunded', refunded: record({ reason: 'What the book kept', allocations: [{ position: 1, label: 'Cash', amount: 105_000n }] }) };
      return { record: held[0]!.refunded! };
    });
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={stubBook(held, refund)} />));
    approveWith('123456');
    expect(page().notices).toEqual(['REFUNDED · 22:05The whole order was refunded. Reason: What the book kept.']);
    expect(page().returned).toEqual(['Cash105.000']);
  });
});

describe('criterion 14: a fixture address writes nothing', () => {
  it('confirming shows the REFUNDED composition with the chosen reason and allocation and no approver, and the book is not asked', () => {
    const refund = vi.fn(() => REFUNDED_ANSWER);
    const held: BookOrder[] = [];
    act(() => root.render(<ClosedOrderScreen search="?state=sheet-edited" book={stubBook(held, refund)} />));
    press(sheetFacts().cont);
    typePin('123456');
    press(confirmKey());
    expect(refund).not.toHaveBeenCalled();
    expect(held).toHaveLength(0);
    const shown = page();
    expect(shown.tag).toBe('REFUNDED');
    expect(shown.notices).toEqual(['REFUNDED · 20:31The whole order was refunded. Reason: Wrong dish served.']);
    expect(shown.returned).toEqual(['Card80.000', 'Cash75.925']);
    expect(shown.why).toEqual(['Already refunded · this order is final.']);
    expect(refundButton()).toBeNull();
    expect(screen().getAttribute('data-closed-state')).toBe('refunded');
  });

  it('the fixture REFUNDED picture alone keeps the artifact’s approver, as fixture copy', () => {
    load('/pos/closed-order?state=refunded');
    expect(page().notices).toEqual(['REFUNDED · 20:31 · approved by M. IqbalThe whole order was refunded. Reason: Wrong dish served.']);
    expect(page().returned).toEqual(['Cash155.925']);
  });
});

describe('the book’s refund, through the hook', () => {
  type Held = { store: OrderStore; book: OrderBook };
  function Harness({ out }: { out: { current?: Held } }) {
    // The settlement's own seed: Table 1 with its pending Steak gone, so it can close.
    out.current = useOrderBook({ state: 'default', gone: 'steak' });
    return null;
  }

  it('a second refund in the same tick finds the order refunded, changes nothing and answers already-refunded; the first record stands', () => {
    const out: { current?: Held } = {};
    act(() => root.render(<Harness out={out} />));
    const total = out.current!.store.order.totals.total;
    act(() => {
      expect(out.current!.store.close!('2026-09-25T14:30:00.000Z', [{ id: 'd', label: 'Card', amount: total }])).toBe(true);
    });
    const id = out.current!.book.activeId;
    expect(out.current!.book.orders().find((o) => o.id === id)!.status).toBe('closed');

    const first = { allocations: [{ position: 0, amount: total }], reason: ' Wrong dish served ' };
    const results: RefundResult[] = [];
    act(() => {
      results.push(out.current!.book.refund(id, first, '2026-09-25T15:05:00.000Z'));
      results.push(out.current!.book.refund(id, { ...first, reason: 'Another' }, '2026-09-25T16:00:00.000Z'));
    });
    expect(results[0]!.record).toMatchObject({ reason: 'Wrong dish served', amount: total, refundedAt: '2026-09-25T15:05:00.000Z' });
    expect(results[1]!.refused).toBe('already-refunded');
    const held = out.current!.book.orders().find((o) => o.id === id)!;
    expect(held.status).toBe('refunded');
    expect(held.refunded).toEqual(results[0]!.record);
    // The close facts are untouched, and a later call still refuses.
    expect(held).toMatchObject({ closedAt: '2026-09-25T14:30:00.000Z', tenders: [{ label: 'Card', amount: total }], change: 0n });
    expect(out.current!.book.refund(id, first, AT_LATER).refused).toBe('already-refunded');
    expect(out.current!.book.refund('table-404', first, AT_LATER).refused).toBe('unknown-order');
  });
});

const AT_LATER = '2026-09-25T17:00:00.000Z';

// ---------------------------------------------------------------------------
// Criterion 16 — touch at 1280×800 (structure; the lead walks the rendering)
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../src/pos.css'), 'utf8');
const rule = (selector: string) =>
  [...css.matchAll(/(^|\n)([^{}]+)\{([^}]*)\}/g)].filter((m) => m[2]!.split(',').map((s) => s.trim()).includes(selector)).map((m) => m[3]).join('\n');

describe('criterion 16: touch at 1280×800 (structure; not measured in a browser here)', () => {
  it('the six-tender allocation scrolls inside the sheet, whose head and foot stay, beside a summary the sheet does not cover', () => {
    load('/pos/closed-order?state=sheet-custom');
    const s = sheet()!;
    expect(s.parentElement).toBe(screen());
    expect(s.querySelector('.sheet__body')!.querySelectorAll('.refund-allocation')).toHaveLength(6);
    expect(rule('.sheet__body')).toMatch(/overflow-y:\s*auto/);
    expect(rule('.sheet__body')).toMatch(/min-height:\s*0/);
    expect(rule('.sheet')).toMatch(/display:\s*flex/);
    expect(rule('.sheet__head')).toMatch(/flex:\s*none/);
    expect(rule('.sheet__foot')).toMatch(/flex:\s*none/);
    // The sheet stops short of the summary column by the registry's sheet inset.
    expect(css).toMatch(/\.sheet-scrim,\s*\.sheet\s*\{[^}]*right:\s*var\(--frost-sheet-right\)/);
    // The page behind is read but not operated.
    expect(screen().querySelector('.closed-body')!.hasAttribute('inert')).toBe(true);
  });

  it('the allocation field is the registry’s width, the approval is the 560px modal inside the device, and its money-back line wraps', () => {
    expect(rule('.refund-field')).toMatch(/width:\s*var\(--frost-allocation-field-width\)/);
    expect(rule('.modal')).toMatch(/width:\s*var\(--frost-modal-width\)/);
    load('/pos/closed-order?state=approval');
    expect(modal()!.parentElement).toBe(screen());
    expect(rule('.modal__split')).not.toMatch(/nowrap/);
    expect(rule('.closed .modal__split')).not.toMatch(/nowrap|overflow/);
    expect(rule('.modal__head')).not.toMatch(/nowrap/);
    expect(rule('.modal__request')).not.toMatch(/nowrap/);
  });

  it('M-1 sits over the whole device: the page behind is inert', () => {
    load('/pos/closed-order?state=approval');
    expect(screen().querySelector('.closed-head')!.hasAttribute('inert')).toBe(true);
    expect(screen().querySelector('.closed-body')!.hasAttribute('inert')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Source facts
// ---------------------------------------------------------------------------

const src = resolve(here, '../src');
const code = (f: string) => readFileSync(join(src, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('source facts', () => {
  it('no reader compares a status against the string closed: one predicate says an order reached CLOSED', () => {
    const offenders = readdirSync(src)
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => /(status|\.status)\s*[!=]==\s*'closed'|'closed'\s*[!=]==\s*\w+\.status/.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it('there is one M-1: only Approval.tsx draws the manager approval dialog, and the refund reaches it through it', () => {
    const files = readdirSync(src)
      .filter((f) => /\.tsx$/.test(f))
      .filter((f) => /id="approval-title"|aria-labelledby="approval-title"/.test(code(f)));
    expect(files).toEqual(['Approval.tsx']);
    expect(code('RefundSheet.tsx')).toMatch(/<ApprovalDialog\b/);
  });

  it('POS-06’s confirm handler declares no parameter and the screen never names a PIN, a token or an approver', () => {
    const screenCode = code('ClosedOrderScreen.tsx');
    expect(screenCode).toMatch(/function confirm\(\)/);
    expect(screenCode).not.toMatch(/\bpin\b|\bdigits\b|approver|approvedBy|\bapproved\b/i);
    expect(code('RefundSheet.tsx')).not.toMatch(/approver|approvedBy|magic|1234/i);
    // No magic value: nothing compares an entry to anything.
    expect(code('RefundSheet.tsx') + screenCode).not.toMatch(/===\s*['"]\d{6}['"]/);
  });

  it('the screen keeps no refunded flag of its own for a book order and never sets a status', () => {
    const screenCode = code('ClosedOrderScreen.tsx');
    expect(screenCode).not.toMatch(/\.status\b|\bstatus\s*:|setRefunded|\[refunded,/);
  });

  it('the refund operation reads no clock, no React and no module state, and names no approver', () => {
    const c = code('refund.ts');
    expect(c).not.toMatch(/\bnew Date\b|Date\.now|\bimport .*react/);
    expect(c).not.toMatch(/^(export\s+)?(let|var)\s/m);
    expect(c).not.toMatch(/approver|\bactor\b|\bapproved\b/i);
  });

  it('nothing is asynchronous on a book order: no timer, no promise, no pending or no-response state', () => {
    const c = code('ClosedOrderScreen.tsx') + code('RefundSheet.tsx') + code('refund.ts');
    expect(c).not.toMatch(/\bsetTimeout|\bsetInterval|\bawait\b|\basync\b|\bPromise\b|no-response|verifying|pending/);
  });
});

// ---------------------------------------------------------------------------
// Helpers shared by the tests above (hoisted: function declarations and consts used inside `it`)
// ---------------------------------------------------------------------------

function format(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const line_ = (id: string, name: string, amount: bigint, status: OrderLine['status'] = 'fired'): OrderLine => ({ id, quantity: 1, name, amount, status });

/** A closed order the book holds: one Soup line (100.000 unless said) and the 5% service charge, unless discounted. */
function entry(id: string, tenders: ReadonlyArray<{ label: string; amount: bigint }>, change: bigint, discount?: Parameters<typeof orderTotals>[1], subtotal = 100_000n): BookOrder {
  const lines = [line_('a', 'Soup', subtotal)];
  const order: ShownOrder = {
    title: `Order · ${id}`,
    groups: [{ kind: 'fired', round: 1, firedAt: '2026-09-25T14:00:00.000Z', delivery: 'queued', lines }],
    totals: orderTotals(subtotal, discount),
    ...(discount && { applied: discount }),
  };
  return { id, status: 'closed', order, closedAt: '2026-09-25T14:30:00.000Z', tenders, change };
}

const stubBook = (held: BookOrder[], refund: (...args: never[]) => unknown = vi.fn()): OrderBook => ({ orders: () => held, refund }) as unknown as OrderBook;

function closeTable(n: number, pay: () => void) {
  press(host.querySelector(`[data-table="${n}"]`)!);
  for (let remove = host.querySelector('.order-line__remove'); remove; remove = host.querySelector('.order-line__remove')) press(remove);
  press(host.querySelector('.order-actions [data-action="settle"]')!);
  pay();
  press(host.querySelector('[data-action="close-order"]')!);
}

/** One rupiah by card, then 9.999.999 in cash: the cash is over the balance, so change is given and cash paid only part of the total. */
const cardThenCashWithChange = () => {
  press(host.querySelector('[data-method="card"]')!);
  press(host.querySelector('[data-digit="1"]')!);
  press(host.querySelector('[data-action="add-tender"]')!);
  press(host.querySelector('[data-method="cash"]')!);
  for (let i = 0; i < 7; i++) press(host.querySelector('[data-digit="9"]')!);
  press(host.querySelector('[data-action="add-tender"]')!);
};

const closeAt = (iso: string) => vi.useFakeTimers({ toFake: ['Date'], now: new Date(iso) });
const listLink = () => [...host.querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === 'Closed orders')!;
