// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIRE_ACTION, sendableLines } from '../src/fire.js';
import { MENU_FIXTURES, originFacts } from '../src/menuFixtures.js';
import { OrderScreen } from '../src/OrderPanel.js';
import { ORDER_FIXTURES, ORDER_STATES, orderVariant, type Delivery, type OrderState, type OrderView } from '../src/orderFixtures.js';
import { PosRoutes } from '../src/PosRoutes.js';
import { useOrderStore, type OrderStore } from '../src/orderStore.js';

// FE-022: Send to kitchen sends, in one press (ARCH-002 §3, DESIGN-007 Part C).
// Criteria 9-13 of the task; T-1..T-8 are in fire-order.test.ts.
//
// The shape this file walks, on purpose: FE-021's lesson that one control or
// value shared across states hides the state where it is wrong. The fire
// control and every round heading are checked over every ORDER_STATES id, not
// only the ones the task names.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let originalScrollIntoView: Element['scrollIntoView'] | undefined;
const scrolled: Array<{ el: Element; arg: unknown; status: string | null }> = [];

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  window.history.replaceState(null, '', '/pos/order');
  // jsdom has no layout and no scrollIntoView: record what would be scrolled, and what the screen read at that moment.
  scrolled.length = 0;
  originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element, arg?: unknown) {
    scrolled.push({ el: this, arg, status: statusLine()?.textContent ?? null });
  };
});

afterEach(() => {
  if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView;
  else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  act(() => root.unmount());
  host.remove();
  window.history.replaceState(null, '', '/pos/order');
  vi.useRealTimers();
});

const press = (el: Element) => act(() => (el as HTMLElement).click());
const buttonNamed = (name: string) =>
  [...host.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!;

let mount = 0;
const CLOCK = () => '20:14';
function render(state: OrderState, gone?: string, injected = true) {
  const view: OrderView = gone ? { state, gone } : { state };
  window.history.replaceState(null, '', `/pos/order?state=${state}${gone ? `&gone=${gone}` : ''}`);
  act(() => root.render(<OrderScreen key={++mount} view={view} {...(injected && { clock: CLOCK })} />));
}

const fireControl = () => host.querySelector<HTMLElement>(`.order-actions [data-action="${FIRE_ACTION}"]`);
const settle = () => host.querySelector<HTMLElement>('.order-actions [data-action="settle"]')!;
const headings = () => [...host.querySelectorAll('.round-head__label')].map((h) => h.textContent);
const statusLine = () => host.querySelector('.order-panel [role="status"].order-sent');
const pendingCount = (state: OrderState) =>
  sendableLines(ORDER_FIXTURES[state].groups.flatMap((g) => g.lines)).length;
const labelFor = (n: number) => (n > 0 ? `Send ${n} to kitchen` : 'Send to kitchen');

const ALL = ORDER_STATES.map((s) => s.id);
// A state that draws a sheet, prompt or discount over the panel leaves the panel inert.
const overlaid = () => host.querySelector('[role="dialog"], .sheet') !== null;

describe('9: the count is on the control, in lines, in every state', () => {
  it('fire-ready (Steak × 1 + Fries × 2) reads Send 2 to kitchen, not 3', () => {
    render('fire-ready');
    expect(fireControl()!.textContent).toBe('Send 2 to kitchen');
    expect(fireControl()!.tagName).toBe('BUTTON');
  });

  // Red case: one label for every state, or a count of units.
  it('over every ORDER_STATES id: the label is the pending line count, and it is live exactly when a fire could send', () => {
    for (const state of ALL) {
      render(state);
      const control = fireControl();
      if (orderVariant(ORDER_FIXTURES[state]) === 'quick_sale') {
        expect(control, state).toBeNull();
        continue;
      }
      // The loading skeleton draws no lines and a lock is its own reason the control is off: neither names a count.
      const loading = MENU_FIXTURES[state].loading ?? false;
      const n = loading || ORDER_FIXTURES[state].lock ? 0 : pendingCount(state);
      expect(control!.textContent, state).toBe(labelFor(n));
      const fixture = ORDER_FIXTURES[state];
      const blocked = ORDER_FIXTURES[state].groups
        .flatMap((g) => g.lines)
        .some((l) => l.status === 'pending' && l.itemId !== undefined && (MENU_FIXTURES[state].eightySixed ?? []).includes(l.itemId));
      const live = n > 0 && !loading && !fixture.lock && !blocked && fixture.groups.length > 0;
      expect(control!.tagName, `${state} live=${live}`).toBe(live ? 'BUTTON' : 'SPAN');
    }
  });

  it('with nothing pending Send is off in every state (a live one would read as resend)', () => {
    for (const state of ALL) {
      if (orderVariant(ORDER_FIXTURES[state]) === 'quick_sale' || pendingCount(state) > 0) continue;
      render(state);
      expect(fireControl()!.tagName, state).toBe('SPAN');
      expect(fireControl()!.getAttribute('aria-disabled'), state).toBe('true');
    }
  });

  it('a quick sale still has no fire control', () => {
    render('quick');
    expect(fireControl()).toBeNull();
  });
});

describe('the press', () => {
  it('fire-ready: one press folds the pending group into a queued last round, moves focus to its heading, announces, and goes inert with Settle live', () => {
    render('fire-ready');
    const before = window.history.length;
    press(fireControl()!);

    expect(headings()).toEqual([
      'Round 1 · fired 19:42 · printed',
      'Round 2 · fired 19:58 · printed',
      'Round 3 · fired 20:14 · sending · unconfirmed',
    ]);
    expect(host.textContent).not.toContain('Pending · not sent');
    const head = host.querySelector<HTMLElement>('[data-round="3"]')!;
    expect(document.activeElement).toBe(head);
    expect(statusLine()!.textContent).toBe('Round 3 sent to the kitchen');
    expect(statusLine()!.getAttribute('aria-live')).toBe('polite');
    expect(fireControl()!.tagName).toBe('SPAN');
    expect(fireControl()!.textContent).toBe('Send to kitchen');
    expect(settle().tagName).toBe('BUTTON');
    // The new round's lines carry the fired tag and the emergency banner is fixture-driven, not derived.
    expect(host.querySelector('[data-round="3"] .round-head__tag')?.textContent ?? head.textContent).toContain('MANAGER TO VOID');
    expect(host.querySelector('.emergency-banner')).toBeNull();
    // [INLINE]: no ?state= written, no history entry.
    expect(window.location.search).toBe('?state=fire-ready');
    expect(window.history.length).toBe(before);
  });

  it('never claims printed for what it just sent, and adds no incident', () => {
    render('fire-ready');
    press(fireControl()!);
    expect(headings().at(-1)).not.toMatch(/printed|FAILED|UNKNOWN/);
    expect(host.querySelector('.emergency-banner')).toBeNull();
  });

  it('firing changes no price', () => {
    render('fire-ready');
    const totals = () => [...host.querySelectorAll('.totals dd')].map((d) => d.textContent);
    const before = totals();
    press(fireControl()!);
    expect(totals()).toEqual(before);
  });

  it('the status line goes when a new pending line makes the fire live again', () => {
    render('fire-ready');
    press(fireControl()!);
    press(host.querySelector('.menu-tile[data-item="coffee"]')!);
    press(buttonNamed('Add to order'));
    expect(statusLine()?.textContent ?? '').toBe('');
    expect(fireControl()!.textContent).toBe('Send 1 to kitchen');
  });

  // Red case: the status tied to "nothing is pending" instead of to the press.
  it('A: the status belongs to the press: add then remove never announces it again', () => {
    render('fire-ready');
    press(fireControl()!);
    expect(statusLine()!.textContent).toBe('Round 3 sent to the kitchen');
    press(host.querySelector('.menu-tile[data-item="coffee"]')!);
    press(buttonNamed('Add to order'));
    press(buttonNamed('Remove Coffee'));
    expect(fireControl()!.tagName).toBe('SPAN');
    expect(statusLine()!.textContent).toBe('');
  });

  // Red case: focus() scrolling by itself, or nothing scrolling: round 3's Fries sat below the fold.
  it('B: after a fire the whole new round is brought into view, last line first then heading, with the heading focused and the status already drawn', () => {
    render('fire-ready');
    press(fireControl()!);
    const round = host.querySelector('[data-round="3"]')!;
    const lastRow = host.querySelector('[data-line-id="fire-fries"]')!;
    const mine = scrolled.filter((c) => c.el === round || c.el === lastRow);
    expect(mine.map((c) => c.el)).toEqual([lastRow, round]);
    for (const c of mine) expect(c.arg).toEqual({ block: 'nearest' });
    // The status line has taken its space before the scroll, so it cannot cover the last row afterwards.
    for (const c of mine) expect(c.status).toBe('Round 3 sent to the kitchen');
    expect(document.activeElement).toBe(round);
  });

  it('B: after Add from an item sheet the new pending line is brought into view', () => {
    render('default');
    press(host.querySelector('.menu-tile[data-item="fries"]')!);
    press(buttonNamed('Add to order'));
    const added = [...host.querySelectorAll<HTMLElement>('.order-line[data-line-status="pending"]')].at(-1)!;
    expect(added.textContent).toContain('Fries');
    const calls = scrolled.filter((c) => c.el === added);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.arg).toEqual({ block: 'nearest' });
  });

  it('B: a fire and an Add scroll nothing else, and a mere render scrolls nothing', () => {
    render('default');
    expect(scrolled).toEqual([]);
  });

  // Red case: a second fire merges into round 3 or re-sends it.
  it('fire-then-add: Send 1 makes round 4 holding only the new line', () => {
    render('fire-then-add');
    expect(fireControl()!.textContent).toBe('Send 1 to kitchen');
    press(fireControl()!);
    expect(headings().at(-1)).toBe('Round 4 · fired 20:14 · sending · unconfirmed');
    const round4 = host.querySelector('[data-round="4"]')!.closest('.round-group')!;
    expect([...round4.querySelectorAll('.order-line__name')].map((n) => n.firstChild!.textContent)).toEqual(['Coffee']);
  });

  it('the clock defaults to the browser’s local HH:MM at the press', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 7, 5, 30));
    render('fire-ready', undefined, false);
    press(fireControl()!);
    expect(headings().at(-1)).toBe('Round 3 · fired 07:05 · sending · unconfirmed');
  });

  it('a refused fire does nothing: fireblocked stays exactly as drawn', () => {
    render('fireblocked');
    const before = host.querySelector('.order-lines')!.innerHTML;
    expect(fireControl()!.tagName).toBe('SPAN');
    act(() => fireControl()!.click());
    expect(host.querySelector('.order-lines')!.innerHTML).toBe(before);
  });

  // The walk. Red case: a heading or control right in the named states and wrong in another.
  it('over every ORDER_STATES id with a live Send: pressing it makes round n+1 of exactly the pending lines, and leaves every earlier heading alone', () => {
    let pressed = 0;
    for (const state of ALL) {
      render(state);
      const control = fireControl();
      if (!control || control.tagName !== 'BUTTON' || overlaid()) continue;
      expect(MENU_FIXTURES[state].loading ?? false, `${state}: a live Send over an undrawn order`).toBe(false);
      pressed++;
      const expectedLines = ORDER_FIXTURES[state].groups.flatMap((g) => g.lines).filter((l) => l.status === 'pending');
      const rounds = ORDER_FIXTURES[state].groups.flatMap((g) => (g.kind === 'fired' ? [g.round] : []));
      const before = headings().filter((h) => h!.startsWith('Round'));
      press(control);
      const after = headings();
      const next = Math.max(0, ...rounds) + 1;
      expect(after.slice(0, before.length), state).toEqual(before);
      expect(after.at(-1), state).toBe(`Round ${next} · fired 20:14 · sending · unconfirmed`);
      const round = host.querySelector(`[data-round="${next}"]`)!.closest('.round-group')!;
      expect(round.querySelectorAll('.order-line').length, state).toBe(expectedLines.length);
      expect(host.textContent, state).not.toContain('REMOVE FREELY');
      expect(fireControl()!.tagName, state).toBe('SPAN');
      expect(fireControl()!.textContent, state).toBe('Send to kitchen');
    }
    expect(pressed).toBeGreaterThan(3);
  });
});

describe('11: delivery wording', () => {
  const WORDING: ReadonlyArray<[Delivery | null, string]> = [
    ['queued', 'sending · unconfirmed'],
    ['printed', 'printed'],
    ['failed', 'FAILED · not printed'],
    ['unknown', 'UNKNOWN · may have printed'],
    [null, ''],
  ];

  // Red case: `printed ? 'printed' : 'not printed'`.
  it.each(WORDING)('%s reads %j', (delivery, word) => {
    const state = ({ queued: 'fire-queued', printed: 'fire-printed', failed: 'fire-failed', unknown: 'fire-unknown', null: 'overflow' } as const)[
      String(delivery) as 'queued'
    ];
    render(state);
    const round = ORDER_FIXTURES[state].groups.find((g) => g.kind === 'fired' && g.delivery === delivery)!;
    if (round.kind !== 'fired') throw new Error('unreachable');
    const heading = headings().find((h) => h!.startsWith(`Round ${round.round} `));
    expect(heading).toBe(word ? `Round ${round.round} · fired ${round.firedAt} · ${word}` : `Round ${round.round} · fired ${round.firedAt}`);
  });

  it('UNKNOWN never contains "not printed", and only FAILED does — over every state and every round', () => {
    for (const state of ALL) {
      render(state);
      const rounds = ORDER_FIXTURES[state].groups.flatMap((g) => (g.kind === 'fired' ? [g] : []));
      if (MENU_FIXTURES[state].loading) {
        // The skeleton stands in for the lines: no heading is drawn to be wrong.
        expect(headings(), state).toEqual([]);
        continue;
      }
      for (const g of rounds) {
        const heading = headings().find((h) => h!.startsWith(`Round ${g.round} `))!;
        if (g.delivery === 'unknown') expect(heading, state).not.toMatch(/not printed/);
        if (g.delivery === 'failed') expect(heading, state).toMatch(/FAILED/);
        if (g.delivery === null) expect(heading, state).toBe(`Round ${g.round} · fired ${g.firedAt}`);
        if (g.delivery !== 'failed') expect(heading, state).not.toMatch(/not printed/);
      }
    }
  });

  it('a heading under a FAILED banner never says printed alone (fireerror)', () => {
    render('fireerror');
    expect(host.querySelector('.emergency-banner')).not.toBeNull();
    expect(headings()).toEqual(['Round 1 · fired 19:42 · printed', 'Round 2 · fired 19:58 · FAILED · not printed']);
  });

  it('fire-failed and fire-unknown draw the emergency banner in the same class, with their own words', () => {
    render('fire-failed');
    const failed = host.querySelector('.emergency-banner')!;
    expect(failed.textContent).toContain('did not print');
    render('fire-unknown');
    const unknown = host.querySelector('.emergency-banner')!;
    expect(unknown.className).toBe(failed.className);
    expect(unknown.textContent).toContain('may have printed');
    expect(unknown.textContent).toContain('Check with the kitchen before reprinting');
    expect(unknown.textContent).not.toMatch(/did not print|not printed/);
    render('fire-printed');
    expect(host.querySelector('.emergency-banner')).toBeNull();
    render('fire-queued');
    expect(host.querySelector('.emergency-banner')).toBeNull();
  });

  it('fire-failed, fire-unknown: the fire control is inert with nothing pending, so it cannot read as send again', () => {
    for (const state of ['fire-failed', 'fire-unknown', 'fire-printed', 'fire-queued'] as const) {
      render(state);
      expect(fireControl()!.tagName, state).toBe('SPAN');
    }
  });
});

describe('12: idempotence', () => {
  function mountStore(view: OrderView, locked = false) {
    let latest!: OrderStore;
    function Harness() {
      latest = useOrderStore(view, locked);
      return null;
    }
    act(() => root.render(<Harness />));
    return {
      get order() {
        return latest.order;
      },
      fire: (...times: string[]) =>
        act(() => {
          for (const t of times) latest.fire(t);
        }),
    };
  }
  const fired = (s: { order: OrderStore['order'] }) => s.order.groups.filter((g) => g.kind === 'fired').length;

  it('two fire calls in one tick make exactly one round', () => {
    const store = mountStore({ state: 'fire-ready' });
    store.fire('20:14', '20:14');
    expect(fired(store)).toBe(3);
    expect(store.order.groups.some((g) => g.kind === 'pending')).toBe(false);
  });

  it('a double click on the control makes exactly one round', () => {
    render('fire-ready');
    const control = fireControl()!;
    act(() => {
      control.click();
      control.click();
    });
    expect(headings()).toHaveLength(3);
  });

  it('the store refuses on its own: an 86’d pending line, a lock, and a quick sale change nothing', () => {
    const blocked = mountStore({ state: 'fireblocked' });
    const before = blocked.order.groups;
    blocked.fire('20:14');
    expect(blocked.order.groups).toBe(before);

    const locked = mountStore({ state: 'fire-ready' }, true);
    const lockedBefore = locked.order.groups;
    locked.fire('20:14');
    expect(locked.order.groups).toBe(lockedBefore);

    const fixtureLocked = mountStore({ state: 'lock-draft' });
    const fixtureLockedBefore = fixtureLocked.order.groups;
    fixtureLocked.fire('20:14');
    expect(fixtureLocked.order.groups).toBe(fixtureLockedBefore);

    const quick = mountStore({ state: 'quick' });
    const quickBefore = quick.order.groups;
    quick.fire('20:14');
    expect(quick.order.groups).toBe(quickBefore);
  });

  it('an item sheet opened from an 86 state still refuses: the origin’s menu is the one asked (originFacts), not the sheet’s own', () => {
    // sheet-item-steak's own menu 86s nothing; the state it was opened from does.
    const store = mountStore({ state: 'sheet-item-steak', from: 'fireblocked' });
    const before = store.order.groups;
    store.fire('20:14');
    expect(store.order.groups).toBe(before);
  });
});

describe('13: history survives a fire', () => {
  it('from overflow, Add then Fire keeps the voided salad and adds no delivery word to rounds 1-2', () => {
    render('overflow');
    press(host.querySelector('.menu-tile[data-item="burger"]')!);
    press(buttonNamed('Add to order'));
    expect(fireControl()!.textContent).toBe('Send 4 to kitchen');
    press(fireControl()!);
    expect(headings()).toEqual([
      'Round 1 · fired 19:42',
      'Round 2 · fired 19:58',
      'Round 3 · fired 20:14 · sending · unconfirmed',
    ]);
    const voided = host.querySelector('.order-line--voided')!;
    expect(voided.textContent).toContain('Caesar Salad');
    expect(voided.closest('.round-group')!.getAttribute('aria-label')).toBe('Round 1 · fired 19:42');
  });

  it('from zero, the comp survives the fire', () => {
    render('zero');
    const totals = () => [...host.querySelectorAll('.totals dd')].map((d) => d.textContent);
    const before = totals();
    expect(host.querySelector('.totals')!.textContent).toContain('Comp');
    press(fireControl()!);
    expect(totals()).toEqual(before);
    expect(host.querySelector('.totals')!.textContent).toContain('Comp');
  });
});

describe('7: fireblocked’s Show Steak recovery', () => {
  it('names the blocking line, scrolls it into view and focuses it', () => {
    render('fireblocked');
    const show = buttonNamed('Show Steak');
    expect(show).toBeDefined();
    expect(show.closest('.order-notice')).not.toBeNull();
    press(show);
    const row = host.querySelector<HTMLElement>('[data-line-id="steak"] .order-line__target')!;
    expect(document.activeElement).toBe(row);
    expect(scrolled.map((c) => c.el)).toContain(row.closest('li'));
  });

  it('is offered only where there is a refusal, over every state', () => {
    for (const state of ALL) {
      render(state);
      const shows = [...host.querySelectorAll('button')].filter((b) => b.textContent?.startsWith('Show '));
      const noticed = host.querySelector('.order-panel .order-notice') !== null;
      expect(shows.length > 0, state).toBe(noticed);
    }
  });
});

describe('10: the whole-screen walk (FR-G10)', () => {
  it('from /pos/order: add a line, press Send, and Close on POS-04 is reachable once payment is exact', () => {
    window.history.replaceState(null, '', '/pos/order');
    act(() => root.render(<PosRoutes />));
    // The default order carries a pending Steak; without a fire FR-G10 refuses Close.
    press(host.querySelector('.menu-tile[data-item="burger"]')!);
    press(buttonNamed('Add to order'));
    expect(host.querySelector<HTMLElement>('[data-action="fire"]')!.textContent).toBe('Send 2 to kitchen');
    press(host.querySelector('[data-action="fire"]')!);

    expect(host.textContent).not.toContain('Pending · not sent');
    expect(headings().at(-1)).toMatch(/^Round 3 · fired \d\d:\d\d · sending · unconfirmed$/);
    expect(settle().tagName).toBe('BUTTON');

    press(settle());
    expect(window.location.pathname).toBe('/pos/settlement');
    const close = () => host.querySelector<HTMLElement>('[data-action="close-order"]')!;
    expect(host.querySelector('.notice__title')?.textContent ?? '').not.toContain('pending');
    // Pay exact: the amount field opens on the balance.
    press(host.querySelector('[data-action="add-tender"]')!);
    expect(host.querySelector('.settlement-balance__amount')!.textContent).toBe('0');
    expect(close().tagName).toBe('BUTTON');
  });

  it('control: without the fire, the same walk keeps Close inert on the pending lines', () => {
    window.history.replaceState(null, '', '/pos/order');
    act(() => root.render(<PosRoutes />));
    press(host.querySelector('.menu-tile[data-item="burger"]')!);
    press(buttonNamed('Add to order'));
    press(settle());
    press(host.querySelector('[data-action="add-tender"]')!);
    expect(host.querySelector<HTMLElement>('[data-action="close-order"]')!.tagName).toBe('SPAN');
  });
});

describe('C: fireblocked scrolls its blocking row into view on first draw (DESIGN-007)', () => {
  it('scrolls the blocked line, and only where there is a refusal', () => {
    render('fireblocked');
    expect(scrolled.map((c) => [c.el, c.arg])).toEqual([[host.querySelector('[data-line-id="steak"]'), { block: 'nearest' }]]);
    scrolled.length = 0;
    render('default');
    expect(scrolled).toEqual([]);
    render('fireblocked-overflow');
    expect(scrolled.map((c) => c.el)).toEqual([host.querySelector('[data-line-id="of-coffee"]')]);
  });
});

describe('D: fire-heading-width', () => {
  it('draws rounds 1-12, the last reading UNKNOWN, with the design’s figures', () => {
    render('fire-heading-width');
    const h = headings();
    expect(h).toHaveLength(12);
    expect(h.at(-1)).toBe('Round 12 · fired 23:59 · UNKNOWN · may have printed');
    expect(h.slice(0, 11).every((x) => x!.endsWith('printed') && !x!.includes('UNKNOWN'))).toBe(true);
    expect([...host.querySelectorAll('.totals dd')].map((d) => d.textContent)).toContain('713.475');
    expect(host.querySelector('.emergency-banner')!.textContent).toContain('round 12');
    expect(fireControl()!.tagName).toBe('SPAN');
  });
});

describe('E: an item sheet opened from every fire-* origin keeps the panel’s control as it was', () => {
  it.each(['fire-ready', 'fire-queued', 'fire-printed', 'fire-failed', 'fire-unknown', 'fire-then-add', 'fire-heading-width'] as const)(
    '%s',
    (origin) => {
      render(origin);
      const before = [fireControl()!.tagName, fireControl()!.textContent, statusLine()?.textContent];
      press(host.querySelector('.menu-tile[data-item="soda"]')!);
      expect(host.querySelector('.sheet')).not.toBeNull();
      expect([fireControl()!.tagName, fireControl()!.textContent, statusLine()?.textContent]).toEqual(before);
      expect(host.querySelector('.emergency-banner') !== null).toBe(ORDER_FIXTURES[origin].incident !== undefined);
    }
  );
});

describe('F: one accessor for the lock', () => {
  it('originFacts carries the lock of the place, not of the sheet', () => {
    expect(originFacts({ state: 'sheet-item-steak', from: 'lock-draft' }).lock).toBe('draft');
    expect(originFacts({ state: 'sheet-item-steak' }).lock).toBeUndefined();
    expect(originFacts({ state: 'lock-lease' }).lock).toBe('lease');
  });

  // Red case: the panel reading view.state while the store reads the origin.
  it('the panel and the store agree: a view opened from a lock draws Send inert and the store refuses', () => {
    window.history.replaceState(null, '', '/pos/order?state=sheet-item-steak&from=lock-draft');
    act(() => root.render(<OrderScreen key={++mount} view={{ state: 'sheet-item-steak', from: 'lock-draft' }} clock={CLOCK} />));
    expect(fireControl()!.tagName).toBe('SPAN');
    expect(fireControl()!.textContent).toBe('Send to kitchen');
  });
});

describe('round 3: the identity rule is exact, and every lock read has one source', () => {
  function mountStore(view: OrderView, locked = false) {
    let latest!: OrderStore;
    function Harness() {
      latest = useOrderStore(view, locked);
      return null;
    }
    act(() => root.render(<Harness />));
    return {
      get store() {
        return latest;
      },
      run: (f: (s: OrderStore) => void) => act(() => f(latest)),
    };
  }

  // Red case: dropLine/rewriteQuantity allocate a new array though nothing matched.
  it('removeLine and setQuantity with an unknown id keep the groups reference', () => {
    const m = mountStore({ state: 'fire-ready' });
    m.run((s) => s.fire('20:14'));
    const groups = m.store.order.groups;
    m.run((s) => s.removeLine('no-such-line'));
    expect(m.store.order.groups).toBe(groups);
    m.run((s) => s.setQuantity('no-such-line', 3));
    expect(m.store.order.groups).toBe(groups);
  });

  it('a removal that does match still changes it', () => {
    const m = mountStore({ state: 'fire-ready' });
    const groups = m.store.order.groups;
    m.run((s) => s.removeLine('fire-fries'));
    expect(m.store.order.groups).not.toBe(groups);
  });

  it('after a fire, a ?gone= that names no line leaves the status in place', () => {
    render('fire-ready');
    press(fireControl()!);
    expect(statusLine()!.textContent).toBe('Round 3 sent to the kitchen');
    window.history.replaceState(null, '', '/pos/order?state=fire-ready&gone=no-such-line');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(statusLine()!.textContent).toBe('Round 3 sent to the kitchen');
  });

  // Red case: the seed and the post-mount guard read the sheet's own state, not the place's.
  it('a ?gone= from a view opened from a lock drops nothing at seed', () => {
    const seeded = mountStore({ state: 'sheet-item-steak', from: 'lock-draft', gone: 'steak' });
    expect(seeded.store.order.groups.flatMap((g) => g.lines).map((l) => l.id)).toContain('steak');
  });
});
