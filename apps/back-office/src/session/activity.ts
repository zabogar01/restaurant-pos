import type { OfficeApi } from './api.js';

// FR-A2b: `activity` is sent only from a person's input. The input listener below
// is the only caller of the back-office API's activity function: a countdown, a
// poll or a deadline read cannot reach it (the source scan in the session tests
// holds `sendActivity` and the call to this file; the route is named once more, in
// api.ts).

/**
 * Leading edge only: an input sends `activity` when none has been sent within this
 * window, and does nothing otherwise. A client constant, not policy (ARCH-014 q6).
 * There is no trailing send, because a trailing send is a timer.
 */
export const ACTIVITY_WINDOW_MS = 60_000;

type ActivityOptions = {
  api: OfficeApi;
  /** The monotonic clock, in milliseconds. */
  now: () => number;
  /** Whether this tab may extend a session now. Nothing is sent otherwise. */
  active: () => boolean;
};

function sendActivity({ api }: ActivityOptions): void {
  void api['/api/back-office/auth/activity']();
}

/**
 * One capture-phase listener on the document for `pointerdown`, `keydown` and
 * `wheel` (a manager reading a long report with the wheel is a person acting). It
 * reads nothing from the event, not the key and not the target: it must not be a
 * channel for the password typed into BO-01. The request has no body.
 */
export function listenForActivity(options: ActivityOptions): () => void {
  let lastSentAt: number | null = null;
  const onInput = () => {
    if (!options.active()) return;
    const at = options.now();
    if (lastSentAt !== null && at - lastSentAt < ACTIVITY_WINDOW_MS) return;
    lastSentAt = at;
    sendActivity(options);
  };
  const events = ['pointerdown', 'keydown', 'wheel'] as const;
  for (const name of events) document.addEventListener(name, onInput, { capture: true, passive: true });
  return () => {
    for (const name of events) document.removeEventListener(name, onInput, true);
  };
}
