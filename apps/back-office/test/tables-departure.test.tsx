// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DISCARD_BODY, DISCARD_TITLE } from '../src/copy.js';
import { pressEscape, requestClose } from './dialog-shim.js';
import {
  ACTIVITY, LOGIN, LOGOUT, ME, REAUTH, VIEW,
  button, field, mount, noContent, ok, press, refusal, sessionState, text, type,
} from './session-harness.js';
import {
  CREATE, DEACTIVATE, LIST, OTHER, T1, UPDATE,
  dialogNamed, formNotice, harness, labelField, named, openDialogs, openScreens, pageStatus, panel, panelName,
  rowLabels, table, tap, typeInto,
} from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-05's unsaved work against the session (PHASE1-S1b): the stay-or-discard decision, a
// command that crosses M-6 or BO-01, the working-area dialog rule, the top bar's Log out,
// and the identity of the area. jsdom has no top layer and no inertness, so what only a
// browser shows is e2e/tests/tables.spec.ts.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const PASSWORD = 'correct horse';

const open = async (first?: Parameters<typeof openScreens>[1], path?: string) => {
  h = harness(path);
  view = await openScreens(h, first);
  return view.host;
};

/** An edit of Table 1 whose label has been changed and not saved. */
function dirtyEdit(host: HTMLElement) {
  tap(named(host, 'Edit Table 1 — active'));
  typeInto(labelField(host)!, 'Window 1');
}

const decision = () => dialogNamed('Discard unsaved changes?');
const m6 = () => dialogNamed('Your session timed out')!;
const stayButton = () => document.querySelector<HTMLButtonElement>('#departure-stay')!;

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

describe('AC 9. the decision before unsaved work is left', () => {
  it('Cancel with a dirty form shows the decision; Stay keeps the draft, the path and focus on the label', async () => {
    const host = await open();
    dirtyEdit(host);
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
    expect(panelName(host)).toBe('Edit Table 1');
    expect(labelField(host)!.value).toBe('Window 1');
    expect(document.activeElement).toBe(labelField(host));
    expect(window.location.pathname).toBe('/back-office/tables');
  });

  it('Discard closes the form once and returns focus to its opener', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Edit Table 1 — active'));
    expect(rowLabels(host)[0]).toBe('Table 1');
    expect(h.count(UPDATE)).toBe(0);
  });

  it('a clean form closes on Cancel and on Escape with no decision', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    tap(named(host, 'Cancel'));
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Edit Table 1 — active'));

    tap(named(host, 'New table'));
    pressEscape(labelField(host)!);
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'New table'));
  });

  it('Escape with a dirty form shows the decision, and Escape inside the decision means Stay', async () => {
    const host = await open();
    dirtyEdit(host);
    const escape = pressEscape(labelField(host)!);
    expect(escape.keydown.defaultPrevented).toBe(true);
    const d = decision()!;
    expect(d).not.toBeNull();

    const cancel = requestClose(d);
    expect(cancel.defaultPrevented).toBe(true);
    expect(decision()).toBeNull();
    expect(labelField(host)!.value).toBe('Window 1');
    expect(document.activeElement).toBe(labelField(host));
  });

  it('the rail entry shows the decision; Discard closes the form and the path is the Tables path', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host.querySelector<HTMLElement>('.bonav')!, 'Tables'));
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(labelField(host)!.value).toBe('Window 1');

    tap(named(host.querySelector<HTMLElement>('.bonav')!, 'Tables'));
    tap(named(decision()!, 'Discard'));
    expect(panel(host)).toBeNull();
    expect(window.location.pathname).toBe('/back-office/tables');
  });

  it('browser Back with a dirty form restores the path and shows the decision; Stay keeps both; Discard follows Back', async () => {
    const host = await open(undefined, '/back-office/');
    tap(named(host.querySelector<HTMLElement>('.bonav')!, 'Tables'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/tables');
    dirtyEdit(host);

    window.history.pushState(null, '', '/back-office/');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(window.location.pathname).toBe('/back-office/tables');
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(window.location.pathname).toBe('/back-office/tables');
    expect(labelField(host)!.value).toBe('Window 1');

    act(() => {
      window.history.pushState(null, '', '/back-office/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    tap(named(decision()!, 'Discard'));
    expect(window.location.pathname).toBe('/back-office/');
    expect(host.querySelector('h1')).toBeNull();
  });

  it('browser Back with a clean form leaves without asking', async () => {
    const host = await open(undefined, '/back-office/');
    tap(named(host.querySelector<HTMLElement>('.bonav')!, 'Tables'));
    await h.settle();
    act(() => {
      window.history.pushState(null, '', '/back-office/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(decision()).toBeNull();
    expect(host.querySelector('h1')).toBeNull();
  });

  it('a pending save requires the decision even with an unchanged draft, and says leaving sends nothing again', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    h.hold(UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    const d = decision()!;
    expect(text(d.querySelector('#departure-copy'))).toBe(
      'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.'
    );
    tap(named(d, 'Stay'));
    expect(document.activeElement).toBe(formNotice(host));
    expect(text(formNotice(host))).toContain('Saving…');
  });

  it('Discard during a pending save keeps its answer: the waiting sentence, then the record, silently', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    typeInto(labelField(host)!, 'Window 1');
    const held = h.hold(UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Waiting for an earlier save to finish. Nothing will be sent again.');
    // The inert opener may take focus, and does not start another command.
    expect(document.activeElement).toBe(named(host, 'Edit Table 1 — active'));
    expect(named(host, 'Edit Table 1 — active').getAttribute('aria-disabled')).toBe('true');
    tap(named(host, 'New table'));
    expect(panel(host)).toBeNull();

    held.deliver(table({ ...T1, label: 'Window 1' }));
    await h.settle();
    expect(rowLabels(host)).toContain('Window 1');
    // Silent: no form, no announcement, no move of focus, and the waiting sentence is gone.
    expect(panel(host)).toBeNull();
    expect(pageStatus(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Edit Window 1 — active'));
    expect(h.count(UPDATE)).toBe(1);
  });

  it('an answer that arrives while the decision is open waits for it; Stay then applies it', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    typeInto(labelField(host)!, 'Window 1');
    const held = h.hold(UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    held.deliver(table({ ...T1, label: 'Window 1' }));
    await h.settle();
    // Nothing has chosen for the manager.
    expect(decision()).not.toBeNull();
    expect(panel(host)).not.toBeNull();
    expect(rowLabels(host)).not.toContain('Window 1');

    tap(named(decision()!, 'Stay'));
    await h.settle();
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Window 1 saved.');
    expect(rowLabels(host)).toContain('Window 1');
  });

  it('a status command has no draft: navigation stays live with no decision', async () => {
    const host = await open(undefined, '/back-office/');
    tap(named(host.querySelector<HTMLElement>('.bonav')!, 'Tables'));
    await h.settle();
    h.hold(DEACTIVATE);
    tap(named(host, 'Deactivate Table 1'));
    await h.settle();
    act(() => {
      window.history.pushState(null, '', '/back-office/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(decision()).toBeNull();
    expect(host.querySelector('h1')).toBeNull();
    expect(window.location.pathname).toBe('/back-office/');
  });
});

describe('AC 8. a command and M-6', () => {
  it('SESSION_IDLE on Save opens M-6 over the form; after the same manager resumes the draft is there and nothing was resent', async () => {
    const host = await open();
    dirtyEdit(host);
    h.reply(CREATE, refusal('SESSION_IDLE'));
    h.reply(UPDATE, refusal('SESSION_IDLE'));
    tap(named(host, 'Save'));
    await h.settle();

    expect(sessionState(host)).toBe('idle');
    expect(h.count(UPDATE)).toBe(1);
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(true);
    expect(panel(host)).not.toBeNull();
    expect(labelField(host)!.value).toBe('Window 1');

    await resume(host);
    expect(h.count(UPDATE)).toBe(1);
    expect(panelName(host)).toBe('Edit Table 1');
    expect(labelField(host)!.value).toBe('Window 1');
    expect(formNotice(host)).toBeNull();
    // The manager presses Save again, which is their own act.
    h.reply(UPDATE, table({ ...T1, label: 'Window 1' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(UPDATE)).toBe(2);
    expect(rowLabels(host)).toContain('Window 1');
  });

  it('a status command refused SESSION_IDLE says it was not changed once the same manager resumes', async () => {
    const host = await open();
    h.reply(DEACTIVATE, refusal('SESSION_IDLE'));
    tap(named(host, 'Deactivate Table 1'));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    await resume(host);
    expect(text(pageStatus(host))).toBe('Table 1 was not changed. Use its row action to try again.');
    expect(h.count(DEACTIVATE)).toBe(1);
    expect(named(host, 'Deactivate Table 1').hasAttribute('aria-disabled')).toBe(false);
  });

  it('a command in flight when the session goes idle settles when it answers, and is presented after the same manager resumes', async () => {
    const host = await open();
    dirtyEdit(host);
    const held = h.hold(UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);

    held.deliver(table({ ...T1, label: 'Window 1' }));
    await h.settle();
    // Behind M-6 nothing is announced.
    expect(pageStatus(host)).toBeNull();
    expect(panel(host)).not.toBeNull();

    await resume(host);
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Window 1 saved.');
    expect(rowLabels(host)).toContain('Window 1');
    expect(h.count(UPDATE)).toBe(1);
  });

  it('through M-6 as a different manager: the area starts with no pending command, and the old answer is never announced', async () => {
    const host = await open();
    dirtyEdit(host);
    const held = h.hold(UPDATE);
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

    // A new area: no form, no input holding the old value, no pending command.
    expect(panel(host)).toBeNull();
    expect([...host.querySelectorAll('input')].some((i) => i.value.includes('Window 1'))).toBe(false);
    expect(pageStatus(host)).toBeNull();
    expect(named(host, 'New table').hasAttribute('aria-disabled')).toBe(false);
    expect(named(host, 'Deactivate Table 2').hasAttribute('aria-disabled')).toBe(false);
    const focused = document.activeElement;

    held.deliver(table({ ...T1, label: 'Window 1' }));
    await h.settle();
    expect(pageStatus(host)).toBeNull();
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(focused);
    expect(h.count(UPDATE)).toBe(1);
  });
});

describe('AC 10. a modal dialog in the working area, and BO-01', () => {
  it('closes the decision with its state kept, reopens it on Stay for the same manager, and the draft is as it was', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host, 'Cancel'));
    expect(openDialogs()).toHaveLength(1);
    const departure = document.querySelector<HTMLDialogElement>('dialog:has(#departure-stay)')!;
    expect(departure.open).toBe(true);

    await endSession(host);
    // Closed, and not as a choice: the form is still there, hidden, with its draft.
    expect(departure.open).toBe(false);
    expect(openDialogs()).toHaveLength(0);
    expect(host.querySelector<HTMLElement>('main.bocontent')!.hidden).toBe(true);
    expect(labelField(host)!.value).toBe('Window 1');
    expect(panel(host)).not.toBeNull();
    // BO-01's fields accept typing: nothing modal is left over them.
    type(field(host, 'Username'), 'm.iqbal');
    expect(field(host, 'Username').value).toBe('m.iqbal');

    await signInAgain(host);
    expect(sessionState(host)).toBe('signed-in');
    expect(departure.open).toBe(true);
    expect(document.activeElement).toBe(stayButton());
    expect(labelField(host)!.value).toBe('Window 1');
    expect(host.querySelector<HTMLElement>('main.bocontent')!.hidden).toBe(false);

    tap(named(departure, 'Stay'));
    expect(document.activeElement).toBe(labelField(host));
  });

  it('the panel comes back for the same manager with the unsaved value focused', async () => {
    const host = await open();
    dirtyEdit(host);
    await endSession(host);
    expect(panel(host)).not.toBeNull();
    await signInAgain(host);
    expect(labelField(host)!.value).toBe('Window 1');
    expect(document.activeElement).toBe(labelField(host));
    expect(h.count(UPDATE)).toBe(0);
  });

  it('a different manager’s sign-in destroys the form and the decision with the key', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host, 'Cancel'));
    await endSession(host);

    h.reply(ME, ok(OTHER));
    await signInAgain(host, ok(OTHER), 'r.ayu');
    expect(sessionState(host)).toBe('signed-in');
    expect(openDialogs()).toHaveLength(0);
    expect(panel(host)).toBeNull();
    expect(document.querySelector('#departure-stay')).not.toBeNull();
    expect(decision()).toBeNull();
    expect([...document.querySelectorAll('input')].some((i) => i.value.includes('Window 1'))).toBe(false);
    expect(rowLabels(host)).toEqual(['Table 1', 'Table 2', 'Terrace 1']);
  });

  it('under M-6 the decision stays open behind it', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host, 'Cancel'));
    await goIdle(host);
    expect(openDialogs()).toHaveLength(2);
    expect(document.querySelector<HTMLDialogElement>('dialog:has(#departure-stay)')!.open).toBe(true);
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(true);
    await resume(host);
    expect(openDialogs()).toHaveLength(1);
    expect(decision()).not.toBeNull();
  });
});

describe('ruling 4. the top bar’s Log out', () => {
  const confirmation = () => dialogNamed(DISCARD_TITLE);

  it('with no unsaved work, logs out at once with no confirmation', async () => {
    const host = await open();
    h.reply(LOGOUT, noContent);
    tap(named(host, 'Log out'));
    await h.settle();
    expect(h.count(LOGOUT)).toBe(1);
    expect(openDialogs()).toHaveLength(0);
    expect(sessionState(host)).toBe('signed-out');
  });

  it('with a dirty form, opens the built confirmation with the same constants', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host, 'Log out'));
    await h.settle();
    const d = confirmation()!;
    expect(d).not.toBeNull();
    expect(text(d.querySelector('#bar-logout-description'))).toBe(DISCARD_BODY);
    expect(d.querySelector('#bar-logout-uncertain')).toBeNull();
    expect([...d.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Keep this draft',
      'Discard changes and log out',
    ]);
    expect(document.activeElement).toBe(d.querySelector('button'));
    expect(h.count(LOGOUT)).toBe(0);
  });

  it('Keep this draft returns to the form with the draft intact', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host, 'Log out'));
    tap(named(confirmation()!, 'Keep this draft'));
    expect(confirmation()).toBeNull();
    expect(labelField(host)!.value).toBe('Window 1');
    expect(document.activeElement).toBe(labelField(host));
    expect(h.count(LOGOUT)).toBe(0);
    expect(sessionState(host)).toBe('signed-in');
  });

  it('Escape in the confirmation is Keep this draft', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host, 'Log out'));
    const cancel = requestClose(confirmation()!);
    expect(cancel.defaultPrevented).toBe(true);
    expect(confirmation()).toBeNull();
    expect(labelField(host)!.value).toBe('Window 1');
  });

  it('Discard changes and log out logs out as the existing flow does', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host, 'Log out'));
    h.reply(LOGOUT, noContent);
    tap(named(confirmation()!, 'Discard changes and log out'));
    await h.settle();
    expect(h.count(LOGOUT)).toBe(1);
    expect(sessionState(host)).toBe('signed-out');
    expect(host.querySelector('.office-work')).toBeNull();
  });

  it('adds the separate paragraph while a save is pending, even with an unchanged draft', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    h.hold(UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Log out'));
    const d = confirmation()!;
    expect(text(d.querySelector('#bar-logout-description'))).toBe(DISCARD_BODY);
    expect(text(d.querySelector('#bar-logout-uncertain'))).toBe(
      'The save may or may not have succeeded. Leaving does not send it again.'
    );
    expect(d.getAttribute('aria-describedby')).toBe('bar-logout-description bar-logout-uncertain');
  });

  it('adds the paragraph after an unknown outcome as well', async () => {
    const host = await open();
    dirtyEdit(host);
    h.reply(UPDATE, failure);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Log out'));
    expect(confirmation()!.querySelector('#bar-logout-uncertain')).not.toBeNull();
  });

  it('holds an answer that arrives behind it; Keep this draft then applies it', async () => {
    const host = await open();
    dirtyEdit(host);
    const held = h.hold(UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Log out'));
    held.deliver(table({ ...T1, label: 'Window 1' }));
    await h.settle();
    expect(panel(host)).not.toBeNull();
    tap(named(confirmation()!, 'Keep this draft'));
    await h.settle();
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Window 1 saved.');
  });

  it('is closed at BO-01 and not reopened for the same manager, who gets the draft back', async () => {
    const host = await open();
    dirtyEdit(host);
    tap(named(host, 'Log out'));
    const d = confirmation()!;
    await endSession(host);
    expect(d.open).toBe(false);
    expect(openDialogs()).toHaveLength(0);
    await signInAgain(host);
    expect(openDialogs()).toHaveLength(0);
    expect(labelField(host)!.value).toBe('Window 1');
    expect(h.count(LOGOUT)).toBe(0);
  });

  it('M-6’s own confirmation gains the paragraph under the same condition, and is otherwise unchanged', async () => {
    const host = await open();
    dirtyEdit(host);
    h.hold(UPDATE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    tap(button(m6(), 'Log out'));
    const d = dialogNamed(DISCARD_TITLE)!;
    expect(text(d.querySelector('#logout-description'))).toBe(DISCARD_BODY);
    expect(text(d.querySelector('#logout-uncertain'))).toBe(
      'The save may or may not have succeeded. Leaving does not send it again.'
    );
    expect(d.getAttribute('aria-describedby')).toBe('logout-description logout-uncertain');
    expect([...d.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Keep this draft',
      'Discard changes and log out',
    ]);
  });

  it('M-6’s confirmation has no extra paragraph when nothing is pending or unknown', async () => {
    const host = await open();
    dirtyEdit(host);
    await goIdle(host);
    tap(button(m6(), 'Log out'));
    const d = dialogNamed(DISCARD_TITLE)!;
    expect(d.querySelector('#logout-uncertain')).toBeNull();
    expect(d.getAttribute('aria-describedby')).toBe('logout-description');
  });
});

describe('the list read is not interactive', () => {
  it('opening BO-05 sends the list read and no activity', async () => {
    const host = await open();
    expect(host.querySelector('h1')).not.toBeNull();
    expect(h.count(ACTIVITY)).toBe(0);
    expect(h.count(LIST)).toBe(1);
  });
});
