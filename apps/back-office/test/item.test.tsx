// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { refusal, mount, text } from './session-harness.js';
import {
  APPLE, BURGER, DRINKS, ITEM_ARCHIVE, ITEM_10, ITEM_2, MAINS, MENU_ITEMS, PIE, SEASONAL, STEW,
  aria, categoryRow, catalog, harness, itemRow, item as makeItem, openMenuHeld, pageStatus, rail, rowText,
} from './menu-support.js';
import {
  ITEM_CREATE, ITEM_UPDATE, READ, body, categoryErrorText, categorySelect, choose, compare, context, editFrom, facts,
  hint, itemAnswer, named, nameErrorText, nameInput, newIn, notice, noticeText, openMenuWith, optionLabels, press,
  priceErrorText, priceInput, q, readState, save, statusLine, submit, tap, title,
} from './item-support.js';
import { typeInto } from './tables-support.js';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-04, the item's own fields (PHASE1-S4c2a): the route and the rail, the subject that never
// reaches the address, the read and the version it builds on, the three fields, create and edit,
// the way back to BO-03, and BO-03's two new controls. The refusals, the unknown outcomes and the
// version rules are in item-versions.test.tsx; the departure decision, M-6, BO-01 and the one
// command across both screens are in item-departure.test.tsx.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const open = async (...reads: Parameters<typeof openMenuWith>[1][]) => {
  h = harness();
  view = await openMenuWith(h, ...reads);
  return view.host;
};
const FRIES = makeItem(8, MAINS.categoryId, 'Fries', 5, { basePrice: '12500' });
const focused = () => document.activeElement;
const typePrice = (host: HTMLElement, value: string) => typeInto(priceInput(host), value);
const typeName = (host: HTMLElement, value: string) => typeInto(nameInput(host), value);

describe('AC 1. the route and the rail', () => {
  it('BO-04 is at /back-office/menu/item with Menu current in the rail and no new entry', async () => {
    const host = await open();
    expect(named(rail(host), 'Menu').getAttribute('aria-current')).toBe('page');
    await editFrom(h, host, 'Burger');
    expect(window.location.pathname).toBe('/back-office/menu/item');
    expect(title(host)).toBe('Burger');
    expect(text(rail(host))).toBe('ConfigurationMenuTablesSettings');
    expect(named(rail(host), 'Menu').getAttribute('aria-current')).toBe('page');
    expect(named(rail(host), 'Tables').hasAttribute('aria-current')).toBe(false);
    expect(named(rail(host), 'Settings').hasAttribute('aria-current')).toBe(false);
    expect(host.querySelectorAll('.bonav a')).toHaveLength(3);
  });
});

describe('AC 2. the subject never reaches the address', () => {
  it('Edit and New item leave the address at the screen’s path with no query and no hash', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/back-office/menu/item');
    tap(named(host, 'Cancel'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
    await newIn(h, host, 'Mains');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/back-office/menu/item');
  });

  it('arriving with no subject shows the different-manager sentence, focuses Return to menu and reads nothing', async () => {
    h = harness('/back-office/menu/item');
    view = await openMenuWith(h);
    const host = view.host;
    expect(title(host)).toBe('Item editor');
    expect(text(q(host, '#item-context'))).toBe('Choose an item on Menu to edit it.');
    expect(document.activeElement).toBe(named(host, 'Return to menu'));
    expect(q(host, '#item-form')).toBeNull();
    expect(h.count(READ)).toBe(0);
    expect(named(rail(host), 'Menu').getAttribute('aria-current')).toBe('page');
    // Return to menu goes to BO-03 by the router, with no decision.
    tap(named(host, 'Return to menu'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(host.querySelector('h1')!.textContent).toBe('Menu');
    expect(document.querySelector('dialog[open]')).toBeNull();
  });

  it('browser Forward to the editor after leaving it shows the no-subject sentence and reads nothing', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    tap(named(host, 'Cancel'));
    await h.settle();
    const reads = h.count(READ);
    act(() => {
      window.history.pushState(null, '', '/back-office/menu/item');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await h.settle();
    expect(text(q(host, '#item-context'))).toBe('Choose an item on Menu to edit it.');
    expect(h.count(READ)).toBe(reads);
  });
});

describe('AC 3. the read and the version it builds on', () => {
  it('reads once, shows the name, the category and the grouped base price, and builds on its own version, not Menu’s', async () => {
    const host = await open();
    expect(h.count(READ)).toBe(1);
    h.reply(READ, catalog(8));
    await editFrom(h, host, 'Burger');
    expect(h.count(READ)).toBe(2);
    expect(nameInput(host).value).toBe('Burger');
    expect(categorySelect(host).value).toBe(MAINS.categoryId);
    expect(priceInput(host).value).toBe('99.999.999');
    expect(facts(host)).toBe('Menu version 8 · Availability and archive status are managed on Menu.');
    h.reply(ITEM_UPDATE, itemAnswer(9, { ...BURGER, name: 'Burger X' }));
    typeName(host, 'Burger X');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(body(h, ITEM_UPDATE).expectedVersion).toBe(8);
  });

  it('shows Loading item… with no money facts while the read is out, and opens on Item name when it lands', async () => {
    const host = await open();
    const held = h.hold(READ);
    tap(named(host, 'Edit Burger'));
    await h.settle();
    expect(title(host)).toBe('Item editor');
    expect(text(readState(host))).toBe('Loading item…');
    expect(q(host, '#item-form')).toBeNull();
    expect(host.textContent).not.toContain('Currency');
    held.deliver(catalog(5));
    await h.settle();
    expect(q(host, '#item-form')).not.toBeNull();
    expect(host.textContent).toContain('Currency');
    expect(focused()).toBe(nameInput(host));
  });

  it('a failed read shows its state with Try again, which repeats the read only', async () => {
    const host = await open();
    h.reply(READ, failure);
    await editFrom(h, host, 'Burger');
    expect(text(readState(host))).toBe('Item could not be loadedTry again to read this item.Try again');
    expect(q(host, '#item-form')).toBeNull();
    expect(host.textContent).not.toContain('Currency');
    expect(facts(host)).toBeNull();
    const reads = h.count(READ);
    h.reply(READ, catalog(5));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(h.count(READ)).toBe(reads + 1);
    expect(nameInput(host).value).toBe('Burger');
    expect(h.count(ITEM_UPDATE) + h.count(ITEM_CREATE)).toBe(0);
  });

  it('an item the read does not hold shows Item could not be found with Return to menu', async () => {
    const host = await open();
    h.reply(READ, catalog(5, [MAINS, SEASONAL, DRINKS], [ITEM_10]));
    await editFrom(h, host, 'Burger');
    expect(text(readState(host))).toBe('Item could not be foundReturn to Menu and choose the item again.Return to menu');
    expect(q(host, '#item-form')).toBeNull();
    tap(named(host, 'Return to menu'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
  });
});

describe('AC 4. the item name', () => {
  it('an empty name is refused with its copy, aria-invalid and focus, and nothing is sent', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    typeName(host, '   ');
    tap(named(host, 'Save'));
    await h.settle();
    expect(nameErrorText(host)).toBe('Enter an item name.');
    expect(nameInput(host).getAttribute('aria-invalid')).toBe('true');
    expect(nameInput(host).getAttribute('aria-describedby')).toBe('item-name-error item-name-help');
    expect(focused()).toBe(nameInput(host));
    expect(h.count(ITEM_UPDATE)).toBe(0);
    // Save is held until the field is corrected, with its reason; editing clears the refusal.
    expect(aria(save(host))).toBe(true);
    expect(hint(host)).toBe('Correct the marked fields before saving.');
    typeName(host, 'Burger');
    expect(nameErrorText(host)).toBeNull();
    expect(aria(save(host))).toBe(false);
  });

  it('the refusals come in order: too long, then a control character', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    typeName(host, 'x'.repeat(65));
    tap(named(host, 'Save'));
    expect(nameErrorText(host)).toBe('Use 64 characters or fewer.');
    typeName(host, 'Beef\u0007burger');
    tap(named(host, 'Save'));
    expect(nameErrorText(host)).toBe('Remove control characters from the item name.');
    expect(h.count(ITEM_UPDATE)).toBe(0);
  });

  it('accepts 64 emoji, refuses 65, and sends the trimmed name', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    typeName(host, '🍔'.repeat(65));
    tap(named(host, 'Save'));
    expect(nameErrorText(host)).toBe('Use 64 characters or fewer.');
    expect(h.count(ITEM_UPDATE)).toBe(0);
    typeName(host, `  ${'🍔'.repeat(64)}  `);
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...BURGER, name: '🍔'.repeat(64) }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(((body(h, ITEM_UPDATE).changes as { fields: { name: string } }).fields.name)).toBe('🍔'.repeat(64));
  });

  it('several refusals at once all show, and focus goes to the first in reading order', async () => {
    const host = await open();
    await newIn(h, host, 'Mains');
    choose(categorySelect(host), '');
    tap(named(host, 'Save'));
    expect(nameErrorText(host)).toBe('Enter an item name.');
    expect(categoryErrorText(host)).toBe('Choose a category.');
    expect(priceErrorText(host)).toBe('Enter a base price.');
    expect(focused()).toBe(nameInput(host));
    expect(h.count(ITEM_CREATE)).toBe(0);
  });
});

describe('AC 5. the price input', () => {
  it('a refused value stays exactly as typed, with its copy', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    typePrice(host, '1000.5');
    tap(named(host, 'Save'));
    expect(priceErrorText(host)).toBe('Enter whole rupiah, such as 10.000.');
    expect(priceInput(host).value).toBe('1000.5');
    expect(focused()).toBe(priceInput(host));
    expect(h.count(ITEM_UPDATE)).toBe(0);
    typePrice(host, '-5');
    tap(named(host, 'Save'));
    expect(priceErrorText(host)).toBe('Use 0 or more.');
    typePrice(host, '100.000.000');
    tap(named(host, 'Save'));
    expect(priceErrorText(host)).toBe('Use 99.999.999 or less.');
    expect(priceInput(host).value).toBe('100.000.000');
    typePrice(host, '');
    tap(named(host, 'Save'));
    expect(priceErrorText(host)).toBe('Enter a base price.');
  });

  it('10000 typed stays as typed while typing, is shown 10.000 after blur, and is sent as "10000"', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    priceInput(host).focus();
    typePrice(host, '10000');
    expect(priceInput(host).value).toBe('10000');
    act(() => priceInput(host).blur());
    expect(priceInput(host).value).toBe('10.000');
    // A refused value is not regrouped on blur.
    priceInput(host).focus();
    typePrice(host, '1000.5');
    act(() => priceInput(host).blur());
    expect(priceInput(host).value).toBe('1000.5');
    typePrice(host, '10000');
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...BURGER, basePrice: '10000' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect((body(h, ITEM_UPDATE).changes as { fields: { basePrice: string } }).fields.basePrice).toBe('10000');
  });

  it('the form’s Frost field takes only whole rupiah: leading zeros and groups are accepted', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    typePrice(host, '00010');
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...BURGER, basePrice: '10' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect((body(h, ITEM_UPDATE).changes as { fields: { basePrice: string } }).fields.basePrice).toBe('10');
  });
});

describe('AC 6. the category field', () => {
  it('lists the active categories in Menu’s order after Choose a category, and no archived one that is not in play', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    expect(optionLabels(categorySelect(host))).toEqual(['Choose a category', 'Mains', 'Drinks']);
    expect(text(q(host, '#item-category-help'))).toBe(
      'Choose an active category. An existing item may stay in its archived category.'
    );
  });

  it('an item in an archived category may stay in it: the option reads Archived and Save is accepted', async () => {
    const host = await open();
    await editFrom(h, host, 'Pie');
    expect(optionLabels(categorySelect(host))).toEqual(['Choose a category', 'Mains', 'Drinks', 'Seasonal · Archived']);
    expect(categorySelect(host).value).toBe(SEASONAL.categoryId);
    typeName(host, 'Pie special');
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...PIE, name: 'Pie special' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(categoryErrorText(host)).toBeNull();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(body(h, ITEM_UPDATE).changes).toEqual({ fields: { name: 'Pie special' } });
  });

  it('another archived category is listed disabled and refused locally with its copy', async () => {
    const host = await open();
    // The category was archived after Menu was read, which BO-04’s own read shows.
    h.reply(READ, catalog(6, [{ ...MAINS, isActive: false }, SEASONAL, DRINKS]));
    await newIn(h, host, 'Mains');
    expect(optionLabels(categorySelect(host))).toEqual(['Choose a category', 'Drinks', 'Mains · Archived [disabled]']);
    typeName(host, 'Fries');
    typePrice(host, '12.500');
    tap(named(host, 'Save'));
    expect(categoryErrorText(host)).toBe('This category is archived. Choose another category.');
    expect(focused()).toBe(categorySelect(host));
    expect(h.count(ITEM_CREATE)).toBe(0);
    choose(categorySelect(host), DRINKS.categoryId);
    expect(categoryErrorText(host)).toBeNull();
  });

  it('moving an item to another category sends only that field', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    choose(categorySelect(host), DRINKS.categoryId);
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...BURGER, categoryId: DRINKS.categoryId }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(body(h, ITEM_UPDATE).changes).toEqual({ fields: { categoryId: DRINKS.categoryId } });
  });
});

describe('AC 7. create', () => {
  it('New item opens BO-04 with the category chosen and blank fields, and nothing implies a saved item', async () => {
    const host = await open();
    await newIn(h, host, 'Drinks');
    expect(title(host)).toBe('New item');
    expect(statusLine(host)).toBe('Not saved yet');
    expect(facts(host)).toBe('Not saved yet. Nothing is created until you save.');
    expect(context(host)).toBe(
      'Save the item, its variants and its modifiers together. Existing orders keep their saved names and prices.'
    );
    expect(categorySelect(host).value).toBe(DRINKS.categoryId);
    expect(nameInput(host).value).toBe('');
    expect(priceInput(host).value).toBe('');
    expect(focused()).toBe(nameInput(host));
    expect(h.count(READ)).toBe(2);
  });

  it('Save sends exactly one create with empty option lists and no version, then returns to Menu on the new row', async () => {
    const host = await open();
    await newIn(h, host, 'Mains');
    typeName(host, '  Fries  ');
    typePrice(host, '12.500');
    h.reply(ITEM_CREATE, itemAnswer(6, FRIES));
    h.reply(READ, catalog(6, [MAINS, SEASONAL, DRINKS], [...MENU_ITEMS, FRIES]));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_CREATE)).toBe(1);
    expect(body(h, ITEM_CREATE)).toEqual({
      categoryId: MAINS.categoryId,
      name: 'Fries',
      basePrice: '12500',
      variants: [],
      modifiers: [],
    });
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(text(pageStatus(host))).toBe('Fries saved.');
    const row = itemRow(host, FRIES.itemId);
    expect(rowText(row)).toContain('12.500');
    expect(row.getAttribute('data-selected')).toBe('true');
    expect(document.activeElement).toBe(named(host, 'Edit Fries'));
  });
});

describe('AC 8. edit', () => {
  it('sends one update whose changes.fields holds only the changed fields, then returns to the updated row with Edit focused', async () => {
    const host = await open();
    await editFrom(h, host, 'Item 2');
    typeName(host, 'Item two');
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...ITEM_2, name: 'Item two' }));
    h.reply(READ, catalog(6, [MAINS, SEASONAL, DRINKS], MENU_ITEMS.map((i) => (i.itemId === ITEM_2.itemId ? { ...i, name: 'Item two' } : i))));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(body(h, ITEM_UPDATE)).toEqual({
      itemId: ITEM_2.itemId,
      expectedVersion: 5,
      changes: { fields: { name: 'Item two' } },
    });
    expect(text(pageStatus(host))).toBe('Item two saved.');
    expect(document.activeElement).toBe(named(host, 'Edit Item two'));
    expect(window.location.pathname).toBe('/back-office/menu');
  });

  it('a clean Save still sends, as changes {}, and an answer at the version it carried is announced as unchanged', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    h.reply(ITEM_UPDATE, itemAnswer(5, BURGER));
    tap(named(host, 'Save'));
    await h.settle();
    expect(body(h, ITEM_UPDATE)).toEqual({ itemId: BURGER.itemId, expectedVersion: 5, changes: {} });
    expect(text(pageStatus(host))).toBe('Nothing changed. Menu version 5 is still current.');
    expect(document.activeElement).toBe(named(host, 'Edit Burger'));
  });

  it('never sends a variants or modifiers key, so the options stay as they are', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    typeName(host, 'Burger two');
    typePrice(host, '1000');
    choose(categorySelect(host), DRINKS.categoryId);
    h.reply(ITEM_UPDATE, itemAnswer(6, BURGER));
    tap(named(host, 'Save'));
    await h.settle();
    expect(Object.keys(body(h, ITEM_UPDATE).changes as object).sort()).toEqual(['fields']);
  });

  it('a second press of Save while one is pending sends nothing', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    typeName(host, 'Burger two');
    h.reply(ITEM_UPDATE, itemAnswer(6, BURGER));
    const held = h.hold(ITEM_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    submit(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(text(notice(host))).toBe('Saving…Wait for the result. Your draft is kept.');
    expect(document.activeElement).toBe(notice(host));
    expect(nameInput(host).disabled).toBe(true);
    held.deliver(itemAnswer(6, BURGER));
    await h.settle();
  });
});

describe('AC 17. the status and the facts', () => {
  const statusOf = async (itemName: string, items = MENU_ITEMS) => {
    const host = await open();
    h.reply(READ, catalog(5, [MAINS, SEASONAL, DRINKS], items));
    await editFrom(h, host, itemName);
    return host;
  };

  it('an ordinary item: Available, with the ordinary context', async () => {
    const host = await statusOf('Burger');
    expect(statusLine(host)).toBe('Available');
    expect(context(host)).toBe(
      'Save the item, its variants and its modifiers together. Existing orders keep their saved names and prices.'
    );
  });

  it('an 86’d item: 86 · Unavailable, with the 86 sentence', async () => {
    const host = await statusOf('Soda');
    expect(statusLine(host)).toBe('86 · Unavailable');
    expect(context(host)).toBe(
      '86 · Unavailable. Saving does not make it available. Availability and archive actions are on Menu. Existing orders keep their saved names and prices.'
    );
  });

  it('an archived item: Archived item · Available, with the archived sentence', async () => {
    const host = await statusOf('Apple');
    expect(statusLine(host)).toBe('Archived item · Available');
    expect(context(host)).toBe(
      'Archived item. Saving does not restore it. Availability and archive actions are on Menu. Existing orders keep their saved names and prices.'
    );
  });

  it('an archived and 86’d item in an archived category shows every fact, and the archived-item sentence', async () => {
    const host = await statusOf(
      'Stew',
      MENU_ITEMS.map((i) => (i.itemId === STEW.itemId ? { ...i, isAvailable: false } : i))
    );
    expect(statusLine(host)).toBe('Archived item · 86 · Unavailable · Hidden from the POS · category archived');
    expect(context(host)).toContain('Archived item. Saving does not restore it.');
  });

  it('an active item in an archived category says so, and the category sentence wins', async () => {
    const host = await statusOf('Pie');
    expect(statusLine(host)).toBe('Available · Hidden from the POS · category archived');
    expect(context(host)).toBe(
      'Its category is archived, so it stays hidden from the POS. Category actions are on Menu. Existing orders keep their saved names and prices.'
    );
  });

  it('shows the money facts as plain text, and the version fact for an edit', async () => {
    const host = await statusOf('Burger');
    expect(text(q(host, '.item-money'))).toBe('CurrencyIDR · Indonesian rupiahDecimal places0 · amounts are whole rupiah');
    expect(host.textContent).toContain('Fixed for this installation. Prices include tax.');
    expect(facts(host)).toBe('Menu version 5 · Availability and archive status are managed on Menu.');
    // Cancel, and (S4c2b) the controls of the two lists; never a state command.
    expect(
      [...host.querySelectorAll('#item-form button:not([type="submit"])')].map((b) => b.getAttribute('aria-label') ?? b.textContent)
    ).toEqual([
      'Add variant', 'Move up variant 1', 'Move down variant 1', 'Remove variant 1',
      'Add modifier', 'Move up modifier 1', 'Move down modifier 1', 'Remove modifier 1',
      'Cancel',
    ]);
    expect(host.textContent).not.toMatch(/Archive item|Restore item|Make available/);
  });
});

describe('AC 18. BO-03’s two new controls', () => {
  it('Edit goes in front of Archive/Restore on every item, and New item after Reorder items on active categories only', async () => {
    const host = await open();
    const controls = (row: Element) => [...row.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(controls(categoryRow(host, MAINS.categoryId))).toEqual([
      'Rename category Mains',
      'Archive category Mains',
      'Reorder items in Mains',
      'New item in Mains',
    ]);
    expect(controls(categoryRow(host, SEASONAL.categoryId))).toEqual(['Rename category Seasonal', 'Restore category Seasonal']);
    expect(controls(itemRow(host, BURGER.itemId))).toEqual(['Edit Burger', 'Archive item Burger']);
    expect(controls(itemRow(host, APPLE.itemId))).toEqual(['Edit Apple', 'Restore item Apple']);
    expect(controls(itemRow(host, STEW.itemId))).toEqual(['Edit Stew', 'Restore item Stew']);
    // Each is a button that names no record in an address, never a link.
    expect([...host.querySelectorAll('[data-edit], [data-new-item]')].map((el) => el.tagName)).toEqual(
      Array(host.querySelectorAll('[data-edit], [data-new-item]').length).fill('BUTTON')
    );
    expect(host.querySelectorAll('a[href*="item"]')).toHaveLength(0);
  });

  it('both are inert while a command is pending, and a press sends nothing and opens nothing', async () => {
    const host = await open();
    const held = h.hold(ITEM_ARCHIVE);
    tap(named(host, 'Archive item Item 10'));
    await h.settle();
    expect(aria(named(host, 'Edit Burger'))).toBe(true);
    expect(aria(named(host, 'New item in Mains'))).toBe(true);
    const reads = h.count(READ);
    tap(named(host, 'Edit Burger'));
    tap(named(host, 'New item in Mains'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(h.count(READ)).toBe(reads);
    held.deliver(itemAnswer(6, { ...ITEM_10, isActive: false }));
    await h.settle();
    expect(aria(named(host, 'Edit Burger'))).toBe(false);
  });

  it('both are inert while the first read is loading', async () => {
    h = harness();
    const opened = await openMenuHeld(h);
    view = opened.view;
    expect(view.host.querySelector('[data-edit]')).toBeNull();
    opened.held.deliver(catalog(5));
    await h.settle();
    expect(aria(named(view.host, 'Edit Burger'))).toBe(false);
  });

  it('after an item is archived, the row’s Edit takes focus (DESIGN-019)', async () => {
    const host = await open();
    h.reply(ITEM_ARCHIVE, itemAnswer(6, { ...BURGER, isActive: false }));
    tap(named(host, 'Archive item Burger'));
    await h.settle();
    expect(document.activeElement).toBe(named(host, 'Edit Burger'));
  });

});

describe('AC 10. Cancel returns to the opener', () => {
  it('a clean Cancel from an edit focuses the item’s Edit, and marks the row', async () => {
    const host = await open();
    await editFrom(h, host, 'Item 10');
    tap(named(host, 'Cancel'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(document.activeElement).toBe(named(host, 'Edit Item 10'));
    expect(itemRow(host, ITEM_10.itemId).getAttribute('data-selected')).toBe('true');
    expect(document.querySelector('dialog[open]')).toBeNull();
  });

  it('a clean Cancel from a new item focuses that category’s New item', async () => {
    const host = await open();
    await newIn(h, host, 'Drinks');
    tap(named(host, 'Cancel'));
    await h.settle();
    expect(document.activeElement).toBe(named(host, 'New item in Drinks'));
  });

  it('a dirty Cancel opens the decision; Stay keeps the draft, Discard returns as a clean Cancel does', async () => {
    const host = await open();
    await editFrom(h, host, 'Item 10');
    typeName(host, 'Ten');
    tap(named(host, 'Cancel'));
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')!;
    expect(text(dialog.querySelector('#departure-copy'))).toBe(
      'Your edits have not been saved. Stay to keep editing, or discard them before leaving.'
    );
    tap(named(dialog, 'Stay'));
    expect(window.location.pathname).toBe('/back-office/menu/item');
    expect(nameInput(host).value).toBe('Ten');
    expect(document.activeElement).toBe(nameInput(host));
    tap(named(host, 'Cancel'));
    tap(named(document.querySelector<HTMLDialogElement>('dialog[open]')!, 'Discard'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(document.activeElement).toBe(named(host, 'Edit Item 10'));
    expect(h.count(ITEM_UPDATE)).toBe(0);
  });
});
