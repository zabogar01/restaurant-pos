// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApprovalPrompt, requestText } from '../src/Approval.js';
import {
  APPROVAL_FIXTURES,
  CANCEL_NOTE,
  type ApprovalFixture,
  type ApprovalRequest,
} from '../src/approvalFixtures.js';
import { OrderScreen } from '../src/OrderPanel.js';
import { ORDER_STATES, type OrderState } from '../src/orderFixtures.js';

// M-1, the manager approval prompt (F2g). B-12 is held in test/pin-pad.test.tsx,
// one test over this pad and the lock screen's. This file holds the rest:
// - the four drawn states, with a wrong PIN and a cashier PIN kept distinct;
// - B-14: the prompt authorises one action and nothing about it persists — no
//   approve-all, no remaining time, no re-use, never a route, a mode or a
//   session, and no input by which a manager's session could skip the PIN;
// - the prompt displays the action and its reason as data it is given;
// - it is a modal dialog over the order screen.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Node 25's experimental localStorage shadows jsdom's under vitest; put jsdom's
// back so a write from the app would land where this file can see it.
const dom = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, { value: dom[name], configurable: true });
}

const here = dirname(fileURLToPath(import.meta.url));
const source = (f: string) => readFileSync(resolve(here, '../src', f), 'utf8');
const code = (f: string) => source(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

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
function render(state: OrderState) {
  window.history.replaceState(null, '', `/pos/order?state=${state}`);
  act(() => root.render(<OrderScreen key={++mount} view={{ state }} />));
}

/** Moves the one mounted OrderScreen to a state as the browser's Back or Forward would. */
function visit(state: OrderState) {
  window.history.pushState(null, '', `/pos/order?state=${state}`);
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
}

const APPROVAL_STATES = ['approval', 'approval-error', 'approval-throttled', 'approval-denied'] as const;

const device = () => host.querySelector('.pos-device')!;
const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]');
const urlState = () => new URLSearchParams(window.location.search).get('state') ?? 'default';
const press = (el: Element) => act(() => (el as HTMLElement).click());
const control = (name: string) =>
  [...dialog()!.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!;
const type = (digits: string) => {
  for (const d of digits) press(control(d));
};
const filledDots = () => host.querySelectorAll('.pin-dot--filled').length;
const noticeText = () => dialog()!.querySelector('.notice')?.textContent ?? null;
/** Each run of text on its own. textContent glues neighbours together ("30 s" + "1" is "30 s1"), which hides a word boundary. */
const texts = (el: Element) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  while (walker.nextNode()) out.push(walker.currentNode.nodeValue!);
  return out;
};
const escape = () => act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

/** Everything a finger or keyboard can operate: not inside an inert subtree. */
function liveControls(container: ParentNode): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => !el.closest('[inert]'));
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Delete last digit', '0', 'Continue'];
const REQUEST = 'Void a fired line — Burger 135.000 — reason: customer changed their mind';
const BURGER_ROW = '.order-line[data-line-status="fired"] > .order-line__target';

describe('the four states the artifact draws', () => {
  it('serves exactly approval, approval-error, approval-throttled and approval-denied', () => {
    expect(Object.keys(APPROVAL_FIXTURES)).toEqual([...APPROVAL_STATES]);
    for (const s of APPROVAL_STATES) expect(ORDER_STATES.map((o) => o.id)).toContain(s);
  });

  it.each(APPROVAL_STATES)('%s: one modal dialog, headed Manager PIN, showing what is being approved', (state) => {
    render(state);
    expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(host.querySelector('.sheet')).toBeNull();
    expect(dialog()!.querySelector('h2')!.textContent).toBe('Manager PIN');
    expect(document.getElementById(dialog()!.getAttribute('aria-describedby')!)!.textContent).toBe(REQUEST);
  });

  it('approval: awaiting the PIN — six empty dots, the keypad, no notice', () => {
    render('approval');
    expect(host.querySelectorAll('.pin-dot')).toHaveLength(6);
    expect(filledDots()).toBe(0);
    expect(noticeText()).toBeNull();
    expect(control('Continue').getAttribute('aria-disabled')).toBeNull();
  });

  it('approval-error: a wrong credential, with the attempts left', () => {
    render('approval-error');
    expect(noticeText()).toBe(
      'PIN not recognised' + '3 attempts remaining before manager approvals are locked for five minutes.'
    );
  });

  it('approval-throttled: five failures, the cooldown counted down, and a cashier sign-in does not clear it', () => {
    render('approval-throttled');
    expect(noticeText()).toBe(
      'Manager approvals locked for 4 min 38 s' +
        'Five failed approval attempts. Signing in as a cashier does not clear this.'
    );
  });

  it('approval-denied: a valid credential of the wrong authority, and the attempt is on record', () => {
    render('approval-denied');
    expect(noticeText()).toBe('That PIN is not a manager' + 'This action needs a manager. The attempt has been recorded.');
  });

  it('a wrong PIN and a cashier PIN are different failures, in title, body and meaning', () => {
    const error = APPROVAL_FIXTURES['approval-error']!.notice!;
    const denied = APPROVAL_FIXTURES['approval-denied']!.notice!;
    expect(error.title).not.toBe(denied.title);
    expect(error.body).not.toBe(denied.body);
    // One is about the credential, the other about its authority.
    expect(error.title + error.body).not.toMatch(/manager\b(?! approvals)|not a manager|recorded/i);
    expect(denied.title + denied.body).not.toMatch(/recognised|attempts remaining/i);
  });
});

describe('approval-throttled: the confirm key is drawn inert, as the lock screen’s cooldown draws it', () => {
  beforeEach(() => render('approval-throttled'));

  it('Continue is aria-disabled and styled unavailable', () => {
    expect(control('Continue').getAttribute('aria-disabled')).toBe('true');
    expect(control('Continue').classList.contains('key--continue-disabled')).toBe(true);
  });

  it('pressing it approves nothing: the prompt stays and the order is untouched', () => {
    type('123456');
    press(control('Continue'));
    expect(dialog()).not.toBeNull();
    expect(urlState()).toBe('approval-throttled');
    expect(filledDots()).toBe(6);
  });

  it('it is the only state that draws Continue inert', () => {
    for (const s of APPROVAL_STATES.filter((x) => x !== 'approval-throttled')) {
      render(s);
      expect(control('Continue').getAttribute('aria-disabled')).toBeNull();
    }
  });
});

describe.each(APPROVAL_STATES)('%s: a modal over the order screen, never a route', (state) => {
  beforeEach(() => render(state));

  it('is labelled by its heading and takes focus when it opens', () => {
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    const label = document.getElementById(dialog()!.getAttribute('aria-labelledby')!)!;
    expect(label.tagName).toBe('H2');
    expect(dialog()!.contains(label)).toBe(true);
    expect(document.activeElement).toBe(dialog());
  });

  it('sits inside the order screen’s frame, over it, on /pos/order', () => {
    expect(device().contains(dialog())).toBe(true);
    expect(device().querySelector('.modal-scrim')).not.toBeNull();
    expect(window.location.pathname).toBe('/pos/order');
  });

  it('leaves the order drawn behind it, and every part of it inert', () => {
    expect([...host.querySelectorAll('.order-line__name')].map((n) => n.textContent)).toEqual(['Burger', 'Soda', 'Steak']);
    expect(host.querySelector('.order-screen__body')!.hasAttribute('inert')).toBe(true);
    expect(host.querySelector('.order-screen__bar')!.hasAttribute('inert')).toBe(true);
  });

  it('every live control on the frame is in the dialog: the twelve keys and Cancel, and nothing else', () => {
    const live = liveControls(device());
    for (const el of live) expect(dialog()!.contains(el)).toBe(true);
    expect(live.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([...KEYS, 'Cancel']);
  });

  it('every control is a <button type="button">, and none is a link', () => {
    expect(dialog()!.querySelectorAll('a')).toHaveLength(0);
    for (const el of liveControls(dialog()!)) {
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('type')).toBe('button');
    }
  });

  it('draws the approval dialog’s keypad, not the lock screen’s', () => {
    expect(dialog()!.querySelector('.keypad')!.className).toBe('keypad keypad--approval');
  });
});

describe.each(APPROVAL_STATES)('%s: closing', (state) => {
  it('Cancel lands on the order unchanged, with focus on the row the void began from', () => {
    render(state);
    type('12');
    press(control('Cancel'));
    expect(dialog()).toBeNull();
    expect(urlState()).toBe('default');
    expect(document.activeElement).toBe(device().querySelector(BURGER_ROW));
    expect(document.activeElement!.textContent).toContain('Burger');
    expect(device().querySelector('[inert]')).toBeNull();
  });

  it('Escape does the same', () => {
    render(state);
    escape();
    expect(dialog()).toBeNull();
    expect(urlState()).toBe('default');
    expect(document.activeElement).toBe(device().querySelector(BURGER_ROW));
  });

  it('leaving replaces the prompt’s history entry: a modal is not back-stackable (SITEMAP §1)', () => {
    render(state);
    const length = window.history.length;
    press(control('Cancel'));
    expect(window.history.length).toBe(length);
  });
});

describe('the footer says what the artifact says, and nothing that contradicts the record', () => {
  it.each(APPROVAL_STATES)('%s', (state) => {
    render(state);
    expect(dialog()!.querySelector('.modal__note')!.textContent).toBe(CANCEL_NOTE);
    // FR-J3, AC-18: a cancelled approval is an audit entry. Nothing on the prompt
    // may say it goes unrecorded.
    expect(texts(dialog()!).join('\n')).not.toMatch(/not (be )?recorded|no record|nothing (is|was|will be) (recorded|logged|saved)|not logged|not audited/i);
  });
});

describe('the action and its reason are data the prompt is given', () => {
  it('formats the artifact’s request from its parts, with the amount a bigint', () => {
    const request = APPROVAL_FIXTURES.approval!.request;
    expect(typeof request.subject!.amount).toBe('bigint');
    expect(requestText(request)).toBe(REQUEST);
  });

  it('shows whatever it is given, and collects none of it: there is no field in the prompt', () => {
    const given: ApprovalFixture = {
      ...APPROVAL_FIXTURES.approval!,
      request: { action: 'refund', description: 'Refund order 1042', subject: { name: 'Table 7', amount: 155_925n }, reason: 'wrong card charged' },
    };
    act(() => root.render(<ApprovalPrompt approval={given} go={() => {}} />));
    expect(dialog()!.querySelector('#approval-request')!.textContent).toBe(
      'Refund order 1042 — Table 7 155.925 — reason: wrong card charged'
    );
    expect(dialog()!.querySelectorAll('input, textarea, select, [contenteditable]')).toHaveLength(0);
  });

  it('omits a reason where the PRD asks for none, and a subject where there is none', () => {
    expect(requestText({ action: 'free-form-discount', description: 'Free-form discount' })).toBe('Free-form discount');
  });

  it('requires a reason for a fired-line void, a fired-order void and a refund (FR-H4, FR-H5)', () => {
    // Type-checked by `npm run typecheck`: each missing reason is a compile error.
    // @ts-expect-error a fired-line void needs a reason
    const a: ApprovalRequest = { action: 'void-fired-line', description: 'Void a fired line' };
    // @ts-expect-error a void of an order holding a fired line needs a reason
    const b: ApprovalRequest = { action: 'void-fired-order', description: 'Void this order' };
    // @ts-expect-error a refund needs a reason
    const c: ApprovalRequest = { action: 'refund', description: 'Refund' };
    const d: ApprovalRequest = { action: 'lease-takeover', description: 'Take over checkout' };
    expect([a, b, c, d]).toHaveLength(4);
  });

  it('every fixture whose action needs a reason carries a non-blank one', () => {
    for (const f of Object.values(APPROVAL_FIXTURES)) {
      if (['void-fired-line', 'void-fired-order', 'refund'].includes(f.request.action)) {
        expect(f.request.reason?.trim()).toBeTruthy();
      }
    }
  });
});

describe('B-14: one action, at the moment it is given, and nothing persists', () => {
  it('no approve-all: the only controls are the keypad and Cancel, and no copy offers to batch', () => {
    for (const s of APPROVAL_STATES) {
      render(s);
      expect(liveControls(dialog()!)).toHaveLength(KEYS.length + 1);
      expect(texts(dialog()!).join('\n')).not.toMatch(
        /approve all|apply to (all|every|the rest)|rest of (this|the) order|all lines|remember|keep me|stay (signed|approved)|don.t ask|next (action|time)|for this (shift|session)|manager (is )?(here|present)/i
      );
    }
  });

  it('no remaining-time indicator on the approval: nothing time-shaped, no timer, no progress', () => {
    const timeShaped = /\d+\s*(min|mins|minutes?|s|sec|seconds?)\b|\d+:\d\d/i;
    for (const s of APPROVAL_STATES) {
      render(s);
      expect(dialog()!.querySelectorAll('progress, meter, time, [role="timer"], [role="progressbar"], .verifying__bar')).toHaveLength(0);
      const throttle = s === 'approval-throttled' ? dialog()!.querySelector('.notice') : null;
      const outsideThrottle = texts(dialog()!).filter((t) => !throttle || !texts(throttle).includes(t));
      expect(outsideThrottle.filter((t) => timeShaped.test(t))).toEqual([]);
    }
  });

  it('the only time on the prompt is the throttle’s cooldown, which times the lock, not an approval', () => {
    for (const s of APPROVAL_STATES) {
      render(s);
      const times = texts(dialog()!).flatMap((t) => [...t.matchAll(/\d+\s*min\s*\d+\s*s|\d+\s*(min|s)\b/g)].map((m) => m[0]));
      expect(times).toEqual(s === 'approval-throttled' ? ['4 min 38 s'] : []);
    }
  });

  it('no re-use: after one approval, the next gated action asks for a PIN from nothing', () => {
    render('approval');
    type('123456');
    press(control('Continue'));
    expect(dialog()).toBeNull();
    expect(urlState()).toBe('default');

    visit('approval');
    expect(dialog()).not.toBeNull();
    expect(filledDots()).toBe(0);
    expect(liveControls(dialog()!).map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([...KEYS, 'Cancel']);
    expect(control('Continue').getAttribute('aria-disabled')).toBeNull();
  });

  it('no carry: digits entered and cancelled are gone when the prompt next opens, in any state', () => {
    render('approval');
    type('1234');
    press(control('Cancel'));
    for (const s of APPROVAL_STATES) {
      visit(s);
      expect(filledDots()).toBe(0);
    }
  });

  it('a failed attempt carries nothing into the next prompt either', () => {
    render('approval-denied');
    type('12345');
    visit('approval-error');
    expect(filledDots()).toBe(0);
  });

  it('nothing is kept anywhere after an approval: no storage, no cookie, and the URL names only the order', () => {
    render('approval');
    type('654321');
    press(control('Continue'));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
    expect(window.location.search).toBe('?state=default');
  });

  it('never a route: the client has no path to the prompt but the order screen it opens over', () => {
    expect(source('main.tsx')).not.toMatch(/approval/i);
  });

  it('never a session: the prompt takes no input that could stand in for the PIN', () => {
    const fixture = APPROVAL_FIXTURES.approval!;
    // FR-A2c, AC-27. Neither the prompt nor its fixture has a field for who is
    // at the terminal, so there is nothing a back-office session could fill.
    act(() =>
      root.render(
        // @ts-expect-error the prompt has no session input
        <ApprovalPrompt approval={fixture} go={() => {}} session="back-office" />
      )
    );
    // Handed one anyway, it still asks.
    expect(dialog()!.querySelectorAll('.keypad > button.key')).toHaveLength(12);
    expect(filledDots()).toBe(0);
    // @ts-expect-error nor a manager-present flag
    const skipping: ApprovalFixture = { ...fixture, managerPresent: true };
    expect(skipping).toBeTruthy();

    for (const f of Object.values(APPROVAL_FIXTURES)) {
      expect(Object.keys(f).every((k) => ['request', 'notice', 'throttled', 'opener', 'cancel', 'approve'].includes(k))).toBe(true);
      expect(Object.keys(f.request).every((k) => ['action', 'description', 'subject', 'reason'].includes(k))).toBe(true);
    }
  });

  it('every state of the prompt asks for a PIN: there is no state without the pad', () => {
    for (const s of APPROVAL_STATES) {
      render(s);
      expect(dialog()!.querySelectorAll('.keypad > button.key')).toHaveLength(12);
      expect(dialog()!.querySelectorAll('.pin-dot')).toHaveLength(6);
    }
  });
});

// The same properties as source facts, because a timer, a cache or a session
// check is easiest to add in a file no rendering test happens to exercise.
const BANNED = [
  /\bset(Timeout|Interval)\s*\(/,
  /\brequestAnimationFrame\s*\(/,
  /\bDate\b|\bperformance\.now\b/,
  /\bsession\b|\baudience\b|\bcookie\b|back.?office|\bmanagerPresent\b|\bisManager\b/i,
  /\b(cache|cached|remember|expires?|ttl|lifetime|token)\b/i,
];
const MODULE_STATE = /^(export\s+)?(let|var)\s|^(export\s+)?const\s+\w+\s*=\s*new\s+(Map|Set|WeakMap|WeakSet)\b/m;
const offences = (text: string) => [...BANNED.filter((re) => re.test(text)).map(String), ...(MODULE_STATE.test(text) ? ['module state'] : [])];

describe('the source detector can see what it bans', () => {
  it('flags a timer, a clock, a session check, a cache and module-level state', () => {
    expect(offences('setTimeout(() => go(x), 1000)')).toHaveLength(1);
    expect(offences('const at = Date.now();')).toHaveLength(1);
    expect(offences('if (props.session === "BACK_OFFICE") skip();')).toHaveLength(1);
    expect(offences('const cached = lastApproval;')).toHaveLength(1);
    expect(offences('let lastApproval = null;')).toEqual(['module state']);
    expect(offences('export const seen = new Set();')).toEqual(['module state']);
  });

  it('passes ordinary code', () => {
    expect(offences('const box = useRef(null);\nfunction press(d) { digits.current += d; }')).toEqual([]);
  });
});

describe.each(['Approval.tsx', 'approvalFixtures.ts', 'PinPad.tsx'])('%s holds no timer, clock, session, cache or module state', (file) => {
  it('outside comments', () => {
    expect(offences(code(file))).toEqual([]);
  });
});

describe('the approval keypad is the reviewed approval geometry, and the lock pad keeps its own', () => {
  const css = readFileSync(resolve(here, '../src/pos.css'), 'utf8');
  const rule = (selector: string) => {
    const m = css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
    return m?.[2] ?? '';
  };

  it('three 72px columns of 72px keys, from the registry', () => {
    expect(rule('.keypad--approval')).toMatch(/grid-template-columns:\s*var\(--frost-approval-columns\)/);
    expect(rule('.keypad--approval .key')).toMatch(/height:\s*var\(--frost-approval-key-height\)/);
  });

  it('the lock screen’s keys are still 88 by 88', () => {
    expect(rule('.keypad')).toMatch(/grid-template-columns:\s*var\(--frost-pin-columns\)/);
    expect(rule('.key')).toMatch(/height:\s*var\(--frost-pin-key-height\)/);
  });

  it('the modal is the reviewed 560px on the scrim, bounded by the overlay line', () => {
    expect(rule('.modal')).toMatch(/width:\s*var\(--frost-modal-width\)/);
    expect(rule('.modal')).toMatch(/border:\s*var\(--frost-overlay-border\)/);
    expect(rule('.modal-scrim')).toMatch(/background:\s*var\(--frost-scrim\)/);
  });
});

describe('reachability: nothing on the prompt leads anywhere gated but back to the order', () => {
  const GATED = ['sheet-voidline', 'sheet-voidorder', 'sheet-voidorder-fired', 'sheet-freeform', 'sheet-remove', 'sheet-discount'];

  it.each(APPROVAL_STATES)('%s', (state) => {
    render(state);
    const count = liveControls(device()).length;
    for (let i = 0; i < count; i++) {
      render(state);
      press(liveControls(device())[i]!);
      expect(GATED).not.toContain(urlState());
      expect([state, 'default']).toContain(urlState());
    }
  });
});
