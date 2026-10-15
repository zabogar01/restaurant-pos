// The back-office session as a screen sees it (ARCH-014 question 5, the back office,
// with lead rulings 3 to 8 of PHASE0-011d1). Every state and event of that table is
// one value here; nothing in a screen reasons about a server code.

export type Person = { staffUserId: string; name: string; username: string };

/**
 * What the last sign-in attempt, or the first session read, left on BO-01.
 * `lookup-*` is the first read failing: the sign-in shell is drawn with its controls
 * off and "Try again" repeats the read. A cooldown is not an attempt: it is a wait
 * held for a username (`waits`), because it follows the username, not the attempt.
 */
export type Attempt =
  | { kind: 'none' }
  | { kind: 'verifying' }
  | { kind: 'error' }
  | { kind: 'unavailable' }
  | { kind: 'failed' }
  | { kind: 'lookup-unavailable' }
  | { kind: 'lookup-failed' };

/** A known wait for one account, keyed by the trimmed, lower-case username. */
export type Wait = { username: string; remainingSeconds: number };

/** `ended` and `refused` are the two reasons BO-01 says anything about; the rest rest. */
export type WhySignedOut = 'resting' | 'ended' | 'refused';

/** A logout the manager asked for: in flight, and what the last unconfirmed answer was. */
export type LogoutState = { inFlight: boolean; failure: 'none' | 'failed' | 'unavailable' };

export type SessionSnapshot =
  /** The first `me` has not answered: nothing is drawn but the empty page. */
  | { phase: 'starting' }
  | {
      phase: 'signed-out';
      why: WhySignedOut;
      attempt: Attempt;
      /** Unexpired waits, in whole seconds, redrawn by the store as they count down. */
      waits: readonly Wait[];
      /** A sign-in is in flight: nothing that would send a cookie-changing request is live. */
      busy: boolean;
      /**
       * The staff user whose working area is still mounted, hidden and inert under
       * BO-01, or null when there is none. A sign-in as this user shows it again as it
       * was; a sign-in as anyone else changes the key and React destroys it.
       */
      held: string | null;
    }
  | { phase: 'signed-in'; person: Person; logout: LogoutState };

export interface SessionStore {
  /** Which source this is. A screen may differ in what it draws, never in what it asks. */
  readonly kind: 'fixture' | 'real';
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  /** Reads the session once, and begins listening. Returns the stop. Idempotent in its read. */
  start(): () => void;
  /**
   * Sends the username and password. Ignored while a sign-in or a logout is in
   * flight. The password is an argument: it goes into the request body and is not kept.
   */
  signIn(username: string, password: string): void;
  /** Log out, and "Try again" on a logout that was not confirmed. One at a time. */
  logout(): void;
  /** BO-01's "Try again": repeats a failed first read, or clears a failed attempt. Sends no credential. */
  retry(): void;
  /** Clears an error notice once the manager edits a field. */
  dismiss(): void;
}
