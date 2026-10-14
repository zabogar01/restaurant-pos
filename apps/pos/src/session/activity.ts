import type { PosApi } from './api.js';

// FR-A2b: `activity` is sent only from a person's input. The input listener below
// is the only caller of the POS API's activity function: a countdown, a poll or a
// deadline read cannot reach it (the source scan in the session tests holds
// `sendActivity` and the call to this file; the route is named once more, in api.ts).

/**
 * Leading edge only: an input sends `activity` when none has been sent within this
 * window, and does nothing otherwise. A client constant, not policy (ARCH-014 q6).
 * There is no trailing send, because a trailing send is a timer.
 */
export const ACTIVITY_WINDOW_MS = 5000;

type ActivityOptions = {
  api: PosApi;
  /** The monotonic clock, in milliseconds. */
  now: () => number;
  /** Whether this tab is signed in. Nothing is sent otherwise. */
  signedIn: () => boolean;
};

function sendActivity({ api }: ActivityOptions): void {
  void api['/api/pos/auth/activity']();
}

/**
 * One capture-phase listener on the document for `pointerdown` and `keydown`. It
 * reads nothing from the event, not the key and not the target: it must not be a
 * channel for the digits typed at the PIN pad or at M-1. The request has no body.
 */
export function listenForActivity(options: ActivityOptions): () => void {
  let lastSentAt: number | null = null;
  const onInput = () => {
    if (!options.signedIn()) return;
    const at = options.now();
    if (lastSentAt !== null && at - lastSentAt < ACTIVITY_WINDOW_MS) return;
    lastSentAt = at;
    sendActivity(options);
  };
  document.addEventListener('pointerdown', onInput, true);
  document.addEventListener('keydown', onInput, true);
  return () => {
    document.removeEventListener('pointerdown', onInput, true);
    document.removeEventListener('keydown', onInput, true);
  };
}
