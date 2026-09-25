// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OrderScreen } from '../src/OrderPanel.js';
import { ORDER_FIXTURES, ORDER_STATES, type OrderLine, type OrderState, type OrderView, type RoundGroup } from '../src/orderFixtures.js';
import { firedWork, givenReason, voidRule } from '../src/void.js';
import {
  LINE_REASONS,
  ORDER_REASONS,
  VOID_FIXTURES,
  lineBody,
  shownOrder,
  type ShownOrder,
  type VoidSheetFixture,
} from '../src/voidFixtures.js';
import { OTHER_REASON, VoidSheet } from '../src/VoidSheets.js';

// The void family (F2j). What this file is for:
// - FR-H2–H4 as one gate that reads one fact — is fired work involved — every
//   row, as a function and through the sheets, including that FR-H2 and FR-H3
//   agree on approval and differ on audit;
// - the reason FR-H4 requires: Continue is not available until one is chosen,
//   and a typed reason that is empty is not a reason;
// - the manager prompt opens as component state, never a URL, carrying the
//   chosen reason, and cancelling it leaves the sheet as it was (B-20);
// - B-15: nothing implies the void waits on a printer; B-16: a cancellation
//   covers fired work only;
// - the sheets read the order beside them, so their figures agree with the panel.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const here = dirname(fileURLToPath(import.meta.url));
const code = (f: string) =>
  readFileSync(resolve(here, '../src', f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

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
  window.history.replaceState(null, '', '/pos/order');
});

let mount = 0;
function render(state: OrderState, gone?: string) {
  const view: OrderView = gone ? { state, gone } : { state };
  window.history.replaceState(null, '', `/pos/order?state=${state}${gone ? `&gone=${gone}` : ''}`);
  act(() => root.render(<OrderScreen key={++mount} view={view} />));
}

/** A void sheet on its own, over any order. Records where it sends the order. */
function renderSheet(fixture: VoidSheetFixture, order: ShownOrder): OrderView[] {
  const went: OrderView[] = [];
  act(() =>
    root.render(
      <div className="pos-device" key={++mount}>
        <VoidSheet fixture={fixture} order={order} go={(v) => went.push(v)} />
      </div>
    )
  );
  return went;
}

const device = () => host.querySelector('.pos-device')!;
const sheet = () => host.querySelector<HTMLElement>('.sheet[role="dialog"]');
const prompt = () => host.querySelector<HTMLElement>('.modal[role="dialog"]');
const request = () => prompt()!.querySelector('.modal__request')!.textContent;
const urlState = () => new URLSearchParams(window.location.search).get('state') ?? 'default';
const press = (el: Element) => act(() => (el as HTMLElement).click());
const escape = () => act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
const buttons = (in_: Element) => [...in_.querySelectorAll('button')];
const named = (in_: Element, name: string) => {
  const found = buttons(in_).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name);
  if (!found) throw new Error(`no button named ${JSON.stringify(name)} in ${buttons(in_).map((b) => b.textContent)}`);
  return found;
};
const inSheet = (name: string) => named(sheet()!, name);
const inPrompt = (name: string) => named(prompt()!, name);
const title = () => sheet()!.querySelector('h2')!.textContent;
const tag = () => sheet()!.querySelector('.void-tag')?.textContent ?? null;
const reasons = () => [...sheet()!.querySelectorAll<HTMLElement>('.void-reason')];
const other = () => sheet()!.querySelector<HTMLInputElement>('#void-reason-other');
const footControls = () => [...sheet()!.querySelectorAll<HTMLElement>('.sheet__foot > *')];
/** The foot's last control, which voids or opens the prompt. A span while it is not available. */
const commit = () => footControls()[1]!;
function typeReason(text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setValue.call(other(), text);
    other()!.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const approve = () => {
  for (const d of '123456') press(inPrompt(d));
  press(inPrompt('Continue'));
};
const grandTotal = () => host.querySelector('.totals__row--grand dd')!.textContent;
const panelRows = (status: string) => [...host.querySelectorAll<HTMLElement>(`.order-line[data-line-status="${status}"]`)];

/** Everything a finger or keyboard can operate: not inside an inert subtree. */
function liveControls(container: ParentNode): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => !el.closest('[inert]'));
}

const VOID_STATES = ['sheet-voidline', 'sheet-voidorder', 'sheet-voidorder-fired'] as const;
const GATED_STATES = ['sheet-voidline', 'sheet-voidorder-fired'] as const;

// ---- FR-H2–H4, as a function ----

const line = (status: OrderLine['status'], id: string = status): OrderLine => ({ id, quantity: 1, name: id, amount: 10_000n, status });

describe('the void gate reads one fact: is fired work involved', () => {
  it.each([
    ['a PENDING line', { kind: 'line', line: line('pending') }, 'FR-H2', false, false, false],
    ['an order with no FIRED line', { kind: 'order', lines: [line('pending')] }, 'FR-H3', false, false, true],
    ['a FIRED line', { kind: 'line', line: line('fired') }, 'FR-H4', true, true, true],
    ['an order holding a FIRED line', { kind: 'order', lines: [line('pending'), line('fired')] }, 'FR-H4', true, true, true],
  ] as const)('%s: %s — approval %s, reason %s, audited %s', (_what, target, requirement, approval, reason, audited) => {
    const rule = voidRule(target);
    expect(rule.requirement).toBe(requirement);
    expect(rule.approval).toBe(approval);
    expect(rule.reason).toBe(reason);
    expect(rule.audited).toBe(audited);
  });

  it('FR-H2 and FR-H3 agree on approval and the reason, and differ on audit', () => {
    const pending = voidRule({ kind: 'line', line: line('pending') });
    const unfired = voidRule({ kind: 'order', lines: [line('pending')] });
    expect([pending.approval, pending.reason]).toEqual([unfired.approval, unfired.reason]);
    expect(pending.audited).toBe(false);
    expect(unfired.audited).toBe(true);
    expect(pending.requirement).not.toBe(unfired.requirement);
  });

  it('an order with no lines left, or only voided ones, is FR-H3: nothing fired is involved', () => {
    expect(voidRule({ kind: 'order', lines: [] }).requirement).toBe('FR-H3');
    expect(voidRule({ kind: 'order', lines: [line('voided'), line('pending', 'p')] }).requirement).toBe('FR-H3');
  });

  it('a voided line has nothing left to void', () => {
    expect(() => voidRule({ kind: 'line', line: line('voided') })).toThrow();
  });

  it('B-16: the cancellation covers the fired work and nothing else, and none where nothing fired', () => {
    const lines = [line('fired', 'a'), line('pending', 'b'), line('voided', 'c'), line('fired', 'd')];
    expect(voidRule({ kind: 'order', lines }).cancels.map((l) => l.id)).toEqual(['a', 'd']);
    expect(firedWork({ kind: 'order', lines })).toEqual(voidRule({ kind: 'order', lines }).cancels);
    expect(voidRule({ kind: 'order', lines: [line('pending')] }).cancels).toEqual([]);
    expect(voidRule({ kind: 'line', line: line('pending') }).cancels).toEqual([]);
    const fired = line('fired');
    expect(voidRule({ kind: 'line', line: fired }).cancels).toEqual([fired]);
  });

  it('reads the status, never the name, amount or quantity', () => {
    const lookalike: OrderLine = { id: 'burger', quantity: 99, name: 'Burger', amount: 0n, status: 'pending' };
    expect(voidRule({ kind: 'line', line: lookalike }).approval).toBe(false);
    expect(voidRule({ kind: 'line', line: { ...lookalike, status: 'fired' } }).approval).toBe(true);
  });

  it('the sheets ask voidRule for every gate, and decide none themselves', () => {
    const sheets = code('VoidSheets.tsx');
    expect(sheets).toMatch(/voidRule\(/);
    expect(sheets).not.toMatch(/status\s*[!=]==?\s*'(pending|fired|voided)'/);
    expect(sheets).not.toMatch(/requirement\s*[!=]==?/);
    expect(sheets).not.toMatch(/state\s*[!=]==?\s*'sheet-void/);
    const fixtures = code('voidFixtures.ts');
    expect(fixtures).not.toMatch(/approval|audited|voidRule|gated|MANAGER/);
  });
});

describe('givenReason: FR-H4’s reason', () => {
  const changedMind = LINE_REASONS[1]!;

  it('nothing chosen is no reason', () => {
    expect(givenReason(undefined)).toBeUndefined();
  });

  it('a listed reason gives its running-text form', () => {
    expect(givenReason({ kind: 'listed', reason: changedMind })).toBe('customer changed their mind');
  });

  it.each(['', ' ', '   ', '\t\n'])('typed %j is not a reason', (text) => {
    expect(givenReason({ kind: 'other', text })).toBeUndefined();
  });

  it('a typed reason is the cashier’s words, trimmed and otherwise untouched', () => {
    expect(givenReason({ kind: 'other', text: '  Pak Budi’s BBQ order was a duplicate ' })).toBe('Pak Budi’s BBQ order was a duplicate');
  });

  it('every listed reason’s running-text form is its label with a lower-case first letter', () => {
    for (const r of [...LINE_REASONS, ...ORDER_REASONS]) expect(r.inline).toBe(r.label[0]!.toLowerCase() + r.label.slice(1));
  });
});

// ---- The three states as drawn ----

describe('the three states', () => {
  it('are served by ?state=', () => {
    for (const s of VOID_STATES) expect(ORDER_STATES.map((o) => o.id)).toContain(s);
    expect(Object.keys(VOID_FIXTURES).sort()).toEqual([...VOID_STATES].sort());
  });

  it('sheet-voidline: the fired Burger, MANAGER REQUIRED, the cancellation notice, four reasons', () => {
    render('sheet-voidline');
    expect(title()).toBe('Void a line already sent to the kitchen');
    expect(tag()).toBe('MANAGER REQUIRED');
    const card = sheet()!.querySelector('.void-subject')!;
    expect([...card.querySelectorAll('.void-subject__row > span')].map((s) => s.textContent)).toEqual([
      'Burger — Large, Extra cheese',
      '135.000',
    ]);
    expect(card.querySelector('.void-subject__note')!.textContent).toBe('Sent to the kitchen in round 1 at 19:42.');
    const notice = sheet()!.querySelector('.notice')!;
    expect(notice.classList.contains('notice--soft')).toBe(false);
    expect(notice.querySelector('.notice__title')!.textContent).toBe('A cancellation ticket will print in the kitchen');
    expect(notice.lastElementChild!.textContent).toBe('It cancels this work only. It is not a new order and does not re-send the item.');
    expect(sheet()!.querySelector('#void-reasons')!.textContent).toBe('Reason — required');
    expect(reasons().map((r) => r.textContent)).toEqual([
      'Sent to the wrong table',
      'Customer changed their mind',
      'Kitchen cannot make it',
      'Other — type a reason',
    ]);
    expect(footControls().map((c) => c.textContent)).toEqual(['Cancel', 'Continue']);
  });

  it('sheet-voidorder: nothing fired, no approval, recorded against your name, no reasons', () => {
    render('sheet-voidorder');
    expect(title()).toBe('Void this order');
    expect(tag()).toBeNull();
    const notice = sheet()!.querySelector('.notice')!;
    expect(notice.classList.contains('notice--soft')).toBe(true);
    expect(notice.querySelector('.notice__title')!.textContent).toBe('Nothing on this order has been sent to the kitchen');
    expect(notice.lastElementChild!.textContent).toBe('No approval needed. The void is recorded against your name.');
    expect(reasons()).toEqual([]);
    expect(sheet()!.querySelector('.void-value')!.textContent).toBe('Order value382.725');
    expect(footControls().map((c) => [c.tagName, c.textContent])).toEqual([
      ['BUTTON', 'Keep order'],
      ['BUTTON', 'Void order'],
    ]);
  });

  it('sheet-voidorder: the panel beside it holds nothing fired, so the sheet is true of it', () => {
    render('sheet-voidorder');
    expect(panelRows('fired')).toEqual([]);
    expect(panelRows('pending').map((r) => r.querySelector('.order-line__name')!.textContent)).toEqual(['Burger', 'Soda', 'Steak']);
    expect(grandTotal()).toBe('382.725');
  });

  it('sheet-voidorder-fired: MANAGER REQUIRED, the fired count named, three reasons', () => {
    render('sheet-voidorder-fired');
    expect(title()).toBe('Void this order');
    expect(tag()).toBe('MANAGER REQUIRED');
    const notice = sheet()!.querySelector('.notice')!;
    expect(notice.classList.contains('notice--soft')).toBe(false);
    expect(notice.querySelector('.notice__title')!.textContent).toBe('2 lines have already been sent to the kitchen');
    expect(notice.lastElementChild!.textContent).toBe('A cancellation ticket will print covering only that fired work.');
    expect(reasons().map((r) => r.textContent)).toEqual(['Customer left', 'Order taken in error', 'Other — type a reason']);
    expect(sheet()!.querySelector('.void-value')!.textContent).toBe('Order value382.725');
    expect(footControls().map((c) => c.textContent)).toEqual(['Keep order', 'Continue']);
  });
});

// ---- The sheets read the order beside them ----

describe('each sheet agrees with the panel beside it', () => {
  it.each([
    ['sheet-voidorder', undefined],
    ['sheet-voidorder', 'steak'],
    ['sheet-voidorder-fired', undefined],
    ['sheet-voidorder-fired', 'steak'],
  ] as const)('%s, gone=%s: the order value is the panel’s total, and the fired count its fired rows', (state, gone) => {
    render(state, gone);
    expect(sheet()!.querySelector('.void-value__amount')!.textContent).toBe(grandTotal());
    const fired = panelRows('fired').length;
    const notice = sheet()!.querySelector('.notice__title')!.textContent;
    if (fired === 0) expect(notice).toBe('Nothing on this order has been sent to the kitchen');
    else expect(notice).toBe(`${fired} lines have already been sent to the kitchen`);
  });

  it('with the Steak removed, the order value is the artifact’s other figure', () => {
    render('sheet-voidorder-fired', 'steak');
    expect(sheet()!.querySelector('.void-value__amount')!.textContent).toBe('155.925');
  });

  it('sheet-voidline: the card’s line and amount are the panel’s fired Burger row', () => {
    render('sheet-voidline');
    const row = panelRows('fired')[0]!;
    expect(row.querySelector('.order-line__name')!.textContent).toBe('Burger');
    expect(row.querySelector('.order-line__amount')!.textContent).toBe(
      sheet()!.querySelector('.void-subject__row > span:last-child')!.textContent
    );
  });

  it('shownOrder is the panel’s rule: a removal honoured only where there are figures for it', () => {
    expect(shownOrder({ state: 'sheet-voidorder', gone: 'steak' }).totals.total).toBe(155_925n);
    expect(shownOrder({ state: 'sheet-voidorder', gone: 'burger' }).totals.total).toBe(382_725n);
    expect(shownOrder({ state: 'sheet-voidorder', gone: 'burger' }).groups.flatMap((g) => g.lines).map((l) => l.id)).toEqual([
      'burger',
      'soda',
      'steak',
    ]);
  });
});

describe('the order sheet draws whichever variant the order calls for, not the ?state=', () => {
  const orderFixture = VOID_FIXTURES['sheet-voidorder']!;
  const firedFixture = VOID_FIXTURES['sheet-voidorder-fired']!;
  const order = (groups: ReadonlyArray<RoundGroup>, total = 100_000n): ShownOrder => ({
    title: 'Order · T9',
    groups,
    totals: { subtotal: total, total },
  });
  const oneFired = order([
    { kind: 'fired', round: 1, firedAt: '20:00', delivery: 'failed', lines: [line('fired', 'x')] },
    { kind: 'pending', lines: [line('pending', 'y')] },
  ]);
  const nothingFired = order([{ kind: 'pending', lines: [line('pending', 'y')] }]);

  it('the unfired fixture over an order holding fired work is gated', () => {
    renderSheet(orderFixture, oneFired);
    expect(tag()).toBe('MANAGER REQUIRED');
    expect(reasons().length).toBeGreaterThan(0);
    // PROVISIONAL COPY: the artifact counts only two.
    expect(sheet()!.querySelector('.notice__title')!.textContent).toBe('1 line has already been sent to the kitchen');
  });

  it('the fired fixture over an order with nothing fired is not', () => {
    const went = renderSheet(firedFixture, nothingFired);
    expect(tag()).toBeNull();
    expect(reasons()).toEqual([]);
    press(inSheet('Void order'));
    expect(prompt()).toBeNull();
    expect(went).toEqual([{ state: 'default' }]);
  });

  it('a fired round that is not printed makes no difference to the gate or the copy', () => {
    renderSheet(orderFixture, oneFired);
    expect(sheet()!.textContent).not.toMatch(/not printed|printer|printing/i);
  });
});

// ---- FR-H3: void with no prompt ----

describe('FR-H3: an order with nothing fired voids at once (AC-10)', () => {
  it('Void order: no prompt, no reason asked, and the order leaves the sheet', () => {
    render('sheet-voidorder');
    press(inSheet('Void order'));
    expect(prompt()).toBeNull();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('default');
  });
});

// ---- FR-H4: the reason is required ----

describe.each(GATED_STATES)('%s: the reason is required (FR-H4)', (state) => {
  it('opens with no reason chosen, and Continue is not available', () => {
    render(state);
    for (const r of reasons()) expect(r.getAttribute('aria-pressed')).toBe('false');
    expect(commit().tagName).toBe('BUTTON');
    expect(commit().getAttribute('aria-disabled')).toBe('true');
    expect(commit().classList.contains('action--off')).toBe(true);
    expect(buttons(sheet()!).filter((b) => b.getAttribute('aria-disabled') !== 'true').map((b) => b.textContent)).not.toContain('Continue');
    expect(other()).toBeNull();
  });

  it('choosing a reason fills it, and makes Continue a button', () => {
    render(state);
    press(reasons()[0]!);
    expect(reasons()[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(reasons()[0]!.classList.contains('action--primary')).toBe(true);
    expect(reasons().slice(1).map((r) => r.getAttribute('aria-pressed'))).toEqual(reasons().slice(1).map(() => 'false'));
    expect(commit().tagName).toBe('BUTTON');
    expect(commit().textContent).toBe('Continue');
  });

  it('one reason at a time', () => {
    render(state);
    press(reasons()[0]!);
    press(reasons()[1]!);
    expect(reasons().map((r) => r.getAttribute('aria-pressed'))).toEqual(reasons().map((_, i) => String(i === 1)));
  });

  it('Other opens a field and moves focus into it', () => {
    render(state);
    press(inSheet(OTHER_REASON));
    expect(other()).not.toBeNull();
    expect(document.activeElement).toBe(other());
    expect(document.querySelector(`label[for="${other()!.id}"]`)!.textContent).toBe('Reason, in your words');
  });

  it.each(['', '   '])('Other typed %j is not a reason: no prompt, and the field says why', (text) => {
    render(state);
    press(inSheet(OTHER_REASON));
    typeReason(text);
    press(inSheet('Continue'));
    expect(prompt()).toBeNull();
    expect(other()!.classList.contains('void-field--invalid')).toBe(true);
    expect(other()!.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(other()!.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Type a reason, or choose one above.'
    );
    expect(document.activeElement).toBe(other());
  });

  it('the refusal clears as soon as the cashier types or chooses again', () => {
    render(state);
    press(inSheet(OTHER_REASON));
    press(inSheet('Continue'));
    typeReason('d');
    expect(other()!.classList.contains('void-field--invalid')).toBe(false);
    expect(other()!.hasAttribute('aria-invalid')).toBe(false);
  });

  it('a reason typed under Other opens the prompt carrying the cashier’s words', () => {
    render(state);
    press(inSheet(OTHER_REASON));
    typeReason('  Pak Budi’s BBQ order was a duplicate ');
    press(inSheet('Continue'));
    expect(request()).toMatch(/ — reason: Pak Budi’s BBQ order was a duplicate$/);
  });

  it('leaving Other for a listed reason forgets the field', () => {
    render(state);
    press(inSheet(OTHER_REASON));
    typeReason('x');
    press(reasons()[0]!);
    expect(other()).toBeNull();
    press(inSheet('Continue'));
    expect(request()).toMatch(new RegExp(` — reason: ${givenReason({ kind: 'listed', reason: VOID_FIXTURES[state]!.reasons[0]! })}$`));
  });
});

// ---- The prompt: component state, carrying the reason ----

describe('the manager prompt carries the void and its reason', () => {
  it('sheet-voidline: the artifact’s own prompt head, exactly', () => {
    render('sheet-voidline');
    press(inSheet('Customer changed their mind'));
    press(inSheet('Continue'));
    expect(prompt()!.querySelector('#approval-title')!.textContent).toBe('Manager PIN');
    expect(request()).toBe('Void a fired line — Burger 135.000 — reason: customer changed their mind');
  });

  it('sheet-voidorder-fired: the order and its value, with the reason', () => {
    render('sheet-voidorder-fired');
    press(inSheet('Customer left'));
    press(inSheet('Continue'));
    expect(request()).toBe('Void an order holding fired lines — Order · T1 382.725 — reason: customer left');
  });
});

describe('opening the prompt writes no URL and no history (SITEMAP §1)', () => {
  it.each(GATED_STATES)('%s', (state) => {
    render(state);
    press(reasons()[0]!);
    const before = { search: window.location.search, length: window.history.length };
    press(inSheet('Continue'));
    expect(prompt()).not.toBeNull();
    expect(window.location.search).toBe(before.search);
    expect(window.history.length).toBe(before.length);
    expect(window.location.href).not.toMatch(/approval/);
  });

  it('the prompt is over an inert sheet and an inert order', () => {
    render('sheet-voidline');
    press(reasons()[0]!);
    press(inSheet('Continue'));
    expect(sheet()!.closest('[inert]')).not.toBeNull();
    expect(host.querySelector('.order-screen__body')!.hasAttribute('inert')).toBe(true);
    const live = liveControls(device()).map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(live).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Delete last digit', '0', 'Continue', 'Cancel']);
  });

  it('no void source writes an approval state, a route, or the history', () => {
    for (const f of ['VoidSheets.tsx', 'voidFixtures.ts', 'void.ts']) {
      const c = code(f);
      expect(c).not.toMatch(/['"`]approval(-\w+)?['"`]|state=approval/);
      expect(c).not.toMatch(/pushState|replaceState|location\./);
      expect(c).not.toMatch(/APPROVAL_FIXTURES/);
    }
  });
});

describe.each(GATED_STATES)('%s: cancelling the prompt returns to the sheet with nothing changed (B-20)', (state) => {
  it('Cancel: the same sheet, the same reason, the same order, focus on Continue', () => {
    render(state);
    const total = grandTotal();
    press(reasons()[1]!);
    press(inSheet('Continue'));
    press(inPrompt('Cancel'));
    expect(prompt()).toBeNull();
    expect(sheet()!.closest('[inert]')).toBeNull();
    expect(reasons()[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(urlState()).toBe(state);
    expect(grandTotal()).toBe(total);
    expect(document.activeElement).toBe(inSheet('Continue'));
  });

  it('a typed reason survives the cancel too', () => {
    render(state);
    press(inSheet(OTHER_REASON));
    typeReason('Duplicate');
    press(inSheet('Continue'));
    press(inPrompt('Cancel'));
    expect(other()!.value).toBe('Duplicate');
  });

  it('Escape cancels the prompt alone; the sheet stays until a second Escape', () => {
    render(state);
    press(reasons()[0]!);
    press(inSheet('Continue'));
    for (const d of '1234') press(inPrompt(d));
    escape();
    expect(prompt()).toBeNull();
    expect(sheet()).not.toBeNull();
    expect(urlState()).toBe(state);
    escape();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('default');
  });

  it('a second opening starts a fresh pad', () => {
    render(state);
    press(reasons()[0]!);
    press(inSheet('Continue'));
    for (const d of '123') press(inPrompt(d));
    press(inPrompt('Cancel'));
    press(inSheet('Continue'));
    expect(host.querySelectorAll('.pin-dot--filled')).toHaveLength(0);
  });

  it('approved, the void lands on the order', () => {
    render(state);
    press(reasons()[0]!);
    press(inSheet('Continue'));
    approve();
    expect(prompt()).toBeNull();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('default');
  });
});

// ---- B-15, B-16 and FR-H1 on the glass ----

// The artifact's two sentences about printing. Nothing else on a void sheet
// may mention it.
const PRINT_COPY = [
  'A cancellation ticket will print in the kitchen',
  'A cancellation ticket will print covering only that fired work.',
];

describe.each(VOID_STATES)('%s: nothing implies the void waits on a printer (B-15)', (state) => {
  const everyText = () =>
    [...sheet()!.querySelectorAll('*')].flatMap((el) =>
      [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent!.trim())
    );

  function reachAll(check: () => void) {
    render(state);
    check();
    if (state === 'sheet-voidorder') return;
    press(inSheet(OTHER_REASON));
    press(inSheet('Continue')); // refused: the field's refusal is drawn
    check();
  }

  it('the only copy that mentions printing is the artifact’s, word for word', () => {
    reachAll(() => {
      const mentions = everyText().filter((t) => /print/i.test(t));
      for (const t of mentions) expect(PRINT_COPY).toContain(t);
    });
  });

  it('no word of waiting, sending or progress, and no status, progress or live region', () => {
    reachAll(() => {
      expect(sheet()!.textContent).not.toMatch(/printing|printer|printed|waiting|wait for|sending|queued|once .* prints|after .* prints/i);
      expect(sheet()!.querySelector('[role="status"], [role="progressbar"], progress, [aria-live], [aria-busy]')).toBeNull();
    });
  });

  it('nothing here is a refund (FR-H1)', () => {
    reachAll(() => expect(sheet()!.textContent).not.toMatch(/refund/i));
  });
});

describe('B-16: a cancellation covers only the fired work being voided', () => {
  it('sheet-voidorder-fired counts the fired lines, not the pending Steak', () => {
    render('sheet-voidorder-fired');
    expect(panelRows('pending')).toHaveLength(1);
    expect(sheet()!.querySelector('.notice__title')!.textContent).toBe('2 lines have already been sent to the kitchen');
  });

  it('the unfired sheet promises no cancellation ticket at all', () => {
    render('sheet-voidorder');
    expect(sheet()!.textContent).not.toMatch(/cancellation/i);
  });
});

// ---- I-12 still holds ----

describe.each(VOID_STATES)('%s: I-12 still holds', (state) => {
  it('every fired row’s trailing slot is empty; a slot holds only a pending line’s remove control, and it is inert here', () => {
    render(state);
    for (const row of panelRows('fired')) expect(row.querySelector('.order-line__slot')!.childNodes).toHaveLength(0);
    for (const slot of host.querySelectorAll('.order-line__slot')) {
      for (const control of slot.children) {
        expect(control.closest('.order-line')!.getAttribute('data-line-status')).toBe('pending');
        expect(control.className).toBe('order-line__remove');
        expect(control.getAttribute('aria-label')).toMatch(/^Remove /);
        expect(control.matches('button[type="button"]')).toBe(true);
        expect(control.closest('[inert]')).not.toBeNull();
      }
    }
  });

  it('what a slot holds is the removal: with the sheet’s inert lifted, pressing it takes the line off by ?gone=', () => {
    render(state);
    const remove = host.querySelector('.order-line__remove')!;
    device().querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
    press(remove);
    expect(window.location.search).toMatch(/[?&]gone=/);
  });
});

// ---- The panel's void paths carry the actual line and order (FE-009) ----
//
// Every fired row body used to lead to ?state=sheet-voidline, which is the
// Burger's sheet: tapping Soda offered to void the Burger, and behind a real
// command that is a cancellation ticket for work nobody asked to cancel
// (B-16). Void order likewise led to one fixture's order, so the panel changed
// under the cashier. Both now open the sheet as component state over the order
// on screen, for what was tapped.

const cardName = () => sheet()!.querySelector('.void-subject b')!.textContent;
const cardAmount = () => sheet()!.querySelector('.void-subject__row > span:last-child')!.textContent;
const orderValue = () => sheet()!.querySelector('.void-value__amount')!.textContent;
const pressRow = (lineId: string) => press(device().querySelector(lineBody(lineId))!);
const pressVoidOrder = () => press(device().querySelector('.order-actions [data-action="void-order"]')!);

describe('a fired row body opens the void sheet for that line, and no other (acceptance criterion 1)', () => {
  it.each(['default', 'pressed', 'overflow', 'eightysix', 'zero'] as const)('%s: every fired row opens its own line’s sheet', (state) => {
    render(state);
    const fired = panelRows('fired').map((row) => ({
      id: row.dataset.lineId!,
      name: row.querySelector('.order-line__name')!.textContent,
      amount: row.querySelector('.order-line__amount')!.textContent,
    }));
    expect(fired.length).toBeGreaterThan(0);
    for (const row of fired) {
      render(state);
      pressRow(row.id);
      expect(title()).toBe('Void a line already sent to the kitchen');
      expect([cardName(), cardAmount()]).toEqual([row.name, row.amount]);
    }
  });

  it('two different fired rows open two different targets: Soda is not the Burger', () => {
    render('default');
    pressRow('burger');
    const burger = [cardName(), cardAmount()];
    render('default');
    pressRow('soda');
    const soda = [cardName(), cardAmount()];
    expect(burger).toEqual(['Burger', '135.000']);
    expect(soda).toEqual(['Soda', '30.000']);
    expect(soda).not.toEqual(burger);
  });

  it('the manager is asked to approve the line tapped, with its reason, and the void lands back on the same order', () => {
    render('overflow');
    pressRow('of-wings');
    press(inSheet('Kitchen cannot make it'));
    press(inSheet('Continue'));
    expect(request()).toBe('Void a fired line — Chicken Wings 270.000 — reason: kitchen cannot make it');
    approve();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('overflow');
    expect(panelRows('fired')).toHaveLength(6);
  });

  it('opens as component state: the URL and the history are untouched, and the panel behind is inert', () => {
    render('default');
    const before = { search: window.location.search, length: window.history.length };
    pressRow('soda');
    expect(sheet()).not.toBeNull();
    expect({ search: window.location.search, length: window.history.length }).toEqual(before);
    expect(host.querySelector('.order-screen__body')!.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(sheet());
  });

  it('Cancel and Escape close it on the same order, with focus back on the row that opened it', () => {
    for (const close of [() => press(inSheet('Cancel')), escape]) {
      render('overflow');
      pressRow('of-beer');
      close();
      expect(sheet()).toBeNull();
      expect(urlState()).toBe('overflow');
      expect(document.activeElement).toBe(device().querySelector(lineBody('of-beer')));
      expect(device().querySelector('[inert]')).toBeNull();
    }
  });

  it('a second opening is a fresh sheet: no reason carried over from another line', () => {
    render('default');
    pressRow('burger');
    press(inSheet('Sent to the wrong table'));
    press(inSheet('Cancel'));
    pressRow('soda');
    expect(cardName()).toBe('Soda');
    expect(reasons().filter((r) => r.getAttribute('aria-pressed') === 'true')).toEqual([]);
    expect(commit().tagName).toBe('BUTTON');
  });
});

describe('Void order opens the void sheet over the order on screen (acceptance criterion 1)', () => {
  it('default: the order holding fired work, so the gated variant, at the panel’s total', () => {
    render('default');
    pressVoidOrder();
    expect(title()).toBe('Void this order');
    expect(tag()).toBe('MANAGER REQUIRED');
    expect(orderValue()).toBe(grandTotal());
    expect(orderValue()).toBe('382.725');
  });

  it('default with the Steak removed: the panel’s own figure, 155.925', () => {
    render('default', 'steak');
    pressVoidOrder();
    expect(orderValue()).toBe('155.925');
    expect(orderValue()).toBe(grandTotal());
  });

  it('overflow: its own order — six fired lines, not the table order’s two', () => {
    render('overflow');
    pressVoidOrder();
    expect(orderValue()).toBe(grandTotal());
    expect(orderValue()).toBe('1.244.250');
    expect(sheet()!.querySelector('.notice__title')!.textContent).toBe('6 lines have already been sent to the kitchen');
  });

  it('the panel does not change under the cashier: Keep order returns to the same order, focus on Void order', () => {
    render('overflow');
    const rowsBefore = [...host.querySelectorAll('.order-line__name')].map((n) => n.textContent);
    pressVoidOrder();
    expect([...host.querySelectorAll('.order-line__name')].map((n) => n.textContent)).toEqual(rowsBefore);
    press(inSheet('Keep order'));
    expect(urlState()).toBe('overflow');
    expect([...host.querySelectorAll('.order-line__name')].map((n) => n.textContent)).toEqual(rowsBefore);
    expect(document.activeElement!.textContent).toBe('Void order');
  });

  it('the order’s request names the order on screen', () => {
    render('overflow');
    pressVoidOrder();
    press(inSheet('Customer left'));
    press(inSheet('Continue'));
    expect(request()).toBe('Void an order holding fired lines — Order · T1 1.244.250 — reason: customer left');
  });
});

// ---- Dialogs (acceptance criterion 8) ----

describe.each(VOID_STATES)('%s: a dialog', (state) => {
  beforeEach(() => render(state));

  it('is one modal dialog, labelled by its heading, holding focus', () => {
    expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(sheet()!.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(sheet()!.getAttribute('aria-labelledby')!)!.tagName).toBe('H2');
    expect(document.activeElement).toBe(sheet());
  });

  it('every live control is inside it, and every one that acts is a <button type="button">', () => {
    if (state !== 'sheet-voidorder') press(inSheet(OTHER_REASON));
    for (const el of liveControls(device())) expect(sheet()!.contains(el)).toBe(true);
    expect(sheet()!.querySelectorAll('a')).toHaveLength(0);
    for (const el of liveControls(sheet()!).filter((e) => e.id !== 'void-reason-other')) {
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('type')).toBe('button');
    }
    expect(liveControls(sheet()!).filter((e) => e.tagName === 'INPUT')).toHaveLength(state === 'sheet-voidorder' ? 0 : 1);
  });

  it('Escape closes it on the order, with focus on the control that opened it', () => {
    escape();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('default');
    expect(document.activeElement).toBe(device().querySelector(VOID_FIXTURES[state]!.opener));
    expect(device().querySelector('[inert]')).toBeNull();
  });

  it('Cancel or Keep order does the same', () => {
    press(footControls()[0]!);
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('default');
    expect(document.activeElement).toBe(device().querySelector(VOID_FIXTURES[state]!.opener));
  });
});

it('the openers are the fired Burger’s row body and the close bar’s Void order', () => {
  render('default');
  const lineOpener = device().querySelector(VOID_FIXTURES['sheet-voidline']!.opener)!;
  expect(lineOpener.textContent).toContain('Burger');
  expect(lineOpener.matches('button[type="button"]')).toBe(true);
  for (const s of ['sheet-voidorder', 'sheet-voidorder-fired'] as const) {
    const orderOpener = device().querySelector(VOID_FIXTURES[s]!.opener)!;
    expect(orderOpener.textContent).toBe('Void order');
    expect(orderOpener.matches('button[type="button"]')).toBe(true);
  }
  // And each opens what its fixture draws: the Burger's sheet, and the order's.
  press(lineOpener);
  expect(cardName()).toBe('Burger');
  render('default');
  press(device().querySelector(VOID_FIXTURES['sheet-voidorder']!.opener)!);
  expect(title()).toBe('Void this order');
});

// ---- Money ----

it('every amount the void sheets read is a bigint', () => {
  for (const s of VOID_STATES) {
    const { groups, totals } = ORDER_FIXTURES[s];
    const amounts = [...groups.flatMap((g) => g.lines.map((l) => l.amount)), totals.total];
    expect(amounts.filter((a) => typeof a !== 'bigint')).toEqual([]);
  }
});

// ---- Stylesheet ----

describe('pos.css: the void sheets', () => {
  const css = readFileSync(resolve(here, '../src/pos.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const section = css.slice(css.indexOf('.void-flow'), css.indexOf('.fixture-states'));

  it('set no hover and no ring of their own, so the shared pressed ring applies', () => {
    expect(section).not.toMatch(/:hover|:active|box-shadow/);
  });

  it('the invalid field is A7’s', () => {
    expect(section).toMatch(/\.void-field--invalid\s*\{\s*border:\s*var\(--frost-invalid-border\);\s*\}/);
    expect(section).toMatch(/\.void-field__refusal\s*\{[^}]*color:\s*var\(--frost-invalid\)/);
  });
});
