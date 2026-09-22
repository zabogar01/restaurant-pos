// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FIRE_ACTION, blockingLines, fireRefusal, holdsUnavailable, sendableLines } from '../src/fire.js';
import { MENU_FIXTURES, REJECTED_NOTICE } from '../src/menuFixtures.js';
import { OrderScreen } from '../src/OrderPanel.js';
import { FIRE_INCIDENT, ORDER_FIXTURES, ORDER_STATES, type OrderState, type OrderView } from '../src/orderFixtures.js';

// POS-03's fire and rejection states (F2h): fireblocked (FR-E4, B-17), error
// (B-20) and fireerror (FR-E3), plus the two corrections F2b and F2c deferred
// — the 86 tag on a PENDING line, and the panel's loading skeleton.
//
// The point of the file is that **the fire refusal is a rule, not a picture**.
// FR-E4 blocks the fire "until that line is voided or the item is restored",
// so a refusal drawn from a per-state flag is wrong in exactly the state the
// requirement cares about: the one after the cashier has resolved it.

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
function render(view: OrderState | OrderView) {
  const v = typeof view === 'string' ? { state: view } : view;
  const search = v.gone ? `?state=${v.state}&gone=${v.gone}` : `?state=${v.state}`;
  window.history.replaceState(null, '', `/pos/order${search}`);
  act(() => root.render(<OrderScreen key={++mount} view={v} />));
}

const press = (el: Element) => act(() => (el as HTMLElement).click());
const device = () => host.querySelector('.pos-device')!;
const text = (selector: string) => [...host.querySelectorAll(selector)].map((e) => e.textContent);
const rows = () => [...host.querySelectorAll<HTMLElement>('.order-line')];
const fireControl = () => host.querySelector<HTMLElement>(`.order-actions [data-action="${FIRE_ACTION}"]`)!;
const panelNotice = () => host.querySelector('.order-panel .notice');
const menuNotice = () => host.querySelector('.order-screen__menu .notice');
/** A line's own name, without the 86 tag that may sit beside it. */
const lineNames = () => [...host.querySelectorAll('.order-line__name')].map((n) => n.firstChild!.textContent);
const taggedNames = () =>
  [...host.querySelectorAll('.order-lines .tag-86')].map(
    (t) => t.closest('.order-line')!.querySelector('.order-line__name')!.firstChild!.textContent
  );
/** The whole order as it is drawn: every row's name, status and amount. */
const drawnOrder = () =>
  rows().map((r) => [r.dataset.lineStatus, r.querySelector('.order-line__name')!.firstChild!.textContent, r.querySelector('.order-line__amount')!.textContent]);

const ALL_STATES = ORDER_STATES.map((s) => s.id);

// ---------------------------------------------------------------------------
// The rule itself (acceptance criterion 2)
// ---------------------------------------------------------------------------

describe('fire.ts: FR-E4 read off the order, never off a state', () => {
  const steak = { id: 'steak', name: 'Steak', itemId: 'steak', status: 'pending' as const };
  const soda = { id: 'soda', name: 'Soda', itemId: 'soda', status: 'fired' as const };
  const cheese = { id: 'of-cheese', name: 'Cheesecake', status: 'pending' as const };

  it('blocks on a PENDING line whose item is 86’d', () => {
    expect(blockingLines([soda, steak], ['steak'])).toEqual([steak]);
    expect(holdsUnavailable(steak, ['steak'])).toBe(true);
  });

  it('does not block when that item is available again (FR-E4: "or the item is restored")', () => {
    expect(blockingLines([soda, steak], [])).toEqual([]);
    expect(blockingLines([soda, steak], ['burger'])).toEqual([]);
  });

  it('never blocks on a FIRED line: availability says nothing about work already in the kitchen', () => {
    const firedSteak = { ...steak, status: 'fired' as const };
    expect(blockingLines([firedSteak], ['steak'])).toEqual([]);
    expect(holdsUnavailable(firedSteak, ['steak'])).toBe(false);
  });

  it('never blocks on a VOIDED line: it is not on the order any more', () => {
    expect(blockingLines([{ ...steak, status: 'voided' as const }], ['steak'])).toEqual([]);
  });

  it('never blocks on a line with no item: overflow’s Cheesecake has no tile', () => {
    expect(blockingLines([cheese], ['steak', 'of-cheese', 'cheese'])).toEqual([]);
    expect(ORDER_FIXTURES.overflow.groups.flatMap((g) => g.lines).find((l) => l.id === 'of-cheese')!.itemId).toBeUndefined();
  });

  it('answers with every blocking line, so the notice can count and name them', () => {
    const wine = { id: 'of-wine', name: 'House Wine', itemId: 'wine', status: 'pending' as const };
    expect(blockingLines([steak, soda, wine, cheese], ['steak', 'wine'])).toEqual([steak, wine]);
  });
});

describe('fire.ts: the refusal copy is derived, never written per state', () => {
  it('is undefined when nothing blocks — which is also how the panel knows to draw nothing', () => {
    expect(fireRefusal([])).toBeUndefined();
  });

  it('counts and names the blocking line, in the artifact’s words', () => {
    const refusal = fireRefusal([{ name: 'Steak' }])!;
    expect(refusal.title).toBe('Cannot send to the kitchen');
    expect(refusal.lead).toBe('1 pending line is no longer available:');
    expect(refusal.names).toEqual(['Steak']);
    expect(refusal.resolution).toBe('Void that line or ask a manager to put the item back on.');
  });

  it('counts and names two, rather than saying "1 pending line" beside two of them', () => {
    const refusal = fireRefusal([{ name: 'Steak' }, { name: 'House Wine' }])!;
    expect(refusal.lead).toBe('2 pending lines are no longer available:');
    expect(refusal.names).toEqual(['Steak', 'House Wine']);
    expect(refusal.resolution).toBe('Void those lines or ask a manager to put the items back on.');
  });

  /**
   * **This test exists to keep provisional copy from shipping unseen.**
   *
   * The plural above — the `s`, the `are`, the comma between names, and *"Void
   * those lines … put the items back on"* — is `PROVISIONAL COPY`: the
   * artifact draws this notice with exactly one blocking line and never with
   * two, so none of it has been reviewed. It is written and tested so the
   * module is correct for any order, not because any order reaches it.
   *
   * Nothing else records that. Add a second 86'd item to a menu fixture, or a
   * second pending line for an already-86'd one, and the unreviewed sentence
   * is simply on screen — no test fails, nobody looks. So the coupling is made
   * a checked one, the way A9 pinned the order-line ring offset: the day a
   * fixture produces two blocking lines, this fails and says why.
   *
   * **The fix when it fails is not to raise the number.** It is to get the
   * plural copy reviewed on the design branch and then delete this test.
   */
  it('no reviewed state produces more than one blocking line, so the plural stays unreviewed', () => {
    for (const state of ALL_STATES) {
      const lines = ORDER_FIXTURES[state].groups.flatMap((g) => g.lines);
      const blocking = blockingLines(lines, MENU_FIXTURES[state].eightySixed ?? []);
      expect({ state, blocking: blocking.length }).toEqual({ state, blocking: Math.min(blocking.length, 1) });
    }
  });
});

// ---------------------------------------------------------------------------
// fireblocked (acceptance criteria 1 and 3)
// ---------------------------------------------------------------------------

describe('fireblocked: the artifact’s composition', () => {
  beforeEach(() => render('fireblocked'));

  it('86s the Steak tile in place, keeping its slot (ruling C-3)', () => {
    const steak = host.querySelector<HTMLElement>('.menu-tile[data-item="steak"]')!;
    expect(steak.classList.contains('menu-tile--off')).toBe(true);
    expect(steak.querySelector('.tag-86')!.textContent).toBe('86');
    expect([...host.querySelectorAll<HTMLElement>('.menu-grid > .menu-tile')].findIndex((t) => t.dataset.item === 'steak')).toBe(2);
  });

  it('draws the three-item table order, its PENDING Steak tagged 86, the pending header still REMOVE FREELY', () => {
    expect(drawnOrder()).toEqual([
      ['fired', 'Burger', '135.000'],
      ['fired', 'Soda', '30.000'],
      ['pending', 'Steak', '240.000'],
    ]);
    expect(taggedNames()).toEqual(['Steak']);
    expect(text('.round-head__tag')).toEqual(['MANAGER TO VOID', 'MANAGER TO VOID', 'REMOVE FREELY']);
  });

  it('puts the refusal between the lines and the totals, naming the line, as a standing condition', () => {
    const notice = panelNotice()!;
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.querySelector('.notice__title')!.textContent).toBe('Cannot send to the kitchen');
    expect(notice.textContent).toContain('1 pending line is no longer available: Steak.');
    expect(notice.textContent).toContain('Void that line or ask a manager to put the item back on.');
    expect(notice.querySelector('b')!.textContent).toBe('Steak');
    const panel = host.querySelector('.order-panel')!;
    expect([...panel.children].map((c) => c.className.split(' ')[0])).toEqual([
      'order-panel__head',
      'order-lines',
      'notice',
      'totals',
      'order-actions',
    ]);
  });

  it('keeps the 405.000 totals', () => {
    expect(text('.totals dd')).toEqual(['405.000', '−40.500', '18.225', '382.725', '33.136']);
  });

  it('takes Send to kitchen off and leaves Discount, Void order and Settle live', () => {
    expect(fireControl().tagName).toBe('SPAN');
    expect(fireControl().getAttribute('aria-disabled')).toBe('true');
    const live = [...host.querySelectorAll('.order-actions button')].map((b) => b.textContent);
    expect(live).toEqual(['Discount', 'Void order', 'Settle']);
  });

  it('points the dead control at the notice that explains it', () => {
    const describedBy = fireControl().getAttribute('aria-describedby')!;
    expect(describedBy).not.toBeNull();
    expect(host.querySelector(`#${describedBy}`)).toBe(panelNotice());
  });
});

describe('fireblocked resolves, which is the half of FR-E4 a per-state flag cannot draw', () => {
  it('voiding the offending line clears the refusal: nothing blocks the fire any more', () => {
    render({ state: 'fireblocked', gone: 'steak' });
    expect(lineNames()).toEqual(['Burger', 'Soda']);
    expect(taggedNames()).toEqual([]);
    // The refusal is gone — no notice, and nothing for the control to be
    // described by. That is FR-E4 resolving, and it is what a per-state flag
    // could not draw.
    expect(panelNotice()).toBeNull();
    expect(fireControl().hasAttribute('aria-describedby')).toBe(false);
    const left = ORDER_FIXTURES.fireblocked.groups.flatMap((g) => g.lines).filter((l) => l.id !== 'steak');
    expect(blockingLines(left, MENU_FIXTURES.fireblocked.eightySixed!)).toEqual([]);
    expect(text('.totals dd')).toEqual(['165.000', '−16.500', '7.425', '155.925', '13.500']);
  });

  // The two answers are separate, and this is the only place they are both
  // true in turn on one order. Voiding the Steak was also the last PENDING
  // line, so the control stays unavailable for the *other* reason — and
  // silently, because an order with nothing to send is not refusing anything.
  it('but leaves it unavailable, because voiding the Steak left nothing to send', () => {
    render({ state: 'fireblocked', gone: 'steak' });
    expect(sendableLines(ORDER_FIXTURES.fireblocked.groups.flatMap((g) => g.lines).filter((l) => l.id !== 'steak'))).toEqual([]);
    expect(fireControl().tagName).toBe('SPAN');
    expect(fireControl().getAttribute('aria-disabled')).toBe('true');
  });

  it('the line’s own remove control is that void — one tap, no prompt (AC-3, FR-H2)', () => {
    render('fireblocked');
    const remove = host.querySelector<HTMLElement>('.order-line[data-line-id="steak"] .order-line__remove')!;
    expect(remove.getAttribute('aria-label')).toBe('Remove Steak');
    press(remove);
    expect(window.location.search).toBe('?state=fireblocked&gone=steak');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(panelNotice()).toBeNull();
  });

  it('the tag stays inside the row body and never in the trailing slot (I-12)', () => {
    render('fireblocked');
    const row = host.querySelector('.order-line[data-line-id="steak"]')!;
    expect(row.querySelector('.order-line__slot .tag-86')).toBeNull();
    expect(row.querySelector('.order-line__target .tag-86')).not.toBeNull();
    expect(row.querySelector('.order-line__slot button.order-line__remove')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fireblocked-overflow: FR-E4's second half, which no other state can show
// ---------------------------------------------------------------------------

describe('fireblocked-overflow: the block clears while the order still has work to send', () => {
  const OF = 'fireblocked-overflow' as const;

  it('86s Coffee in place and leaves the other eleven tiles alone (C-3)', () => {
    render(OF);
    const coffee = host.querySelector<HTMLElement>('.menu-tile[data-item="coffee"]')!;
    expect(coffee.classList.contains('menu-tile--off')).toBe(true);
    expect(coffee.querySelector('.tag-86')!.textContent).toBe('86');
    expect(host.querySelectorAll('.menu-tile--off')).toHaveLength(1);
    // Never removed, never moved: a hand already going for Coffee finds Coffee.
    expect([...host.querySelectorAll<HTMLElement>('.menu-grid > .menu-tile')].findIndex((t) => t.dataset.item === 'coffee')).toBe(9);
  });

  it('holds three PENDING lines and tags only the one holding the 86’d item', () => {
    render(OF);
    const pending = rows().filter((r) => r.dataset.lineStatus === 'pending');
    expect(pending.map((r) => r.querySelector('.order-line__name')!.firstChild!.textContent)).toEqual([
      'Coffee',
      'Cheesecake',
      'House Wine',
    ]);
    expect(taggedNames()).toEqual(['Coffee']);
  });

  it('refuses the fire and names Coffee, in the singular copy the artifact reviewed', () => {
    render(OF);
    expect(panelNotice()!.querySelector('.notice__title')!.textContent).toBe('Cannot send to the kitchen');
    expect(panelNotice()!.textContent).toContain('1 pending line is no longer available: Coffee.');
    expect(panelNotice()!.querySelector('b')!.textContent).toBe('Coffee');
    expect(fireControl().tagName).toBe('SPAN');
  });

  // **The case the slice was missing.** On fireblocked the Steak is the only
  // PENDING line, so voiding it clears the block and empties the order in one
  // press — Send to kitchen stays off for the other reason, and FR-E4's
  // "until that line is voided" is true only at the rule. Here it is visible.
  it('voiding Coffee brings Send to kitchen back WHILE two lines are still pending', () => {
    render({ state: OF, gone: 'of-coffee' });
    const pending = rows().filter((r) => r.dataset.lineStatus === 'pending');
    expect(pending.map((r) => r.querySelector('.order-line__name')!.firstChild!.textContent)).toEqual([
      'Cheesecake',
      'House Wine',
    ]);
    expect(sendableLines(ORDER_FIXTURES[OF].groups.flatMap((g) => g.lines).filter((l) => l.id !== 'of-coffee'))).toHaveLength(2);
    // The refusal is gone, and the control is live again — for FR-E4's reason,
    // not because there is nothing left to send.
    expect(panelNotice()).toBeNull();
    expect(taggedNames()).toEqual([]);
    expect(fireControl().tagName).toBe('BUTTON');
    expect(fireControl().hasAttribute('aria-disabled')).toBe(false);
  });

  it('lands on the figures F2a already wrote for that removal', () => {
    render({ state: OF, gone: 'of-coffee' });
    expect(text('.totals dd')).toEqual(['1.115.000', '55.750', '1.170.750', '101.364']);
    expect(host.querySelector('.order-panel__count')!.textContent).toBe('8 items');
  });

  it('the line’s own × is that void, with no prompt (AC-3, FR-H2)', () => {
    render(OF);
    const remove = host.querySelector<HTMLElement>('.order-line[data-line-id="of-coffee"] .order-line__remove')!;
    expect(remove.getAttribute('aria-label')).toBe('Remove Coffee');
    press(remove);
    expect(window.location.search).toBe('?state=fireblocked-overflow&gone=of-coffee');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(panelNotice()).toBeNull();
    expect(fireControl().tagName).toBe('BUTTON');
  });

  it('is the same order overflow draws, so the state adds no figure of its own', () => {
    expect(ORDER_FIXTURES[OF].groups).toBe(ORDER_FIXTURES.overflow.groups);
    expect(ORDER_FIXTURES[OF].totals).toBe(ORDER_FIXTURES.overflow.totals);
    expect(ORDER_FIXTURES[OF].totalsWithout).toBe(ORDER_FIXTURES.overflow.totalsWithout);
  });

  it('and overflow itself is untouched: nothing 86’d, fire live', () => {
    render('overflow');
    expect(host.querySelectorAll('.menu-tile--off')).toHaveLength(0);
    expect(taggedNames()).toEqual([]);
    expect(panelNotice()).toBeNull();
    expect(fireControl().tagName).toBe('BUTTON');
  });
});

// ---------------------------------------------------------------------------
// The 86 tag across every state (acceptance criterion 4)
// ---------------------------------------------------------------------------

describe('the 86 tag on a PENDING line, in every state where it is true', () => {
  const EIGHTY_SIXED = ALL_STATES.filter((s) => (MENU_FIXTURES[s].eightySixed ?? []).length > 0);
  /** The lines a state's own fixtures make unfireable — never a name typed in here. */
  const blockedIn = (state: OrderState) =>
    blockingLines(ORDER_FIXTURES[state].groups.flatMap((g) => g.lines), MENU_FIXTURES[state].eightySixed ?? []);

  it('is exactly the four states whose menu fixture 86s something', () => {
    expect(EIGHTY_SIXED).toEqual(['eightysix', 'sheet-item86', 'fireblocked', 'fireblocked-overflow']);
  });

  // **The consequence of FR-E4 being a rule, pinned on purpose.**
  //
  // All three of these states hold a PENDING Steak and 86 Steak, so in all
  // three "a pending line holds an item that is 86'd" — and B-17 is a
  // boundary: such a line *blocks the fire*. The artifact draws the refusal in
  // fireblocked only and leaves Send to kitchen live in the other two, which
  // cannot be right for the same order and the same 86'd item.
  //
  // Nobody should "fix" this later by scoping the notice to fireblocked: that
  // is the per-state flag acceptance criterion 2 forbids, and it would let a
  // cashier fire an 86'd Steak from eightysix. Raised in the FE-011 handoff as
  // a finding for the design branch.
  it.each(EIGHTY_SIXED)('%s: the fire is refused wherever the order holds one, not only in fireblocked', (state) => {
    render(state);
    expect(panelNotice()).not.toBeNull();
    for (const line of blockedIn(state)) expect(panelNotice()!.textContent).toContain(line.name);
    expect(fireControl().tagName).toBe('SPAN');
    expect(fireControl().getAttribute('aria-disabled')).toBe('true');
  });

  it('and nowhere else: a state that 86s nothing keeps the fire available', () => {
    for (const state of ALL_STATES.filter((s) => !EIGHTY_SIXED.includes(s))) {
      render(state);
      expect(panelNotice()).toBeNull();
    }
  });

  it.each(EIGHTY_SIXED)('%s: the line holding the 86’d item carries it, and it alone', (state) => {
    render(state);
    const expected = blockedIn(state).map((l) => l.name);
    expect(expected.length).toBeGreaterThan(0);
    expect(taggedNames()).toEqual(expected);
  });

  it.each(ALL_STATES)('%s: only PENDING lines holding an 86’d item are tagged, and no FIRED line ever is', (state) => {
    render(state);
    const unavailable = MENU_FIXTURES[state].eightySixed ?? [];
    for (const row of rows()) {
      const line = ORDER_FIXTURES[state].groups.flatMap((g) => g.lines).find((l) => l.id === row.dataset.lineId)!;
      const shouldTag = line.status === 'pending' && line.itemId !== undefined && unavailable.includes(line.itemId);
      expect(Boolean(row.querySelector('.tag-86'))).toBe(shouldTag);
      if (row.dataset.lineStatus === 'fired') expect(row.querySelector('.tag-86')).toBeNull();
    }
  });

  it('a FIRED line whose item is 86’d is still not tagged — proven directly, since no fixture draws it', () => {
    const fired = { id: 'soda', name: 'Soda', itemId: 'soda', status: 'fired' as const };
    expect(holdsUnavailable(fired, ['soda'])).toBe(false);
  });

  it('under a lock the 86’d pending line draws no remove control and no live fire control (FR-G10, FR-G12)', () => {
    for (const state of ['lock-draft', 'lock-lease'] as const) {
      render(state);
      expect(host.querySelectorAll('.order-line__remove')).toHaveLength(0);
      expect(host.querySelectorAll('.order-actions button')).toHaveLength(0);
      expect(text('.order-actions .action--off')).toEqual(['Discount', 'Void order', 'Send to kitchen', 'Settle']);
    }
  });
});

// ---------------------------------------------------------------------------
// error (acceptance criterion 5)
// ---------------------------------------------------------------------------

describe('error: a rejected command changed nothing (B-20)', () => {
  beforeEach(() => render('error'));

  it('draws the rejection over a live screen, in the artifact’s words', () => {
    const notice = menuNotice()!;
    expect(notice.querySelector('.notice__title')!.textContent).toBe(REJECTED_NOTICE.title);
    expect(notice.textContent).toContain(REJECTED_NOTICE.body);
    // The answer to something the cashier just did, so it is announced (F2e).
    expect(notice.getAttribute('role')).toBe('alert');
  });

  it('leaves the grid live: adding the line again is the point of the state', () => {
    expect(host.querySelectorAll('.menu-grid > .menu-tile')).toHaveLength(12);
    expect(host.querySelectorAll('.menu-tile--off')).toHaveLength(0);
    expect(host.querySelectorAll('.menu-category')).toHaveLength(4);
  });

  it('leaves the order exactly as it was: the same order every other state draws', () => {
    expect(drawnOrder()).toEqual([
      ['fired', 'Burger', '135.000'],
      ['fired', 'Soda', '30.000'],
      ['pending', 'Steak', '240.000'],
    ]);
    expect(text('.totals dd')).toEqual(['405.000', '−40.500', '18.225', '382.725', '33.136']);
    expect(panelNotice()).toBeNull();
  });

  it('Try again is a button, not an anchor: it acts on the screen it is on', () => {
    const tryAgain = [...host.querySelectorAll<HTMLElement>('.order-screen__menu .notice button')];
    expect(tryAgain).toHaveLength(1);
    expect(tryAgain[0]!.textContent).toBe(REJECTED_NOTICE.action);
    expect(tryAgain[0]!.getAttribute('type')).toBe('button');
    expect(menuNotice()!.querySelector('a')).toBeNull();
  });

  it('Try again clears the notice, keeps the same order, and replaces the history entry', () => {
    const before = drawnOrder();
    const depth = window.history.length;
    press(host.querySelector('.order-screen__menu .notice button')!);
    expect(drawnOrder()).toEqual(before);
    expect(menuNotice()).toBeNull();
    expect(window.history.length).toBe(depth);
  });

  it('does not hardcode its destination: it returns to the view its own fixture names', () => {
    // The defect F2k removed from four openers, kept out of a fifth: the view
    // belongs to the state's fixture, and it is the state that draws this
    // state's own order.
    const back = MENU_FIXTURES.error.rejected!;
    expect(back).toEqual({ state: 'default' });
    press(host.querySelector('.order-screen__menu .notice button')!);
    expect(window.location.search).toBe('?state=default');
    const after = drawnOrder();
    render('error');
    expect(drawnOrder()).toEqual(after);
  });
});

// ---------------------------------------------------------------------------
// fireerror (acceptance criteria 6 and 7)
// ---------------------------------------------------------------------------

describe('fireerror: the emergency banner (FR-E3)', () => {
  beforeEach(() => render('fireerror'));

  it('draws FE-001’s banner component, above the screen, with the artifact’s copy', () => {
    const banner = host.querySelector('.emergency-banner')!;
    expect(banner).not.toBeNull();
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.parentElement!.classList.contains('pos-device')).toBe(true);
    expect([...device().children].map((c) => c.className.split(' ')[0])[0]).toBe('emergency-banner');
    expect(banner.querySelector('.emergency-banner__title')!.textContent).toBe(FIRE_INCIDENT.title);
    expect(banner.querySelector('.emergency-banner__detail')!.textContent).toBe(FIRE_INCIDENT.detail);
    expect(banner.querySelector('.emergency-banner__mark svg')).not.toBeNull();
  });

  it('names the table and the round, because POS-03 is behind the PIN (FR-E3b)', () => {
    expect(FIRE_INCIDENT.title).toContain('Table 1');
    expect(FIRE_INCIDENT.title).toContain('round 2');
    expect(FIRE_INCIDENT.detail).toBe('The order is unaffected. The kitchen has not seen this work.');
  });

  it('carries Open incidents as an anchor, the one this slice adds, for POS-07', () => {
    const action = host.querySelector('.emergency-banner__action')!;
    expect(action.tagName).toBe('A');
    expect(action.textContent).toBe('Open incidents');
    expect(action.getAttribute('href')).toBe(FIRE_INCIDENT.action.href);
    // Placeholder, as F2b's two ?state=settle* are: POS-07 is F4's.
    expect(FIRE_INCIDENT.action.href).toBe('?state=incidents');
  });

  it('is drawn in no other state', () => {
    for (const state of ALL_STATES.filter((s) => s !== 'fireerror')) {
      render(state);
      expect(host.querySelector('.emergency-banner')).toBeNull();
    }
  });

  it('goes inert with the rest of the frame when a sheet opens over the order', () => {
    press(host.querySelector('.order-actions [data-action="void-order"]')!);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector('.emergency-banner')!.closest('[inert]')).not.toBeNull();
  });
});

describe('fireerror: the order a failed fire leaves behind', () => {
  beforeEach(() => render('fireerror'));

  it('holds the two fired rounds and no pending line — FR-E1 fires every PENDING line', () => {
    expect(drawnOrder()).toEqual([
      ['fired', 'Burger', '135.000'],
      ['fired', 'Soda', '30.000'],
    ]);
    expect(host.querySelectorAll('.order-line[data-line-status="pending"]')).toHaveLength(0);
    expect(host.querySelector('.order-panel__count')!.textContent).toBe('2 items');
    expect(text('.totals dd')).toEqual(['165.000', '−16.500', '7.425', '155.925', '13.500']);
  });

  it('reads round 2 as NOT printed, against the banner that says the ticket did not print (I-7)', () => {
    expect(text('.round-head__label')).toEqual(['Round 1 · fired 19:42 · printed', 'Round 2 · fired 19:58 · not printed']);
  });

  it('is the only state whose print wording changes: every other round still reads printed', () => {
    for (const state of ALL_STATES.filter((s) => s !== 'fireerror')) {
      render(state);
      expect(text('.round-head__label').filter((l) => l!.includes('not printed'))).toEqual([]);
    }
  });

  it('never gates or rolls back the sale on a print failure (B-15)', () => {
    // Discount, Void order and Settle stay live: the order is unaffected, and
    // the restaurant keeps serving when the printer jams.
    expect([...host.querySelectorAll('.order-actions button')].map((b) => b.textContent)).toEqual([
      'Discount',
      'Void order',
      'Settle',
    ]);
  });

  it('draws Send to kitchen unavailable in place, because every line is already FIRED', () => {
    // FR-E1/FR-E2/B-16: a fire sends the PENDING lines, and there are none. A
    // live control under a banner saying the ticket did not print reads as
    // "send it again", and SCREEN-INVENTORY forbids a reprint-the-order
    // control outright — the reprint is POS-07's, per FR-E3.
    expect(sendableLines(ORDER_FIXTURES.fireerror.groups.flatMap((g) => g.lines))).toEqual([]);
    expect(fireControl().tagName).toBe('SPAN');
    expect(fireControl().getAttribute('aria-disabled')).toBe('true');
    // Inert, not absent: the condition is temporary (ruling C-1).
    expect(fireControl().textContent).toBe('Send to kitchen');
    // Silent: this is not a refusal, so there is no notice and nothing to
    // point the control at.
    expect(panelNotice()).toBeNull();
    expect(fireControl().hasAttribute('aria-describedby')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// An order with nothing to send cannot be fired (FR-E1, FR-E2, B-16)
// ---------------------------------------------------------------------------

describe('the fire control is unavailable wherever the order has no PENDING line', () => {
  /** Every ?state=, plus the two ?gone= views that take the last pending line away. */
  const VIEWS: ReadonlyArray<OrderView> = [
    ...ALL_STATES.map((state) => ({ state })),
    { state: 'default', gone: 'steak' },
    { state: 'fireblocked', gone: 'steak' },
    { state: 'fireblocked-overflow', gone: 'of-coffee' },
  ];

  it.each(VIEWS.map((v) => [v.gone ? `${v.state}&gone=${v.gone}` : v.state, v] as const))(
    '%s: live exactly when there is a PENDING line and nothing blocks it',
    (_label, view) => {
      render(view);
      const fixture = ORDER_FIXTURES[view.state];
      // What the panel actually drew, which is the fixture minus any honoured removal.
      const drawn = fixture.groups
        .flatMap((g) => g.lines)
        .filter((l) => !(view.gone && !fixture.lock && fixture.totalsWithout?.[view.gone]) || l.id !== view.gone);
      const sendable = sendableLines(drawn);
      const blocked = blockingLines(drawn, MENU_FIXTURES[view.state].eightySixed ?? []);
      const locked = fixture.lock !== undefined || drawn.length === 0;

      if (locked || sendable.length === 0 || blocked.length > 0) {
        expect(fireControl().tagName).toBe('SPAN');
        expect(fireControl().getAttribute('aria-disabled')).toBe('true');
      } else {
        expect(fireControl().tagName).toBe('BUTTON');
      }
    }
  );

  it('names the two states a reviewer can see it in, so the rule is not only a formula', () => {
    // Every line FIRED: the fire-error order, and the blocked order after its
    // one pending line was voided.
    for (const view of [{ state: 'fireerror' as const }, { state: 'fireblocked' as const, gone: 'steak' }]) {
      render(view);
      expect(host.querySelectorAll('.order-line[data-line-status="pending"]')).toHaveLength(0);
      expect(host.querySelectorAll('.order-line[data-line-status="fired"]').length).toBeGreaterThan(0);
      expect(fireControl().tagName).toBe('SPAN');
    }
  });

  it('comes back the moment the order holds a PENDING line again', () => {
    render('default');
    expect(sendableLines(ORDER_FIXTURES.default.groups.flatMap((g) => g.lines))).toHaveLength(1);
    expect(fireControl().tagName).toBe('BUTTON');
  });

  it('is never absent, in any state: unavailable in place, because the condition is temporary (C-1)', () => {
    for (const state of ALL_STATES) {
      render(state);
      expect(host.querySelector(`.order-actions [data-action="${FIRE_ACTION}"]`)).not.toBeNull();
      expect(fireControl().textContent).toBe('Send to kitchen');
    }
  });
});

// ---------------------------------------------------------------------------
// Firing moves nothing (acceptance criterion 8)
// ---------------------------------------------------------------------------

describe('Send to kitchen produces no result, and above all moves nothing', () => {
  it.each(['default', 'overflow', 'other-discount'] as const)(
    '%s: the order, the URL and the history are exactly as they were, and no sheet opens',
    (state) => {
      render(state);
      const before = drawnOrder();
      const url = window.location.search;
      const depth = window.history.length;
      press(fireControl());
      expect(drawnOrder()).toEqual(before);
      expect(window.location.search).toBe(url);
      expect(window.history.length).toBe(depth);
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      expect(host.querySelector('.void-flow, .discount-flow')).toBeNull();
      expect(host.querySelector('.emergency-banner')).toBeNull();
    }
  );

  it('names no state at all, so it cannot swap one order for another fixture’s', () => {
    render('overflow');
    press(fireControl());
    // The old ?state=fireerror would have landed the cashier's long order on
    // the fire-error fixture's two-line one.
    expect(lineNames()).toContain('Coffee');
    expect(lineNames()).not.toEqual(['Burger', 'Soda']);
  });
});

// ---------------------------------------------------------------------------
// The panel's loading skeleton (acceptance criterion 9)
// ---------------------------------------------------------------------------

describe('loading: the panel draws the skeleton too', () => {
  beforeEach(() => render('loading'));

  it('replaces the lines and the totals with bars, in the artifact’s widths', () => {
    const panel = host.querySelector('.order-panel')!;
    expect(panel.querySelectorAll('.order-line')).toHaveLength(0);
    expect(panel.querySelector('.totals')).toBeNull();
    const widths = [...panel.querySelectorAll('.skel-bar')].map((b) => b.className.replace('skel-bar skel-bar--', ''));
    expect(widths).toEqual(['80', '60', '80', '60', '40']);
  });

  it('writes no width of its own: every bar is one of the three that already existed', () => {
    for (const bar of host.querySelectorAll('.skel-bar')) {
      expect(['skel-bar skel-bar--80', 'skel-bar skel-bar--60', 'skel-bar skel-bar--40']).toContain(bar.className);
    }
  });

  it('keeps the header and its count, which the artifact does not change', () => {
    expect(host.querySelector('.order-panel__title')!.textContent).toBe('Order · T1');
    expect(host.querySelector('.order-panel__count')!.textContent).toBe('3 items');
  });

  it('hides the bars from the accessibility tree and marks the region busy', () => {
    for (const bar of host.querySelectorAll('.skel-bar')) expect(bar.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('.panel-skeleton[aria-busy="true"]')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Reachability: what these three states add leads somewhere ungated
// ---------------------------------------------------------------------------

const GATED = ['sheet-voidline', 'sheet-voidorder', 'sheet-voidorder-fired', 'approval', 'approval-error', 'approval-throttled', 'approval-denied'];

describe('the controls F2h adds lead somewhere ungated', () => {
  it('error’s Try again lands on an ungated state and opens no prompt', () => {
    render('error');
    press(host.querySelector('.order-screen__menu .notice button')!);
    expect(GATED).not.toContain(new URLSearchParams(window.location.search).get('state'));
    expect(host.querySelector('[role="dialog"], .void-flow, .discount-flow')).toBeNull();
  });

  it('fireerror’s Open incidents leaves for POS-07, which is not a gated state of this screen', () => {
    render('fireerror');
    const href = host.querySelector('.emergency-banner__action')!.getAttribute('href')!;
    const target = new URLSearchParams(href.slice(1)).get('state');
    expect(GATED).not.toContain(target);
    // It is a placeholder for an unbuilt screen, so it resolves to the default
    // state — which is itself ungated. F4 reconciles the name.
    expect(ORDER_STATES.some((s) => s.id === target)).toBe(false);
  });

  it('fireblocked’s notice carries no control at all: the resolution is the line’s own remove', () => {
    render('fireblocked');
    expect(panelNotice()!.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
  });
});
