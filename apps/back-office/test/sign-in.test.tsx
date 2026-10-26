// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HEALTH, LOGIN, ME, VIEW,
  button, field, makeHarness, mount, noticeOf, ok, refusal, sessionState, text, type,
} from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let h: ReturnType<typeof makeHarness>;
let view: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
});
afterEach(() => {
  view?.unmount();
  view = undefined;
});

async function open(me = refusal('UNAUTHENTICATED')) {
  h.reply(ME, me);
  view = mount(h.store);
  await h.settle();
  return view.host;
}

async function signInWith(host: HTMLElement, username = 'm.iqbal', password = 'correct horse') {
  type(field(host, 'Username'), username);
  type(field(host, 'Password'), password);
  act(() => button(host, 'Sign in').click());
  await h.settle();
}

describe('case 1. a sign-in', () => {
  it('posts exactly { username, password }, shows the frame with the manager’s name, and the password field is empty', async () => {
    const host = await open();
    expect(sessionState(host)).toBe('signed-out');
    expect(text(host.querySelector('h1'))).toBe('Back office');
    expect(text(host.querySelector('.office-signin > p'))).toBe('Sign in with your manager username and password.');

    h.reply(LOGIN, ok(VIEW));
    type(field(host, 'Username'), 'm.iqbal');
    type(field(host, 'Password'), 'correct horse');
    const password = field(host, 'Password');
    act(() => button(host, 'Sign in').click());
    // Emptied at once: the value is never kept past the submission.
    expect(password.value).toBe('');
    await h.settle();

    expect(h.count(LOGIN)).toBe(1);
    expect(h.keyed(LOGIN)[0]!.body).toBe('{"username":"m.iqbal","password":"correct horse"}');
    expect(sessionState(host)).toBe('signed-in');
    expect(text(host.querySelector('.botop'))).toBe('Back officeM. IqbalLog out');
    // The rail lists the destinations that exist, under their group (PHASE1-S1b, PHASE1-S2b, PHASE1-S4c1).
    expect(text(host.querySelector('.bonav'))).toBe('ConfigurationMenuTablesSettings');
    expect([...host.querySelectorAll('.bonav a')].map((a) => a.getAttribute('href'))).toEqual([
      '/back-office/menu',
      '/back-office/tables',
      '/back-office/settings',
    ]);
    expect(host.querySelector('input[type="password"]')).toBeNull();
  });

  it('shows no success sentence, link, date or incident in the frame (case 19)', async () => {
    const host = await open(ok(VIEW));
    expect(sessionState(host)).toBe('signed-in');
    // The only links are the rail's three entries; the success view adds none (PHASE1-S1b, PHASE1-S2b, PHASE1-S4c1).
    expect([...host.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Menu', 'Tables', 'Settings']);
    expect(host.querySelectorAll('.botop a, .bocontent a')).toHaveLength(0);
    expect(host.querySelector('.bocontent')!.querySelector(':scope > :not(.office-work)')).toBeNull();
    expect(host.querySelector('.office-notice')).toBeNull();
    expect(host.querySelector('time')).toBeNull();
    expect(text(host)).not.toMatch(/\b(day|incident|kitchen|receipt)\b/i);
    // Exactly one button in the frame: Log out.
    expect([...host.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Log out']);
  });

  it('a load with me 200 is signed in without a sign-in request', async () => {
    const host = await open(ok(VIEW));
    expect(sessionState(host)).toBe('signed-in');
    expect(h.count(LOGIN)).toBe(0);
  });
});

describe('case 2. INVALID_CREDENTIALS', () => {
  it('is the one refusal, the password field is empty and the username is kept', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('INVALID_CREDENTIALS'));
    await signInWith(host, 'nobody', 'wrong');
    expect(sessionState(host)).toBe('signed-out');
    expect(text(noticeOf(host))).toBe('Sign-in failedCheck your username and password, then try again.');
    expect(field(host, 'Username').value).toBe('nobody');
    expect(field(host, 'Password').value).toBe('');
    expect(document.activeElement).toBe(field(host, 'Password'));
  });

  it('is the same notice for an unknown username and for a wrong password', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('INVALID_CREDENTIALS'));
    await signInWith(host, 'nobody', 'x');
    const first = text(noticeOf(host));
    await signInWith(host, 'm.iqbal', 'y');
    expect(text(noticeOf(host))).toBe(first);
  });

  it('editing a field removes the error notice', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('INVALID_CREDENTIALS'));
    await signInWith(host);
    type(field(host, 'Password'), 'a');
    expect(noticeOf(host)).toBeNull();
  });
});

describe('case 3. a cooldown', () => {
  it.each([
    ['INVALID_CREDENTIALS', 300, 'This username is locked for 5 min'],
    ['THROTTLED', 75, 'This username is locked for 1 min 15 s'],
  ])('%s with %i seconds: counts down, and the button is inert until it has passed', async (code, seconds, title) => {
    const host = await open();
    h.reply(LOGIN, refusal(code, { retryAfterSeconds: seconds }, 429));
    await signInWith(host);
    expect(text(noticeOf(host)!.querySelector('strong'))).toBe(title);
    expect(text(noticeOf(host)!.querySelector('p'))).toBe(
      'This username is cooling down. Other managers can sign in with their own usernames.'
    );
    expect(button(host, 'Sign in').getAttribute('aria-disabled')).toBe('true');
    expect(field(host, 'Password').disabled).toBe(true);
    expect(field(host, 'Username').disabled).toBe(false);
    const before = h.calls.length;

    await h.advance(1000);
    expect(text(noticeOf(host)!.querySelector('strong'))).toContain('s');
    // A press while inert sends nothing.
    act(() => button(host, 'Sign in').click());
    expect(h.calls.length).toBe(before);

    await h.advance(seconds * 1000);
    expect(noticeOf(host)).toBeNull();
    expect(button(host, 'Sign in').getAttribute('aria-disabled')).toBeNull();
    expect(field(host, 'Password').disabled).toBe(false);
    expect(h.calls.length).toBe(before);
  });

  it('a wait of zero draws no notice and enables entry, without submission', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('THROTTLED', { retryAfterSeconds: 0 }, 429));
    await signInWith(host);
    expect(noticeOf(host)).toBeNull();
    expect(h.count(LOGIN)).toBe(1);
    expect(field(host, 'Password').disabled).toBe(false);
  });

  it('follows the trimmed, lower-case username: editing away lifts it, returning restores the remaining wait', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('THROTTLED', { retryAfterSeconds: 120 }, 429));
    await signInWith(host, 'M.Iqbal');
    expect(text(noticeOf(host)!.querySelector('strong'))).toBe('This username is locked for 2 min');

    type(field(host, 'Username'), 'someone.else');
    expect(noticeOf(host)).toBeNull();
    expect(field(host, 'Password').disabled).toBe(false);
    expect(button(host, 'Sign in').getAttribute('aria-disabled')).toBeNull();

    await h.advance(30_000);
    type(field(host, 'Username'), '  m.IQBAL ');
    expect(text(noticeOf(host)!.querySelector('strong'))).toBe('This username is locked for 1 min 30 s');
    expect(field(host, 'Password').disabled).toBe(true);
  });
});

describe('case 4. local validation', () => {
  it('an empty username sends nothing, says so beside the field and focuses it', async () => {
    const host = await open();
    type(field(host, 'Password'), 'x');
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(h.count(LOGIN)).toBe(0);
    expect(text(host.querySelector('#bo-username-error'))).toBe('Enter your username.');
    expect(field(host, 'Username').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field(host, 'Username'));
  });

  it('an empty password sends nothing, says so beside the field and focuses it', async () => {
    const host = await open();
    type(field(host, 'Username'), 'm.iqbal');
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(h.count(LOGIN)).toBe(0);
    expect(text(host.querySelector('#bo-password-error'))).toBe('Enter your password.');
    expect(document.activeElement).toBe(field(host, 'Password'));
  });

  it('an oversize username or password sends nothing, is not truncated, and clears the password', async () => {
    const host = await open();
    type(field(host, 'Username'), 'u'.repeat(257));
    type(field(host, 'Password'), 'p');
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(h.count(LOGIN)).toBe(0);
    expect(text(noticeOf(host))).toBe('Sign-in failedCheck your username and password, then try again.');
    expect(field(host, 'Username').value).toHaveLength(257);
    expect(field(host, 'Password').value).toBe('');
    expect(document.activeElement).toBe(field(host, 'Username'));

    type(field(host, 'Username'), 'm.iqbal');
    type(field(host, 'Password'), 'p'.repeat(1025));
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(h.count(LOGIN)).toBe(0);
    expect(field(host, 'Password').value).toBe('');
    expect(document.activeElement).toBe(field(host, 'Password'));
  });

  it('a password of exactly the limit goes to the server untrimmed', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('INVALID_CREDENTIALS'));
    await signInWith(host, 'm.iqbal', ` ${'p'.repeat(1022)} `);
    expect(h.count(LOGIN)).toBe(1);
    expect(JSON.parse(h.keyed(LOGIN)[0]!.body!).password).toHaveLength(1024);
  });
});

describe('case 5. load with me SESSION_IDLE', () => {
  it('is BO-01 resting, no notice, and a sign-in then succeeds', async () => {
    const host = await open(refusal('SESSION_IDLE'));
    expect(sessionState(host)).toBe('signed-out');
    expect(noticeOf(host)).toBeNull();
    h.reply(LOGIN, ok(VIEW));
    await signInWith(host);
    expect(sessionState(host)).toBe('signed-in');
  });

  it('a failed sign-in leaves BO-01 as it was', async () => {
    const host = await open(refusal('SESSION_IDLE'));
    h.reply(LOGIN, refusal('INVALID_CREDENTIALS'));
    await signInWith(host);
    expect(sessionState(host)).toBe('signed-out');
    expect(text(noticeOf(host)!.querySelector('strong'))).toBe('Sign-in failed');
  });
});

describe('failures of the lookup and the sign-in', () => {
  it('a failed first read draws the form with its controls off, and Try again repeats the read', async () => {
    const host = await open({ status: 502 });
    expect(sessionState(host)).toBe('signed-out');
    expect(text(noticeOf(host))).toBe(
      'Something went wrongTry again. If the problem continues, ask a manager for help.Try again'
    );
    expect(field(host, 'Username').disabled).toBe(true);
    expect(field(host, 'Password').disabled).toBe(true);
    expect(button(host, 'Sign in').getAttribute('aria-disabled')).toBe('true');
    h.reply(ME, ok(VIEW));
    act(() => button(host, 'Try again').click());
    await h.settle();
    expect(sessionState(host)).toBe('signed-in');
    expect(h.count(ME)).toBe(2);
  });

  it('an unavailable first read says so', async () => {
    h.reply(HEALTH, { status: 503 });
    const host = await open('reject');
    expect(text(noticeOf(host)!.querySelector('strong'))).toBe('The system is unavailable');
    expect(text(noticeOf(host)!.querySelector('p'))).toBe('Wait a moment, then try again.');
  });

  it('a failed sign-in draws the shared copy; Try again resends nothing and asks for fresh entry', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('INTERNAL', undefined, 500));
    await signInWith(host);
    expect(text(noticeOf(host)!.querySelector('strong'))).toBe('Something went wrong');
    expect(field(host, 'Username').value).toBe('m.iqbal');
    expect(field(host, 'Password').value).toBe('');
    act(() => button(host, 'Try again').click());
    expect(noticeOf(host)).toBeNull();
    expect(h.count(LOGIN)).toBe(1);

    h.reply(LOGIN, 'reject');
    h.reply(HEALTH, { status: 503 });
    await signInWith(host);
    expect(text(noticeOf(host)!.querySelector('strong'))).toBe('The system is unavailable');
  });

  it.each(['APPROVAL_FAILED', 'APPROVAL_THROTTLED', 'VALIDATION_FAILED', 'FORBIDDEN', 'SESSION_IDLE'])(
    'an unexpected %s on a sign-in is the general failure',
    async (code) => {
      const host = await open();
      h.reply(LOGIN, refusal(code, undefined, 403));
      await signInWith(host);
      expect(text(noticeOf(host)!.querySelector('strong'))).toBe('Something went wrong');
    }
  );

  it('a sign-in answered session-gone leaves BO-01 as it was, with no notice', async () => {
    const host = await open();
    // A CSRF refusal with nobody held cannot be retried: the core answers session-gone.
    h.reply(LOGIN, refusal('CSRF_REFUSED', undefined, 403));
    await signInWith(host);
    expect(sessionState(host)).toBe('signed-out');
    expect(noticeOf(host)).toBeNull();
    expect(field(host, 'Password').value).toBe('');
  });

  it('a manager-access refusal at load draws Access refused, with the ordinary form', async () => {
    const host = await open(refusal('FORBIDDEN', undefined, 403));
    expect(text(noticeOf(host))).toBe(
      'Manager access requiredThis account cannot use the back office. Sign in with a manager account.'
    );
    expect(field(host, 'Username').disabled).toBe(false);
  });
});

describe('ruling 9. one cookie-changing request at a time', () => {
  it('a second submission while a sign-in is pending sends nothing', async () => {
    const host = await open();
    const held = h.hold(LOGIN);
    type(field(host, 'Username'), 'm.iqbal');
    type(field(host, 'Password'), 'pw');
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(button(host, 'Signing in…')).toBeTruthy();
    expect(field(host, 'Username').disabled).toBe(true);
    expect(button(host, 'Signing in…').getAttribute('aria-disabled')).toBe('true');
    act(() => button(host, 'Signing in…').click());
    act(() => {
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await h.settle();
    expect(h.count(LOGIN)).toBe(1);
    held.deliver(ok(VIEW));
    await h.settle();
    expect(sessionState(host)).toBe('signed-in');
  });
});
