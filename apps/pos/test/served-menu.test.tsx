// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTION_REASON,
  AVAILABILITY_STATUS,
  EMPTY_CATALOG,
  EMPTY_CATEGORY,
  LOADING_LABEL,
  NO_MENU_ORDER,
  READ_FAILURE,
  STALE_STATUS,
} from '../src/catalog/menuCopy.js';
import { CatalogProvider } from '../src/catalog/useCatalog.js';
import { POLL_MS } from '../src/catalog/catalogStore.js';
import { MENU_ITEMS } from '../src/menuFixtures.js';
import { useOrderStore, type LiveOrderStore } from '../src/orderStore.js';
import type { OrderView } from '../src/orderFixtures.js';
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
  type ServedItem,
} from './served-harness.js';

// POS-03's menu region over a served catalog (S7b1). The screen is the very one the fixture tests draw;
// the catalog store is the real one with its two reads stubbed. Layout is not measurable in jsdom: the
// pixel claims (the reserved band, the long name) are the browser spec's, and what is asserted here is
// structure, names and focus.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let h: CatalogHarness;
let screen: ReturnType<typeof mountServed> | undefined;

afterEach(() => {
  screen?.unmount();
  screen = undefined;
  window.history.replaceState(null, '', '/pos/order');
});

async function open(first = menuOf(1, MEALS, [NASI, SATE, TEA]), view?: OrderView) {
  h = makeCatalogHarness(first);
  screen = mountServed(h, view);
  await h.settle();
  return screen.host;
}

/** A change the poll brings: the revision moves and the menu read answers the new body. */
async function change(body: ReturnType<typeof menuOf>) {
  h.revision(ok({ version: body.version }));
  h.menu(ok(body));
  await h.advance(POLL_MS);
}

const host = () => screen!.host;
const q = (selector: string) => host().querySelector<HTMLElement>(selector);
const tiles = () => [...host().querySelectorAll<HTMLElement>('.menu-grid > .menu-tile')];
const rail = () => [...host().querySelectorAll<HTMLElement>('.menu-categories > .menu-category')];
const tile = (id: string) => q(`.menu-tile[data-item="${id}"]`)!;
const press = (el: Element) => act(() => (el as HTMLElement).click());
const band = () => q('.menu-status');
const text = (els: Element[]) => els.map((e) => e.textContent);
const names = (els: HTMLElement[]) => els.map((e) => e.getAttribute('aria-label'));

describe('1. tiles, order, categories and prices come from the store', () => {
  it('draws the served categories in server order, and the first one selected', async () => {
    await open();
    expect(text(rail())).toEqual(['Meals', 'Drinks']);
    expect(rail().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(rail().map((c) => c.getAttribute('aria-current'))).toEqual(['true', null]);
  });

  it('draws the selected category’s items in server order, each named with its price', async () => {
    await open();
    expect(tiles().map((t) => t.dataset.item)).toEqual(['nasi', 'sate']);
    expect(names(tiles())).toEqual(['Nasi Goreng, 45.000', 'Sate Ayam, 38.000']);
    expect(tile('nasi').querySelector('.menu-tile__price')!.textContent).toBe('45.000');
    press(rail()[1]!);
    expect(tiles().map((t) => t.dataset.item)).toEqual(['tea']);
  });

  it('draws none of the fixture menu', async () => {
    await open();
    for (const fixture of MENU_ITEMS) expect(q(`.menu-tile[data-item="${fixture.id}"]`)).toBeNull();
    // (The order beside it is the stand-in's and still names a Burger line.)
    expect(q('.order-screen__menu')!.textContent).not.toContain('Burger');
  });

  it('a press on an available served tile opens nothing in this slice', async () => {
    await open();
    const before = window.location.href;
    press(tile('nasi'));
    expect(window.location.href).toBe(before);
    expect(q('[role="dialog"]')).toBeNull();
  });
});

describe('11. an 86 holds the slot exactly, and its restoration re-enables the same element', () => {
  it('keeps order, slot and price; greys, tags, and cannot be selected', async () => {
    await open();
    const nasi = tile('nasi');
    const order = tiles().map((t) => t.dataset.item);
    await change(menuOf(2, MEALS, [{ ...NASI, available: false }, SATE, TEA]));
    expect(tile('nasi')).toBe(nasi);
    expect(tiles().map((t) => t.dataset.item)).toEqual(order);
    expect(nasi.classList.contains('menu-tile--off')).toBe(true);
    expect(nasi.getAttribute('aria-disabled')).toBe('true');
    expect(nasi.hasAttribute('disabled')).toBe(false);
    expect(nasi.getAttribute('aria-label')).toBe('Nasi Goreng, 45.000, unavailable, 86');
    expect(nasi.querySelector('.menu-tile__price')!.textContent).toBe('45.000');
    const tag = nasi.querySelector('.tag-86')!;
    expect(tag.textContent).toBe('86');
    expect(nasi.getAttribute('aria-describedby')).toBe(tag.id);
    const before = window.location.href;
    press(nasi);
    expect(window.location.href).toBe(before);
  });

  it('restoration re-enables the same element', async () => {
    await open();
    const nasi = tile('nasi');
    await change(menuOf(2, MEALS, [{ ...NASI, available: false }, SATE, TEA]));
    await change(menuOf(3, MEALS, [NASI, SATE, TEA]));
    expect(tile('nasi')).toBe(nasi);
    expect(nasi.classList.contains('menu-tile--off')).toBe(false);
    expect(nasi.hasAttribute('aria-disabled')).toBe(false);
    expect(nasi.querySelector('.tag-86')).toBeNull();
    expect(nasi.getAttribute('aria-label')).toBe('Nasi Goreng, 45.000');
  });

  it('a price change updates on the tile with no notice or badge', async () => {
    await open();
    await change(menuOf(2, MEALS, [{ ...NASI, price: '50000' }, SATE, TEA]));
    expect(tile('nasi').querySelector('.menu-tile__price')!.textContent).toBe('50.000');
    expect(band()!.textContent).toBe('');
  });
});

describe('12. archived items leave at the next refresh; the selection follows its id', () => {
  it('an archived item is absent, with no placeholder', async () => {
    await open();
    await change(menuOf(2, MEALS, [SATE, TEA]));
    expect(tiles().map((t) => t.dataset.item)).toEqual(['sate']);
    expect(host().textContent).not.toContain('archived');
  });

  it('the selection follows the category id when the categories reorder', async () => {
    await open();
    press(rail()[1]!);
    await change(menuOf(2, [MEALS[1]!, MEALS[0]!], [NASI, SATE, TEA]));
    expect(text(rail())).toEqual(['Drinks', 'Meals']);
    expect(rail().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(tiles().map((t) => t.dataset.item)).toEqual(['tea']);
  });

  it('a category that vanishes drops the selection to the first, with no notice', async () => {
    await open();
    press(rail()[1]!);
    await change(menuOf(2, [MEALS[0]!], [NASI, SATE]));
    expect(rail().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true']);
    expect(tiles().map((t) => t.dataset.item)).toEqual(['nasi', 'sate']);
    expect(q('.notice')).toBeNull();
    // And it stays there if the old category comes back.
    await change(menuOf(3, MEALS, [NASI, SATE, TEA]));
    expect(rail().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  it('an active category with no items stays selectable, with its message', async () => {
    await open();
    await change(menuOf(2, MEALS, [NASI, SATE]));
    press(rail()[1]!);
    expect(rail()).toHaveLength(2);
    expect(tiles()).toHaveLength(0);
    expect(q('.menu-grid')!.textContent).toBe(EMPTY_CATEGORY);
  });

  it('a fresh mount starts on the first category', async () => {
    await open();
    press(rail()[1]!);
    screen!.unmount();
    screen = mountServed(h, { state: 'default' }, 1);
    await h.settle();
    expect(rail().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });
});

describe('7 and 8. loading, the first read failing, and an empty catalog', () => {
  it('loading is the first read only: the label, no rail, and the order panel stays', async () => {
    h = makeCatalogHarness(menuOf(1, MEALS, [NASI]));
    const wait = h.hold<ReturnType<typeof menuOf>>();
    h.menu({ held: wait.held });
    screen = mountServed(h);
    await h.settle();
    expect(q('.menu-loading__label')!.textContent).toBe(LOADING_LABEL);
    expect(q('.menu-categories')).toBeNull();
    expect(q('.order-panel')).not.toBeNull();
    wait.deliver(ok(menuOf(1, MEALS, [NASI])));
    await h.settle();
    expect(q('.menu-loading')).toBeNull();
  });

  it.each([
    ['unavailable', UNAVAILABLE, READ_FAILURE.unavailable],
    ['anything else', FAILED, READ_FAILURE.failed],
  ])('one failed first read: %s names its variant, with Try again', async (_n, reply, copy) => {
    h = makeCatalogHarness(null);
    h.menu(reply);
    screen = mountServed(h);
    await h.settle();
    const notice = q('.menu-area .notice')!;
    expect(notice.getAttribute('role')).toBe('alert');
    expect(notice.querySelector('.notice__title')!.textContent).toBe(copy.title);
    expect(notice.textContent).toContain(copy.body);
    expect(q('[data-action="served-retry"]')!.textContent).toBe('Try again');
    expect(q('.menu-categories')).toBeNull();
  });

  it('background retries keep the failure on screen; a good read leaves it with no press', async () => {
    h = makeCatalogHarness(null);
    screen = mountServed(h);
    await h.settle();
    const notice = q('.menu-area .notice');
    await h.advance(POLL_MS * 3);
    expect(q('.menu-loading')).toBeNull();
    expect(q('.menu-area .notice')).toBe(notice);
    h.menu(ok(menuOf(2, MEALS, [NASI])));
    await h.advance(POLL_MS);
    expect(q('[data-action="served-retry"]')).toBeNull();
    expect(rail()).toHaveLength(2);
  });

  it('Try again shows loading and repeats only the read', async () => {
    h = makeCatalogHarness(null);
    screen = mountServed(h);
    await h.settle();
    const wait = h.hold<ReturnType<typeof menuOf>>();
    h.menu({ held: wait.held });
    press(q('[data-action="served-retry"]')!);
    expect(q('.menu-loading')).not.toBeNull();
    wait.deliver(ok(menuOf(1, MEALS, [NASI])));
    await h.settle();
    expect(rail()).toHaveLength(2);
    expect(h.count('revision')).toBe(0);
  });

  it('an empty catalog is a message, no fixture, no retry and no link, and the order panel remains', async () => {
    await open(menuOf(1, [], []));
    expect(q('#menu-empty-catalog')!.textContent).toContain(EMPTY_CATALOG.title);
    expect(q('#menu-empty-catalog')!.textContent).toContain(EMPTY_CATALOG.body);
    expect(q('.menu-area button')).toBeNull();
    expect(q('.menu-area a')).toBeNull();
    expect(q('.menu-categories')).toBeNull();
    expect(tiles()).toHaveLength(0);
    expect(q('.order-panel')).not.toBeNull();
  });
});

describe('8. the order panel with no menu: empty order words, and the four stay in place, inert', () => {
  const four = () => ['discount', 'void-order', 'fire', 'settle'].map((a) => q(`.order-actions [data-action="${a}"]`)!);

  it('an empty order beside an empty catalog says no menu is held, and why the four are inert', async () => {
    await open(menuOf(1, [], []), { state: 'empty' });
    expect(q('.order-empty')!.textContent).toContain(NO_MENU_ORDER.title);
    expect(q('.order-empty')!.textContent).toContain(NO_MENU_ORDER.body);
    const reason = q('#served-action-reason')!;
    expect(reason.textContent).toBe(ACTION_REASON.noMenu);
    for (const button of four()) {
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.hasAttribute('disabled')).toBe(false);
      expect(button.getAttribute('aria-describedby')).toBe('served-action-reason');
    }
  });

  it('an empty order beside a held menu says to add an item first', async () => {
    await open(menuOf(1, MEALS, [NASI]), { state: 'empty' });
    expect(q('#served-action-reason')!.textContent).toBe(ACTION_REASON.menuHeld);
    expect(q('.order-empty')!.textContent).not.toContain(NO_MENU_ORDER.body);
  });

  it('an empty order while the first read is loading uses the no-menu words', async () => {
    h = makeCatalogHarness(null);
    h.menu('hang');
    screen = mountServed(h, { state: 'empty' });
    await h.settle();
    expect(q('#served-action-reason')!.textContent).toBe(ACTION_REASON.noMenu);
  });

  it('a counter never has Send, and the other three stay', async () => {
    await open(menuOf(1, [], []), { state: 'quick-new' });
    expect(q('.order-actions [data-action="fire"]')).toBeNull();
    expect(q('.order-actions [data-action="settle"]')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('an existing order keeps its actions when the read is empty, loading or failed', async () => {
    await open(menuOf(1, [], []), { state: 'default' });
    expect(q('#served-action-reason')).toBeNull();
    expect(q('.order-actions [data-action="settle"]')!.getAttribute('aria-disabled')).toBeNull();
    expect(q('.order-actions [data-action="discount"]')!.getAttribute('aria-disabled')).toBeNull();
  });
});

describe('6. a stale menu stays usable', () => {
  it('two failed checks show the notice in the band; tiles stay enabled; a good check clears it', async () => {
    await open();
    h.revision(FAILED);
    await h.advance(POLL_MS);
    expect(band()!.textContent).toBe('');
    await h.advance(POLL_MS);
    expect(band()!.textContent).toBe(STALE_STATUS);
    expect(band()!.getAttribute('role')).toBe('status');
    expect(tile('nasi').hasAttribute('aria-disabled')).toBe(false);
    h.revision(ok({ version: 1 }));
    await h.advance(POLL_MS);
    expect(band()!.textContent).toBe('');
  });
});

describe('13. the status band', () => {
  it('is in the tree, as a polite status, before it has any text, and is the grid’s sibling', async () => {
    await open();
    const b = band()!;
    expect(b).not.toBeNull();
    expect(b.getAttribute('role')).toBe('status');
    expect(b.getAttribute('aria-live')).toBe('polite');
    expect(b.textContent).toBe('');
    expect(b.parentElement).toBe(q('.menu-area'));
    expect(q('.menu-grid')!.contains(b)).toBe(false);
  });

  it('is there in every served state, empty catalog, loading and failure included', async () => {
    await open(menuOf(1, [], []));
    expect(band()).not.toBeNull();
    screen!.unmount();
    h = makeCatalogHarness(null);
    screen = mountServed(h);
    await h.settle();
    expect(band()).not.toBeNull();
  });

  it('one announcement for one accepted change, kept across unchanged polls', async () => {
    await open();
    const node = band()!;
    await change(menuOf(2, MEALS, [{ ...NASI, available: false }, { ...SATE, available: false }, TEA]));
    expect(band()).toBe(node);
    expect(node.textContent).toBe(AVAILABILITY_STATUS);
    expect(node.children).toHaveLength(1);
    await h.advance(POLL_MS * 5);
    expect(node.textContent).toBe(AVAILABILITY_STATUS);
  });

  it('no change means no announcement: a price change and an archive are silent', async () => {
    await open();
    await change(menuOf(2, MEALS, [{ ...NASI, price: '1' }, SATE, TEA]));
    await change(menuOf(3, MEALS, [SATE, TEA]));
    expect(band()!.textContent).toBe('');
  });

  it('the out-of-date warning takes the band, and the availability words do not come back after it', async () => {
    await open();
    await change(menuOf(2, MEALS, [{ ...NASI, available: false }, SATE, TEA]));
    h.revision(FAILED);
    await h.advance(POLL_MS * 2);
    expect(band()!.textContent).toBe(STALE_STATUS);
    h.revision(ok({ version: 2 }));
    await h.advance(POLL_MS);
    expect(band()!.textContent).toBe('');
  });

  it('leaving POS-03 clears it', async () => {
    await open();
    await change(menuOf(2, MEALS, [{ ...NASI, available: false }, SATE, TEA]));
    screen!.unmount();
    screen = mountServed(h, { state: 'default' }, 1);
    await h.settle();
    expect(band()!.textContent).toBe('');
  });
});

describe('14. R1: the name is clamped, the price is its own line, the accessible name is whole', () => {
  const LONG = 'W'.repeat(64);
  it('a 64-character name is the whole accessible name and is not cut in the markup', async () => {
    await open(menuOf(1, MEALS, [{ id: 'long', category: 'meals', name: LONG, price: '99999999' }]));
    expect(tile('long').getAttribute('aria-label')).toBe(`${LONG}, 99.999.999`);
    expect(tile('long').querySelector('.menu-tile__name')!.textContent).toBe(LONG);
    expect(tile('long').querySelector('.menu-tile__price')!.textContent).toBe('99.999.999');
  });

  it('the stylesheet clamps the name after two lines and keeps the price on one line', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/pos.css'), 'utf8');
    const name = /\.menu-tile__name\s*\{([^}]*)\}/.exec(css)![1]!;
    expect(name).toMatch(/-webkit-line-clamp:\s*2/);
    expect(name).toMatch(/overflow:\s*hidden/);
    expect(/\.menu-tile__price\s*\{([^}]*)\}/.exec(css)![1]).toMatch(/white-space:\s*nowrap/);
  });
});

describe('15. focus', () => {
  it('a failure moves focus to Try again when focus is on the document', async () => {
    h = makeCatalogHarness(null);
    screen = mountServed(h);
    await h.settle();
    expect(document.activeElement).toBe(q('[data-action="served-retry"]'));
  });

  it('a failure leaves focus where the cashier is working', async () => {
    h = makeCatalogHarness(null);
    const wait = h.hold<ReturnType<typeof menuOf>>();
    h.menu({ held: wait.held });
    screen = mountServed(h, { state: 'default' });
    await h.settle();
    const row = q('.order-line__target') as HTMLElement;
    row.focus();
    wait.deliver(FAILED);
    await h.settle();
    expect(q('[data-action="served-retry"]')).not.toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('a read that succeeds while Try again holds focus moves focus to the first category', async () => {
    h = makeCatalogHarness(null);
    screen = mountServed(h);
    await h.settle();
    expect(document.activeElement).toBe(q('[data-action="served-retry"]'));
    h.menu(ok(menuOf(1, MEALS, [NASI])));
    await h.advance(POLL_MS);
    expect(document.activeElement).toBe(rail()[0]);
  });

  it('Try again, then a good read, puts focus on the first category', async () => {
    h = makeCatalogHarness(null);
    screen = mountServed(h);
    await h.settle();
    const retry = q('[data-action="served-retry"]')!;
    retry.focus();
    h.menu(ok(menuOf(1, MEALS, [NASI])));
    press(retry);
    await h.settle();
    expect(document.activeElement).toBe(rail()[0]);
  });

  it('a read that succeeds with no categories puts focus on the empty-catalog message', async () => {
    h = makeCatalogHarness(null);
    screen = mountServed(h);
    await h.settle();
    h.menu(ok(menuOf(1, [], [])));
    await h.advance(POLL_MS);
    expect(document.activeElement).toBe(q('#menu-empty-catalog'));
  });

  it('a poll that changes a price, a name or availability keeps focus on the tile', async () => {
    await open();
    const nasi = tile('nasi');
    nasi.focus();
    await change(menuOf(2, MEALS, [{ ...NASI, name: 'Nasi Goreng Special', price: '50000', available: false }, SATE, TEA]));
    expect(tile('nasi')).toBe(nasi);
    expect(document.activeElement).toBe(nasi);
  });

  it('a removed focused tile sends focus to its selected category', async () => {
    await open();
    press(rail()[1]!);
    const tea = tile('tea');
    tea.focus();
    await change(menuOf(2, MEALS, [NASI, SATE]));
    expect(document.activeElement).toBe(rail()[1]);
    expect(rail()[1]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('a removed focused tile whose category also vanished sends focus to the first category', async () => {
    await open();
    press(rail()[1]!);
    tile('tea').focus();
    await change(menuOf(2, [MEALS[0]!], [NASI, SATE]));
    expect(document.activeElement).toBe(rail()[0]);
  });

  it('a cashier working in the order panel keeps focus through a poll that changes the menu', async () => {
    await open(menuOf(1, MEALS, [NASI, SATE, TEA]), { state: 'default' });
    const row = q('.order-line__target') as HTMLElement;
    row.focus();
    await change(menuOf(2, MEALS, [SATE, TEA]));
    expect(document.activeElement).toBe(row);
  });
});

describe('round 2, F1: a completed retry does not steal focus from work in progress', () => {
  it('Try again, then focus moves to an order line while the read is held: the line keeps it', async () => {
    h = makeCatalogHarness(null);
    screen = mountServed(h, { state: 'default' });
    await h.settle();
    const retry = q('[data-action="served-retry"]')!;
    retry.focus();
    const wait = h.hold<ReturnType<typeof menuOf>>();
    h.menu({ held: wait.held });
    press(retry);
    await h.settle();
    const row = q('.order-line__target') as HTMLElement;
    row.focus();
    wait.deliver(ok(menuOf(1, MEALS, [NASI])));
    await h.settle();
    expect(rail()).toHaveLength(2);
    expect(document.activeElement).toBe(row);
  });

  it('and with focus still lost when the read lands, it goes to the first category', async () => {
    h = makeCatalogHarness(null);
    screen = mountServed(h);
    await h.settle();
    const retry = q('[data-action="served-retry"]')!;
    retry.focus();
    const wait = h.hold<ReturnType<typeof menuOf>>();
    h.menu({ held: wait.held });
    press(retry);
    await h.settle();
    expect(document.activeElement).toBe(document.body);
    wait.deliver(ok(menuOf(1, MEALS, [NASI])));
    await h.settle();
    expect(document.activeElement).toBe(rail()[0]);
  });
});

describe('16. ?state= in a served build keeps its job for the order, and chooses nothing about the menu', () => {
  it.each(['eightysix', 'fireblocked', 'fireblocked-overflow', 'sheet-item86'] as const)(
    '%s: the order is drawn as it was and the served catalog decides availability',
    async (state) => {
      await open(menuOf(1, MEALS, [NASI, SATE, TEA]), { state });
      expect(host().querySelectorAll('.menu-tile--off')).toHaveLength(0);
      expect(q('.order-panel')).not.toBeNull();
      expect(q('#fire-refusal')).toBeNull();
    }
  );

  it.each(['loading', 'catalog', 'error', 'pressed'] as const)('%s: no effect on the menu', async (state) => {
    await open(menuOf(1, MEALS, [NASI, SATE, TEA]), { state });
    expect(q('.menu-loading')).toBeNull();
    expect(q('.menu-area .notice')).toBeNull();
    expect(q('.order-screen__menu')!.querySelectorAll('.is-pressed')).toHaveLength(0);
    expect(tiles().map((t) => t.dataset.item)).toEqual(['nasi', 'sate']);
  });

  it.each(['sheet-item', 'sheet-item-burger', 'sheet-item-steak'] as const)('%s opens no sheet', async (state) => {
    await open(menuOf(1, MEALS, [NASI, SATE, TEA]), { state });
    expect(q('[role="dialog"]')).toBeNull();
  });

  it('draws no list of fixture states beyond the one the test run is in', async () => {
    await open();
    // Under test `__FIXTURE_SESSION__` is undefined, so the list is on; a build's bundle test proves it off.
    expect(q('nav[data-fixture-list="pos-03-order-states"]')).not.toBeNull();
  });
});

describe('17. fire and close read availability at the press, from the catalog store', () => {
  const fire = () => q('.order-actions [data-action="fire"]')!;

  it('a pending line whose served item is 86’d blocks the fire with the existing refusal, and restoring clears it', async () => {
    // The default table order holds a pending line for item id `steak`.
    const STEAK: ServedItem = { id: 'steak', category: 'meals', name: 'Steak', price: '240000' };
    await open(menuOf(1, MEALS, [STEAK, TEA]), { state: 'default' });
    expect(q('#fire-refusal')).toBeNull();
    await change(menuOf(2, MEALS, [{ ...STEAK, available: false }, TEA]));
    expect(q('#fire-refusal')).not.toBeNull();
    expect(fire().getAttribute('aria-disabled')).toBe('true');
    const rounds = host().querySelectorAll('[data-round]').length;
    press(fire());
    expect(host().querySelectorAll('[data-round]').length).toBe(rounds);
    await change(menuOf(3, MEALS, [STEAK, TEA]));
    expect(q('#fire-refusal')).toBeNull();
    press(fire());
    expect(host().querySelectorAll('[data-round]').length).toBe(rounds + 1);
  });

  it('a fixture line itemId steak beside a served 86’d item named Steak does not block', async () => {
    const SERVED_STEAK: ServedItem = { id: '7a2c0e1e-served-steak', category: 'meals', name: 'Steak', price: '240000', available: false };
    await open(menuOf(1, MEALS, [SERVED_STEAK, TEA]), { state: 'default' });
    expect(host().textContent).toContain('Steak');
    expect(q('#fire-refusal')).toBeNull();
    expect(host().querySelectorAll('.order-lines .tag-86')).toHaveLength(0);
    const rounds = host().querySelectorAll('[data-round]').length;
    press(fire());
    expect(host().querySelectorAll('[data-round]').length).toBe(rounds + 1);
  });

  it('a close reads the list at the press: 86’d now refuses, restored now closes', async () => {
    // The counter order holds a pending line for item id `burger`, and a counter's close sends it.
    const STEAK: ServedItem = { id: 'burger', category: 'meals', name: 'Burger', price: '30000' };
    h = makeCatalogHarness(menuOf(1, MEALS, [STEAK, TEA]));
    let store!: LiveOrderStore;
    function Probe() {
      const s = useOrderStore({ state: 'quick' }, false);
      useEffect(() => {
        store = s;
      });
      return null;
    }
    const probeHost = document.createElement('div');
    document.body.append(probeHost);
    const root = createRoot(probeHost);
    const stop = h.store.start();
    act(() =>
      root.render(
        <CatalogProvider store={h.store}>
          <Probe />
        </CatalogProvider>
      )
    );
    await h.settle();
    const drafts = () => [{ id: 'd1', label: 'Cash', amount: store.order.totals.total }];
    await change(menuOf(2, MEALS, [{ ...STEAK, available: false }, TEA]));
    let closed = true;
    act(() => {
      closed = store.close!('19:30', drafts());
    });
    expect(closed).toBe(false);
    await change(menuOf(3, MEALS, [STEAK, TEA]));
    act(() => {
      closed = store.close!('19:31', drafts());
    });
    expect(closed).toBe(true);
    stop();
    act(() => root.unmount());
    probeHost.remove();
  });
});

describe('the unavailable list is the server’s, in the order panel’s tags too', () => {
  it('tags a served 86’d item’s pending line', async () => {
    const STEAK: ServedItem = { id: 'steak', category: 'meals', name: 'Steak', price: '240000', available: false };
    await open(menuOf(1, MEALS, [STEAK, TEA]), { state: 'default' });
    expect(host().querySelectorAll('.order-lines .tag-86').length).toBeGreaterThan(0);
  });

  it('the poll’s unavailable states are the store’s, in the NASI order with no fixture mixed in', async () => {
    await open(menuOf(1, MEALS, [{ ...NASI, available: false }, SATE, TEA]));
    expect(tiles().filter((t) => t.classList.contains('menu-tile--off')).map((t) => t.dataset.item)).toEqual(['nasi']);
  });
});
