// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OrderPanel, type PanelActions } from '../src/OrderPanel.js';
import {
  FIRED_TAG,
  LOCK_TAG,
  ORDER_STATES,
  PENDING_TAG,
  orderViewFrom,
  type OrderState,
  type OrderView,
} from '../src/orderFixtures.js';

// Ruling I-12, read from the rendered markup. A row's trailing slot carries
// exactly one meaning: a PENDING row has a remove control there, a FIRED row
// reserves the slot and leaves it empty, and under either settlement lock
// every slot is empty and no row is a control. The slot is always the tap
// target's sibling — DESIGN-002 pass 3 found a fired row drawn as one anchor
// that swallowed the slot, violating I-12 in its own markup. Since FE-009 a
// live row body is a <button>, so the guard looks for either.

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
});

function render(view: OrderView | OrderState, actions?: PanelActions) {
  act(() => root.render(<OrderPanel view={typeof view === 'string' ? { state: view } : view} actions={actions} />));
}

/** Panel actions that record what the panel asked for. */
type Asked =
  | { navigate: string; leaves: boolean }
  | { openVoid: unknown }
  | { openLine: string }
  | { openDiscount: true }
  | { fire: true };
function recording() {
  const asked: Asked[] = [];
  const actions: PanelActions = {
    navigate: (search, leaves = false) => asked.push({ navigate: search, leaves }),
    openVoid: (target) => asked.push({ openVoid: target }),
    openLine: (lineId) => asked.push({ openLine: lineId }),
    openDiscount: () => asked.push({ openDiscount: true }),
    fire: () => asked.push({ fire: true }),
  };
  return { asked, actions };
}
const press = (el: Element) => act(() => (el as HTMLElement).click());

const rows = () => [...host.querySelectorAll<HTMLElement>('.order-line')];
const rowsWith = (status: string) => rows().filter((r) => r.dataset.lineStatus === status);
const slotOf = (row: Element) => row.querySelector(':scope > .order-line__slot')!;
const targetOf = (row: Element) => row.querySelector(':scope > .order-line__target')!;
const tags = () => [...host.querySelectorAll('.round-head .round-head__tag')].map((t) => t.textContent);
const text = (selector: string) => [...host.querySelectorAll(selector)].map((e) => e.textContent);

/** Trailing slots that sit inside a control, an anchor or a button. The guard: this is always empty. */
function slotsInsideControls(container: ParentNode): Element[] {
  return [...container.querySelectorAll('.order-line__slot')].filter((s) => s.parentElement?.closest('a, button') !== null);
}

describe('the slot guard can see a swallowed slot', () => {
  it('flags a fired row drawn as one anchor around its slot', () => {
    const bad = document.createElement('div');
    bad.innerHTML =
      '<li class="order-line"><a class="order-line__target" href="#void">Soda<div class="order-line__slot"></div></a></li>';
    expect(slotsInsideControls(bad)).toHaveLength(1);
  });

  it('flags a whole row wrapped in an anchor', () => {
    const bad = document.createElement('div');
    bad.innerHTML =
      '<a href="#void"><li class="order-line"><div class="order-line__target">Soda</div><div class="order-line__slot"></div></li></a>';
    expect(slotsInsideControls(bad)).toHaveLength(1);
  });

  it('flags a fired row drawn as one button around its slot', () => {
    const bad = document.createElement('div');
    bad.innerHTML =
      '<li class="order-line"><button type="button" class="order-line__target">Soda<span class="order-line__slot"></span></button></li>';
    expect(slotsInsideControls(bad)).toHaveLength(1);
  });

  it('flags a whole row wrapped in a button', () => {
    const bad = document.createElement('div');
    bad.innerHTML =
      '<button type="button"><span class="order-line"><span class="order-line__target">Soda</span><span class="order-line__slot"></span></span></button>';
    expect(slotsInsideControls(bad)).toHaveLength(1);
  });

  it('passes a row whose slot is its target’s sibling', () => {
    const good = document.createElement('div');
    good.innerHTML =
      '<li class="order-line"><button type="button" class="order-line__target">Soda</button><div class="order-line__slot"></div></li>';
    expect(slotsInsideControls(good)).toEqual([]);
  });
});

describe('fixture states', () => {
  it('has exactly the six states of F2a, the three of F2b, the three of F2c, the four of F2g, the five of F2i, the three of F2j, the one of F2k, the four of F2h and the two of F2d', () => {
    expect(ORDER_STATES.map((s) => s.id)).toEqual([
      'default',
      'empty',
      'overflow',
      'pressed',
      'lock-draft',
      'lock-lease',
      'eightysix',
      'loading',
      'catalog',
      'sheet-item',
      'sheet-item86',
      'sheet-item-burger',
      'sheet-item-wings',
      'sheet-item-steak',
      'sheet-item-fish',
      'sheet-item-salad',
      'sheet-item-soup',
      'sheet-item-fries',
      'sheet-item-rings',
      'sheet-item-soda',
      'sheet-item-water',
      'sheet-item-coffee',
      'sheet-item-beer',
      'sheet-item-wine',
      'sheet-item-cheesecake',
      'sheet-line',
      'approval',
      'approval-error',
      'approval-throttled',
      'approval-denied',
      'sheet-discount',
      'sheet-freeform',
      'sheet-remove',
      'sheet-remove-freeform',
      'zero',
      'other-discount',
      'sheet-voidline',
      'sheet-voidorder',
      'sheet-voidorder-fired',
      'fireblocked',
      'fireblocked-overflow',
      'error',
      'fireerror',
      // FE-022's seven fire fixtures (DESIGN-007 Part C), between fireerror and the quick sale.
      'fire-ready',
      'fire-queued',
      'fire-printed',
      'fire-failed',
      'fire-unknown',
      'fire-then-add',
      'fire-heading-width',
      'quick',
      'quick-line',
    ]);
  });

  it('is reachable by ?state=, and anything else is the default', () => {
    for (const { id } of ORDER_STATES) expect(orderViewFrom(`?state=${id}`).state).toBe(id);
    // Repointed in F2h: this guards the unknown-state fallback, and fireerror
    // is a real state now. The two names below are the placeholder
    // destinations F2b and F2h left for screens that are not built (POS-04,
    // POS-07), which is exactly what an unknown ?state= is in this app.
    expect(orderViewFrom('?state=settle-pending').state).toBe('default');
    expect(orderViewFrom('?state=incidents').state).toBe('default');
    expect(orderViewFrom('?state=nothing-of-the-sort').state).toBe('default');
    expect(orderViewFrom('').state).toBe('default');
  });
});

describe.each(ORDER_STATES.map((s) => s.id))('I-12 structure in %s', (state) => {
  beforeEach(() => render(state));

  it('no trailing slot has an anchor or button ancestor', () => {
    expect(slotsInsideControls(host)).toEqual([]);
  });

  it('every row is exactly a tap target followed by its sibling slot', () => {
    for (const row of rows()) {
      expect([...row.children].map((c) => c.className.split(' ')[0])).toEqual(['order-line__target', 'order-line__slot']);
      expect(targetOf(row).contains(slotOf(row))).toBe(false);
    }
  });

  it('every fired and voided slot is empty — absent, not disabled', () => {
    for (const row of [...rowsWith('fired'), ...rowsWith('voided')]) {
      expect(slotOf(row).childNodes).toHaveLength(0);
    }
  });

  it('a voided row is not a control', () => {
    for (const row of rowsWith('voided')) {
      expect(row.querySelector('a, button, [tabindex]')).toBeNull();
    }
  });
});

describe('unlocked rows', () => {
  it('default draws fired rows and a pending row', () => {
    render('default');
    expect(rowsWith('fired').length).toBeGreaterThan(0);
    expect(rowsWith('pending').length).toBeGreaterThan(0);
  });

  it.each(['default', 'overflow', 'pressed'] as const)('%s: a PENDING row has one remove control in its slot, nothing else', (state) => {
    render(state);
    const pending = rowsWith('pending');
    expect(pending.length).toBeGreaterThan(0);
    for (const row of pending) {
      const slot = slotOf(row);
      expect(slot.children).toHaveLength(1);
      const remove = slot.firstElementChild as HTMLButtonElement;
      expect(remove.matches('button.order-line__remove[type="button"]')).toBe(true);
      const name = row.querySelector('.order-line__name')!.textContent;
      expect(remove.getAttribute('aria-label')).toBe(`Remove ${name}`);
    }
  });

  it.each(['default', 'overflow', 'pressed'] as const)('%s: a FIRED row body is the button that opens the void sheet for that line', (state) => {
    const { asked, actions } = recording();
    render(state, actions);
    const fired = rowsWith('fired');
    expect(fired.length).toBeGreaterThan(0);
    for (const row of fired) {
      const target = targetOf(row);
      expect(target.tagName).toBe('BUTTON');
      expect(target.getAttribute('type')).toBe('button');
      press(target);
    }
    // One void sheet per row pressed, each for that row's own line (B-16).
    expect(asked).toEqual(fired.map((row) => ({ openVoid: { kind: 'line', lineId: row.dataset.lineId } })));
    expect(new Set(fired.map((row) => row.dataset.lineId)).size).toBe(fired.length);
  });

  it.each(['default', 'overflow', 'pressed'] as const)(
    '%s: a PENDING row body is the button that opens the line editor for that line',
    (state) => {
      const { asked, actions } = recording();
      render(state, actions);
      const pending = rowsWith('pending');
      expect(pending.length).toBeGreaterThan(0);
      for (const row of pending) {
        const target = targetOf(row);
        expect(target.matches('button.order-line__target[type="button"]')).toBe(true);
        press(target);
      }
      // One editor per row pressed, each for that row's own line: tapping
      // Coffee must not open the Steak's editor.
      expect(asked).toEqual(pending.map((row) => ({ openLine: row.dataset.lineId })));
      expect(new Set(pending.map((row) => row.dataset.lineId)).size).toBe(pending.length);
    }
  );

  it('the close bar’s four actions are buttons: two open a sheet over this order, and only Settle leaves POS-03', () => {
    const { asked, actions } = recording();
    render('default', actions);
    const bar = [...host.querySelectorAll<HTMLElement>('.order-actions > *')];
    expect(bar.map((b) => [b.tagName, b.getAttribute('type'), b.textContent])).toEqual([
      ['BUTTON', 'button', 'Discount'],
      ['BUTTON', 'button', 'Void order'],
      // FE-022: the label carries the pending count (default holds one pending Steak).
      ['BUTTON', 'button', 'Send 1 to kitchen'],
      ['BUTTON', 'button', 'Settle'],
    ]);
    for (const b of bar) press(b);
    // Discount and Void order name no state at all: each opens its sheet over
    // the order on screen. **Send to kitchen asks for nothing**: it used to
    // name ?state=fireerror, which would move the cashier's order to the
    // fire-error fixture's now that fireerror is a real state. Only Settle,
    // which leaves for POS-04, asks to push a history entry. FE-022: Send asks
    // the screen to fire, and names no state.
    expect(asked).toEqual([
      { openDiscount: true },
      { openVoid: { kind: 'order' } },
      { fire: true },
      { navigate: '?state=settle', leaves: true },
    ]);
  });

  it('the remove control removes the line with no prompt, landing on the artifact’s figures', () => {
    const { asked, actions } = recording();
    render('default', actions);
    press(rowsWith('pending')[0]!.querySelector('button.order-line__remove')!);
    expect(asked).toHaveLength(1);
    const search = (asked[0] as { navigate: string }).navigate;
    expect(asked[0]).toEqual({ navigate: '?state=default&gone=steak', leaves: false });
    render(orderViewFrom(search));
    expect(rowsWith('pending')).toEqual([]);
    expect(text('.round-head__tag')).toEqual([FIRED_TAG, FIRED_TAG]);
    expect(text('.totals dd')).toEqual(['165.000', '−16.500', '7.425', '155.925', '13.500']);
    expect(host.querySelector('.order-panel__count')!.textContent).toBe('2 items');
  });
});

describe.each(['lock-draft', 'lock-lease'] as const)('%s: settlement lock', (state) => {
  const lock = state === 'lock-draft' ? 'draft' : 'lease';
  beforeEach(() => render(state));

  it('keeps every row, fired and pending, legible', () => {
    expect(rowsWith('fired').length).toBeGreaterThan(0);
    expect(rowsWith('pending').length).toBeGreaterThan(0);
    expect(text('.order-line__name')).toEqual(['Burger', 'Soda', 'Steak']);
    expect(text('.order-line__amount')).toEqual(['135.000', '30.000', '240.000']);
  });

  it('every slot is empty and no row is a control', () => {
    for (const row of rows()) expect(slotOf(row).childNodes).toHaveLength(0);
    expect(host.querySelector('.order-lines')!.querySelectorAll('a, button, [tabindex], [role="button"]')).toHaveLength(0);
  });

  it('every round header carries the lock reason instead of its tag', () => {
    expect(tags()).toEqual([LOCK_TAG[lock], LOCK_TAG[lock], LOCK_TAG[lock]]);
  });

  it('draws every close-bar action unavailable in place', () => {
    expect(host.querySelectorAll('.order-actions a, .order-actions button')).toHaveLength(0);
    expect(text('.order-actions .action--off')).toEqual(['Discount', 'Void order', 'Send to kitchen', 'Settle']);
  });

  it('ignores a ?gone= removal: removing a pending line is a void, and void is blocked', () => {
    render({ state, gone: 'steak' });
    expect(text('.order-line__name')).toContain('Steak');
  });
});

it('the two locks never share a string (C-5)', () => {
  expect(LOCK_TAG.draft).not.toBe(LOCK_TAG.lease);
});

describe('round headers', () => {
  it('carry the tag, not the rows: MANAGER TO VOID on fired rounds, REMOVE FREELY on pending', () => {
    render('default');
    expect(tags()).toEqual([FIRED_TAG, FIRED_TAG, PENDING_TAG]);
    expect(host.querySelectorAll('.order-line .round-head__tag')).toHaveLength(0);
  });

  it('name the round, its fire time and its print status (I-7)', () => {
    render('default');
    expect(text('.round-head__label')).toEqual([
      'Round 1 · fired 19:42 · printed',
      'Round 2 · fired 19:58 · printed',
      'Pending · not sent to the kitchen',
    ]);
  });
});

describe('pressed', () => {
  it('holds exactly one FIRED row body down, and nothing else', () => {
    render('pressed');
    const held = [...host.querySelectorAll('.is-pressed')];
    expect(held).toHaveLength(1);
    expect(held[0]!.matches('button.order-line__target')).toBe(true);
    expect(held[0]!.parentElement!.dataset.lineStatus).toBe('fired');
  });

  it('is not drawn in any other state', () => {
    for (const { id } of ORDER_STATES.filter((s) => s.id !== 'pressed')) {
      render(id);
      expect(host.querySelectorAll('.is-pressed')).toHaveLength(0);
    }
  });
});

describe('empty and overflow', () => {
  it('empty: no rows, the empty notice, zero totals, every action unavailable', () => {
    render('empty');
    expect(rows()).toEqual([]);
    expect(host.querySelector('.order-empty')).not.toBeNull();
    expect(host.querySelector('.order-panel__count')!.textContent).toBe('Empty');
    expect(text('.totals dd')).toEqual(['0', '0']);
    expect(host.querySelectorAll('.order-actions a, .order-actions button')).toHaveLength(0);
  });

  it('overflow: the totals and close bar sit outside the scrolling list', () => {
    render('overflow');
    const panel = host.querySelector('.order-panel')!;
    expect([...panel.children].map((c) => c.className)).toEqual(['order-panel__head', 'order-lines', 'order-sent', 'totals', 'order-actions']);
    expect(rows().length).toBeGreaterThanOrEqual(10);
    expect(host.querySelector('.order-panel__count')!.textContent).toBe('9 items');
  });

  it('overflow: a voided row is struck and counts as no item', () => {
    render('overflow');
    const [voided] = rowsWith('voided');
    expect(voided!.classList.contains('order-line--voided')).toBe(true);
    expect(voided!.querySelector('.order-line__detail')!.textContent).toBe('Voided 19:51 · approved by M. Iqbal');
  });
});

describe('money on the panel', () => {
  it('renders grouped rupiah figures from the fixture bigints', () => {
    render('default');
    expect(text('.order-line__amount')).toEqual(['135.000', '30.000', '240.000']);
    expect(text('.order-line__detail')[0]).toBe('Large (+20.000) · Extra cheese (+15.000)');
    expect(text('.totals dd')).toEqual(['405.000', '−40.500', '18.225', '382.725', '33.136']);
  });

  it('overflow totals group past a million', () => {
    render('overflow');
    expect(text('.totals dd')).toEqual(['1.185.000', '59.250', '1.244.250', '107.727']);
  });
});
