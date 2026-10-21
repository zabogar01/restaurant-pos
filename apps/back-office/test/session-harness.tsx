import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FetchLike } from '@pos/api-client';
import { OfficeApp } from '../src/OfficeApp.js';
import { createRealSession } from '../src/session/realSession.js';
import { SessionProvider } from '../src/session/useSession.js';
import type { SessionStore } from '../src/session/types.js';
import { installDialogShim } from './dialog-shim.js';

// A stubbed `fetch`, a manual monotonic clock and manual timers for the real
// session. Nothing here touches the network; time moves only when `advance` says.

export type Reply = { status: number; body?: unknown } | 'hang' | 'reject' | { held: Promise<Reply> };
export type Call = { method: string; url: string; body: string | undefined; headers: Record<string, string> };

export const VIEW = {
  staffUserId: 'm-1',
  name: 'M. Iqbal',
  username: 'm.iqbal',
  role: 'MANAGER' as const,
  csrfToken: 'tok-1',
  idleSeconds: 1800,
  idleRemainingSeconds: 1200,
};

export const ok = (body?: unknown): Reply => ({ status: 200, body });
export const noContent: Reply = { status: 204 };
export const refusal = (code: string, details?: { retryAfterSeconds: number }, status = 401): Reply => ({
  status,
  body: { error: details ? { code, details } : { code } },
});

export const LOGIN = 'POST /api/back-office/auth/login';
export const ME = 'GET /api/back-office/auth/me';
export const ACTIVITY = 'POST /api/back-office/auth/activity';
export const LOGOUT = 'POST /api/back-office/auth/logout';
export const REAUTH = 'POST /api/back-office/auth/reauthenticate';
export const HEALTH = 'GET /api/health';

export function makeHarness() {
  let t = 1000;
  const timers = new Set<{ at: number; fire: () => void }>();
  const queues = new Map<string, Reply[]>();
  const calls: Call[] = [];

  const reply = (key: string, ...replies: Reply[]) => queues.set(key, replies);

  const fetchStub: FetchLike = async (url, init) => {
    const key = `${init.method} ${url}`;
    calls.push({ method: init.method, url, body: init.body, headers: init.headers });
    const queue = queues.get(key) ?? (key === HEALTH ? [ok({ status: 'ok' })] : [refusal('INTERNAL', undefined, 500)]);
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    const settled = typeof next === 'object' && 'held' in next ? await next.held : next;
    if (settled === 'hang') return new Promise(() => {});
    if (settled === 'reject') throw new Error('network');
    if ('held' in settled) throw new Error('a held reply resolves to a reply, not another hold');
    return { status: settled.status, text: async () => (settled.body === undefined ? '' : JSON.stringify(settled.body)) };
  };

  /** The next request to `key` is held until `deliver` is called with its answer; later ones follow the queue. */
  const hold = (key: string): { deliver: (answer: Reply) => void } => {
    let deliver!: (answer: Reply) => void;
    const held = new Promise<Reply>((resolve) => {
      deliver = resolve;
    });
    queues.set(key, [{ held }, ...(queues.get(key) ?? [refusal('INTERNAL', undefined, 500)])]);
    return { deliver };
  };

  const store: SessionStore = createRealSession({
    fetch: fetchStub,
    now: () => t,
    setTimer: (fire, ms) => {
      const entry = { at: t + ms, fire };
      timers.add(entry);
      return () => {
        timers.delete(entry);
      };
    },
  });

  const settle = async () => {
    for (let i = 0; i < 6; i += 1) await act(async () => {});
  };

  /** Moves the clock, firing each timer at its own moment, then lets promises settle. */
  async function advance(ms: number) {
    const target = t + ms;
    for (;;) {
      const due = [...timers].filter((e) => e.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers.delete(due);
      t = Math.max(t, due.at);
      await act(async () => due.fire());
      await settle();
    }
    t = target;
    await settle();
  }

  const count = (key: string) => calls.filter((c) => `${c.method} ${c.url}` === key).length;
  const keyed = (key: string) => calls.filter((c) => `${c.method} ${c.url}` === key);

  return { store, reply, hold, calls, advance, settle, count, keyed };
}

/**
 * A working area's child, test-only (it never lives in `src`): an input whose
 * typed value, and a mount counter, show whether the area was kept or rebuilt.
 */
export function TestChild() {
  const [mounted] = useState(() => {
    childMounts.count += 1;
    return childMounts.count;
  });
  return (
    <div data-child={mounted}>
      <label htmlFor="draft">Draft</label>
      <input id="draft" />
    </div>
  );
}

export const childMounts = { count: 0 };

/** `screen` is what the working area holds: the test's own child by default, or the real screens. */
export function mount(store: SessionStore, screen: ReactNode = <TestChild />) {
  installDialogShim();
  const host = document.createElement('div');
  host.id = 'root';
  document.body.append(host);
  const root: Root = createRoot(host);
  act(() =>
    root.render(
      <SessionProvider store={store}>
        <OfficeApp>{screen}</OfficeApp>
      </SessionProvider>
    )
  );
  return {
    host,
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

export const sessionState = (host: HTMLElement) => host.getAttribute('data-session');

export function field(host: HTMLElement, label: string): HTMLInputElement {
  const found = [...host.querySelectorAll<HTMLInputElement>('input')].find(
    (i) => host.querySelector(`label[for="${i.id}"]`)?.textContent === label
  );
  if (!found) throw new Error(`no field labelled ${label}`);
  return found;
}

export function button(host: HTMLElement, name: string): HTMLButtonElement {
  const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === name);
  if (!found) throw new Error(`no button named ${name}`);
  return found;
}

export function type(input: HTMLInputElement, value: string) {
  act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function submit(host: HTMLElement) {
  act(() => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

export const text = (el: Element | null) => el?.textContent ?? '';
export const noticeOf = (host: HTMLElement) => host.querySelector('.office-notice');
export const press = (name: 'pointerdown' | 'keydown' | 'wheel' = 'pointerdown') =>
  act(() => {
    document.body.dispatchEvent(new Event(name, { bubbles: true }));
  });
