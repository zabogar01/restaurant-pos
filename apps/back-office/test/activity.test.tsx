// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACTIVITY_WINDOW_MS } from '../src/session/activity.js';
import { ACTIVITY, HEALTH, ME, VIEW, makeHarness, mount, noContent, ok, press, sessionState } from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// FR-A2b, AC-28 and ARCH-014 question 6, with the back office's window and `wheel`.

let h: ReturnType<typeof makeHarness>;
let view: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
  h.reply(ME, ok(VIEW));
  h.reply(ACTIVITY, noContent);
});
afterEach(() => {
  view?.unmount();
  view = undefined;
});

async function openSignedIn() {
  view = mount(h.store);
  await h.settle();
  expect(sessionState(view.host)).toBe('signed-in');
}

describe('case 13. activity is sent only from real input', () => {
  it('ten minutes of countdown and deadline reads with no input send none; then the leading edge only', async () => {
    h.reply(ME, ok({ ...VIEW, idleSeconds: 300, idleRemainingSeconds: 60 }));
    await openSignedIn();
    // Several deadline reads fire in ten minutes (each re-arms 60 s from the answer).
    await h.advance(600_000);
    expect(h.count(ME)).toBeGreaterThan(2);
    expect(h.count(ACTIVITY)).toBe(0);

    press('pointerdown');
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(1);
    for (let i = 0; i < 10; i += 1) press('pointerdown');
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(1);

    await h.advance(ACTIVITY_WINDOW_MS);
    press('pointerdown');
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(2);
  });

  it('the window is sixty seconds and a request has no body', async () => {
    await openSignedIn();
    expect(ACTIVITY_WINDOW_MS).toBe(60_000);
    press('keydown');
    await h.settle();
    await h.advance(ACTIVITY_WINDOW_MS - 1);
    press('keydown');
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(1);
    expect(h.keyed(ACTIVITY)[0]!.body).toBeUndefined();
  });

  it.each(['pointerdown', 'keydown', 'wheel'] as const)('a %s counts', async (name) => {
    await openSignedIn();
    press(name);
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(1);
  });

  it('pointer movement, focus and scroll are not input', async () => {
    await openSignedIn();
    for (const name of ['pointermove', 'mousemove', 'focusin', 'scroll', 'touchmove']) {
      document.body.dispatchEvent(new Event(name, { bubbles: true }));
    }
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(0);
  });

  it('reads nothing from the event: no key, no target, no body', async () => {
    await openSignedIn();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(1);
    expect(h.keyed(ACTIVITY)[0]!.body).toBeUndefined();
    expect(JSON.stringify(h.calls)).not.toContain('"p"');
  });

  it('sends nothing before a sign-in', async () => {
    h.reply(ME, { status: 401, body: { error: { code: 'UNAUTHENTICATED' } } });
    view = mount(h.store);
    await h.settle();
    press('pointerdown');
    await h.settle();
    expect(h.count(ACTIVITY)).toBe(0);
  });
});

describe('source scan: activity has one caller', () => {
  const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
  const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f));
  const read = (f: string) => readFileSync(join(src, f), 'utf8');
  const naming = (pattern: RegExp) => files.filter((f) => pattern.test(read(f))).sort();

  it('the activity route is named in api.ts and activity.ts only', () => {
    expect(naming(/auth\/activity/)).toEqual([join('session', 'activity.ts'), join('session', 'api.ts')]);
  });

  it('the function that sends it is called from the input listener’s module and nowhere else', () => {
    expect(naming(/\bsendActivity\(/)).toEqual([join('session', 'activity.ts')]);
    const text = read(join('session', 'activity.ts'));
    const listener = text.slice(text.indexOf('export function listenForActivity'));
    expect(listener).toMatch(/sendActivity\(options\)/);
    expect(text.slice(0, text.indexOf('export function listenForActivity')).match(/sendActivity\(options\)/g) ?? []).toEqual([]);
  });

  it('the listener is installed by the session module only', () => {
    expect(naming(/\blistenForActivity\(/)).toEqual([join('session', 'activity.ts'), join('session', 'realSession.ts')]);
  });
});
