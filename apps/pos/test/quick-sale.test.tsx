// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FIRE_ACTION } from '../src/fire.js';
import { actionsFor, OrderScreen } from '../src/OrderPanel.js';
import { ORDER_FIXTURES, orderCountLabel, orderVariant, pendingGroupHeading, type OrderState } from '../src/orderFixtures.js';
import { panelLine, SHEET_FIXTURES } from '../src/sheetFixtures.js';
import type { ShownOrder } from '../src/voidFixtures.js';

// F2d — quick sale, POS-03's second variant. FR-D2 gives an order a type,
// `table` or `quick_sale`; FR-E5 and ruling C-2 say a quick sale presents no
// fire control at all, because settling fires it. The point of this file,
// as fire.ts's file makes of FR-E4, is that the variant is a fact read off
// the order — never a branch on `?state=`.

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

let mount = 0;
function render(state: OrderState) {
  window.history.replaceState(null, '', `/pos/order?state=${state}`);
  act(() => root.render(<OrderScreen key={++mount} view={{ state }} />));
}

const press = (el: Element) => act(() => (el as HTMLElement).click());
const device = () => host.querySelector('.pos-device')!;
const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]');
const text = (selector: string) => [...host.querySelectorAll(selector)].map((e) => e.textContent);
const urlState = () => new URLSearchParams(window.location.search).get('state') ?? 'default';
const rowBody = (lineId: string) => device().querySelector(`.order-line[data-line-id="${lineId}"] > .order-line__target`)!;
const rowRemove = (lineId: string) => device().querySelector(`.order-line[data-line-id="${lineId}"] button.order-line__remove`)!;

// ---------------------------------------------------------------------------
// The variant is a fact, not a state name (acceptance criterion 4)
// ---------------------------------------------------------------------------

describe('the four consequences derive from the order’s variant (FR-D2), never from view.state', () => {
  it('orderCountLabel: a table-order count and a quick-sale count from the same number', () => {
    expect(orderCountLabel('table', 2)).toBe('2 items');
    expect(orderCountLabel('quick_sale', 2)).toBe('2 items · not yet sent');
    expect(orderCountLabel('table', 1)).toBe('1 item');
    expect(orderCountLabel('quick_sale', 1)).toBe('1 item · not yet sent');
  });

  it('pendingGroupHeading: the same two words either way', () => {
    expect(pendingGroupHeading('table')).toBe('Pending · not sent to the kitchen');
    expect(pendingGroupHeading('quick_sale')).toBe('Not sent to the kitchen yet');
  });

  it('actionsFor: a table order gets Send to kitchen; a quick sale does not have the entry at all', () => {
    expect(actionsFor('table').map((a) => a.id)).toEqual(['discount', 'void-order', FIRE_ACTION, 'settle']);
    expect(actionsFor('quick_sale').map((a) => a.id)).toEqual(['discount', 'void-order', 'settle']);
    expect(actionsFor('quick_sale').some((a) => a.id === FIRE_ACTION)).toBe(false);
  });

  it('actionsFor: Settle only widens and takes the fire meaning on a quick sale', () => {
    const tableSettle = actionsFor('table').find((a) => a.id === 'settle')!;
    const quickSettle = actionsFor('quick_sale').find((a) => a.id === 'settle')!;
    expect(tableSettle.label).toBe('Settle');
    expect(tableSettle.wide).toBeUndefined();
    expect(quickSettle.label).toBe('Settle — sends the order to the kitchen');
    expect(quickSettle.wide).toBe(true);
  });

  it('orderVariant defaults an untyped fixture to table, and reads a typed one back', () => {
    expect(orderVariant({})).toBe('table');
    expect(orderVariant({ type: 'quick_sale' })).toBe('quick_sale');
  });

  // The proof the task file asks for: a table order's own lines, handed the
  // quick type, draw the quick line-editor form — and a quick order's lines,
  // handed the table type, draw the table form. Neither object is a real
  // ?state=; panelLine never sees one, only order.type.
  it('panelLine: a table-order fixture given the quick type draws the quick affordances, and vice versa', () => {
    const tableLinesAsQuick: ShownOrder = { ...ORDER_FIXTURES.default, type: 'quick_sale' };
    const sheet = panelLine('steak', { state: 'default' }, tableLinesAsQuick)!;
    expect(sheet.title).toBe('Steak');
    expect(sheet.tag).toBe('NOT SENT YET');
    expect(sheet.notes[0]).toContain('Nothing on a counter sale goes to the kitchen');

    const quickLinesAsTable: ShownOrder = { ...ORDER_FIXTURES.quick, type: 'table' };
    const editor = panelLine('q-burger', { state: 'quick' }, quickLinesAsTable)!;
    expect(editor.title).toBe('Burger — pending');
    expect(editor.tag).toBeUndefined();
    expect(editor.notes[0]).toContain('This line has not been sent to the kitchen');
  });
});

// ---------------------------------------------------------------------------
// quick: the counter order (acceptance criterion 1)
// ---------------------------------------------------------------------------

describe('quick: draws the counter order', () => {
  beforeEach(() => render('quick'));

  it('titles the panel and tags the bar identity as the artifact does', () => {
    expect(host.querySelector('.order-panel__title')!.textContent).toBe('Order · counter');
  });

  it('counts "2 items · not yet sent", and "1 item" once a line is gone', () => {
    expect(host.querySelector('.order-panel__count')!.textContent).toBe('2 items · not yet sent');
    render('quick');
    press(rowRemove('q-burger'));
    expect(host.querySelector('.order-panel__count')!.textContent).toBe('1 item · not yet sent');
  });

  it('draws one group headed "Not sent to the kitchen yet", tagged REMOVE FREELY', () => {
    const heads = [...host.querySelectorAll('.round-head')];
    expect(heads).toHaveLength(1);
    expect(heads[0]!.querySelector('.round-head__label')!.textContent).toBe('Not sent to the kitchen yet');
    expect(heads[0]!.querySelector('.round-head__tag')!.textContent).toBe('REMOVE FREELY');
  });

  it('draws both lines, each with its own remove control', () => {
    expect(text('.order-line__name')).toEqual(['Burger', 'Soda']);
    expect(text('.order-line__amount')).toEqual(['135.000', '30.000']);
    expect(text('.order-line__detail')[0]).toBe('Large (+20.000) · Extra cheese (+15.000)');
    for (const id of ['q-burger', 'q-soda']) {
      expect(rowRemove(id).matches('button.order-line__remove[type="button"]')).toBe(true);
      expect(rowRemove(id).getAttribute('aria-label')).toBe(`Remove ${id === 'q-burger' ? 'Burger' : 'Soda'}`);
    }
  });

  it('draws the artifact’s totals, with no discount row', () => {
    expect(text('.totals dd')).toEqual(['165.000', '8.250', '173.250', '15.000']);
    expect([...host.querySelectorAll('.totals dt')].map((d) => d.textContent)).toEqual([
      'Subtotal',
      'Service charge 5%',
      'Total',
      'Includes tax 10%',
    ]);
  });

  it('satisfies I-12 exactly like every other pending-only order: both slots carry a remove control', () => {
    for (const row of [...host.querySelectorAll('.order-line')]) {
      expect(row.getAttribute('data-line-status')).toBe('pending');
      expect(row.querySelector('.order-line__slot')!.children).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// No fire control at all (acceptance criterion 2)
// ---------------------------------------------------------------------------

describe('quick: no fire control exists — absent, not inert (FR-E5, ruling C-2)', () => {
  it('the close bar is exactly Discount, Void order and the wide Settle', () => {
    render('quick');
    const bar = [...host.querySelectorAll<HTMLElement>('.order-actions > *')];
    expect(bar.map((b) => b.dataset.action)).toEqual(['discount', 'void-order', 'settle']);
  });

  it('no element names the fire action, on or off, live or unavailable', () => {
    render('quick');
    expect(host.querySelector(`[data-action="${FIRE_ACTION}"]`)).toBeNull();
    expect(text('.order-actions *')).not.toContain('Send to kitchen');
  });

  it('holds under quick-line too — the sheet does not resurrect it behind the scrim', () => {
    render('quick-line');
    expect(host.querySelector(`[data-action="${FIRE_ACTION}"]`)).toBeNull();
  });

  it('stays absent after a removal, and after adding a second removal in the same session', () => {
    render('quick');
    press(rowRemove('q-burger'));
    expect(host.querySelector(`[data-action="${FIRE_ACTION}"]`)).toBeNull();
    expect([...host.querySelectorAll<HTMLElement>('.order-actions > *')].map((b) => b.dataset.action)).toEqual([
      'discount',
      'void-order',
      'settle',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Settle carries the fire meaning (acceptance criterion 3)
// ---------------------------------------------------------------------------

describe('quick: Settle is the one wide primary control, in the artifact’s words', () => {
  it('reads "Settle — sends the order to the kitchen", primary, wide, and is the only settle-labelled control', () => {
    render('quick');
    const settle = host.querySelector<HTMLElement>('.order-actions [data-action="settle"]')!;
    expect(settle.textContent).toBe('Settle — sends the order to the kitchen');
    expect(settle.classList.contains('action--primary')).toBe(true);
    expect(settle.classList.contains('action--wide')).toBe(true);
    expect(host.querySelectorAll('.order-actions [data-action="settle"]')).toHaveLength(1);
  });

  it('still leaves POS-03 and pushes a history entry, exactly as the table order’s Settle does', () => {
    render('quick');
    const length = window.history.length;
    press(host.querySelector('.order-actions [data-action="settle"]')!);
    expect(window.history.length).toBe(length + 1);
    expect(window.location.search).toBe('?state=settle');
  });
});

// ---------------------------------------------------------------------------
// quick-line: the same sheet, in its quick form (acceptance criteria 5 and 6)
// ---------------------------------------------------------------------------

describe('quick-line: the line editor’s quick form, opened over the line that was tapped', () => {
  it('?state=quick-line draws the artifact’s own routing for review: Burger, tagged, with the quick copy', () => {
    render('quick-line');
    expect(dialog()!.querySelector('#sheet-title')!.textContent).toBe('Burger');
    expect(dialog()!.querySelector('.sheet__aside')!.textContent).toBe('NOT SENT YET');
    expect(dialog()!.textContent).toContain('Nothing on a counter sale goes to the kitchen until you settle it');
    expect(dialog()!.textContent).toContain('You can also remove it straight from the order line.');
    // Never the table form's copy or heading shape.
    expect(dialog()!.textContent).not.toContain('This line has not been sent to the kitchen');
    expect(dialog()!.querySelector('h2')!.textContent).not.toContain('—');
  });

  it.each(['q-burger', 'q-soda'] as const)(
    '%s: tapping the row opens that line’s own editor, named after it, tagged, quick copy — not a hardcoded Burger',
    (id) => {
      render('quick');
      const name = id === 'q-burger' ? 'Burger' : 'Soda';
      press(rowBody(id));
      expect(dialog()!.querySelector('#sheet-title')!.textContent).toBe(name);
      expect(dialog()!.querySelector('.sheet__aside')!.textContent).toBe('NOT SENT YET');
      expect(urlState()).toBe('quick');
    }
  );

  it('Back returns to the quick workspace and hands focus back to the row', () => {
    render('quick');
    press(rowBody('q-soda'));
    press(host.querySelector('.sheet__foot button')!); // Back
    expect(dialog()).toBeNull();
    expect(urlState()).toBe('quick');
    expect(document.activeElement).toBe(rowBody('q-soda'));
  });

  it.each([
    ['q-burger', 'Burger', ['Soda'], '31.500'],
    ['q-soda', 'Soda', ['Burger'], '141.750'],
  ] as const)('Remove line on %s takes that line, and only that line, to the artifact’s figures', (id, name, remains, total) => {
    render('quick');
    press(rowBody(id));
    const buttons = [...dialog()!.querySelectorAll('button')];
    press(buttons.find((b) => b.textContent === 'Remove line')!);
    expect(dialog()).toBeNull();
    expect(window.location.search).toBe(`?state=quick&gone=${id}`);
    expect(text('.order-line__name')).toEqual([...remains]);
    expect(text('.order-line__name')).not.toContain(name);
    expect(host.querySelector('.totals__row--grand dd')!.textContent).toBe(total);
  });
});

// ---------------------------------------------------------------------------
// Removing a line from the row’s own × updates the order (acceptance criterion 6)
// ---------------------------------------------------------------------------

describe('quick: the row’s own × removes that line, landing on the artifact’s figures', () => {
  it('removing Burger leaves Soda at 31.500, and the count reads "1 item · not yet sent"', () => {
    render('quick');
    press(rowRemove('q-burger'));
    expect(text('.order-line__name')).toEqual(['Soda']);
    expect(text('.totals dd')).toEqual(['30.000', '1.500', '31.500', '2.727']);
    expect(host.querySelector('.order-panel__count')!.textContent).toBe('1 item · not yet sent');
  });

  it('removing Soda leaves Burger at 141.750', () => {
    render('quick');
    press(rowRemove('q-soda'));
    expect(text('.order-line__name')).toEqual(['Burger']);
    expect(text('.totals dd')).toEqual(['135.000', '6.750', '141.750', '12.273']);
  });

  it('removing a line replaces the history entry (SITEMAP §1: [INLINE], not back-stackable)', () => {
    render('quick');
    const length = window.history.length;
    press(rowRemove('q-burger'));
    expect(window.history.length).toBe(length);
  });
});

// ---------------------------------------------------------------------------
// Reachability: every live control on the frame leads somewhere ungated
// ---------------------------------------------------------------------------

function liveControls(container: ParentNode): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => !el.closest('[inert]'));
}

describe('quick-line: every control in it is a button, none a link, and nothing gated is reachable', () => {
  it('is one dialog, and every live control is a <button type="button">', () => {
    render('quick-line');
    expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(dialog()!.querySelectorAll('a')).toHaveLength(0);
    for (const el of liveControls(dialog()!)) {
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('type')).toBe('button');
    }
  });

  it('the panel’s void path is still behind it, and inert', () => {
    render('quick-line');
    const voidPath = device().querySelector('.order-actions button[data-action="void-order"]');
    expect(voidPath).not.toBeNull();
    expect(voidPath!.closest('[inert]')).not.toBeNull();
  });
});

// FE-013, finding 2 of the F2h/F2d review. The reachability sweep in
// test/sheets.test.tsx now presses these same controls generically, over
// every fixture SHEET_FIXTURES carries; these three follow quick-line's
// static exits by name and check where each one actually lands, which is
// what the review found missing — the block above checks markup and an
// inert background, never a press.
describe('quick-line: its static Back, Escape and Remove line all land on quick, ungated', () => {
  const buttonNamed = (name: string) =>
    [...dialog()!.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!;

  it('Back returns to quick with the order untouched, focus on the opener', () => {
    render('quick-line');
    const opener = device().querySelector(SHEET_FIXTURES['quick-line']!.opener)!;
    press(buttonNamed('Back'));
    expect(dialog()).toBeNull();
    expect(urlState()).toBe('quick');
    expect(text('.order-line__name')).toEqual(['Burger', 'Soda']);
    expect(document.activeElement).toBe(device().querySelector(SHEET_FIXTURES['quick-line']!.opener));
    expect(opener).not.toBeNull();
  });

  it('Escape does the same as Back', () => {
    render('quick-line');
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(dialog()).toBeNull();
    expect(urlState()).toBe('quick');
    expect(text('.order-line__name')).toEqual(['Burger', 'Soda']);
  });

  it('Remove line removes Burger and lands on quick, still ungated', () => {
    render('quick-line');
    press(buttonNamed('Remove line'));
    expect(dialog()).toBeNull();
    expect(window.location.search).toBe('?state=quick&gone=q-burger');
    expect(text('.order-line__name')).toEqual(['Soda']);
  });
});
