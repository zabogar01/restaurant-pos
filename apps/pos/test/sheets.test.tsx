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
import { VOID_FIXTURES } from '../src/voidFixtures.js';
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

// FE-013, finding 2 of the F2h/F2d review. The positive sweep used to
// enumerate BUILT and F2I_SHEETS by hand, which left `quick-line` — a real
// entry in SHEET_FIXTURES, added by F2d — in neither array. `SHEET_STATES` is
// derived from `SHEET_FIXTURES` itself, so the next sheet added there is swept
// automatically rather than needing its name added to a filter by hand: the
// same discipline F2d's own fix used for `TABLE_STATES`/`QUICK_SALE_STATES`.
const SHEET_STATES = Object.keys(SHEET_FIXTURES) as OrderState[];
const REACHABILITY_STATES = [...SHEET_STATES, ...F2I_SHEETS];

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
 * A sheet open on the frame that no URL names, reported as the state that
 * draws its twin. Since FE-009 the panel opens the void sheet as component
 * state, and since F2k the discount family and the line editor too: each is
 * handed the line or order tapped and writes no URL, so a URL alone can no
 * longer show that a control reached one. Extended before the guard below is
 * relied on — a detector that only knows about URLs goes quietly blind as each
 * family moves off them, which is the trap FE-009 documented.
 */
function openedInPlace(): string | undefined {
  const flow = device().querySelector('.void-flow');
  if (flow) return flow.querySelector('.void-subject') ? 'sheet-voidline' : 'sheet-voidorder';
  const discount = device().querySelector('.discount-flow');
  if (discount) return discount.querySelector('.discount-applied') ? 'sheet-remove' : 'sheet-discount';
  const line = device().querySelector('[role="dialog"] .sheet-stepper');
  if (line) return 'sheet-line';
  return undefined;
}

/**
 * Where each live control on the frame leads. An anchor by its href; a button by
 * pressing it, on a fresh render, and reading the sheet it opened in place or
 * else the URL it leaves behind.
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
      out.push(openedInPlace() ?? urlState());
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

  it('sees a void sheet opened in place, which writes no URL', () => {
    render('default');
    press(device().querySelector('.order-line[data-line-id="soda"] > .order-line__target')!);
    expect(urlState()).toBe('default');
    expect(openedInPlace()).toBe('sheet-voidline');
    render('default');
    press(device().querySelector('.order-actions [data-action="void-order"]')!);
    expect(urlState()).toBe('default');
    expect(openedInPlace()).toBe('sheet-voidorder');
    render('default');
    expect(openedInPlace()).toBeUndefined();
  });

  // F2k moves three more openers off the URL. Without this the guard would be
  // blind to every one of them the way it nearly went blind to the void.
  it('sees the discount family and the line editor opened in place, which write no URL', () => {
    render('overflow');
    press(device().querySelector('.order-actions [data-action="discount"]')!);
    expect(urlState()).toBe('overflow');
    expect(openedInPlace()).toBe('sheet-discount');

    render('default'); // carries a preset, so Discount opens the change sheet
    press(device().querySelector('.order-actions [data-action="discount"]')!);
    expect(urlState()).toBe('default');
    expect(openedInPlace()).toBe('sheet-remove');

    render('overflow');
    press(device().querySelector('.order-line[data-line-id="of-coffee"] > .order-line__target')!);
    expect(urlState()).toBe('overflow');
    expect(openedInPlace()).toBe('sheet-line');
  });

  it('ignores a control inside an inert subtree, and nothing else', () => {
    const box = document.createElement('div');
    box.innerHTML = '<div inert><a href="?state=approval">x</a></div><button>y</button><a href="?state=sheet-voidline">z</a>';
    expect(liveControls(box).map((e) => e.textContent)).toEqual(['y', 'z']);
  });
});

// FE-013, finding 2. Derived from SHEET_FIXTURES (via SHEET_STATES) rather
// than a hand-kept array, so `quick-line` is swept along with the three F2c
// sheets and F2i's four — its Back, Escape/close and Remove line are pressed
// by `destinations` exactly as every other sheet's controls are, and a static
// destination that escaped to a gated state would show up here.
describe.each(REACHABILITY_STATES)('%s: no control reaches a PIN-gated state (acceptance criterion 1)', (state) => {
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
    const voidPaths = device().querySelectorAll(
      '.order-line[data-line-status="fired"] > button.order-line__target, .order-actions button[data-action="void-order"]'
    );
    expect(voidPaths.length).toBeGreaterThan(0);
    for (const a of voidPaths) expect(a.closest('[inert]')).not.toBeNull();
  });

  it('tags the pending line 86 exactly where its item is 86’d, and nowhere else', () => {
    render(state);
    const tagged = [...host.querySelectorAll('.order-lines .tag-86')].map(
      (t) => t.closest('.order-line')!.querySelector('.order-line__name')!.firstChild!.textContent
    );
    expect(tagged).toEqual(state === 'sheet-item86' ? ['Steak'] : []);
  });
});

it('the reachability sweep names every fixture SHEET_FIXTURES carries, quick-line included', () => {
  // The guard the previous shape lacked: nothing asserted that BUILT and
  // F2I_SHEETS together still matched SHEET_FIXTURES's keys, so a fixture
  // could exist and never be swept. SHEET_STATES is Object.keys of the same
  // record the panel reads, so this now fails the day a fixture is added
  // and left out — it cannot be, since REACHABILITY_STATES is built from it.
  expect(SHEET_STATES.slice().sort()).toEqual(['quick-line', 'sheet-item', 'sheet-item86', 'sheet-line']);
  expect(REACHABILITY_STATES).toEqual(expect.arrayContaining(SHEET_STATES));
});

// The table-specific half of the acceptance-criterion-1 checks above:
// `sheet-item`, `sheet-item86`, `sheet-line` and F2i's sheets are all opened
// over the table order, so the panel beside them always reads Burger, Soda,
// Steak. `quick-line` opens over the counter order (Burger, Soda only,
// FR-D2) and is proven separately, in test/quick-sale.test.tsx, rather than
// forcing it through an assertion built for the other order.
describe.each([...BUILT, ...F2I_SHEETS])('%s: the panel stays legible beside the sheet', (state) => {
  it('reads the table order beside it', () => {
    render(state);
    const names = [...host.querySelectorAll('.order-line__name')].map((n) => n.firstChild!.textContent);
    expect(names).toEqual(['Burger', 'Soda', 'Steak']);
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
  expect(device().querySelector(SHEET_FIXTURES['sheet-item']!.opener)!.tagName).toBe('BUTTON');
  render('eightysix');
  const lineOpener = device().querySelector(SHEET_FIXTURES['sheet-line']!.opener)!;
  expect(lineOpener.tagName).toBe('BUTTON');
  expect(lineOpener.textContent).toContain('Steak');
});

// ---- Back never re-opens a sheet (FE-009, correction 4) ----
//
// SITEMAP §1: a [SHEET] is not a route and not back-stackable, nor is a
// [MODAL]. Opening one from the order screen and leaving it again both replace
// the current history entry, so no entry is ever left behind that holds a
// sheet, and the browser's Back goes to wherever the cashier was before.

/** The browser's Back, and the popstate that follows it. */
async function back() {
  await act(async () => {
    const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
    window.history.back();
    await popped;
  });
}

/** Lands on the order screen at `state` as a navigation would: a history entry for `earlier`, then one for `state`. */
function arrive(earlier: OrderState, state: OrderState) {
  window.history.replaceState(null, '', `/pos/order?state=${earlier}`);
  window.history.pushState(null, '', `/pos/order?state=${state}`);
  act(() => root.render(<OrderScreen key={++mount} view={{ state }} />));
}

const opens: ReadonlyArray<[family: string, from: OrderState, open: string, close: string]> = [
  ['F2c, the item sheet', 'default', '.menu-tile[data-item="soda"]', 'Cancel'],
  ['F2c, the line editor', 'default', '.order-line[data-line-status="pending"] > .order-line__target', 'Back'],
  ['F2i, the discount picker', 'default', '.order-actions [data-action="discount"]', 'Cancel'],
  ['F2j, a fired line’s void', 'default', '.order-line[data-line-id="soda"] > .order-line__target', 'Cancel'],
  ['F2j, the order’s void', 'default', '.order-actions [data-action="void-order"]', 'Keep order'],
];

describe.each(opens)('%s: opened from the order and closed, no sheet is left in the history', (_family, from, open, close) => {
  it('opening and closing leave the history as long as it was', () => {
    arrive('eightysix', from);
    const length = window.history.length;
    press(device().querySelector(open)!);
    expect(dialog()).not.toBeNull();
    expect(window.history.length).toBe(length);
    press(buttonNamed(close));
    expect(dialog()).toBeNull();
    expect(window.history.length).toBe(length);
  });

  it('Back then goes to where the cashier was before, and opens no sheet', async () => {
    arrive('eightysix', from);
    press(device().querySelector(open)!);
    press(buttonNamed(close));
    await back();
    expect(urlState()).toBe('eightysix');
    expect(dialog()).toBeNull();
    expect(device().querySelector('[inert]')).toBeNull();
  });
});

// A sheet reached by its own URL — as the review harness reaches every one —
// closes by replacing that entry, so Back cannot return to it either.
describe.each([
  ['sheet-item', 'Cancel'],
  ['sheet-item86', 'Cancel'],
  ['sheet-line', 'Back'],
  ['sheet-discount', 'Cancel'],
  ['sheet-voidline', 'Cancel'],
  ['sheet-voidorder', 'Keep order'],
  ['sheet-voidorder-fired', 'Keep order'],
] as const)('%s, reached by URL: closing it leaves no way Back into it', (state, close) => {
  it(`${close} replaces the sheet’s entry, and Back goes to the entry before it`, async () => {
    arrive('eightysix', state);
    const length = window.history.length;
    press(buttonNamed(close));
    expect(dialog()).toBeNull();
    expect(window.history.length).toBe(length);
    await back();
    expect(urlState()).toBe('eightysix');
    expect(dialog()).toBeNull();
  });
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
// discount sheets are test/discount.test.tsx's, the void sheets
// test/void.test.tsx's.
describe('no sheet in any other state', () => {
  // Generalised from `!BUILT.includes(s)` in F2d: BUILT was every key
  // SHEET_FIXTURES had until quick-line joined it, so the two were the same
  // set. Reading SHEET_FIXTURES itself rather than the F2c-era array means a
  // future sheet fixture excludes itself here automatically, the way this one
  // should have without a second edit.
  it.each(ORDER_STATES.map((s) => s.id).filter((s) => !(s in SHEET_FIXTURES) && !APPROVAL_FIXTURES[s] && !DISCOUNT_FIXTURES[s] && !VOID_FIXTURES[s]))('%s', (state) => {
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

// ---- F2k: the line editor opens over the line that was tapped ----

// The defect this closes: every PENDING row body navigated to
// ?state=sheet-line, one fixture's sheet. Tapping Coffee on overflow opened
// the *Steak's* editor, whose Remove line took the Steak — on an order that
// then turned into the table order.

const rowBody = (lineId: string) => device().querySelector(`.order-line[data-line-id="${lineId}"] > .order-line__target`)!;
const pendingIds = () =>
  [...device().querySelectorAll<HTMLElement>('.order-line[data-line-status="pending"]')].map((r) => r.dataset.lineId!);
const title = () => dialog()!.querySelector('#sheet-title')!.textContent;

describe('the line editor opens for the line that was tapped (criterion 4)', () => {
  it.each(['default', 'overflow'] as const)('%s: each pending row opens its own editor, named after that line', (state) => {
    render(state);
    const ids = pendingIds();
    expect(ids.length).toBeGreaterThan(0);
    const titles: string[] = [];
    for (const id of ids) {
      render(state);
      const name = device().querySelector(`.order-line[data-line-id="${id}"] .order-line__name`)!.textContent;
      press(rowBody(id));
      expect(title()).toBe(`${name} — pending`);
      titles.push(title()!);
    }
    // Two different rows open two different editors — which is the defect.
    expect(new Set(titles).size).toBe(ids.length);
  });

  it('overflow: tapping Coffee opens Coffee’s editor, not the Steak’s, and keeps the order', () => {
    render('overflow');
    const length = window.history.length;
    press(rowBody('of-coffee'));
    expect(title()).toBe('Coffee — pending');
    expect(urlState()).toBe('overflow');
    expect(window.history.length).toBe(length);
    expect([...device().querySelectorAll('.order-line__name')]).toHaveLength(10);
    // Quantity is that line's, not the fixture's 1.
    expect(dialog()!.querySelector('.sheet-stepper__value')!.textContent).toBe('2');
  });

  it('overflow: Remove line asks for the line that was tapped, and the panel honours it', () => {
    for (const [id, name, subtotal] of [
      ['of-coffee', 'Coffee', '1.115.000'],
      ['of-cheese', 'Cheesecake', '1.125.000'],
      ['of-wine', 'House Wine', '1.105.000'],
    ] as const) {
      render('overflow');
      press(rowBody(id));
      expect(title()).toBe(`${name} — pending`);
      press(buttonNamed('Remove line'));
      expect(dialog()).toBeNull();
      expect(window.location.search).toBe(`?state=overflow&gone=${id}`);
      expect([...device().querySelectorAll('.order-line__name')].map((n) => n.textContent)).not.toContain(name);
      expect(device().querySelector('.totals dd')!.textContent).toBe(subtotal);
    }
  });

  it('Back keeps the order the cashier was looking at, and hands focus to the row', () => {
    render('overflow');
    press(rowBody('of-wine'));
    press(buttonNamed('Back'));
    expect(dialog()).toBeNull();
    expect(urlState()).toBe('overflow');
    expect(document.activeElement).toBe(rowBody('of-wine'));
    expect(device().querySelector('[inert]')).toBeNull();
  });

  it('?state=sheet-line still draws the artifact’s own editor for review', () => {
    render('sheet-line');
    expect(title()).toBe('Steak — pending');
    expect(SHEET_FIXTURES['sheet-line']!.opener).toBe('.order-line[data-line-status="pending"] > .order-line__target');
  });
});

// ---- F2k: only leaving POS-03 pushes a history entry (criterion 7) ----

// SITEMAP §1 gives [INLINE] Back-stackable: No. A category press and a ×
// removal are both inline changes of POS-03, so each replaces its entry. Before
// this, Back after a × put the removed line back — a removal undone by a
// browser control.

describe('inline changes replace the history entry; only leaving POS-03 pushes one (criterion 7)', () => {
  it.each([
    ['a category press', '.menu-categories .menu-category:nth-child(3)'],
    ['the × on a pending row', '.order-line[data-line-id="steak"] button.order-line__remove'],
    // Firing does not leave POS-03: SITEMAP §2 puts the fire result under it
    // as an [INLINE] state (FR-E3), and §1 gives [INLINE] Back-stackable: No.
    // F2k first shipped this as a departure, following a task file that was
    // wrong; corrected 2026-09-21 after review.
    ['Send to kitchen', '.order-actions [data-action="fire"]'],
  ] as const)('%s replaces it', (_what, selector) => {
    arrive('eightysix', 'default');
    const length = window.history.length;
    press(device().querySelector(selector)!);
    expect(window.history.length).toBe(length);
  });

  it('Settle pushes one, because POS-04 is its own screen', () => {
    arrive('eightysix', 'default');
    const length = window.history.length;
    press(device().querySelector('.order-actions [data-action="settle"]')!);
    expect(window.history.length).toBe(length + 1);
    // ?state=settle is written but not served yet (F3), so the view falls back
    // to the default order. The entry is what this test is about.
    expect(window.location.search).toBe('?state=settle');
  });

  it('Back after Send to kitchen does not traverse the firing: it leaves the screen', async () => {
    arrive('eightysix', 'default');
    press(device().querySelector('.order-actions [data-action="fire"]')!);
    await back();
    expect(urlState()).toBe('eightysix');
    expect(dialog()).toBeNull();
  });

  it('Back after a × does not put the line back: it leaves the screen', async () => {
    arrive('eightysix', 'default');
    press(device().querySelector('.order-line[data-line-id="steak"] button.order-line__remove')!);
    expect(window.location.search).toBe('?state=default&gone=steak');
    expect([...device().querySelectorAll('.order-line__name')].map((n) => n.textContent)).toEqual(['Burger', 'Soda']);
    await back();
    expect(urlState()).toBe('eightysix');
    expect(window.location.search).not.toContain('gone=');
  });

  it('Back after a category press leaves the screen too, and opens no sheet', async () => {
    arrive('eightysix', 'default');
    press(device().querySelector('.menu-categories .menu-category:nth-child(3)')!);
    expect(window.location.search).toBe('?state=default');
    await back();
    expect(urlState()).toBe('eightysix');
    expect(dialog()).toBeNull();
  });

  it('a category press keeps the order on screen, ?gone= included (criterion 5)', () => {
    render('overflow');
    press(device().querySelector('.order-line[data-line-id="of-coffee"] button.order-line__remove')!);
    const before = [...device().querySelectorAll('.order-line__name')].map((n) => n.textContent);
    const total = device().querySelector('.totals__row--grand dd')!.textContent;
    expect(before).not.toContain('Coffee');

    press(device().querySelector('.menu-categories .menu-category:nth-child(3)')!);

    // The order it was pressed on, down to the line the × took away. Before
    // F2k this landed on ?state=default: another order entirely.
    expect(window.location.search).toBe('?state=overflow&gone=of-coffee');
    expect([...device().querySelectorAll('.order-line__name')].map((n) => n.textContent)).toEqual(before);
    expect(device().querySelector('.totals__row--grand dd')!.textContent).toBe(total);
    // Nothing else moves: the rail keeps Mains, because the grid can only draw
    // Mains (ruled 2026-09-21), and the URL asserts no category.
    expect(device().querySelector('.menu-category--selected')!.textContent).toBe('Mains');
    expect(device().querySelectorAll('.menu-category--selected')).toHaveLength(1);
  });
});
