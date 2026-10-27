// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { pressEscape } from './dialog-shim.js';
import {
  ACTIVITY, LOGIN, ME, REAUTH, VIEW,
  button, field, mount, ok, press as pressSession, refusal, sessionState, text, type,
} from './session-harness.js';
import { BURGER, CATEGORY_UPDATE, ITEM_10, aria, catalog, harness, itemRow, pageStatus, rail, rowText } from './menu-support.js';
import {
  ITEM_CREATE, ITEM_UPDATE, READ, editFrom, itemAnswer, named, nameInput, newIn, notice, noticeText, openMenuWith,
  priceInput, q, tap, title,
} from './item-support.js';
import { OTHER, dialogNamed, openDialogs, typeInto } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-04's unsaved work against the session (PHASE1-S4c2a rulings 10 and 18): the stay-or-discard
// decision from every way out, a save outstanding across BO-03 and BO-04, a result that crosses
// M-6 or BO-01, and the identity of the area. jsdom has no top layer and no inertness, so what
// only a browser shows is e2e/tests/item-editor.spec.ts.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const PASSWORD = 'correct horse';
const ORDINARY = 'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
const UNCERTAIN =
  'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.';
const WAITING = 'Waiting for an earlier save to finish. Nothing will be sent again.';

const open = async (...reads: Parameters<typeof openMenuWith>[1][]) => {
  h = harness();
  view = await openMenuWith(h, ...reads);
  return view.host;
};

/** Burger opened for editing with its name changed and not saved. */
async function dirty(host: HTMLElement) {
  await editFrom(h, host, 'Burger');
  typeInto(nameInput(host), 'Burger two');
}

const decision = () => dialogNamed('Discard unsaved changes?');
const body = () => text(document.querySelector('#departure-copy'));
const focused = () => document.activeElement;
const m6 = () => dialogNamed('Your session timed out')!;

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

async function endSession(host: HTMLElement) {
  h.reply(ACTIVITY, refusal('UNAUTHENTICATED'));
  pressSession();
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

const back = () =>
  act(() => {
    window.history.pushState(null, '', '/back-office/menu');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

describe('AC 16. the decision from every way out', () => {
  it('Cancel, Escape, the rail, browser Back and Log out each meet the decision; Stay keeps the draft and the path', async () => {
    const host = await open();
    await dirty(host);
    for (const [what, leave] of [
      ['Cancel', () => tap(named(host, 'Cancel'))],
      ['Escape', () => pressEscape(nameInput(host))],
      ['the rail', () => tap(named(rail(host), 'Tables'))],
      ['browser Back', back],
    ] as const) {
      leave();
      expect(decision(), what).not.toBeNull();
      expect(body(), what).toBe(ORDINARY);
      tap(named(decision()!, 'Stay'));
      expect(window.location.pathname, what).toBe('/back-office/menu/item');
      expect(nameInput(host).value, what).toBe('Burger two');
      expect(focused(), what).toBe(nameInput(host));
    }
    tap(button(host, 'Log out'));
    const logout = dialogNamed('Log out and discard your changes?')!;
    expect(logout).not.toBeNull();
    tap(button(logout, 'Keep this draft'));
    expect(sessionState(host)).toBe('signed-in');
    expect(nameInput(host).value).toBe('Burger two');
    expect(h.count(ITEM_UPDATE)).toBe(0);
  });

  it('Escape inside the decision means Stay', async () => {
    const host = await open();
    await dirty(host);
    tap(named(host, 'Cancel'));
    expect(focused()).toBe(document.querySelector('#departure-stay'));
    const decisionDialog = decision()!;
    act(() => {
      decisionDialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    expect(decision()).toBeNull();
    expect(nameInput(host).value).toBe('Burger two');
    expect(focused()).toBe(nameInput(host));
  });

  it('Discard from the rail leaves, clears the subject, and the way back shows the no-subject sentence', async () => {
    const host = await open();
    await dirty(host);
    tap(named(rail(host), 'Tables'));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/tables');
    expect(h.count(ITEM_UPDATE)).toBe(0);
    act(() => {
      window.history.pushState(null, '', '/back-office/menu/item');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await h.settle();
    expect(q(host, '#item-context')!.textContent).toBe('Choose an item on Menu to edit it.');
    expect(q(host, '#item-form')).toBeNull();
  });

  it('a clean form leaves by every way with no decision', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    pressEscape(document.activeElement as Element);
    await h.settle();
    expect(decision()).toBeNull();
    expect(window.location.pathname).toBe('/back-office/menu');
    await editFrom(h, host, 'Burger');
    tap(named(rail(host), 'Tables'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/tables');
    expect(decision()).toBeNull();
  });

  it('a dirty BO-03 editor meets the decision once when Edit is pressed, and BO-04 arrives without asking again', async () => {
    const host = await open();
    tap(named(host, 'Rename category Mains'));
    typeInto(host.querySelector<HTMLInputElement>('#menu-name')!, 'Main plates');
    tap(named(host, 'Edit Burger'));
    expect(decision()).not.toBeNull();
    expect(window.location.pathname).toBe('/back-office/menu');
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(decision()).toBeNull();
    expect(window.location.pathname).toBe('/back-office/menu/item');
    expect(title(host)).toBe('Burger');
    expect(h.count(CATEGORY_UPDATE)).toBe(0);
  });

  it('a pending save requires the decision even with an unchanged draft, with the uncertain body', async () => {
    const host = await open();
    await editFrom(h, host, 'Burger');
    h.reply(ITEM_UPDATE, itemAnswer(5, BURGER));
    h.hold(ITEM_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    expect(decision()).not.toBeNull();
    expect(body()).toBe(UNCERTAIN);
    tap(named(decision()!, 'Stay'));
    expect(focused()).toBe(notice(host));
  });
});

describe('AC 15. one command across BO-03 and BO-04', () => {
  /** A save of Item 10’s name left outstanding by Discard; its read of Menu on arrival is held. */
  async function leftBehind(host: HTMLElement) {
    await editFrom(h, host, 'Item 10');
    typeInto(nameInput(host), 'Ten');
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...ITEM_10, name: 'Ten' }));
    const save = h.hold(ITEM_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    const visit = h.hold(READ);
    tap(named(host, 'Cancel'));
    expect(body()).toBe(UNCERTAIN);
    tap(named(decision()!, 'Discard'));
    await h.settle();
    return { save, visit };
  }

  it('Discard lands on BO-03 with the waiting status and every opener inert; a press sends nothing', async () => {
    const host = await open();
    const { save } = await leftBehind(host);
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(text(pageStatus(host))).toBe(WAITING);
    for (const name of ['Edit Burger', 'New item in Mains', 'New category', 'Rename category Mains', 'Archive item Burger', 'Reorder categories']) {
      expect(aria(named(host, name)), name).toBe(true);
      tap(named(host, name));
    }
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(document.querySelector('[role="dialog"][aria-modal="false"]')).toBeNull();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    save.deliver(itemAnswer(6, { ...ITEM_10, name: 'Ten' }));
    await h.settle();
  });

  it('the ok answer then lands in the list silently: no result, no focus move, the status clears and the openers return', async () => {
    const host = await open();
    const { save, visit } = await leftBehind(host);
    const before = document.activeElement;
    save.deliver(itemAnswer(6, { ...ITEM_10, name: 'Ten' }));
    await h.settle();
    expect(text(pageStatus(host))).toBe('');
    expect(pageStatus(host)).toBeNull();
    expect(rowText(itemRow(host, ITEM_10.itemId))).toContain('Ten');
    expect(document.activeElement).toBe(before);
    expect(aria(named(host, 'Edit Burger'))).toBe(false);
    expect(h.count(ITEM_UPDATE)).toBe(1);
    // The visit read began before the answer: when it lands without the change, the item stays.
    visit.deliver(catalog(5));
    await h.settle();
    expect(rowText(itemRow(host, ITEM_10.itemId))).toContain('Ten');
  });

  it('an unknown answer clears the status, presents nothing, and Menu rereads once', async () => {
    const host = await open();
    const { save, visit } = await leftBehind(host);
    visit.deliver(catalog(5));
    await h.settle();
    const reads = h.count(READ);
    save.deliver(failure);
    await h.settle();
    expect(pageStatus(host)).toBeNull();
    expect(h.count(READ)).toBe(reads + 1);
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(aria(named(host, 'Edit Burger'))).toBe(false);
  });

  it('a refusal clears the status and presents nothing', async () => {
    const host = await open();
    const { save } = await leftBehind(host);
    save.deliver(refusal('CATALOG_CHANGED', undefined, 409));
    await h.settle();
    expect(pageStatus(host)).toBeNull();
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(aria(named(host, 'Edit Burger'))).toBe(false);
  });

  it('a create left behind lands in its category when it answers', async () => {
    const host = await open();
    await newIn(h, host, 'Mains');
    typeInto(nameInput(host), 'Fries');
    typeInto(priceInput(host), '12.500');
    h.reply(ITEM_CREATE, itemAnswer(6, { ...ITEM_10, itemId: '00000000-0000-4000-8000-000000000199', name: 'Fries' }));
    const created = h.hold(ITEM_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    created.deliver(itemAnswer(6, { ...ITEM_10, itemId: '00000000-0000-4000-8000-000000000199', name: 'Fries' }));
    await h.settle();
    expect(host.textContent).toContain('Fries');
    expect(pageStatus(host)).toBeNull();
  });
});

describe('AC 16. M-6 and BO-01', () => {
  it('SESSION_IDLE on Save opens M-6 over BO-04; the same manager resumes to the draft, nothing resent, the notice says so', async () => {
    const host = await open();
    await dirty(host);
    h.reply(ITEM_UPDATE, refusal('SESSION_IDLE'));
    tap(named(host, 'Save'));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(true);
    expect(nameInput(host).value).toBe('Burger two');
    expect(m6()).not.toBeNull();
    await resume(host);
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(nameInput(host).value).toBe('Burger two');
    expect(noticeText(host)).toBe('Nothing was savedYour draft is kept. Press Save to try again.');
    expect(focused()).toBe(nameInput(host));
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...BURGER, name: 'Burger two' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(2);
  });

  it('an answer arriving while M-6 is up is held, not presented, and presented once on return', async () => {
    const host = await open();
    await dirty(host);
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...BURGER, name: 'Burger two' }));
    const held = h.hold(ITEM_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    held.deliver(itemAnswer(6, { ...BURGER, name: 'Burger two' }));
    await h.settle();
    // Behind M-6 nothing is announced and BO-04 stays where it was.
    expect(window.location.pathname).toBe('/back-office/menu/item');
    expect(noticeText(host)).toBe('Saving…Wait for the result. Your draft is kept.');
    await resume(host);
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(text(pageStatus(host))).toBe('Burger two saved.');
    expect(h.count(ITEM_UPDATE)).toBe(1);
  });

  it('an unknown outcome answered while M-6 is up is held, and its reread is made once when the same manager returns', async () => {
    const host = await open();
    await dirty(host);
    h.reply(ITEM_UPDATE, failure);
    const held = h.hold(ITEM_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    const reads = h.count(READ);
    held.deliver(failure);
    await h.settle();
    expect(noticeText(host)).toBe('Saving…Wait for the result. Your draft is kept.');
    expect(h.count(READ)).toBe(reads);
    await resume(host);
    expect(noticeText(host)).toBe('Outcome not confirmedThe menu has been refreshed. Your draft is kept; nothing was sent again.');
    expect(h.count(READ)).toBe(reads + 1);
    expect(h.count(ITEM_UPDATE)).toBe(1);
  });

  it('BO-01 hides BO-04 with the draft held, and the same manager gets it back with the value and the field last edited focused, nothing submitted', async () => {
    const host = await open();
    await dirty(host);
    typeInto(priceInput(host), '60.000');
    priceInput(host).focus();
    await endSession(host);
    expect(host.querySelector<HTMLElement>('main.bocontent')!.hidden).toBe(true);
    await signInAgain(host);
    expect(nameInput(host).value).toBe('Burger two');
    expect(priceInput(host).value).toBe('60.000');
    expect(focused()).toBe(priceInput(host));
    expect(h.count(ITEM_UPDATE)).toBe(0);
  });

  it('BO-01 closes the decision with its state kept, and reopens it on Stay for the same manager', async () => {
    const host = await open();
    await dirty(host);
    tap(named(host, 'Cancel'));
    const departure = document.querySelector<HTMLDialogElement>('dialog:has(#departure-stay)')!;
    expect(departure.open).toBe(true);
    await endSession(host);
    expect(departure.open).toBe(false);
    await signInAgain(host);
    expect(departure.open).toBe(true);
    expect(focused()).toBe(document.querySelector('#departure-stay'));
    tap(named(departure, 'Stay'));
    expect(focused()).toBe(nameInput(host));
  });

  it('a different manager’s sign-in destroys the draft and the subject: BO-04 shows the no-subject sentence and nothing is announced', async () => {
    const host = await open();
    await dirty(host);
    h.reply(ITEM_UPDATE, itemAnswer(6, { ...BURGER, name: 'Burger two' }));
    const held = h.hold(ITEM_UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    await endSession(host);
    h.reply(ME, ok(OTHER));
    await signInAgain(host, ok(OTHER), 'r.ayu');
    expect(sessionState(host)).toBe('signed-in');
    expect(openDialogs()).toHaveLength(0);
    expect(q(host, '#item-form')).toBeNull();
    expect(q(host, '#item-context')!.textContent).toBe('Choose an item on Menu to edit it.');
    expect([...document.querySelectorAll('input')].some((i) => i.value.includes('Burger two'))).toBe(false);
    held.deliver(itemAnswer(6, { ...BURGER, name: 'Burger two' }));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/menu/item');
    expect(q(host, '#item-context')!.textContent).toBe('Choose an item on Menu to edit it.');
  });
});
