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

/**
 * M-6's four modes (SCREEN-INVENTORY, M-6): the fixed-username form, the
 * acknowledgement before another manager's form, that form, and the discard
 * confirmation of Log out.
 */
export type IdleMode = 'same' | 'confirm-other' | 'other' | 'confirm-logout';

/** What the last credential request left in M-6's current form. A cooldown is a wait, not an attempt. */
export type IdleAttempt = 'none' | 'verifying' | 'error' | 'unavailable' | 'failed';

/**
 * How a signed-in frame came to be. `fresh` is a sign-in at BO-01. `resumed` is a
 * same-manager re-authentication: the focus and selection come back and *Resumed* is
 * shown. `other-manager` is a sign-in from M-6, whose focus goes to Log out.
 */
export type Arrival = 'fresh' | 'resumed' | 'other-manager';

/** The element that was focused, and its selection, when the session went idle. */
export type FocusMemory = { element: HTMLElement; start: number | null; end: number | null };

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
  | { phase: 'signed-in'; person: Person; logout: LogoutState; arrival: Arrival }
  | {
      /** M-6 over the frame: the idled person's work stays mounted and inert behind it. */
      phase: 'idle';
      person: Person;
      mode: IdleMode;
      /** Which form the discard confirmation was opened from, and where "Keep this draft" returns. */
      from: 'same' | 'other';
      attempt: IdleAttempt;
      waits: readonly Wait[];
      /** A sign-in, re-authentication or logout is in flight: nothing that would send is live. */
      busy: boolean;
      logout: LogoutState;
    };

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
  /**
   * Log out, and "Try again" on a logout that was not confirmed. One at a time. At M-6
   * it is the confirmation's "Discard changes and log out"; elsewhere in M-6 it is ignored.
   */
  logout(): void;
  /** BO-01's and M-6's "Try again": repeats a failed first read, or clears a failed attempt. Sends no credential. */
  retry(): void;
  /** Clears an error notice once the manager edits a field. */
  dismiss(): void;

  // M-6. Each is ignored unless the phase is idle, the mode is the one named, and
  // nothing is in flight.
  /** The idled manager's password alone, to the re-authentication route. */
  reauthenticate(password: string): void;
  /** "Sign in as a different manager": same, to the acknowledgement. */
  chooseOtherManager(): void;
  /** "Stay with current manager": the acknowledgement, back to the fixed-username form. */
  stayWithCurrentManager(): void;
  /** "Continue to sign-in": the acknowledgement, to the other manager's form. */
  continueToOtherSignIn(): void;
  /** "Back to {username}": the other manager's form, to the fixed-username form. */
  backToCurrentManager(): void;
  /** "Log out": either form, to the discard confirmation. */
  askLogout(): void;
  /** "Keep this draft": the confirmation, back to the form it came from. */
  keepDraft(): void;
  /**
   * What was focused before M-6 opened, once. Called when the same manager resumes, after
   * the work is no longer inert; any other way out of M-6 forgets it.
   */
  takeFocusMemory(): FocusMemory | null;
}
