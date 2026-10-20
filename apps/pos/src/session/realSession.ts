import { createApiClient, type ApiClient, type FetchLike } from '@pos/api-client';
import { ErrorCode, type ErrorBody } from '@pos/contracts';
import { listenForActivity } from './activity.js';
import { posApi } from './api.js';
import type { Attempt, Person, SessionSnapshot, SessionStore } from './types.js';

// The one module that constructs the POS's `@pos/api-client` instance (ARCH-014
// rules 2 and 3). The store below is ARCH-014 question 5's table: three phases,
// and one event or answer for each row. It holds no PIN: the digits arrive as an
// argument, go into the sign-in request's body, and are not kept (B-12).

type Deps = {
  /** Defaults to the page's own `fetch`. Tests pass a stub. */
  fetch?: FetchLike;
  /** The monotonic clock in milliseconds. Defaults to `performance.now()`. */
  now?: () => number;
  /** Starts a timer and returns its canceller. Defaults to the platform's. */
  setTimer?: (fire: () => void, ms: number) => () => void;
};

/** What one answer from the server means for the POS, by code and by the request it answered. */
type Meaning =
  | { kind: 'rest' }
  | { kind: 'invalidate' }
  | { kind: 'credentials-error' }
  | { kind: 'cooldown'; seconds: number }
  | { kind: 'general-failure' };

type Context = 'load' | 'signed-in' | 'sign-in';

/**
 * Every code of the API is placed here, once. A code added to `ErrorCode` makes
 * the `never` below fail to compile (ARCH-014 question 4, rule 10, client half).
 * `Meaning` is what the answer does to the POS; the wording is POS-01's.
 */
function meaningOf(body: ErrorBody, context: Context): Meaning {
  const error = body.error;
  switch (error.code) {
    case ErrorCode.INVALID_CREDENTIALS:
      return error.details === undefined
        ? { kind: 'credentials-error' }
        : { kind: 'cooldown', seconds: error.details.retryAfterSeconds };
    case ErrorCode.THROTTLED:
      // A missing duration is the general failure: no guessed duration.
      return error.details === undefined
        ? { kind: 'general-failure' }
        : { kind: 'cooldown', seconds: error.details.retryAfterSeconds };
    case ErrorCode.SESSION_IDLE:
      return context === 'sign-in' ? { kind: 'general-failure' } : { kind: 'rest' };
    case ErrorCode.UNAUTHENTICATED:
      // After a reload the client believed nothing, so nothing was invalidated.
      if (context === 'load') return { kind: 'rest' };
      return context === 'signed-in' ? { kind: 'invalidate' } : { kind: 'general-failure' };
    case ErrorCode.FORBIDDEN:
      return context === 'signed-in' ? { kind: 'invalidate' } : { kind: 'general-failure' };
    case ErrorCode.INTERNAL:
    case ErrorCode.UNAVAILABLE:
    case ErrorCode.NOT_FOUND:
    case ErrorCode.VALIDATION_FAILED:
    case ErrorCode.PAYLOAD_TOO_LARGE:
    case ErrorCode.UNSUPPORTED_MEDIA_TYPE:
    case ErrorCode.ORIGIN_REFUSED:
    case ErrorCode.CSRF_REFUSED:
    case ErrorCode.APPROVAL_FAILED:
    case ErrorCode.APPROVAL_THROTTLED:
    case ErrorCode.DUPLICATE:
      return { kind: 'general-failure' };
    default: {
      const unplaced: never = error;
      return unplaced;
    }
  }
}

const defaultSetTimer = (fire: () => void, ms: number): (() => void) => {
  const handle = setTimeout(fire, ms);
  return () => clearTimeout(handle);
};

const RESTING = (attempt: Attempt = { kind: 'none' }, busy = false): SessionSnapshot => ({
  phase: 'signed-out',
  why: 'resting',
  attempt,
  busy,
});

export function createRealSession(deps: Deps = {}): SessionStore {
  const now = deps.now ?? (() => performance.now());
  const setTimer = deps.setTimer ?? defaultSetTimer;
  // The page's own `fetch`, bound so it keeps its receiver; tests substitute theirs.
  const transport: FetchLike = deps.fetch ?? window.fetch.bind(window);
  const client: ApiClient = createApiClient({ surface: 'POS', fetch: transport, now, setTimer });
  const api = posApi(client);

  let snapshot: SessionSnapshot = { phase: 'starting' };
  let person: Person | null = null;
  // The staff user this tab is signed in as. A read naming anyone else never signs in.
  let personId: string | null = null;
  // Advances on every change of phase: Release, a sign-in, an end, an actor change. A
  // read is applied only if the revision it was sent under is still the current one,
  // so a late answer can never sign this tab in again (review F1).
  let revision = 0;
  // The cooldown's end, on the monotonic clock. Not remembered across a reload.
  let cooldownEnd: number | null = null;
  // One cookie-changing request at a time (owner, 2026-10-14): a sign-in or a release.
  let cookieChanging = false;
  let reading = false;
  let loaded = false;
  let stops: Array<() => void> = [];
  let cancelTick: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const remainingSecondsOf = (until: number | null): number | null =>
    until === null ? null : Math.max(0, Math.ceil((until - now()) / 1000));

  const commit = (next: SessionSnapshot): void => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  const signedInSnapshot = (): SessionSnapshot => ({
    phase: 'signed-in',
    person: person!,
    remainingSeconds: remainingSecondsOf(client.deadline()),
  });

  // Re-derive the snapshot from what the core and the cooldown hold now, and
  // keep the one timer that redraws a counting number. The timer only redraws
  // and, at the deadline, reads `me`: it never sends `activity` and never ends
  // a session by itself (FR-A2b, AC-28).
  const refresh = (): void => {
    cancelTick?.();
    cancelTick = null;
    let until: number | null = null;
    if (snapshot.phase === 'signed-in' && person !== null) {
      const next = signedInSnapshot();
      if (next.phase === 'signed-in' && next.remainingSeconds !== (snapshot as typeof next).remainingSeconds) {
        commit(next);
      }
      until = client.deadline();
    } else if (snapshot.phase === 'signed-out' && snapshot.attempt.kind === 'cooldown' && cooldownEnd !== null) {
      const left = remainingSecondsOf(cooldownEnd)!;
      if (left === 0) {
        cooldownEnd = null;
        commit(RESTING({ kind: 'none' }, snapshot.busy));
        return;
      }
      if (left !== snapshot.attempt.remainingSeconds) {
        commit({ ...snapshot, attempt: { kind: 'cooldown', remainingSeconds: left } });
      }
      until = cooldownEnd;
    }
    if (until === null) return;
    const left = remainingSecondsOf(until)!;
    if (left === 0) {
      if (snapshot.phase === 'signed-in') void readSession('deadline');
      return;
    }
    // The next moment the whole-second number changes.
    const toNext = until - now() - (left - 1) * 1000;
    cancelTick = setTimer(refresh, Math.max(toNext, 1));
  };

  const toSignedOut = (why: 'resting' | 'invalidated', attempt: Attempt = { kind: 'none' }): void => {
    revision += 1;
    person = null;
    personId = null;
    cooldownEnd = null;
    commit({ phase: 'signed-out', why, attempt, busy: cookieChanging });
    refresh();
  };

  const toSignedIn = (who: Person, id: string): void => {
    revision += 1;
    person = who;
    personId = id;
    cooldownEnd = null;
    commit(signedInSnapshot());
    refresh();
  };

  const applyAttempt = (meaning: Meaning): void => {
    switch (meaning.kind) {
      case 'rest':
        toSignedOut('resting');
        return;
      case 'invalidate':
        toSignedOut('invalidated');
        return;
      case 'credentials-error':
        toSignedOut('resting', { kind: 'error' });
        return;
      case 'cooldown':
        // Zero removes the notice and enables entry, without submission.
        if (meaning.seconds <= 0) {
          toSignedOut('resting');
          return;
        }
        cooldownEnd = now() + meaning.seconds * 1000;
        commit({
          phase: 'signed-out',
          why: 'resting',
          attempt: { kind: 'cooldown', remainingSeconds: meaning.seconds },
          busy: cookieChanging,
        });
        refresh();
        return;
      case 'general-failure':
        toSignedOut('resting', { kind: 'failed' });
        return;
    }
  };

  // The first read, the read at the deadline and the read on becoming visible: one
  // path, one read at a time. `me` is not interactive, so it extends nothing.
  async function readSession(origin: 'load' | 'deadline'): Promise<void> {
    if (reading) return;
    reading = true;
    const sentUnder = revision;
    try {
      const result = await api['/api/pos/auth/me']();
      // Only the first lookup, from `starting`, may sign this tab in from nothing, and
      // only if nothing has changed since it was sent. Every other answer is about a
      // session this tab no longer holds, or is a re-arm of the one it does.
      if (revision !== sentUnder) return;
      if (origin === 'deadline' && snapshot.phase !== 'signed-in') return;
      switch (result.kind) {
        case 'ok':
          if (origin === 'load') {
            toSignedIn({ name: result.value.name, role: result.value.role }, result.value.staffUserId);
          } else if (result.value.staffUserId !== personId) {
            // Someone else's session is now in this browser's cookie: lead ruling 3.
            toSignedOut('invalidated');
          } else {
            // The core moved the deadline; the chip follows it.
            refresh();
          }
          return;
        case 'refused': {
          // A read that ended the session has already told the core's listeners.
          const meaning = meaningOf(result.body, origin === 'load' ? 'load' : 'signed-in');
          if (origin === 'load') {
            if (meaning.kind === 'general-failure') toSignedOut('resting', { kind: 'lookup-failed' });
            else applyAttempt(meaning);
          } else if (meaning.kind !== 'general-failure') {
            applyAttempt(meaning);
          }
          return;
        }
        case 'failed':
        case 'invalid-request':
          // At the deadline, the person stays as they are: nothing is drawn for it yet
          // (ARCH-014 question 9) and nothing is retried on its own.
          if (origin === 'load') toSignedOut('resting', { kind: 'lookup-failed' });
          return;
        case 'unavailable':
          if (origin === 'load') toSignedOut('resting', { kind: 'lookup-unavailable' });
          return;
        case 'session-gone':
          // That response was obsolete; the core's events say what changed.
          return;
      }
    } finally {
      reading = false;
    }
  }

  const onCoreEvent = (event: Parameters<Parameters<ApiClient['subscribe']>[0]>[0]): void => {
    switch (event.type) {
      case 'deadline':
        if (snapshot.phase === 'signed-in') refresh();
        return;
      case 'session-ended':
        if (snapshot.phase !== 'signed-in') return;
        if (event.reason === 'SESSION_IDLE') toSignedOut('resting');
        else if (event.reason === 'SIGNED_OUT') toSignedOut('resting');
        else toSignedOut('invalidated');
        return;
      case 'actor-changed':
        // Another tab signed in as someone else. This tab sends nothing: that cookie
        // is the other tab's session.
        if (snapshot.phase === 'signed-in') toSignedOut('invalidated');
        return;
    }
  };

  const onVisible = (): void => {
    if (document.visibilityState === 'visible' && snapshot.phase === 'signed-in') {
      void readSession('deadline');
    }
  };

  return {
    kind: 'real',
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      stops = [
        client.subscribe(onCoreEvent),
        listenForActivity({ api, now, signedIn: () => snapshot.phase === 'signed-in' }),
        (() => {
          document.addEventListener('visibilitychange', onVisible);
          return () => document.removeEventListener('visibilitychange', onVisible);
        })(),
      ];
      if (!loaded) {
        loaded = true;
        void readSession('load');
      }
      return () => {
        for (const stop of stops) stop();
        stops = [];
        cancelTick?.();
        cancelTick = null;
      };
    },
    signIn(pin) {
      if (cookieChanging || snapshot.phase !== 'signed-out') return;
      cookieChanging = true;
      commit({ ...snapshot, attempt: { kind: 'verifying' }, busy: true });
      void (async () => {
        try {
          const result = await api['/api/pos/auth/login']({ pin });
          switch (result.kind) {
            case 'ok':
              cookieChanging = false;
              toSignedIn({ name: result.value.name, role: result.value.role }, result.value.staffUserId);
              return;
            case 'refused':
              cookieChanging = false;
              applyAttempt(meaningOf(result.body, 'sign-in'));
              return;
            case 'unavailable':
              cookieChanging = false;
              toSignedOut('resting', { kind: 'unavailable' });
              return;
            case 'failed':
            case 'invalid-request':
              // The pad requires six digits, so the second cannot happen; if it does it is general.
              cookieChanging = false;
              toSignedOut('resting', { kind: 'failed' });
              return;
            case 'session-gone':
              // Leaves POS-01 as it was, with no notice.
              cookieChanging = false;
              toSignedOut('resting');
              return;
          }
        } finally {
          cookieChanging = false;
        }
      })();
    },
    release() {
      if (cookieChanging || snapshot.phase !== 'signed-in') return;
      // The screen goes to POS-01 whatever the answer: a cashier who pressed Release
      // must never stay signed in on screen because a request failed.
      cookieChanging = true;
      toSignedOut('resting');
      void api['/api/pos/auth/release']()
        .catch(() => undefined)
        .finally(() => {
          cookieChanging = false;
          if (snapshot.phase === 'signed-out') commit({ ...snapshot, busy: false });
        });
    },
    retry() {
      if (snapshot.phase !== 'signed-out') return;
      const { attempt } = snapshot;
      if (attempt.kind === 'lookup-failed' || attempt.kind === 'lookup-unavailable') {
        commit({ phase: 'starting' });
        void readSession('load');
        return;
      }
      if (attempt.kind === 'failed' || attempt.kind === 'unavailable') {
        // Never resends a credential: it only asks for fresh entry.
        commit({ ...snapshot, attempt: { kind: 'none' } });
      }
    },
  };
}
