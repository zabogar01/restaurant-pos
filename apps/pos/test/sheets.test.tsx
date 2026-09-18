// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OrderScreen } from '../src/OrderPanel.js';
import { ORDER_STATES, type OrderState } from '../src/orderFixtures.js';
import { APPROVAL_FIXTURES } from '../src/approvalFixtures.js';
import { DISCOUNT_FIXTURES } from '../src/discountFixtures.js';
import { QUANTITY_MAX, SHEET_FIXTURES, unitPrice, type ItemSheetFixture } from '../src/sheetFixtures.js';

// POS-03's ungated sheets (F2c). Three properties are the point:
// - no control in any F2c state reaches a PIN-gated state (I-12, B-16: a gated
//   action is never reachable from a position an ungated one has taught, and
//   paper cannot be un-printed);
// - in sheet-item86 the cashier's selections stay and nothing adds the line;
// - a sheet is a dialog: focus moves in, and Cancel, Back or Escape hand it back.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

// A fresh mount every time: OrderScreen holds its view in state, so a second
// render into the same root after a press would keep the pressed-to view.
let mount = 0;
function render(state: OrderState) {
  window.history.replaceState(null, '', `/pos/order?state=${state}`);
  act(() => root.render(<OrderScreen key={++mount} view={{ state }} />));
}

const device = () => host.querySelector('.pos-device')!;
const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]');
const urlState = () => new URLSearchParams(window.location.search).get('state') ?? 'default';
const press = (el: Element) => act(() => (el as HTMLElement).click());
const buttonNamed = (name: string) =>
  [...dialog()!.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!;

// F2c as the task file lists it. Four were held pending a lead ruling, because
// the inventory makes each one carry a gated path (see the FE-005 handoff), and
// F2i (FE-007) now serves them; test/discount.test.tsx is theirs. The
// reachability check below also runs over F2i's four sheets, restated for a
// gated family: a gated control opens the prompt in place and writes no URL,
// so every URL a control leaves behind is still somewhere ungated.
const F2C_STATES = ['sheet-item', 'sheet-item86', 'sheet-line', 'sheet-discount', 'sheet-freeform', 'sheet-remove', 'zero'];
const HELD = ['sheet-discount', 'sheet-freeform', 'sheet-remove', 'zero'];
const served = (s: string): s is OrderState => ORDER_STATES.some((o) => o.id === s);
const BUILT = F2C_STATES.filter((s) => !HELD.includes(s)).filter(served);
const F2I_SHEETS = Object.keys(DISCOUNT_FIXTURES) as OrderState[];

const GATED = [
  'sheet-voidline',
  'sheet-voidorder',
  'sheet-voidorder-fired',
  'approval',
  'approval-error',
  'approval-throttled',
  'approval-denied',
];

/** Everything on the frame a finger or a keyboard can operate: not inside an inert subtree. */
function liveControls(container: ParentNode): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => !el.closest('[inert]'));
}

const hrefState = (href: string) => new URLSearchParams(href.split('?')[1] ?? '').get('state') ?? 'default';

/**
 * Where each live control on the frame leads. An anchor by its href; a button by
 * pressing it, on a fresh render, and reading the URL it leaves behind.
 */
function destinations(state: OrderState, prepare: () => void = () => {}): string[] {
  render(state);
  prepare();
  const count = liveControls(device()).length;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    render(state);
    prepare();
    const el = liveControls(device())[i]!;
    if (el.tagName === 'A') {
      out.push(hrefState(el.getAttribute('href')!));
    } else {
      press(el);
      out.push(urlState());
    }
  }
  return out;
}

const stripInert = () => device().querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));

describe('the F2c states', () => {
  it('serves the three it built, and the four it held are served now by F2i', () => {
    expect(BUILT).toEqual(['sheet-item', 'sheet-item86', 'sheet-line']);
    expect(HELD.filter(served)).toEqual(HELD);
  });
});

describe('the reachability detector can see a gated path', () => {
  it('finds the panel’s void paths once the background is no longer inert', () => {
    const found = destinations('sheet-item', stripInert);
    expect(found).toContain('sheet-voidline');
    expect(found).toContain('sheet-voidorder');
  });

  it('ignores a control inside an inert subtree, and nothing else', () => {
    const box = document.createElement('div');
    box.innerHTML = '<div inert><a href="?state=approval">x</a></div><button>y</button><a href="?state=sheet-voidline">z</a>';
    expect(liveControls(box).map((e) => e.textContent)).toEqual(['y', 'z']);
  });
});

describe.each([...BUILT, ...F2I_SHEETS])('%s: no control reaches a PIN-gated state (acceptance criterion 1)', (state) => {
  it('every live control on the frame leads somewhere ungated', () => {
    const found = destinations(state);
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((d) => GATED.includes(d))).toEqual([]);
  });

  it('every live control on the frame is inside the sheet', () => {
    render(state);
    for (const el of liveControls(device())) expect(dialog()!.contains(el)).toBe(true);
  });

  it('the panel’s void paths are still drawn behind it, and inert', () => {
    render(state);
    const voidPaths = device().querySelectorAll('a[href="?state=sheet-voidline"], a[href="?state=sheet-voidorder"]');
    expect(voidPaths.length).toBeGreaterThan(0);
    for (const a of voidPaths) expect(a.closest('[inert]')).not.toBeNull();
  });

  it('the panel stays legible beside the sheet', () => {
    render(state);
    expect([...host.querySelectorAll('.order-line__name')].map((n) => n.textContent)).toEqual(['Burger', 'Soda', 'Steak']);
    expect(host.querySelector('.totals')).not.toBeNull();
  });
});

describe.each(BUILT)('%s: a dialog (acceptance criteria 4 and 5)', (state) => {
  beforeEach(() => render(state));

  it('is one modal dialog labelled by its heading', () => {
    expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    const label = document.getElementById(dialog()!.getAttribute('aria-labelledby')!)!;
    expect(label.tagName).toBe('H2');
    expect(dialog()!.contains(label)).toBe(true);
  });

  it('takes focus when it opens', () => {
    expect(document.activeElement).toBe(dialog());
  });

  it('every control in it is a <button type="button">, and none is a link', () => {
    expect(dialog()!.querySelectorAll('a')).toHaveLength(0);
    for (const el of liveControls(dialog()!)) {
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('type')).toBe('button');
    }
  });
});

describe.each([
  ['sheet-item', 'Cancel', 'default'],
  ['sheet-item86', 'Cancel', 'default'],
  ['sheet-line', 'Back', 'eightysix'],
] as const)('%s: closing hands focus back to the opener', (state, closeName, lands) => {
  const opener = SHEET_FIXTURES[state]!.opener;

  it(`${closeName} closes it on ${lands}, with focus on the control that opened it`, () => {
    render(state);
    press(buttonNamed(closeName));
    expect(dialog()).toBeNull();
    expect(urlState()).toBe(lands);
    expect(document.activeElement).toBe(device().querySelector(opener));
    expect(device().querySelector('[inert]')).toBeNull();
  });

  it('Escape does the same', () => {
    render(state);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(dialog()).toBeNull();
    expect(urlState()).toBe(lands);
    expect(document.activeElement).toBe(device().querySelector(opener));
  });
});

it('each opener is a control in the state the sheet closes to', () => {
  render('default');
  expect(device().querySelector(SHEET_FIXTURES['sheet-item']!.opener)!.tagName).toBe('A');
  render('eightysix');
  const lineOpener = device().querySelector(SHEET_FIXTURES['sheet-line']!.opener)!;
  expect(lineOpener.tagName).toBe('A');
  expect(lineOpener.textContent).toContain('Steak');
});

// ---- M-2, the item configuration sheet ----

const chosen = () =>
  [...dialog()!.querySelectorAll<HTMLElement>('[data-option]')]
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.dataset.option);
const lineTotal = () => dialog()!.querySelector('.sheet-total__amount')!.textContent;

describe('sheet-item', () => {
  beforeEach(() => render('sheet-item'));

  it('shows the artifact’s item, options and selection', () => {
    expect(dialog()!.querySelector('h2')!.textContent).toBe('Burger');
    expect(dialog()!.querySelector('.sheet__aside')!.textContent).toBe('100.000');
    expect([...dialog()!.querySelectorAll('[data-option]')].map((b) => b.textContent)).toEqual([
      'Regular+0',
      'Large+20.000',
      'Small−10.000',
      'Extra cheese +15.000',
      'Bacon +20.000',
      'No onion +0',
    ]);
    expect(chosen()).toEqual(['large', 'cheese']);
    expect(lineTotal()).toBe('135.000');
  });

  it('size is choose-one, extras choose-any, and the line total follows', () => {
    press(dialog()!.querySelector('[data-option="small"]')!);
    expect(chosen()).toEqual(['small', 'cheese']);
    expect(lineTotal()).toBe('105.000');
    press(dialog()!.querySelector('[data-option="bacon"]')!);
    expect(chosen()).toEqual(['small', 'cheese', 'bacon']);
    expect(lineTotal()).toBe('125.000');
    press(dialog()!.querySelector('[data-option="cheese"]')!);
    expect(chosen()).toEqual(['small', 'bacon']);
    expect(lineTotal()).toBe('110.000');
  });

  it('draws a chosen option filled and an unchosen one plain', () => {
    expect(dialog()!.querySelector('[data-option="large"]')!.classList.contains('action--primary')).toBe(true);
    expect(dialog()!.querySelector('[data-option="regular"]')!.classList.contains('action--primary')).toBe(false);
  });

  it('Add to order is a button, and has no item86 notice', () => {
    expect(buttonNamed('Add to order').tagName).toBe('BUTTON');
    expect(dialog()!.querySelector('.notice')).toBeNull();
  });
});

describe('sheet-item86: 86’d mid-choice (acceptance criterion 3)', () => {
  const fixture = SHEET_FIXTURES['sheet-item86'] as ItemSheetFixture;
  beforeEach(() => render('sheet-item86'));

  it('keeps the sheet open, with the same selections and line total as before', () => {
    expect(dialog()).not.toBeNull();
    expect(chosen()).toEqual(['large', 'cheese']);
    expect(lineTotal()).toBe('135.000');
  });

  it('says the item is no longer available, and why', () => {
    const notice = dialog()!.querySelector('.notice')!;
    expect(notice.querySelector('.notice__title')!.textContent).toBe(fixture.unavailable!.title);
    expect(notice.textContent).toContain('A manager marked it 86 while you were choosing');
    expect(notice.textContent).toContain('Your selections are kept');
  });

  it('has no control that adds the line: not disabled, not a dead link, not a control at all', () => {
    const add = [...dialog()!.querySelectorAll('*')].filter((e) => e.textContent?.trim() === 'Add to order');
    expect(add).toHaveLength(1);
    const [span] = add;
    expect(span!.tagName).toBe('SPAN');
    expect(span!.matches('.action.action--off')).toBe(true);
    expect(span!.closest('a, button, [role="button"], [tabindex]:not([role="dialog"])')).toBeNull();
    expect(span!.hasAttribute('href') || span!.hasAttribute('tabindex') || span!.hasAttribute('role')).toBe(false);
    for (const el of liveControls(device())) expect(el.textContent).not.toContain('Add to order');
  });

  it('pressing where Add would be does nothing', () => {
    press(dialog()!.querySelector('.action--off')!);
    expect(dialog()).not.toBeNull();
    expect(urlState()).toBe('sheet-item86');
  });

  it('the only way out is Cancel (or Escape)', () => {
    expect([...dialog()!.querySelectorAll('.sheet__foot button')].map((b) => b.textContent)).toEqual(['Cancel']);
  });
});

describe('unitPrice (FR-C2, AC-26)', () => {
  it('adds the deltas to the base, as bigints', () => {
    expect(unitPrice(100_000n, [20_000n, 15_000n])).toBe(135_000n);
  });

  it('floors at zero', () => {
    expect(unitPrice(10_000n, [-20_000n])).toBe(0n);
  });
});

// ---- The line editor ----

describe('sheet-line', () => {
  beforeEach(() => render('sheet-line'));
  const quantity = () => dialog()!.querySelector('output')!.textContent;

  it('shows the artifact’s title, rule and notes', () => {
    expect(dialog()!.querySelector('h2')!.textContent).toBe('Steak — pending');
    expect(dialog()!.querySelector('.sheet__label')!.textContent).toBe('Quantity — whole numbers, maximum 99');
    expect(dialog()!.textContent).toContain('Removing it needs no approval and is not recorded.');
    expect(quantity()).toBe('1');
  });

  it('steps quantity in whole numbers between 1 and 99', () => {
    press(buttonNamed('Increase quantity'));
    expect(quantity()).toBe('2');
    press(buttonNamed('Decrease quantity'));
    press(buttonNamed('Decrease quantity'));
    expect(quantity()).toBe('1');
    for (let i = 0; i < 120; i++) press(buttonNamed('Increase quantity'));
    expect(quantity()).toBe(String(QUANTITY_MAX));
  });

  it('Remove line takes the pending Steak away with no prompt, on the artifact’s figures', () => {
    press(buttonNamed('Remove line'));
    expect(dialog()).toBeNull();
    expect(window.location.search).toBe('?state=default&gone=steak');
    expect([...host.querySelectorAll('.order-line__name')].map((n) => n.textContent)).toEqual(['Burger', 'Soda']);
    expect(host.querySelector('.totals__row--grand dd')!.textContent).toBe('155.925');
  });
});

// The approval prompt's states hold a dialog and an inert background of their
// own; test/approval.test.tsx checks that no sheet is drawn in them. The
// discount sheets are test/discount.test.tsx's.
describe('no sheet in any other state', () => {
  it.each(ORDER_STATES.map((s) => s.id).filter((s) => !BUILT.includes(s) && !APPROVAL_FIXTURES[s] && !DISCOUNT_FIXTURES[s]))('%s', (state) => {
    render(state);
    expect(dialog()).toBeNull();
    expect(device().querySelector('[inert]')).toBeNull();
  });
});

it('every amount in the sheet fixtures is a bigint', () => {
  const item = SHEET_FIXTURES['sheet-item'] as ItemSheetFixture;
  const amounts = [item.price, ...item.sizes.map((o) => o.delta), ...item.extras.map((o) => o.delta)];
  expect(amounts.filter((a) => typeof a !== 'bigint')).toEqual([]);
});

// The ring is a stylesheet fact: every sheet pressed rule is qualified with
// the button element, so Add to order on an 86'd item — a span — can match
// neither :active nor anything else that draws the ring.

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/pos.css'), 'utf8');

function selectorsDeclaring(stylesheet: string, needle: string): string[] {
  const code = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  for (const m of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[2]!.includes(needle)) out.push(...m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')));
  }
  return out;
}

/** Pressed-ring selectors that could land on a span drawn .action--off. */
function ringsAnOffAction(stylesheet: string): string[] {
  return selectorsDeclaring(stylesheet, '--frost-pressed-ring').filter(
    (s) => /(^|[\s>+~])\.action\b|action--off/.test(s) && !/^(a|button)\.action\b/.test(s)
  );
}

describe('the ring detector can see a ring an unavailable action could match', () => {
  it('flags an unqualified action ring, and accepts an element-qualified one', () => {
    expect(ringsAnOffAction('.action:active { box-shadow: var(--frost-pressed-ring); }')).toEqual(['.action:active']);
    expect(ringsAnOffAction('.sheet .action:active { box-shadow: var(--frost-pressed-ring); }')).toEqual([
      '.sheet .action:active',
    ]);
    expect(ringsAnOffAction('button.action:active { box-shadow: var(--frost-pressed-ring); }')).toEqual([]);
  });
});

describe('pos.css: the sheet pressed ring', () => {
  it('rings a pressed sheet button, and a focused one keeps its focus ring', () => {
    expect(selectorsDeclaring(css, '--frost-pressed-ring')).toContain('button.action:active');
    const both = selectorsDeclaring(css, '--frost-focus-ring), var(--frost-pressed-ring');
    expect(both).toContain('button.action:focus-visible:active');
  });

  it('no ring can land on an unavailable action', () => {
    expect(ringsAnOffAction(css)).toEqual([]);
  });
});
