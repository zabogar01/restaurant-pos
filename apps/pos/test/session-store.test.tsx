// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_WINDOW_MS } from '../src/session/activity.js';
import {
  ACTIVITY, HEALTH, LOGIN, ME, RELEASE, VIEW,
  key, lockState, makeHarness, mount, noContent, ok, refusal, typeDigits,
} from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dom = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, { value: dom[name], configurable: true });
}

let h: ReturnType<typeof makeHarness>;
let view: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
});
afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

async function open(path: string, me = ok(VIEW)) {
  h.reply(ME, me);
  view = mount(h.store, path);
  await h.settle();
  return view.host;
}

const text = (el: Element) => el.textContent ?? '';
const noticeOf = (host: HTMLElement) => host.querySelector('.notice');
const press = () => act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));

async function signInWith(host: HTMLElement, pin = '123456') {
  typeDigits(host, pin);
  act(() => key(host, 'Continue').click());
  await h.settle();
}

describe('13. load with me 200', () => {
  it('is signed in at the URL’s route, with the name and role from the response', async () => {
    const host = await open('/pos/floor');
    expect(text(host.querySelector('.floor-actor')!)).toContain('Dewi S. · Cashier');
    expect(document.getElementById('root')).toBeNull();
    expect(window.location.pathname).toBe('/pos/floor');
  });

  it('replaces /pos/ with /pos/floor', async () => {
    const host = await open('/pos/');
    expect(window.location.pathname).toBe('/pos/floor');
    expect(host.querySelector('.floor-actor')).not.toBeNull();
  });

  it('keeps the URL of a route a person was on', async () => {
    await open('/pos/closed-orders?state=default');
    expect(window.location.pathname + window.location.search).toBe('/pos/closed-orders?state=default');
  });
});

describe('14. load with me refused', () => {
  it.each(['UNAUTHENTICATED', 'SESSION_IDLE'])('%s: POS-01 resting, no notice', async (code) => {
    const host = await open('/pos/floor', refusal(code));
    expect(lockState(host)).toBe('resting');
    expect(noticeOf(host)).toBeNull();
    expect(window.location.pathname).toBe('/pos/floor');
  });
});

describe('15. a sign-in', () => {
  it('posts exactly { pin } and shows the name and role it answers with', async () => {
    const host = await open('/pos/floor', refusal('UNAUTHENTICATED'));
    h.reply(LOGIN, ok({ ...VIEW, name: 'Budi K.', role: 'MANAGER' }));
    await signInWith(host, '482913');
    const [login] = h.keyed(LOGIN);
    expect(h.count(LOGIN)).toBe(1);
    expect(login!.body).toBe('{"pin":"482913"}');
    expect(text(host.querySelector('.floor-actor')!)).toContain('Budi K. · Manager');
  });
});

describe('16–18. refusals and a short entry', () => {
  it('16. INVALID_CREDENTIALS without details: error, keypad live', async () => {
    const host = await open('/pos/floor', refusal('UNAUTHENTICATED'));
    h.reply(LOGIN, refusal('INVALID_CREDENTIALS'));
    await signInWith(host);
    expect(lockState(host)).toBe('error');
    expect(text(noticeOf(host)!)).toBe(
      'PIN not recognisedEnter your six-digit PIN again. Ask a manager if you need help.'
    );
    typeDigits(host, '12');
    expect(host.querySelectorAll('.pin-dot--filled')).toHaveLength(2);
    expect(key(host, '1').getAttribute('aria-disabled')).toBeNull();
  });

  it.each([
    ['INVALID_CREDENTIALS', 300, 'Sign-in locked for 5 min'],
    ['THROTTLED', 240, 'Sign-in locked for 4 min'],
  ])('17. %s with %i seconds: throttled, counting down from the number, no request of its own', async (code, seconds, title) => {
    const host = await open('/pos/floor', refusal('UNAUTHENTICATED'));
    h.reply(LOGIN, refusal(code, { retryAfterSeconds: seconds }, 429));
    await signInWith(host);
    expect(lockState(host)).toBe('throttled');
    expect(text(noticeOf(host)!)).toContain(title);
    expect(key(host, 'Continue').getAttribute('aria-disabled')).toBe('true');
    const before = h.calls.length;

    await h.advance(1000);
    expect(text(noticeOf(host)!)).toContain(`Sign-in locked for ${seconds === 300 ? '4 min 59 s' : '3 min 59 s'}`);
    await h.advance((seconds - 1) * 1000 - 1);
    expect(lockState(host)).toBe('throttled');
    await h.advance(2);
    expect(lockState(host)).toBe('resting');
    expect(noticeOf(host)).toBeNull();
    expect(key(host, 'Continue').getAttribute('aria-disabled')).toBe('true'); // empty entry: six digits first
    typeDigits(host, '123456');
    expect(key(host, 'Continue').getAttribute('aria-disabled')).toBeNull();
    expect(h.calls.length).toBe(before);
  });

  it('17. a cooldown of zero draws no notice and enables entry, without submission', async () => {
    const host = await open('/pos/floor', refusal('UNAUTHENTICATED'));
    h.reply(LOGIN, refusal('THROTTLED', { retryAfterSeconds: 0 }, 429));
    await signInWith(host);
    expect(lockState(host)).toBe('resting');
    expect(h.count(LOGIN)).toBe(1);
  });

  it('18. fewer than six digits sends nothing', async () => {
    const host = await open('/pos/floor', refusal('UNAUTHENTICATED'));
    typeDigits(host, '12345');
    act(() => key(host, 'Continue').click());
    await h.settle();
    expect(h.count(LOGIN)).toBe(0);
  });

  it('a failed or unavailable sign-in draws the shared copy, and Try again resends nothing', async () => {
    const host = await open('/pos/floor', refusal('UNAUTHENTICATED'));
    h.reply(LOGIN, refusal('INTERNAL', undefined, 500));
    await signInWith(host);
    expect(lockState(host)).toBe('failed');
    expect(text(noticeOf(host)!)).toContain('Something went wrong');
    act(() => noticeOf(host)!.querySelector('button')!.click());
    expect(lockState(host)).toBe('resting');
    expect(h.count(LOGIN)).toBe(1);

    h.reply(LOGIN, 'reject');
    h.reply(HEALTH, { status: 503 });
    await signInWith(host);
    expect(lockState(host)).toBe('unavailable');
    expect(text(noticeOf(host)!)).toContain('The system is unavailable');
  });

  it('a failed first read draws the shell with the pad off, and Try again repeats the read', async () => {
    const host = await open('/pos/floor', { status: 502 });
    expect(lockState(host)).toBe('failed');
    expect(key(host, '1').getAttribute('aria-disabled')).toBe('true');
    h.reply(ME, ok(VIEW));
    act(() => noticeOf(host)!.querySelector('button')!.click());
    await h.settle();
    expect(h.count(ME)).toBe(2);
    expect(host.querySelector('.floor-actor')).not.toBeNull();
  });
});

describe('19. a held session ends', () => {
  it('SESSION_IDLE: POS-01 resting', async () => {
    const host = await open('/pos/floor');
    h.reply(ACTIVITY, refusal('SESSION_IDLE'));
    press();
    await h.settle();
    expect(lockState(host)).toBe('resting');
    expect(noticeOf(host)).toBeNull();
  });

  it('UNAUTHENTICATED: POS-01 session invalidated', async () => {
    const host = await open('/pos/floor');
    h.reply(ACTIVITY, refusal('UNAUTHENTICATED'));
    press();
    await h.settle();
    expect(lockState(host)).toBe('invalidated');
    expect(text(noticeOf(host)!)).toBe(
      'Your session has endedSign in again. Ask a manager for help if your PIN no longer works.'
    );
  });

  it('another tab signed in as someone else: invalidated, no release, no more activity', async () => {
    const host = await open('/pos/floor');
    h.reply(ACTIVITY, refusal('CSRF_REFUSED', undefined, 403));
    h.reply(ME, ok({ ...VIEW, staffUserId: 'u-2', name: 'Other P.' }));
    press();
    await h.settle();
    expect(lockState(host)).toBe('invalidated');
    expect(h.count(RELEASE)).toBe(0);
    const sent = h.count(ACTIVITY);
    await h.advance(ACTIVITY_WINDOW_MS + 1);
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(sent);
  });
});

describe('19b. a session read never signs this tab in again (review F1)', () => {
  const becomeVisible = () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
  };

  it('(a) a read that names another person: POS-01 session invalidated, the route gone, no activity', async () => {
    const host = await open('/pos/floor');
    h.reply(ME, ok({ ...VIEW, staffUserId: 'u-2', name: 'Other P.' }));
    becomeVisible();
    await h.settle();
    expect(lockState(host)).toBe('invalidated');
    expect(host.querySelector('.floor-actor')).toBeNull();
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(0);
    expect(h.count(RELEASE)).toBe(0);
  });

  it('(b) a read in flight when Release is pressed lands on POS-01 resting, before and after Release settles', async () => {
    const host = await open('/pos/floor');
    const read = h.hold(ME);
    const release = h.hold(RELEASE);
    becomeVisible();
    await h.settle();
    act(() => h.store.release());
    expect(lockState(host)).toBe('resting');

    read.deliver(ok(VIEW));
    await h.settle();
    expect(lockState(host)).toBe('resting');
    expect(host.querySelector('.floor-actor')).toBeNull();
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(0);

    release.deliver(noContent);
    await h.settle();
    expect(lockState(host)).toBe('resting');
    expect(host.querySelector('.floor-actor')).toBeNull();
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(0);
  });
});

describe('20. Release', () => {
  it.each([
    ['204', noContent],
    ['500', refusal('INTERNAL', undefined, 500)],
    ['no answer', 'hang' as const],
  ])('goes to POS-01 when the server answers %s, at once', async (_name, reply) => {
    const host = await open('/pos/floor');
    h.reply(RELEASE, reply);
    act(() => h.store.release());
    expect(lockState(host)).toBe('resting'); // before the answer is awaited
    await h.settle();
    expect(lockState(host)).toBe('resting');
    expect(h.count(RELEASE)).toBe(1);
  });

  it('one cookie-changing request at a time: a second release or a sign-in while one is pending sends nothing', async () => {
    const host = await open('/pos/floor');
    h.reply(RELEASE, 'hang');
    act(() => h.store.release());
    act(() => h.store.release());
    act(() => h.store.signIn('123456'));
    await h.settle();
    expect(h.count(RELEASE)).toBe(1);
    expect(h.count(LOGIN)).toBe(0);
    expect(key(host, 'Continue').getAttribute('aria-disabled')).toBe('true');
  });

  it('a second confirmation while a sign-in is pending sends nothing', async () => {
    await open('/pos/floor', refusal('UNAUTHENTICATED'));
    h.reply(LOGIN, 'hang');
    act(() => h.store.signIn('123456'));
    act(() => h.store.signIn('123456'));
    await h.settle();
    expect(h.count(LOGIN)).toBe(1);
  });
});

describe('21. activity is sent only from real input', () => {
  it('ten minutes of ticking and deadline reads send none; input sends on the leading edge only', async () => {
    await open('/pos/floor');
    for (let s = 0; s < 600; s += 1) await h.advance(1000);
    expect(h.count(ACTIVITY)).toBe(0);
    expect(h.count(ME)).toBeGreaterThan(1); // the deadline was read, repeatedly

    h.reply(ACTIVITY, noContent);
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(1);
    for (let i = 0; i < 10; i += 1) {
      act(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true })));
    }
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(1);
    await h.advance(ACTIVITY_WINDOW_MS + 1);
    press();
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(2);
    expect(h.keyed(ACTIVITY)[0]!.body).toBeUndefined();
  });

  it('only the input listener’s module calls the activity function', () => {
    const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f));
    const reading = (f: string) => readFileSync(join(src, f), 'utf8');
    // The call, by the POS API module's key, and the sender's name.
    const calling = files.filter((f) => /\['\/api\/pos\/auth\/activity'\]\(|sendActivity|posActivity/.test(reading(f)));
    expect(calling.sort()).toEqual([join('session', 'activity.ts'), join('session', 'api.ts')]);
    // api.ts only declares it; the one caller is the listener's module.
    const callers = files.filter((f) => /api\['\/api\/pos\/auth\/activity'\]\(/.test(reading(f)));
    expect(callers).toEqual([join('session', 'activity.ts')]);
  });
});

describe('22. the chip and the deadline read', () => {
  const chip = (host: HTMLElement) => host.querySelector('.floor-idle')?.textContent;

  it('shows the whole seconds left, reaches 0, reads me once, and a 200 re-arms it', async () => {
    const host = await open('/pos/floor', ok({ ...VIEW, idleRemainingSeconds: 3 }));
    expect(chip(host)).toBe('3s');
    await h.advance(1000);
    expect(chip(host)).toBe('2s');
    await h.advance(1000);
    expect(chip(host)).toBe('1s');
    expect(h.count(ME)).toBe(1);
    h.reply(ME, ok({ ...VIEW, idleRemainingSeconds: 40 }));
    await h.advance(1000);
    expect(h.count(ME)).toBe(2);
    expect(chip(host)).toBe('40s');
    expect(h.count(ACTIVITY)).toBe(0);
  });

  it('a SESSION_IDLE at the deadline locks', async () => {
    const host = await open('/pos/floor', ok({ ...VIEW, idleRemainingSeconds: 1 }));
    h.reply(ME, refusal('SESSION_IDLE'));
    await h.advance(1000);
    expect(chip(host)).toBeUndefined();
    expect(lockState(host)).toBe('resting');
  });

  it('becoming visible reads me once', async () => {
    await open('/pos/floor');
    expect(h.count(ME)).toBe(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await h.settle();
    expect(h.count(ME)).toBe(2);
    expect(h.count(ACTIVITY)).toBe(0);
  });
});

describe('23. the tender draft survives the lock', () => {
  it('POS-01 shows the draft from the store, and after sign-in the drafts are as they were', async () => {
    const host = await open('/pos/settlement?state=partial');
    const before = text(host);
    expect(before).toContain('Card');

    act(() => h.store.release());
    await h.settle();
    expect(lockState(host)).toBe('draft');
    expect(window.location.pathname + window.location.search).toBe('/pos/settlement?state=partial');
    expect(text(noticeOf(host)!)).toMatch(
      /^Payment in progress on this tab.+ — [\d.]+ outstanding, 1 tender drafted\. Sign in to continue\. Nothing has been recorded yet\.$/
    );

    h.reply(LOGIN, ok(VIEW));
    await signInWith(host);
    expect(lockState(host)).toBeUndefined();
    expect(text(host)).toBe(before);
  });
});

describe('23b. excess cash is zero outstanding, as settlement shows it (review F2)', () => {
  it('a cash draft above the total locks at "0 outstanding", never negative, and re-entry finds it intact', async () => {
    const host = await open('/pos/settlement?state=change');
    const before = text(host);
    expect(before).toContain('Cash');

    act(() => h.store.release());
    await h.settle();
    expect(lockState(host)).toBe('draft');
    expect(text(noticeOf(host)!)).toMatch(/ — 0 outstanding, 1 tender drafted\./);
    expect(text(noticeOf(host)!)).not.toContain('-');
    expect(text(noticeOf(host)!)).not.toContain('−');

    h.reply(LOGIN, ok(VIEW));
    await signInWith(host);
    expect(text(host)).toBe(before);
  });
});

describe('24. nothing of an approval prompt survives the session', () => {
  it('the prompt is gone while signed out and is a fresh one after sign-in', async () => {
    const host = await open('/pos/order?state=approval');
    const dialog = () => host.querySelector('[role="dialog"]');
    expect(dialog()).not.toBeNull();
    typeDigits(dialog() as HTMLElement, '482');
    expect(dialog()!.querySelectorAll('.pin-dot--filled')).toHaveLength(3);

    act(() => h.store.release());
    await h.settle();
    expect(dialog()).toBeNull();
    expect(text(host)).not.toContain('Manager');

    h.reply(LOGIN, ok(VIEW));
    await signInWith(host);
    expect(dialog()!.querySelectorAll('.pin-dot--filled')).toHaveLength(0);
  });
});

describe('26. B-12 on the real path', () => {
  it('the digits are in one request body and nowhere else', async () => {
    const consoleCalls = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    const host = await open('/pos/floor', refusal('UNAUTHENTICATED'));
    h.reply(LOGIN, refusal('INVALID_CREDENTIALS'));
    const pin = '482913';
    await signInWith(host, pin);
    h.reply(LOGIN, ok(VIEW));
    await signInWith(host, pin);
    press();
    await h.settle();

    const carrying = h.calls.filter((c) => c.body?.includes(pin) || c.url.includes(pin));
    expect(carrying.map((c) => `${c.method} ${c.url}`)).toEqual([LOGIN, LOGIN]);
    expect(h.calls.every((c) => !Object.values(c.headers).some((v) => v.includes(pin)))).toBe(true);
    expect(host.innerHTML).not.toContain(pin);
    expect(document.documentElement.outerHTML).not.toContain(pin);
    expect(window.location.href).not.toContain(pin);
    expect(JSON.stringify({ ...localStorage })).not.toContain(pin);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(pin);
    expect(consoleCalls.flatMap((spy) => spy.mock.calls)).toEqual([]);
  });
});
