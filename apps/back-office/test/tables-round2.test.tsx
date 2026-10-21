// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DISCARD_TITLE } from '../src/copy.js';
import { workGuard } from '../src/work/guard.js';
import {
  ACTIVITY, LOGIN, ME, VIEW,
  button, field, mount, ok, press, refusal, sessionState, text, type,
} from './session-harness.js';
import {
  CREATE, LIST, OTHER, T1, T2, T3, UPDATE,
  dialogNamed, formNotice, harness, labelField, named, openDialogs, openScreens, pageStatus, panel, rowLabels,
  table, tables, tap, typeInto,
} from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Round 2 of PHASE1-S1b: the review's four findings, each the review's own scenario.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const DUPLICATE = refusal('DUPLICATE', undefined, 409);
const open = async (path?: string) => {
  h = harness(path);
  view = await openScreens(h);
  return view.host;
};
const rail = (host: HTMLElement) => host.querySelector<HTMLElement>('.bonav')!;
const back = () =>
  act(() => {
    window.history.pushState(null, '', '/back-office/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
const forward = () =>
  act(() => {
    window.history.pushState(null, '', '/back-office/tables');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

describe('F1. the top bar’s logout confirmation has the working area’s identity lifetime', () => {
  it('a different manager through M-6 meets no confirmation, and no hold is left', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    typeInto(labelField(host)!, 'Window 1');
    tap(named(host, 'Log out'));
    expect(dialogNamed(DISCARD_TITLE)).not.toBeNull();
    expect(workGuard.isHeld()).toBe(true);

    h.reply(ACTIVITY, refusal('SESSION_IDLE'));
    press();
    await h.settle();
    expect(sessionState(host)).toBe('idle');

    h.reply(ME, ok(OTHER));
    h.reply(LOGIN, ok(OTHER));
    tap(button(document.body, 'Sign in as a different manager'));
    tap(button(document.body, 'Continue to sign-in'));
    type(field(document.body, 'Username'), 'r.ayu');
    type(field(document.body, 'Password'), 'correct horse');
    tap(button(document.body, 'Sign in'));
    await h.settle();

    expect(sessionState(host)).toBe('signed-in');
    expect(host.querySelector('.office-actor')!.textContent).toBe('R. Ayu');
    expect(openDialogs()).toHaveLength(0);
    expect(dialogNamed(DISCARD_TITLE)).toBeNull();
    expect(workGuard.isHeld()).toBe(false);
  });

  it('a different manager through BO-01 meets none either, and the first manager signing in later does not get it back', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    typeInto(labelField(host)!, 'Window 1');
    tap(named(host, 'Log out'));
    h.reply(ACTIVITY, refusal('UNAUTHENTICATED'));
    press();
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');

    h.reply(ME, ok(OTHER));
    h.reply(LOGIN, ok(OTHER));
    type(field(host, 'Username'), 'r.ayu');
    type(field(host, 'Password'), 'correct horse');
    tap(button(host, 'Sign in'));
    await h.settle();
    expect(openDialogs()).toHaveLength(0);
    expect(workGuard.isHeld()).toBe(false);

    // And the first manager, signing in again later, has a clean area and no confirmation.
    h.reply(ACTIVITY, refusal('UNAUTHENTICATED'));
    await h.advance(61_000);
    press();
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    h.reply(LOGIN, ok(VIEW));
    type(field(host, 'Username'), 'm.iqbal');
    type(field(host, 'Password'), 'correct horse');
    tap(button(host, 'Sign in'));
    await h.settle();
    expect(dialogNamed(DISCARD_TITLE)).toBeNull();
  });
});

describe('F2. a command outlives the screen, not the working area', () => {
  async function leaveWithOutstanding(host: HTMLElement) {
    tap(named(rail(host), 'Tables'));
    await h.settle();
    return host;
  }

  it('a rename: Discard, leave for the landing, return before the answer: waiting, inert, then the record silently', async () => {
    const host = await open('/back-office/');
    await leaveWithOutstanding(host);
    tap(named(host, 'Edit Table 1 — active'));
    typeInto(labelField(host)!, 'Window 1');
    const held = h.hold(UPDATE);
    tap(named(host, 'Save'));
    await h.settle();

    back();
    tap(named(dialogNamed('Discard unsaved changes?')!, 'Discard'));
    expect(window.location.pathname).toBe('/back-office/');
    expect(host.querySelector('h1')).toBeNull();

    tap(named(rail(host), 'Tables'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Waiting for an earlier save to finish. Nothing will be sent again.');
    expect(named(host, 'New table').getAttribute('aria-disabled')).toBe('true');
    expect(named(host, 'Edit Table 2 — active').getAttribute('aria-disabled')).toBe('true');
    expect(named(host, 'Deactivate Table 2').getAttribute('aria-disabled')).toBe('true');
    // Round 3: the visit read the list, without hiding the rows held.
    expect(h.count(LIST)).toBe(2);

    held.deliver(table({ ...T1, label: 'Window 1' }));
    await h.settle();
    expect(rowLabels(host)).toContain('Window 1');
    expect(pageStatus(host)).toBeNull();
    expect(panel(host)).toBeNull();
    expect(named(host, 'New table').hasAttribute('aria-disabled')).toBe(false);
    expect(h.count(UPDATE)).toBe(1);
  });

  it('a create, left through browser Back and forward again, lands in the list silently', async () => {
    const host = await open('/back-office/');
    await leaveWithOutstanding(host);
    tap(named(host, 'New table'));
    typeInto(labelField(host)!, 'Window 2');
    const held = h.hold(CREATE);
    tap(named(host, 'Save'));
    await h.settle();

    back();
    tap(named(dialogNamed('Discard unsaved changes?')!, 'Discard'));
    // The answer arrives while the landing is shown.
    held.deliver(table({ tableId: '44444444-4444-4444-8444-444444444444', label: 'Window 2', isActive: true }));
    await h.settle();
    // The visit's read now sees the committed create.
    h.reply(LIST, tables(T1, T2, T3, { tableId: '44444444-4444-4444-8444-444444444444', label: 'Window 2', isActive: true }));
    forward();
    await h.settle();
    expect(rowLabels(host)).toContain('Window 2');
    expect(pageStatus(host)).toBeNull();
    expect(named(host, 'New table').hasAttribute('aria-disabled')).toBe(false);
    expect(h.count(CREATE)).toBe(1);
  });
});

describe('F3. an older read never undoes a newer success', () => {
  it('a held reread after DUPLICATE arrives after the corrected Save: the list keeps Window 1', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    typeInto(labelField(host)!, 'Table 2');
    h.reply(UPDATE, DUPLICATE);
    const reread = h.hold(LIST);
    tap(named(host, 'Save'));
    await h.settle();

    typeInto(labelField(host)!, 'Window 1');
    h.reply(UPDATE, table({ ...T1, label: 'Window 1' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(rowLabels(host)).toContain('Window 1');

    reread.deliver(tables(T1, T2));
    await h.settle();
    expect(rowLabels(host)).toContain('Window 1');
    expect(rowLabels(host)).not.toContain('Table 1');
    expect(text(pageStatus(host))).toBe('Window 1 saved.');
    expect(h.count(LIST)).toBe(2);
  });

  it('inserts a created record the older read lacks', async () => {
    const host = await open();
    tap(named(host, 'New table'));
    typeInto(labelField(host)!, 'Table 1');
    h.reply(CREATE, DUPLICATE);
    const reread = h.hold(LIST);
    tap(named(host, 'Save'));
    await h.settle();
    typeInto(labelField(host)!, 'Window 9');
    h.reply(CREATE, table({ tableId: '44444444-4444-4444-8444-444444444444', label: 'Window 9', isActive: true }));
    tap(named(host, 'Save'));
    await h.settle();
    reread.deliver(tables(T1, T2));
    await h.settle();
    expect(rowLabels(host)).toEqual(['Table 1', 'Table 2', 'Window 9']);
  });
});

describe('F4. a success after a failed reread is shown', () => {
  it('shows and focuses the record, keeps the alert, withholds the counts, and New table is live', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    typeInto(labelField(host)!, 'Window 1');
    h.reply(UPDATE, failure);
    // The reread fails; the read Try again repeats later sees the committed rename.
    h.reply(LIST, failure, tables({ ...T1, label: 'Window 1' }, T2));
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toContain('The list could not be refreshed.');
    expect(host.querySelector('table')).toBeNull();

    h.reply(UPDATE, table({ ...T1, label: 'Window 1' }));
    tap(named(host, 'Save'));
    await h.settle();

    expect(rowLabels(host)).toContain('Window 1');
    expect(document.activeElement).toBe(named(host, 'Edit Window 1 — active'));
    expect(text(pageStatus(host))).toBe('Window 1 saved.');
    expect(text(host.querySelector('[role="alert"]'))).toBe('Tables could not be loadedTry again to read the table list.Try again');
    expect(host.querySelector('#table-count')).toBeNull();
    expect(named(host, 'New table').hasAttribute('aria-disabled')).toBe(false);

    // Try again repeats the read only, replaces the rows, and brings the counts back.
    tap(named(host, 'Try again'));
    await h.settle();
    expect(rowLabels(host)).toContain('Window 1');
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(text(host.querySelector('#table-count'))).toBe('2 active · 0 inactive');
    expect(h.count(UPDATE)).toBe(2);
  });
});

describe('Round 3. every visit to Tables reads the list', () => {
  it('leave, change the list behind it, return: one read, the new row shown, and no loading state while it is out', async () => {
    const host = await open('/back-office/');
    tap(named(rail(host), 'Tables'));
    await h.settle();
    expect(h.count(LIST)).toBe(1);

    back();
    expect(host.querySelector('h1')).toBeNull();
    const extra = { tableId: '55555555-5555-4555-8555-555555555555', label: 'Window 5', isActive: true };
    const visit = h.hold(LIST);
    tap(named(rail(host), 'Tables'));
    await h.settle();
    // The read is out: the rows already held stay, and nothing says "Loading".
    expect(h.count(LIST)).toBe(2);
    expect(rowLabels(host)).toEqual(['Table 1', 'Table 2', 'Terrace 1']);
    expect(host.textContent).not.toContain('Loading tables…');

    visit.deliver(tables(T1, T2, T3, extra));
    await h.settle();
    expect(rowLabels(host)).toContain('Window 5');
    expect(h.count(LIST)).toBe(2);
  });
});
