// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MENU_CATEGORIES, MENU_FIXTURES, MENU_ITEMS, originFacts } from '../src/menuFixtures.js';
import { formatAmount } from '../src/money.js';
import { OrderScreen } from '../src/OrderPanel.js';
import { ITEM_SHEET_ORIGINS, ORDER_STATES, type OrderState, type OrderView } from '../src/orderFixtures.js';

// FE-023: a category press selects that category, and the grid shows its items.

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
function render(view: OrderView | OrderState) {
  const v = typeof view === 'string' ? { state: view } : view;
  window.history.replaceState(null, '', `/pos/order?state=${v.state}${v.from ? `&from=${v.from}` : ''}`);
  act(() => root.render(<OrderScreen key={++mount} view={v} />));
}
const press = (el: Element) => act(() => (el as HTMLElement).click());
const tiles = () => [...host.querySelectorAll<HTMLElement>('.menu-grid > .menu-tile')];
const gridIds = () => tiles().map((t) => t.dataset.item);
const rail = (name: string) => [...host.querySelectorAll<HTMLElement>('.menu-categories > .menu-category')].find((c) => c.textContent === name)!;
const dialog = () => host.querySelector('[role="dialog"]');
const buttonNamed = (name: string) => [...dialog()!.querySelectorAll('button')].find((b) => b.textContent!.trim().startsWith(name))!;
const pendingRows = () => [...host.querySelectorAll<HTMLElement>('[data-line-id]')];

// The lead's ruling (FE-023): the table is the contract, and is written out here.
const EXPECTED = {
  mains: ['burger', 'wings', 'steak', 'fish'],
  sides: ['salad', 'soup', 'fries', 'rings'],
  drinks: ['soda', 'water', 'coffee', 'beer', 'wine'],
  desserts: ['cheesecake'],
} as const;

describe('criterion 1: each category shows exactly its items', () => {
  it.each(MENU_CATEGORIES.map((c) => [c.id, c.name] as const))('%s', (id, name) => {
    render('default');
    press(rail(name));
    expect(gridIds()).toEqual(EXPECTED[id]);
  });

  it('a fresh load starts on Mains', () => {
    render('default');
    expect(gridIds()).toEqual(EXPECTED.mains);
  });

  it('Drinks does not still show Burger', () => {
    render('default');
    press(rail('Drinks'));
    expect(gridIds()).not.toContain('burger');
  });
});

describe('criterion 2: every item is in exactly one category', () => {
  it('the union of the categories is the whole menu, with no duplicates', () => {
    const all = MENU_CATEGORIES.flatMap((c) => MENU_ITEMS.filter((i) => i.category === c.id).map((i) => i.id));
    expect(all.slice().sort()).toEqual(MENU_ITEMS.map((i) => i.id).sort());
    expect(new Set(all).size).toBe(MENU_ITEMS.length);
    expect(MENU_ITEMS).toHaveLength(14);
    expect(MENU_CATEGORIES.every((c) => MENU_ITEMS.some((i) => i.category === c.id))).toBe(true);
  });

  it('the new items are priced as ruled, and each has its own sheet state', () => {
    expect(MENU_ITEMS.find((i) => i.id === 'water')).toMatchObject({ name: 'Mineral Water', price: 20_000n });
    expect(MENU_ITEMS.find((i) => i.id === 'cheesecake')).toMatchObject({ name: 'Cheesecake', price: 60_000n });
    for (const id of ['water', 'cheesecake']) {
      expect(ORDER_STATES.map((s) => s.id)).toContain(`sheet-item-${id}`);
      expect(MENU_FIXTURES).toHaveProperty(`sheet-item-${id}`);
    }
  });
});

describe('criterion 3: aria-current is on exactly the pressed category', () => {
  it.each(MENU_CATEGORIES.map((c) => c.name))('%s', (name) => {
    render('default');
    press(rail(name));
    const current = [...host.querySelectorAll('.menu-categories [aria-current]')];
    expect(current.map((c) => c.textContent)).toEqual([name]);
    expect(host.querySelectorAll('.menu-category--selected')).toHaveLength(1);
    expect(host.querySelector('.menu-category--selected')!.textContent).toBe(name);
  });
});

describe('criterion 4: the category survives an item-sheet round trip', () => {
  it.each(['Add to order', 'Cancel'])('Drinks → Beer → %s → still Drinks', (way) => {
    render('default');
    press(rail('Drinks'));
    press(tiles().find((t) => t.dataset.item === 'beer')!);
    expect(dialog()).not.toBeNull();
    press(buttonNamed(way));
    expect(dialog()).toBeNull();
    expect(gridIds()).toEqual(EXPECTED.drinks);
    expect(host.querySelector('.menu-category--selected')!.textContent).toBe('Drinks');
  });

  // Every origin an item sheet can be opened from, not only the named ones:
  // the origin's policy decides where Cancel and Add land, never the category.
  const origins = Object.keys(ITEM_SHEET_ORIGINS) as OrderState[];
  it.each(origins.flatMap((o) => (['Add to order', 'Cancel'] as const).map((w) => [o, w] as const)))('from %s, %s', (origin, way) => {
    render(origin);
    if (originFacts({ state: origin }).lock) return;
    press(rail('Drinks'));
    const tile = tiles().find((t) => t.dataset.item === 'water')!;
    press(tile);
    expect(dialog()).not.toBeNull();
    press(buttonNamed(way));
    expect(dialog()).toBeNull();
    expect(gridIds()).toEqual(EXPECTED.drinks);
    expect(host.querySelector('.menu-category--selected')!.textContent).toBe('Drinks');
  });

  it('an item sheet opened by URL over a category other than Mains still finds its category on close', () => {
    render({ state: 'sheet-item-beer', from: 'default' });
    press(buttonNamed('Cancel'));
    expect(gridIds()).toEqual(EXPECTED.mains);
  });
});

describe('criterion 5: a press changes neither the URL nor the history, nor the order', () => {
  it('Drinks', () => {
    render('default');
    const url = window.location.href;
    const length = window.history.length;
    const rows = pendingRows().map((r) => r.outerHTML);
    press(rail('Drinks'));
    expect(window.location.href).toBe(url);
    expect(window.location.search).not.toContain('category');
    expect(window.history.length).toBe(length);
    expect(pendingRows().map((r) => r.outerHTML)).toEqual(rows);
  });
});

describe('criterion 6: the new items add their own line at their own price', () => {
  it.each([
    ['Drinks', 'water', 'Mineral Water', 20_000n],
    ['Desserts', 'cheesecake', 'Cheesecake', 60_000n],
  ] as const)('%s → %s', (category, id, name, price) => {
    render('default');
    press(rail(category));
    const before = pendingRows().length;
    press(tiles().find((t) => t.dataset.item === id)!);
    expect(dialog()!.querySelector('h2')!.textContent).toBe(name);
    expect(dialog()!.querySelector('.sheet__label')).toBeNull();
    press(buttonNamed('Add to order'));
    const rows = pendingRows();
    expect(rows).toHaveLength(before + 1);
    const added = rows[rows.length - 1]!;
    expect(added.dataset.lineId).toMatch(new RegExp(`^${id}-\\d+$`));
    expect(added.querySelector('.order-line__amount')!.textContent).toBe(formatAmount(price));
  });

  it('every one of the fourteen items adds its own line', () => {
    for (const item of MENU_ITEMS) {
      render('default');
      press(rail(MENU_CATEGORIES.find((c) => c.id === item.category)!.name));
      const before = pendingRows().length;
      press(tiles().find((t) => t.dataset.item === item.id)!);
      press(buttonNamed('Add to order'));
      const rows = pendingRows();
      expect(rows).toHaveLength(before + 1);
      expect(rows[rows.length - 1]!.dataset.lineId).toMatch(new RegExp(`^${item.id}-\\d+$`));
    }
  });
});

describe('criterion 7: what applies to a tile applies in every category', () => {
  it('eightysix: Steak is off on Mains, and stays off after Drinks and back', () => {
    render('eightysix');
    const steak = () => tiles().find((t) => t.dataset.item === 'steak')!;
    expect(steak().classList.contains('menu-tile--off')).toBe(true);
    press(rail('Drinks'));
    expect(tiles().some((t) => t.dataset.item === 'steak')).toBe(false);
    press(rail('Mains'));
    expect(steak().classList.contains('menu-tile--off')).toBe(true);
    expect(steak().tagName).toBe('BUTTON');
    expect(steak().getAttribute('aria-disabled')).toBe('true');
  });

  it('fireblocked-overflow 86s Coffee, which is on Drinks', () => {
    render('fireblocked-overflow');
    press(rail('Drinks'));
    expect(tiles().filter((t) => t.classList.contains('menu-tile--off')).map((t) => t.dataset.item)).toEqual(['coffee']);
  });

  it.each(['lock-draft', 'lock-lease'] as const)('%s: no rail and no grid', (state) => {
    render(state);
    expect(host.querySelector('.menu-categories')).toBeNull();
    expect(host.querySelector('.menu-grid')).toBeNull();
  });

  // Every state, every category: exactly the category's items, and off tiles
  // are exactly the origin's 86'd items that the category holds.
  const FREE = ORDER_STATES.map((s) => s.id).filter((s) => !s.startsWith('sheet-') && !s.startsWith('approval') && s !== 'sheet-item');
  it.each(FREE)('%s: every category shows its items, and only the origin’s 86’d tiles are off', (state) => {
    render(state);
    const facts = originFacts({ state });
    if (facts.lock) {
      expect(host.querySelector('.menu-grid')).toBeNull();
      return;
    }
    for (const c of MENU_CATEGORIES) {
      press(rail(c.name));
      if (state === 'loading') {
        expect(host.querySelector('.menu-grid')).toBeNull();
        expect(host.querySelector('.menu-category--selected')!.textContent).toBe(c.name);
        continue;
      }
      expect(gridIds()).toEqual(EXPECTED[c.id]);
      const off = tiles().filter((t) => t.classList.contains('menu-tile--off')).map((t) => t.dataset.item);
      expect(off).toEqual(EXPECTED[c.id].filter((id) => facts.menu.eightySixed?.includes(id)));
    }
  });

  it('every item-sheet state, from every origin, draws the origin’s 86 behind the selected category', () => {
    for (const origin of Object.keys(ITEM_SHEET_ORIGINS) as OrderState[]) {
      render({ state: 'sheet-item-water', from: origin });
      const facts = originFacts({ state: 'sheet-item-water', from: origin });
      if (facts.lock) {
        expect(host.querySelector('.menu-grid')).toBeNull();
        continue;
      }
      const off = tiles().filter((t) => t.classList.contains('menu-tile--off')).map((t) => t.dataset.item);
      expect(off).toEqual(EXPECTED.mains.filter((id) => facts.menu.eightySixed?.includes(id)));
    }
  });
});
