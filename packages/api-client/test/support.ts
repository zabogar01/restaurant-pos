import { createApiClient } from '../src/index.js';
import type { ApiClientOptions, FetchLike, FetchResponse } from '../src/index.js';

export interface Call {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

type Reply = FetchResponse | Error | ((signal: AbortSignal) => Promise<FetchResponse>);

export const json = (status: number, body: unknown): FetchResponse => ({
  status,
  text: async () => JSON.stringify(body),
});
export const plain = (status: number, text: string): FetchResponse => ({
  status,
  text: async () => text,
});
export const empty = (status = 204): FetchResponse => plain(status, '');
export const envelope = (status: number, code: string, details?: unknown): FetchResponse =>
  json(status, { error: details === undefined ? { code } : { code, details } });

export function view(
  over: Partial<{
    staffUserId: string;
    csrfToken: string;
    idleSeconds: number;
    idleRemainingSeconds: number;
  }> = {}
) {
  return {
    staffUserId: 'staff-1',
    name: 'Ayu',
    role: 'CASHIER' as const,
    csrfToken: 'token-1',
    idleSeconds: 300,
    idleRemainingSeconds: 300,
    ...over,
  };
}

/** A fetch that answers each path from a queue and records every call. */
export function makeWorld(options: Partial<Pick<ApiClientOptions, 'surface'>> = {}) {
  const calls: Call[] = [];
  const queues = new Map<string, Reply[]>();
  let clock = 1000;
  const timers: Array<{ fire: () => void; ms: number; live: boolean }> = [];

  const fetch: FetchLike = async (url, init) => {
    calls.push({ path: url, method: init.method, headers: { ...init.headers }, body: init.body });
    const next = queues.get(url)?.shift();
    if (next === undefined) throw new Error(`No scripted reply for ${url}`);
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next(init.signal);
    return next;
  };

  const client = createApiClient({
    surface: options.surface ?? 'POS',
    fetch,
    now: () => clock,
    setTimer: (fire, ms) => {
      const timer = { fire, ms, live: true };
      timers.push(timer);
      return () => {
        timer.live = false;
      };
    },
  });

  return {
    client,
    calls,
    timers,
    script(path: string, ...replies: Reply[]) {
      queues.set(path, [...(queues.get(path) ?? []), ...replies]);
    },
    advance(ms: number) {
      clock += ms;
    },
    get clock() {
      return clock;
    },
    callsTo: (path: string) => calls.filter((call) => call.path === path),
  };
}
