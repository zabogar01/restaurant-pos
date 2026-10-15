import { createApiClient, type ApiClient, type FetchLike } from '@pos/api-client';
import { ErrorCode, type ErrorBody } from '@pos/contracts';
import { accountKey } from './account.js';
import { listenForActivity } from './activity.js';
import { officeApi } from './api.js';
import type { Attempt, Person, SessionSnapshot, SessionStore, Wait, WhySignedOut } from './types.js';

// The one module that constructs the back office's `@pos/api-client` instance
// (ARCH-014 rules 2 and 3). The store below is ARCH-014 question 5's table for the
// back office, with the lead rulings of PHASE0-011d1: three phases until M-6 adds
// the fourth (011d2), and one event or answer for each row. It holds no password:
// the characters arrive as an argument, go into the sign-in request's body, and are
// not kept (B-12).

type Deps = {
  /** Defaults to the page's own `fetch`. Tests pass a stub. */
  fetch?: FetchLike;
  /** The monotonic clock in milliseconds. Defaults to `performance.now()`. */
  now?: () => number;
  /** Starts a timer and returns its canceller. Defaults to the platform's. */
  setTimer?: (fire: () => void, ms: number) => () => void;
};

/** What one answer from the server means for the back office, by code and by the request it answered. */
type Meaning =
  /** BO-01 resting, no notice; the working area stays mounted, hidden and inert. */
  | { kind: 'rest' }
  /** BO-01 *Session ended*; the working area stays. */
  | { kind: 'ended' }
  /** BO-01 *Access refused*; the working area is removed. */
  | { kind: 'refused' }
  | { kind: 'credentials-error' }
  | { kind: 'cooldown'; seconds: number }
  | { kind: 'general-failure' };

type Context = 'load' | 'signed-in' | 'sign-in';

/**
 * Every code of the API is placed here, once. A code added to `ErrorCode` makes the
 * `never` below fail to compile (ARCH-014 question 4, rule 10, client half).
 * `Meaning` is what the answer does to the back office; the wording is BO-01's.
 * `APPROVAL_FAILED` and `APPROVAL_THROTTLED` are POS approval signals and are
 * unexpected here: the general failure (SCREEN-INVENTORY BO-01).
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
      // Until M-6 (011d2) an idle session shows BO-01 resting: the lead's ruling 3.
      return context === 'sign-in' ? { kind: 'general-failure' } : { kind: 'rest' };
    case ErrorCode.UNAUTHENTICATED:
      // After a reload the client believed nothing, so nothing ended.
      if (context === 'load') return { kind: 'rest' };
      return context === 'signed-in' ? { kind: 'ended' } : { kind: 'general-failure' };
    case ErrorCode.FORBIDDEN:
      // There is no credential-level permission refusal at sign-in.
      return context === 'sign-in' ? { kind: 'general-failure' } : { kind: 'refused' };
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

const NONE: Attempt = { kind: 'none' };

export function createRealSession(deps: Deps = {}): SessionStore {
  const now = deps.now ?? (() => performance.now());
  const setTimer = deps.setTimer ?? defaultSetTimer;
  // The page's own `fetch`, bound so it keeps its receiver; tests substitute theirs.
  const transport: FetchLike = deps.fetch ?? window.fetch.bind(window);
  const client: ApiClient = createApiClient({ surface: 'BACK_OFFICE', fetch: transport, now, setTimer });
  const api = officeApi(client);

  let snapshot: SessionSnapshot = { phase: 'starting' };
  let person: Person | null = null;
  // The staff user whose working area is still mounted. Set by a sign-in, kept
  // through every end that is not a removal, cleared by a confirmed logout, by
  // FORBIDDEN, and by a reload (a new store).
  let heldId: string | null = null;
  // Advances on every change of phase: a sign-in, a confirmed logout, every end, an
  // actor change. A `me` read is applied only if the revision it was sent under is
  // still current, so a late answer can never sign this tab in again (lead ruling 8).
  let revision = 0;
  // Known waits, by account, as the end of each on the monotonic clock. Not
  // remembered across a reload.
  const waitEnds = new Map<string, number>();
  // One cookie-changing request at a time (owner, 2026-10-14): a sign-in or a logout.
  let cookieChanging = false;
  let reading = false;
  let loaded = false;
  let stops: Array<() => void> = [];
  let cancelTick: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const secondsLeft = (end: number): number => Math.max(0, Math.ceil((end - now()) / 1000));

  const commit = (next: SessionSnapshot): void => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  /** The unexpired waits; an expired one is dropped here, which is what removes its notice. */
  const currentWaits = (): Wait[] => {
    const list: Wait[] = [];
    for (const [username, end] of waitEnds) {
      const remainingSeconds = secondsLeft(end);
      if (remainingSeconds === 0) waitEnds.delete(username);
      else list.push({ username, remainingSeconds });
    }
    return list;
  };

  const sameWaits = (a: readonly Wait[], b: readonly Wait[]): boolean =>
    a.length === b.length && a.every((w, i) => w.username === b[i]!.username && w.remainingSeconds === b[i]!.remainingSeconds);

  // Re-derive what the clock moves. The one timer redraws a counting wait while
  // signed out and, at the deadline, reads `me` while signed in: it never sends
  // `activity` and never ends a session by itself (FR-A2b, AC-28).
  const refresh = (): void => {
    cancelTick?.();
    cancelTick = null;
    if (snapshot.phase === 'signed-in') {
      const deadline = client.deadline();
      if (deadline === null) return;
      const toDeadline = deadline - now();
      if (toDeadline <= 0) {
        void readSession('deadline');
        return;
      }
      cancelTick = setTimer(refresh, toDeadline);
      return;
    }
    if (snapshot.phase !== 'signed-out') return;
    const waits = currentWaits();
    if (!sameWaits(waits, snapshot.waits)) commit({ ...snapshot, waits });
    let next: number | null = null;
    for (const end of waitEnds.values()) {
      // The next moment this wait's whole-second number changes.
      const toNext = end - now() - (secondsLeft(end) - 1) * 1000;
      next = next === null ? toNext : Math.min(next, toNext);
    }
    if (next !== null) cancelTick = setTimer(refresh, Math.max(next, 1));
  };

  const signedOutSnapshot = (why: WhySignedOut, attempt: Attempt): SessionSnapshot => ({
    phase: 'signed-out',
    why,
    attempt,
    waits: currentWaits(),
    busy: cookieChanging,
    held: heldId,
  });

  /** A change of phase. `destroy` removes the working area; otherwise it stays, hidden and inert. */
  const toSignedOut = (why: WhySignedOut, destroy: boolean, attempt: Attempt = NONE): void => {
    revision += 1;
    person = null;
    if (destroy) heldId = null;
    commit(signedOutSnapshot(why, attempt));
    refresh();
  };

  const toSignedIn = (who: Person): void => {
    revision += 1;
    person = who;
    // A different staff user than the held one changes the key: React destroys the old area.
    heldId = who.staffUserId;
    commit({ phase: 'signed-in', person: who, logout: { inFlight: false, failure: 'none' } });
    refresh();
  };

  /** A sign-in attempt's outcome while staying on BO-01: not a change of phase. */
  const setAttempt = (attempt: Attempt): void => {
    if (snapshot.phase !== 'signed-out') return;
    commit({ ...snapshot, attempt, waits: currentWaits(), busy: cookieChanging });
    refresh();
  };

  // A cookie-changing request has settled: it is no longer in flight, whatever phase
  // the screen is in now. An end the core announced meanwhile published its snapshot
  // while the flag was still set, so the flag is published into the current snapshot
  // here, keeping its reason, notice and working-area decision.
  const settled = (): void => {
    cookieChanging = false;
    if (snapshot.phase === 'signed-out' && snapshot.busy) commit({ ...snapshot, busy: false });
  };

  const personOf = (view: { staffUserId: string; name: string; username: string }): Person => ({
    staffUserId: view.staffUserId,
    name: view.name,
    username: view.username,
  });

  // What a meaning does when it is about the session this tab holds, or held.
  const applyEnd = (meaning: Meaning): void => {
    switch (meaning.kind) {
      case 'rest':
        toSignedOut('resting', false);
        return;
      case 'ended':
        toSignedOut('ended', false);
        return;
      case 'refused':
        toSignedOut('refused', true);
        return;
      case 'credentials-error':
      case 'cooldown':
      case 'general-failure':
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
      const result = await api['/api/back-office/auth/me']();
      // Only the first lookup, from `starting`, may sign this tab in from nothing, and
      // only if nothing has changed since it was sent. Every other answer is about a
      // session this tab no longer holds, or is a re-arm of the one it does.
      if (revision !== sentUnder) return;
      switch (result.kind) {
        case 'ok':
          if (origin === 'load') {
            toSignedIn(personOf(result.value));
          } else if (result.value.staffUserId !== person?.staffUserId) {
            // Someone else's session is now in this browser's cookie.
            toSignedOut('ended', false);
          } else {
            // The core moved the deadline; the timer follows it.
            refresh();
          }
          return;
        case 'refused': {
          // A read that ended the session has already told the core's listeners.
          const meaning = meaningOf(result.body, origin === 'load' ? 'load' : 'signed-in');
          if (meaning.kind !== 'general-failure') applyEnd(meaning);
          else if (origin === 'load') toSignedOut('resting', true, { kind: 'lookup-failed' });
          return;
        }
        case 'failed':
        case 'invalid-request':
          // At the deadline the person stays as they are: nothing is drawn for it and
          // nothing is retried on its own.
          if (origin === 'load') toSignedOut('resting', true, { kind: 'lookup-failed' });
          return;
        case 'unavailable':
          if (origin === 'load') toSignedOut('resting', true, { kind: 'lookup-unavailable' });
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
        // From BO-01 only FORBIDDEN acts: it removes the retained work (rulings 4 and
        // 6). Any other end changes neither the notice nor the work.
        if (snapshot.phase === 'signed-out' && event.reason === 'FORBIDDEN') {
          toSignedOut('refused', true);
          return;
        }
        if (snapshot.phase !== 'signed-in') return;
        switch (event.reason) {
          case 'SESSION_IDLE':
            toSignedOut('resting', false);
            return;
          case 'SIGNED_OUT':
            toSignedOut('resting', true);
            return;
          case 'FORBIDDEN':
            toSignedOut('refused', true);
            return;
          case 'UNAUTHENTICATED':
          case 'ACTOR_CHANGED':
            toSignedOut('ended', false);
            return;
        }
        return;
      case 'actor-changed':
        // Another tab signed in as someone else. This tab sends nothing: that cookie
        // is the other tab's session.
        if (snapshot.phase === 'signed-in') toSignedOut('ended', false);
        return;
    }
  };

  const onVisible = (): void => {
    if (document.visibilityState === 'visible' && snapshot.phase === 'signed-in') {
      void readSession('deadline');
    }
  };

  // The manager is trying to end the session, not extend it: no activity while a
  // logout is in flight or unconfirmed (lead ruling 5).
  const mayExtend = (): boolean =>
    snapshot.phase === 'signed-in' && !snapshot.logout.inFlight && snapshot.logout.failure === 'none';

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
        listenForActivity({ api, now, active: mayExtend }),
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
    signIn(username, password) {
      if (cookieChanging || snapshot.phase !== 'signed-out') return;
      if (snapshot.attempt.kind === 'lookup-failed' || snapshot.attempt.kind === 'lookup-unavailable') return;
      const account = accountKey(username);
      // A known wait holds the account's sign-in off: nothing is sent.
      if (currentWaits().some((w) => w.username === account)) return;
      cookieChanging = true;
      commit({ ...snapshot, attempt: { kind: 'verifying' }, busy: true });
      void (async () => {
        try {
          const result = await api['/api/back-office/auth/login']({ username, password });
          settled();
          switch (result.kind) {
            case 'ok':
              toSignedIn(personOf(result.value));
              return;
            case 'refused': {
              const meaning = meaningOf(result.body, 'sign-in');
              if (meaning.kind === 'credentials-error') {
                setAttempt({ kind: 'error' });
              } else if (meaning.kind === 'cooldown') {
                // Zero removes the notice and enables entry, without submission.
                if (meaning.seconds > 0) waitEnds.set(account, now() + meaning.seconds * 1000);
                setAttempt(NONE);
              } else {
                setAttempt({ kind: 'failed' });
              }
              return;
            }
            case 'unavailable':
              setAttempt({ kind: 'unavailable' });
              return;
            case 'failed':
            case 'invalid-request':
              // Empty and oversize values are stopped before this, so the second cannot
              // happen; if it does it is general.
              setAttempt({ kind: 'failed' });
              return;
            case 'session-gone':
              // Leaves BO-01 as it was, with no notice.
              setAttempt(NONE);
              return;
          }
        } catch {
          settled();
          setAttempt({ kind: 'failed' });
        }
      })();
    },
    logout() {
      if (cookieChanging || snapshot.phase !== 'signed-in') return;
      cookieChanging = true;
      const sentUnder = revision;
      commit({ ...snapshot, logout: { inFlight: true, failure: snapshot.logout.failure } });
      const settleFailure = (failure: 'none' | 'failed' | 'unavailable'): void => {
        if (snapshot.phase === 'signed-in') commit({ ...snapshot, logout: { inFlight: false, failure } });
      };
      void api['/api/back-office/auth/logout']()
        .then((result) => {
          settled();
          // A change of phase meanwhile (an end the core announced, including the
          // confirmed logout itself) has already put the screen where its row says.
          if (revision !== sentUnder || snapshot.phase !== 'signed-in') return;
          switch (result.kind) {
            case 'ok':
              toSignedOut('resting', true);
              return;
            case 'refused': {
              // Only these three are ends of a logout; every other refusal says nothing
              // about the session, whatever it means at a sign-in (DESIGN-015, Logout failed).
              const { code } = result.body.error;
              const ends =
                code === ErrorCode.SESSION_IDLE ||
                code === ErrorCode.UNAUTHENTICATED ||
                code === ErrorCode.FORBIDDEN;
              if (ends) applyEnd(meaningOf(result.body, 'signed-in'));
              else settleFailure('failed');
              return;
            }
            case 'unavailable':
              settleFailure('unavailable');
              return;
            case 'failed':
            case 'invalid-request':
              settleFailure('failed');
              return;
            case 'session-gone':
              settleFailure(snapshot.logout.failure);
              return;
          }
        })
        .catch(() => {
          settled();
          if (revision === sentUnder) settleFailure('failed');
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
      // Never resends a credential: it only asks for fresh entry.
      if (attempt.kind === 'failed' || attempt.kind === 'unavailable') setAttempt(NONE);
    },
    dismiss() {
      if (snapshot.phase !== 'signed-out') return;
      const { kind } = snapshot.attempt;
      if (kind === 'error' || kind === 'failed' || kind === 'unavailable') setAttempt(NONE);
    },
  };
}
