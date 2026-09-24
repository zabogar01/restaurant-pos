// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MENU_FIXTURES, MENU_ITEMS } from '../src/menuFixtures.js';
import { APPROVAL_FIXTURES } from '../src/approvalFixtures.js';
import { DISCOUNT_FIXTURES } from '../src/discountFixtures.js';
import { VOID_FIXTURES } from '../src/voidFixtures.js';
import { OrderScreen } from '../src/OrderPanel.js';
import { orderTotals } from '../src/discount.js';
import { STAFF_MEAL } from '../src/discountFixtures.js';
import { ITEM_SHEET_ORIGINS, ORDER_FIXTURES, ORDER_STATES, orderViewFrom, type OrderState } from '../src/orderFixtures.js';
import { ITEM_SHEET_STATES, QUANTITY_MAX, SHEET_FIXTURES, panelLine, type ItemSheetFixture } from '../src/sheetFixtures.js';
import { SheetView } from '../src/Sheets.js';
import { shownOrder } from '../src/voidFixtures.js';
import { formatAmount } from '../src/money.js';

// FE-021 Part A: every tile opens its own item. The shape this kills is one
// destination shared by twelve controls (it used to be Burger's sheet).

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
function render(state: string) {
  window.history.replaceState(null, '', `/pos/order?state=${state}`);
  act(() => root.render(<OrderScreen key={++mount} view={{ state: state as never }} />));
}

const press = (el: Element) => act(() => (el as HTMLElement).click());
const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]');
const buttonNamed = (name: string) =>
  [...dialog()!.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!;
const pendingRows = () => [...host.querySelectorAll<HTMLElement>('.order-line[data-line-status="pending"]')];

// Criterion 2. The artifact's `items` table (frost-order-flow.js), transcribed:
// [name, price, [group name, many, [[option, delta]...], [selected indexes]]...].
type Row = [string, number, Array<[string, boolean, Array<[string, number]>, number[]]>];
const ARTIFACT: Record<string, Row> = {
  burger: ['Burger', 100000, [['Size', false, [['Regular', 0], ['Large', 20000], ['Small', -10000]], [1]], ['Extras', true, [['Extra cheese', 15000], ['Bacon', 20000], ['No onion', 0]], [0]]]],
  wings: ['Chicken Wings', 90000, [['Sauce', false, [['Buffalo', 0], ['BBQ', 0], ['Garlic butter', 10000]], [0]]]],
  steak: ['Steak', 240000, [['Doneness', false, [['Medium rare', 0], ['Medium', 0], ['Well done', 0]], [0]], ['Extras', true, [['Pepper sauce', 10000], ['Garlic butter', 15000]], [0]]]],
  fish: ['Fish & Chips', 140000, [['Sauce', false, [['Tartare', 0], ['Chilli mayo', 5000]], [0]], ['Extras', true, [['Extra fish', 60000]], [0]]]],
  salad: ['Caesar Salad', 75000, [['Extras', true, [['Grilled chicken', 25000], ['No croutons', 0]], [0]]]],
  soup: ['Soup of the Day', 55000, [['Bread', false, [['With bread', 0], ['No bread', -5000]], [1]]]],
  fries: ['Fries', 40000, [['Seasoning', false, [['Salt', 0], ['Chilli', 0]], [0]], ['Extras', true, [['Cheese sauce', 10000]], []]]],
  rings: ['Onion Rings', 45000, [['Dip', false, [['Ketchup', 0], ['Garlic mayo', 5000]], [1]]]],
  soda: ['Soda', 30000, []],
  coffee: ['Coffee', 35000, [['Size', false, [['Regular', 0], ['Large', 10000]], [1]], ['Extras', true, [['Extra shot', 10000]], []]]],
  beer: ['Beer', 65000, [['Size', false, [['Regular', 0], ['Large', 25000]], [1]]]],
  wine: ['House Wine', 80000, [['Pour', false, [['Standard', 0], ['Small', -20000]], [1]]]],
};

describe('criterion 1: each of the twelve tiles adds its own item', () => {
  it.each(MENU_ITEMS.map((i) => [i.id, i] as const))('%s: tap, Add, the new pending line is that item', (id, item) => {
    render('default');
    const before = pendingRows().length;
    press(host.querySelector(`.menu-tile[data-item="${id}"]`)!);
    expect(dialog()!.querySelector('h2')!.textContent).toBe(item.name);
    press(buttonNamed('Add to order'));

    const rows = pendingRows();
    expect(rows).toHaveLength(before + 1);
    const added = rows[rows.length - 1]!;
    expect(added.dataset.lineId).toMatch(new RegExp(`^${id}-\\d+$`));
    expect(added.querySelector('.order-line__name')!.firstChild!.textContent).toBe(item.name);
    // Every option starts unchosen or at the artifact's own default, so the
    // amount is the item's price plus whatever that default costs: never Burger's 135.000.
    const fixture = SHEET_FIXTURES[`sheet-item-${id}` as never] as ItemSheetFixture;
    expect(fixture.itemId).toBe(id);
    expect(fixture.price).toBe(item.price);
    // The row's own amount: the artifact's price plus its default selections' deltas.
    const [, price, groups] = ARTIFACT[id]!;
    const deltas = groups.flatMap(([, , options, on]) => on.map((j) => options[j]![1])).reduce((a, b) => a + b, 0);
    expect(added.querySelector('.order-line__amount')!.textContent).toBe(formatAmount(BigInt(price + deltas)));
  });

  it('the twelve states exist, with sheet-item still Burger’s alias', () => {
    expect(ITEM_SHEET_STATES).toEqual(MENU_ITEMS.map((i) => `sheet-item-${i.id}`));
    expect((SHEET_FIXTURES['sheet-item' as never] as ItemSheetFixture).itemId).toBe('burger');
  });
});

describe('criterion 2: the option sets are the artifact’s', () => {
  it.each(Object.keys(ARTIFACT))('%s', (id) => {
    const [name, price, groups] = ARTIFACT[id]!;
    const f = SHEET_FIXTURES[`sheet-item-${id}` as never] as ItemSheetFixture;
    expect(f.name).toBe(name);
    expect(f.price).toBe(BigInt(price));
    expect(
      f.groups.map((g) => [g.name, g.many, g.options.map((o) => [o.name, Number(o.delta)]), g.options.flatMap((o, j) => (f.chosen[g.id]!.includes(o.id) ? [j] : []))])
    ).toEqual(groups);
  });

  it('Soda’s sheet draws no option-group label, and no empty group', () => {
    render('sheet-item-soda');
    expect(dialog()!.querySelector('.sheet__label')).toBeNull();
    expect(dialog()!.querySelector('.sheet-group')).toBeNull();
    expect(dialog()!.querySelector('[data-option]')).toBeNull();
  });

  it('every other sheet labels each group as the artifact does', () => {
    render('sheet-item-steak');
    expect([...dialog()!.querySelectorAll('.sheet__label')].map((l) => l.textContent)).toEqual(['Doneness — choose one', 'Extras — choose any']);
  });
});

const grand = () => host.querySelector('.totals__row--grand dd')!.textContent;
const totalsRows = () =>
  Object.fromEntries([...host.querySelectorAll('.pos-device .totals__row')].map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]));
const stepper = (label: 'Increase quantity' | 'Decrease quantity') => buttonNamed(label) as HTMLButtonElement;
const update = () => dialog()!.querySelector<HTMLButtonElement>('[data-action="update-quantity"]')!;
const times = (n: number, f: () => void) => {
  for (let i = 0; i < n; i++) f();
};

describe('criterion 3: Add at n = 2', () => {
  it('appends one line at quantity 2 for 2 × unit, and the totals follow', () => {
    render('default');
    const beforeSubtotal = ORDER_FIXTURES.default.totals.subtotal;
    const rows = pendingRows().length;
    press(host.querySelector('.menu-tile[data-item="burger"]')!);
    press(buttonNamed('Increase quantity'));
    // Large + Extra cheese by default: unit 135.000.
    expect(dialog()!.querySelector('.sheet-total__amount')!.textContent).toBe('270.000');
    press(buttonNamed('Add to order'));

    expect(pendingRows()).toHaveLength(rows + 1);
    const added = pendingRows().at(-1)!;
    expect(added.querySelector('.order-line__quantity')!.textContent).toBe('2');
    expect(added.querySelector('.order-line__amount')!.textContent).toBe('270.000');
    expect(grand()).toBe(formatAmount(orderTotals(beforeSubtotal + 270_000n, STAFF_MEAL).total));
  });

  it('with a modifier price too: Fish & Chips with Chilli mayo (+5.000) × 2 is 290.000', () => {
    render('default');
    press(host.querySelector('.menu-tile[data-item="fish"]')!);
    press(dialog()!.querySelector('[data-option="chilli-mayo"]')!);
    // The artifact pre-selects Extra fish (+60.000); take it off, so the unit is 140.000 + 5.000.
    press(dialog()!.querySelector('[data-option="extra-fish"]')!);
    press(buttonNamed('Increase quantity'));
    press(buttonNamed('Add to order'));
    const added = pendingRows().at(-1)!;
    expect(added.querySelector('.order-line__quantity')!.textContent).toBe('2');
    expect(added.querySelector('.order-line__amount')!.textContent).toBe('290.000');
  });

  it('adds at quantity 1 when the stepper is untouched', () => {
    render('default');
    press(host.querySelector('.menu-tile[data-item="soda"]')!);
    press(buttonNamed('Add to order'));
    expect(pendingRows().at(-1)!.querySelector('.order-line__quantity')!.textContent).toBe('1');
  });
});

describe('criteria 4 and 5: the line editor commits explicitly and stays in bounds', () => {
  const calls: Array<[string, number]> = [];
  const backs: unknown[] = [];
  function mountSheet(state: 'sheet-line' | 'quick-line') {
    calls.length = 0;
    backs.length = 0;
    const order = shownOrder({ state });
    act(() =>
      root.render(
        <SheetView
          sheet={SHEET_FIXTURES[state]!}
          go={(v) => backs.push(v)}
          addLine={() => {}}
          setQuantity={(id, n) => calls.push([id, n])}
          order={order}
          renderTotals={() => null}
        />
      )
    );
  }

  it('Update to n calls setQuantity exactly once with n, and closes', () => {
    mountSheet('sheet-line');
    press(stepper('Increase quantity'));
    press(stepper('Increase quantity'));
    expect(update().textContent).toBe('Update to 3');
    press(update());
    expect(calls).toEqual([['steak', 3]]);
    expect(backs).toEqual([SHEET_FIXTURES['sheet-line' as never] && (SHEET_FIXTURES['sheet-line'] as { back: unknown }).back]);
  });

  it('Back calls nothing and the draft is discarded', () => {
    mountSheet('sheet-line');
    press(stepper('Increase quantity'));
    press(buttonNamed('Back'));
    expect(calls).toEqual([]);
    expect(backs).toHaveLength(1);
  });

  it('the primary is off while n equals the current quantity, and pressing it does nothing', () => {
    mountSheet('sheet-line');
    expect(update().disabled).toBe(true);
    expect(update().getAttribute('aria-disabled')).toBe('true');
    press(update());
    expect(calls).toEqual([]);
    press(stepper('Increase quantity'));
    expect(update().disabled).toBe(false);
    press(stepper('Decrease quantity'));
    expect(update().disabled).toBe(true);
    press(update());
    expect(calls).toEqual([]);
  });

  it('Remove line is a separate control, not the primary', () => {
    mountSheet('sheet-line');
    expect(buttonNamed('Remove line').classList.contains('action--primary')).toBe(false);
  });

  it('− at 1 is off and never removes the line', () => {
    render('sheet-line');
    const before = [...host.querySelectorAll('.order-line')].length;
    expect(stepper('Decrease quantity').disabled).toBe(true);
    press(stepper('Decrease quantity'));
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('output')!.textContent).toBe('1');
    expect([...host.querySelectorAll('.order-line')]).toHaveLength(before);
    expect(dialog()!.textContent).toContain('Minimum 1. Use Remove line to remove this line.');
  });

  it('+ at 99 is off, states the maximum, and no path reaches 0 or 100', () => {
    mountSheet('sheet-line');
    const seen = new Set<number>();
    times(150, () => {
      press(stepper('Increase quantity'));
      seen.add(Number(dialog()!.querySelector('output')!.textContent));
    });
    expect(stepper('Increase quantity').disabled).toBe(true);
    expect(dialog()!.querySelector('output')!.textContent).toBe(String(QUANTITY_MAX));
    expect(dialog()!.textContent).toContain('Maximum 99 per line. Increase is unavailable.');
    times(150, () => {
      press(stepper('Decrease quantity'));
      seen.add(Number(dialog()!.querySelector('output')!.textContent));
    });
    expect(Math.min(...seen)).toBe(1);
    expect(Math.max(...seen)).toBe(99);
  });

  it('the item sheet’s stepper has the same bounds', () => {
    render('sheet-item-soda');
    expect(stepper('Decrease quantity').disabled).toBe(true);
    times(150, () => press(stepper('Increase quantity')));
    expect(dialog()!.querySelector('output')!.textContent).toBe('99');
    expect(stepper('Increase quantity').disabled).toBe(true);
    times(150, () => press(stepper('Decrease quantity')));
    expect(dialog()!.querySelector('output')!.textContent).toBe('1');
  });

  it('draws the preview at rest, as the artifact does, and it is labelled not saved', () => {
    render('sheet-line');
    const rest = dialog()!.querySelector('.sheet__preview')!;
    expect(rest.textContent).toContain('After update · not saved yet');
    expect(dialog()!.textContent).toContain('240.000 × 1 = 240.000');
    expect(rest.textContent).toContain(formatAmount(ORDER_FIXTURES['sheet-line'].totals.total));
    press(stepper('Increase quantity'));
    expect(dialog()!.textContent).toContain('240.000 × 2 = 480.000');
    // The order behind the sheet is unchanged until Update.
    expect(grand()).toBe(formatAmount(ORDER_FIXTURES['sheet-line'].totals.total));
  });

  it('the quick line editor draws it at rest too', () => {
    render('quick-line');
    expect(dialog()!.querySelector('.sheet__preview')!.textContent).toContain('After update · not saved yet');
  });
});

describe('criterion 6: the figures after Update, from ?state=sheet-line (Steak 1 → 3)', () => {
  it('reads 885.000 / −88.500 / 39.825 / 836.325 / 72.409', () => {
    render('sheet-line');
    press(stepper('Increase quantity'));
    press(stepper('Increase quantity'));
    press(update());
    expect(dialog()).toBeNull();
    const rows = totalsRows();
    expect(rows['Subtotal']).toBe('885.000');
    expect(rows['Staff meal 10%'] ?? Object.entries(rows).find(([k]) => k.startsWith('Staff meal'))![1]).toBe('−88.500');
    expect(Object.entries(rows).find(([k]) => k.startsWith('Service'))![1]).toBe('39.825');
    expect(rows['Total']).toBe('836.325');
    expect(Object.entries(rows).find(([k]) => k.startsWith('Includes tax'))![1]).toBe('72.409');
  });

  it('the preview shows those same figures before Update', () => {
    render('sheet-line');
    press(stepper('Increase quantity'));
    press(stepper('Increase quantity'));
    const preview = dialog()!.querySelector('.sheet__preview')!;
    expect(preview.textContent).toContain('885.000');
    expect(preview.textContent).toContain('836.325');
  });

  it('a pending line opened from the panel updates the same way', () => {
    render('default');
    press(host.querySelector('.order-line[data-line-status="pending"] > .order-line__target')!);
    press(stepper('Increase quantity'));
    press(update());
    const steak = host.querySelector('.order-line[data-line-id="steak"]')!;
    expect(steak.querySelector('.order-line__quantity')!.textContent).toBe('2');
    expect(steak.querySelector('.order-line__amount')!.textContent).toBe('480.000');
  });
});

describe('criterion 7: comp and void survive an Add', () => {
  it('Soda added from zero: total 0, Comp 100% kept', () => {
    render('zero');
    press(host.querySelector('.menu-tile[data-item="soda"]')!);
    press(buttonNamed('Add to order'));
    expect(grand()).toBe('0');
    expect(Object.keys(totalsRows()).some((k) => k.startsWith('Comp'))).toBe(true);
  });

  it('Soda added from overflow: the voided Caesar Salad row stays, total 1.275.750', () => {
    render('overflow');
    press(host.querySelector('.menu-tile[data-item="soda"]')!);
    press(buttonNamed('Add to order'));
    const names = [...host.querySelectorAll('.order-line__name')].map((n) => n.firstChild!.textContent);
    expect(names).toContain('Caesar Salad');
    expect(host.querySelector('.order-line[data-line-status="voided"]')).not.toBeNull();
    expect(grand()).toBe('1.275.750');
  });
});

describe('criterion 8: no stepper on a fired line', () => {
  it('panelLine draws no editor for a fired line', () => {
    const order = shownOrder({ state: 'default' });
    expect(panelLine('soda', { state: 'default' }, order)).toBeUndefined();
  });

  it('pressing a fired row opens no quantity control', () => {
    render('default');
    press(host.querySelector('.order-line[data-line-status="fired"] > .order-line__target')!);
    expect(host.querySelector('[aria-label="Increase quantity"], [aria-label="Decrease quantity"]')).toBeNull();
  });
});

describe('round 2', () => {
  const FIRE = '.order-actions [data-action="fire"]';
  const steakRow = () => host.querySelector('.order-line[data-line-id="steak"]')!;

  it('P1: a line added live opens its own editor and updates to 2', () => {
    render('default');
    press(host.querySelector('.menu-tile[data-item="fish"]')!);
    press(buttonNamed('Add to order'));
    press(host.querySelector('.order-line[data-line-id^="fish-"] > .order-line__target')!);
    expect(dialog()!.querySelector('h2')!.textContent).toBe('Fish & Chips — pending');
    press(stepper('Increase quantity'));
    press(update());
    const row = host.querySelector('.order-line[data-line-id^="fish-"]')!;
    expect(row.querySelector('.order-line__quantity')!.textContent).toBe('2');
    // Tartare + Extra fish (+60.000) by default: unit 200.000.
    expect(row.querySelector('.order-line__amount')!.textContent).toBe('400.000');
  });

  describe.each(['Cancel', 'Add to order'])('P2: %s from an item sheet entered from eightysix', (way) => {
    it('keeps the held Steak tagged 86, and Send still refused', () => {
      render('eightysix');
      const fire = () => host.querySelector(FIRE)!;
      expect(fire().tagName).toBe('SPAN');
      press(host.querySelector('.menu-tile[data-item="soda"]')!);
      // Under the open sheet, too: the panel behind it must not say the Steak is fine.
      expect(steakRow().querySelector('.tag-86')).not.toBeNull();
      expect(fire().tagName).toBe('SPAN');
      press(buttonNamed(way));
      expect(dialog()).toBeNull();
      expect(window.location.search).toBe('?state=eightysix');
      expect(steakRow().querySelector('.tag-86')).not.toBeNull();
      expect(fire().tagName).toBe('SPAN');
      expect(host.querySelector('.menu-tile--off[data-item="steak"]')).not.toBeNull();
    });
  });

  it('P2: an item sheet entered from default returns to default', () => {
    render('default');
    press(host.querySelector('.menu-tile[data-item="soda"]')!);
    press(buttonNamed('Cancel'));
    expect(window.location.search).toBe('?state=default');
  });

  it('P4: a chosen zero-delta Size goes into the line’s modifiers', () => {
    render('default');
    press(host.querySelector('.menu-tile[data-item="coffee"]')!);
    press(dialog()!.querySelector('[data-option="regular"]')!);
    press(buttonNamed('Add to order'));
    expect(pendingRows().at(-1)!.textContent).toContain('Regular');
  });

  it('P4: Burger Regular too', () => {
    render('default');
    press(host.querySelector('.menu-tile[data-item="burger"]')!);
    press(dialog()!.querySelector('[data-option="regular"]')!);
    press(buttonNamed('Add to order'));
    expect(pendingRows().at(-1)!.textContent).toContain('Regular');
  });

  it('P5: Cancel is on a secondary row, − n + sits beside Add to order on the commit row', () => {
    render('sheet-item-soda');
    const commit = dialog()!.querySelector('.sheet__commit')!;
    const secondary = dialog()!.querySelector('.sheet__secondary')!;
    expect(commit.contains(buttonNamed('Add to order'))).toBe(true);
    expect(commit.contains(buttonNamed('Increase quantity'))).toBe(true);
    expect(commit.contains(buttonNamed('Decrease quantity'))).toBe(true);
    expect(secondary.contains(buttonNamed('Cancel'))).toBe(true);
    expect(commit.contains(buttonNamed('Cancel'))).toBe(false);
  });

  it('P6: the 86’d item sheet keeps its stepper; Add is not a control', () => {
    render('sheet-item86');
    const commit = dialog()!.querySelector('.sheet__commit')!;
    expect(commit.querySelector('output')!.textContent).toBe('1');
    press(stepper('Increase quantity'));
    expect(commit.querySelector('output')!.textContent).toBe('2');
    expect(dialog()!.querySelector('.sheet-total__amount')!.textContent).toBe('270.000');
    const add = [...commit.querySelectorAll('*')].find((e) => e.textContent?.trim() === 'Add to order')!;
    expect(add.tagName).toBe('SPAN');
    expect(dialog()).not.toBeNull();
  });
});

describe('round 3', () => {
  const NOTICES = ['Could not add that line', 'Nothing was added'];
  const noticeShown = () => NOTICES.some((n) => host.textContent!.includes(n));
  const soda = () => press(host.querySelector('.menu-tile[data-item="soda"]')!);

  it.each(['error', 'catalog'])('9: a successful Add from %s leaves no notice claiming nothing changed', (origin) => {
    render(origin);
    expect(noticeShown()).toBe(true);
    const before = pendingRows().length;
    soda();
    press(buttonNamed('Add to order'));
    expect(pendingRows()).toHaveLength(before + 1);
    expect(noticeShown()).toBe(false);
    expect(window.location.search).toBe('?state=default');
  });

  it('9: Cancel from error keeps the origin, and its notice is still true', () => {
    render('error');
    soda();
    press(buttonNamed('Cancel'));
    expect(window.location.search).toBe('?state=error');
    expect(noticeShown()).toBe(true);
  });

  // 10: the rule, stated: a `from` is a workspace state in which a menu tile is
  // actually pressable — not an overlay (a sheet, the approval prompt, a
  // discount or void sheet: those are drawn over a place, they are not one),
  // and not a state whose grid is inert (a lock, or the loading skeleton).
  // Derived from the fixture tables, not from the parser's own list.
  const overlay = (id: string) => Boolean(SHEET_FIXTURES[id as never] ?? APPROVAL_FIXTURES[id as never] ?? DISCOUNT_FIXTURES[id as never] ?? VOID_FIXTURES[id as never]);
  const inert = (id: string) => Boolean(MENU_FIXTURES[id as OrderState].lock || MENU_FIXTURES[id as OrderState].loading);
  const pressable = (id: string) => !overlay(id) && !inert(id);

  it.each(ORDER_STATES.map((s) => s.id))('10: from=%s parses per the rule', (id) => {
    const view = orderViewFrom(`?state=sheet-item-soda&from=${id}`);
    expect(view.from).toBe(pressable(id) ? id : undefined);
  });

  it('10: the rule is not vacuous, and anything else parses as no origin', () => {
    const accepted = ORDER_STATES.map((s) => s.id).filter(pressable);
    expect(accepted).toEqual(expect.arrayContaining(['default', 'eightysix', 'overflow', 'zero', 'error', 'catalog', 'quick']));
    for (const bad of ['sheet-line', 'quick-line', 'approval', 'lock-lease', 'lock-draft', 'loading', 'sheet-discount', 'sheet-voidline', 'nonsense', 'settle-error'])
      expect(orderViewFrom(`?state=sheet-item-soda&from=${bad}`).from).toBeUndefined();
    // and only an item sheet carries one
    expect(orderViewFrom('?state=default&from=eightysix').from).toBeUndefined();
  });

  it('10: an edited URL naming an overlay origin returns to the workspace, not another sheet', () => {
    window.history.replaceState(null, '', '/pos/order?state=sheet-item-soda&from=sheet-line');
    act(() => root.render(<OrderScreen key={++mount} view={orderViewFrom(window.location.search)} />));
    press(buttonNamed('Cancel'));
    expect(window.location.search).toBe('?state=default');
  });

  it('9: Add from any accepted origin draws no transient notice afterwards', () => {
    for (const id of ORDER_STATES.map((s) => s.id).filter(pressable)) {
      render(id);
      soda();
      press(buttonNamed('Add to order'));
      const after = orderViewFrom(window.location.search);
      expect(MENU_FIXTURES[after.from ?? after.state].rejected ?? MENU_FIXTURES[after.state].catalogChanged).toBeFalsy();
      expect(noticeShown()).toBe(false);
    }
  });

  it('3: a pre-existing line is never repriced from today’s menu (quick Burger, base 100.000 → 120.000)', () => {
    const burger = MENU_ITEMS.find((i) => i.id === 'burger')!;
    const was = burger.price;
    try {
      render('quick-line');
      (burger as { price: bigint }).price = 120_000n;
      // At rest, the label and the figure agree with the line's own 135.000.
      expect(dialog()!.textContent).toContain('135.000 × 1 = 135.000');
      press(stepper('Increase quantity'));
      expect(dialog()!.textContent).toContain('135.000 × 2 = 270.000');
      press(update());
      expect(host.querySelector('.order-line[data-line-id="q-burger"] .order-line__amount')!.textContent).toBe('270.000');
    } finally {
      (burger as { price: bigint }).price = was;
    }
  });
});

describe('round 4: the incident banner survives an open item sheet', () => {
  // The origin-derived facts (FR-E3 makes the incident application-wide): the
  // banner reads the origin while the sheet is open, and stays, inert, behind it.
  const banner = () => host.querySelector('.emergency-banner');

  it('opening Soda from fireerror: the banner is present while the sheet is open, and after Cancel and Add', () => {
    render('fireerror');
    expect(banner()).not.toBeNull();
    press(host.querySelector('.menu-tile[data-item="soda"]')!);
    expect(dialog()).not.toBeNull();
    expect(banner()).not.toBeNull();
    expect(banner()!.closest('[inert]') ?? banner()!.hasAttribute('inert')).toBeTruthy();
    press(buttonNamed('Cancel'));
    expect(banner()).not.toBeNull();
    // ...and after a successful Add (the title says both).
    press(host.querySelector('.menu-tile[data-item="soda"]')!);
    press(buttonNamed('Add to order'));
    expect(dialog()).toBeNull();
    expect(banner()).not.toBeNull();
  });

  const withIncident = (Object.keys(ITEM_SHEET_ORIGINS) as OrderState[]).filter((o) => ORDER_FIXTURES[o].incident);
  it('the rule is not vacuous: fireerror has one', () => {
    expect(withIncident).toContain('fireerror');
  });

  it.each(withIncident)('every origin with an incident (%s): the banner is there with its sheet open', (origin) => {
    render(origin);
    press(host.querySelector('.menu-tile[data-item="soda"]')!);
    expect(dialog()).not.toBeNull();
    expect(banner()).not.toBeNull();
    expect(banner()!.textContent).toContain(ORDER_FIXTURES[origin].incident!.title);
  });
});

describe('round 5: a held tap has ended', () => {
  const isPressed = () => host.querySelectorAll('.is-pressed').length;

  it('the pressed origin draws a held row and tile', () => {
    render('pressed');
    expect(isPressed()).toBeGreaterThan(0);
  });

  it.each(['Cancel', 'Add to order'])('%s from pressed: no row or tile is marked pressed, and it lands on default', (way) => {
    render('pressed');
    press(host.querySelector('.menu-tile[data-item="soda"]')!);
    press(buttonNamed(way));
    expect(window.location.search).toBe('?state=default');
    expect(isPressed()).toBe(0);
  });

  it('Cancel from error and catalog still returns to the origin: their notice is still true', () => {
    for (const origin of ['error', 'catalog']) {
      render(origin);
      press(host.querySelector('.menu-tile[data-item="soda"]')!);
      press(buttonNamed('Cancel'));
      expect(window.location.search).toBe(`?state=${origin}`);
    }
  });
});
