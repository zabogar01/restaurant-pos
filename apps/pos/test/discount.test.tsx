// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  discountAmount,
  needsManager,
  orderTotals,
  parseFreeForm,
  snapshotOf,
  type DiscountSnapshot,
  type Preset,
} from '../src/discount.js';
import {
  COMP,
  DISCOUNT_FIXTURES,
  OTHER_15,
  PRESETS,
  OTHER_15_NOTE,
  STAFF_MEAL,
  STAFF_MEAL_NOTE,
  type DiscountSheetFixture,
} from '../src/discountFixtures.js';
import { DiscountSheet } from '../src/DiscountSheets.js';
import { OrderScreen } from '../src/OrderPanel.js';
import { ORDER_FIXTURES, ORDER_STATES, type OrderState, type OrderView } from '../src/orderFixtures.js';

// M-3, the discount family (F2i). What this file is for:
// - FR-F8's whole-transition gate, every row, decided by what the order carries
//   and what would replace it — including the free-form rows the artifact never
//   draws — both as a function and by pressing the controls that reach it;
// - the manager prompt opens as component state, never a URL, and cancelling it
//   leaves the sheet and the order exactly as they were (B-20);
// - FR-F5 / B-8: a discount reads from the order's snapshot, so a preset
//   deactivated or edited since still reads, and is absent from the picker;
// - B-21: nothing chooses a discount but a finger;
// - money through @pos/money, exact, reproducing the artifact's own figures.

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
function render(state: OrderState) {
  window.history.replaceState(null, '', `/pos/order?state=${state}`);
  act(() => root.render(<OrderScreen key={++mount} view={{ state }} />));
}

/** A discount sheet on its own, for fixtures no ?state= draws. Records where it sends the order. */
function renderSheet(fixture: DiscountSheetFixture): OrderView[] {
  const went: OrderView[] = [];
  act(() =>
    root.render(
      <div className="pos-device" key={++mount}>
        <DiscountSheet fixture={fixture} go={(v) => went.push(v)} />
      </div>
    )
  );
  return went;
}

const device = () => host.querySelector('.pos-device')!;
const sheet = () => host.querySelector<HTMLElement>('.sheet[role="dialog"]');
const prompt = () => host.querySelector<HTMLElement>('.modal[role="dialog"]');
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
const field = () => sheet()!.querySelector<HTMLInputElement>('#discount-value')!;
function typeValue(text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setValue.call(field(), text);
    field().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const approve = () => {
  for (const d of '123456') press(inPrompt(d));
  press(inPrompt('Continue'));
};
const totalsRows = () =>
  [...host.querySelectorAll('.totals__row')].map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]);
const lineNames = () => [...host.querySelectorAll('.order-line__name')].map((n) => n.textContent);

/** Everything a finger or keyboard can operate: not inside an inert subtree. */
function liveControls(container: ParentNode): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => !el.closest('[inert]'));
}

const F2I_STATES = ['sheet-discount', 'sheet-freeform', 'sheet-remove', 'sheet-remove-freeform', 'zero'] as const;
const SHEET_STATES = ['sheet-discount', 'sheet-freeform', 'sheet-remove', 'sheet-remove-freeform'] as const;

// ---- FR-F8, as a function ----

const FREE_20: DiscountSnapshot = { source: 'free-form', name: 'Other discount', value: { kind: 'percent', percent: '20' } };
const REGULAR = snapshotOf(PRESETS[1]!);

describe('FR-F8: the gate decides from what is applied and what replaces it', () => {
  it.each([
    ['preset', 'replaced by another preset', STAFF_MEAL, REGULAR, false],
    ['preset', 'removed', STAFF_MEAL, 'remove', false],
    ['preset', 'replaced by a free-form', STAFF_MEAL, FREE_20, true],
    ['free-form', 'replaced by a preset', OTHER_15, REGULAR, true],
    ['free-form', 'removed', OTHER_15, 'remove', true],
    ['free-form', 'replaced by another free-form', OTHER_15, FREE_20, true],
  ] as const)('%s applied, %s: gated %s', (_a, _c, applied, change, gated) => {
    expect(needsManager(applied, change)).toBe(gated);
  });

  it('with nothing applied, a preset is ungated (FR-F2) and a free-form is gated (FR-F3)', () => {
    expect(needsManager(undefined, REGULAR)).toBe(false);
    expect(needsManager(undefined, FREE_20)).toBe(true);
  });

  it('there is no removing a discount that is not there', () => {
    expect(() => needsManager(undefined, 'remove')).toThrow();
  });

  it('reads the kind, never the name or the value: a free-form called "Staff meal" at 10% is still gated to remove', () => {
    const lookalike: DiscountSnapshot = { ...STAFF_MEAL, source: 'free-form', presetId: undefined };
    expect(needsManager(lookalike, 'remove')).toBe(true);
    expect(needsManager(lookalike, STAFF_MEAL)).toBe(true);
    expect(needsManager(STAFF_MEAL, 'remove')).toBe(false);
  });

  it('the sheets ask needsManager for every gate, and decide none themselves', () => {
    const sheets = code('DiscountSheets.tsx');
    expect(sheets).not.toMatch(/source\s*===\s*'(preset|free-form)'/);
    expect(sheets).not.toMatch(/gated=\{(true|false)\}/);
    expect(code('discountFixtures.ts')).not.toMatch(/gated|needsManager/);
  });
});

// ---- FR-F8, by pressing the controls: every row ----

describe('preset applied (the artifact’s case)', () => {
  it('another preset: applied with no prompt', () => {
    render('sheet-discount');
    press(inSheet('Regular customer — 5%'));
    expect(prompt()).toBeNull();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('default');
  });

  it('another preset, from the change sheet: through the picker, with no prompt', () => {
    render('sheet-remove');
    press(inSheet('Replace with another preset'));
    expect(sheet()!.querySelector('h2')!.textContent).toBe('Discount');
    press(inSheet('Comp — 100%'));
    expect(prompt()).toBeNull();
    expect(urlState()).toBe('zero');
  });

  it('removed: with no prompt, and the order keeps its lines', () => {
    render('sheet-remove');
    press(inSheet('Remove the discount'));
    expect(prompt()).toBeNull();
    expect(urlState()).toBe('default');
    expect(urlState()).not.toBe('empty');
    expect(lineNames()).toEqual(['Burger', 'Soda', 'Steak']);
  });

  it('replaced by a free-form: the prompt, naming both ends of the change', () => {
    render('sheet-remove');
    press(inSheet('Replace with another amount — needs a manager'));
    expect(sheet()!.querySelector('h2')!.textContent).toBe('Other discount');
    typeValue('15');
    press(inSheet('Apply'));
    expect(prompt()).not.toBeNull();
    expect(prompt()!.querySelector('.modal__request')!.textContent).toBe('Replace Staff meal 10% — with Other discount 15% −60.750');
  });

  it('replaced by a free-form, from the picker: the prompt', () => {
    render('sheet-freeform');
    press(inSheet('Apply'));
    expect(prompt()).not.toBeNull();
  });
});

describe('free-form applied (the state FE-007 adds; the artifact never draws it)', () => {
  it('draws all three change controls gated, and says so on each', () => {
    render('sheet-remove-freeform');
    const options = [...sheet()!.querySelectorAll<HTMLElement>('.discount-option')];
    expect(options.map((b) => b.textContent)).toEqual([
      'Replace with another preset — needs a manager',
      'Replace with another amount — needs a manager',
      'Remove the discount — needs a manager',
    ]);
    for (const b of options) {
      expect(b.dataset.gated).toBe('true');
      expect(b.classList.contains('discount-option--gated')).toBe(true);
    }
  });

  it('replaced by a preset: the picker gates every preset, and choosing one opens the prompt', () => {
    render('sheet-remove-freeform');
    press(inSheet('Replace with another preset — needs a manager'));
    expect(sheet()!.querySelector('.sheet__label')!.textContent).toBe('Presets — need a manager');
    for (const b of sheet()!.querySelectorAll<HTMLElement>('.discount-option')) expect(b.dataset.gated).toBe('true');
    press(inSheet('Staff meal — 10% — needs a manager'));
    expect(prompt()).not.toBeNull();
    expect(prompt()!.querySelector('.modal__request')!.textContent).toBe('Replace Other discount 15% — with Staff meal 10% −40.500');
    expect(urlState()).toBe('sheet-remove-freeform');
  });

  it('removed: the prompt', () => {
    render('sheet-remove-freeform');
    press(inSheet('Remove the discount — needs a manager'));
    expect(prompt()!.querySelector('.modal__request')!.textContent).toBe('Remove the discount — Other discount 15% −60.750');
    expect(urlState()).toBe('sheet-remove-freeform');
  });

  it('replaced by another free-form: the prompt', () => {
    render('sheet-remove-freeform');
    press(inSheet('Replace with another amount — needs a manager'));
    typeValue('20');
    press(inSheet('Apply'));
    expect(prompt()!.querySelector('.modal__request')!.textContent).toBe('Replace Other discount 15% — with Other discount 20% −81.000');
  });

  it('approved, a preset replacing it lands where that preset lands: Comp on zero', () => {
    render('sheet-remove-freeform');
    press(inSheet('Replace with another preset — needs a manager'));
    press(inSheet('Comp — 100% — needs a manager'));
    approve();
    expect(prompt()).toBeNull();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('zero');
  });
});

describe('nothing applied (FR-F2, FR-F3), on a sheet no ?state= draws', () => {
  const bare: DiscountSheetFixture = { ...DISCOUNT_FIXTURES['sheet-discount']!, applied: undefined };

  it('presets need no approval; a free-form does, and asks to apply rather than replace', () => {
    const went = renderSheet(bare);
    expect(sheet()!.querySelector('.sheet__label')!.textContent).toBe('Presets — no approval needed');
    press(inSheet('Other amount — needs a manager'));
    typeValue('15');
    press(inSheet('Apply'));
    expect(prompt()!.querySelector('.modal__request')!.textContent).toBe('Apply a discount — Other discount 15% −60.750');
    expect(went).toEqual([]);
  });

  it('a preset is applied at once', () => {
    const went = renderSheet(bare);
    press(inSheet('Staff meal — 10%'));
    expect(prompt()).toBeNull();
    expect(went).toEqual([{ state: 'default' }]);
  });
});

describe('every drawn change control agrees with the table', () => {
  it.each(SHEET_STATES)('%s, and every sheet reachable from it', (state) => {
    const fixture = DISCOUNT_FIXTURES[state]!;
    const check = () => {
      for (const b of sheet()!.querySelectorAll<HTMLElement>('.discount-option')) {
        const gated = b.dataset.gated === 'true';
        expect(b.textContent!.endsWith(' — needs a manager')).toBe(gated);
        expect(b.classList.contains('discount-option--gated')).toBe(gated);
      }
    };
    render(state);
    check();
    for (const next of ['Replace with another preset', 'Replace with another amount']) {
      render(state);
      const b = buttons(sheet()!).find((x) => x.textContent!.startsWith(next));
      if (!b) continue;
      press(b);
      check();
    }
    // The presets' gate follows the order, not the sheet.
    render(state);
    const replace = buttons(sheet()!).find((x) => x.textContent!.startsWith('Replace with another preset'));
    if (replace) press(replace);
    for (const b of sheet()!.querySelectorAll<HTMLElement>('.discount-option')) {
      if (b.textContent!.startsWith('Other amount')) continue;
      if (sheet()!.querySelector('h2')!.textContent !== 'Discount') continue;
      expect(b.dataset.gated).toBe(String(needsManager(fixture.applied, { source: 'preset' })));
    }
  });
});

// ---- The prompt is component state, never a URL ----

describe('opening the prompt writes no URL and no history (SITEMAP §1)', () => {
  it.each([
    ['sheet-freeform', 'Apply'],
    ['sheet-remove-freeform', 'Remove the discount — needs a manager'],
  ] as const)('%s → %s', (state, control) => {
    render(state);
    const before = { search: window.location.search, length: window.history.length };
    press(inSheet(control));
    expect(prompt()).not.toBeNull();
    expect(window.location.search).toBe(before.search);
    expect(window.history.length).toBe(before.length);
    expect(window.location.href).not.toMatch(/approval/);
  });

  it('the prompt is the manager prompt, over an inert sheet and an inert order', () => {
    render('sheet-remove-freeform');
    press(inSheet('Remove the discount — needs a manager'));
    expect(prompt()!.querySelector('#approval-title')!.textContent).toBe('Manager PIN');
    expect(sheet()!.closest('[inert]')).not.toBeNull();
    expect(host.querySelector('.order-screen__body')!.hasAttribute('inert')).toBe(true);
    const live = liveControls(device()).map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(live).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Delete last digit', '0', 'Continue', 'Cancel']);
  });

  it('no discount source writes an approval state, a route, or the history', () => {
    for (const f of ['DiscountSheets.tsx', 'discountFixtures.ts', 'discount.ts']) {
      const c = code(f);
      expect(c).not.toMatch(/['"`]approval(-\w+)?['"`]|state=approval/);
      expect(c).not.toMatch(/pushState|replaceState|location\./);
      expect(c).not.toMatch(/APPROVAL_FIXTURES/);
    }
  });
});

describe('cancelling the prompt returns to the sheet with nothing changed (B-20)', () => {
  it('Cancel: the same sheet, the same entry, the same order, focus on Apply', () => {
    render('sheet-freeform');
    const totals = totalsRows();
    const apply = inSheet('Apply');
    press(apply);
    press(inPrompt('Cancel'));
    expect(prompt()).toBeNull();
    expect(sheet()!.querySelector('h2')!.textContent).toBe('Other discount');
    expect(sheet()!.closest('[inert]')).toBeNull();
    expect(field().value).toBe('15');
    expect(urlState()).toBe('sheet-freeform');
    expect(totalsRows()).toEqual(totals);
    expect(document.activeElement).toBe(inSheet('Apply'));
  });

  it('Escape cancels the prompt alone; the sheet stays until a second Escape', () => {
    render('sheet-remove-freeform');
    press(inSheet('Remove the discount — needs a manager'));
    for (const d of '1234') press(inPrompt(d));
    escape();
    expect(prompt()).toBeNull();
    expect(sheet()!.querySelector('h2')!.textContent).toBe('Change discount');
    expect(urlState()).toBe('sheet-remove-freeform');
    expect(document.activeElement).toBe(inSheet('Remove the discount — needs a manager'));
    expect(totalsRows()).toContainEqual(['Other discount 15%', '−60.750']);
    escape();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('default');
  });

  it('a second opening starts a fresh pad', () => {
    render('sheet-freeform');
    press(inSheet('Apply'));
    for (const d of '123') press(inPrompt(d));
    press(inPrompt('Cancel'));
    press(inSheet('Apply'));
    expect(host.querySelectorAll('.pin-dot--filled')).toHaveLength(0);
  });
});

// ---- FR-F5 and B-8: the order carries a snapshot, not a reference ----

describe('a preset deactivated or edited after it was applied (FR-F5, B-8)', () => {
  const retired: Preset[] = PRESETS.map((p) => (p.id === 'staff-meal' ? { ...p, active: false } : p));
  const onRetired: DiscountSheetFixture = { ...DISCOUNT_FIXTURES['sheet-remove']!, presets: retired };

  it('still reads on the order that carries it', () => {
    renderSheet(onRetired);
    const card = sheet()!.querySelector('.discount-applied')!;
    expect(card.querySelector('.discount-applied__row')!.textContent).toBe('Staff meal — 10%−40.500');
  });

  it('is absent from the picker', () => {
    renderSheet(onRetired);
    press(inSheet('Replace with another preset'));
    const offered = [...sheet()!.querySelectorAll('.discount-option')].map((b) => b.textContent);
    expect(offered).toEqual(['Regular customer — 5%', 'Service recovery — 50.000 off', 'Comp — 100%', 'Other amount — needs a manager']);
  });

  it('reads the value it was applied at, not the preset’s value today', () => {
    const edited: Preset[] = PRESETS.map((p) => (p.id === 'staff-meal' ? { ...p, value: { kind: 'percent', percent: '20' } } : p));
    renderSheet({ ...DISCOUNT_FIXTURES['sheet-remove']!, presets: edited });
    expect(sheet()!.querySelector('.discount-applied__row')!.textContent).toBe('Staff meal — 10%−40.500');
  });

  it('never looks the preset up: a reference to nothing reads the same', () => {
    renderSheet({ ...DISCOUNT_FIXTURES['sheet-remove']!, presets: [], applied: { ...STAFF_MEAL, presetId: 'gone' } });
    expect(sheet()!.querySelector('.discount-applied__row')!.textContent).toBe('Staff meal — 10%−40.500');
  });
});

// ---- B-21: nothing applies itself ----

describe('no discount applies itself (B-21, FR-F7)', () => {
  it.each(SHEET_STATES)('%s: opening it changes nothing and chooses nothing', (state) => {
    const went = renderSheet(DISCOUNT_FIXTURES[state]!);
    expect(went).toEqual([]);
    expect(prompt()).toBeNull();
    for (const b of sheet()!.querySelectorAll('.discount-option')) expect(b.getAttribute('aria-pressed')).toBeNull();
  });

  it('reached in the app, the free-form sheet holds nothing typed', () => {
    render('sheet-discount');
    press(inSheet('Other amount — needs a manager'));
    expect(field().value).toBe('');
  });

  it('no timer, clock or date anywhere in the discount code', () => {
    for (const f of ['DiscountSheets.tsx', 'discountFixtures.ts', 'discount.ts']) {
      expect(code(f)).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|\bDate\b|performance\.|Temporal/);
    }
  });
});

// ---- Money: exact, through @pos/money, and the artifact's own figures ----

describe('discount arithmetic (FR-M2, FR-M3, FR-M5)', () => {
  it('a percent of money goes through rateFromPercent and mulRate, never Number', () => {
    const c = code('discount.ts');
    expect(c).toMatch(/rateFromPercent\(value\.percent\)/);
    expect(c).toMatch(/mulRate\(subtotal, rate\)/);
    expect(c).not.toMatch(/\bNumber\s*\(|parseFloat|parseInt|Math\./);
  });

  it('takes the artifact’s figures', () => {
    expect(discountAmount(405_000n, STAFF_MEAL.value)).toBe(40_500n);
    expect(discountAmount(165_000n, STAFF_MEAL.value)).toBe(16_500n);
    expect(discountAmount(405_000n, OTHER_15.value)).toBe(60_750n);
    expect(discountAmount(405_000n, COMP.value)).toBe(405_000n);
  });

  it('rounds half-up once', () => {
    expect(discountAmount(99n, { kind: 'percent', percent: '12.5' })).toBe(12n); // 12.375
    expect(discountAmount(5n, { kind: 'percent', percent: '50' })).toBe(3n); // 2.5
    expect(discountAmount(3n, { kind: 'percent', percent: '0.0001' })).toBe(0n);
  });

  it('is exact past 2^53, where a double is not', () => {
    const big = 9_007_199_254_740_993n;
    expect(discountAmount(big, { kind: 'percent', percent: '100' })).toBe(big);
    expect(discountAmount(big, { kind: 'percent', percent: '50' })).toBe(4_503_599_627_370_497n);
    // The route this forbids, shown to be wrong on this machine.
    expect(BigInt(Math.round(Number(big) * 0.5))).not.toBe(4_503_599_627_370_497n);
  });

  it('caps a fixed amount at the subtotal, so no order goes negative', () => {
    expect(discountAmount(30_000n, { kind: 'fixed', amount: 50_000n })).toBe(30_000n);
    expect(discountAmount(405_000n, { kind: 'fixed', amount: 50_000n })).toBe(50_000n);
  });

  it('refuses more than 100%', () => {
    expect(() => discountAmount(100n, { kind: 'percent', percent: '100.0001' })).toThrow();
  });
});

describe('orderTotals reproduces the artifact’s hand-written figures and AC-4', () => {
  it('Staff meal on the table order, and with the Steak removed', () => {
    expect(orderTotals(405_000n, STAFF_MEAL)).toEqual(ORDER_FIXTURES.default.totals);
    expect(orderTotals(165_000n, STAFF_MEAL)).toEqual(ORDER_FIXTURES.default.totalsWithout!.steak);
  });

  it('no discount, on the artifact’s overflow order', () => {
    expect(orderTotals(1_185_000n)).toEqual(ORDER_FIXTURES.overflow.totals);
  });

  it('the PRD’s worked example, at two decimal places (AC-4)', () => {
    const t = orderTotals(1650n, { source: 'preset', name: 'Discount', value: { kind: 'percent', percent: '10' } });
    expect([t.discount!.amount, t.subtotal + t.discount!.amount, t.taxIncluded!.amount, t.serviceCharge!.amount, t.total]).toEqual([
      -165n,
      1485n,
      135n,
      74n,
      1559n,
    ]);
  });
});

describe('parseFreeForm (FR-M5)', () => {
  it.each(['0', '15', '12.5', '0.0001', '100'])('accepts %s%%', (text) => {
    expect(parseFreeForm({ kind: 'percent', text }, 405_000n)).toEqual({ ok: true, value: { kind: 'percent', percent: text } });
  });

  it.each(['', '100.0001', '101', '-5', '1e2', '0.00001', '015', '15%', 'abc'])('refuses %j as a percent', (text) => {
    expect(parseFreeForm({ kind: 'percent', text }, 405_000n)).toEqual({ ok: false, message: 'Enter a percentage from 0 to 100.' });
  });

  it('accepts a whole amount up to the subtotal, and refuses anything else', () => {
    expect(parseFreeForm({ kind: 'fixed', text: '405000' }, 405_000n)).toEqual({ ok: true, value: { kind: 'fixed', amount: 405_000n } });
    for (const text of ['405001', '5.5', '050', '-1', '']) {
      expect(parseFreeForm({ kind: 'fixed', text }, 405_000n)).toEqual({ ok: false, message: 'Enter a whole amount from 0 to 405.000.' });
    }
  });
});

describe('a refused value: A7’s invalid field, and no prompt', () => {
  it('names the rule under the field, opens nothing, and clears when the value changes', () => {
    render('sheet-freeform');
    typeValue('150');
    press(inSheet('Apply'));
    expect(prompt()).toBeNull();
    expect(sheet()!.querySelector('.discount-field')!.classList.contains('discount-field--invalid')).toBe(true);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(field().getAttribute('aria-describedby')!)!.textContent).toBe('Enter a percentage from 0 to 100.');
    typeValue('15');
    expect(sheet()!.querySelector('.discount-field--invalid')).toBeNull();
    expect(field().hasAttribute('aria-invalid')).toBe(false);
  });

  it('Fixed amount names the order’s subtotal as its limit', () => {
    render('sheet-freeform');
    press(inSheet('Fixed amount'));
    expect(sheet()!.querySelector('label')!.textContent).toBe('Value — 0 to 405.000');
    typeValue('500000');
    press(inSheet('Apply'));
    expect(prompt()).toBeNull();
    typeValue('50000');
    press(inSheet('Apply'));
    expect(prompt()!.querySelector('.modal__request')!.textContent).toBe('Replace Staff meal 10% — with Other discount 50.000 off −50.000');
  });
});

// ---- The five states as drawn (acceptance criterion 2) ----

describe('the five states', () => {
  it('are served by ?state=', () => {
    for (const s of F2I_STATES) expect(ORDER_STATES.map((o) => o.id)).toContain(s);
  });

  it('sheet-discount: the artifact’s picker', () => {
    render('sheet-discount');
    expect(sheet()!.querySelector('h2')!.textContent).toBe('Discount');
    expect(sheet()!.querySelector('.discount-aside')!.textContent).toBe('One per order');
    expect([...sheet()!.querySelectorAll('.sheet__label')].map((l) => l.textContent)).toEqual([
      'Presets — no approval needed',
      'Anything else',
    ]);
    expect([...sheet()!.querySelectorAll('.discount-option')].map((b) => [b.textContent, (b as HTMLElement).dataset.gated])).toEqual([
      ['Staff meal — 10%', 'false'],
      ['Regular customer — 5%', 'false'],
      ['Service recovery — 50.000 off', 'false'],
      ['Comp — 100%', 'false'],
      ['Other amount — needs a manager', 'true'],
    ]);
    expect([...sheet()!.querySelectorAll('.sheet__foot button')].map((b) => b.textContent)).toEqual(['Cancel']);
  });

  it('sheet-freeform: Percent, 15, MANAGER REQUIRED, and the artifact’s note', () => {
    render('sheet-freeform');
    expect(sheet()!.querySelector('h2')!.textContent).toBe('Other discount');
    expect(sheet()!.querySelector('.discount-tag')!.textContent).toBe('MANAGER REQUIRED');
    expect(inSheet('Percent').getAttribute('aria-pressed')).toBe('true');
    expect(inSheet('Fixed amount').getAttribute('aria-pressed')).toBe('false');
    expect(sheet()!.querySelector('label')!.textContent).toBe('Value — 0 to 100%');
    expect(field().value).toBe('15');
    expect(sheet()!.querySelector('.discount-note')!.textContent).toBe(
      'A manager must enter their PIN before this is applied. Nothing changes on the order until they do.'
    );
    expect([...sheet()!.querySelectorAll('.sheet__foot button')].map((b) => b.textContent)).toEqual(['Back', 'Apply']);
  });

  it('sheet-freeform: Back returns to the picker', () => {
    render('sheet-freeform');
    press(inSheet('Back'));
    expect(sheet()!.querySelector('h2')!.textContent).toBe('Discount');
    expect(document.activeElement).toBe(sheet());
  });

  it.each([
    ['sheet-remove', 'Staff meal — 10%', '−40.500', 'Applied by Ana R. at 19:44. Preset, no approval.', 'Staff meal 10%'],
    ['sheet-remove-freeform', 'Other discount — 15%', '−60.750', 'Applied by Ana R. at 19:44. Free-form, approved by M. Iqbal.', 'Other discount 15%'],
  ] as const)('%s: the applied discount, as the panel beside it shows it', (state, name, amount, note, panelLabel) => {
    render(state);
    const card = sheet()!.querySelector('.discount-applied')!;
    expect(card.querySelector('.discount-applied__title')!.textContent).toBe('Currently applied');
    expect([...card.querySelectorAll('.discount-applied__row span')].map((s) => s.textContent)).toEqual([name, amount]);
    expect(card.querySelector('.discount-applied__note')!.textContent).toBe(note);
    expect(totalsRows()).toContainEqual([panelLabel, amount]);
  });

  it('sheet-remove: only the free-form replacement is gated, as the artifact draws it', () => {
    render('sheet-remove');
    expect([...sheet()!.querySelectorAll<HTMLElement>('.discount-option')].map((b) => [b.textContent, b.dataset.gated])).toEqual([
      ['Replace with another preset', 'false'],
      ['Replace with another amount — needs a manager', 'true'],
      ['Remove the discount', 'false'],
    ]);
  });

  it('sheet-remove-freeform: the panel figures follow the free-form discount', () => {
    render('sheet-remove-freeform');
    expect(totalsRows()).toEqual([
      ['Subtotal', '405.000'],
      ['Other discount 15%', '−60.750'],
      ['Service charge 5%', '17.213'],
      ['Total', '361.463'],
      ['Includes tax 10%', '31.295'],
    ]);
  });

  it('zero: a 100% comp, with no sheet', () => {
    render('zero');
    expect(sheet()).toBeNull();
    expect(device().querySelector('[inert]')).toBeNull();
    expect(lineNames()).toEqual(['Burger', 'Soda', 'Steak']);
    expect(totalsRows()).toEqual([
      ['Subtotal', '405.000'],
      ['Comp 100%', '−405.000'],
      ['Service charge 5%', '0'],
      ['Total', '0'],
      ['Includes tax 10%', '0'],
    ]);
  });

  it('zero: removing the pending Steak keeps the total at zero', () => {
    render('zero');
    const remove = host.querySelector<HTMLButtonElement>('.order-line__remove')!;
    expect(remove.getAttribute('type')).toBe('button');
    act(() => remove.click());
    expect(window.location.search).toBe('?state=zero&gone=steak');
    expect(ORDER_FIXTURES.zero.totalsWithout!.steak!.total).toBe(0n);
    expect(ORDER_FIXTURES.zero.totalsWithout!.steak!.discount!.amount).toBe(-165_000n);
  });
});

// ---- A dialog (acceptance criterion 8) ----

describe.each(SHEET_STATES)('%s: a dialog', (state) => {
  beforeEach(() => render(state));

  it('is one modal dialog, labelled by its heading, holding focus', () => {
    expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(sheet()!.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(sheet()!.getAttribute('aria-labelledby')!)!.tagName).toBe('H2');
    expect(document.activeElement).toBe(sheet());
  });

  it('every live control is inside it, and every one that acts is a <button type="button">', () => {
    for (const el of liveControls(device())) expect(sheet()!.contains(el)).toBe(true);
    expect(sheet()!.querySelectorAll('a')).toHaveLength(0);
    const acting = liveControls(sheet()!).filter((el) => el.id !== 'discount-value');
    for (const el of acting) {
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('type')).toBe('button');
    }
    const inputs = liveControls(sheet()!).filter((el) => el.tagName === 'INPUT');
    expect(inputs.length).toBe(state === 'sheet-freeform' ? 1 : 0);
  });

  it('Escape closes it on the order, with focus on Discount', () => {
    if (state === 'sheet-freeform') escape(); // Back, to the picker, first
    escape();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('default');
    expect(document.activeElement).toBe(device().querySelector(DISCOUNT_FIXTURES[state]!.opener));
    expect(device().querySelector('[inert]')).toBeNull();
  });
});

it('Cancel closes the picker on the order, with focus on Discount', () => {
  render('sheet-discount');
  press(inSheet('Cancel'));
  expect(sheet()).toBeNull();
  expect(urlState()).toBe('default');
  expect(document.activeElement!.textContent).toBe('Discount');
});

it('the opener is the Discount action on the state the sheets close to', () => {
  render('default');
  const opener = device().querySelector(DISCOUNT_FIXTURES['sheet-discount']!.opener)!;
  expect(opener.textContent).toBe('Discount');
});

// ---- Stylesheet: the gated control keeps the pressed ring ----

describe('pos.css: a gated control is a button that rings', () => {
  const css = readFileSync(resolve(here, '../src/pos.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sel: string) => css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[2] ?? '';

  it('dashed, and nothing else that would override the ring', () => {
    expect(rule('.discount-option--gated').trim()).toBe('border-style: dashed;');
  });

  it('the discount rules set no hover of their own', () => {
    const section = css.slice(css.indexOf('.discount-flow'), css.indexOf('.fixture-states'));
    expect(section).not.toMatch(/:hover/);
  });
});

// ---- F2k: the close bar's Discount opens over the order on screen ----

// The defect this closes: Discount named ?state=sheet-discount, a fixture
// state, so pressing it replaced the order on screen with the table order AND
// handed needsManager that fixture's `applied` — the one fact FR-F8 reads —
// instead of the one the order in front of the cashier carries.

/** Press the close bar's Discount on the order on screen. */
const pressDiscount = () => press(device().querySelector('.order-actions [data-action="discount"]')!);

/** The order carrying a free-form discount, reachable without a sheet (criterion 3). */
const FREEFORM_ORDER: OrderState = 'other-discount';

describe('the discount family opens over the order on screen (criterion 1)', () => {
  it.each(['default', 'overflow', 'zero', FREEFORM_ORDER] as const)('%s: no URL, no history entry', (state) => {
    render(state);
    const before = { search: window.location.search, length: window.history.length, lines: lineNames(), totals: totalsRows() };
    pressDiscount();
    expect(sheet()).not.toBeNull();
    expect(window.location.search).toBe(before.search);
    expect(window.history.length).toBe(before.length);
    // The panel beside the sheet is still the order the cashier was reading.
    expect(lineNames()).toEqual(before.lines);
    expect(totalsRows()).toEqual(before.totals);
  });

  it('overflow: the panel keeps its own ten lines and its own total, not the table order’s', () => {
    render('overflow');
    pressDiscount();
    expect(lineNames()).toHaveLength(10);
    expect(totalsRows().at(-2)).toEqual(['Total', '1.244.250']);
    expect(host.querySelector('.order-panel__title')!.textContent).toBe('Order · T1');
  });

  it('an order carrying nothing opens the picker; an order carrying a discount opens the change sheet', () => {
    // FR-F1 and B-22: one discount per order, so an applied discount can only
    // be removed or replaced (FR-F8), which is the change sheet.
    render('overflow');
    pressDiscount();
    expect(sheet()!.querySelector('#sheet-title')!.textContent).toBe('Discount');
    expect(sheet()!.querySelector('.discount-applied')).toBeNull();

    for (const state of ['default', 'zero', FREEFORM_ORDER] as const) {
      render(state);
      pressDiscount();
      expect(sheet()!.querySelector('#sheet-title')!.textContent).toBe('Change discount');
      const applied = ORDER_FIXTURES[state].applied!;
      expect(sheet()!.querySelector('.discount-applied__row span')!.textContent).toBe(
        `${applied.name} — ${applied.value.kind === 'percent' ? `${applied.value.percent}%` : ''}`
      );
    }
  });

  it('the change sheet takes the discount off the panel’s own subtotal, ?gone= included', () => {
    render('default');
    press(host.querySelector('.order-line[data-line-id="steak"] button.order-line__remove')!);
    expect(totalsRows()[0]).toEqual(['Subtotal', '165.000']);
    pressDiscount();
    // 10% of 165.000, the subtotal the panel shows — not 40.500, the table
    // order's figure the fixture carries.
    expect(sheet()!.querySelectorAll('.discount-applied__row span')[1]!.textContent).toBe('−16.500');
  });

  it('Cancel closes it on the same order, with focus back on Discount', () => {
    render('overflow');
    pressDiscount();
    press(inSheet('Cancel'));
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('overflow');
    expect(lineNames()).toHaveLength(10);
    expect(document.activeElement!.textContent).toBe('Discount');
    expect(device().querySelector('[inert]')).toBeNull();
  });
});

describe('the gate reads the order, not a fixture (criteria 2 and 3)', () => {
  const gatedIn = (name: string) => inSheet(name).dataset.gated === 'true';

  it('free-form applied: replacing with a preset and removing are both gated (FR-F8)', () => {
    render(FREEFORM_ORDER);
    pressDiscount();
    expect(gatedIn('Replace with another preset — needs a manager')).toBe(true);
    expect(gatedIn('Remove the discount — needs a manager')).toBe(true);
    // And every preset behind that door is gated too.
    press(inSheet('Replace with another preset — needs a manager'));
    for (const p of PRESETS) expect(gatedIn(`${p.name} — ${p.value.kind === 'percent' ? `${p.value.percent}%` : '50.000 off'} — needs a manager`)).toBe(true);
  });

  it('free-form applied: removing reaches the manager prompt, and writes no URL', () => {
    render(FREEFORM_ORDER);
    pressDiscount();
    const before = { search: window.location.search, length: window.history.length };
    press(inSheet('Remove the discount — needs a manager'));
    expect(prompt()).not.toBeNull();
    expect(prompt()!.querySelector('#approval-title')!.textContent).toBe('Manager PIN');
    expect(window.location.search).toBe(before.search);
    expect(window.history.length).toBe(before.length);
  });

  it('free-form applied: replacing with a preset reaches the manager prompt', () => {
    render(FREEFORM_ORDER);
    pressDiscount();
    press(inSheet('Replace with another preset — needs a manager'));
    press(inSheet('Regular customer — 5% — needs a manager'));
    expect(prompt()).not.toBeNull();
    expect(prompt()!.textContent).toContain('Replace Other discount 15%');
  });

  it('preset applied: replacing with a preset and removing are both ungated', () => {
    render('default');
    pressDiscount();
    expect(gatedIn('Replace with another preset')).toBe(false);
    expect(gatedIn('Remove the discount')).toBe(false);
    press(inSheet('Remove the discount'));
    expect(prompt()).toBeNull();
    expect(sheet()).toBeNull();
    expect(urlState()).toBe('default');
  });

  it('preset applied: replacing with a free-form is gated (FR-F3)', () => {
    render('default');
    pressDiscount();
    expect(gatedIn('Replace with another amount — needs a manager')).toBe(true);
  });

  it('nothing applied: a preset is ungated and free-form is gated (FR-F2, FR-F3)', () => {
    render('overflow');
    pressDiscount();
    for (const p of PRESETS) expect(inSheet(`${p.name} — ${p.value.kind === 'percent' ? `${p.value.percent}%` : '50.000 off'}`).dataset.gated).toBe('false');
    expect(gatedIn('Other amount — needs a manager')).toBe(true);
  });

  // The teeth. These two orders draw the same lines and differ only in the
  // discount they carry, and the fixture's own `applied` is STAFF_MEAL for
  // both. Point the sheet back at the fixture and this pair collapses.
  it('two orders with the same lines gate differently, because the gate reads the order', () => {
    const answers = (['default', FREEFORM_ORDER] as const).map((state) => {
      render(state);
      expect(lineNames()).toEqual(['Burger', 'Soda', 'Steak']);
      pressDiscount();
      return buttons(sheet()!)
        .filter((b) => b.dataset.gated !== undefined)
        .map((b) => b.dataset.gated);
    });
    expect(answers[0]).toEqual(['false', 'true', 'false']);
    expect(answers[1]).toEqual(['true', 'true', 'true']);
  });
});

describe('an order carries its applied discount as a snapshot (criterion 2)', () => {
  it('every fixture’s snapshot and its printed discount row are the same discount', () => {
    for (const { id } of ORDER_STATES) {
      const fixture = ORDER_FIXTURES[id];
      expect(Boolean(fixture.applied)).toBe(Boolean(fixture.totals.discount));
      if (!fixture.applied) continue;
      // The snapshot's source is the fact FR-F8 reads; the row is the same
      // discount printed, so its label and amount must agree with it.
      const { label, amount } = fixture.totals.discount!;
      expect(label).toBe(`${fixture.applied.name} ${fixture.applied.value.kind === 'percent' ? `${fixture.applied.value.percent}%` : ''}`.trim());
      expect(amount).toBe(-discountAmount(fixture.totals.subtotal, fixture.applied.value));
      for (const totals of Object.values(fixture.totalsWithout ?? {})) {
        expect(totals.discount!.amount).toBe(-discountAmount(totals.subtotal, fixture.applied.value));
      }
    }
  });

  it('other-discount is the free-form order, and the only non-sheet one', () => {
    const carrying = ORDER_STATES.filter(({ id }) => ORDER_FIXTURES[id].applied?.source === 'free-form').map((s) => s.id);
    expect(carrying).toEqual(['sheet-remove-freeform', FREEFORM_ORDER]);
    expect(ORDER_FIXTURES[FREEFORM_ORDER].applied).toEqual(OTHER_15);
    // Same order as sheet-remove-freeform draws, without the sheet.
    expect(ORDER_FIXTURES[FREEFORM_ORDER].totals).toEqual(ORDER_FIXTURES['sheet-remove-freeform'].totals);
    render(FREEFORM_ORDER);
    expect(sheet()).toBeNull();
    expect(totalsRows()).toEqual([
      ['Subtotal', '405.000'],
      ['Other discount 15%', '−60.750'],
      ['Service charge 5%', '17.213'],
      ['Total', '361.463'],
      ['Includes tax 10%', '31.295'],
    ]);
  });
});

// ---- The change sheet's application history belongs to one application ----

// Ruled 2026-09-21 after review. F2k first derived this line from the
// snapshot's `source`, which handed Comp the actor and time the artifact
// attaches to Staff meal — asserting who comped this order and when, which
// nobody established. The gap is drawn rather than filled.

describe('appliedNote is the order’s own, never derived from the discount’s source', () => {
  it('the artifact’s Staff meal note reaches the change sheet on the order it describes', () => {
    render('default');
    pressDiscount();
    expect(sheet()!.querySelector('.discount-applied__note')!.textContent).toBe(
      'Applied by Ana R. at 19:44. Preset, no approval.'
    );
  });

  it('zero carries no note, and the change sheet draws the gap', () => {
    // Comp is a preset, as Staff meal is. A note derived from `source` would
    // give this order Staff meal's actor and time; this is that test.
    expect(ORDER_FIXTURES['zero'].applied!.source).toBe('preset');
    expect(ORDER_FIXTURES['zero'].appliedNote).toBeUndefined();
    render('zero');
    pressDiscount();
    expect(sheet()!.querySelector('#sheet-title')!.textContent).toBe('Change discount');
    expect(sheet()!.querySelector('.discount-applied__row span')!.textContent).toBe('Comp — 100%');
    expect(sheet()!.querySelector('.discount-applied__note')).toBeNull();
  });

  it('no order borrows another’s application history', () => {
    // Every note on an order is one of the two written down, and each belongs
    // to the application it describes: the artifact's Staff meal line, and
    // FE-007's provisional free-form line.
    for (const { id } of ORDER_STATES) {
      const { applied, appliedNote } = ORDER_FIXTURES[id];
      if (appliedNote === undefined) continue;
      expect(applied).toBeDefined();
      expect(appliedNote).toBe(applied!.source === 'preset' ? STAFF_MEAL_NOTE : OTHER_15_NOTE);
      // A note is only ever the preset one when the discount *is* Staff meal.
      if (appliedNote === STAFF_MEAL_NOTE) expect(applied).toEqual(STAFF_MEAL);
    }
  });
});
