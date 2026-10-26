// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { pressEscape, requestClose } from './dialog-shim.js';
import {
  ACTIVITY, LOGIN, ME, REAUTH, VIEW,
  button, field, mount, ok, press, refusal, sessionState, text, type,
} from './session-harness.js';
import {
  CATEGORY_ARCHIVE, CATEGORY_CREATE, CATEGORY_REORDER, CATEGORY_UPDATE, DRINKS, ITEM_ARCHIVE, MAINS, BURGER,
  READ, SEASONAL, catalog, category, comparison, formNotice, harness, headings, itemAnswer, nameField, named, openMenu, pageStatus,
  panel, panelName, rail, tap,
} from './menu-support.js';
import { OTHER, dialogNamed, openDialogs, typeInto } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-03's unsaved work against the session (PHASE1-S4c1 criteria 12 and 13): one editor and one
// command per screen, the stay-or-discard decision and its three bodies, a command that crosses
// M-6 or BO-01, and the identity of the area. jsdom has no top layer and no inertness, so what
// only a browser shows is e2e/tests/menu.spec.ts.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const PASSWORD = 'correct horse';

const open = async (first?: Parameters<typeof openMenu>[1], path?: string) => {
  h = harness(path);
  view = await openMenu(h, first);
  return view.host;
};

const ORDINARY = 'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
const CONTINUE = 'Your edits have not been saved. Stay to keep editing, or discard them to continue.';
const UNCERTAIN = 'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.';
const CONTINUE_UNCERTAIN =
  'The save may or may not have succeeded. Continuing does not send it again. Stay to keep the draft, or discard it to continue.';

/** A rename of Mains whose name has been changed and not saved. */
function dirtyRename(host: HTMLElement) {
  tap(named(host, 'Rename category Mains'));
  typeInto(nameField(host)!, 'Main plates');
}

const decision = () => dialogNamed('Discard unsaved changes?');
const body = () => text(document.querySelector('#departure-copy'));
const stayButton = () => document.querySelector<HTMLButtonElement>('#departure-stay')!;
const m6 = () => dialogNamed('Your session timed out')!;

async function goIdle(host: HTMLElement) {
  h.reply(ACTIVITY, refusal('SESSION_IDLE'));
  press();
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

async function endSession(host: HTMLElement) {
  h.reply(ACTIVITY, refusal('UNAUTHENTICATED'));
  press();
  await h.settle();
  expect(sessionState(host)).toBe('signed-out');
}

async function signInAgain(host: HTMLElement, answer = ok(VIEW), username = 'm.iqbal') {
  h.reply(LOGIN, answer);
  type(field(host, 'Username'), username);
  type(field(host, 'Password'), PASSWORD);
  tap(button(host, 'Sign in'));
  await h.settle();
}

describe('AC 12. one editor and one command per screen', () => {
  it('with a dirty rename, New category, Reorder categories and the rail each meet the decision, and Stay keeps the draft', async () => {
    const host = await open();
    dirtyRename(host);
    for (const opener of [
      () => tap(named(host, 'New category')),
      () => tap(named(host, 'Reorder categories')),
      () => tap(named(rail(host), 'Tables')),
    ]) {
      opener();
      expect(decision()).not.toBeNull();
      expect(body()).toBe(ORDINARY);
      tap(named(decision()!, 'Stay'));
      expect(panelName(host)).toBe('Rename Mains');
      expect(nameField(host)!.value).toBe('Main plates');
      expect(document.activeElement).toBe(nameField(host));
    }
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(h.count(CATEGORY_UPDATE)).toBe(0);
  });

  it('Discard on the decision hands over to the opener that asked', async () => {
    const host = await open();
    dirtyRename(host);
    tap(named(host, 'New category'));
    tap(named(decision()!, 'Discard'));
    expect(panelName(host)).toBe('New category');
    expect(nameField(host)!.value).toBe('');
    expect(document.activeElement).toBe(nameField(host));
  });

  it('with a clean editor, an opener simply hands over', async () => {
    const host = await open();
    tap(named(host, 'Rename category Mains'));
    tap(named(host, 'Reorder categories'));
    expect(decision()).toBeNull();
    expect(panelName(host)).toBe('Reorder categories');
    tap(named(host, 'New category'));
    expect(decision()).toBeNull();
    expect(panelName(host)).toBe('New category');
    expect(document.querySelectorAll('[role="dialog"][aria-modal="false"]')).toHaveLength(1);
  });

  it('Archive meets the decision with the round 2 body; Stay sends nothing and keeps the draft', async () => {
    const host = await open();
    dirtyRename(host);
    tap(named(host, 'Archive category Drinks'));
    expect(decision()).not.toBeNull();
    expect(body()).toBe(CONTINUE);
    expect(document.activeElement).toBe(stayButton());
    tap(named(decision()!, 'Stay'));
    expect(h.count(CATEGORY_ARCHIVE)).toBe(0);
    expect(nameField(host)!.value).toBe('Main plates');
    expect(document.activeElement).toBe(nameField(host));
  });

  it('Discard on that decision continues: the editor closes and the archive is sent once', async () => {
    const host = await open();
    dirtyRename(host);
    h.reply(CATEGORY_ARCHIVE, category(6, { ...DRINKS, isActive: false }));
    tap(named(host, 'Archive category Drinks'));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(panel(host)).toBeNull();
    expect(h.count(CATEGORY_ARCHIVE)).toBe(1);
    expect(h.count(CATEGORY_UPDATE)).toBe(0);
    expect(text(pageStatus(host))).toContain('Drinks archived.');
  });

  it('an item’s Archive meets the same decision', async () => {
    const host = await open();
    dirtyRename(host);
    h.reply(ITEM_ARCHIVE, itemAnswer(6, { ...BURGER, isActive: false }));
    tap(named(host, 'Archive item Burger'));
    expect(decision()).not.toBeNull();
    expect(body()).toBe(CONTINUE);
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(h.count(ITEM_ARCHIVE)).toBe(1);
  });

  it('Archive over an unknown save says that continuing does not send it again (round 3)', async () => {
    const host = await open();
    dirtyRename(host);
    h.reply(CATEGORY_UPDATE, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host)!.querySelector('p'))).toContain('Outcome not confirmed');
    tap(named(host, 'Archive category Drinks'));
    expect(decision()).not.toBeNull();
    expect(body()).toBe(CONTINUE_UNCERTAIN);
    tap(named(decision()!, 'Stay'));
    expect(h.count(CATEGORY_ARCHIVE)).toBe(0);
    // Every other departure keeps DESIGN-018’s uncertain body.
    tap(named(host, 'Cancel'));
    expect(decision()).not.toBeNull();
    expect(body()).toBe(UNCERTAIN);
  });

  it('with a clean editor, Archive closes it and acts at once, with no decision', async () => {
    const host = await open();
    tap(named(host, 'Rename category Mains'));
    h.reply(CATEGORY_ARCHIVE, category(6, { ...DRINKS, isActive: false }));
    tap(named(host, 'Archive category Drinks'));
    await h.settle();
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(h.count(CATEGORY_ARCHIVE)).toBe(1);
  });

  it('while a save is pending every opener is inert and a press sends nothing', async () => {
    const host = await open();
    dirtyRename(host);
    h.hold(CATEGORY_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    for (const name of ['New category', 'Reorder categories', 'Rename category Drinks', 'Archive category Drinks', 'Archive item Burger', 'Reorder items in Mains']) {
      expect(named(host, name).getAttribute('aria-disabled'), name).toBe('true');
      tap(named(host, name));
    }
    expect(decision()).toBeNull();
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
    expect(h.count(CATEGORY_ARCHIVE)).toBe(0);
    expect(h.count(ITEM_ARCHIVE)).toBe(0);
    expect(h.count(CATEGORY_REORDER)).toBe(0);
    expect(h.count(CATEGORY_CREATE)).toBe(0);
    expect(panelName(host)).toBe('Rename Mains');
  });

  it('while a state command is pending every opener is inert and a press sends nothing', async () => {
    const host = await open();
    h.hold(CATEGORY_ARCHIVE);
    tap(named(host, 'Archive category Drinks'));
    await h.settle();
    tap(named(host, 'New category'));
    tap(named(host, 'Rename category Mains'));
    tap(named(host, 'Reorder categories'));
    tap(named(host, 'Archive item Burger'));
    expect(panel(host)).toBeNull();
    expect(h.count(CATEGORY_ARCHIVE)).toBe(1);
    expect(h.count(ITEM_ARCHIVE)).toBe(0);
  });
});

describe('AC 13. the decision, M-6 and BO-01', () => {
  it('Cancel with a dirty form shows the decision; Stay keeps the draft and the path; Escape inside the decision means Stay', async () => {
    const host = await open();
    dirtyRename(host);
    tap(named(host, 'Cancel'));
    const d = decision()!;
    expect(d.getAttribute('closedby')).toBe('none');
    expect([...d.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Stay', 'Discard']);
    expect(document.activeElement).toBe(stayButton());
    tap(named(d, 'Stay'));
    expect(nameField(host)!.value).toBe('Main plates');
    expect(window.location.pathname).toBe('/back-office/menu');

    const escape = pressEscape(nameField(host)!);
    expect(escape.keydown.defaultPrevented).toBe(true);
    const cancel = requestClose(decision()!);
    expect(cancel.defaultPrevented).toBe(true);
    expect(decision()).toBeNull();
    expect(nameField(host)!.value).toBe('Main plates');
    expect(document.activeElement).toBe(nameField(host));
  });

  it('a clean editor closes on Cancel and on Escape with no decision, and focus returns to the opener', async () => {
    const host = await open();
    tap(named(host, 'Rename category Mains'));
    tap(named(host, 'Cancel'));
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Rename category Mains'));
    tap(named(host, 'Reorder categories'));
    pressEscape(document.activeElement as Element);
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Reorder categories'));
  });

  it('browser Back with a dirty editor restores the path and shows the decision; Stay keeps both; Discard follows Back', async () => {
    const host = await open(undefined, '/back-office/menu');
    dirtyRename(host);
    act(() => {
      window.history.pushState(null, '', '/back-office/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(nameField(host)!.value).toBe('Main plates');

    act(() => {
      window.history.pushState(null, '', '/back-office/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    tap(named(decision()!, 'Discard'));
    expect(window.location.pathname).toBe('/back-office/');
    expect(host.querySelector('h1')).toBeNull();
  });

  it('a pending save requires the decision even with an unchanged draft', async () => {
    const host = await open();
    tap(named(host, 'Rename category Mains'));
    h.hold(CATEGORY_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    expect(decision()).not.toBeNull();
    expect(body()).toBe(UNCERTAIN);
    tap(named(decision()!, 'Stay'));
    expect(document.activeElement).toBe(formNotice(host));
  });

  it('SESSION_IDLE on Save opens M-6 over the editor; after the same manager resumes the draft is there, nothing was resent, and the notice says so', async () => {
    const host = await open();
    dirtyRename(host);
    h.reply(CATEGORY_UPDATE, refusal('SESSION_IDLE'));
    tap(named(host, 'Save'));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(true);
    expect(panel(host)).not.toBeNull();
    expect(nameField(host)!.value).toBe('Main plates');
    expect(m6()).not.toBeNull();

    await resume(host);
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
    expect(nameField(host)!.value).toBe('Main plates');
    expect(text(formNotice(host))).toBe('Nothing was saved. Your draft is kept. Press Save to try again.');
    expect(document.activeElement).toBe(nameField(host));

    h.reply(CATEGORY_UPDATE, category(6, { ...MAINS, name: 'Main plates' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(CATEGORY_UPDATE)).toBe(2);
    expect(text(pageStatus(host))).toBe('Main plates saved.');
  });

  it('a state command refused SESSION_IDLE says it was not changed once the same manager resumes', async () => {
    const host = await open();
    h.reply(CATEGORY_ARCHIVE, refusal('SESSION_IDLE'));
    tap(named(host, 'Archive category Drinks'));
    await h.settle();
    await resume(host);
    expect(text(pageStatus(host))).toBe('Drinks was not changed. Use its row action to try again.');
    expect(h.count(CATEGORY_ARCHIVE)).toBe(1);
    expect(named(host, 'Archive category Drinks').hasAttribute('aria-disabled')).toBe(false);
  });

  it('a command result arriving while M-6 is up is held, not presented, and presented once on return', async () => {
    const host = await open();
    dirtyRename(host);
    const held = h.hold(CATEGORY_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);

    held.deliver(category(6, { ...MAINS, name: 'Main plates' }));
    await h.settle();
    // Behind M-6 nothing is announced and the editor stays where it was.
    expect(pageStatus(host)).toBeNull();
    expect(panel(host)).not.toBeNull();
    expect(headings(host)[0]).toBe('Mains');

    await resume(host);
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Main plates saved.');
    expect(headings(host)[0]).toBe('Main plates');
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });

  it('an unknown outcome answered while M-6 is up is held, and its reread is made once when the same manager returns', async () => {
    const host = await open();
    dirtyRename(host);
    const held = h.hold(CATEGORY_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    const reads = h.count(READ);
    held.deliver(failure);
    await h.settle();
    // Nothing of the outcome is shown behind M-6, and nothing is read: the editor still says it is saving.
    expect(text(formNotice(host))).toBe('Saving… Wait for the result. Your draft is kept.');
    expect(h.count(READ)).toBe(reads);

    await resume(host);
    expect(text(formNotice(host)!.querySelector('p'))).toBe(
      'Outcome not confirmed. The menu has been refreshed. Your draft is kept; nothing was sent again.'
    );
    expect(h.count(READ)).toBe(reads + 1);
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });

  it('M-6 that opens during the reread of an unknown outcome holds the finished result with its read: presented once on return, no second read', async () => {
    const host = await open();
    dirtyRename(host);
    h.reply(CATEGORY_UPDATE, failure);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(READ)).toBe(2);
    await goIdle(host);

    reread.deliver(catalog(6, [{ ...MAINS, name: 'Main plates' }, SEASONAL, DRINKS]));
    await h.settle();
    expect(text(formNotice(host))).toBe('Saving… Wait for the result. Your draft is kept.');
    expect(comparison(host)).toBeNull();

    await resume(host);
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmed. The menu has been read again at version 6. It may include this save. Your draft is kept; nothing was sent again. Choose which to keep.'
    );
    expect(text(comparison(host)!.querySelector('#current-values'))).toBe('Current category name: Main plates');
    expect(h.count(READ)).toBe(2);
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });

  it('M-6 that opens during the reread of a stale refusal holds the comparison the same way', async () => {
    const host = await open();
    dirtyRename(host);
    h.reply(CATEGORY_UPDATE, refusal('CATALOG_CHANGED', undefined, 409));
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    reread.deliver(catalog(6, [{ ...MAINS, name: 'Main dishes' }, SEASONAL, DRINKS]));
    await h.settle();
    expect(comparison(host)).toBeNull();
    await resume(host);
    expect(text(comparison(host)!.querySelector('#current-values'))).toBe('Current category name: Main dishes');
    expect(h.count(READ)).toBe(2);
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });

  it('through M-6 as a different manager: the area starts with no editor and no pending command, and the old answer is never announced', async () => {
    const host = await open();
    dirtyRename(host);
    const held = h.hold(CATEGORY_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);

    h.reply(ME, ok(OTHER));
    h.reply(LOGIN, ok(OTHER));
    tap(button(document.body, 'Sign in as a different manager'));
    tap(button(document.body, 'Continue to sign-in'));
    type(field(document.body, 'Username'), 'r.ayu');
    type(field(document.body, 'Password'), PASSWORD);
    tap(button(document.body, 'Sign in'));
    await h.settle();
    expect(host.querySelector('.office-actor')!.textContent).toBe('R. Ayu');
    expect(panel(host)).toBeNull();
    expect([...host.querySelectorAll('input')].some((i) => i.value.includes('Main plates'))).toBe(false);
    expect(pageStatus(host)).toBeNull();
    expect(named(host, 'New category').hasAttribute('aria-disabled')).toBe(false);

    held.deliver(category(6, { ...MAINS, name: 'Main plates' }));
    await h.settle();
    expect(pageStatus(host)).toBeNull();
    expect(panel(host)).toBeNull();
  });

  it('BO-01 closes the decision with its state kept, reopens it on Stay for the same manager, and the draft is as it was', async () => {
    const host = await open();
    dirtyRename(host);
    tap(named(host, 'Cancel'));
    const departure = document.querySelector<HTMLDialogElement>('dialog:has(#departure-stay)')!;
    expect(departure.open).toBe(true);

    await endSession(host);
    expect(departure.open).toBe(false);
    expect(openDialogs()).toHaveLength(0);
    expect(host.querySelector<HTMLElement>('main.bocontent')!.hidden).toBe(true);
    expect(nameField(host)!.value).toBe('Main plates');

    await signInAgain(host);
    expect(departure.open).toBe(true);
    expect(document.activeElement).toBe(stayButton());
    expect(nameField(host)!.value).toBe('Main plates');
    tap(named(departure, 'Stay'));
    expect(document.activeElement).toBe(nameField(host));
  });

  it('BO-01: the editor is hidden with the draft held, and the same manager gets it back with the value and focus, nothing submitted', async () => {
    const host = await open();
    dirtyRename(host);
    await endSession(host);
    expect(panel(host)).not.toBeNull();
    await signInAgain(host);
    expect(nameField(host)!.value).toBe('Main plates');
    expect(document.activeElement).toBe(nameField(host));
    expect(h.count(CATEGORY_UPDATE)).toBe(0);
  });

  it('BO-01: a reorder draft comes back too, with the first enabled move control focused', async () => {
    const host = await open();
    tap(named(host, 'Reorder categories'));
    tap(named(host, 'Move down Mains'));
    await endSession(host);
    await signInAgain(host);
    expect([...host.querySelectorAll('#draft-order .menu-order-name')].map((s) => s.textContent)).toEqual(['1. Drinks', '2. Mains']);
    expect(document.activeElement).toBe(named(host, 'Move down Drinks'));
    expect(h.count(CATEGORY_REORDER)).toBe(0);
  });

  it('BO-01: a different manager’s sign-in destroys the editor and the decision with the key', async () => {
    const host = await open();
    dirtyRename(host);
    tap(named(host, 'Cancel'));
    await endSession(host);
    h.reply(ME, ok(OTHER));
    await signInAgain(host, ok(OTHER), 'r.ayu');
    expect(sessionState(host)).toBe('signed-in');
    expect(openDialogs()).toHaveLength(0);
    expect(panel(host)).toBeNull();
    expect(decision()).toBeNull();
    expect([...document.querySelectorAll('input')].some((i) => i.value.includes('Main plates'))).toBe(false);
  });

  it('an answer that arrives while the decision is open waits for it; Stay then presents it', async () => {
    const host = await open();
    dirtyRename(host);
    const held = h.hold(CATEGORY_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    held.deliver(category(6, { ...MAINS, name: 'Main plates' }));
    await h.settle();
    expect(decision()).not.toBeNull();
    expect(panel(host)).not.toBeNull();
    expect(headings(host)[0]).toBe('Mains');
    tap(named(decision()!, 'Stay'));
    await h.settle();
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Main plates saved.');
  });

  it('Discard during a pending save keeps its answer: the waiting sentence, then the record, silently', async () => {
    const host = await open();
    dirtyRename(host);
    const held = h.hold(CATEGORY_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Waiting for an earlier save to finish. Nothing will be sent again.');
    held.deliver(category(6, { ...MAINS, name: 'Main plates' }));
    await h.settle();
    expect(headings(host)[0]).toBe('Main plates');
    expect(panel(host)).toBeNull();
    expect(pageStatus(host)).toBeNull();
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });
});

describe('an explicit retry of a reread presents through the gates (round 3, F1)', () => {
  const UNREAD = {
    unknown: 'Outcome not confirmed. The menu could not be refreshed. Your draft is kept; nothing was sent again.',
    stale:
      'The menu changed while you were editing. Nothing was saved. Your draft is kept, but the current menu could not be read. Try again to read it before choosing.',
  } as const;
  const PRESENTED = {
    unknown:
      'Outcome not confirmed. The menu has been read again at version 6. It may include this save. Your draft is kept; nothing was sent again. Choose which to keep.',
    stale:
      'The menu changed while you were editing. Nothing was saved. The menu has been read again at version 6. Your draft is kept. Choose which to keep.',
  } as const;

  /** A rename whose outcome needs a reread that failed; Try again is pressed and its read is held. */
  async function retrying(kind: 'unknown' | 'stale') {
    const host = await open();
    dirtyRename(host);
    h.reply(CATEGORY_UPDATE, kind === 'unknown' ? failure : refusal('CATALOG_CHANGED', undefined, 409));
    h.reply(READ, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host)!.querySelector('p'))).toBe(UNREAD[kind]);
    h.reply(READ, catalog(6, [{ ...MAINS, name: 'Main dishes' }, SEASONAL, DRINKS]));
    const retry = h.hold(READ);
    tap(host.querySelector<HTMLElement>('#retry-menu-read')!);
    await h.settle();
    return { host, retry, reads: h.count(READ) };
  }

  it.each(['unknown', 'stale'] as const)('%s: M-6 opening during the retry read holds the result; it is presented once on return, with no new request', async (kind) => {
    const { host, retry, reads } = await retrying(kind);
    await goIdle(host);
    retry.deliver(catalog(6, [{ ...MAINS, name: 'Main dishes' }, SEASONAL, DRINKS]));
    await h.settle();
    expect(text(formNotice(host)!.querySelector('p'))).toBe(UNREAD[kind]);
    expect(comparison(host)).toBeNull();

    await resume(host);
    expect(text(formNotice(host)!.querySelector('p'))).toBe(PRESENTED[kind]);
    expect(text(comparison(host)!.querySelector('#current-values'))).toBe('Current category name: Main dishes');
    expect(h.count(READ)).toBe(reads);
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });

  it.each(['unknown', 'stale'] as const)('%s: the departure decision open during the retry read holds the result; Stay presents it once, with no new request', async (kind) => {
    const { host, retry, reads } = await retrying(kind);
    tap(named(host, 'Cancel'));
    expect(decision()).not.toBeNull();
    retry.deliver(catalog(6, [{ ...MAINS, name: 'Main dishes' }, SEASONAL, DRINKS]));
    await h.settle();
    expect(text(formNotice(host)!.querySelector('p'))).toBe(UNREAD[kind]);
    expect(comparison(host)).toBeNull();

    tap(named(decision()!, 'Stay'));
    expect(text(formNotice(host)!.querySelector('p'))).toBe(PRESENTED[kind]);
    expect(comparison(host)).not.toBeNull();
    expect(document.activeElement).toBe(formNotice(host));
    expect(h.count(READ)).toBe(reads);
    expect(h.count(CATEGORY_UPDATE)).toBe(1);
  });
});

describe('the catalog read on a visit', () => {
  it('rereads on every visit without hiding the rows already held', async () => {
    const host = await open(undefined, '/back-office/menu');
    expect(h.count(READ)).toBe(1);
    tap(named(rail(host), 'Settings'));
    await h.settle();
    tap(named(rail(host), 'Menu'));
    await h.settle();
    expect(h.count(READ)).toBe(2);
    expect(headings(host)).toEqual(['Mains', 'Drinks', 'Seasonal · Archived category']);
  });
});
