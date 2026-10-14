import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FetchLike } from '@pos/api-client';
import { PosRoutes } from '../src/PosRoutes.js';
import { createRealSession } from '../src/session/realSession.js';
import { SessionProvider } from '../src/session/useSession.js';
import type { SessionStore } from '../src/session/types.js';

// A stubbed `fetch`, a manual monotonic clock and manual timers for the real
// session. Nothing here touches the network; time moves only when `advance` says.

export type Reply = { status: number; body?: unknown } | 'hang' | 'reject';
export type Call = { method: string; url: string; body: string | undefined; headers: Record<string, string> };

export const VIEW = {
  staffUserId: 'u-1',
  name: 'Dewi S.',
  role: 'CASHIER' as const,
  csrfToken: 'tok-1',
  idleSeconds: 90,
  idleRemainingSeconds: 60,
};

export const ok = (body?: unknown): Reply => ({ status: 200, body });
export const noContent: Reply = { status: 204 };
export const refusal = (code: string, details?: { retryAfterSeconds: number }, status = 401): Reply => ({
  status,
  body: { error: details ? { code, details } : { code } },
});

export const LOGIN = 'POST /api/pos/auth/login';
export const ME = 'GET /api/pos/auth/me';
export const ACTIVITY = 'POST /api/pos/auth/activity';
export const RELEASE = 'POST /api/pos/auth/release';
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
    if (next === 'hang') return new Promise(() => {});
    if (next === 'reject') throw new Error('network');
    return { status: next.status, text: async () => (next.body === undefined ? '' : JSON.stringify(next.body)) };
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

  return { store, reply, calls, advance, settle, count, keyed };
}

export function mount(store: SessionStore, path: string) {
  window.history.replaceState(null, '', path);
  const host = document.createElement('div');
  document.body.append(host);
  const root: Root = createRoot(host);
  act(() => root.render(<SessionProvider store={store}><PosRoutes /></SessionProvider>));
  return {
    host,
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

export function key(host: HTMLElement, label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll<HTMLButtonElement>('button.key')].find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent) === label
  );
  if (!found) throw new Error(`no key labelled ${label}`);
  return found;
}

export function typeDigits(host: HTMLElement, digits: string) {
  for (const d of digits) act(() => key(host, d).click());
}

export const lockState = (host: HTMLElement) => host.querySelector('[data-lock-state]')?.getAttribute('data-lock-state');
