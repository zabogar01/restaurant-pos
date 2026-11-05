// @vitest-environment jsdom
import { rateFromPercent, rateFromPpm } from '@pos/money';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POLL_MS } from '../src/catalog/catalogStore.js';
import type { CatalogPreset, CatalogStore } from '../src/catalog/types.js';
import { CatalogProvider } from '../src/catalog/useCatalog.js';
import { discountAmount, percentFromPpm, presetOf, valueText } from '../src/discount.js';
import { STAFF_MEAL } from '../src/discountFixtures.js';
import { formatAmount } from '../src/money.js';
import type { OrderView } from '../src/orderFixtures.js';
import { useOrderStore, type LiveOrderStore } from '../src/orderStore.js';
import {
  FAILED,
  MEALS,
  NASI,
  SATE,
  TEA,
  UNAVAILABLE,
  makeCatalogHarness,
  menuOf,
  mountServed,
  ok,
  type CatalogHarness,
  type ServedPreset,
} from './served-harness.js';

// PHASE1-S7b3: the POS preset picker reads the real active presets (plan S7, consult C4 items 9 and 10, the owner's
// ruling on OQ1, DESIGN-021's rule 12). The screen is the very one the fixture tests draw, over the real catalog store
// with its two reads stubbed (served-harness.tsx). Layout is not measurable in jsdom: what is asserted is structure,
// names, state, focus and the figures on the totals.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The server's order. Every value a picker can show: whole and fractional percents, a fixed amount above any
// subtotal, and the two zeros.
const COMP: ServedPreset = { id: 'comp', name: 'Comp', ppm: '1000000' };
const REGULAR: ServedPreset = { id: 'regular', name: 'Regular guest', ppm: '123456' };
const RECOVERY: ServedPreset = { id: 'recovery', name: 'Service recovery', amount: '99999999' };
const ZERO_AMOUNT: ServedPreset = { id: 'zero-amount', name: 'Zero amount', amount: '0' };
const ZERO_RATE: ServedPreset = { id: 'zero-rate', name: 'Zero percent', ppm: '0' };
const SERVED = [COMP, REGULAR, RECOVERY, ZERO_AMOUNT, ZERO_RATE];

let h: CatalogHarness;
let screen: ReturnType<typeof mountServed> | undefined;

// A browser cannot focus an element inside an inert subtree; jsdom has no `inert`. The menu region behind the
// sheet is inert while the sheet is open, and its own *Try again* must not take focus in these tests as it
// cannot in a browser.
const focusOf = HTMLElement.prototype.focus;
beforeEach(() => {
  HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
    if (this.closest('[inert]')) return;
    focusOf.call(this, options);
  };
});

afterEach(() => {
  HTMLElement.prototype.focus = focusOf;
  screen?.unmount();
  screen = undefined;
  window.history.replaceState(null, '', '/pos/order');
});

/** The served screen on an order, with the picker open when the state is one that opens it. */
async function open(presets: ServedPreset[] = SERVED, state: OrderView['state'] = 'sheet-discount') {
  h = makeCatalogHarness(menuOf(1, MEALS, [NASI, SATE, TEA], presets));
  screen = mountServed(h, { state });
  await h.settle();
  return screen.host;
}

/** The same screen, its first read answered by `first`. */
async function openWith(first: 'hang' | typeof FAILED | typeof UNAVAILABLE, state: OrderView['state'] = 'sheet-discount') {
  h = makeCatalogHarness(null);
  h.menu(first);
  screen = mountServed(h, { state });
  await h.settle();
}

let version = 1;
/** A change the poll brings: the revision moves and the menu read answers the new body. */
async function poll(presets: ServedPreset[]) {
  version += 1;
  h.revision(ok({ version }));
  h.menu(ok(menuOf(version, MEALS, [NASI, SATE, TEA], presets)));
  await h.advance(POLL_MS);
}

const host = () => screen!.host;
const q = (selector: string) => host().querySelector<HTMLElement>(selector);
const all = (selector: string) => [...host().querySelectorAll<HTMLElement>(selector)];
const press = (el: Element | null) => act(() => (el as HTMLElement).click());
const focus = (el: HTMLElement) => act(() => el.focus());
const key = (el: Element, k: string, shift = false) =>
  act(() => void el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: shift, bubbles: true })));
const escape = () => act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
const sheet = () => q('.sheet[role="dialog"]');
const entries = () => all('.served-preset');
const names = () => entries().map((e) => e.getAttribute('aria-label'));
const entry = (id: string) => q(`[data-preset="${id}"]`)!;
const heading = () => q('#preset-heading')!;
const retry = () => q('[data-action="preset-retry"]');
const totalsRows = () => all('.totals__row').map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]);
const inSheet = (label: string) => [...sheet()!.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === label)!;
const OTHER = 'Other amount — needs a manager';

// ---- 2. the exact conversion ----

describe('2. percentFromPpm is exact, and round-trips with rateFromPercent', () => {
  it.each([
    [0n, '0'],
    [1n, '0.0001'],
    [10_000n, '1'],
    [123_456n, '12.3456'],
    [1_000_000n, '100'],
  ])('%s ppm is %s', (ppm, percent) => {
    expect(percentFromPpm(rateFromPpm(ppm))).toBe(percent);
    expect(rateFromPercent(percentFromPpm(rateFromPpm(ppm)))).toBe(ppm);
  });

  it('no trailing zero is kept, and every rate that is a whole number of ten-thousandths of a percent returns', () => {
    expect(percentFromPpm(rateFromPpm(125_000n))).toBe('12.5');
    for (const ppm of [2n, 99n, 100n, 100_001n, 999_999n]) expect(rateFromPercent(percentFromPpm(rateFromPpm(ppm)))).toBe(ppm);
  });

  it('a served preset becomes the stand-in’s, active, with the canonical percent string', () => {
    const served: CatalogPreset = { id: 'p', name: 'P', value: { kind: 'PERCENTAGE', rate: rateFromPpm(123_456n) } };
    expect(presetOf(served)).toEqual({ id: 'p', name: 'P', value: { kind: 'percent', percent: '12.3456' }, active: true });
    expect(presetOf({ id: 'q', name: 'Q', value: { kind: 'FIXED', amount: 99_999_999n } })).toEqual({
      id: 'q',
      name: 'Q',
      value: { kind: 'fixed', amount: 99_999_999n },
      active: true,
    });
  });
});

// ---- 3. rule 5: the decimal comma ----

describe('3. a percent reads with a decimal comma and no trailing zeros', () => {
  it('valueText', () => {
    expect(valueText({ kind: 'percent', percent: '12.3456' })).toBe('12,3456%');
    expect(valueText({ kind: 'percent', percent: '100' })).toBe('100%');
    expect(valueText({ kind: 'percent', percent: '0' })).toBe('0%');
    expect(valueText({ kind: 'percent', percent: '12.50' })).toBe('12,5%');
    expect(valueText({ kind: 'fixed', amount: 99_999_999n })).toBe('99.999.999 off');
  });

  it('the picker entry and its accessible name, the change sheet and the totals once applied', async () => {
    await open();
    expect(entry('regular').getAttribute('aria-label')).toBe('Regular guest — 12,3456%');
    expect(entry('regular').textContent).toBe('Regular guest12,3456%');
    expect(entry('comp').getAttribute('aria-label')).toBe('Comp — 100%');
    expect(entry('zero-rate').getAttribute('aria-label')).toBe('Zero percent — 0%');
    expect(entry('recovery').getAttribute('aria-label')).toBe('Service recovery — 99.999.999 off');
    press(entry('regular'));
    expect(sheet()).toBeNull();
    const off = formatAmount(-discountAmount(405_000n, { kind: 'percent', percent: '12.3456' }));
    expect(totalsRows()).toContainEqual(['Regular guest 12,3456%', off]);
    press(q('[data-action="discount"]'));
    expect(q('.discount-applied__row')!.textContent).toBe(`Regular guest — 12,3456%${off}`);
  });
});

// ---- 1. what the picker lists ----

describe('1. the served picker lists the projection’s presets, in its order', () => {
  it('only those, in the server’s order, zeros included, and no fixture preset', async () => {
    await open();
    expect(names()).toEqual([
      'Comp — 100%',
      'Regular guest — 12,3456%',
      'Service recovery — 99.999.999 off',
      'Zero amount — 0 off',
      'Zero percent — 0%',
    ]);
    for (const fixtureName of ['Staff meal', 'Regular customer']) expect(sheet()!.textContent).not.toContain(fixtureName);
  });

  it('is the screen’s source: another order of the same list is drawn in that order', async () => {
    await open([ZERO_RATE, COMP]);
    expect(names()).toEqual(['Zero percent — 0%', 'Comp — 100%']);
  });

  it('draws DESIGN-021’s M-3: title, note, group, two columns, Anything else, and the footer’s Cancel', async () => {
    await open();
    expect(sheet()!.getAttribute('aria-labelledby')).toBe('sheet-title');
    expect(q('#sheet-title')!.textContent).toBe('Discount');
    expect(q('.discount-aside')!.textContent).toBe('One per order');
    expect(heading().textContent).toBe('Presets — no approval needed');
    expect(entry('comp').querySelectorAll('span')).toHaveLength(2);
    expect([...sheet()!.querySelectorAll('.sheet__label')].map((l) => l.textContent)).toEqual(['Presets — no approval needed', 'Anything else']);
    expect(inSheet(OTHER)).toBeDefined();
    expect(q('[data-action="served-preset-cancel"]')!.textContent).toBe('Cancel');
  });
});

// ---- 5. applying ----

describe('5. pressing an entry applies it with no approval', () => {
  it('a percent preset: the totals show it, no prompt', async () => {
    await open();
    press(entry('comp'));
    expect(q('.modal[role="dialog"]')).toBeNull();
    expect(sheet()).toBeNull();
    expect(totalsRows()).toContainEqual(['Comp 100%', '−405.000']);
  });

  it('a fixed amount above the subtotal is capped on the totals while its entry shows the stored value (FR-M5)', async () => {
    await open();
    expect(entry('recovery').getAttribute('aria-label')).toBe('Service recovery — 99.999.999 off');
    // The visible value is the stored one too, not the figure the totals will show.
    expect(entry('recovery').textContent).toBe('Service recovery99.999.999 off');
    press(entry('recovery'));
    expect(totalsRows()).toContainEqual(['Service recovery 99.999.999 off', '−405.000']);
  });
});

// ---- 4. the snapshot ----

describe('4. an applied preset keeps its snapshot when it is later edited or deactivated (FR-F4, FR-F5)', () => {
  it('the totals and the change sheet read the order’s own name and value', async () => {
    await open();
    press(entry('regular'));
    const off = formatAmount(-discountAmount(405_000n, { kind: 'percent', percent: '12.3456' }));
    await poll([COMP, { id: 'regular', name: 'Returning guest', ppm: '200000' }, RECOVERY]);
    expect(totalsRows()).toContainEqual(['Regular guest 12,3456%', off]);
    await poll([COMP, RECOVERY]);
    expect(totalsRows()).toContainEqual(['Regular guest 12,3456%', off]);
    press(q('[data-action="discount"]'));
    expect(q('.discount-applied__row')!.textContent).toBe(`Regular guest — 12,3456%${off}`);
  });
});

// ---- 6. the press reads the list now ----

describe('6. a preset deactivated after the picker drew and before the press is refused by the store', () => {
  /** A catalog store whose presets a test changes by hand, with no render in between. */
  function controllable(initial: CatalogPreset[]) {
    let snapshot = {
      menu: { version: 1, categories: [], items: [], presets: initial },
      read: 'ready',
      failure: null,
      outOfDate: false,
      availabilityChanges: 0,
    } as const;
    const listeners = new Set<() => void>();
    const store: CatalogStore = {
      kind: 'real',
      getSnapshot: () => snapshot,
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      start: () => () => {},
      retry: () => {},
    };
    return {
      store,
      set(presets: CatalogPreset[]) {
        snapshot = { ...snapshot, menu: { ...snapshot.menu, presets } };
        for (const l of listeners) l();
      },
    };
  }

  const served = (id: string): CatalogPreset => ({ id, name: id, value: { kind: 'PERCENTAGE', rate: rateFromPercent('7') } });

  it('refuses it as unknown-preset, changes nothing, and the order is the same object', () => {
    const catalog = controllable([served('a'), served('b')]);
    const host = document.createElement('div');
    document.body.append(host);
    const root: Root = createRoot(host);
    let first: LiveOrderStore | undefined;
    let latest!: LiveOrderStore;
    function Probe() {
      latest = useOrderStore({ state: 'default' });
      first ??= latest;
      return null;
    }
    act(() =>
      root.render(
        <CatalogProvider store={catalog.store}>
          <Probe />
        </CatalogProvider>
      )
    );
    const before = latest.order;
    // The picker drew with both. 'b' goes; the handler the first render handed out is the press.
    act(() => catalog.set([served('a')]));
    let outcome!: ReturnType<LiveOrderStore['changeDiscount']>;
    act(() => {
      outcome = first!.changeDiscount({ kind: 'preset', presetId: 'b' }, 'direct');
    });
    expect(outcome).toEqual({ refused: 'unknown-preset' });
    expect(latest.order.applied).toBe(STAFF_MEAL);
    expect(latest.order.groups).toBe(before.groups);
    // And the one still on the list is applied, from the list as it is now.
    act(() => {
      outcome = first!.changeDiscount({ kind: 'preset', presetId: 'a' }, 'direct');
    });
    expect(outcome).toEqual({});
    expect(latest.order.applied).toEqual({ source: 'preset', name: 'a', value: { kind: 'percent', percent: '7' }, presetId: 'a' });
    act(() => root.unmount());
    host.remove();
  });

  it('on the screen the sheet stays when the store refuses, and adds no sentence', async () => {
    // The refusal is the screen's own path: a store that answers `unknown-preset` leaves the picker, the order and
    // the words as they were (DESIGN-021 dropped *Nothing was applied* under C4).
    await open([COMP, REGULAR]);
    const before = totalsRows();
    h.revision(ok({ version: 9 }));
    h.menu(ok(menuOf(9, MEALS, [NASI, SATE, TEA], [COMP])));
    await h.advance(POLL_MS);
    expect(q('[data-preset="regular"]')).toBeNull();
    expect(sheet()).not.toBeNull();
    expect(totalsRows()).toEqual(before);
    expect(q('.notice')).toBeNull();
  });
});

// ---- 7. the read states ----

describe('7. loading, the two failures and no active presets', () => {
  it('loading: LOADING PRESETS as a status, Other amount live', async () => {
    await openWith('hang');
    const status = q('.served-presets__loading')!;
    expect(status.textContent).toBe('LOADING PRESETS');
    expect(status.getAttribute('role')).toBe('status');
    expect(entries()).toHaveLength(0);
    press(inSheet(OTHER));
    expect(q('#sheet-title')!.textContent).toBe('Other discount');
  });

  it.each([
    ['unavailable', UNAVAILABLE, 'The system is unavailable', 'Wait a moment, then try again.'],
    ['unexpected', FAILED, 'Something went wrong', 'Try again. If the problem continues, ask a manager for help.'],
  ] as const)('a failed first read, %s: its own words, an alert, Try again, and Other amount live', async (_name, reply, title, body) => {
    await openWith(reply);
    const alert = sheet()!.querySelector('[role="alert"]')!;
    expect(alert.querySelector('.notice__title')!.textContent).toBe(title);
    expect(alert.textContent).toContain(body);
    expect(retry()!.textContent).toBe('Try again');
    expect(entries()).toHaveLength(0);
    press(inSheet(OTHER));
    expect(q('#sheet-title')!.textContent).toBe('Other discount');
  });

  it('Try again calls the catalog store’s retry, repeats only the menu read, and a success draws the list', async () => {
    await openWith(FAILED);
    const revisions = h.count('revision');
    const menus = h.count('menu');
    h.menu(ok(menuOf(1, MEALS, [NASI, SATE, TEA], [COMP, REGULAR])));
    press(retry());
    await h.settle();
    expect(h.count('menu')).toBe(menus + 1);
    expect(h.count('revision')).toBe(revisions);
    expect(retry()).toBeNull();
    expect(names()).toEqual(['Comp — 100%', 'Regular guest — 12,3456%']);
  });

  it('no active presets: the sentence, and Other amount', async () => {
    await open([]);
    expect(q('.served-presets__none')!.textContent).toBe('No active presets. A manager can add or activate a preset in the back office.');
    expect(entries()).toHaveLength(0);
    press(inSheet(OTHER));
    expect(q('#sheet-title')!.textContent).toBe('Other discount');
  });

  it('Possibly out of date draws nothing of its own: the list stays', async () => {
    await open([COMP]);
    h.revision(FAILED);
    await h.advance(POLL_MS * 3);
    expect(names()).toEqual(['Comp — 100%']);
    expect(q('.notice')).toBeNull();
  });
});

// ---- 8. between polls ----

describe('8. the open picker follows the live list', () => {
  it('an edited preset’s row updates in place, a deactivated one leaves, a new one arrives in the server’s order, with no notice', async () => {
    await open([COMP, REGULAR, RECOVERY]);
    const row = entry('regular');
    await poll([COMP, { id: 'regular', name: 'Returning guest', ppm: '125000' }, RECOVERY]);
    expect(entry('regular')).toBe(row);
    expect(row.getAttribute('aria-label')).toBe('Returning guest — 12,5%');
    expect(row.textContent).toBe('Returning guest12,5%');
    expect(q('.notice')).toBeNull();
    expect(sheet()!.querySelector('[role="status"], [role="alert"]')).toBeNull();

    await poll([COMP, RECOVERY]);
    expect(names()).toEqual(['Comp — 100%', 'Service recovery — 99.999.999 off']);
    expect(sheet()!.querySelector('[role="status"], [role="alert"]')).toBeNull();

    await poll([COMP, ZERO_RATE, RECOVERY]);
    expect(names()).toEqual(['Comp — 100%', 'Zero percent — 0%', 'Service recovery — 99.999.999 off']);
  });

  it('the last one leaving draws the no-presets state, and Other amount stays', async () => {
    await open([COMP]);
    await poll([]);
    expect(entries()).toHaveLength(0);
    expect(q('.served-presets__none')).not.toBeNull();
    expect(inSheet(OTHER)).toBeDefined();
  });
});

// ---- 9. focus ----

describe('9. focus', () => {
  const titleHasFocus = () => document.activeElement === q('#sheet-title');

  it('M-3 opens on its heading in the ready, loading and failed states, never on Try again', async () => {
    await open();
    expect(titleHasFocus()).toBe(true);
    screen!.unmount();
    await openWith('hang');
    expect(titleHasFocus()).toBe(true);
    screen!.unmount();
    await openWith(FAILED);
    expect(retry()).not.toBeNull();
    expect(titleHasFocus()).toBe(true);
  });

  it('a successful retry with focus on Try again sends focus to Presets — no approval needed', async () => {
    await openWith(FAILED);
    focus(retry()!);
    h.menu(ok(menuOf(1, MEALS, [NASI, SATE, TEA], [COMP])));
    press(retry());
    await h.settle();
    expect(retry()).toBeNull();
    expect(document.activeElement).toBe(heading());
  });

  it('a failed retry with focus on Try again puts focus back on the new Try again; focus elsewhere is left alone', async () => {
    await openWith(FAILED);
    focus(retry()!);
    press(retry());
    await h.settle();
    expect(document.activeElement).toBe(retry());
    // Focus on the heading: a later failure does not take it.
    focus(q('#sheet-title')!);
    press(retry());
    await h.settle();
    expect(titleHasFocus()).toBe(true);
  });

  it('a deactivated preset that had focus sends it to the group heading; an edited one keeps it', async () => {
    await open([COMP, REGULAR, RECOVERY]);
    focus(entry('regular'));
    await poll([COMP, { id: 'regular', name: 'Returning guest', ppm: '125000' }, RECOVERY]);
    expect(document.activeElement).toBe(entry('regular'));
    await poll([COMP, RECOVERY]);
    expect(document.activeElement).toBe(heading());
  });

  it('a removed preset that was not focused moves nothing', async () => {
    await open([COMP, REGULAR]);
    focus(entry('comp'));
    await poll([COMP]);
    expect(document.activeElement).toBe(entry('comp'));
  });

  it('Tab and Shift-Tab stay inside, even when the read failed', async () => {
    await open([COMP]);
    const controls = [...sheet()!.querySelectorAll<HTMLElement>('button')];
    focus(controls[controls.length - 1]!);
    key(controls[controls.length - 1]!, 'Tab');
    expect(document.activeElement).toBe(controls[0]);
    focus(q('#sheet-title')!);
    key(q('#sheet-title')!, 'Tab', true);
    expect(document.activeElement).toBe(controls[controls.length - 1]);
    screen!.unmount();

    await openWith(FAILED);
    const failed = [...sheet()!.querySelectorAll<HTMLElement>('button')];
    focus(failed[failed.length - 1]!);
    key(failed[failed.length - 1]!, 'Tab');
    expect(document.activeElement).toBe(failed[0]);
    expect(failed[0]).toBe(retry());
  });

  it.each([
    ['Cancel', () => press(q('[data-action="served-preset-cancel"]'))],
    ['Escape', () => escape()],
  ] as const)('%s closes the sheet and returns focus to the opener', async (_name, close) => {
    await open(SERVED, 'default');
    const opener = q('[data-action="discount"]')!;
    press(opener);
    press(inSheet('Replace with another preset'));
    expect(heading().textContent).toBe('Presets — no approval needed');
    close();
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

// ---- 10. FR-F8 in the served picker ----

describe('10. over a free-form discount the served picker is gated; over a preset or nothing it is not', () => {
  it('over free-form: the gated label, every entry gated, and a press asks for the manager', async () => {
    await open(SERVED, 'sheet-remove-freeform');
    press(inSheet('Replace with another preset — needs a manager'));
    expect(heading().textContent).toBe('Presets — need a manager');
    for (const e of entries()) expect(e.dataset.gated).toBe('true');
    expect(entry('comp').getAttribute('aria-label')).toBe('Comp — 100% — needs a manager');
    press(entry('comp'));
    expect(q('.modal[role="dialog"]')).not.toBeNull();
    expect(totalsRows()).toContainEqual(['Other discount 15%', '−60.750']);
  });

  it('over a preset: not gated, and a press applies at once', async () => {
    await open(SERVED, 'sheet-discount');
    expect(heading().textContent).toBe('Presets — no approval needed');
    for (const e of entries()) expect(e.dataset.gated).toBe('false');
    press(entry('comp'));
    expect(q('.modal[role="dialog"]')).toBeNull();
    expect(totalsRows()).toContainEqual(['Comp 100%', '−405.000']);
  });

  it('over nothing: not gated', async () => {
    await open(SERVED, 'sheet-discount');
    press(q('[data-action="served-preset-cancel"]'));
    press(q('[data-action="discount"]'));
    press(inSheet('Remove the discount'));
    press(q('[data-action="discount"]'));
    expect(q('#sheet-title')!.textContent).toBe('Discount');
    expect(heading().textContent).toBe('Presets — no approval needed');
    for (const e of entries()) expect(e.dataset.gated).toBe('false');
  });
});

// ---- 11. the two pickers, pinned ----

describe('11. the served picker is DESIGN-021’s; the fixture picker keeps its reviewed layout', () => {
  let fixtureHost: HTMLDivElement;
  let fixtureRoot: Root;

  beforeEach(() => {
    fixtureHost = document.createElement('div');
    document.body.append(fixtureHost);
    fixtureRoot = createRoot(fixtureHost);
  });
  afterEach(() => {
    act(() => fixtureRoot.unmount());
    fixtureHost.remove();
  });

  it('the fixture picker has neither served-preset-cancel nor Anything-else’s two-column entries, and lists the four fixture presets', async () => {
    const { OrderScreen } = await import('../src/OrderPanel.js');
    window.history.replaceState(null, '', '/pos/order?state=sheet-discount');
    act(() => fixtureRoot.render(<OrderScreen view={{ state: 'sheet-discount' }} />));
    const picker = fixtureHost.querySelector('.sheet[role="dialog"]')!;
    expect(picker.querySelector('[data-action="served-preset-cancel"]')).toBeNull();
    expect(picker.querySelector('.served-preset')).toBeNull();
    expect(picker.querySelector('#preset-heading')).toBeNull();
    expect([...picker.querySelectorAll('.discount-option')].map((b) => b.textContent)).toEqual([
      'Staff meal — 10%',
      'Regular customer — 5%',
      'Service recovery — 50.000 off',
      'Comp — 100%',
      'Other amount — needs a manager',
    ]);
  });
});
