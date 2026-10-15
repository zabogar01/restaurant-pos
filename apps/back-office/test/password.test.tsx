// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEALTH, LOGIN, ME, VIEW, button, field, makeHarness, mount, ok, refusal, type } from './session-harness.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Case 15, B-12 for the password: after a submission it is in its own request body
// and nowhere else; no input ever has a `value` attribute.

const SECRET = 'S3cret-Pw-7f2e91';

let h: ReturnType<typeof makeHarness>;
let view: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
  h.reply(ME, refusal('UNAUTHENTICATED'));
});
afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.restoreAllMocks();
});

const dom = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;

function whereTheSecretIs(host: HTMLElement): string[] {
  const found: string[] = [];
  const html = document.documentElement.outerHTML;
  if (html.includes(SECRET)) found.push('the document markup');
  for (const input of document.querySelectorAll('input')) {
    if (input.hasAttribute('value')) found.push(`a value attribute on #${input.id}`);
    if (input.getAttribute('value')?.includes(SECRET)) found.push('an attribute');
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
    if (call.url.includes(SECRET)) found.push(`a URL (${call.url})`);
    if (JSON.stringify(call.headers).includes(SECRET)) found.push('a header');
    if (call.body?.includes(SECRET) && `${call.method} ${call.url}` !== LOGIN) found.push(`the body of ${call.url}`);
  }
  expect(host.isConnected).toBe(true);
  return found;
}

describe('case 15. the password', () => {
  for (const [name, answer] of [
    ['a success', ok(VIEW)],
    ['a refusal', refusal('INVALID_CREDENTIALS')],
    ['a cooldown', refusal('THROTTLED', { retryAfterSeconds: 30 }, 429)],
    ['a failure', refusal('INTERNAL', undefined, 500)],
  ] as const) {
    it(`after ${name} it is in its own request body and nowhere else`, async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
      view = mount(h.store);
      await h.settle();
      const host = view.host;
      // Every input, before and after: none has a value attribute.
      expect(whereTheSecretIs(host)).toEqual([]);

      h.reply(LOGIN, answer);
      type(field(host, 'Username'), 'm.iqbal');
      type(field(host, 'Password'), SECRET);
      expect(whereTheSecretIs(host)).toEqual([]);
      act(() => button(host, 'Sign in').click());
      await h.settle();

      expect(h.keyed(LOGIN)).toHaveLength(1);
      expect(JSON.parse(h.keyed(LOGIN)[0]!.body!)).toEqual({ username: 'm.iqbal', password: SECRET });
      expect(whereTheSecretIs(host)).toEqual([]);
      const password = host.querySelector<HTMLInputElement>('input[type="password"]');
      if (password) expect(password.value).toBe('');
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    });
  }

  it('the form is method="post", has no action, and its submission is prevented', async () => {
    view = mount(h.store);
    await h.settle();
    const form = view.host.querySelector('form')!;
    expect(form.getAttribute('method')).toBe('post');
    expect(form.hasAttribute('action')).toBe(false);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    act(() => {
      form.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('carries the standard autocomplete hints and no value attribute, in every state of the form', async () => {
    view = mount(h.store);
    await h.settle();
    const host = view.host;
    expect(field(host, 'Username').getAttribute('autocomplete')).toBe('username');
    expect(field(host, 'Password').getAttribute('autocomplete')).toBe('current-password');
    // The empty-submission and oversize states: still no value attribute.
    act(() => button(host, 'Sign in').click());
    type(field(host, 'Username'), 'u'.repeat(300));
    type(field(host, 'Password'), 'x');
    act(() => button(host, 'Sign in').click());
    for (const input of host.querySelectorAll('input')) expect(input.hasAttribute('value')).toBe(false);
  });

  it('has no PIN, remember-me, reveal, strength or recovery control', async () => {
    view = mount(h.store);
    await h.settle();
    const host = view.host;
    expect([...host.querySelectorAll('input')].map((i) => i.type).sort()).toEqual(['password', 'text']);
    expect(host.querySelectorAll('button')).toHaveLength(1);
    expect(host.textContent).not.toMatch(/forgot|remember|show|reveal|strength|pin/i);
  });
});
