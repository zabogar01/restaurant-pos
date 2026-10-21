import { createApiClient, type ApiClient, type FetchLike } from '@pos/api-client';
import { ErrorCode, type ErrorBody } from '@pos/contracts';
import { accountKey } from './account.js';
import { listenForActivity } from './activity.js';
import { configApi, officeApi } from './api.js';
import type {
  Arrival,
  Attempt,
  FocusMemory,
  IdleAttempt,
  IdleMode,
  Person,
  SessionSnapshot,
  SessionStore,
  Wait,
  WhySignedOut,
} from './types.js';

// The one module that constructs the back office's `@pos/api-client` instance
// (ARCH-014 rules 2 and 3). The store below is ARCH-014 question 5's table for the
// back office, with the lead rulings of PHASE0-011d1 and PHASE0-011d2: four phases
// (starting, signed out, signed in, idle), and one event or answer for each row. It
// holds no password: the characters arrive as an argument, go into the request's
// body, and are not kept (B-12).

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
  /** M-6 opens over the frame; the working area stays, visible and inert. */
  | { kind: 'idle' }
  /** BO-01 *Session ended*; the working area stays. */
  | { kind: 'ended' }
  /** BO-01 *Access refused*; the working area is removed. */
  | { kind: 'refused' }
  | { kind: 'credentials-error' }
  | { kind: 'cooldown'; seconds: number }
  | { kind: 'general-failure' };

type Context = 'load' | 'signed-in' | 'sign-in' | 'reauth';

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
      // After a reload there is no draft, no token and no name to show: BO-01. A session
      // this tab holds opens M-6. A credential request is never answered with it (the
      // server does not send it; only the core's CSRF recovery could surface it).
      if (context === 'load') return { kind: 'rest' };
      return context === 'signed-in' ? { kind: 'idle' } : { kind: 'general-failure' };
    case ErrorCode.UNAUTHENTICATED:
      // After a reload the client believed nothing, so nothing ended.
      if (context === 'load') return { kind: 'rest' };
      return context === 'signed-in' || context === 'reauth' ? { kind: 'ended' } : { kind: 'general-failure' };
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
    case ErrorCode.DUPLICATE:
    case ErrorCode.SETTINGS_CHANGED:
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
  // What was focused when the session went idle, taken once when the same manager resumes.
  let focusMemory: FocusMemory | null = null;
  // An other-manager sign-in from M-6 is in flight: the `actor-changed` the core emits is
  // that sign-in's own install (lead ruling 7), not another tab's.
  let otherSignIn = false;
  // Advances on every change of phase: a sign-in, a confirmed logout, every end, an
  // actor change. A `me` read is applied only if the revision it was sent under is
  // still current, so a late answer can never sign this tab in again (lead ruling 8).
  let revision = 0;
  // Known waits, by account, as the end of each on the monotonic clock. Not
  // remembered across a reload.
  const waitEnds = new Map<string, number>();
  // One cookie-changing request at a time (owner, 2026-10-14): a sign-in, a
  // re-authentication or a logout.
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
  // signed out or idle and, at the deadline, reads `me` while signed in: it never
  // sends `activity` and never ends a session by itself (FR-A2b, AC-28). Idle sends
  // nothing on this tab's own initiative, so it reads nothing at a deadline.
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
    if (snapshot.phase !== 'signed-out' && snapshot.phase !== 'idle') return;
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
    focusMemory = null;
    if (destroy) heldId = null;
    commit(signedOutSnapshot(why, attempt));
    refresh();
  };

  const toSignedIn = (who: Person, arrival: Arrival = 'fresh'): void => {
    revision += 1;
    person = who;
    // Only a resume gives the focus back; every other way in forgets it.
    if (arrival !== 'resumed') focusMemory = null;
    // A different staff user than the held one changes the key: React destroys the old area.
    heldId = who.staffUserId;
    commit({ phase: 'signed-in', person: who, logout: { inFlight: false, failure: 'none' }, arrival });
    refresh();
  };

  // The element that has focus now and its selection. Taken before anything is made
  // inert and before M-6 takes focus, because inerting the focused element's ancestor
  // loses it (DESIGN.md, M-6: "including focus outside the draft").
  const captureFocus = (): FocusMemory | null => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) return null;
    const { selectionStart, selectionEnd } = element as Partial<HTMLInputElement>;
    return {
      element,
      start: typeof selectionStart === 'number' ? selectionStart : null,
      end: typeof selectionEnd === 'number' ? selectionEnd : null,
    };
  };

  /** M-6 opens, only ever from signed in. The token and the cookie are kept; the work stays. */
  const toIdle = (): void => {
    if (snapshot.phase !== 'signed-in') return;
    focusMemory = captureFocus();
    revision += 1;
    commit({
      phase: 'idle',
      person: snapshot.person,
      mode: 'same',
      from: 'same',
      attempt: 'none',
      waits: currentWaits(),
      // A request that was in flight when the idle arrived is published as such, and
      // `settled()` clears it into this snapshot when it settles (011d1 Round 2, F1).
      busy: cookieChanging,
      logout: { inFlight: false, failure: 'none' },
    });
    refresh();
  };

  /** A credential attempt's outcome while staying in M-6: not a change of phase. */
  const setIdleAttempt = (attempt: IdleAttempt): void => {
    if (snapshot.phase !== 'idle') return;
    commit({ ...snapshot, attempt, waits: currentWaits(), busy: cookieChanging });
    refresh();
  };

  /** The manager's own moves between M-6's forms: nothing is sent, no revision advances. */
  const moveMode = (expected: IdleMode, mode: IdleMode, from: 'same' | 'other' = 'same'): void => {
    if (snapshot.phase !== 'idle' || snapshot.mode !== expected || snapshot.busy) return;
    commit({ ...snapshot, mode, from, attempt: 'none', logout: { inFlight: false, failure: 'none' }, waits: currentWaits() });
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
    if ((snapshot.phase === 'signed-out' || snapshot.phase === 'idle') && snapshot.busy) {
      commit({ ...snapshot, busy: false });
    }
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
      case 'idle':
        // The core announces the idle first, so this only agrees with it.
        toIdle();
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
        if (snapshot.phase === 'idle') {
          // Out of M-6 by the core's word. The manager who pressed Discard asked to lose
          // the draft, so any end then removes it (lead ruling 10).
          switch (event.reason) {
            case 'SESSION_IDLE':
              return;
            case 'SIGNED_OUT':
              toSignedOut('resting', true);
              return;
            case 'FORBIDDEN':
              toSignedOut('refused', true);
              return;
            case 'UNAUTHENTICATED':
            case 'ACTOR_CHANGED':
              toSignedOut('ended', snapshot.logout.inFlight);
              return;
          }
          return;
        }
        if (snapshot.phase !== 'signed-in') return;
        switch (event.reason) {
          case 'SESSION_IDLE':
            toIdle();
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
        // At M-6 this is either another tab's sign-in or this tab's own other-manager
        // sign-in installing its view, which the result of that sign-in decides.
        else if (snapshot.phase === 'idle' && !otherSignIn) toSignedOut('ended', snapshot.logout.inFlight);
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

  // In idle, M-6 names the person the core holds, or it is not shown. If the core holds
  // someone else (an `actor-changed` was missed or deliberately deferred during an
  // other-manager sign-in), the token it would send is not the idled manager's: nothing
  // is sent, and the screen is BO-01 Session ended with the work kept (B-13, rule 5).
  const coreLostIdled = (): boolean => {
    if (snapshot.phase !== 'idle' || client.staffUserId() === snapshot.person.staffUserId) return false;
    toSignedOut('ended', false);
    return true;
  };

  // The ordinary sign-in from M-6's "different manager" form. It counts on the
  // submitted account, never on the idled one, and that is the server's doing.
  const signInFromIdle = (username: string, password: string): void => {
    if (snapshot.phase !== 'idle' || snapshot.mode !== 'other') return;
    const account = accountKey(username);
    if (currentWaits().some((w) => w.username === account)) return;
    cookieChanging = true;
    otherSignIn = true;
    const sentUnder = revision;
    commit({ ...snapshot, attempt: 'verifying', busy: true });
    void (async () => {
      try {
        const result = await api['/api/back-office/auth/login']({ username, password });
        // The core emitted `actor-changed` for this sign-in's own install before the
        // result got here, and the store ignored it; the result decides.
        otherSignIn = false;
        settled();
        if (revision !== sentUnder || snapshot.phase !== 'idle') return;
        // Only a success may leave the core on someone else; anything else must not leave M-6 up.
        if (result.kind !== 'ok' && coreLostIdled()) return;
        switch (result.kind) {
          case 'ok':
            toSignedIn(personOf(result.value), 'other-manager');
            return;
          case 'refused': {
            const meaning = meaningOf(result.body, 'sign-in');
            if (meaning.kind === 'credentials-error') {
              setIdleAttempt('error');
            } else if (meaning.kind === 'cooldown') {
              if (meaning.seconds > 0) waitEnds.set(account, now() + meaning.seconds * 1000);
              setIdleAttempt('none');
            } else {
              setIdleAttempt('failed');
            }
            return;
          }
          case 'unavailable':
            setIdleAttempt('unavailable');
            return;
          case 'failed':
          case 'invalid-request':
            setIdleAttempt('failed');
            return;
          case 'session-gone':
            // Something else changed this browser's session during the sign-in, and this
            // tab no longer knows whose cookie it holds.
            toSignedOut('ended', false);
            return;
        }
      } catch {
        otherSignIn = false;
        settled();
        if (revision === sentUnder && !coreLostIdled()) setIdleAttempt('failed');
      }
    })();
  };

  return {
    kind: 'real',
    config: configApi(api),
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
      if (cookieChanging) return;
      if (snapshot.phase === 'idle') {
        signInFromIdle(username, password);
        return;
      }
      if (snapshot.phase !== 'signed-out') return;
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
      if (cookieChanging) return;
      // From the top bar (signed in), or "Discard changes and log out" at M-6. Nothing
      // else in M-6 sends it, and the top bar's Log out is inert while M-6 is open.
      if (snapshot.phase === 'idle' && snapshot.mode !== 'confirm-logout') return;
      if (snapshot.phase !== 'signed-in' && snapshot.phase !== 'idle') return;
      // A discard logout under someone else's token would end their session.
      if (coreLostIdled()) return;
      cookieChanging = true;
      const sentUnder = revision;
      const phaseAtSend = snapshot.phase;
      if (snapshot.phase === 'idle') {
        commit({ ...snapshot, busy: true, logout: { inFlight: true, failure: snapshot.logout.failure } });
      } else {
        commit({ ...snapshot, logout: { inFlight: true, failure: snapshot.logout.failure } });
      }
      const settleFailure = (failure: 'none' | 'failed' | 'unavailable'): void => {
        if (snapshot.phase === 'signed-in' || snapshot.phase === 'idle') {
          commit({ ...snapshot, logout: { inFlight: false, failure } });
        }
      };
      void api['/api/back-office/auth/logout']()
        .then((result) => {
          settled();
          // A change of phase meanwhile (an end the core announced, including the
          // confirmed logout itself) has already put the screen where its row says.
          if (revision !== sentUnder || snapshot.phase !== phaseAtSend) return;
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
              if (ends && phaseAtSend === 'idle') {
                // The manager asked to discard: whichever end this is, the draft goes.
                if (code === ErrorCode.UNAUTHENTICATED) toSignedOut('ended', true);
                else if (code === ErrorCode.FORBIDDEN) toSignedOut('refused', true);
                else toSignedOut('resting', true);
              } else if (ends) applyEnd(meaningOf(result.body, 'signed-in'));
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
      if (snapshot.phase === 'idle') {
        // M-6's "Try again" on a general failure sends nothing: fresh entry only.
        if (snapshot.attempt === 'failed' || snapshot.attempt === 'unavailable') setIdleAttempt('none');
        return;
      }
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
      if (snapshot.phase === 'idle') {
        const { attempt } = snapshot;
        if (attempt === 'error' || attempt === 'failed' || attempt === 'unavailable') setIdleAttempt('none');
        return;
      }
      if (snapshot.phase !== 'signed-out') return;
      const { kind } = snapshot.attempt;
      if (kind === 'error' || kind === 'failed' || kind === 'unavailable') setAttempt(NONE);
    },
    reauthenticate(password) {
      if (cookieChanging || snapshot.phase !== 'idle' || snapshot.mode !== 'same') return;
      const account = accountKey(snapshot.person.username);
      // A known wait holds the account off: nothing is sent.
      if (currentWaits().some((w) => w.username === account)) return;
      if (coreLostIdled()) return;
      cookieChanging = true;
      const sentUnder = revision;
      commit({ ...snapshot, attempt: 'verifying', busy: true });
      void (async () => {
        try {
          // The body is `{ password }` and nothing else; the core adds the token.
          const result = await api['/api/back-office/auth/reauthenticate']({ password });
          settled();
          // An end the core announced meanwhile has already put the screen where its row says.
          if (revision !== sentUnder || snapshot.phase !== 'idle') return;
          switch (result.kind) {
            case 'ok':
              toSignedIn(personOf(result.value), 'resumed');
              return;
            case 'refused': {
              const meaning = meaningOf(result.body, 'reauth');
              if (meaning.kind === 'credentials-error') {
                setIdleAttempt('error');
              } else if (meaning.kind === 'cooldown') {
                // The idled account's own wait, shared with BO-01. Zero removes the notice
                // and enables entry, without submission.
                if (meaning.seconds > 0) waitEnds.set(account, now() + meaning.seconds * 1000);
                setIdleAttempt('none');
              } else if (meaning.kind === 'ended' || meaning.kind === 'refused') {
                applyEnd(meaning);
              } else {
                setIdleAttempt('failed');
              }
              return;
            }
            case 'unavailable':
              setIdleAttempt('unavailable');
              return;
            case 'failed':
            case 'invalid-request':
              // Empty and oversize values are stopped before this, so the second cannot
              // happen; if it does it is general.
              setIdleAttempt('failed');
              return;
            case 'session-gone':
              // M-6 as it was, with no notice; the core's events say what changed.
              setIdleAttempt('none');
              return;
          }
        } catch {
          settled();
          if (revision === sentUnder) setIdleAttempt('failed');
        }
      })();
    },
    chooseOtherManager: () => moveMode('same', 'confirm-other'),
    stayWithCurrentManager: () => moveMode('confirm-other', 'same'),
    continueToOtherSignIn: () => moveMode('confirm-other', 'other'),
    backToCurrentManager: () => moveMode('other', 'same'),
    askLogout() {
      if (snapshot.phase !== 'idle' || (snapshot.mode !== 'same' && snapshot.mode !== 'other')) return;
      moveMode(snapshot.mode, 'confirm-logout', snapshot.mode);
    },
    keepDraft() {
      if (snapshot.phase !== 'idle' || snapshot.mode !== 'confirm-logout') return;
      moveMode('confirm-logout', snapshot.from);
    },
    takeFocusMemory() {
      const memory = focusMemory;
      focusMemory = null;
      return memory;
    },
  };
}
