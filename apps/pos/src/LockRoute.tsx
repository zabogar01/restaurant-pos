import { LockScreen, type LockView } from './LockScreen.js';
import type { SessionSnapshot, SessionStore } from './session/types.js';

// POS-01 as the session draws it. The sentences are DESIGN-015's copy table, row
// by row; no code, no server text and no number the server did not send becomes
// copy. `data-lock-state` is the state, so the harness never asserts on wording.

export type TenderDraft = { label: string; outstanding: string; tenders: number };

/** `{wait}`: "{m} min {s} s", "{m} min" at exact minutes, "{s} s" below a minute. */
export function waitText(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} s`;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

const UNAVAILABLE = { title: 'The system is unavailable', body: 'Wait a moment, then try again.' } as const;
const WENT_WRONG = {
  title: 'Something went wrong',
  body: 'Try again. If the problem continues, ask a manager for help.',
} as const;

type SignedOut = Extract<SessionSnapshot, { phase: 'signed-out' }>;

export function lockViewOf(snapshot: SignedOut, draft: TenderDraft | undefined, retry: () => void): LockView {
  const again = { label: 'Try again', onPress: retry };
  const base = { continueDisabled: snapshot.busy };
  const { attempt } = snapshot;
  switch (attempt.kind) {
    case 'verifying':
      return { phase: 'loading', verifying: true };
    case 'error':
      return {
        ...base,
        phase: 'error',
        notice: {
          title: 'PIN not recognised',
          body: 'Enter your six-digit PIN again. Ask a manager if you need help.',
          failure: true,
        },
      };
    case 'cooldown':
      return {
        phase: 'throttled',
        padDisabled: true,
        notice: {
          title: `Sign-in locked for ${waitText(attempt.remainingSeconds)}`,
          body: 'Sign-in is cooling down. Wait for the countdown to finish, then enter your PIN.',
          failure: true,
        },
      };
    case 'unavailable':
      return { ...base, phase: 'unavailable', notice: { ...UNAVAILABLE, failure: true, action: again } };
    case 'failed':
      return { ...base, phase: 'failed', notice: { ...WENT_WRONG, failure: true, action: again } };
    case 'lookup-unavailable':
      return { phase: 'unavailable', padDisabled: true, notice: { ...UNAVAILABLE, failure: true, action: again } };
    case 'lookup-failed':
      return { phase: 'failed', padDisabled: true, notice: { ...WENT_WRONG, failure: true, action: again } };
    case 'none':
      break;
  }
  if (snapshot.why === 'invalidated') {
    return {
      ...base,
      phase: 'invalidated',
      notice: {
        title: 'Your session has ended',
        body: 'Sign in again. Ask a manager for help if your PIN no longer works.',
      },
    };
  }
  if (draft) {
    const count = `${draft.tenders} ${draft.tenders === 1 ? 'tender' : 'tenders'} drafted`;
    return {
      ...base,
      phase: 'draft',
      notice: {
        title: 'Payment in progress on this tab',
        body: `${draft.label} — ${draft.outstanding} outstanding, ${count}. Sign in to continue. Nothing has been recorded yet.`,
        soft: true,
      },
    };
  }
  return { ...base, phase: 'resting' };
}

export function LockRoute({
  snapshot,
  store,
  draft,
}: {
  snapshot: SignedOut;
  store: SessionStore;
  draft: TenderDraft | undefined;
}) {
  return (
    <div className="pos-device">
      <LockScreen
        view={{ ...lockViewOf(snapshot, draft, () => store.retry()), requireFull: true }}
        onSubmit={(pin) => store.signIn(pin)}
      />
    </div>
  );
}
