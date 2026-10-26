// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { LIST_PARTIAL, READ_FAILED } from '../src/menu/copy.js';
import { refusal, mount, text } from './session-harness.js';
import {
  APPLE, BURGER, CATEGORY_ARCHIVE, CATEGORY_CREATE, CATEGORY_REORDER, CATEGORY_RESTORE, CATEGORY_UPDATE,
  DRINKS, ITEM_10, ITEM_2, ITEM_ARCHIVE, ITEM_REORDER, ITEM_RESTORE, MAINS, MENU_ITEMS, PIE, READ, SEASONAL, SODA, STEW,
  aria, bodyOf, cat, categories, category, catalog, categoryRow, comparison, count, draftNames, formNotice, harness,
  headings, itemAnswer, itemNames, itemRow, itemsAnswer, nameError, nameField, named, openMenu, pageStatus, panel,
  openMenuHeld, panelName, rail, rowText, tap,
} from './menu-support.js';
import { typeInto } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-03 Menu (PHASE1-S4c1): the rail and the route, the grouped list, prices, the read states,
// the category name, the four commands of a category and an item, and the two reorders. The
// version rules, the refusals and the unknown outcomes are in menu-versions.test.tsx; the
// departure decision, M-6 and BO-01 are in menu-departure.test.tsx.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const open = async (first?: Parameters<typeof openMenu>[1], path?: string) => {
  h = harness(path);
  view = await openMenu(h, first);
  return view.host;
};
const focusedName = () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? null;

describe('AC 1. the rail and the route', () => {
  it('lists Menu, Tables and Settings in that order under Configuration, Menu current on BO-03', async () => {
    const host = await open();
    expect(text(rail(host))).toBe('ConfigurationMenuTablesSettings');
    expect([...rail(host).querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/back-office/menu',
      '/back-office/tables',
      '/back-office/settings',
    ]);
    expect(named(rail(host), 'Menu').getAttribute('aria-current')).toBe('page');
    expect(named(rail(host), 'Tables').hasAttribute('aria-current')).toBe(false);
    expect(host.querySelector('h1')!.textContent).toBe('Menu');
    expect(window.location.pathname).toBe('/back-office/menu');
  });

  it('a press on Menu from the landing opens BO-03 and reads the catalog once', async () => {
    const host = await open(undefined, '/back-office/');
    expect(host.querySelector('h1')).toBeNull();
    tap(named(rail(host), 'Menu'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(host.querySelector('h1')!.textContent).toBe('Menu');
    expect(h.count(READ)).toBe(1);
  });
});

describe('AC 2. grouping, order and counts', () => {
  it('draws the active categories first, then the archived one, each with its items in order', async () => {
    const host = await open();
    expect(headings(host)).toEqual(['Mains', 'Drinks', 'Seasonal · Archived category']);
    // Burger (0), then `Item 2` and `Item 10` tied on 1 in natural order, then the archived Apple.
    expect(itemNames(host, MAINS.categoryId)).toEqual(['Burger', 'Item 2', 'Item 10', 'Apple']);
    expect(itemNames(host, DRINKS.categoryId)).toEqual(['Soda']);
    expect(itemNames(host, SEASONAL.categoryId)).toEqual(['Pie', 'Stew']);
  });

  it('counts every category and item, and only the active options of an item', async () => {
    const host = await open();
    expect(text(count(host))).toBe('3 categories · 7 items');
    expect(rowText(itemRow(host, BURGER.itemId))).toContain('1 variants · 1 modifiers');
    expect(rowText(itemRow(host, ITEM_2.itemId))).toContain('0 variants · 0 modifiers');
  });

  it('names the hidden reason, the category first when both are archived, and shows availability as text', async () => {
    const host = await open();
    expect(rowText(itemRow(host, PIE.itemId))).toContain('Hidden from the POS · category archived');
    expect(rowText(itemRow(host, STEW.itemId))).toContain('Hidden from the POS · category archived');
    expect(rowText(itemRow(host, STEW.itemId))).not.toContain('item archived');
    expect(rowText(itemRow(host, APPLE.itemId))).toContain('Hidden from the POS · item archived');
    expect(rowText(itemRow(host, APPLE.itemId))).toContain('Archived item');
    expect(rowText(itemRow(host, BURGER.itemId))).not.toContain('Hidden from the POS');
    expect(rowText(itemRow(host, BURGER.itemId))).toContain('Available');
    expect(rowText(itemRow(host, SODA.itemId))).toContain('86 · Unavailable');
  });

  it('draws the table’s caption and headers, and the category notes', async () => {
    const host = await open();
    expect(text(host.querySelector('caption'))).toBe('Active categories first · Archived items stay in their category');
    expect([...host.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
      'Item',
      'Base price · IDR',
      'Availability',
      'Actions',
    ]);
    expect(text(categoryRow(host, MAINS.categoryId))).toContain('Archiving this category hides its items from the POS without changing them.');
    expect(text(categoryRow(host, SEASONAL.categoryId))).toContain(
      'Hidden from the POS. Item status and availability are kept. Restore this category to show its active, available items again.'
    );
    expect(text(host.querySelector('.menu-intro'))).toBe(
      'Prices include tax · Whole rupiah · IDR. Changes reach the POS within three seconds. Existing orders keep their saved names and prices.'
    );
  });

  it('has no 86, Make available, Edit or New item control yet (S5 and S4c2)', async () => {
    const host = await open();
    const names = [...host.querySelectorAll('button, a')].map((el) => el.getAttribute('aria-label') ?? el.textContent ?? '');
    expect(names.filter((n) => /\b86\b|Make available|^Edit|New item/.test(n))).toEqual([]);
  });

  it('shows an empty category’s row with DESIGN-019’s copy', async () => {
    const empty = cat(9, 'Specials', 3);
    const host = await open(catalog(5, [MAINS, empty], [BURGER]));
    expect(text(host.querySelector(`[data-empty-category="${empty.categoryId}"]`)!)).toBe(
      'No items in this category yet. Use New item to add the first one.'
    );
    const archivedEmpty = cat(10, 'Old', 4, false);
    view!.unmount();
    h = harness();
    view = await openMenu(h, catalog(5, [MAINS, archivedEmpty], [BURGER]));
    expect(text(view.host.querySelector(`[data-empty-category="${archivedEmpty.categoryId}"]`)!)).toBe(
      'No items in this category yet. Restore the category before adding an item.'
    );
  });
});

describe('AC 3. prices', () => {
  it('shows whole rupiah with dot grouping and no currency symbol', async () => {
    const host = await open();
    const price = (row: HTMLElement) => row.querySelector('.num')!.textContent;
    expect(price(itemRow(host, BURGER.itemId))).toBe('99.999.999');
    expect(price(itemRow(host, ITEM_2.itemId))).toBe('0');
    expect(price(itemRow(host, SODA.itemId))).toBe('30.000');
    expect(text(host)).not.toMatch(/Rp|IDR\s*\d|\$/);
  });
});

describe('AC 4. empty, loading, failed and partial', () => {
  it('shows No menu yet with one New category when there is no category', async () => {
    const host = await open(catalog(0, [], []));
    expect(text(host.querySelector('.office-empty'))).toBe('No menu yetNothing is preloaded. Create a category, then add your first item.');
    expect([...host.querySelectorAll('button')].filter((b) => b.textContent === 'New category')).toHaveLength(1);
    expect(host.querySelector('#menu-list')).toBeNull();
    expect(aria(named(host, 'New category'))).toBe(false);
    expect(aria(named(host, 'Reorder categories'))).toBe(true);
  });

  it('shows Loading menu… while the first read is in flight, with the count withheld and no reorder live', async () => {
    h = harness();
    const opened = await openMenuHeld(h);
    view = opened.view;
    const { held } = opened;
    const host = view.host;
    expect(text(host.querySelector('#read-state'))).toBe('Loading menu…');
    expect(count(host)).toBeNull();
    expect(host.querySelector('#menu-list')).toBeNull();
    expect(aria(named(host, 'Reorder categories'))).toBe(true);
    held.deliver(catalog(5));
    await h.settle();
    expect(host.querySelector('#read-state')).toBeNull();
    expect(text(count(host))).toBe('3 categories · 7 items');
  });

  it('a failed read shows the alert with Try again, withholds the count and disables both reorder openers', async () => {
    const host = await open(failure);
    const alert = host.querySelector('#read-state [role="alert"]')!;
    expect(text(alert)).toBe(`${READ_FAILED.title}${READ_FAILED.body}Try again`);
    expect(count(host)).toBeNull();
    expect(aria(named(host, 'Reorder categories'))).toBe(true);
    // Creation carries no version, so it stays live after a failed read (DESIGN-019's error state).
    expect(aria(named(host, 'New category'))).toBe(false);
    // Try again repeats the read only.
    h.reply(READ, catalog(5));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(h.count(READ)).toBe(2);
    expect(host.querySelector('#read-state')).toBeNull();
    expect(text(count(host))).toBe('3 categories · 7 items');
    expect(aria(named(host, 'Reorder categories'))).toBe(false);
  });

  it('after a failed first read New category opens its panel; Create sends one { name } and the partial state follows with its copy', async () => {
    const host = await open(failure);
    tap(named(host, 'New category'));
    expect(panelName(host)).toBe('New category');
    expect(document.activeElement).toBe(nameField(host));
    h.reply(CATEGORY_CREATE, category(6, cat(4, 'Specials', 3)));
    typeInto(nameField(host)!, 'Specials');
    tap(named(host, 'Create'));
    await h.settle();

    expect(h.count(CATEGORY_CREATE)).toBe(1);
    expect(bodyOf(h, CATEGORY_CREATE)).toEqual({ name: 'Specials' });
    expect(text(pageStatus(host))).toBe('Specials saved.');
    expect(headings(host)).toEqual(['Specials']);
    expect(text(host.querySelector('#read-state [role="alert"]')!)).toBe(`${LIST_PARTIAL.title}${LIST_PARTIAL.body}Try again`);
    expect(count(host)).toBeNull();
    expect(aria(named(host, 'Reorder categories'))).toBe(true);
    expect(h.count(READ)).toBe(1);
  });

  it('New category is inert while the first read is loading', async () => {
    h = harness();
    const opened = await openMenuHeld(h);
    view = opened.view;
    expect(aria(named(view.host, 'New category'))).toBe(true);
    tap(named(view.host, 'New category'));
    expect(panel(view.host)).toBeNull();
    opened.held.deliver(catalog(5));
    await h.settle();
    expect(aria(named(view.host, 'New category'))).toBe(false);
  });

  it('a command that succeeds while the read stands failed shows the partial state with the answered record applied', async () => {
    const host = await open(undefined, '/back-office/menu');
    // An item command, so two categories stay active and two items of Mains stay active: only the
    // read being incomplete can be why the reorder openers are off.
    const held = h.hold(ITEM_ARCHIVE);
    tap(named(host, 'Archive item Burger'));
    await h.settle();
    // A reread, begun by a visit while the command is out, fails.
    tap(named(rail(host), 'Settings'));
    await h.settle();
    h.reply(READ, failure);
    tap(named(rail(host), 'Menu'));
    await h.settle();
    held.deliver(itemAnswer(6, { ...BURGER, isActive: false }));
    await h.settle();

    const alert = host.querySelector('#read-state [role="alert"]')!;
    expect(text(alert)).toBe(`${LIST_PARTIAL.title}${LIST_PARTIAL.body}Try again`);
    expect(count(host)).toBeNull();
    expect(headings(host)).toEqual(['Mains', 'Drinks', 'Seasonal · Archived category']);
    expect(itemNames(host, MAINS.categoryId)).toEqual(['Item 2', 'Item 10', 'Apple', 'Burger']);
    expect(text(pageStatus(host))).toBe('Burger archived. It is kept for history.');
    // A reorder needs a complete read: both openers are off. New category stays live.
    expect(aria(named(host, 'Reorder categories'))).toBe(true);
    expect(aria(named(host, 'Reorder items in Mains'))).toBe(true);
    tap(named(host, 'Reorder categories'));
    tap(named(host, 'Reorder items in Mains'));
    expect(panel(host)).toBeNull();
    expect(aria(named(host, 'New category'))).toBe(false);

    h.reply(READ, catalog(6, undefined, MENU_ITEMS.map((i) => (i.itemId === BURGER.itemId ? { ...i, isActive: false } : i))));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(host.querySelector('#read-state')).toBeNull();
    expect(text(count(host))).toBe('3 categories · 7 items');
    expect(aria(named(host, 'Reorder categories'))).toBe(false);
  });
});

describe('AC 5. the category name', () => {
  const create = async () => {
    const host = await open();
    tap(named(host, 'New category'));
    return host;
  };

  it('refuses an empty, an over-long and a control-character name in that order, each with its copy and focus on the field, sending nothing', async () => {
    const host = await create();
    tap(named(host, 'Create'));
    expect(text(nameError(host))).toBe('Enter a name');
    expect(document.activeElement).toBe(nameField(host));
    expect(nameField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(nameField(host)!.getAttribute('aria-describedby')).toBe('name-error menu-name-help');

    typeInto(nameField(host)!, 'x'.repeat(33));
    tap(named(host, 'Create'));
    expect(text(nameError(host))).toBe('Use 32 characters or fewer.');

    typeInto(nameField(host)!, 'Main\u0007plates');
    tap(named(host, 'Create'));
    expect(text(nameError(host))).toBe('Remove control characters from the name.');

    typeInto(nameField(host)!, '\u0007' + 'x'.repeat(40));
    tap(named(host, 'Create'));
    expect(text(nameError(host))).toBe('Use 32 characters or fewer.');
    expect(h.count(CATEGORY_CREATE)).toBe(0);
  });

  it('clears an obsolete error on edit, and Create stays live', async () => {
    const host = await create();
    tap(named(host, 'Create'));
    expect(nameError(host)).not.toBeNull();
    typeInto(nameField(host)!, 'S');
    expect(nameError(host)).toBeNull();
    expect(nameField(host)!.hasAttribute('aria-invalid')).toBe(false);
    expect(named(host, 'Create').hasAttribute('aria-disabled')).toBe(false);
  });

  it('sends the trimmed name', async () => {
    const host = await create();
    h.reply(CATEGORY_CREATE, category(6, cat(4, 'Specials', 3)));
    typeInto(nameField(host)!, '  Specials  ');
    tap(named(host, 'Create'));
    await h.settle();
    expect(h.count(CATEGORY_CREATE)).toBe(1);
    expect(bodyOf(h, CATEGORY_CREATE)).toEqual({ name: 'Specials' });
  });

  it('accepts a name of 32 emoji locally, where the length is code points and not UTF-16 units', async () => {
    const host = await create();
    const name = '🍽'.repeat(32);
    h.reply(CATEGORY_CREATE, category(6, cat(4, name, 3)));
    typeInto(nameField(host)!, name);
    tap(named(host, 'Create'));
    await h.settle();
    expect(nameError(host)).toBeNull();
    expect(h.count(CATEGORY_CREATE)).toBe(1);
    expect(bodyOf(h, CATEGORY_CREATE)).toEqual({ name });
  });
});

describe('AC 6. create, rename, archive and restore', () => {
  it('Create sends one request, applies the answer, announces it and focuses the new category’s Rename', async () => {
    const host = await open();
    tap(named(host, 'New category'));
    expect(panelName(host)).toBe('New category');
    expect(text(host.querySelector('#editor-context'))).toBe('Choose the category name staff will see at the POS.');
    expect(document.activeElement).toBe(nameField(host));
    const specials = cat(4, 'Specials', 3);
    h.reply(CATEGORY_CREATE, category(6, specials));
    typeInto(nameField(host)!, 'Specials');
    tap(named(host, 'Create'));
    await h.settle();

    expect(h.count(CATEGORY_CREATE)).toBe(1);
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Specials saved.');
    expect(headings(host)).toEqual(['Mains', 'Drinks', 'Specials', 'Seasonal · Archived category']);
    expect(text(count(host))).toBe('4 categories · 7 items');
    expect(document.activeElement).toBe(named(host, 'Rename category Specials'));
  });

  it('Rename sends the id, the version it opened at and the trimmed name, and focuses that category’s Rename', async () => {
    const host = await open();
    tap(named(host, 'Rename category Mains'));
    expect(panelName(host)).toBe('Rename Mains');
    expect(text(host.querySelector('#editor-context'))).toBe('Rename this category. Existing orders keep their saved names.');
    expect(nameField(host)!.value).toBe('Mains');
    h.reply(CATEGORY_UPDATE, category(6, { ...MAINS, name: 'Main plates' }));
    typeInto(nameField(host)!, ' Main plates ');
    tap(named(host, 'Save'));
    await h.settle();

    expect(h.count(CATEGORY_UPDATE)).toBe(1);
    expect(bodyOf(h, CATEGORY_UPDATE)).toEqual({ categoryId: MAINS.categoryId, expectedVersion: 5, name: 'Main plates' });
    expect(text(pageStatus(host))).toBe('Main plates saved.');
    expect(headings(host)[0]).toBe('Main plates');
    expect(document.activeElement).toBe(named(host, 'Rename category Main plates'));
  });

  it('a rename of an archived category leaves it archived, in the archived group', async () => {
    const host = await open();
    tap(named(host, 'Rename category Seasonal'));
    expect(text(host.querySelector('#editor-context'))).toBe('Archived category. Saving its name does not restore it.');
    h.reply(CATEGORY_UPDATE, category(6, { ...SEASONAL, name: 'Winter' }));
    typeInto(nameField(host)!, 'Winter');
    tap(named(host, 'Save'));
    await h.settle();
    expect(headings(host)).toEqual(['Mains', 'Drinks', 'Winter · Archived category']);
    expect(named(host, 'Restore category Winter')).toBeTruthy();
  });

  it('Archive category sends { categoryId } at once with no confirmation, moves the group after the active ones and changes no item row', async () => {
    const host = await open();
    const before = rowText(itemRow(host, BURGER.itemId));
    const held = h.hold(CATEGORY_ARCHIVE);
    tap(named(host, 'Archive category Mains'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Archiving Mains…');
    expect(document.activeElement).toBe(pageStatus(host));
    expect(pageStatus(host)!.getAttribute('tabindex')).toBe('-1');
    // Every opener is inert meanwhile, and a second press sends nothing.
    expect(aria(named(host, 'Rename category Drinks'))).toBe(true);
    expect(aria(named(host, 'New category'))).toBe(true);
    tap(named(host, 'Archive category Drinks'));
    await h.settle();
    expect(h.count(CATEGORY_ARCHIVE)).toBe(1);

    held.deliver(category(6, { ...MAINS, isActive: false }));
    await h.settle();
    expect(bodyOf(h, CATEGORY_ARCHIVE)).toEqual({ categoryId: MAINS.categoryId });
    expect(text(pageStatus(host))).toBe('Mains archived. Its items are hidden from the POS; their status and availability are unchanged.');
    expect(headings(host)).toEqual(['Drinks', 'Mains · Archived category', 'Seasonal · Archived category']);
    expect(document.activeElement).toBe(named(host, 'Rename category Mains'));
    expect(rowText(itemRow(host, BURGER.itemId)).replace('Hidden from the POS · category archived', '')).toBe(before);
    expect(named(host, 'Restore category Mains')).toBeTruthy();
  });

  it('Restore category sends { categoryId } and the group rejoins the active ones', async () => {
    const host = await open();
    h.reply(CATEGORY_RESTORE, category(6, { ...SEASONAL, isActive: true }));
    tap(named(host, 'Restore category Seasonal'));
    await h.settle();
    expect(bodyOf(h, CATEGORY_RESTORE)).toEqual({ categoryId: SEASONAL.categoryId });
    expect(text(pageStatus(host))).toBe('Seasonal restored. Its active, available items are shown at the POS again.');
    expect(headings(host)).toEqual(['Mains', 'Seasonal', 'Drinks']);
    expect(document.activeElement).toBe(named(host, 'Rename category Seasonal'));
  });

  it('Archive item and Restore item send { itemId } and focus the row action now shown', async () => {
    const host = await open();
    h.reply(ITEM_ARCHIVE, itemAnswer(6, { ...BURGER, isActive: false }));
    tap(named(host, 'Archive item Burger'));
    await h.settle();
    expect(bodyOf(h, ITEM_ARCHIVE)).toEqual({ itemId: BURGER.itemId });
    expect(text(pageStatus(host))).toBe('Burger archived. It is kept for history.');
    // The archived set follows the active one: Apple and Burger tie on their order, so the name decides.
    expect(itemNames(host, MAINS.categoryId)).toEqual(['Item 2', 'Item 10', 'Apple', 'Burger']);
    expect(document.activeElement).toBe(named(host, 'Restore item Burger'));

    h.reply(ITEM_RESTORE, itemAnswer(7, { ...APPLE, isActive: true }));
    tap(named(host, 'Restore item Apple'));
    await h.settle();
    expect(bodyOf(h, ITEM_RESTORE)).toEqual({ itemId: APPLE.itemId });
    expect(text(pageStatus(host))).toBe('Apple restored.');
    expect(document.activeElement).toBe(named(host, 'Archive item Apple'));
  });

  it('a restored item in an archived category says it stays hidden', async () => {
    const host = await open();
    h.reply(ITEM_RESTORE, itemAnswer(6, { ...STEW, isActive: true }));
    tap(named(host, 'Restore item Stew'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Stew restored. Its category is archived, so it stays hidden from the POS.');
  });
});

describe('AC 7. reorder', () => {
  it('disables Reorder categories below two active categories and a category’s Reorder items below two active items', async () => {
    const one = await open(catalog(5, [MAINS, SEASONAL], MENU_ITEMS));
    expect(aria(named(one, 'Reorder categories'))).toBe(true);
    // Mains holds three active items, Drinks one, and an archived category has no Reorder items.
    view!.unmount();
    h = harness();
    view = await openMenu(h);
    const host = view.host;
    expect(aria(named(host, 'Reorder categories'))).toBe(false);
    expect(aria(named(host, 'Reorder items in Mains'))).toBe(false);
    expect(aria(named(host, 'Reorder items in Drinks'))).toBe(true);
    expect([...host.querySelectorAll('[data-reorder]')]).toHaveLength(2);
    // An aria-disabled opener sends nothing and opens nothing.
    tap(named(host, 'Reorder items in Drinks'));
    expect(panel(host)).toBeNull();
  });

  it('Reorder categories: Move up is off on the first row and Move down on the last, focus stays on the moved record’s control, and Save order sends the full active scope with the version it opened at', async () => {
    const host = await open();
    tap(named(host, 'Reorder categories'));
    expect(panelName(host)).toBe('Reorder categories');
    expect(text(host.querySelector('#editor-context'))).toBe(
      'Move each row up or down, then save the full order. Archived records keep their stored order.'
    );
    expect(draftNames(host)).toEqual(['Mains', 'Drinks']);
    expect(aria(named(host, 'Move up Mains'))).toBe(true);
    expect(aria(named(host, 'Move down Drinks'))).toBe(true);
    // Focus lands on the first enabled move control.
    expect(document.activeElement).toBe(named(host, 'Move down Mains'));

    tap(named(host, 'Move down Mains'));
    expect(draftNames(host)).toEqual(['Drinks', 'Mains']);
    // Mains is last now: its Move down is off, so focus falls to its other control.
    expect(document.activeElement).toBe(named(host, 'Move up Mains'));
    expect(h.count(CATEGORY_REORDER)).toBe(0);

    h.reply(CATEGORY_REORDER, categories(6, [{ ...DRINKS, displayOrder: 0 }, { ...MAINS, displayOrder: 2 }]));
    tap(named(host, 'Save order'));
    await h.settle();
    expect(h.count(CATEGORY_REORDER)).toBe(1);
    expect(bodyOf(h, CATEGORY_REORDER)).toEqual({ expectedVersion: 5, categoryIds: [DRINKS.categoryId, MAINS.categoryId] });
    expect(text(pageStatus(host))).toBe('Category order saved.');
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Reorder categories'));
    // The archived category keeps its place after the active ones.
    expect(headings(host)).toEqual(['Drinks', 'Mains', 'Seasonal · Archived category']);
  });

  it('Reorder items sends the category, the version and the whole active scope; the archived item is not in it', async () => {
    const host = await open();
    tap(named(host, 'Reorder items in Mains'));
    expect(panelName(host)).toBe('Reorder items in Mains');
    expect(draftNames(host)).toEqual(['Burger', 'Item 2', 'Item 10']);
    tap(named(host, 'Move up Item 10'));
    expect(draftNames(host)).toEqual(['Burger', 'Item 10', 'Item 2']);
    h.reply(
      ITEM_REORDER,
      itemsAnswer(6, [
        { ...BURGER, displayOrder: 0 },
        { ...ITEM_10, displayOrder: 1 },
        { ...ITEM_2, displayOrder: 2 },
      ])
    );
    tap(named(host, 'Save order'));
    await h.settle();
    expect(h.count(ITEM_REORDER)).toBe(1);
    expect(bodyOf(h, ITEM_REORDER)).toEqual({
      categoryId: MAINS.categoryId,
      expectedVersion: 5,
      itemIds: [BURGER.itemId, ITEM_10.itemId, ITEM_2.itemId],
    });
    expect(text(pageStatus(host))).toBe('Item order in Mains saved.');
    expect(itemNames(host, MAINS.categoryId)).toEqual(['Burger', 'Item 10', 'Item 2', 'Apple']);
    expect(document.activeElement).toBe(named(host, 'Reorder items in Mains'));
  });

  it('an unchanged order answers that the version is still current, and closes the panel', async () => {
    const host = await open();
    tap(named(host, 'Reorder categories'));
    h.reply(CATEGORY_REORDER, categories(5, [{ ...MAINS }, { ...DRINKS }]));
    tap(named(host, 'Save order'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Nothing changed. Menu version 5 is still current.');
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Reorder categories'));
  });

  it('a pending Save order makes the panel inert, with the Saving notice focused', async () => {
    const host = await open();
    tap(named(host, 'Reorder categories'));
    h.hold(CATEGORY_REORDER);
    tap(named(host, 'Save order'));
    await h.settle();
    expect(text(formNotice(host))).toBe('Saving… Wait for the result. Your draft is kept.');
    expect(document.activeElement).toBe(formNotice(host));
    expect(aria(named(host, 'Move down Mains'))).toBe(true);
    tap(named(host, 'Save order'));
    await h.settle();
    expect(h.count(CATEGORY_REORDER)).toBe(1);
    expect(comparison(host)).toBeNull();
  });
});
