// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lockedFor, SIGN_IN_FAILED } from '../src/copy.js';
import { USERNAME_LIMIT, PASSWORD_LIMIT } from '../src/SignIn.js';
import {
  ACTIVITY, HEALTH, LOGIN, LOGOUT, ME, VIEW,
  button, field, makeHarness, mount, noContent, noticeOf, ok, press, refusal, sessionState, text, type,
} from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// PHASE1-S10: where focus lands at BO-01 in every case of DESIGN-016, the marking of the
// invalid fields, and the lock announced once.

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

async function open(me: ReturnType<typeof refusal> | ReturnType<typeof ok> | { status: number } | 'reject' = refusal('UNAUTHENTICATED')) {
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

const focused = () => document.activeElement;
const submitNow = (host: HTMLElement) => {
  act(() => button(host, 'Sign in').click());
};

describe('where focus lands when BO-01 first draws', () => {
  it('resting: on Username', async () => {
    const host = await open();
    expect(focused()).toBe(field(host, 'Username'));
  });

  it('refused: on Username', async () => {
    const host = await open(refusal('FORBIDDEN', undefined, 403));
    expect(focused()).toBe(field(host, 'Username'));
  });

  it('ended: on Username', async () => {
    const host = await open(ok(VIEW));
    h.reply(ACTIVITY, refusal('UNAUTHENTICATED'));
    press();
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(focused()).toBe(field(host, 'Username'));
  });

  it('after an explicit logout: on Username', async () => {
    const host = await open(ok(VIEW));
    h.reply(LOGOUT, noContent);
    act(() => button(host, 'Log out').click());
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(focused()).toBe(field(host, 'Username'));
  });
});

describe('local validation: marking and focus', () => {
  it('at rest neither field has aria-invalid or aria-describedby', async () => {
    const host = await open();
    for (const label of ['Username', 'Password']) {
      expect(field(host, label).hasAttribute('aria-describedby')).toBe(false);
      expect(field(host, label).hasAttribute('aria-invalid')).toBe(false);
    }
  });

  it('a blank submit marks both fields with their own messages and focuses Username', async () => {
    const host = await open();
    submitNow(host);
    expect(h.count(LOGIN)).toBe(0);
    expect(field(host, 'Username').getAttribute('aria-invalid')).toBe('true');
    expect(field(host, 'Password').getAttribute('aria-invalid')).toBe('true');
    expect(field(host, 'Username').getAttribute('aria-describedby')).toBe('bo-username-error');
    expect(field(host, 'Password').getAttribute('aria-describedby')).toBe('bo-password-error');
    expect(host.querySelector('#bo-username-error')).not.toBeNull();
    expect(host.querySelector('#bo-password-error')).not.toBeNull();
    expect(focused()).toBe(field(host, 'Username'));
  });

  it('only the password missing: Username is not marked, Password is, and focus goes to Password', async () => {
    const host = await open();
    type(field(host, 'Username'), 'm.iqbal');
    submitNow(host);
    expect(field(host, 'Username').hasAttribute('aria-invalid')).toBe(false);
    expect(field(host, 'Username').hasAttribute('aria-describedby')).toBe(false);
    expect(field(host, 'Password').getAttribute('aria-invalid')).toBe('true');
    expect(focused()).toBe(field(host, 'Password'));
  });

  it('both oversize: both marked and described by the notice body, no inline text, Password cleared, focus on Username', async () => {
    const host = await open();
    type(field(host, 'Username'), 'u'.repeat(USERNAME_LIMIT + 1));
    type(field(host, 'Password'), 'p'.repeat(PASSWORD_LIMIT + 1));
    submitNow(host);
    expect(h.count(LOGIN)).toBe(0);
    const body = noticeOf(host)!.querySelector('p')!;
    expect(text(noticeOf(host))).toContain(SIGN_IN_FAILED.title);
    expect(body.id).not.toBe('');
    for (const label of ['Username', 'Password']) {
      expect(field(host, label).getAttribute('aria-invalid')).toBe('true');
      expect(field(host, label).getAttribute('aria-describedby')).toBe(body.id);
    }
    expect(host.querySelector('.office-error')).toBeNull();
    expect(field(host, 'Username').value).toHaveLength(USERNAME_LIMIT + 1);
    expect(field(host, 'Password').value).toBe('');
    expect(focused()).toBe(field(host, 'Username'));
  });

  it('only the password oversize: only Password is marked, and focus goes to it', async () => {
    const host = await open();
    type(field(host, 'Username'), 'm.iqbal');
    type(field(host, 'Password'), 'p'.repeat(PASSWORD_LIMIT + 1));
    submitNow(host);
    expect(field(host, 'Username').hasAttribute('aria-invalid')).toBe(false);
    expect(field(host, 'Username').hasAttribute('aria-describedby')).toBe(false);
    expect(field(host, 'Password').getAttribute('aria-describedby')).toBe(noticeOf(host)!.querySelector('p')!.id);
    expect(focused()).toBe(field(host, 'Password'));
  });

  it('an oversize username with the password empty marks both, each its own way, and focuses Username', async () => {
    const host = await open();
    type(field(host, 'Username'), 'u'.repeat(USERNAME_LIMIT + 1));
    submitNow(host);
    expect(field(host, 'Username').getAttribute('aria-describedby')).toBe(noticeOf(host)!.querySelector('p')!.id);
    expect(field(host, 'Password').getAttribute('aria-describedby')).toBe('bo-password-error');
    expect(host.querySelector('#bo-username-error')).toBeNull();
    expect(focused()).toBe(field(host, 'Username'));
  });

  it('editing Username clears its own marking and description', async () => {
    const host = await open();
    submitNow(host);
    type(field(host, 'Username'), 'm');
    expect(field(host, 'Username').hasAttribute('aria-invalid')).toBe(false);
    expect(field(host, 'Username').hasAttribute('aria-describedby')).toBe(false);
    expect(host.querySelector('#bo-username-error')).toBeNull();
  });
});

describe('after an answer that was not a sign-in', () => {
  it('INVALID_CREDENTIALS: Username kept, Password cleared, focus on Password', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('INVALID_CREDENTIALS'));
    await signInWith(host);
    expect(field(host, 'Username').value).toBe('m.iqbal');
    expect(field(host, 'Password').value).toBe('');
    expect(focused()).toBe(field(host, 'Password'));
  });

  it('a general failure: Password cleared and focused; Try again resends nothing and focuses Password', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('INTERNAL', undefined, 500));
    await signInWith(host);
    expect(field(host, 'Password').value).toBe('');
    expect(focused()).toBe(field(host, 'Password'));
    act(() => button(host, 'Try again').click());
    expect(h.count(LOGIN)).toBe(1);
    expect(field(host, 'Password').value).toBe('');
    expect(focused()).toBe(field(host, 'Password'));
  });

  it('an unavailable system: Password focused, and Try again focuses it again', async () => {
    const host = await open();
    h.reply(LOGIN, 'reject');
    h.reply(HEALTH, { status: 503 });
    await signInWith(host);
    expect(text(noticeOf(host)!.querySelector('strong'))).not.toBe('');
    expect(focused()).toBe(field(host, 'Password'));
    act(() => field(host, 'Username').focus());
    act(() => button(host, 'Try again').click());
    expect(h.count(LOGIN)).toBe(1);
    expect(focused()).toBe(field(host, 'Password'));
  });
});

describe('a failed first lookup', () => {
  it('both fields and Sign in are off, focus is on Try again, and a lookup that then succeeds focuses Username', async () => {
    const host = await open({ status: 502 });
    expect(field(host, 'Username').disabled).toBe(true);
    expect(field(host, 'Password').disabled).toBe(true);
    expect(button(host, 'Sign in').getAttribute('aria-disabled')).toBe('true');
    expect(focused()).toBe(button(host, 'Try again'));

    h.reply(ME, refusal('UNAUTHENTICATED'));
    act(() => button(host, 'Try again').click());
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(field(host, 'Username').disabled).toBe(false);
    expect(focused()).toBe(field(host, 'Username'));
  });
});

describe('loading', () => {
  it('both fields and Sign in are off and Sign in reads Signing in…', async () => {
    const host = await open();
    const held = h.hold(LOGIN);
    type(field(host, 'Username'), 'm.iqbal');
    type(field(host, 'Password'), 'pw');
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(field(host, 'Username').disabled).toBe(true);
    expect(field(host, 'Password').disabled).toBe(true);
    expect(button(host, 'Signing in…').getAttribute('aria-disabled')).toBe('true');
    held.deliver(ok(VIEW));
    await h.settle();
  });
});

describe('a cooldown', () => {
  const lock = refusal('THROTTLED', { retryAfterSeconds: 120 }, 429);

  it('the answer leaves focus on Username, the only field that can be edited', async () => {
    const host = await open();
    h.reply(LOGIN, lock);
    await signInWith(host);
    expect(field(host, 'Password').disabled).toBe(true);
    expect(focused()).toBe(field(host, 'Username'));
  });

  it('editing Username away from and back to the locked account never moves focus', async () => {
    const host = await open();
    h.reply(LOGIN, lock);
    await signInWith(host);
    type(field(host, 'Username'), 'someone.else');
    expect(focused()).toBe(field(host, 'Username'));
    type(field(host, 'Username'), 'm.iqbal');
    expect(focused()).toBe(field(host, 'Username'));
    expect(field(host, 'Password').disabled).toBe(true);
  });

  it('a wait reaching zero with focus in Username leaves it there, and sends nothing', async () => {
    const host = await open();
    h.reply(LOGIN, lock);
    await signInWith(host);
    const before = h.calls.length;
    await h.advance(121_000);
    expect(field(host, 'Password').disabled).toBe(false);
    expect(focused()).toBe(field(host, 'Username'));
    expect(h.calls.length).toBe(before);
  });

  it('a wait reaching zero with focus elsewhere moves it to Password', async () => {
    const host = await open();
    h.reply(LOGIN, lock);
    await signInWith(host);
    act(() => button(host, 'Sign in').focus());
    expect(focused()).toBe(button(host, 'Sign in'));
    await h.advance(121_000);
    expect(field(host, 'Password').disabled).toBe(false);
    expect(focused()).toBe(field(host, 'Password'));
  });
});

describe('criterion 5. the lock is announced once', () => {
  const statusOf = (host: HTMLElement) => host.querySelector<HTMLElement>('.login-panel [role="status"]')!;
  const announcement = (seconds: number) => `${lockedFor(seconds).title}. ${lockedFor(seconds).body}`;

  function watch(element: HTMLElement) {
    // The callback collects what is delivered while the test awaits; `writes` counts and resets.
    const delivered: MutationRecord[] = [];
    const observer = new MutationObserver((records) => delivered.push(...records));
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    return {
      writes: () => {
        const n = delivered.length + observer.takeRecords().length;
        delivered.length = 0;
        return n;
      },
      stop: () => observer.disconnect(),
    };
  }

  it('writes the status element once when a lock arrives, and not again for a tick, a trailing space or a case change', async () => {
    const host = await open();
    const status = statusOf(host);
    const seen = watch(status);
    h.reply(LOGIN, refusal('THROTTLED', { retryAfterSeconds: 300 }, 429));
    await signInWith(host);
    expect(seen.writes()).toBeGreaterThan(0);
    expect(status.textContent).toBe(announcement(300));

    // The visible notice counts down and is not a live region.
    const visible = noticeOf(host)!;
    expect(visible.hasAttribute('role')).toBe(false);
    expect(visible.getAttribute('aria-live')).toBe('off');
    await h.advance(3000);
    expect(text(visible.querySelector('strong'))).toBe(lockedFor(297).title);
    expect(seen.writes()).toBe(0);
    expect(status.textContent).toBe(announcement(300));

    type(field(host, 'Username'), 'm.iqbal ');
    type(field(host, 'Username'), 'M.IQBAL');
    expect(seen.writes()).toBe(0);
    expect(status.textContent).toBe(announcement(300));
    seen.stop();
  });

  it('emptied when no lock is shown, and written afresh when the locked account comes back', async () => {
    const host = await open();
    const status = statusOf(host);
    h.reply(LOGIN, refusal('THROTTLED', { retryAfterSeconds: 300 }, 429));
    await signInWith(host);
    await h.advance(3000);
    const seen = watch(status);

    type(field(host, 'Username'), 'someone.else');
    expect(seen.writes()).toBeGreaterThan(0);
    expect(status.textContent).toBe('');

    type(field(host, 'Username'), 'm.iqbal');
    expect(seen.writes()).toBeGreaterThan(0);
    expect(status.textContent).toBe(announcement(297));
    seen.stop();
  });

  it('a lock for a different account is announced on its own', async () => {
    const host = await open();
    const status = statusOf(host);
    h.reply(LOGIN, refusal('THROTTLED', { retryAfterSeconds: 300 }, 429));
    await signInWith(host, 'first');
    await h.advance(60_000);
    h.reply(LOGIN, refusal('THROTTLED', { retryAfterSeconds: 120 }, 429));
    type(field(host, 'Username'), 'second');
    const seen = watch(status);
    type(field(host, 'Password'), 'x');
    act(() => button(host, 'Sign in').click());
    await h.settle();
    expect(seen.writes()).toBeGreaterThan(0);
    expect(status.textContent).toBe(announcement(120));
    seen.stop();
  });

  it('every other notice keeps role="alert", and a lock gives it up', async () => {
    const host = await open();
    h.reply(LOGIN, refusal('INVALID_CREDENTIALS'));
    await signInWith(host);
    expect(noticeOf(host)!.getAttribute('role')).toBe('alert');
    expect(statusOf(host).textContent).toBe('');
  });
});
