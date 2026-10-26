// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, refusal, text } from './session-harness.js';
import {
  CATEGORY_ARCHIVE, CATEGORY_CREATE, CATEGORY_REORDER, CATEGORY_RESTORE, CATEGORY_UPDATE, DRINKS,
  ITEM_RESTORE, ITEM_REORDER, MAINS, MENU_ITEMS, READ, SEASONAL, STEW,
  aria, bodyOf, cat, categories, category, catalog, comparison, draftNames, formNotice, harness, headings, item,
  type Cat, itemRow, nameError, nameField, named, openMenu, pageStatus, panel, rowText, tap,
} from './menu-support.js';
import { typeInto } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-03's version rules and refusals (PHASE1-S4c1 rulings 5, 10, 11 and 12; criteria 8 to 11):
// the version the list stands at, `CATALOG_CHANGED` on an edit, the unknown outcomes, and a held
// name. The state commands and the creates carry no version and are never refused as stale.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const changed = refusal('CATALOG_CHANGED', undefined, 409);
const duplicate = refusal('DUPLICATE', undefined, 409);

const open = async (first?: Parameters<typeof openMenu>[1]) => {
  h = harness();
  view = await openMenu(h, first);
  return view.host;
};

const focused = () => document.activeElement;

/** A rename of Mains, typed and not yet saved. */
function renaming(host: HTMLElement, to = 'Main plates') {
  tap(named(host, 'Rename category Mains'));
  typeInto(nameField(host)!, to);
}

describe('AC 8. the version the list stands at', () => {
  it('an answer one step ahead advances it: the next rename carries it and succeeds', async () => {
    const host = await open();
    h.reply(CATEGORY_CREATE, category(6, cat(4, 'Specials', 3)));
    tap(named(host, 'New category'));
    typeInto(nameField(host)!, 'Specials');
    tap(named(host, 'Create'));
    await h.settle();

    h.reply(CATEGORY_UPDATE, category(7, { ...MAINS, name: 'Main plates' }));
    renaming(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, CATEGORY_UPDATE)).toEqual({ categoryId: MAINS.categoryId, expectedVersion: 6, name: 'Main plates' });
    expect(text(pageStatus(host))).toBe('Main plates saved.');
  });

  it('an answer that skips a version (another tab wrote) leaves it: the next rename carries the old version and is refused CATALOG_CHANGED', async () => {
    const host = await open();
    h.reply(CATEGORY_ARCHIVE, category(7, { ...DRINKS, isActive: false }));
    tap(named(host, 'Archive category Drinks'));
    await h.settle();
    expect(text(pageStatus(host))).toContain('Drinks archived.');

    h.reply(CATEGORY_UPDATE, changed);
    h.reply(READ, catalog(7, [MAINS, SEASONAL, { ...DRINKS, isActive: false }]));
    renaming(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, CATEGORY_UPDATE).expectedVersion).toBe(5);
    expect(text(formNotice(host))).toContain('The menu changed while you were editing. Nothing was saved.');
  });

  it('an unchanged answer keeps the version, and a full read sets it', async () => {
    const host = await open();
    tap(named(host, 'Reorder categories'));
    h.reply(CATEGORY_REORDER, categories(5, [MAINS, DRINKS]));
    tap(named(host, 'Save order'));
    await h.settle();
    h.reply(CATEGORY_UPDATE, category(6, { ...MAINS, name: 'Main plates' }));
    renaming(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, CATEGORY_UPDATE).expectedVersion).toBe(5);
  });

  it('a reread never moves an open draft’s base: after a refused name the same draft is saved at the version it opened at', async () => {
    const host = await open();
    renaming(host, 'drinks');
    h.reply(CATEGORY_UPDATE, duplicate);
    h.reply(READ, catalog(8));
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(nameError(host))).toBe('An active category already uses this name. Choose another name.');

    h.reply(CATEGORY_UPDATE, category(9, { ...MAINS, name: 'Main plates' }));
    typeInto(nameField(host)!, 'Main plates');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.keyed(CATEGORY_UPDATE).map((c) => JSON.parse(c.body!).expectedVersion)).toEqual([5, 5]);
  });

  it('a state command that skips a version leaves the version, so the next reorder is refused too', async () => {
    const host = await open();
    h.reply(CATEGORY_RESTORE, category(8, { ...SEASONAL, isActive: true }));
    tap(named(host, 'Restore category Seasonal'));
    await h.settle();
    tap(named(host, 'Reorder categories'));
    h.reply(CATEGORY_REORDER, changed);
    tap(named(host, 'Save order'));
    await h.settle();
    expect(bodyOf(h, CATEGORY_REORDER).expectedVersion).toBe(5);
  });
});

describe('AC 9. CATALOG_CHANGED on a list edit', () => {
  it('a stale rename keeps the draft, rereads once, shows the current name beside it, and leaves Save off with its reason', async () => {
    const host = await open();
    renaming(host);
    h.reply(CATEGORY_UPDATE, changed);
    h.reply(READ, catalog(6, [{ ...MAINS, name: 'Main dishes' }, SEASONAL, DRINKS]));
    tap(named(host, 'Save'));
    await h.settle();

    expect(h.count(CATEGORY_UPDATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(nameField(host)!.value).toBe('Main plates');
    expect(text(formNotice(host))).toBe(
      'The menu changed while you were editing. Nothing was saved. The menu has been read again at version 6. Your draft is kept. Choose which to keep.'
    );
    expect(focused()).toBe(formNotice(host));
    expect(text(comparison(host)!.querySelector('h3'))).toBe('Current menu');
    expect(text(comparison(host)!.querySelector('#current-values'))).toBe('Current category name: Main dishes');
    expect(aria(named(host, 'Save'))).toBe(true);
    expect(named(host, 'Save').getAttribute('aria-describedby')).toBe('choice-reason');
    expect(text(host.querySelector('#choice-reason'))).toBe('Choose Keep my changes or Use current menu first.');
    // Save sends nothing until a choice is made.
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });

  it('Keep my changes moves the base to the reread version, focuses Save, sends nothing, and the next Save carries that version', async () => {
    const host = await open();
    renaming(host);
    h.reply(CATEGORY_UPDATE, changed);
    h.reply(READ, catalog(6, [{ ...MAINS, name: 'Main dishes' }, SEASONAL, DRINKS]));
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Keep my changes'));
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
    expect(text(formNotice(host))).toBe('Your changes now build on version 6. Nothing has been saved yet. Press Save to save them.');
    expect(focused()).toBe(named(host, 'Save'));
    expect(comparison(host)).toBeNull();
    expect(aria(named(host, 'Save'))).toBe(false);
    expect(nameField(host)!.value).toBe('Main plates');

    h.reply(CATEGORY_UPDATE, category(7, { ...MAINS, name: 'Main plates' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.keyed(CATEGORY_UPDATE).map((c) => JSON.parse(c.body!).expectedVersion)).toEqual([5, 6]);
    expect(text(pageStatus(host))).toBe('Main plates saved.');
  });

  it('Use current menu replaces the draft, focuses the name, sends nothing, and the next Save carries the new version', async () => {
    const host = await open();
    renaming(host);
    h.reply(CATEGORY_UPDATE, changed);
    h.reply(READ, catalog(6, [{ ...MAINS, name: 'Main dishes' }, SEASONAL, DRINKS]));
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Use current menu'));
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
    expect(nameField(host)!.value).toBe('Main dishes');
    expect(text(formNotice(host))).toBe('The form now shows version 6. Nothing was saved. Edit it and save, or Cancel to close.');
    expect(focused()).toBe(nameField(host));
    expect(comparison(host)).toBeNull();
    // The draft now equals the menu, so leaving asks nothing.
    tap(named(host, 'Cancel'));
    expect(panel(host)).toBeNull();
  });

  it('a stale Reorder categories shows the current order; Keep my changes then Save order carries the new version and the draft order', async () => {
    const host = await open();
    tap(named(host, 'Reorder categories'));
    tap(named(host, 'Move down Mains'));
    h.reply(CATEGORY_REORDER, changed);
    h.reply(READ, catalog(6, [MAINS, { ...SEASONAL, name: 'Winter' }, DRINKS]));
    tap(named(host, 'Save order'));
    await h.settle();

    expect(h.count(CATEGORY_REORDER)).toBe(1);
    expect(draftNames(host)).toEqual(['Drinks', 'Mains']);
    expect(text(comparison(host)!.querySelector('#current-values'))).toBe('Current order: Mains → Drinks');
    expect(aria(named(host, 'Save order'))).toBe(true);
    tap(named(host, 'Keep my changes'));
    expect(text(formNotice(host))).toBe('Your changes now build on version 6. Nothing has been saved yet. Press Save order to save them.');
    expect(focused()).toBe(named(host, 'Save order'));

    h.reply(CATEGORY_REORDER, categories(7, [{ ...DRINKS, displayOrder: 0 }, { ...MAINS, displayOrder: 2 }]));
    tap(named(host, 'Save order'));
    await h.settle();
    expect(h.keyed(CATEGORY_REORDER).map((c) => JSON.parse(c.body!))).toEqual([
      { expectedVersion: 5, categoryIds: [DRINKS.categoryId, MAINS.categoryId] },
      { expectedVersion: 6, categoryIds: [DRINKS.categoryId, MAINS.categoryId] },
    ]);
    expect(text(pageStatus(host))).toBe('Category order saved.');
  });

  it('a stale Reorder items: Use current menu replaces the draft order and focuses the first enabled move control', async () => {
    const host = await open();
    tap(named(host, 'Reorder items in Mains'));
    tap(named(host, 'Move down Burger'));
    h.reply(ITEM_REORDER, changed);
    h.reply(READ, catalog(6));
    tap(named(host, 'Save order'));
    await h.settle();
    expect(text(comparison(host)!.querySelector('#current-values'))).toBe('Current order: Burger → Item 2 → Item 10');
    tap(named(host, 'Use current menu'));
    expect(draftNames(host)).toEqual(['Burger', 'Item 2', 'Item 10']);
    expect(text(formNotice(host))).toBe('The form now shows version 6. Nothing was saved. Edit it and save, or Cancel to close.');
    expect(focused()).toBe(named(host, 'Move down Burger'));
    expect(h.count(ITEM_REORDER)).toBe(1);
  });

  describe('Keep my changes on a reorder whose scope changed rebuilds the draft against the reread scope', () => {
    const X = cat(8, 'Extra', 3);
    const run = async (opts: { moved: boolean; reread: Cat[]; expected: string[]; shown: string[] }) => {
      const host = await open();
      tap(named(host, 'Reorder categories'));
      if (opts.moved) tap(named(host, 'Move down Mains'));
      h.reply(CATEGORY_REORDER, changed);
      h.reply(READ, catalog(6, opts.reread));
      tap(named(host, 'Save order'));
      await h.settle();
      tap(named(host, 'Keep my changes'));
      // The merge is visible before Save order, and nothing was sent by Keep.
      expect(draftNames(host)).toEqual(opts.shown);
      expect(h.count(CATEGORY_REORDER)).toBe(1);
      expect(text(formNotice(host))).toBe('Your changes now build on version 6. Nothing has been saved yet. Press Save order to save them.');
      h.reply(CATEGORY_REORDER, categories(7, []));
      tap(named(host, 'Save order'));
      await h.settle();
      expect(h.count(CATEGORY_REORDER)).toBe(2);
      expect(bodyOf(h, CATEGORY_REORDER, 1)).toEqual({ expectedVersion: 6, categoryIds: opts.expected });
    };

    it('a record added to the scope goes last', async () => {
      await run({ moved: true, reread: [MAINS, SEASONAL, DRINKS, X], expected: [DRINKS.categoryId, MAINS.categoryId, X.categoryId], shown: ['Drinks', 'Mains', 'Extra'] });
    });

    it('a record archived out of the scope drops out', async () => {
      await run({ moved: true, reread: [MAINS, SEASONAL, { ...DRINKS, isActive: false }], expected: [MAINS.categoryId], shown: ['Mains'] });
    });

    it('one added and one archived at once', async () => {
      await run({ moved: true, reread: [MAINS, SEASONAL, { ...DRINKS, isActive: false }, X], expected: [MAINS.categoryId, X.categoryId], shown: ['Mains', 'Extra'] });
    });

    it('a draft that moved nothing takes the current order', async () => {
      const between = cat(9, 'Between', 1);
      await run({ moved: false, reread: [MAINS, SEASONAL, DRINKS, between], expected: [MAINS.categoryId, between.categoryId, DRINKS.categoryId], shown: ['Mains', 'Between', 'Drinks'] });
    });
  });

  it('a stale rename whose reread fails has no comparison, a read-only Try again, and Save stays off until the read lands', async () => {
    const host = await open();
    renaming(host);
    h.reply(CATEGORY_UPDATE, changed);
    h.reply(READ, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host)!.querySelector('p'))).toBe(
      'The menu changed while you were editing. Nothing was saved. Your draft is kept, but the current menu could not be read. Try again to read it before choosing.'
    );
    expect(comparison(host)).toBeNull();
    expect(aria(named(host, 'Save'))).toBe(true);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(CATEGORY_UPDATE)).toBe(1);

    const reads = h.count(READ);
    h.reply(READ, catalog(6, [{ ...MAINS, name: 'Main dishes' }, SEASONAL, DRINKS]));
    tap(host.querySelector<HTMLElement>('#retry-menu-read')!);
    await h.settle();
    expect(h.count(READ)).toBe(reads + 1);
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
    expect(text(comparison(host)!.querySelector('#current-values'))).toBe('Current category name: Main dishes');
    expect(text(formNotice(host)!.querySelector('p'))).toContain('read again at version 6');
  });
});

describe('AC 10. unknown outcomes', () => {
  it.each([
    ['a 500', failure],
    ['a network failure', 'reject' as const],
  ])('an edit answered by %s gets one reread and is never resent', async (_what, reply) => {
    const host = await open();
    renaming(host);
    h.reply(CATEGORY_UPDATE, reply);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(formNotice(host))).toBe('Outcome not confirmed. The menu has been refreshed. Your draft is kept; nothing was sent again.');
    expect(nameField(host)!.value).toBe('Main plates');
    expect(focused()).toBe(nameField(host));
    expect(comparison(host)).toBeNull();
    // Success is never inferred from the reread, and the explicit Save stays available.
    expect(text(pageStatus(host)) || null).toBeNull();
    expect(aria(named(host, 'Save'))).toBe(false);
  });

  it('an edit whose reread failed says the menu could not be refreshed, with a read-only Try again', async () => {
    const host = await open();
    renaming(host);
    h.reply(CATEGORY_UPDATE, failure);
    h.reply(READ, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host)!.querySelector('p'))).toBe(
      'Outcome not confirmed. The menu could not be refreshed. Your draft is kept; nothing was sent again.'
    );
    h.reply(READ, catalog(5));
    tap(host.querySelector<HTMLElement>('#retry-menu-read')!);
    await h.settle();
    expect(text(formNotice(host)!.querySelector('p'))).toBe(
      'Outcome not confirmed. The menu has been refreshed. Your draft is kept; nothing was sent again.'
    );
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });

  it('an edit whose reread shows a newer version gets the comparison and the “may include this save” notice', async () => {
    const host = await open();
    renaming(host);
    h.reply(CATEGORY_UPDATE, failure);
    h.reply(READ, catalog(6, [{ ...MAINS, name: 'Main plates' }, SEASONAL, DRINKS]));
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmed. The menu has been read again at version 6. It may include this save. Your draft is kept; nothing was sent again. Choose which to keep.'
    );
    expect(text(comparison(host)!.querySelector('#current-values'))).toBe('Current category name: Main plates');
    expect(aria(named(host, 'Save'))).toBe(true);
    expect(text(pageStatus(host)) || null).toBeNull();
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });

  it('a state command answered unknown gets one reread and the page sentence, and never a resend', async () => {
    const host = await open();
    h.reply(CATEGORY_ARCHIVE, failure);
    tap(named(host, 'Archive category Mains'));
    await h.settle();
    expect(h.count(CATEGORY_ARCHIVE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(pageStatus(host))).toBe('Mains: the outcome could not be confirmed. The menu has been refreshed. Nothing was sent again.');
    expect(document.activeElement).toBe(pageStatus(host));
    // Not inferred from the reread: the row still offers Archive.
    expect(named(host, 'Archive category Mains')).toBeTruthy();
  });

  it('a state command whose reread failed says the menu could not be refreshed; Try again rereads only', async () => {
    const host = await open();
    h.reply(CATEGORY_ARCHIVE, failure);
    h.reply(READ, failure);
    tap(named(host, 'Archive category Mains'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Mains: the outcome could not be confirmed. The menu could not be refreshed. Nothing was sent again.');
    h.reply(READ, catalog(5));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Mains: the outcome could not be confirmed. The menu has been refreshed. Nothing was sent again.');
    expect(h.count(CATEGORY_ARCHIVE)).toBe(1);
  });

  it('a definite failure of an edit keeps the draft and says Press Save to try again; of a state command, the row action', async () => {
    const host = await open();
    renaming(host);
    h.reply(CATEGORY_UPDATE, refusal('VALIDATION_FAILED', undefined, 400));
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toBe('Something went wrong. Nothing was saved. Your draft is kept. Press Save to try again.');
    expect(formNotice(host)!.getAttribute('role')).toBe('alert');
    // Invalid is the definite failure of the command, with the list reread once (ruling 12).
    expect(h.count(READ)).toBe(2);
    tap(named(host, 'Cancel'));
    tap(named(host, 'Discard'));

    h.reply(CATEGORY_ARCHIVE, refusal('NOT_FOUND', undefined, 404));
    tap(named(host, 'Archive category Drinks'));
    await h.settle();
    expect(h.count(READ)).toBe(3);
    expect(text(pageStatus(host))).toBe('Something went wrong. Drinks was not changed. Use its row action to try again.');
    expect(pageStatus(host)!.getAttribute('role')).toBe('alert');
    expect(document.activeElement).toBe(pageStatus(host));
  });
});

describe('AC 11. a name an active record already holds', () => {
  it('a refused create keeps the draft, puts the refusal on the field with focus, rereads once and marks the holder', async () => {
    const host = await open();
    tap(named(host, 'New category'));
    typeInto(nameField(host)!, 'mains');
    h.reply(CATEGORY_CREATE, duplicate);
    tap(named(host, 'Create'));
    await h.settle();

    expect(h.count(CATEGORY_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(nameError(host))).toBe('An active category already uses this name. Choose another name.');
    expect(nameField(host)!.value).toBe('mains');
    expect(nameField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(nameField(host));
    const holder = host.querySelector('tr[data-category="' + MAINS.categoryId + '"]')!;
    expect(text(holder)).toContain('Name in use');
    expect(holder.querySelector('a, button[aria-label="Name in use"]')).toBeNull();
    // Editing clears the error and the marker.
    typeInto(nameField(host)!, 'maine');
    expect(nameError(host)).toBeNull();
    expect(text(host.querySelector('tr[data-category="' + MAINS.categoryId + '"]')!)).not.toContain('Name in use');
  });

  it('a refused rename marks the holder, not the category being renamed', async () => {
    const host = await open();
    tap(named(host, 'Rename category Drinks'));
    typeInto(nameField(host)!, 'MAINS');
    h.reply(CATEGORY_UPDATE, duplicate);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(nameError(host))).toBe('An active category already uses this name. Choose another name.');
    expect(text(host.querySelector('tr[data-category="' + MAINS.categoryId + '"]')!)).toContain('Name in use');
    expect(text(host.querySelector('tr[data-category="' + DRINKS.categoryId + '"]')!)).not.toContain('Name in use');
  });

  it('marks nobody when the reread shows no active category with that name', async () => {
    const host = await open();
    tap(named(host, 'New category'));
    typeInto(nameField(host)!, 'Specials');
    h.reply(CATEGORY_CREATE, duplicate);
    tap(named(host, 'Create'));
    await h.settle();
    expect(text(nameError(host))).toBe('An active category already uses this name. Choose another name.');
    expect(host.querySelector('.table-holder')).toBeNull();
  });

  it('a refused category restore is a page result, focused, with no form, one reread and the holder marked', async () => {
    const host = await open();
    const holder = cat(8, 'seasonal', 4);
    h.reply(CATEGORY_RESTORE, duplicate);
    h.reply(READ, catalog(6, [MAINS, SEASONAL, DRINKS, holder]));
    tap(named(host, 'Restore category Seasonal'));
    await h.settle();

    expect(h.count(CATEGORY_RESTORE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(pageStatus(host))).toBe(
      'Seasonal was not restored. An active category already uses this name. Rename this archived category, save, then restore it.'
    );
    expect(pageStatus(host)!.getAttribute('role')).toBe('alert');
    expect(document.activeElement).toBe(pageStatus(host));
    expect(panel(host)).toBeNull();
    expect(text(host.querySelector('tr[data-category="' + holder.categoryId + '"]')!)).toContain('Name in use');
    expect(headings(host)).toContain('Seasonal · Archived category');
  });

  it('a refused item restore is a page result, focused, with no form and the holding item marked', async () => {
    const host = await open();
    const other = item(9, DRINKS.categoryId, 'stew', 1);
    h.reply(ITEM_RESTORE, duplicate);
    h.reply(READ, catalog(6, [MAINS, SEASONAL, DRINKS], [...MENU_ITEMS, other]));
    tap(named(host, 'Restore item Stew'));
    await h.settle();

    expect(h.count(ITEM_RESTORE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(pageStatus(host))).toBe(
      'Stew was not restored. An active item already uses this name. Rename this archived item in the item editor, save, then restore it.'
    );
    expect(document.activeElement).toBe(pageStatus(host));
    expect(panel(host)).toBeNull();
    expect(rowText(itemRow(host, other.itemId))).toContain('Name in use');
    expect(rowText(itemRow(host, STEW.itemId))).not.toContain('Name in use');
  });

  it('never resends: one press is one request', async () => {
    const host = await open();
    h.reply(CATEGORY_RESTORE, duplicate);
    tap(named(host, 'Restore category Seasonal'));
    await h.settle();
    expect(h.count(CATEGORY_RESTORE)).toBe(1);
  });
});
