// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createFixtureSession } from '../src/session/fixtureSession.js';
import { dialogNamed, typeInto } from './tables-support.js';
import {
  ACTIVITY, REAUTH, VIEW,
  button, field, mount, ok, press as pressSession, refusal, sessionState, text, type,
} from './session-harness.js';
import {
  APPLE, BURGER, CATEGORY_UPDATE, DRINKS, ITEM_10, ITEM_86, ITEM_ARCHIVE, ITEM_AVAILABLE, MAINS, PIE, READ, SEASONAL, SODA,
  STEW, aria, bodyOf, catalog, category, harness, itemAnswer, itemRow, nameField, named, openMenu, pageStatus, panel,
  panelName, rowText, tap,
} from './menu-support.js';
import { ITEM_UPDATE, editFrom, nameInput } from './item-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-03's 86 and Make available (PHASE1-S5, DESIGN-019 round 2 F2, F6 and F7): one command, sent at
// once from the row with { itemId }, never refused for a stale version, and never resent. The rows
// are those of DESIGN-019's copy table; the server's side is catalog.test.ts.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const changed = refusal('CATALOG_CHANGED', undefined, 409);
const PASSWORD = 'correct horse';
const DISABLED_IN_PLACE = 'At the POS it is disabled in place, not removed.';
const STAYS_HIDDEN = 'It stays hidden from the POS while it or its category is archived.';

const open = async (first?: Parameters<typeof openMenu>[1]) => {
  h = harness();
  view = await openMenu(h, first);
  return view.host;
};

const mark86 = (name: string) => `Mark ${name} 86`;
const makeAvailable = (name: string) => `Make available ${name}`;
const decision = () => dialogNamed('Discard unsaved changes?');
const m6 = () => dialogNamed('Your session timed out')!;

/** The menu with Pie (in an archived category) and Apple (archived) marked 86 as well as Soda. */
const withHiddenUnavailable = () =>
  catalog(5, [MAINS, SEASONAL, DRINKS], [
    BURGER,
    ITEM_10,
    { ...APPLE, isAvailable: false },
    { ...PIE, isAvailable: false },
    STEW,
    SODA,
  ]);

async function goIdle(host: HTMLElement) {
  h.reply(ACTIVITY, refusal('SESSION_IDLE'));
  pressSession();
  await h.settle();
  expect(sessionState(host)).toBe('idle');
}

async function resume(host: HTMLElement) {
  h.reply(REAUTH, ok(VIEW));
  type(field(document.body, 'Password'), PASSWORD);
  tap(button(document.body, 'Continue'));
  await h.settle();
  expect(sessionState(host)).toBe('signed-in');
}

describe('the two calls on the configuration surface', () => {
  it('fixture mode answers unavailable, and sends nothing', async () => {
    const fixture = createFixtureSession();
    const itemId = BURGER.itemId;
    expect(await fixture.config['/api/back-office/config/catalog/items/mark-unavailable']({ itemId })).toEqual({ kind: 'unavailable' });
    expect(await fixture.config['/api/back-office/config/catalog/items/mark-available']({ itemId })).toEqual({ kind: 'unavailable' });
  });
});

describe('86 and Make available, from the row', () => {
  it('86 sends { itemId } once and shows the pending sentence, focused, with every opener inert; a second press sends nothing', async () => {
    const host = await open();
    const held = h.hold(ITEM_86);
    tap(named(host, mark86('Burger')));
    await h.settle();
    expect(h.count(ITEM_86)).toBe(1);
    expect(bodyOf(h, ITEM_86)).toEqual({ itemId: BURGER.itemId });
    expect(text(pageStatus(host))).toBe('Marking Burger 86…');
    expect(document.activeElement).toBe(pageStatus(host));
    for (const name of [
      mark86('Burger'), mark86('Item 10'), makeAvailable('Soda'), 'Edit Burger', 'New category', 'Rename category Mains',
      'Archive item Burger', 'Reorder categories',
    ]) {
      expect(aria(named(host, name)), name).toBe(true);
      tap(named(host, name));
    }
    await h.settle();
    expect(h.count(ITEM_86)).toBe(1);
    expect(h.count(ITEM_AVAILABLE)).toBe(0);
    expect(h.count(ITEM_ARCHIVE)).toBe(0);
    held.deliver(itemAnswer(6, { ...BURGER, isAvailable: false }));
    await h.settle();
  });

  it('86 of an offered item applies the answer, says it is disabled in place, flips the row and focuses its Edit', async () => {
    const host = await open();
    h.reply(ITEM_86, itemAnswer(6, { ...BURGER, isAvailable: false }));
    tap(named(host, mark86('Burger')));
    await h.settle();
    expect(text(pageStatus(host))).toBe(`Burger is now marked 86. ${DISABLED_IN_PLACE}`);
    expect(rowText(itemRow(host, BURGER.itemId))).toContain('86 · Unavailable');
    expect(named(host, makeAvailable('Burger')).textContent).toBe('Make available');
    expect(document.activeElement).toBe(named(host, 'Edit Burger'));
    expect(aria(named(host, mark86('Item 10')))).toBe(false);
  });

  it('Make available applies the answer, says so, flips the row and focuses its Edit', async () => {
    const host = await open();
    h.reply(ITEM_AVAILABLE, itemAnswer(6, { ...SODA, isAvailable: true }));
    tap(named(host, makeAvailable('Soda')));
    await h.settle();
    expect(h.count(ITEM_AVAILABLE)).toBe(1);
    expect(bodyOf(h, ITEM_AVAILABLE)).toEqual({ itemId: SODA.itemId });
    expect(text(pageStatus(host))).toBe('Soda is available again.');
    expect(rowText(itemRow(host, SODA.itemId))).toContain('Available');
    expect(named(host, mark86('Soda')).textContent).toBe('86');
    expect(document.activeElement).toBe(named(host, 'Edit Soda'));
  });

  it('the pending sentence of Make available is Making {name} available…', async () => {
    const host = await open();
    h.hold(ITEM_AVAILABLE);
    tap(named(host, makeAvailable('Soda')));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Making Soda available…');
  });

  it('F2: a hidden item, by its own archive or by its category, is never said to be disabled in place', async () => {
    const host = await open();
    h.reply(ITEM_86, itemAnswer(6, { ...APPLE, isAvailable: false }));
    tap(named(host, mark86('Apple')));
    await h.settle();
    expect(text(pageStatus(host))).toBe(`Apple is now marked 86. ${STAYS_HIDDEN}`);
    expect(text(pageStatus(host))).not.toContain('disabled in place');

    h.reply(ITEM_86, itemAnswer(7, { ...PIE, isAvailable: false }));
    tap(named(host, mark86('Pie')));
    await h.settle();
    expect(text(pageStatus(host))).toBe(`Pie is now marked 86. ${STAYS_HIDDEN}`);
    expect(document.activeElement).toBe(named(host, 'Edit Pie'));
  });

  it('Make available of a hidden item appends that it stays hidden', async () => {
    const host = await open(withHiddenUnavailable());
    h.reply(ITEM_AVAILABLE, itemAnswer(6, { ...APPLE, isAvailable: true }));
    tap(named(host, makeAvailable('Apple')));
    await h.settle();
    expect(text(pageStatus(host))).toBe(`Apple is available again. ${STAYS_HIDDEN}`);

    h.reply(ITEM_AVAILABLE, itemAnswer(7, { ...PIE, isAvailable: true }));
    tap(named(host, makeAvailable('Pie')));
    await h.settle();
    expect(text(pageStatus(host))).toBe(`Pie is available again. ${STAYS_HIDDEN}`);
  });

  it('a no-op answer (the version unchanged) announces the same sentence', async () => {
    const host = await open();
    // Another tab already marked Burger 86: the server wrote nothing and answers the standing version.
    h.reply(ITEM_86, itemAnswer(5, { ...BURGER, isAvailable: false }));
    tap(named(host, mark86('Burger')));
    await h.settle();
    expect(text(pageStatus(host))).toBe(`Burger is now marked 86. ${DISABLED_IN_PLACE}`);
    expect(rowText(itemRow(host, BURGER.itemId))).toContain('86 · Unavailable');
    expect(document.activeElement).toBe(named(host, 'Edit Burger'));
    // The version did not move: the next edit still carries 5.
    h.reply(CATEGORY_UPDATE, category(6, { ...MAINS, name: 'Main plates' }));
    tap(named(host, 'Rename category Mains'));
    typeInto(nameField(host)!, 'Main plates');
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, CATEGORY_UPDATE)).toMatchObject({ expectedVersion: 5 });
  });

  it('every item row carries the control, in an active category or an archived one', async () => {
    const host = await open();
    for (const item of [BURGER, APPLE, PIE, STEW, SODA]) {
      expect(itemRow(host, item.itemId).querySelectorAll('[data-availability]'), item.name).toHaveLength(1);
    }
  });
});

describe('the unknown, failed and refused outcomes of an 86', () => {
  it('an unknown outcome rereads once, says so, focuses the status, and never resends', async () => {
    const host = await open();
    h.reply(ITEM_86, failure);
    tap(named(host, mark86('Burger')));
    await h.settle();
    expect(h.count(ITEM_86)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(pageStatus(host))).toBe('Burger: the outcome could not be confirmed. The menu has been refreshed. Nothing was sent again.');
    expect(document.activeElement).toBe(pageStatus(host));
    // Not inferred from the reread: the row still offers 86.
    expect(named(host, mark86('Burger'))).toBeTruthy();
    expect(aria(named(host, mark86('Burger')))).toBe(false);
  });

  it('an unknown outcome of Make available whose reread failed says the menu could not be refreshed', async () => {
    const host = await open();
    h.reply(ITEM_AVAILABLE, failure);
    h.reply(READ, failure);
    tap(named(host, makeAvailable('Soda')));
    await h.settle();
    expect(h.count(ITEM_AVAILABLE)).toBe(1);
    expect(text(pageStatus(host))).toBe('Soda: the outcome could not be confirmed. The menu could not be refreshed. Nothing was sent again.');
  });

  it('a definite failure says the item was not changed, rereads once, and is an alert with focus', async () => {
    const host = await open();
    h.reply(ITEM_86, refusal('NOT_FOUND', undefined, 404));
    tap(named(host, mark86('Burger')));
    await h.settle();
    expect(h.count(READ)).toBe(2);
    expect(text(pageStatus(host))).toBe('Something went wrong. Burger was not changed. Use its row action to try again.');
    expect(pageStatus(host)!.getAttribute('role')).toBe('alert');
    expect(document.activeElement).toBe(pageStatus(host));

    h.reply(ITEM_AVAILABLE, refusal('VALIDATION_FAILED', undefined, 400));
    tap(named(host, makeAvailable('Soda')));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Something went wrong. Soda was not changed. Use its row action to try again.');
    expect(h.count(ITEM_86)).toBe(1);
    expect(h.count(ITEM_AVAILABLE)).toBe(1);
  });

  it('a session refusal says the item was not changed once the same manager resumes, and nothing is resent', async () => {
    const host = await open();
    h.reply(ITEM_86, refusal('SESSION_IDLE'));
    tap(named(host, mark86('Burger')));
    await h.settle();
    await resume(host);
    expect(text(pageStatus(host))).toBe('Burger was not changed. Use its row action to try again.');
    expect(h.count(ITEM_86)).toBe(1);
    expect(aria(named(host, mark86('Burger')))).toBe(false);
  });

  it('an answer that arrives behind M-6 is held and presented once on return, with no resend', async () => {
    const host = await open();
    const held = h.hold(ITEM_86);
    tap(named(host, mark86('Burger')));
    await h.settle();
    await goIdle(host);
    held.deliver(itemAnswer(6, { ...BURGER, isAvailable: false }));
    await h.settle();
    expect(m6()).not.toBeNull();
    expect(text(pageStatus(host))).toBe('Marking Burger 86…');
    await resume(host);
    expect(text(pageStatus(host))).toBe(`Burger is now marked 86. ${DISABLED_IN_PLACE}`);
    expect(document.activeElement).toBe(named(host, 'Edit Burger'));
    expect(h.count(ITEM_86)).toBe(1);
  });

  it('an unknown outcome that arrives behind M-6 is held with its one reread, presented once on return', async () => {
    const host = await open();
    const held = h.hold(ITEM_86);
    tap(named(host, mark86('Burger')));
    await h.settle();
    await goIdle(host);
    held.deliver(failure);
    await h.settle();
    expect(h.count(ITEM_86)).toBe(1);
    await resume(host);
    expect(text(pageStatus(host))).toBe('Burger: the outcome could not be confirmed. The menu has been refreshed. Nothing was sent again.');
    expect(h.count(ITEM_86)).toBe(1);
  });
});

describe('F7. over an open editor', () => {
  /** A rename of Mains with its name changed and not saved. */
  function dirtyRename(host: HTMLElement) {
    tap(named(host, 'Rename category Mains'));
    typeInto(nameField(host)!, 'Main plates');
  }

  it('86 with a dirty rename open acts at once with no decision, keeps the draft, and focuses Edit', async () => {
    const host = await open();
    dirtyRename(host);
    h.reply(ITEM_86, itemAnswer(6, { ...BURGER, isAvailable: false }));
    tap(named(host, mark86('Burger')));
    await h.settle();
    expect(decision()).toBeNull();
    expect(h.count(ITEM_86)).toBe(1);
    expect(panelName(host)).toBe('Rename Mains');
    expect(nameField(host)!.value).toBe('Main plates');
    expect(text(pageStatus(host))).toBe(`Burger is now marked 86. ${DISABLED_IN_PLACE}`);
    expect(document.activeElement).toBe(named(host, 'Edit Burger'));
  });

  it('a following Save carries the advanced base and is accepted', async () => {
    const host = await open();
    dirtyRename(host);
    h.reply(ITEM_86, itemAnswer(6, { ...BURGER, isAvailable: false }));
    tap(named(host, mark86('Burger')));
    await h.settle();
    h.reply(CATEGORY_UPDATE, category(7, { ...MAINS, name: 'Main plates' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, CATEGORY_UPDATE)).toEqual({ categoryId: MAINS.categoryId, expectedVersion: 6, name: 'Main plates' });
    expect(text(pageStatus(host))).toBe('Main plates saved.');
    expect(panel(host)).toBeNull();
  });

  it('a clean reorder editor stays open too, and its base advances', async () => {
    const host = await open();
    tap(named(host, 'Reorder items in Mains'));
    expect(panelName(host)).toBe('Reorder items in Mains');
    h.reply(ITEM_86, itemAnswer(6, { ...BURGER, isAvailable: false }));
    tap(named(host, mark86('Burger')));
    await h.settle();
    expect(decision()).toBeNull();
    expect(panelName(host)).toBe('Reorder items in Mains');
    expect(h.count(ITEM_86)).toBe(1);
  });

  it('an answer that skips a version leaves the editor’s base, and its Save meets CATALOG_CHANGED', async () => {
    const host = await open();
    dirtyRename(host);
    h.reply(ITEM_86, itemAnswer(7, { ...BURGER, isAvailable: false }));
    tap(named(host, mark86('Burger')));
    await h.settle();
    expect(nameField(host)!.value).toBe('Main plates');
    h.reply(CATEGORY_UPDATE, changed);
    h.reply(READ, catalog(7, [MAINS, SEASONAL, DRINKS], [{ ...BURGER, isAvailable: false }, ITEM_10, APPLE, PIE, STEW, SODA]));
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, CATEGORY_UPDATE)).toEqual({ categoryId: MAINS.categoryId, expectedVersion: 5, name: 'Main plates' });
    expect(named(host, 'Keep my changes')).toBeTruthy();
  });

  it('86 is inert while the draft’s save is pending', async () => {
    const host = await open();
    dirtyRename(host);
    h.hold(CATEGORY_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    expect(aria(named(host, mark86('Burger')))).toBe(true);
    expect(aria(named(host, makeAvailable('Soda')))).toBe(true);
    tap(named(host, mark86('Burger')));
    tap(named(host, makeAvailable('Soda')));
    await h.settle();
    expect(h.count(ITEM_86)).toBe(0);
    expect(h.count(ITEM_AVAILABLE)).toBe(0);
  });

  it('86 is inert while BO-04’s save, left outstanding, has not answered', async () => {
    const host = await open();
    await editFrom(h, host, 'Item 10');
    typeInto(nameInput(host), 'Ten');
    const save = h.hold(ITEM_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    const visit = h.hold(READ);
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(aria(named(host, mark86('Burger')))).toBe(true);
    tap(named(host, mark86('Burger')));
    tap(named(host, makeAvailable('Soda')));
    await h.settle();
    expect(h.count(ITEM_86)).toBe(0);
    expect(h.count(ITEM_AVAILABLE)).toBe(0);
    save.deliver(itemAnswer(6, { ...ITEM_10, name: 'Ten' }));
    visit.deliver(catalog(6));
    await h.settle();
  });

  it('Archive with a dirty rename still opens the decision', async () => {
    const host = await open();
    dirtyRename(host);
    tap(named(host, 'Archive item Burger'));
    expect(decision()).not.toBeNull();
    expect(h.count(ITEM_ARCHIVE)).toBe(0);
  });
});
