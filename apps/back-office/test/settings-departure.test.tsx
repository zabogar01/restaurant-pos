// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DISCARD_BODY, DISCARD_TITLE } from '../src/copy.js';
import { pressEscape, requestClose } from './dialog-shim.js';
import {
  ACTIVITY, LOGIN, LOGOUT, ME, REAUTH, VIEW,
  button, field, noContent, ok, press, refusal, sessionState, text, type,
} from './session-harness.js';
import {
  READ, SAVE, V4, answer, box, fill, form, notice, openSettings, settingsHarness, settingsView, status, withVersion,
} from './settings-support.js';
import { OTHER, dialogNamed, named, openDialogs, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// AC 10. BO-08's unsaved work against the session (PHASE1-S2b): the stay-or-discard decision,
// the rate confirmation as a working-area modal, a command that crosses M-6 or BO-01, the top
// bar's Log out, and the identity of the area. jsdom has no top layer and no inertness, so what
// only a browser shows is e2e/tests/settings.spec.ts.

let h: ReturnType<typeof settingsHarness>;
let view: Awaited<ReturnType<typeof openSettings>> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const PASSWORD = 'correct horse';

const open = async (first?: Parameters<typeof openSettings>[1], path?: string) => {
  h = settingsHarness(path);
  view = await openSettings(h, first);
  return view.host;
};

/** A phone change that has been typed and not saved. */
function dirtyPhone(host: HTMLElement) {
  tap(named(host, 'Change phone'));
  fill(host, 'Phone', '021 555 0000');
}

/** A tax rate change that has been typed and sent to the confirmation. */
function confirming(host: HTMLElement) {
  tap(named(host, 'Change tax rate'));
  fill(host, 'Tax rate', '11');
  tap(named(host, 'Save'));
}

const decision = () => dialogNamed('Discard unsaved changes?');
const confirmation = () => dialogNamed('Save new rates?');
const m6 = () => dialogNamed('Your session timed out')!;
const stayButton = () => document.querySelector<HTMLButtonElement>('#departure-stay')!;
const rail = (host: HTMLElement) => host.querySelector<HTMLElement>('.bonav')!;

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

async function signInAgain(host: HTMLElement, reply = ok(VIEW), username = 'm.iqbal') {
  h.reply(LOGIN, reply);
  type(field(host, 'Username'), username);
  type(field(host, 'Password'), PASSWORD);
  tap(button(host, 'Sign in'));
  await h.settle();
}

describe('the decision before unsaved work is left', () => {
  it('Cancel with a dirty form shows the decision; Stay keeps the draft and returns focus to the field last edited', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'Cancel'));
    const d = decision()!;
    expect(d).not.toBeNull();
    expect(d.getAttribute('closedby')).toBe('none');
    expect(text(d.querySelector('#departure-copy'))).toBe(
      'Your edits have not been saved. Stay to keep editing, or discard them before leaving.'
    );
    expect([...d.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Stay', 'Discard']);
    expect(document.activeElement).toBe(stayButton());

    tap(named(d, 'Stay'));
    expect(decision()).toBeNull();
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    expect(document.activeElement).toBe(box(host, 'Phone'));
    expect(window.location.pathname).toBe('/back-office/settings');
  });

  it('Discard closes the form and returns focus to the Change that opened it', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    expect(decision()).toBeNull();
    expect(form(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Change phone'));
    expect(text(host.querySelector('#settings-view'))).toContain('021 555 0134');
    expect(h.count(SAVE)).toBe(0);
  });

  it('a clean form closes on Cancel and on Escape with no decision', async () => {
    const host = await open();
    tap(named(host, 'Change phone'));
    tap(named(host, 'Cancel'));
    expect(decision()).toBeNull();
    expect(form(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Change phone'));

    tap(named(host, 'Change footer line'));
    pressEscape(box(host, 'Footer line'));
    expect(decision()).toBeNull();
    expect(form(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Change footer line'));
  });

  it('Escape with a dirty form shows the decision, and Escape inside the decision means Stay', async () => {
    const host = await open();
    dirtyPhone(host);
    const escape = pressEscape(box(host, 'Phone'));
    expect(escape.keydown.defaultPrevented).toBe(true);
    const d = decision()!;
    expect(d).not.toBeNull();
    const cancel = requestClose(d);
    expect(cancel.defaultPrevented).toBe(true);
    expect(decision()).toBeNull();
    expect(box(host, 'Phone').value).toBe('021 555 0000');
  });

  it('the rail entry shows the decision; Stay keeps the draft; Discard follows to Tables', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(rail(host), 'Tables'));
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    expect(window.location.pathname).toBe('/back-office/settings');

    tap(named(rail(host), 'Tables'));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/tables');
    expect(host.querySelector('h1')!.textContent).toBe('Tables');
  });

  it('browser Back with a dirty form restores the path and shows the decision; Stay keeps both; Discard follows Back', async () => {
    const host = await open(undefined, '/back-office/');
    tap(named(rail(host), 'Settings'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/settings');
    dirtyPhone(host);

    window.history.pushState(null, '', '/back-office/');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(window.location.pathname).toBe('/back-office/settings');
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(window.location.pathname).toBe('/back-office/settings');
    expect(box(host, 'Phone').value).toBe('021 555 0000');

    act(() => {
      window.history.pushState(null, '', '/back-office/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    tap(named(decision()!, 'Discard'));
    expect(window.location.pathname).toBe('/back-office/');
    expect(host.querySelector('h1')).toBeNull();
  });

  it('a pending save requires the decision even with an unchanged draft, and says leaving sends nothing again', async () => {
    const host = await open();
    tap(named(host, 'Change phone'));
    h.hold(SAVE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    const d = decision()!;
    expect(text(d.querySelector('#departure-copy'))).toBe(
      'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.'
    );
    tap(named(d, 'Stay'));
    expect(document.activeElement).toBe(notice(host));
    expect(text(notice(host))).toContain('Saving…');
  });

  it('an unknown outcome requires the decision with the same sentence, whatever the draft holds', async () => {
    const host = await open();
    tap(named(host, 'Change phone'));
    h.reply(SAVE, failure);
    h.reply(READ, settingsView(V4));
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    expect(text(decision()!.querySelector('#departure-copy'))).toContain('The save may or may not have succeeded.');
  });

  it('Discard during a pending save keeps its answer: the waiting sentence, then the version, silently', async () => {
    const host = await open();
    dirtyPhone(host);
    const held = h.hold(SAVE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    expect(text(status(host))).toBe('Waiting for an earlier save to finish. Nothing will be sent again.');
    held.deliver(answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    await h.settle();
    expect(status(host)).toBeNull();
    expect(text(host.querySelector('#version-facts'))).toContain('Version 5');
    expect(form(host)).toBeNull();
  });

  it('an answer that arrives while the decision is open waits for it; Stay then applies it', async () => {
    const host = await open();
    dirtyPhone(host);
    const held = h.hold(SAVE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    held.deliver(answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    await h.settle();
    expect(decision()).not.toBeNull();
    expect(form(host)).not.toBeNull();
    expect(text(host.querySelector('#version-facts'))).toContain('Version 4');

    tap(named(decision()!, 'Stay'));
    await h.settle();
    expect(form(host)).toBeNull();
    expect(text(status(host))).toBe('Settings saved as version 5. Orders opened from now on use them.');
  });
});

describe('the rate confirmation and the session', () => {
  it('under M-6 it stays open behind it, and the same manager gets it back with Back to editing focused', async () => {
    const host = await open();
    confirming(host);
    const dialog = document.querySelector<HTMLDialogElement>('dialog:has(#confirm-back)')!;
    expect(dialog.open).toBe(true);
    await goIdle(host);
    expect(dialog.open).toBe(true);
    expect(openDialogs()).toHaveLength(2);
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(true);
    expect(m6()).not.toBeNull();

    await resume(host);
    expect(dialog.open).toBe(true);
    expect(openDialogs()).toHaveLength(1);
    expect(h.count(SAVE)).toBe(0);
    // Resuming never sends: the save goes only on the explicit press.
    h.reply(SAVE, answer(withVersion(V4, { version: 5, taxRatePpm: '110000' })));
    tap(named(confirmation()!, 'Save new rates'));
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
  });

  it('is closed at BO-01 with its state kept, and reopened for the same manager without sending', async () => {
    const host = await open();
    confirming(host);
    const dialog = document.querySelector<HTMLDialogElement>('dialog:has(#confirm-back)')!;
    await endSession(host);
    expect(dialog.open).toBe(false);
    expect(openDialogs()).toHaveLength(0);
    expect(host.querySelector<HTMLElement>('main.bocontent')!.hidden).toBe(true);
    expect(box(host, 'Tax rate').value).toBe('11');
    type(field(host, 'Username'), 'm.iqbal');
    expect(field(host, 'Username').value).toBe('m.iqbal');

    await signInAgain(host);
    expect(sessionState(host)).toBe('signed-in');
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(named(dialog, 'Back to editing'));
    expect(h.count(SAVE)).toBe(0);

    h.reply(SAVE, answer(withVersion(V4, { version: 5, taxRatePpm: '110000' })));
    tap(named(dialog, 'Save new rates'));
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
  });

  it('a different manager’s sign-in destroys the form and the confirmation', async () => {
    const host = await open();
    confirming(host);
    await endSession(host);
    h.reply(ME, ok(OTHER));
    await signInAgain(host, ok(OTHER), 'r.ayu');
    expect(sessionState(host)).toBe('signed-in');
    expect(openDialogs()).toHaveLength(0);
    expect(confirmation()).toBeNull();
    expect(form(host)).toBeNull();
    expect(h.count(SAVE)).toBe(0);
  });
});

describe('a command and M-6', () => {
  it('SESSION_IDLE on Save opens M-6 over the form; after the same manager resumes the draft is there and nothing was resent', async () => {
    const host = await open();
    dirtyPhone(host);
    h.reply(SAVE, refusal('SESSION_IDLE'));
    tap(named(host, 'Save'));
    await h.settle();

    expect(sessionState(host)).toBe('idle');
    expect(h.count(SAVE)).toBe(1);
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(true);
    expect(box(host, 'Phone').value).toBe('021 555 0000');

    await resume(host);
    expect(h.count(SAVE)).toBe(1);
    expect(notice(host)).toBeNull();
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    expect(document.activeElement).toBe(box(host, 'Phone'));

    // The manager presses Save again, which is their own act.
    h.reply(SAVE, answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(SAVE)).toBe(2);
    expect(text(status(host))).toContain('version 5');
  });

  it('a command in flight when the session goes idle settles when it answers and is presented after the same manager resumes', async () => {
    const host = await open();
    dirtyPhone(host);
    const held = h.hold(SAVE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);

    held.deliver(answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    await h.settle();
    // Behind M-6 nothing is announced.
    expect(status(host)).toBeNull();
    expect(form(host)).not.toBeNull();

    await resume(host);
    expect(form(host)).toBeNull();
    expect(text(status(host))).toBe('Settings saved as version 5. Orders opened from now on use them.');
    expect(h.count(SAVE)).toBe(1);
  });

  it('through M-6 as a different manager: the area starts with no form, and the old answer is never announced', async () => {
    const host = await open();
    dirtyPhone(host);
    const held = h.hold(SAVE);
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
    expect(sessionState(host)).toBe('signed-in');
    expect(host.querySelector('.office-actor')!.textContent).toBe('R. Ayu');
    expect(form(host)).toBeNull();
    expect([...host.querySelectorAll('input, textarea')].some((i) => (i as HTMLInputElement).value.includes('021 555 0000'))).toBe(false);
    expect(status(host)).toBeNull();
    expect(named(host, 'Change phone').getAttribute('aria-disabled')).toBeNull();
    const focused = document.activeElement;

    held.deliver(answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    await h.settle();
    expect(status(host)).toBeNull();
    expect(form(host)).toBeNull();
    expect(document.activeElement).toBe(focused);
    expect(h.count(SAVE)).toBe(1);
  });
});

describe('a modal dialog in the working area, and BO-01', () => {
  it('closes the decision with its state kept, reopens it for the same manager with focus on Stay, and the draft is as it was', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'Cancel'));
    const departure = document.querySelector<HTMLDialogElement>('dialog:has(#departure-stay)')!;
    expect(departure.open).toBe(true);

    await endSession(host);
    expect(departure.open).toBe(false);
    expect(openDialogs()).toHaveLength(0);
    expect(host.querySelector<HTMLElement>('main.bocontent')!.hidden).toBe(true);
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    type(field(host, 'Username'), 'm.iqbal');
    expect(field(host, 'Username').value).toBe('m.iqbal');

    await signInAgain(host);
    expect(departure.open).toBe(true);
    expect(document.activeElement).toBe(stayButton());
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    tap(named(departure, 'Stay'));
    expect(document.activeElement).toBe(box(host, 'Phone'));
  });

  it('the form comes back for the same manager with the unsaved value focused, and nothing was sent', async () => {
    const host = await open();
    dirtyPhone(host);
    await endSession(host);
    await signInAgain(host);
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    expect(document.activeElement).toBe(box(host, 'Phone'));
    expect(h.count(SAVE)).toBe(0);
  });

  it('a different manager’s sign-in destroys the form and the decision with the key', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'Cancel'));
    await endSession(host);
    h.reply(ME, ok(OTHER));
    await signInAgain(host, ok(OTHER), 'r.ayu');
    expect(openDialogs()).toHaveLength(0);
    expect(form(host)).toBeNull();
    expect(decision()).toBeNull();
    expect([...document.querySelectorAll('input, textarea')].some((i) => (i as HTMLInputElement).value.includes('021 555 0000'))).toBe(false);
  });

  it('under M-6 the decision stays open behind it', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'Cancel'));
    await goIdle(host);
    expect(openDialogs()).toHaveLength(2);
    expect(document.querySelector<HTMLDialogElement>('dialog:has(#departure-stay)')!.open).toBe(true);
    await resume(host);
    expect(openDialogs()).toHaveLength(1);
    expect(decision()).not.toBeNull();
  });
});

describe('the top bar’s Log out', () => {
  const logoutConfirmation = () => dialogNamed(DISCARD_TITLE);

  it('with no unsaved work, logs out at once', async () => {
    const host = await open();
    h.reply(LOGOUT, noContent);
    tap(named(host, 'Log out'));
    await h.settle();
    expect(h.count(LOGOUT)).toBe(1);
    expect(openDialogs()).toHaveLength(0);
  });

  it('with a dirty form, opens the built confirmation; Keep this draft returns to the field', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'Log out'));
    await h.settle();
    const d = logoutConfirmation()!;
    expect(text(d.querySelector('#bar-logout-description'))).toBe(DISCARD_BODY);
    expect(d.querySelector('#bar-logout-uncertain')).toBeNull();
    expect(h.count(LOGOUT)).toBe(0);
    tap(named(d, 'Keep this draft'));
    expect(logoutConfirmation()).toBeNull();
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    expect(document.activeElement).toBe(box(host, 'Phone'));
  });

  it('adds the separate paragraph while a save is pending, even with an unchanged draft', async () => {
    const host = await open();
    tap(named(host, 'Change phone'));
    h.hold(SAVE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Log out'));
    expect(text(logoutConfirmation()!.querySelector('#bar-logout-uncertain'))).toBe(
      'The save may or may not have succeeded. Leaving does not send it again.'
    );
  });

  it('is closed at BO-01 and not reopened for the same manager, who gets the draft back', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'Log out'));
    const d = logoutConfirmation()!;
    await endSession(host);
    expect(d.open).toBe(false);
    await signInAgain(host);
    expect(openDialogs()).toHaveLength(0);
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    expect(h.count(LOGOUT)).toBe(0);
  });
});

describe('the settings read is not interactive', () => {
  it('opening BO-08 sends the settings read and no activity', async () => {
    const host = await open();
    expect(host.querySelector('h1')).not.toBeNull();
    expect(h.count(ACTIVITY)).toBe(0);
    expect(h.count(READ)).toBe(1);
  });
});
