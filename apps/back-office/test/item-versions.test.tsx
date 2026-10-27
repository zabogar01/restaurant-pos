// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { refusal, mount, text } from './session-harness.js';
import {
  BURGER, CATEGORY_UPDATE, DRINKS, ITEM_10, MAINS, MENU_ITEMS, SEASONAL, aria, catalog, category, harness,
  item as makeItem, itemRow, nameField, pageStatus, panelName,
} from './menu-support.js';
import {
  ITEM_CREATE, ITEM_UPDATE, READ, body, categoryErrorText, categorySelect, choose, compare, currentValues, editFrom,
  facts, hint, holderLine, itemAnswer, named, nameErrorText, nameInput, newIn, notice, noticeText, openMenuWith,
  optionLabels, priceInput, q, save, tap,
} from './item-support.js';
import { typeInto } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-04's version rules and refusals (PHASE1-S4c2a rulings 4, 9, 11 to 15): the draft builds on its
// own read; an answer one step ahead advances Menu's standing version and one that skips leaves
// it; CATALOG_CHANGED on an edit keeps the draft, rereads once and offers Keep my changes or Use
// current item, sending nothing; a create into a category archived meanwhile; the unknown
// outcomes; a name an active item already holds.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const changed = refusal('CATALOG_CHANGED', undefined, 409);
const duplicate = refusal('DUPLICATE', undefined, 409);
const open = async () => {
  h = harness();
  view = await openMenuWith(h);
  return view.host;
};
const focused = () => document.activeElement;
const withBurger = (more: Partial<typeof BURGER>) => MENU_ITEMS.map((i) => (i.itemId === BURGER.itemId ? { ...i, ...more } : i));
const CATS = [MAINS, SEASONAL, DRINKS];
const retry = (host: HTMLElement) => host.querySelector<HTMLElement>('#retry-read')!;

/** Burger opened for editing with its price changed and not saved. */
async function editing(host: HTMLElement) {
  await editFrom(h, host, 'Burger');
  typeInto(q<HTMLInputElement>(host, '#item-price')!, '50.000');
}

describe('AC 3 and 9. the version BO-04 builds on, and what an answer does to Menu’s', () => {
  it('a reread alone never moves the base: after a refused name the same draft is saved at the version it opened at', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    typeInto(nameInput(host), 'Item 10');
    h.reply(ITEM_UPDATE, duplicate);
    h.reply(READ, catalog(7));
    tap(named(host, 'Save'));
    await h.settle();
    expect(nameErrorText(host)).toBe('An active item already uses this name. Choose another name.');
    typeInto(nameInput(host), 'Burger two');
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...BURGER, name: 'Burger two' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(2);
    expect(body(h, ITEM_UPDATE, 1).expectedVersion).toBe(5);
  });

  const renameAfter = async (answered: number) => {
    const host = await open();
    await editFrom(h, host, 'Item 10');
    typeInto(nameInput(host), 'Ten');
    h.reply(ITEM_UPDATE, itemAnswer(answered, { ...ITEM_10, name: 'Ten' }));
    // Menu’s visit read stays out, so the version it stands at is the one the answer left it.
    const visit = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
    tap(named(host, 'Rename category Mains'));
    expect(panelName(host)).toBe('Rename Mains');
    typeInto(nameField(host)!, 'Main plates');
    h.reply(CATEGORY_UPDATE, category(answered + 1, { ...MAINS, name: 'Main plates' }));
    tap(named(host, 'Save'));
    await h.settle();
    visit.deliver(catalog(answered));
    await h.settle();
    return JSON.parse(h.keyed(CATEGORY_UPDATE)[0]!.body!) as { expectedVersion: number };
  };

  it('an answer one version ahead of Menu’s standing version advances it', async () => {
    expect((await renameAfter(6)).expectedVersion).toBe(6);
  });

  it('an answer that skips a version leaves it, so the next edit opened from Menu carries the old one', async () => {
    expect((await renameAfter(8)).expectedVersion).toBe(5);
  });
});

describe('AC 11. CATALOG_CHANGED on an edit', () => {
  it('keeps the draft, rereads once, shows Current item with its marks, focuses the notice and holds Save', async () => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, changed);
    h.reply(READ, catalog(7, CATS, withBurger({ basePrice: '110000', name: 'Burger' })));
    const reads = h.count(READ);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(h.count(READ)).toBe(reads + 1);
    expect(noticeText(host)).toBe(
      'The menu changed while you were editingNothing was saved. The menu has been read again at version 7. Your draft is kept. Choose which to keep.'
    );
    expect(focused()).toBe(notice(host));
    expect(notice(host)!.getAttribute('role')).toBe('alert');
    expect(priceInput(host).value).toBe('50.000');
    expect(text(currentValues(host))).toBe(
      'Item nameBurgerCategoryMainsBase price110.000Differs from your draftStatusAvailable' +
        'Variants · current orderLarge · 0Modifiers · current orderCheese · 0'
    );
    expect(aria(save(host))).toBe(true);
    expect(hint(host)).toBe('Choose which version to keep before saving.');
    expect(text(q(host, '#choice-reason'))).toBe('Choose Keep my changes or Use current item before saving.');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
  });

  it('Keep my changes moves the base, rebuilds nothing, sends nothing, focuses Save, and the next Save carries the reread version and every field that differs from it', async () => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, changed);
    h.reply(READ, catalog(7, CATS, withBurger({ basePrice: '110000' })));
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Keep my changes'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(compare(host)).toBeNull();
    expect(noticeText(host)).toBe(
      'Your changes are keptYour changes now build on menu version 7. Nothing has been saved yet. Press Save to save them.'
    );
    expect(focused()).toBe(save(host));
    expect(priceInput(host).value).toBe('50.000');
    h.reply(ITEM_UPDATE, itemAnswer(8, { ...BURGER, basePrice: '50000' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(2);
    expect(body(h, ITEM_UPDATE, 1)).toEqual({
      itemId: BURGER.itemId,
      expectedVersion: 7,
      changes: { fields: { basePrice: '50000' } },
    });
  });

  it('Use current item replaces the form with the item just read, focuses Item name, sends nothing, and the form is clean', async () => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, changed);
    h.reply(READ, catalog(7, CATS, withBurger({ basePrice: '110000' })));
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Use current item'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(priceInput(host).value).toBe('110.000');
    expect(focused()).toBe(nameInput(host));
    expect(noticeText(host)).toBe(
      'Current item loadedThe form now shows menu version 7. Nothing was saved. Edit it and save, or Cancel to close.'
    );
    expect(aria(save(host))).toBe(false);
    typeInto(nameInput(host), 'Burger two');
    h.reply(ITEM_UPDATE, itemAnswer(8, { ...BURGER, name: 'Burger two' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(body(h, ITEM_UPDATE, 1).expectedVersion).toBe(7);
  });

  it('a clean form after Use current item leaves with no decision', async () => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, changed);
    h.reply(READ, catalog(7, CATS, withBurger({ basePrice: '110000' })));
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Use current item'));
    tap(named(host, 'Cancel'));
    await h.settle();
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(window.location.pathname).toBe('/back-office/menu');
  });

  it('when the current item has the same values, the notice says so before the choice', async () => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, changed);
    h.reply(READ, catalog(7, CATS, withBurger({ basePrice: '50000' })));
    tap(named(host, 'Save'));
    await h.settle();
    expect(noticeText(host)).toBe(
      'The menu changed while you were editingNothing was saved. The menu has been read again at version 7. Your draft is kept. The current item has the same values as your draft. Choose which to keep.'
    );
    expect(text(currentValues(host))).not.toContain('Differs from your draft');
  });

  it('a reread that failed has no comparison and a read-only Try again, and Save stays held until the read lands', async () => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, changed);
    h.reply(READ, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(noticeText(host)).toBe(
      'The menu changed while you were editingNothing was saved. Your draft is kept, but the current item could not be read. Try again to read it before choosing.Try again'
    );
    expect(compare(host)).toBeNull();
    expect(aria(save(host))).toBe(true);
    expect(hint(host)).toBe('Choose which version to keep before saving.');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    h.reply(READ, catalog(7, CATS, withBurger({ basePrice: '110000' })));
    tap(retry(host));
    await h.settle();
    expect(compare(host)).not.toBeNull();
    expect(noticeText(host)).toContain('read again at version 7');
    expect(h.count(ITEM_UPDATE)).toBe(1);
  });

  it('an edit moved to a category archived meanwhile is this refusal, with the destination refused after Keep until an active one is chosen', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    choose(categorySelect(host), DRINKS.categoryId);
    h.reply(ITEM_UPDATE, changed);
    h.reply(READ, catalog(7, [MAINS, SEASONAL, { ...DRINKS, isActive: false }]));
    tap(named(host, 'Save'));
    await h.settle();
    expect(noticeText(host)).toBe(
      'The menu changed while you were editingNothing was saved. The menu has been read again at version 7. Your draft is kept. Choose which to keep. The destination category was archived. Choose another category after deciding which version to keep.'
    );
    expect(categoryErrorText(host)).toBe('This category is archived. Choose another category.');
    expect(optionLabels(categorySelect(host))).toContain('Drinks · Archived [disabled]');
    tap(named(host, 'Keep my changes'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(categoryErrorText(host)).toBe('This category is archived. Choose another category.');
    expect(focused()).toBe(categorySelect(host));
    expect(noticeText(host)).toBe(
      'Your changes are keptYour changes now build on menu version 7. Nothing has been saved yet. Correct the marked fields, then press Save.'
    );
    expect(aria(save(host))).toBe(true);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    choose(categorySelect(host), MAINS.categoryId);
    expect(aria(save(host))).toBe(false);
    h.reply(ITEM_UPDATE, itemAnswer(8, BURGER));
    tap(named(host, 'Save'));
    await h.settle();
    expect(body(h, ITEM_UPDATE, 1)).toEqual({ itemId: BURGER.itemId, expectedVersion: 7, changes: {} });
  });
});

describe('AC 12. a create into a category archived meanwhile', () => {
  it('keeps the draft, shows the category as Archived with its refusal, holds Save with its reason, focuses Category, and the next create carries no version', async () => {
    const host = await open();
    await newIn(h, host, 'Mains');
    typeInto(nameInput(host), 'Fries');
    typeInto(priceInput(host), '12.500');
    h.reply(ITEM_CREATE, changed);
    h.reply(READ, catalog(7, [{ ...MAINS, isActive: false }, SEASONAL, DRINKS]));
    const reads = h.count(READ);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(reads + 1);
    expect(noticeText(host)).toBe('The category was archivedNothing was saved. Your draft is kept. Choose another category before saving.');
    expect(notice(host)!.getAttribute('role')).toBe('alert');
    expect(compare(host)).toBeNull();
    expect(nameInput(host).value).toBe('Fries');
    expect(categorySelect(host).value).toBe(MAINS.categoryId);
    expect(optionLabels(categorySelect(host))).toContain('Mains · Archived [disabled]');
    expect(categoryErrorText(host)).toBe('This category is archived. Choose another category.');
    expect(aria(save(host))).toBe(true);
    expect(hint(host)).toBe('Choose an active category before saving.');
    expect(focused()).toBe(categorySelect(host));
    choose(categorySelect(host), DRINKS.categoryId);
    expect(aria(save(host))).toBe(false);
    h.reply(ITEM_CREATE, itemAnswer(8, makeItem(8, DRINKS.categoryId, 'Fries', 5, { basePrice: '12500' })));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_CREATE)).toBe(2);
    expect(body(h, ITEM_CREATE, 1)).toEqual({
      categoryId: DRINKS.categoryId,
      name: 'Fries',
      basePrice: '12500',
      variants: [],
      modifiers: [],
    });
  });
});

describe('AC 13. unknown outcomes', () => {
  it.each([
    ['a 500', failure],
    ['a network failure', 'reject' as const],
  ])('a save answered by %s gets one reread at the same version and is never resent', async (_what, reply) => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, reply);
    const reads = h.count(READ);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(h.count(READ)).toBe(reads + 1);
    expect(noticeText(host)).toBe('Outcome not confirmedThe menu has been refreshed. Your draft is kept; nothing was sent again.');
    expect(priceInput(host).value).toBe('50.000');
    expect(focused()).toBe(nameInput(host));
    expect(compare(host)).toBeNull();
    expect(text(pageStatus(host)) || null).toBeNull();
    expect(aria(save(host))).toBe(false);
  });

  it('a reread that failed says the menu could not be refreshed, with a read-only Try again', async () => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, failure);
    h.reply(READ, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(noticeText(host)).toBe(
      'Outcome not confirmedThe menu could not be refreshed. Your draft is kept; nothing was sent again.Try again'
    );
    expect(facts(host)).toBe('');
    h.reply(READ, catalog(5));
    tap(retry(host));
    await h.settle();
    expect(noticeText(host)).toBe('Outcome not confirmedThe menu has been refreshed. Your draft is kept; nothing was sent again.');
    expect(h.count(ITEM_UPDATE)).toBe(1);
  });

  it('a reread at a newer version shows the comparison and the “may include this save” notice, focused', async () => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, failure);
    h.reply(READ, catalog(6, CATS, withBurger({ basePrice: '50000' })));
    tap(named(host, 'Save'));
    await h.settle();
    expect(noticeText(host)).toBe(
      'Outcome not confirmedThe menu has been read again at version 6. It may include this save. Your draft is kept; nothing was sent again. The current item has the same values as your draft. Choose which to keep.'
    );
    expect(focused()).toBe(notice(host));
    expect(compare(host)).not.toBeNull();
    expect(aria(save(host))).toBe(true);
    tap(named(host, 'Keep my changes'));
    h.reply(ITEM_UPDATE, itemAnswer(7, BURGER));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(2);
    expect(body(h, ITEM_UPDATE, 1).expectedVersion).toBe(6);
  });

  it('an unknown create is never resent either, and there is no version to compare', async () => {
    const host = await open();
    await newIn(h, host, 'Mains');
    typeInto(nameInput(host), 'Fries');
    typeInto(priceInput(host), '12.500');
    h.reply(ITEM_CREATE, failure);
    h.reply(READ, catalog(6));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_CREATE)).toBe(1);
    expect(noticeText(host)).toBe('Outcome not confirmedThe menu has been refreshed. Your draft is kept; nothing was sent again.');
    expect(compare(host)).toBeNull();
  });

  it.each([
    ['NOT_FOUND', refusal('NOT_FOUND', undefined, 404)],
    ['VALIDATION_FAILED', refusal('VALIDATION_FAILED', undefined, 400)],
  ])('%s on a save is the definite failure, with one reread and no resend', async (_code, reply) => {
    const host = await open();
    await editing(host);
    h.reply(ITEM_UPDATE, reply);
    const reads = h.count(READ);
    tap(named(host, 'Save'));
    await h.settle();
    expect(noticeText(host)).toBe('Something went wrongNothing was saved. Your draft is kept. Press Save to try again.');
    expect(h.count(READ)).toBe(reads + 1);
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(focused()).toBe(nameInput(host));
  });
});

describe('AC 14. a name an active item already holds', () => {
  const create = async (name: string) => {
    const host = await open();
    await newIn(h, host, 'Drinks');
    typeInto(nameInput(host), name);
    typeInto(priceInput(host), '12.500');
    h.reply(ITEM_CREATE, duplicate);
    return host;
  };

  it('puts the refusal on Item name with focus, rereads once and names the holder with a link to Menu', async () => {
    const host = await create('burger');
    const reads = h.count(READ);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(reads + 1);
    expect(nameErrorText(host)).toBe('An active item already uses this name. Choose another name.');
    expect(focused()).toBe(nameInput(host));
    expect(nameInput(host).value).toBe('burger');
    expect(text(holderLine(host))).toBe('Name held by Burger in Mains. View item on Menu');
    expect(aria(save(host))).toBe(true);
    // Editing clears the refusal and the holder line.
    typeInto(nameInput(host), 'burger two');
    expect(nameErrorText(host)).toBeNull();
    expect(holderLine(host)).toBeNull();
  });

  it('an item in an archived category still holds its name, and the copy says so', async () => {
    const host = await create('pie');
    tap(named(host, 'Save'));
    await h.settle();
    expect(nameErrorText(host)).toBe('An active item in an archived category still uses this name. Choose another name.');
    expect(text(holderLine(host))).toBe('Name held by Pie in Seasonal, an archived category. View item on Menu');
  });

  it('marks nobody when the reread shows no active item with that name', async () => {
    const host = await create('Zed');
    tap(named(host, 'Save'));
    await h.settle();
    expect(nameErrorText(host)).toBe('An active item already uses this name. Choose another name.');
    expect(holderLine(host)).toBeNull();
  });

  it('View item on Menu leaves through the decision and lands on the holder’s Edit, with the row selected', async () => {
    const host = await create('Burger');
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'View item on Menu'));
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')!;
    expect(dialog).not.toBeNull();
    tap(named(dialog, 'Stay'));
    expect(window.location.pathname).toBe('/back-office/menu/item');
    expect(nameInput(host).value).toBe('Burger');
    tap(named(host, 'View item on Menu'));
    tap(named(document.querySelector<HTMLDialogElement>('dialog[open]')!, 'Discard'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(document.activeElement).toBe(named(host, 'Edit Burger'));
    expect(itemRow(host, BURGER.itemId).getAttribute('data-selected')).toBe('true');
    expect(window.location.search + window.location.hash).toBe('');
  });

  it('a refused rename never names the item being edited as its holder', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    typeInto(nameInput(host), 'burger');
    h.reply(ITEM_UPDATE, duplicate);
    tap(named(host, 'Save'));
    await h.settle();
    expect(nameErrorText(host)).toBe('An active item already uses this name. Choose another name.');
    expect(holderLine(host)).toBeNull();
  });

  it('never resends: one press is one request', async () => {
    const host = await create('Burger');
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_CREATE)).toBe(1);
  });
});

describe('Round 2, F1. a saved item has a category on Menu to sit in', () => {
  const SPECIALS = { categoryId: '00000000-0000-4000-8000-000000000009', name: 'Specials', displayOrder: 3, isActive: true };
  const moved = { ...BURGER, categoryId: SPECIALS.categoryId };

  /** Menu knows three categories; BO-04's read also holds Specials, and Burger is saved into it with Menu's return read held. */
  async function savedIntoSpecials() {
    const host = await open();
    h.reply(READ, catalog(6, [...CATS, SPECIALS]));
    await editFrom(h, host, 'Burger');
    choose(categorySelect(host), SPECIALS.categoryId);
    h.reply(ITEM_UPDATE, itemAnswer(7, moved));
    const visit = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    return { host, visit };
  }

  it('hosts the category only BO-04 knows: the row is in it, Edit has focus, and the sentence names the save', async () => {
    const { host, visit } = await savedIntoSpecials();
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(host.querySelector('tr[data-category="' + SPECIALS.categoryId + '"] h2')!.textContent).toBe('Specials');
    expect(itemRow(host, BURGER.itemId)).not.toBeNull();
    expect(document.activeElement).toBe(named(host, 'Edit Burger'));
    expect(text(pageStatus(host))).toBe('Burger saved.');
    // The visit read lands holding both: the row and the category stay, and focus does not move again.
    visit.deliver(catalog(7, [...CATS, SPECIALS], MENU_ITEMS.map((i) => (i.itemId === BURGER.itemId ? moved : i))));
    await h.settle();
    expect(host.querySelector('tr[data-category="' + SPECIALS.categoryId + '"]')).not.toBeNull();
    expect(document.activeElement).toBe(named(host, 'Edit Burger'));
    expect(text(pageStatus(host))).toBe('Burger saved.');
  });

  it('when the held visit read fails, the hosted category and the row stay under the partial list’s copy', async () => {
    const { host, visit } = await savedIntoSpecials();
    visit.deliver(failure);
    await h.settle();
    expect(host.querySelector('tr[data-category="' + SPECIALS.categoryId + '"]')).not.toBeNull();
    expect(itemRow(host, BURGER.itemId)).not.toBeNull();
    expect(text(q(host, '#read-state'))).toContain('The menu list may be out of date');
  });
});
