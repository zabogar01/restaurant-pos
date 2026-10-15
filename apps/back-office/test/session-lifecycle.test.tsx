// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CSRF_HEADER } from '@pos/contracts';
import {
  ACTIVITY, HEALTH, LOGIN, LOGOUT, ME, VIEW,
  button, childMounts, field, makeHarness, mount, noContent, noticeOf, ok, press, refusal, sessionState, text, type,
} from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let h: ReturnType<typeof makeHarness>;
let view: ReturnType<typeof mount> | undefined;

const OTHER = { ...VIEW, staffUserId: 'm-2', name: 'R. Ayu', username: 'r.ayu', csrfToken: 'tok-2' };

beforeEach(() => {
  h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
  childMounts.count = 0;
});
afterEach(() => {
  view?.unmount();
  view = undefined;
});

async function open(me = ok(VIEW)) {
  h.reply(ME, me);
  view = mount(h.store);
  await h.settle();
  return view.host;
}

async function signInWith(host: HTMLElement, answer = ok(VIEW), username = 'm.iqbal') {
  h.reply(LOGIN, answer);
  type(field(host, 'Username'), username);
  type(field(host, 'Password'), 'correct horse');
  act(() => button(host, 'Sign in').click());
  await h.settle();
}

const area = (host: HTMLElement) => host.querySelector<HTMLElement>('.office-work');
const childInput = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#draft');
const pane = (host: HTMLElement) => host.querySelector<HTMLElement>('main.bocontent');
const frame = (host: HTMLElement) => host.querySelector('.botop');

/** The child holds a typed value, and the screen is then sent to BO-01 by `trigger`. */
async function loseSession(host: HTMLElement, answer: ReturnType<typeof refusal>) {
  type(childInput(host)!, 'half-typed note');
  h.reply(ACTIVITY, answer);
  press();
  await h.settle();
}

function becomeVisible() {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('case 9 (reworded). the working area is keyed by the staff user', () => {
  describe.each([
    ['UNAUTHENTICATED', refusal('UNAUTHENTICATED'), 'Your session has endedSign in again to continue.'],
    // Interim, until M-6 (PHASE0-011d2): an idle session shows BO-01 resting.
    ['SESSION_IDLE (ruling 3, interim)', refusal('SESSION_IDLE'), ''],
  ])('after %s', (_name, answer, notice) => {
    it('BO-01 shows, the child is still in the DOM, hidden and inert, and the same manager gets it as it was', async () => {
      const host = await open();
      await loseSession(host, answer);
      expect(sessionState(host)).toBe('signed-out');
      expect(text(noticeOf(host))).toBe(notice);
      expect(frame(host)).toBeNull();
      expect(childInput(host)).not.toBeNull();
      expect(pane(host)!.hidden).toBe(true);
      expect(pane(host)!.hasAttribute('inert')).toBe(true);
      expect(childInput(host)!.value).toBe('half-typed note');

      await signInWith(host, ok(VIEW));
      expect(sessionState(host)).toBe('signed-in');
      expect(pane(host)!.hidden).toBe(false);
      expect(pane(host)!.hasAttribute('inert')).toBe(false);
      expect(childInput(host)!.value).toBe('half-typed note');
      expect(childMounts.count).toBe(1);
    });

    it('another manager signing in gets a fresh child', async () => {
      const host = await open();
      await loseSession(host, answer);
      await signInWith(host, ok(OTHER), 'r.ayu');
      expect(sessionState(host)).toBe('signed-in');
      expect(childInput(host)!.value).toBe('');
      expect(childMounts.count).toBe(2);
    });
  });

  it('after the session is lost to another tab (actor-changed): BO-01 Session ended, sends nothing, keeps the child', async () => {
    const host = await open();
    type(childInput(host)!, 'half-typed note');
    h.reply(ME, ok(OTHER));
    becomeVisible();
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(text(noticeOf(host))).toBe('Your session has endedSign in again to continue.');
    expect(h.count(LOGOUT)).toBe(0);
    expect(childInput(host)!.value).toBe('half-typed note');

    await signInWith(host, ok(VIEW));
    expect(childInput(host)!.value).toBe('half-typed note');
    expect(childMounts.count).toBe(1);
  });

  it('after actor-changed, another manager signing in gets a fresh child', async () => {
    const host = await open();
    type(childInput(host)!, 'half-typed note');
    h.reply(ME, ok(OTHER));
    becomeVisible();
    await h.settle();
    await signInWith(host, ok(OTHER), 'r.ayu');
    expect(childInput(host)!.value).toBe('');
    expect(childMounts.count).toBe(2);
  });

  it('FORBIDDEN removes the working area and draws Access refused (case 12)', async () => {
    const host = await open();
    await loseSession(host, refusal('FORBIDDEN', undefined, 403));
    expect(sessionState(host)).toBe('signed-out');
    expect(text(noticeOf(host))).toBe(
      'Manager access requiredThis account cannot use the back office. Sign in with a manager account.'
    );
    expect(area(host)).toBeNull();
    expect(frame(host)).toBeNull();
    // The same manager signing in again starts with a fresh area.
    await signInWith(host, ok(VIEW));
    expect(childInput(host)!.value).toBe('');
    expect(childMounts.count).toBe(2);
  });

  it('FORBIDDEN on the deadline read signs out too (case 12)', async () => {
    const host = await open();
    h.reply(ME, refusal('FORBIDDEN', undefined, 403));
    becomeVisible();
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(area(host)).toBeNull();
  });

  it('a reload (a new store) starts without it', async () => {
    const host = await open();
    type(childInput(host)!, 'half-typed note');
    view!.unmount();
    h = makeHarness();
    h.reply(HEALTH, ok({ status: 'ok' }));
    const again = await open();
    expect(childInput(again)!.value).toBe('');
  });
});

describe('case 11 (reworded) and ruling 5. a logout is confirmed or it is nothing', () => {
  it('answered 204: BO-01 resting and the working area gone', async () => {
    const host = await open();
    h.reply(LOGOUT, noContent);
    act(() => button(host, 'Log out').click());
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(noticeOf(host)).toBeNull();
    expect(area(host)).toBeNull();
    expect(h.keyed(LOGOUT)[0]!.headers[CSRF_HEADER]).toBe('tok-1');
  });

  it.each([
    ['a 500', refusal('INTERNAL', undefined, 500), { status: 200, body: { status: 'ok' } }, 'Something went wrong', 'Try again. If the problem continues, ask a manager for help.'],
    ['no answer', 'reject' as const, { status: 503 }, 'The system is unavailable', 'Wait a moment, then try again.'],
  ])('answered with %s: the frame stays, the amber notice is first in the pane, and Try again sends it with the token', async (_n, first, health, title, body) => {
    const host = await open();
    type(childInput(host)!, 'half-typed note');
    h.reply(LOGOUT, first, noContent);
    h.reply(HEALTH, health);
    act(() => button(host, 'Log out').click());
    await h.settle();

    expect(sessionState(host)).toBe('signed-in');
    expect(text(frame(host)!.querySelector('.office-actor'))).toBe('M. Iqbal');
    const first_ = pane(host)!.firstElementChild!;
    expect(first_.classList.contains('office-notice--amber')).toBe(true);
    expect(text(first_)).toBe(`${title}${body}Sign-out has not been confirmed.Try again`);
    expect(first_.getAttribute('role')).toBe('alert');
    expect(childInput(host)!.value).toBe('half-typed note');

    act(() => button(host, 'Try again').click());
    await h.settle();
    const sent = h.keyed(LOGOUT);
    expect(sent).toHaveLength(2);
    expect(sent.map((c) => c.headers[CSRF_HEADER])).toEqual(['tok-1', 'tok-1']);
    expect(sessionState(host)).toBe('signed-out');
    expect(area(host)).toBeNull();
  });

  it('while a logout is in flight Log out and Try again are inert, and a second sends nothing (ruling 9)', async () => {
    const host = await open();
    h.reply(LOGOUT, refusal('INTERNAL', undefined, 500), noContent);
    act(() => button(host, 'Log out').click());
    await h.settle();

    const held = h.hold(LOGOUT);
    act(() => button(host, 'Try again').click());
    await h.settle();
    expect(button(host, 'Try again').getAttribute('aria-disabled')).toBe('true');
    expect(button(host, 'Log out').getAttribute('aria-disabled')).toBe('true');
    act(() => button(host, 'Try again').click());
    act(() => button(host, 'Log out').click());
    await h.settle();
    expect(h.count(LOGOUT)).toBe(2);
    held.deliver(noContent);
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
  });

  it('sends no activity while a logout is in flight or unconfirmed', async () => {
    const host = await open();
    const held = h.hold(LOGOUT);
    act(() => button(host, 'Log out').click());
    await h.settle();
    await h.advance(120_000);
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(0);

    held.deliver(refusal('INTERNAL', undefined, 500));
    await h.settle();
    expect(sessionState(host)).toBe('signed-in');
    await h.advance(120_000);
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(0);
  });

  it('an end answered meanwhile follows its own row', async () => {
    const host = await open();
    h.reply(LOGOUT, refusal('INTERNAL', undefined, 500));
    act(() => button(host, 'Log out').click());
    await h.settle();
    h.reply(LOGOUT, refusal('UNAUTHENTICATED'));
    act(() => button(host, 'Try again').click());
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(text(noticeOf(host))).toBe('Your session has endedSign in again to continue.');
    expect(childInput(host)).not.toBeNull();
  });
});

describe('ruling 8. no session read signs this tab in, except the first', () => {
  it('(a) signed in as A, a visibility me answers B’s view: BO-01 Session ended, the frame absent, no activity after', async () => {
    const host = await open();
    h.reply(ME, ok(OTHER));
    becomeVisible();
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(text(noticeOf(host))).toBe('Your session has endedSign in again to continue.');
    expect(frame(host)).toBeNull();
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(0);
  });

  it('(b) a visibility me is held, Log out is answered 204, then me’s A view is delivered: BO-01 resting, no frame, no activity', async () => {
    const host = await open();
    const read = h.hold(ME);
    becomeVisible();
    await h.settle();
    h.reply(LOGOUT, noContent);
    act(() => button(host, 'Log out').click());
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');

    read.deliver(ok(VIEW));
    await h.settle();
    expect(sessionState(host)).toBe('signed-out');
    expect(noticeOf(host)).toBeNull();
    expect(frame(host)).toBeNull();
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(0);
  });

  it('a deadline read that names the same manager re-arms the deadline and changes nothing on screen', async () => {
    const host = await open();
    h.reply(ME, ok({ ...VIEW, idleRemainingSeconds: 1800 }));
    becomeVisible();
    await h.settle();
    expect(sessionState(host)).toBe('signed-in');
    expect(h.count(ME)).toBe(2);
  });

  it('a failed deadline read leaves the manager as they are, with nothing drawn', async () => {
    const host = await open();
    h.reply(ME, refusal('INTERNAL', undefined, 500));
    becomeVisible();
    await h.settle();
    expect(sessionState(host)).toBe('signed-in');
    expect(noticeOf(host)).toBeNull();
  });
});

describe('the deadline read', () => {
  it('reads me at the deadline, extends nothing, and a refused read ends the session on screen', async () => {
    const host = await open(ok({ ...VIEW, idleRemainingSeconds: 10 }));
    h.reply(ME, refusal('SESSION_IDLE'));
    await h.advance(9_999);
    expect(h.count(ME)).toBe(1);
    await h.advance(2);
    expect(h.count(ME)).toBe(2);
    expect(h.count(ACTIVITY)).toBe(0);
    expect(sessionState(host)).toBe('signed-out');
    expect(childInput(host)).not.toBeNull();
  });
});
