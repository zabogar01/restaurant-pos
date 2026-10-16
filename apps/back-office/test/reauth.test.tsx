// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CSRF_HEADER } from '@pos/contracts';
import { pressEscape, pressTab, requestClose } from './dialog-shim.js';
import {
  ACTIVITY, HEALTH, LOGIN, LOGOUT, ME, REAUTH, VIEW,
  button, childMounts, field, makeHarness, mount, noContent, noticeOf, ok, press, refusal, sessionState, submit, text, type,
} from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// M-6 (PHASE0-011d2): the native modal over the keyed working area. Cases 6, 7, 8
// and 10, M-6's half of case 9, and case 15 for M-6, then the tests of lead rulings
// 4, 5, 7, 8, 9, 10 and 11. jsdom has no modal dialog: `dialog-shim.ts` models what
// the DOM can show, and the top layer, the scrim and native inertness are the owner's
// check by hand (criterion 5).

let h: ReturnType<typeof makeHarness>;
let view: ReturnType<typeof mount> | undefined;

const OTHER = { ...VIEW, staffUserId: 'm-2', name: 'R. Ayu', username: 'r.ayu', csrfToken: 'tok-2' };
const RENEWED = { ...VIEW, csrfToken: 'tok-1b' };
const PASSWORD = 'correct horse';

beforeEach(() => {
  h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
  childMounts.count = 0;
});
afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.restoreAllMocks();
});

async function open(me = ok(VIEW)) {
  h.reply(ME, me);
  view = mount(h.store);
  await h.settle();
  return view.host;
}

const dlg = () => document.querySelector<HTMLDialogElement>('dialog[open]');
const openCount = () => document.querySelectorAll('dialog[open]').length;
const btn = (name: string) => button(dlg()!, name);
const click = (name: string) => act(() => btn(name).click());
const area = (host: HTMLElement) => host.querySelector<HTMLElement>('.office-work');
const childInput = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#draft');
const pane = (host: HTMLElement) => host.querySelector<HTMLElement>('main.bocontent')!;
const inertParts = (host: HTMLElement) =>
  ['.bonav', '.botop', '.bocontent'].map((s) => host.querySelector(s)?.hasAttribute('inert'));
const disabled = (el: Element) => el.getAttribute('aria-disabled') === 'true';
const focusedId = () => document.activeElement?.id ?? document.activeElement?.tagName;

/** Signed in as A with a typed, focused, selected child; then activity is answered SESSION_IDLE. */
async function goIdle(host: HTMLElement, typed = 'half-typed note') {
  type(childInput(host)!, typed);
  childInput(host)!.focus();
  childInput(host)!.setSelectionRange(2, 5);
  h.reply(ACTIVITY, refusal('SESSION_IDLE'));
  press();
  await h.settle();
  expect(sessionState(host)).toBe('idle');
}

async function continueWith(host: HTMLElement, password = PASSWORD, answer?: Parameters<typeof h.reply>[1]) {
  if (answer) h.reply(REAUTH, answer);
  type(field(host, 'Password'), password);
  click('Continue');
  await h.settle();
}

function toOtherForm() {
  click('Sign in as a different manager');
  click('Continue to sign-in');
}

async function otherSignIn(host: HTMLElement, answer: Parameters<typeof h.reply>[1], username = 'r.ayu', password = PASSWORD) {
  h.reply(LOGIN, answer);
  type(field(host, 'Username'), username);
  type(field(host, 'Password'), password);
  click('Sign in');
  await h.settle();
}

describe('case 6. an idle session opens M-6 over the work', () => {
  it('opens a modal dialog named by its title and described by its body, over a frame that stays mounted and inert', async () => {
    const host = await open();
    await goIdle(host);

    expect(sessionState(host)).toBe('idle');
    expect(openCount()).toBe(1);
    const d = dlg()!;
    expect(d.getAttribute('closedby')).toBe('none');
    expect(d.querySelector(`#${d.getAttribute('aria-labelledby')}`)!.textContent).toBe('Your session timed out');
    expect(d.querySelector(`#${d.getAttribute('aria-describedby')}`)!.textContent).toBe(
      'Your unsaved changes are kept. Continue as m.iqbal to resume them.'
    );
    // The frame is rendered, visible and inert: the top bar, the rail and the pane.
    expect(host.querySelector('.botop .office-actor')!.textContent).toBe('M. Iqbal');
    expect(host.querySelector('.bonav')).not.toBeNull();
    expect(pane(host).hidden).toBe(false);
    expect(inertParts(host)).toEqual([true, true, true]);
    expect(childInput(host)!.value).toBe('half-typed note');
    // M-6 itself sits outside every inert element.
    for (const part of ['.bonav', '.botop', '.bocontent']) expect(host.querySelector(part)!.contains(d)).toBe(false);
    expect(h.count(REAUTH)).toBe(0);
  });

  it('Escape, a close request and a click on the dialog itself leave it open', async () => {
    const host = await open();
    await goIdle(host);
    const d = dlg()!;

    const escape = pressEscape();
    expect(escape.keydown.defaultPrevented).toBe(true);
    expect(dlg()).toBe(d);

    const cancel = requestClose(d);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dlg()).toBe(d);

    act(() => {
      d.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(dlg()).toBe(d);
    expect(sessionState(host)).toBe('idle');
  });

  it('a close that does happen reopens it while the phase is idle', async () => {
    const host = await open();
    await goIdle(host);
    act(() => {
      dlg()!.close();
    });
    expect(openCount()).toBe(1);
    expect(sessionState(host)).toBe('idle');
  });

  it('Tab from the last control goes to the first, and Shift+Tab from the first goes to the last', async () => {
    const host = await open();
    await goIdle(host);
    const d = dlg()!;
    const order = ['reauth-username', 'reauth-password', 'reauth-switch', 'reauth-logout', 'reauth-submit'];
    expect([...d.querySelectorAll<HTMLElement>('input,button')].map((e) => e.id)).toEqual(order);

    d.querySelector<HTMLElement>('#reauth-submit')!.focus();
    const forward = pressTab();
    expect(forward.defaultPrevented).toBe(true);
    expect(focusedId()).toBe('reauth-username');

    const back = pressTab(true);
    expect(back.defaultPrevented).toBe(true);
    expect(focusedId()).toBe('reauth-submit');

    d.querySelector<HTMLElement>('#reauth-password')!.focus();
    expect(pressTab().defaultPrevented).toBe(false);
  });

  it('focus starts on Password, or on "Sign in as a different manager" while the idled account waits', async () => {
    const host = await open();
    await goIdle(host);
    expect(focusedId()).toBe('reauth-password');
    await continueWith(host, PASSWORD, refusal('THROTTLED', { retryAfterSeconds: 30 }, 429));
    expect(focusedId()).toBe('reauth-switch');
  });

  it('the re-authentication sends the token, and only { password }', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, PASSWORD, ok(RENEWED));
    expect(h.keyed(REAUTH)).toHaveLength(1);
    const sent = h.keyed(REAUTH)[0]!;
    expect(sent.headers[CSRF_HEADER]).toBe('tok-1');
    expect(JSON.parse(sent.body!)).toEqual({ password: PASSWORD });
    expect(sent.url).toBe('/api/back-office/auth/reauthenticate');
  });

  it('sends nothing on its own while open: no activity, no deadline read, no visibility read', async () => {
    const host = await open();
    await goIdle(host);
    const meBefore = h.count(ME);
    await h.advance(2 * 60 * 60 * 1000);
    press('keydown');
    press('pointerdown');
    press('wheel');
    type(field(host, 'Password'), 'abc');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(1);
    expect(h.count(ME)).toBe(meBefore);
    expect(sessionState(host)).toBe('idle');
  });

  it('the idle clears a Logout failed notice of the frame', async () => {
    const host = await open();
    h.reply(LOGOUT, refusal('INTERNAL', undefined, 500));
    act(() => button(host, 'Log out').click());
    await h.settle();
    expect(pane(host).querySelector('.office-notice--amber')).not.toBeNull();

    h.reply(ME, refusal('SESSION_IDLE'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    expect(pane(host).querySelector('.office-notice--amber')).toBeNull();
    expect(openCount()).toBe(1);
  });
});

describe('case 7. the right password resumes the same session', () => {
  it('closes M-6, lifts the inert attributes, restores the value, focus and selection, and shows Resumed', async () => {
    const host = await open();
    await goIdle(host);
    const child = childInput(host)!;
    await continueWith(host, PASSWORD, ok(RENEWED));

    expect(sessionState(host)).toBe('signed-in');
    expect(openCount()).toBe(0);
    expect(inertParts(host)).toEqual([false, false, false]);
    expect(childInput(host)).toBe(child);
    expect(child.value).toBe('half-typed note');
    expect(document.activeElement).toBe(child);
    expect([child.selectionStart, child.selectionEnd]).toEqual([2, 5]);
    expect(childMounts.count).toBe(1);

    const resumed = pane(host).firstElementChild!;
    expect(resumed.classList.contains('office-notice')).toBe(true);
    expect(resumed.classList.contains('office-notice--amber')).toBe(false);
    expect(resumed.getAttribute('role')).toBe('status');
    expect(text(resumed)).toBe('Your session has resumed.Your changes are still here. Nothing has been submitted.');
    expect(resumed.contains(document.activeElement)).toBe(false);
    expect(h.count(LOGIN)).toBe(0);
    expect(h.count(LOGOUT)).toBe(0);
  });

  it('restores focus that was outside the working area', async () => {
    const host = await open();
    const bar = button(host, 'Log out');
    bar.focus();
    h.reply(ACTIVITY, refusal('SESSION_IDLE'));
    press();
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    expect(document.activeElement).not.toBe(bar);
    await continueWith(host, PASSWORD, ok(RENEWED));
    expect(document.activeElement).toBe(button(host, 'Log out'));
  });

  it('renews the session: the next request carries the new token and activity is sent again', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, PASSWORD, ok(RENEWED));
    h.reply(ACTIVITY, noContent);
    await h.advance(120_000);
    press();
    await h.settle();
    expect(h.keyed(ACTIVITY).at(-1)!.headers[CSRF_HEADER]).toBe('tok-1b');
  });

  it('Resumed stays until the next change of phase, and sits second when a Logout failed notice is above it', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, PASSWORD, ok(RENEWED));
    await h.advance(60_000);
    expect(text(pane(host).firstElementChild)).toContain('Your session has resumed.');

    h.reply(LOGOUT, refusal('INTERNAL', undefined, 500));
    act(() => button(host, 'Log out').click());
    await h.settle();
    const [first, second] = [...pane(host).children];
    expect(first!.classList.contains('office-notice--amber')).toBe(true);
    expect(text(second ?? null)).toContain('Your session has resumed.');
  });

  it('goes idle again later and resumes again', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, PASSWORD, ok(RENEWED));
    expect(pane(host).textContent).toContain('Your session has resumed.');

    await h.advance(120_000);
    await goIdle(host, 'second note');
    expect(pane(host).textContent).not.toContain('Your session has resumed.');
    await continueWith(host, PASSWORD, ok({ ...VIEW, csrfToken: 'tok-1c' }));
    expect(childInput(host)!.value).toBe('second note');
    expect(document.activeElement).toBe(childInput(host));
    expect(childMounts.count).toBe(1);
  });
});

describe('case 8 and ruling 8. every answer to a re-authentication', () => {
  it('a wrong password: M-6 stays, the refusal shows, the field is empty and focused, the child intact', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'wrong', refusal('INVALID_CREDENTIALS'));
    expect(sessionState(host)).toBe('idle');
    expect(openCount()).toBe(1);
    expect(text(dlg()!.querySelector('.office-error'))).toBe('Incorrect password. Try again.');
    expect(field(host, 'Password').value).toBe('');
    expect(field(host, 'Password').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field(host, 'Password'));
    expect(childInput(host)!.value).toBe('half-typed note');
    expect(childMounts.count).toBe(1);
    expect(inertParts(host)).toEqual([true, true, true]);
    expect(btn('Continue').textContent).toBe('Continue');
  });

  it('editing the password removes the refusal', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'wrong', refusal('INVALID_CREDENTIALS'));
    type(field(host, 'Password'), 'x');
    expect(dlg()!.querySelector('.office-error')).toBeNull();
  });

  it('a cooldown disables Password and Continue but not the other-manager choice or Log out, counts down, and ends by itself', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'wrong', refusal('INVALID_CREDENTIALS', { retryAfterSeconds: 90 }, 429));
    expect(text(dlg()!.querySelector('[role="status"]'))).toBe(
      'This username is cooling down. Try again in 1 min 30 s. You can sign in as a different manager or log out.'
    );
    expect(field(host, 'Password').disabled).toBe(true);
    expect(disabled(btn('Continue'))).toBe(true);
    expect(disabled(btn('Sign in as a different manager'))).toBe(false);
    expect(disabled(btn('Log out'))).toBe(false);
    expect(h.count(REAUTH)).toBe(1);

    // A submission while it waits sends nothing.
    submit(host);
    click('Continue');
    await h.settle();
    expect(h.count(REAUTH)).toBe(1);

    await h.advance(30_000);
    expect(text(dlg()!.querySelector('[role="status"]'))).toContain('Try again in 1 min.');
    await h.advance(60_000);
    expect(dlg()!.querySelector('[role="status"]')).toBeNull();
    expect(field(host, 'Password').disabled).toBe(false);
    expect(disabled(btn('Continue'))).toBe(false);
    expect(focusedId()).toBe('reauth-password');
    expect(h.count(REAUTH)).toBe(1);
  });

  it('THROTTLED with details is the same cooldown; zero removes it and sends nothing', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'x', refusal('THROTTLED', { retryAfterSeconds: 45 }, 429));
    expect(text(dlg()!.querySelector('[role="status"]'))).toContain('Try again in 45 s.');

    await h.advance(45_000);
    await continueWith(host, 'x', refusal('THROTTLED', { retryAfterSeconds: 0 }, 429));
    expect(dlg()!.querySelector('[role="status"]')).toBeNull();
    expect(field(host, 'Password').disabled).toBe(false);
    expect(h.count(REAUTH)).toBe(2);
  });

  it('THROTTLED without details is the general failure', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'x', refusal('THROTTLED', undefined, 429));
    expect(text(dlg()!.querySelector('.office-notice'))).toBe(
      'Something went wrongTry again. If the problem continues, ask a manager for help.Try again'
    );
    expect(dlg()!.querySelector('[role="status"]')).toBeNull();
  });

  it('the idled account’s wait is the one BO-01 shows after the logout', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'x', refusal('INVALID_CREDENTIALS', { retryAfterSeconds: 90 }, 429));
    click('Log out');
    h.reply(LOGOUT, noContent);
    click('Discard changes and log out');
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    type(field(host, 'Username'), ' M.Iqbal ');
    expect(text(noticeOf(host))).toBe(
      'This username is locked for 1 min 30 sThis username is cooling down. Other managers can sign in with their own usernames.'
    );
  });

  it('UNAUTHENTICATED: BO-01 Session ended, M-6 closed, the child kept; the same manager gets it and another does not (case 9)', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'x', refusal('UNAUTHENTICATED'));
    expect(sessionState(host)).toBe('signed-out');
    expect(openCount()).toBe(0);
    expect(text(noticeOf(host))).toBe('Your session has endedSign in again to continue.');
    expect(childInput(host)!.value).toBe('half-typed note');
    expect(pane(host).hasAttribute('inert')).toBe(true);
    expect(pane(host).hidden).toBe(true);

    h.reply(LOGIN, ok(VIEW));
    type(field(host, 'Username'), 'm.iqbal');
    type(field(host, 'Password'), PASSWORD);
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(childInput(host)!.value).toBe('half-typed note');
    expect(childMounts.count).toBe(1);
  });

  it('UNAUTHENTICATED, then another manager signs in: a fresh child (case 9)', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'x', refusal('UNAUTHENTICATED'));
    h.reply(LOGIN, ok(OTHER));
    type(field(host, 'Username'), 'r.ayu');
    type(field(host, 'Password'), PASSWORD);
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(childInput(host)!.value).toBe('');
    expect(childMounts.count).toBe(2);
  });

  it('FORBIDDEN: BO-01 Access refused, M-6 closed, the working area destroyed', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'x', refusal('FORBIDDEN', undefined, 403));
    expect(sessionState(host)).toBe('signed-out');
    expect(openCount()).toBe(0);
    expect(text(noticeOf(host))).toBe(
      'Manager access requiredThis account cannot use the back office. Sign in with a manager account.'
    );
    expect(area(host)).toBeNull();
  });

  it.each([
    ['SESSION_IDLE', refusal('SESSION_IDLE')],
    ['CSRF_REFUSED after the core’s one recovery', refusal('CSRF_REFUSED', undefined, 403)],
    ['VALIDATION_FAILED', refusal('VALIDATION_FAILED', undefined, 400)],
    ['APPROVAL_FAILED', refusal('APPROVAL_FAILED', undefined, 401)],
  ])('%s is the general failure with M-6 staying', async (_n, answer) => {
    const host = await open();
    await goIdle(host);
    h.reply(ME, ok(VIEW));
    await continueWith(host, 'x', answer);
    expect(sessionState(host)).toBe('idle');
    expect(openCount()).toBe(1);
    expect(text(dlg()!.querySelector('.office-notice--amber'))).toBe(
      'Something went wrongTry again. If the problem continues, ask a manager for help.Try again'
    );
    expect(childInput(host)!.value).toBe('half-typed note');
  });

  it.each([
    ['a 500', refusal('INTERNAL', undefined, 500), { status: 200, body: { status: 'ok' } }, 'Something went wrong', 'Try again. If the problem continues, ask a manager for help.'],
    ['no answer', 'reject' as const, { status: 503 }, 'The system is unavailable', 'Wait a moment, then try again.'],
  ])('%s shows its shared sentence inside M-6; Try again sends nothing and asks for fresh entry', async (_n, first, health, title, body) => {
    const host = await open();
    await goIdle(host);
    h.reply(HEALTH, health);
    await continueWith(host, 'x', first);
    expect(sessionState(host)).toBe('idle');
    expect(text(dlg()!.querySelector('.office-notice--amber'))).toBe(`${title}${body}Try again`);
    expect(field(host, 'Password').value).toBe('');
    expect(childInput(host)!.value).toBe('half-typed note');

    const sent = h.count(REAUTH);
    click('Try again');
    await h.settle();
    expect(h.count(REAUTH)).toBe(sent);
    expect(dlg()!.querySelector('.office-notice')).toBeNull();
    expect(document.activeElement).toBe(field(host, 'Password'));
    expect(field(host, 'Password').value).toBe('');
  });

  it('an empty password sends nothing and says so; an oversize one sends nothing and is cleared', async () => {
    const host = await open();
    await goIdle(host);
    click('Continue');
    expect(text(dlg()!.querySelector('.office-error'))).toBe('Enter your password.');
    expect(document.activeElement).toBe(field(host, 'Password'));

    await continueWith(host, 'p'.repeat(1025));
    expect(text(dlg()!.querySelector('.office-error'))).toBe('Incorrect password. Try again.');
    expect(field(host, 'Password').value).toBe('');
    expect(document.activeElement).toBe(field(host, 'Password'));
    expect(h.count(REAUTH)).toBe(0);

    await continueWith(host, 'p'.repeat(1024), ok(RENEWED));
    expect(h.count(REAUTH)).toBe(1);
  });
});

describe('ruling 5. the four modes', () => {
  it('"Sign in as a different manager" asks first; Stay returns to the form with its wait and focus', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'x', refusal('THROTTLED', { retryAfterSeconds: 60 }, 429));
    type(field(host, 'Password'), 'half');
    click('Sign in as a different manager');

    expect(openCount()).toBe(1);
    const d = dlg()!;
    expect(text(d.querySelector('h2'))).toBe('Sign in as a different manager?');
    expect(text(d.querySelector(`#${d.getAttribute('aria-describedby')}`))).toBe(
      'The current manager’s unsaved changes will not be available to the manager signing in.'
    );
    expect(d.querySelectorAll('input')).toHaveLength(0);
    expect(focusedId()).toBe('reauth-stay');
    expect([...d.querySelectorAll('footer button')].map((b) => b.textContent)).toEqual([
      'Stay with current manager',
      'Continue to sign-in',
    ]);

    click('Stay with current manager');
    expect(text(dlg()!.querySelector('h2'))).toBe('Your session timed out');
    expect(text(dlg()!.querySelector('[role="status"]'))).toContain('Try again in 1 min.');
    expect(field(host, 'Password').value).toBe('');
    expect(focusedId()).toBe('reauth-switch');
    expect(childInput(host)!.value).toBe('half-typed note');
  });

  it('"Continue to sign-in" opens the other form with an empty Username, focused; Back clears and returns to Password', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    const d = dlg()!;
    expect(text(d.querySelector('h2'))).toBe('Sign in as a different manager');
    expect(text(d.querySelector(`#${d.getAttribute('aria-describedby')}`))).toBe(
      'Enter your own username and password. The current manager’s unsaved changes will not be available to you.'
    );
    expect(field(host, 'Username').readOnly).toBe(false);
    expect(field(host, 'Username').value).toBe('');
    expect(field(host, 'Username').getAttribute('autocomplete')).toBe('username');
    expect(focusedId()).toBe('reauth-username');
    expect([...d.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Back to m.iqbal', 'Log out', 'Sign in']);

    type(field(host, 'Username'), 'r.ayu');
    type(field(host, 'Password'), 'half');
    click('Back to m.iqbal');
    expect(text(dlg()!.querySelector('h2'))).toBe('Your session timed out');
    expect(field(host, 'Password').value).toBe('');
    expect(field(host, 'Username').value).toBe('m.iqbal');
    expect(field(host, 'Username').readOnly).toBe(true);
    expect(focusedId()).toBe('reauth-password');

    toOtherForm();
    expect(field(host, 'Username').value).toBe('');
    expect(childInput(host)!.value).toBe('half-typed note');
  });

  it('the fixed Username shows the idled username, read-only, and no input has a value attribute', async () => {
    const host = await open();
    await goIdle(host);
    expect(field(host, 'Username').value).toBe('m.iqbal');
    expect(field(host, 'Username').readOnly).toBe(true);
    expect(field(host, 'Username').getAttribute('autocomplete')).toBeNull();
    expect(field(host, 'Password').getAttribute('autocomplete')).toBe('current-password');
    expect(field(host, 'Password').type).toBe('password');
    for (const input of host.querySelectorAll('input')) expect(input.hasAttribute('value')).toBe(false);
  });

  it('the idled username is the one the view named, not anything typed', async () => {
    const host = await open(ok({ ...VIEW, username: 'm.iqbal' }));
    await goIdle(host);
    toOtherForm();
    type(field(host, 'Username'), 'someone.else');
    click('Back to m.iqbal');
    expect(field(host, 'Username').value).toBe('m.iqbal');
    expect(text(dlg()!.querySelector('p'))).toBe('Your unsaved changes are kept. Continue as m.iqbal to resume them.');
  });

  it('Log out opens the confirmation in place of M-6; Keep returns to the form it came from', async () => {
    const host = await open();
    await goIdle(host);
    click('Log out');
    expect(openCount()).toBe(1);
    const d = dlg()!;
    expect(d.getAttribute('closedby')).toBe('none');
    expect(text(d.querySelector('h2'))).toBe('Log out and discard your changes?');
    expect(text(d.querySelector(`#${d.getAttribute('aria-describedby')}`))).toBe(
      'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.'
    );
    expect(focusedId()).toBe('reauth-keep');
    expect([...d.querySelectorAll('footer button')].map((b) => b.textContent)).toEqual([
      'Keep this draft',
      'Discard changes and log out',
    ]);
    expect(btn('Discard changes and log out').className).toBe('office-button danger final');
    expect(btn('Discard changes and log out').tagName).toBe('BUTTON');
    expect(inertParts(host)).toEqual([true, true, true]);

    click('Keep this draft');
    expect(openCount()).toBe(1);
    expect(text(dlg()!.querySelector('h2'))).toBe('Your session timed out');
    expect(focusedId()).toBe('reauth-password');

    toOtherForm();
    click('Log out');
    click('Keep this draft');
    expect(text(dlg()!.querySelector('h2'))).toBe('Sign in as a different manager');
    expect(focusedId()).toBe('reauth-username');
  });

  it('Keep returns to the other form with the typed Username and an empty Password; a later visit from the acknowledgement starts empty', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    type(field(host, 'Username'), 'r.ayu');
    type(field(host, 'Password'), 'half');
    click('Log out');
    click('Keep this draft');
    expect(text(dlg()!.querySelector('h2'))).toBe('Sign in as a different manager');
    expect(field(host, 'Username').value).toBe('r.ayu');
    expect(field(host, 'Password').value).toBe('');
    expect(focusedId()).toBe('reauth-username');

    click('Back to m.iqbal');
    toOtherForm();
    expect(field(host, 'Username').value).toBe('');
  });

  it('on the confirmation, Escape and a close request are "Keep this draft"', async () => {
    const host = await open();
    await goIdle(host);
    click('Log out');
    const escape = pressEscape();
    expect(escape.keydown.defaultPrevented).toBe(true);
    expect(text(dlg()!.querySelector('h2'))).toBe('Your session timed out');
    expect(openCount()).toBe(1);

    click('Log out');
    const cancel = requestClose(dlg()!);
    expect(cancel.defaultPrevented).toBe(true);
    expect(text(dlg()!.querySelector('h2'))).toBe('Your session timed out');
    expect(sessionState(host)).toBe('idle');
  });

  it('the cooldown sentence is appended from the fixed form and counts down, and never from the other form', async () => {
    const host = await open();
    await goIdle(host);
    await continueWith(host, 'x', refusal('THROTTLED', { retryAfterSeconds: 90 }, 429));
    click('Log out');
    const sentence = (wait: string) =>
      `This username is locked for ${wait}. Logging out does not end its cooldown. Other managers can sign in with their own usernames. Waiting here keeps your draft.`;
    expect(text(dlg()!.querySelector('[role="status"]'))).toBe(sentence('1 min 30 s'));
    await h.advance(1_000);
    expect(text(dlg()!.querySelector('[role="status"]'))).toBe(sentence('1 min 29 s'));

    click('Keep this draft');
    toOtherForm();
    click('Log out');
    expect(dlg()!.querySelector('[role="status"]')).toBeNull();
    expect(dlg()!.textContent).not.toContain('cooldown');
  });
});

describe('ruling 7 and case 10. another manager signs in from M-6', () => {
  it('a different staff user: the working area is a fresh one, there is no Resumed notice, and focus goes to Log out', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    await otherSignIn(host, ok(OTHER));
    expect(sessionState(host)).toBe('signed-in');
    expect(openCount()).toBe(0);
    expect(host.querySelector('.office-actor')!.textContent).toBe('R. Ayu');
    expect(childInput(host)!.value).toBe('');
    expect(childMounts.count).toBe(2);
    expect(pane(host).textContent).not.toContain('resumed');
    expect(pane(host).querySelector('.office-notice')).toBeNull();
    expect(document.activeElement).toBe(button(host, 'Log out'));
    expect(inertParts(host)).toEqual([false, false, false]);
    expect(h.count(REAUTH)).toBe(0);
    expect(JSON.parse(h.keyed(LOGIN)[0]!.body!)).toEqual({ username: 'r.ayu', password: PASSWORD });
    expect(h.keyed(LOGIN)[0]!.url).toBe('/api/back-office/auth/login');
  });

  it('the idled manager typing their own username keeps the work, because the key decides', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    await otherSignIn(host, ok(VIEW), 'm.iqbal');
    expect(sessionState(host)).toBe('signed-in');
    expect(childInput(host)!.value).toBe('half-typed note');
    expect(childMounts.count).toBe(1);
    expect(pane(host).textContent).not.toContain('resumed');
  });

  it('the other manager then goes idle and sees their own name in M-6', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    await otherSignIn(host, ok(OTHER));
    await h.advance(120_000);
    h.reply(ACTIVITY, refusal('SESSION_IDLE'));
    press();
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    expect(text(dlg()!.querySelector('p'))).toBe('Your unsaved changes are kept. Continue as r.ayu to resume them.');
  });

  it('INVALID_CREDENTIALS without details: the other-manager error, Username kept, Password cleared, M-6 as it was', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    await otherSignIn(host, refusal('INVALID_CREDENTIALS'));
    expect(sessionState(host)).toBe('idle');
    expect(text(dlg()!.querySelector('h2'))).toBe('Sign in as a different manager');
    expect(text(dlg()!.querySelector('.office-notice'))).toBe(
      'Sign-in failedCheck your username and password, then try again.'
    );
    expect(field(host, 'Username').value).toBe('r.ayu');
    expect(field(host, 'Password').value).toBe('');
    expect(document.activeElement).toBe(field(host, 'Password'));
    expect(childInput(host)!.value).toBe('half-typed note');
    expect(childMounts.count).toBe(1);
    expect(h.count(REAUTH)).toBe(0);
  });

  it('a cooldown is keyed by the typed account, follows the Username, and leaves the idled account alone', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    await otherSignIn(host, refusal('INVALID_CREDENTIALS', { retryAfterSeconds: 60 }, 429), 'R.Ayu');
    const locked = 'This username is locked for 1 minThis username is cooling down. Other managers can sign in with their own usernames.';
    expect(text(dlg()!.querySelector('.office-notice'))).toBe(locked);
    expect(field(host, 'Password').disabled).toBe(true);
    expect(disabled(btn('Sign in'))).toBe(true);
    expect(field(host, 'Username').disabled).toBe(false);
    expect(disabled(btn('Back to m.iqbal'))).toBe(false);
    expect(disabled(btn('Log out'))).toBe(false);
    expect(focusedId()).toBe('reauth-username');

    // Editing the Username away enables entry; returning restores the remaining wait.
    type(field(host, 'Username'), 'someone.else');
    expect(dlg()!.querySelector('.office-notice')).toBeNull();
    expect(field(host, 'Password').disabled).toBe(false);
    await h.advance(10_000);
    type(field(host, 'Username'), ' r.AYU ');
    expect(text(dlg()!.querySelector('.office-notice'))).toBe(locked.replace('1 min', '50 s'));

    // The submitted account's wait holds that sign-in off; nothing is sent.
    submit(host);
    expect(h.count(LOGIN)).toBe(1);

    // The idled account has no wait of its own.
    click('Back to m.iqbal');
    expect(dlg()!.querySelector('[role="status"]')).toBeNull();
    expect(field(host, 'Password').disabled).toBe(false);
  });

  it.each([
    ['a 500', refusal('INTERNAL', undefined, 500), { status: 200, body: { status: 'ok' } }, 'Something went wrong'],
    ['no answer', 'reject' as const, { status: 503 }, 'The system is unavailable'],
  ])('%s shows the shared sentence inside the other form, with the draft kept', async (_n, first, health, title) => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    h.reply(HEALTH, health);
    await otherSignIn(host, first);
    expect(sessionState(host)).toBe('idle');
    expect(text(dlg()!.querySelector('.office-notice--amber strong'))).toBe(title);
    expect(field(host, 'Username').value).toBe('r.ayu');
    expect(childInput(host)!.value).toBe('half-typed note');
    click('Try again');
    expect(dlg()!.querySelector('.office-notice')).toBeNull();
    expect(document.activeElement).toBe(field(host, 'Password'));
  });

  it('empty and oversize input send nothing', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    click('Sign in');
    expect(text(dlg()!.querySelector('.office-error'))).toBe('Enter your username.');
    expect(document.activeElement).toBe(field(host, 'Username'));

    type(field(host, 'Username'), 'r.ayu');
    click('Sign in');
    expect(text(dlg()!.querySelector('.office-error'))).toBe('Enter your password.');
    expect(document.activeElement).toBe(field(host, 'Password'));

    type(field(host, 'Username'), 'u'.repeat(257));
    type(field(host, 'Password'), 'x');
    click('Sign in');
    expect(text(dlg()!.querySelector('.office-notice'))).toBe(
      'Sign-in failedCheck your username and password, then try again.'
    );
    expect(document.activeElement).toBe(field(host, 'Username'));
    expect(field(host, 'Password').value).toBe('');

    type(field(host, 'Username'), 'r.ayu');
    await otherSignIn(host, ok(OTHER), 'r.ayu', 'p'.repeat(1025));
    expect(dlg()!.querySelector('.office-notice')).not.toBeNull();
    expect(h.count(LOGIN)).toBe(0);
  });

  it('a session that something else changed during the sign-in is BO-01 Session ended, the work kept', async () => {
    const host = await open();
    type(childInput(host)!, 'half-typed note');
    const read = h.hold(ME);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await h.settle();
    h.reply(ACTIVITY, refusal('SESSION_IDLE'));
    press();
    await h.settle();
    toOtherForm();

    const login = h.hold(LOGIN);
    type(field(host, 'Username'), 'r.ayu');
    type(field(host, 'Password'), PASSWORD);
    click('Sign in');
    await h.settle();
    // A stale read naming a third person lands while the sign-in is in flight: the
    // core's actor-changed is not this sign-in's own install, but the sign-in is obsolete.
    read.deliver(ok({ ...VIEW, staffUserId: 'm-3', name: 'Third', username: 'third', csrfToken: 'tok-3' }));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    login.deliver(ok(OTHER));
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(openCount()).toBe(0);
    expect(text(noticeOf(host))).toBe('Your session has endedSign in again to continue.');
    expect(childInput(host)!.value).toBe('half-typed note');
  });

  it('the actor-changed that the sign-in’s own install emits is not acted on; the result decides', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    const login = h.hold(LOGIN);
    type(field(host, 'Username'), 'r.ayu');
    type(field(host, 'Password'), PASSWORD);
    click('Sign in');
    await h.settle();
    expect(btn('Signing in…')).toBeDefined();
    login.deliver(ok(OTHER));
    await h.settle();
    expect(sessionState(host)).toBe('signed-in');
  });
});

describe('ruling 10. Log out from M-6', () => {
  async function toConfirmation(host: HTMLElement) {
    await goIdle(host);
    click('Log out');
  }

  it('Discard sends logout with the token; a 204 gives BO-01 resting and destroys the work', async () => {
    const host = await open();
    await toConfirmation(host);
    h.reply(LOGOUT, noContent);
    click('Discard changes and log out');
    await h.settle();
    expect(h.keyed(LOGOUT)).toHaveLength(1);
    expect(h.keyed(LOGOUT)[0]!.headers[CSRF_HEADER]).toBe('tok-1');
    expect(sessionState(host)).toBe('signed-out');
    expect(openCount()).toBe(0);
    expect(noticeOf(host)).toBeNull();
    expect(area(host)).toBeNull();
  });

  it.each([
    ['a 500', refusal('INTERNAL', undefined, 500), { status: 200, body: { status: 'ok' } }, 'Something went wrong', 'Try again. If the problem continues, ask a manager for help.'],
    ['no answer', 'reject' as const, { status: 503 }, 'The system is unavailable', 'Wait a moment, then try again.'],
    ['a refusal that does not end the session', refusal('THROTTLED', { retryAfterSeconds: 30 }, 429), { status: 200, body: { status: 'ok' } }, 'Something went wrong', 'Try again. If the problem continues, ask a manager for help.'],
  ])('%s: the confirmation stays over inert work with the amber notice above its actions; Try again sends it again', async (_n, first, health, title, body) => {
    const host = await open();
    await toConfirmation(host);
    h.reply(LOGOUT, first, noContent);
    h.reply(HEALTH, health);
    click('Discard changes and log out');
    await h.settle();

    expect(sessionState(host)).toBe('idle');
    expect(openCount()).toBe(1);
    const d = dlg()!;
    expect(text(d.querySelector('h2'))).toBe('Log out and discard your changes?');
    const notice = d.querySelector('.office-notice--amber')!;
    expect(notice.getAttribute('role')).toBe('alert');
    expect(text(notice)).toBe(`${title}${body}Sign-out has not been confirmed.Try again`);
    // Above the confirmation's actions.
    expect(notice.compareDocumentPosition(d.querySelector('footer')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inertParts(host)).toEqual([true, true, true]);
    expect(childInput(host)!.value).toBe('half-typed note');
    expect(disabled(btn('Keep this draft'))).toBe(false);
    expect(disabled(btn('Discard changes and log out'))).toBe(false);

    click('Try again');
    await h.settle();
    expect(h.keyed(LOGOUT).map((c) => c.headers[CSRF_HEADER])).toEqual(['tok-1', 'tok-1']);
    expect(sessionState(host)).toBe('signed-out');
    expect(area(host)).toBeNull();
  });

  it('Keep clears the failure and returns to the form', async () => {
    const host = await open();
    await toConfirmation(host);
    h.reply(LOGOUT, refusal('INTERNAL', undefined, 500));
    click('Discard changes and log out');
    await h.settle();
    expect(dlg()!.querySelector('.office-notice')).not.toBeNull();
    click('Keep this draft');
    expect(text(dlg()!.querySelector('h2'))).toBe('Your session timed out');
    click('Log out');
    expect(dlg()!.querySelector('.office-notice')).toBeNull();
  });

  it('while the logout is in flight every control is inert and a second press sends nothing', async () => {
    const host = await open();
    await toConfirmation(host);
    const held = h.hold(LOGOUT);
    click('Discard changes and log out');
    await h.settle();
    expect(disabled(btn('Keep this draft'))).toBe(true);
    expect(disabled(btn('Discard changes and log out'))).toBe(true);
    click('Discard changes and log out');
    click('Keep this draft');
    pressEscape();
    await h.settle();
    expect(h.count(LOGOUT)).toBe(1);
    expect(text(dlg()!.querySelector('h2'))).toBe('Log out and discard your changes?');
    held.deliver(noContent);
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
  });

  it('UNAUTHENTICATED answered to the logout: BO-01 Session ended, without the draft', async () => {
    const host = await open();
    await toConfirmation(host);
    h.reply(LOGOUT, refusal('UNAUTHENTICATED'));
    click('Discard changes and log out');
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(text(noticeOf(host))).toBe('Your session has endedSign in again to continue.');
    expect(area(host)).toBeNull();
  });

  it('FORBIDDEN answered to the logout: Access refused, without the draft', async () => {
    const host = await open();
    await toConfirmation(host);
    h.reply(LOGOUT, refusal('FORBIDDEN', undefined, 403));
    click('Discard changes and log out');
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(text(noticeOf(host))).toContain('Manager access required');
    expect(area(host)).toBeNull();
  });

  it('from the other form the same', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    click('Log out');
    h.reply(LOGOUT, noContent);
    click('Discard changes and log out');
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(area(host)).toBeNull();
  });
});

describe('ruling 11. one cookie-changing request at a time', () => {
  it('while a re-authentication is pending, a second Continue, the switch and Log out send and change nothing', async () => {
    const host = await open();
    await goIdle(host);
    const held = h.hold(REAUTH);
    type(field(host, 'Password'), PASSWORD);
    click('Continue');
    await h.settle();
    expect(btn('Verifying…')).toBeDefined();
    expect(disabled(btn('Verifying…'))).toBe(true);
    expect(disabled(btn('Sign in as a different manager'))).toBe(true);
    expect(disabled(btn('Log out'))).toBe(true);

    submit(host);
    click('Verifying…');
    click('Sign in as a different manager');
    click('Log out');
    await h.settle();
    expect(h.count(REAUTH)).toBe(1);
    expect(h.count(LOGIN)).toBe(0);
    expect(text(dlg()!.querySelector('h2'))).toBe('Your session timed out');

    held.deliver(ok(RENEWED));
    await h.settle();
    expect(sessionState(host)).toBe('signed-in');
  });

  it('while an other-manager sign-in is pending, a second Sign in, Back and Log out send and change nothing', async () => {
    const host = await open();
    await goIdle(host);
    toOtherForm();
    const held = h.hold(LOGIN);
    type(field(host, 'Username'), 'r.ayu');
    type(field(host, 'Password'), PASSWORD);
    click('Sign in');
    await h.settle();
    expect(disabled(btn('Signing in…'))).toBe(true);
    expect(disabled(btn('Back to m.iqbal'))).toBe(true);
    expect(disabled(btn('Log out'))).toBe(true);

    submit(host);
    click('Signing in…');
    click('Back to m.iqbal');
    click('Log out');
    await h.settle();
    expect(h.count(LOGIN)).toBe(1);
    expect(text(dlg()!.querySelector('h2'))).toBe('Sign in as a different manager');

    held.deliver(refusal('INVALID_CREDENTIALS'));
    await h.settle();
    expect(disabled(btn('Sign in'))).toBe(false);
  });

  it('after a re-authentication answered UNAUTHENTICATED while pending, BO-01 is usable at once', async () => {
    const host = await open();
    await goIdle(host);
    const held = h.hold(REAUTH);
    type(field(host, 'Password'), PASSWORD);
    click('Continue');
    await h.settle();
    held.deliver(refusal('UNAUTHENTICATED'));
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(field(host, 'Username').disabled).toBe(false);
    expect(field(host, 'Password').disabled).toBe(false);
    expect(button(host, 'Sign in').getAttribute('aria-disabled')).toBeNull();

    h.reply(LOGIN, ok(VIEW));
    type(field(host, 'Username'), 'm.iqbal');
    type(field(host, 'Password'), PASSWORD);
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(h.count(LOGIN)).toBe(1);
    expect(sessionState(host)).toBe('signed-in');
  });

  it('an idle published while a top-bar logout is in flight is not left busy when it settles', async () => {
    const host = await open();
    const held = h.hold(LOGOUT);
    act(() => button(host, 'Log out').click());
    await h.settle();
    h.reply(ME, refusal('SESSION_IDLE'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    // Busy while the logout is pending: M-6 sends no second cookie-changing request.
    expect(btn('Verifying…') ?? btn('Continue')).toBeDefined();
    expect(disabled(btn('Log out'))).toBe(true);

    held.deliver(refusal('INTERNAL', undefined, 500));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    expect(disabled(btn('Log out'))).toBe(false);
    expect(field(host, 'Password').disabled).toBe(false);
    expect(btn('Continue').textContent).toBe('Continue');
    expect(disabled(btn('Continue'))).toBe(false);
  });
});

describe('case 15 for M-6. the password', () => {
  const SECRET = 'S3cret-Pw-7f2e91';
  const dom = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;

  function whereTheSecretIs(allowed: string[]): string[] {
    const found: string[] = [];
    if (document.documentElement.outerHTML.includes(SECRET)) found.push('the document markup');
    for (const input of document.querySelectorAll('input')) {
      if (input.hasAttribute('value')) found.push(`a value attribute on #${input.id}`);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.textContent?.includes(SECRET)) found.push('a text node');
    }
    for (const store of [dom.localStorage, dom.sessionStorage]) {
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i)!;
        if (k.includes(SECRET) || store.getItem(k)?.includes(SECRET)) found.push('storage');
      }
    }
    if (document.cookie.includes(SECRET)) found.push('a cookie');
    if (window.location.href.includes(SECRET)) found.push('the address');
    for (const call of h.calls) {
      const key = `${call.method} ${call.url}`;
      if (call.url.includes(SECRET)) found.push(`a URL (${call.url})`);
      if (JSON.stringify(call.headers).includes(SECRET)) found.push('a header');
      if (call.body?.includes(SECRET) && !allowed.includes(key)) found.push(`the body of ${call.url}`);
    }
    return found;
  }

  for (const [name, answer] of [
    ['a success', ok(RENEWED)],
    ['a refusal', refusal('INVALID_CREDENTIALS')],
    ['a cooldown', refusal('THROTTLED', { retryAfterSeconds: 30 }, 429)],
    ['a failure', refusal('INTERNAL', undefined, 500)],
  ] as const) {
    it(`a re-authentication answered with ${name}: the password is in its own request body and nowhere else`, async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
      const host = await open();
      await goIdle(host);
      expect(whereTheSecretIs([])).toEqual([]);
      type(field(host, 'Password'), SECRET);
      expect(whereTheSecretIs([])).toEqual([]);
      h.reply(REAUTH, answer);
      click('Continue');
      await h.settle();
      expect(JSON.parse(h.keyed(REAUTH)[0]!.body!)).toEqual({ password: SECRET });
      expect(whereTheSecretIs([REAUTH])).toEqual([]);
      const password = host.querySelector<HTMLInputElement>('input[type="password"]');
      if (password) expect(password.value).toBe('');
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    });
  }

  for (const [name, answer] of [
    ['a success', ok(OTHER)],
    ['a refusal', refusal('INVALID_CREDENTIALS')],
    ['a cooldown', refusal('THROTTLED', { retryAfterSeconds: 30 }, 429)],
  ] as const) {
    it(`an other-manager sign-in answered with ${name}: the password is in its own request body and nowhere else`, async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
      const host = await open();
      await goIdle(host);
      toOtherForm();
      await otherSignIn(host, answer, 'r.ayu', SECRET);
      expect(JSON.parse(h.keyed(LOGIN)[0]!.body!)).toEqual({ username: 'r.ayu', password: SECRET });
      expect(whereTheSecretIs([LOGIN])).toEqual([]);
      const password = host.querySelector<HTMLInputElement>('input[type="password"]');
      if (password) expect(password.value).toBe('');
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    });
  }

  it('every form is method="post" with no action, and its submission is prevented', async () => {
    const host = await open();
    await goIdle(host);
    for (const switchTo of [() => {}, toOtherForm]) {
      switchTo();
      const form = dlg()!.querySelector('form')!;
      expect(form.getAttribute('method')).toBe('post');
      expect(form.hasAttribute('action')).toBe(false);
      const event = new Event('submit', { bubbles: true, cancelable: true });
      act(() => {
        form.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it('has no PIN, remember-me, reveal, strength or recovery control', async () => {
    const host = await open();
    await goIdle(host);
    expect([...dlg()!.querySelectorAll('input')].map((i) => i.type).sort()).toEqual(['password', 'text']);
    expect(dlg()!.textContent).not.toMatch(/forgot|remember|reveal|strength|\bpin\b|show password/i);
  });

  it('no input ever has a value attribute, in any mode', async () => {
    const host = await open();
    await goIdle(host);
    const check = () => {
      for (const input of host.querySelectorAll('input')) expect(input.hasAttribute('value')).toBe(false);
    };
    check();
    toOtherForm();
    type(field(host, 'Username'), 'r.ayu');
    check();
    click('Back to m.iqbal');
    check();
    await continueWith(host, 'x', refusal('INVALID_CREDENTIALS'));
    check();
  });
});
