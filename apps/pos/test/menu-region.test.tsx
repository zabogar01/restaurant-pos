// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CATALOG_NOTICE,
  itemDestination,
  LOADING_LABEL,
  LOCK_NOTICE,
  MENU_CATEGORIES,
  MENU_ITEMS,
  itemsIn,
} from '../src/menuFixtures.js';
import { formatAmount } from '../src/money.js';
import { OrderScreen } from '../src/OrderPanel.js';
import { FIRE_INCIDENT, LOCK_TAG, ORDER_STATES, type OrderState } from '../src/orderFixtures.js';

// POS-03's menu region (F2b), rendered as the whole order screen so the panel
// beside it is checked in the same states. Three rulings are the point:
// under a settlement lock the menu is replaced by a notice that carries the
// only route out (without it the locked panel strands the cashier); an 86'd
// tile is disabled in place (C-3); and an 86'd tile takes no pressed ring.

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

const press = (el: Element) => act(() => (el as HTMLElement).click());
const sheetTitle = () => host.querySelector('[role="dialog"] h2')?.textContent ?? null;

const device = () => host.querySelector('.pos-device')!;
const menu = () => host.querySelector('.order-screen__menu')!;
const tiles = () => [...host.querySelectorAll<HTMLElement>('.menu-grid > .menu-tile')];
const categories = () => [...host.querySelectorAll<HTMLElement>('.menu-categories > .menu-category')];
const ids = (els: HTMLElement[]) => els.map((e) => e.dataset.item);
// FE-023: the grid shows the selected category's items, and a fresh load selects Mains.
const MAINS = itemsIn('mains');
const select = (id: (typeof MENU_CATEGORIES)[number]['id']) => press(categories().find((c) => c.textContent === MENU_CATEGORIES.find((k) => k.id === id)!.name)!);
const text = (els: Element[]) => els.map((e) => e.textContent);

const LOCK_STATES = ['lock-draft', 'lock-lease'] as const;
const GRID_STATES = ORDER_STATES.map((s) => s.id).filter(
  (s): s is Exclude<OrderState, 'lock-draft' | 'lock-lease' | 'loading'> => !['lock-draft', 'lock-lease', 'loading'].includes(s)
);

describe('default', () => {
  beforeEach(() => render('default'));

  it('draws the category rail with Mains selected', () => {
    expect(text(categories())).toEqual(['Mains', 'Sides', 'Drinks', 'Desserts']);
    const selected = categories().filter((c) => c.getAttribute('aria-current') === 'true');
    expect(text(selected)).toEqual(['Mains']);
    expect(selected[0]!.classList.contains('menu-category--selected')).toBe(true);
    expect(host.querySelectorAll('.menu-category--selected')).toHaveLength(1);
  });

  it('draws Mains’ items as tiles on a fresh load, in the table’s order', () => {
    expect(ids(tiles())).toEqual(MAINS.map((i) => i.id));
  });

  it('draws every item as a tile in its own category, each a button that opens the item sheet', () => {
    for (const item of MENU_ITEMS) {
      render('default');
      select(item.category);
      const tile = tiles().find((t) => t.dataset.item === item.id)!;
      expect(tile.dataset.item).toBe(item.id);
      expect(tile.tagName).toBe('BUTTON');
      expect(tile.getAttribute('type')).toBe('button');
      press(tile);
      expect(window.location.search).toBe(itemDestination(item.id));
      expect(sheetTitle()).toBe(item.name);
    }
  });

  // Pressed from `overflow` as well as `default`: on the table order the old
  // defect is invisible, because ?state=default is where it was going anyway.
  it.each(['default', 'overflow'] as const)(
    '%s: draws every category as a button that keeps the order, and writes no category to the URL',
    (state) => {
      for (const [i, category] of MENU_CATEGORIES.entries()) {
        render(state);
        const names = [...host.querySelectorAll('.order-line__name')].map((n) => n.textContent);
        const row = categories()[i]!;
        expect(row.tagName).toBe('BUTTON');
        expect(row.getAttribute('type')).toBe('button');
        press(row);
        // The order is where it was: the press no longer names ?state=default,
        // which moved every other order to the table order.
        expect(window.location.search).toBe(`?state=${state}`);
        expect([...host.querySelectorAll('.order-line__name')].map((n) => n.textContent)).toEqual(names);
        expect(sheetTitle()).toBeNull();
        // And it writes no ?category=: the selection lives beside the order
        // store, and the rail and the grid both follow it (FE-023).
        expect(window.location.search).not.toContain('category');
        expect(text(categories().filter((c) => c.getAttribute('aria-current') === 'true'))).toEqual([category.name]);
        expect(host.querySelectorAll('.menu-category--selected')).toHaveLength(1);
        expect(ids(tiles())).toEqual(itemsIn(category.id).map((i) => i.id));
      }
    }
  );

  it('prices each tile from its bigint as a grouped figure', () => {
    for (const c of MENU_CATEGORIES) {
      select(c.id);
      expect(text([...host.querySelectorAll('.menu-tile__price')])).toEqual(itemsIn(c.id).map((i) => formatAmount(i.price)));
    }
    select('mains');
    expect(host.querySelector('[data-item="steak"] .menu-tile__price')!.textContent).toBe('240.000');
    for (const item of MENU_ITEMS) expect(typeof item.price).toBe('bigint');
  });

  it('shows no notice, no skeleton and nothing unavailable', () => {
    expect(host.querySelector('.notice')).toBeNull();
    expect(host.querySelector('.menu-loading')).toBeNull();
    expect(host.querySelector('.menu-tile--off')).toBeNull();
  });

  it('puts the region beside the order panel, not inside it', () => {
    const body = host.querySelector('.order-screen__body')!;
    expect([...body.children].map((c) => c.className)).toEqual(['order-screen__menu', 'order-panel']);
    expect(menu().getAttribute('aria-hidden')).toBeNull();
  });
});

describe('eightysix: disabled in place (ruling C-3)', () => {
  beforeEach(() => render('eightysix'));

  it('keeps every tile, in exactly the default order and slot', () => {
    expect(ids(tiles())).toEqual(MAINS.map((i) => i.id));
    expect(tiles().findIndex((t) => t.dataset.item === 'steak')).toBe(2);
  });

  it('greys Steak and tags it 86, with its name and price still readable', () => {
    const steak = host.querySelector<HTMLElement>('[data-item="steak"]')!;
    expect(steak.classList.contains('menu-tile--off')).toBe(true);
    expect(steak.querySelector('.tag-86')!.textContent).toBe('86');
    expect(steak.textContent).toContain('Steak');
    expect(steak.querySelector('.menu-tile__price')!.textContent).toBe('240.000');
    expect(steak.getAttribute('aria-disabled')).toBe('true');
  });

  it('makes Steak an inert button (FE-024): aria-disabled, reachable by Tab, no link, nothing interactive inside', () => {
    const steak = host.querySelector<HTMLElement>('[data-item="steak"]')!;
    expect(steak.tagName).toBe('BUTTON');
    expect(steak.getAttribute('aria-disabled')).toBe('true');
    expect(steak.hasAttribute('disabled')).toBe(false);
    expect(steak.tabIndex).not.toBe(-1);
    expect(steak.closest('a')).toBeNull();
    expect(steak.querySelector('a, button, [tabindex], [href]')).toBeNull();
    expect(steak.hasAttribute('href')).toBe(false);
    expect(steak.hasAttribute('role')).toBe(false);
    expect(steak.getAttribute('aria-describedby')).toBe(steak.querySelector('.tag-86')!.id);
  });

  it('leaves every other tile a working button', () => {
    const others = tiles().filter((t) => t.dataset.item !== 'steak');
    expect(others).toHaveLength(MAINS.length - 1);
    for (const t of others) expect(t.matches('button.menu-tile[type="button"]:not(.menu-tile--off)')).toBe(true);
    for (const id of others.map((t) => t.dataset.item)) {
      render('eightysix');
      press(host.querySelector(`[data-item="${id}"]`)!);
      expect(window.location.search).toBe(itemDestination(id!, 'eightysix'));
    }
  });
});

describe.each(GRID_STATES)('%s: the grid never reflows', (state) => {
  it('draws every item in the default order, and an unavailable tile is never a link', () => {
    render(state);
    for (const c of MENU_CATEGORIES) {
      select(c.id);
      expect(ids(tiles())).toEqual(itemsIn(c.id).map((i) => i.id));
      expect(host.querySelectorAll('a.menu-tile--off, .menu-tile--off a, .menu-tile--off button')).toHaveLength(0);
      for (const off of host.querySelectorAll('.menu-tile--off')) expect(off.getAttribute('aria-disabled')).toBe('true');
    }
  });
});

describe('pressed', () => {
  it('holds the selected category, one other category and one tile — the A7 ring, statically', () => {
    render('pressed');
    expect(text(categories().filter((c) => c.classList.contains('is-pressed')))).toEqual(['Mains', 'Sides']);
    // A fixture whose point is a pressed tile shows it on load (FE-023 round 2),
    // so the held tile is a Main. It is still drawn only under its own category.
    const held = tiles().filter((t) => t.classList.contains('is-pressed'));
    expect(ids(held)).toEqual(['burger']);
    expect(held[0]!.tagName).toBe('BUTTON');
    select('sides');
    expect(tiles().filter((t) => t.classList.contains('is-pressed'))).toEqual([]);
  });

  it('is not drawn on the menu in any other state', () => {
    for (const { id } of ORDER_STATES.filter((s) => s.id !== 'pressed')) {
      render(id);
      expect(menu().querySelectorAll('.is-pressed')).toHaveLength(0);
    }
  });

  it('is never drawn on an 86’d tile', () => {
    for (const { id } of ORDER_STATES) {
      render(id);
      expect(host.querySelectorAll('.menu-tile--off.is-pressed')).toHaveLength(0);
    }
  });
});

describe('loading', () => {
  beforeEach(() => render('loading'));

  it('replaces the grid with the skeleton', () => {
    expect(host.querySelector('.menu-grid')).toBeNull();
    expect(tiles()).toEqual([]);
    expect(host.querySelector('.menu-loading__label')!.textContent).toBe(LOADING_LABEL);
    // Renamed out of .menu-loading__bar in F2h: the order panel draws the same
    // bars in the same widths while the menu loads, so the class is shared.
    expect(host.querySelectorAll('.menu-area .skel-bar')).toHaveLength(3);
  });

  it('keeps the category rail, as the artifact does', () => {
    expect(text(categories())).toEqual(['Mains', 'Sides', 'Drinks', 'Desserts']);
  });
});

describe('catalog', () => {
  beforeEach(() => render('catalog'));

  it('puts the menu-changed notice above the full grid', () => {
    const area = host.querySelector('.menu-area')!;
    expect([...area.children].map((c) => c.classList[1] ?? c.className)).toEqual(['menu-notice', 'menu-grid']);
    expect(area.querySelector('.notice__title')!.textContent).toBe(CATALOG_NOTICE.title);
    expect(area.querySelector('.notice')!.textContent).toContain(CATALOG_NOTICE.body);
    expect(ids(tiles())).toEqual(MAINS.map((i) => i.id));
  });

  it('carries no action: nothing was added, and the grid is the way on', () => {
    expect(host.querySelectorAll('.notice a')).toHaveLength(0);
  });
});

describe.each(LOCK_STATES)('%s: the route out (acceptance criterion 1)', (state) => {
  const lock = state === 'lock-draft' ? 'draft' : 'lease';
  const notice = LOCK_NOTICE[lock];
  beforeEach(() => render(state));

  it('removes the rail and the grid: absent, not inert', () => {
    expect(host.querySelector('.menu-categories')).toBeNull();
    expect(host.querySelector('.menu-grid')).toBeNull();
    expect(host.querySelectorAll('.menu-tile, .menu-category')).toHaveLength(0);
  });

  it('shows the lock notice in the menu region', () => {
    const shown = menu().querySelectorAll('.notice');
    expect(shown).toHaveLength(1);
    expect(shown[0]!.querySelector('.notice__title')!.textContent).toBe(notice.title);
    expect(shown[0]!.textContent).toContain(notice.body);
    expect(shown[0]!.classList.contains('notice--soft')).toBe(lock === 'draft');
  });

  it('says removing an unsent line is blocked too, and that reading is still fine (FR-G13)', () => {
    expect(notice.body).toMatch(/removing a line you have not sent yet/);
    expect(notice.body).toMatch(/(still read the order|Reading it is still fine)\.$/);
  });

  it('carries exactly one action, a link that goes somewhere', () => {
    const actions = [...menu().querySelectorAll('a')];
    expect(actions).toHaveLength(1);
    expect(actions[0]!.textContent).toBe(notice.action.label);
    expect(actions[0]!.getAttribute('href')).toBe(notice.action.href);
    expect(actions[0]!.matches('a.action.action--compact')).toBe(true);
  });

  it('whole screen: the panel stays inert and readable, and the notice’s action is the only way out', () => {
    // F2a's half, still correct beside this one.
    expect(host.querySelectorAll('.order-line')).toHaveLength(3);
    expect(host.querySelector('.order-lines')!.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
    expect(text([...host.querySelectorAll('.round-head__tag')])).toEqual([LOCK_TAG[lock], LOCK_TAG[lock], LOCK_TAG[lock]]);
    expect(host.querySelectorAll('.order-actions a')).toHaveLength(0);
    // Every control on the 1280×800 frame is the route out.
    expect(text([...device().querySelectorAll('a, button:not([aria-disabled="true"])')])).toEqual([notice.action.label]);
  });
});

// FE-009, acceptance criterion 2 (ruling of 2026-09-17): everything on the
// frame that acts on the order is a <button type="button">. An anchor is for
// leaving the screen, and the only one is a lock notice's route out.
describe.each(ORDER_STATES.map((s) => s.id))('%s: acting controls are buttons, and an anchor only leaves', (state) => {
  it('every anchor on the frame leaves POS-03, and every button is type="button"', () => {
    render(state);
    const anchors = [...device().querySelectorAll('a')];
    const lock = state === 'lock-draft' ? 'draft' : state === 'lock-lease' ? 'lease' : undefined;
    // F2h adds the second and last anchor this screen has: the emergency
    // banner's route to POS-07 in fireerror. Both of them genuinely leave the
    // screen for one that SITEMAP gives its own route, which is the whole test
    // — an anchor is for going, a button is for acting (ruling of 2026-09-17).
    // FE-022: fire-failed and fire-unknown draw the same banner, with the same route.
    const leaving = lock
      ? [LOCK_NOTICE[lock].action.label]
      : ['fireerror', 'fire-failed', 'fire-unknown', 'fire-heading-width'].includes(state)
        ? [FIRE_INCIDENT.action.label]
        : [];
    expect(anchors.map((a) => a.textContent)).toEqual(leaving);
    for (const a of anchors) expect(a.matches('.menu-notice a.action[href], a.emergency-banner__action[href]')).toBe(true);
    for (const b of device().querySelectorAll('button')) expect(b.getAttribute('type')).toBe('button');
  });

  it('every tile, category, row body, remove control and close-bar action drawn live is a button', () => {
    render(state);
    const acting = device().querySelectorAll(
      '.menu-tile:not(.menu-tile--off), .menu-category, .order-line:not(.order-line--voided) > .order-line__target, .order-line__remove, .order-actions > :not(.action--off)'
    );
    for (const el of acting) {
      // Under a lock a row body is drawn inert as a div (I-12); everything else here acts.
      if (lock(state) && el.matches('.order-line__target')) expect(el.tagName).toBe('DIV');
      else expect(el.tagName).toBe('BUTTON');
    }
  });
});

const lock = (state: OrderState) => state === 'lock-draft' || state === 'lock-lease';

it('the two lock notices never share a string (C-5), nor with the panel tags', () => {
  const strings = (l: 'draft' | 'lease') => [LOCK_NOTICE[l].title, LOCK_NOTICE[l].body, LOCK_NOTICE[l].action.label, LOCK_NOTICE[l].action.href];
  for (const s of strings('draft')) expect(strings('lease')).not.toContain(s);
  expect(LOCK_NOTICE.draft.title).not.toBe(LOCK_TAG.draft);
  expect(LOCK_NOTICE.lease.title).not.toBe(LOCK_TAG.lease);
});

// The ring is a stylesheet fact, so it is checked in the stylesheet: every
// rule that draws the pressed ring on a tile or a category row must qualify it
// with the control's element — a <button> since FE-009, an anchor before it.
// An 86'd tile is aria-disabled (FE-024), so it can then match neither :active nor .is-pressed
// — nothing happened, so nothing says it did.

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/pos.css'), 'utf8');

/** Selectors of top-level or nested rules whose declarations contain `needle`. */
function selectorsDeclaring(stylesheet: string, needle: string): string[] {
  const code = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  for (const m of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[2]!.includes(needle)) out.push(...m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')));
  }
  return out;
}

/** Menu selectors that could ring something that is not a control. */
function unqualifiedMenuRings(stylesheet: string): string[] {
  return selectorsDeclaring(stylesheet, '--frost-pressed-ring').filter(
    (s) => /menu-(tile|category)/.test(s) && !/^(a|button)\.menu-(tile|category)\b/.test(s)
  );
}

describe('the ring detector can see a ring an 86’d tile could match', () => {
  it('flags an unqualified pressed rule', () => {
    expect(unqualifiedMenuRings('.menu-tile.is-pressed { box-shadow: var(--frost-pressed-ring); }')).toEqual([
      '.menu-tile.is-pressed',
    ]);
    expect(unqualifiedMenuRings('a.x, .menu-tile:active { box-shadow: var(--frost-pressed-ring); }')).toEqual([
      '.menu-tile:active',
    ]);
  });

  it('accepts an anchor- or button-qualified rule, and ignores rules without the ring', () => {
    expect(unqualifiedMenuRings('a.menu-tile:active { box-shadow: var(--frost-pressed-ring); }')).toEqual([]);
    expect(unqualifiedMenuRings('button.menu-tile:active { box-shadow: var(--frost-pressed-ring); }')).toEqual([]);
    expect(unqualifiedMenuRings('div.menu-tile:active { box-shadow: var(--frost-pressed-ring); }')).toEqual([
      'div.menu-tile:active',
    ]);
    expect(unqualifiedMenuRings('.menu-tile { color: var(--frost-text); }')).toEqual([]);
  });
});

describe('pos.css: the menu pressed ring', () => {
  it('rings a tile and a category row', () => {
    const ringed = selectorsDeclaring(css, '--frost-pressed-ring');
    for (const s of [
      'button.menu-tile:not([aria-disabled="true"]):active',
      'button.menu-tile:not([aria-disabled="true"]).is-pressed',
      'button.menu-category:active',
      'button.menu-category.is-pressed',
    ]) {
      expect(ringed).toContain(s);
    }
  });

  it('qualifies every menu ring with the control’s element, so an 86’d tile can never take one', () => {
    expect(unqualifiedMenuRings(css)).toEqual([]);
  });

  it('never names an 86’d tile in a pressed or hover rule', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const preludes = [...code.matchAll(/([^{}]+)\{/g)].map((m) => m[1]!);
    expect(preludes.filter((p) => /menu-tile--off/.test(p) && /:active|is-pressed|:hover/.test(p))).toEqual([]);
  });
});
