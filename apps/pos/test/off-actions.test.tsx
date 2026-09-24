// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.js';
import { LOCK_STATES } from '../src/fixtures.js';
import { ORDER_STATES } from '../src/orderFixtures.js';
import { PosRoutes } from '../src/PosRoutes.js';
import { SETTLEMENT_STATES } from '../src/SettlementScreen.js';

// FE-024: an action that is off is still an action. A <button type="button">
// with aria-disabled="true", never `disabled`, never a span or div; a press
// does nothing; aria-describedby points at the reason wherever one is drawn.
//
// Criterion 4 is the guard and is derived: it walks every ORDER_STATES id, every
// settlement state and every lock state and applies the rule to whatever is
// drawn, so the next off action cannot slip past a hand list (FE-021, FE-022).

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

function order(state: string) {
  window.history.replaceState(null, '', `/pos/order?state=${state}`);
  act(() => root.render(<PosRoutes key={++mount} />));
}
function settlement(state: string) {
  window.history.replaceState(null, '', `/pos/settlement?state=${state}`);
  act(() => root.render(<PosRoutes key={++mount} />));
}
function lock(state: (typeof LOCK_STATES)[number]['id']) {
  act(() => root.render(<App key={++mount} state={state} />));
}

const q = (selector: string) => host.querySelector<HTMLElement>(selector)!;
const named = (name: string) =>
  [...host.querySelectorAll<HTMLElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!;

type Row = {
  name: string;
  setup: () => void;
  find: () => HTMLElement;
  /**
   * undefined: the screen draws no reason here, so there is no aria-describedby.
   * A string: aria-describedby must resolve, and the target must contain it.
   */
  reason?: string;
};

const ROWS: ReadonlyArray<Row> = [
  { name: 'stepper − at 1 (item sheet)', setup: () => order('sheet-item'), find: () => named('Decrease quantity'), reason: 'Minimum 1' },
  {
    name: 'stepper + at 99 (item sheet)',
    setup: () => {
      order('sheet-item');
      for (let i = 0; i < 98; i++) press(named('Increase quantity'));
    },
    find: () => named('Increase quantity'),
    reason: 'Maximum 99',
  },
  { name: 'stepper − at 1 (line sheet)', setup: () => order('sheet-line'), find: () => named('Decrease quantity'), reason: 'Minimum 1' },
  { name: 'Update to n, unchanged', setup: () => order('sheet-line'), find: () => q('[data-action="update-quantity"]') },
  { name: 'Add to order, item 86’d', setup: () => order('sheet-item86'), find: () => named('Add to order'), reason: 'no longer available' },
  { name: '86’d tile', setup: () => order('eightysix'), find: () => q('.menu-tile--off'), reason: '86' },
  { name: 'Send to kitchen, fire refused', setup: () => order('fireblocked'), find: () => q('.order-actions [data-action="fire"]'), reason: 'Cannot send to the kitchen' },
  { name: 'Send to kitchen, locked', setup: () => order('lock-draft'), find: () => q('.order-actions .action--off') },
  { name: 'void Continue, no reason chosen', setup: () => order('sheet-voidline'), find: () => named('Continue') },
  { name: 'Add tender, nothing left', setup: () => settlement('exact'), find: () => q('[data-action="add-tender"]') },
  { name: 'Close, pending line', setup: () => settlement('pending'), find: () => q('[data-action="close-order"]'), reason: 'not been sent' },
  { name: 'Close, balance outstanding', setup: () => settlement('partial'), find: () => q('[data-action="close-order"]') },
  { name: 'Close, closing', setup: () => settlement('loading'), find: () => q('[data-action="close-order"]') },
  { name: 'approval Continue, cooldown', setup: () => order('approval-throttled'), find: () => named('Continue'), reason: 'Manager approvals locked' },
  {
    // A digit is keyed first, so an unguarded submit would clear the dots and fail the snapshot.
    name: 'lock Continue, cooldown, with a digit keyed',
    setup: () => {
      lock('throttled');
      press(named('1'));
    },
    find: () => named('Continue'),
    reason: 'Sign-in locked',
  },
  { name: 'Send to kitchen, empty order', setup: () => order('empty'), find: () => q('.order-actions [data-action="fire"]') },
  // `overflow` has pending lines, so its Send is live; the overflow state where Send is off is the refused one.
  { name: 'Send to kitchen, fireblocked-overflow', setup: () => order('fireblocked-overflow'), find: () => q('.order-actions [data-action="fire"]'), reason: 'Cannot send to the kitchen' },
  { name: 'Send to kitchen, lock-lease', setup: () => order('lock-lease'), find: () => q('.order-actions [data-action="fire"]') },
  { name: 'Settle, locked', setup: () => order('lock-draft'), find: () => q('.order-actions [data-action="settle"]') },
  { name: 'Settle, empty order', setup: () => order('empty'), find: () => q('.order-actions [data-action="settle"]') },
];

/** Everything a press could change: the page, the history, the drawn screen (pressed state and store included), focus. */
const snapshot = () => ({
  href: window.location.href,
  history: window.history.length,
  html: host.innerHTML,
  focus: document.activeElement,
});

describe('FE-024 criteria 1 to 3: every off action, in the state where it is off', () => {
  describe.each(ROWS)('$name', (row) => {
    beforeEach(() => row.setup());

    it('is a button with aria-disabled, no disabled attribute, and stays in the tab order', () => {
      const el = row.find();
      expect(el).toBeTruthy();
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('type')).toBe('button');
      expect(el.getAttribute('aria-disabled')).toBe('true');
      expect(el.hasAttribute('disabled')).toBe(false);
      expect(el.tabIndex).not.toBe(-1);
    });

    it('does nothing on click, and no key handler acts on Enter or Space', () => {
      const el = row.find();
      el.focus();
      const before = snapshot();
      // A native button is activated by Enter and Space through its click, which is the press above.
      // The key events below can only catch a key handler that acts on its own.
      press(el);
      act(() => {
        for (const key of ['Enter', ' ']) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
        }
      });
      expect(snapshot()).toEqual(before);
    });

    it('aria-describedby resolves to the drawn reason, and is absent where none is drawn', () => {
      const ids = row.find().getAttribute('aria-describedby');
      if (row.reason === undefined) {
        expect(ids).toBeNull();
        return;
      }
      expect(ids).not.toBeNull();
      for (const id of ids!.split(/\s+/)) {
        const target = host.querySelector(`[id="${id}"]`);
        expect(target, `#${id} exists`).not.toBeNull();
        expect(target!.textContent).toContain(row.reason);
      }
    });
  });
});

describe('FE-024 criterion 3: an off action with a drawn reason points at it', () => {
  // The off Add describes itself by the field message and the refusal notice
  // only. The caption is entry help, not a reason (lead's ruling, round 2).
  it.each([...SETTLEMENT_STATES])('POS-04 state %s: an off Add names exactly the reasons drawn, never the help text', (state) => {
    settlement(state);
    const add = q('[data-action="add-tender"]');
    if (!add || add.getAttribute('aria-disabled') !== 'true') return;
    const ids = (add.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    const drawn = ['tender-field-message', 'tender-refusal-notice'].filter((id) => host.querySelector(`[id="${id}"]`));
    expect(ids).toEqual(drawn);
    for (const id of ids) expect(host.querySelector(`[id="${id}"]`)!.textContent!.trim().length).toBeGreaterThan(0);
    const help = host.querySelector('.tender-help');
    if (help) expect(ids).not.toContain(help.id);
  });

  it('the off Add really is off with a reason drawn in some state, so the loop above is not vacuous', () => {
    const withReason = SETTLEMENT_STATES.filter((state) => {
      settlement(state);
      const add = q('[data-action="add-tender"]');
      return add?.getAttribute('aria-disabled') === 'true' && add.hasAttribute('aria-describedby');
    });
    expect(withReason.length).toBeGreaterThan(0);
  });
});

// This walk sees each state as it first draws. An off state reached only by
// pressing (the + at 99, a tender that turns over-limit after keying) is the
// table's job above, not this walk's.
//
// The rule, derived from the DOM rather than listed. An element wearing an off
// class is an off action and must obey the rule whether or not it also carries
// aria-disabled; an aria-disabled element must be a button; nothing carries
// `disabled`. A new off action is caught by whichever it breaks.
const OFF_CLASS = /(?:^|\s)[\w-]*(?:--off|-disabled)(?:\s|$)/;

function offences(): string[] {
  const found: string[] = [];
  const at = (el: Element) => `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`;
  for (const el of host.querySelectorAll('[disabled]')) found.push(`disabled attribute: ${at(el)}`);
  for (const el of host.querySelectorAll('[aria-disabled]')) {
    if (el.tagName !== 'BUTTON') found.push(`aria-disabled on a non-button: ${at(el)}`);
  }
  for (const el of host.querySelectorAll('*')) {
    if (!OFF_CLASS.test(el.getAttribute('class') ?? '')) continue;
    if (el.tagName !== 'BUTTON') found.push(`off styling on a non-button: ${at(el)}`);
    else if (el.getAttribute('aria-disabled') !== 'true') found.push(`off styling without aria-disabled: ${at(el)}`);
    else if ((el as HTMLElement).tabIndex === -1) found.push(`off but out of the tab order: ${at(el)}`);
  }
  return found;
}

describe('FE-024 criterion 4: no state draws an off action that is not a focusable button', () => {
  it.each(ORDER_STATES.map((s) => s.id))('POS-03 state %s', (id) => {
    order(id);
    expect(offences()).toEqual([]);
  });

  it.each([...SETTLEMENT_STATES])('POS-04 state %s', (state) => {
    settlement(state);
    expect(offences()).toEqual([]);
  });

  it.each(LOCK_STATES.map((s) => s.id))('lock state %s', (id) => {
    lock(id);
    expect(offences()).toEqual([]);
  });
});
