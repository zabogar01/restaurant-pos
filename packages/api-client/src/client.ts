import { CSRF_HEADER, ErrorBody, ErrorCode, ROUTE_TABLE } from '@pos/contracts';
import { SPECS } from './specs.js';
import type { ArgsOf, Route, RoutePath, Schema, ValueOf } from './specs.js';

export type Surface = 'POS' | 'BACK_OFFICE';

/** The part of a response the core reads. The platform's `fetch` satisfies it. */
export interface FetchResponse {
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    credentials: 'same-origin';
    cache: 'no-store';
    redirect: 'error';
    signal: AbortSignal;
  }
) => Promise<FetchResponse>;

export interface ApiClientOptions {
  surface: Surface;
  fetch: FetchLike;
  /** A monotonic clock in milliseconds (`performance.now()`), never a wall clock. */
  now: () => number;
  /** Starts a timer and returns its canceller. Defaults to the platform's timers. */
  setTimer?: (fire: () => void, ms: number) => () => void;
  /** Defaults to ten seconds. */
  timeoutMs?: number;
}

/**
 * Every request ends as exactly one of these; nothing the server said is thrown.
 *
 * - `refused`: the body parsed as the envelope. Switch on `body.error.code`; narrowing
 *   on a code exposes that code's details.
 * - `failed`: something went wrong and the health read answered 200.
 * - `unavailable`: the health read answered otherwise or not at all.
 * - `invalid-request`: the body failed its request schema and was never sent.
 * - `session-gone`: a CSRF refusal that could not be retried because the session is no
 *   longer the one the request was made under. Nothing was retried and no release sent.
 */
export type ApiResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'refused'; body: ErrorBody }
  | { kind: 'failed' }
  | { kind: 'unavailable' }
  | { kind: 'invalid-request' }
  | { kind: 'session-gone' };

export type SessionEndReason =
  | 'SESSION_IDLE'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'SIGNED_OUT'
  | 'ACTOR_CHANGED';

export type ApiEvent =
  /** The idle deadline moved. `deadline` is on the injected clock, or null when none. */
  | { type: 'deadline'; deadline: number | null }
  /** The session ended in this client. At the back office the token is kept after SESSION_IDLE. */
  | { type: 'session-ended'; reason: SessionEndReason }
  /** A session view named a different person than the one this client held. */
  | { type: 'actor-changed'; staffUserId: string };

export interface ApiClient {
  readonly surface: Surface;
  request<R extends Route>(route: R, ...body: ArgsOf<R['path']>): Promise<ApiResult<ValueOf<R['path']>>>;
  /** The idle deadline on the injected clock, or null when no session is counting down. */
  deadline(): number | null;
  /** The staff user this client holds a session for, or null. The token is never exposed. */
  staffUserId(): string | null;
  /** Listeners must not throw. Returns the unsubscribe. */
  subscribe(listener: (event: ApiEvent) => void): () => void;
}

const DEFAULT_TIMEOUT_MS = 10_000;

const find = <P extends RoutePath>(path: P) =>
  ROUTE_TABLE.find((entry) => entry.path === path) as Extract<Route, { path: P }>;

/** The routes by name, taken from the table so a caller never writes a path. */
export const ROUTES = {
  health: find('/api/health'),
  posLogin: find('/api/pos/auth/login'),
  posMe: find('/api/pos/auth/me'),
  posActivity: find('/api/pos/auth/activity'),
  posRelease: find('/api/pos/auth/release'),
  backOfficeLogin: find('/api/back-office/auth/login'),
  backOfficeMe: find('/api/back-office/auth/me'),
  backOfficeActivity: find('/api/back-office/auth/activity'),
  backOfficeLogout: find('/api/back-office/auth/logout'),
  backOfficeReauthenticate: find('/api/back-office/auth/reauthenticate'),
} as const;

interface View {
  staffUserId: string;
  csrfToken: string;
  idleSeconds: number;
  idleRemainingSeconds: number;
}

type Raw =
  | { kind: 'ok'; value: unknown; sentAt: number }
  | { kind: 'refused'; body: ErrorBody }
  | { kind: 'fault' };

/** `view` is null unless `me` answered 2xx under the current session; `settled` is the result then. */
interface MeRead {
  view: View | null;
  sentAt: number;
  settled: ApiResult<unknown>;
}

/** What the core's session state was when a request was sent. */
interface Sent {
  generation: number;
  installs: number;
}

/** The session view as the world sees it: every field but the anti-CSRF token. */
function publicView(view: View): Record<string, unknown> {
  const { csrfToken: _held, ...rest } = view as View & Record<string, unknown>;
  return rest;
}

interface Spec {
  body?: Schema<unknown>;
  response: Schema<unknown> | null;
  session?: true;
  signIn?: true;
  ends?: true;
}

const defaultSetTimer = (fire: () => void, ms: number): (() => void) => {
  const handle = setTimeout(fire, ms);
  return () => clearTimeout(handle);
};

export function createApiClient(options: ApiClientOptions): ApiClient {
  const { surface, now } = options;
  const send = options.fetch;
  const setTimer = options.setTimer ?? defaultSetTimer;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const meRoute = surface === 'POS' ? ROUTES.posMe : ROUTES.backOfficeMe;

  // The whole of the session state. The token lives here and nowhere else.
  let token: string | null = null;
  let actor: string | null = null;
  let idleSeconds: number | null = null;
  let deadline: number | null = null;
  // The session generation advances whenever a session is installed or ends. A
  // response settles against the generation it was sent under: under another, it is
  // obsolete and changes nothing. `installs` counts sessions installed, and is what a
  // sign-in is judged by: a release in flight must not make a later sign-in obsolete.
  let generation = 0;
  let installs = 0;
  let meFlight: { generation: number; promise: Promise<MeRead> } | null = null;

  const listeners = new Set<(event: ApiEvent) => void>();
  const emit = (event: ApiEvent): void => {
    for (const listener of [...listeners]) listener(event);
  };

  const setDeadline = (next: number | null): void => {
    if (next === deadline) return;
    deadline = next;
    emit({ type: 'deadline', deadline });
  };

  const endSession = (reason: SessionEndReason, keepToken: boolean): void => {
    // `keepToken` is the back office's SESSION_IDLE: the same manager renews that
    // session with their password, so it is not an end. It advances no generation,
    // so a re-authentication sent earlier still installs; it forgets the limit, so a
    // 2xx sent earlier cannot start a countdown again; and it reports only the loss
    // of a deadline that was held.
    const held = keepToken ? deadline !== null : token !== null || deadline !== null;
    if (keepToken) {
      idleSeconds = null;
    } else {
      generation += 1;
      token = null;
      actor = null;
      idleSeconds = null;
    }
    setDeadline(null);
    if (held) emit({ type: 'session-ended', reason });
  };

  // `install`: this view starts a session (a sign-in or a re-authentication). A view
  // naming a different person than the one held installs one too.
  const adopt = (view: View, sentAt: number, install: boolean): void => {
    const changed = actor !== null && actor !== view.staffUserId;
    // A session recovered into an empty core advances the generation, so everything
    // sent before it is obsolete, but it is not an install: a sign-in already in
    // flight has set the cookie to someone else and must still be able to install.
    if (install || changed || actor === null) generation += 1;
    if (install || changed) installs += 1;
    token = view.csrfToken;
    actor = view.staffUserId;
    idleSeconds = view.idleSeconds;
    setDeadline(sentAt + view.idleRemainingSeconds * 1000);
    if (changed) emit({ type: 'actor-changed', staffUserId: view.staffUserId });
  };

  // One request, one attempt. The body text is the already-validated JSON.
  async function transmit(entry: Route, spec: Spec, bodyText: string | undefined): Promise<Raw> {
    const sentAt = now();
    const headers: Record<string, string> = {};
    if (bodyText !== undefined) headers['Content-Type'] = 'application/json';
    if (entry.method !== 'GET' && token !== null) headers[CSRF_HEADER] = token;
    const controller = new AbortController();
    const cancel = setTimer(() => controller.abort(), timeoutMs);
    try {
      const response = await send(entry.path, {
        method: entry.method,
        headers,
        ...(bodyText === undefined ? {} : { body: bodyText }),
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      const text = await response.text();
      if (response.status >= 200 && response.status < 300) {
        if (spec.response === null) return { kind: 'ok', value: undefined, sentAt };
        const parsed = spec.response.safeParse(JSON.parse(text));
        return parsed.success ? { kind: 'ok', value: parsed.data, sentAt } : { kind: 'fault' };
      }
      const envelope = ErrorBody.safeParse(JSON.parse(text));
      if (!envelope.success) return { kind: 'fault' };
      // The server's own fault codes are a fault whatever carries them; every other
      // code is the server saying something specific, and the code is the whole story.
      const { code } = envelope.data.error;
      if (code === ErrorCode.INTERNAL || code === ErrorCode.UNAVAILABLE) return { kind: 'fault' };
      return { kind: 'refused', body: envelope.data };
    } catch {
      // A rejected fetch, a timeout, text that is not JSON: all one fault. The text is
      // not kept.
      return { kind: 'fault' };
    } finally {
      cancel();
    }
  }

  // Asked once per faulted request, never for the health read itself.
  async function healthDecides(): Promise<'failed' | 'unavailable'> {
    const controller = new AbortController();
    const cancel = setTimer(() => controller.abort(), timeoutMs);
    try {
      const response = await send(ROUTES.health.path, {
        method: 'GET',
        headers: {},
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      return response.status === 200 ? 'failed' : 'unavailable';
    } catch {
      return 'unavailable';
    } finally {
      cancel();
    }
  }

  // Turns a raw outcome into a result and applies what it means for the session.
  async function settle(
    entry: Route,
    spec: Spec,
    raw: Raw,
    sent: Sent,
    adoptView: boolean
  ): Promise<ApiResult<unknown>> {
    if (raw.kind === 'fault') {
      if (entry.path === ROUTES.health.path) return { kind: 'unavailable' };
      return { kind: await healthDecides() };
    }
    // Obsolete: the session it was sent under is not the session now. It changes
    // nothing, and says so only if it would have applied a view or an end.
    const obsolete =
      spec.signIn === true ? installs !== sent.installs : generation !== sent.generation;
    if (raw.kind === 'refused') {
      const { code } = raw.body.error;
      const ends =
        code === ErrorCode.SESSION_IDLE ||
        code === ErrorCode.UNAUTHENTICATED ||
        code === ErrorCode.FORBIDDEN;
      if (obsolete) return ends ? { kind: 'session-gone' } : raw;
      if (code === ErrorCode.SESSION_IDLE) endSession('SESSION_IDLE', surface === 'BACK_OFFICE');
      else if (code === ErrorCode.UNAUTHENTICATED) endSession('UNAUTHENTICATED', false);
      else if (code === ErrorCode.FORBIDDEN) endSession('FORBIDDEN', false);
      return raw;
    }
    if (obsolete) {
      return spec.session === true ? { kind: 'session-gone' } : { kind: 'ok', value: raw.value };
    }
    if (spec.session === true) {
      // The wire view, token included, stays here; the result carries the rest.
      if (adoptView) adopt(raw.value as View, raw.sentAt, entry.method === 'POST');
      return { kind: 'ok', value: publicView(raw.value as View) };
    }
    if (entry.interactive && idleSeconds !== null) {
      setDeadline(raw.sentAt + idleSeconds * 1000);
    }
    return { kind: 'ok', value: raw.value };
  }

  // One read of `me` for however many requests were refused meanwhile. It adopts
  // nothing: each caller decides, because adopting another person's view would make
  // this tab act as them.
  function readMe(): Promise<MeRead> {
    // A read sent under another generation is not joined: its answer is about a
    // session this request was not made under.
    if (meFlight !== null && meFlight.generation === generation) return meFlight.promise;
    const sent: Sent = { generation, installs };
    const flight = {
      generation,
      promise: (async (): Promise<MeRead> => {
        const spec = SPECS[meRoute.path] as Spec;
        const raw = await transmit(meRoute, spec, undefined);
        const settled = await settle(meRoute, spec, raw, sent, false);
        if (raw.kind !== 'ok' || settled.kind !== 'ok') return { view: null, sentAt: 0, settled };
        return { view: raw.value as View, sentAt: raw.sentAt, settled };
      })().finally(() => {
        if (meFlight === flight) meFlight = null;
      }),
    };
    meFlight = flight;
    return flight.promise;
  }

  async function run(
    entry: Route,
    spec: Spec,
    bodyText: string | undefined,
    isRetry: boolean
  ): Promise<ApiResult<unknown>> {
    const actorAtSend = actor;
    const sent: Sent = { generation, installs };
    const raw = await transmit(entry, spec, bodyText);
    const result = await settle(entry, spec, raw, sent, true);
    const csrfRefused =
      result.kind === 'refused' && result.body.error.code === ErrorCode.CSRF_REFUSED;
    if (!csrfRefused || isRetry || entry.method === 'GET') return result;
    // Under another session the refusal is about a token this request no longer owns.
    if (generation !== sent.generation) return result;

    // B-13: the retry is the same command, so it is for the same person. If the held
    // actor is not the one the cookie now names, nothing is retried and nothing is
    // released: that cookie belongs to another tab's session.
    if (actorAtSend === null) return { kind: 'session-gone' };
    const me = await readMe();
    if (me.view === null) return me.settled;
    if (generation !== sent.generation) return { kind: 'session-gone' };
    if (me.view.staffUserId !== actorAtSend) {
      if (actor !== me.view.staffUserId) endSession('ACTOR_CHANGED', false);
      return { kind: 'session-gone' };
    }
    adopt(me.view, me.sentAt, false);
    return run(entry, spec, bodyText, true);
  }

  const surfaceOf = (path: string): Surface | 'BOTH' =>
    path.startsWith('/api/pos/') ? 'POS' : path.startsWith('/api/back-office/') ? 'BACK_OFFICE' : 'BOTH';

  return {
    surface,
    // The signature a caller sees is exact per route; inside, the route is the union.
    request: (async (route: Route, ...args: unknown[]): Promise<ApiResult<unknown>> => {
      const entry = ROUTE_TABLE.find((candidate) => candidate.path === route.path);
      if (entry === undefined) throw new Error('Not a route in the route table');
      const audience = surfaceOf(entry.path);
      if (audience !== 'BOTH' && audience !== surface) {
        throw new Error('A route of the other surface');
      }
      const spec = SPECS[entry.path] as Spec;
      let bodyText: string | undefined;
      if (spec.body !== undefined) {
        const parsed = spec.body.safeParse(args[0]);
        if (!parsed.success) return { kind: 'invalid-request' };
        bodyText = JSON.stringify(parsed.data);
      }
      const startedUnder = generation;
      const result = await run(entry, spec, bodyText, false);
      // A release that settles under another session ends nothing of it.
      if (spec.ends === true) {
        // Settled under another session: it ends nothing of that one, and says so.
        if (generation !== startedUnder) {
          return result.kind === 'ok' ? { kind: 'session-gone' } : result;
        }
        endSession('SIGNED_OUT', false);
      }
      return result;
    }) as ApiClient['request'],
    deadline: () => deadline,
    staffUserId: () => actor,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
