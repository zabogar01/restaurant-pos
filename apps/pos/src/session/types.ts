// The POS session as a screen sees it (ARCH-014 question 5). Every state and
// event of that table is one value here; nothing in a screen reasons about a
// server code.

export type Person = { name: string; role: 'CASHIER' | 'MANAGER' };

/**
 * What the last sign-in attempt, or the first session read, left on POS-01.
 * `cooldown` counts down from the number the server sent, on the monotonic clock.
 * `lookup-*` is the first read failing: the sign-in shell is drawn with its
 * controls off and "Try again" repeats the read.
 */
export type Attempt =
  | { kind: 'none' }
  | { kind: 'verifying' }
  | { kind: 'error' }
  | { kind: 'cooldown'; remainingSeconds: number }
  | { kind: 'unavailable' }
  | { kind: 'failed' }
  | { kind: 'lookup-unavailable' }
  | { kind: 'lookup-failed' };

export type SessionSnapshot =
  /** The first `me` has not answered: the empty device frame. */
  | { phase: 'starting' }
  | {
      phase: 'signed-out';
      /** `invalidated` is the one reason POS-01 says anything about; the rest rest. */
      why: 'resting' | 'invalidated';
      attempt: Attempt;
      /** A release is in flight: nothing that would send a cookie-changing request is live. */
      busy: boolean;
    }
  | {
      phase: 'signed-in';
      person: Person;
      /** Whole seconds of the server's idle limit left, or null when no session is counting. */
      remainingSeconds: number | null;
    };

export interface SessionStore {
  /** Which source this is. A screen may differ in what it draws, never in what it asks. */
  readonly kind: 'fixture' | 'real';
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  /** Reads the session once, and begins listening. Returns the stop. Idempotent in its read. */
  start(): () => void;
  /** Sends the PIN. Ignored while a sign-in or a release is in flight. */
  signIn(pin: string): void;
  /** Leaves the screen for POS-01 at once, whatever the server answers. */
  release(): void;
  /** POS-01's "Try again": repeats a failed first read, or clears a failed attempt. Sends no credential. */
  retry(): void;
}
