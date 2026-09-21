// POS-01's states as fixtures, selected by ?state= exactly as the reviewed
// artifact selects them (docs/design/visual-directions/frost/pos/lock.html).
// No server, no session, no throttle: every notice below is a static picture
// of a state, and nothing here decides which one is true.

export type LockState =
  | 'default'
  | 'loading'
  | 'error'
  | 'permission-denied'
  | 'throttled'
  | 'invalidated'
  | 'draft'
  | 'incident';

export type Notice = {
  title: string;
  body: string;
  soft?: boolean;
  /**
   * The answer to a PIN just entered, when it did not succeed. Announced the
   * moment it appears (role="alert"), on both pads: a wrong PIN nobody hears
   * about is a defect for a screen-reader user.
   */
  failure?: true;
};

export const LOCK_STATES: ReadonlyArray<{ id: LockState; label: string }> = [
  { id: 'default', label: 'Resting' },
  { id: 'loading', label: 'Verifying' },
  { id: 'error', label: 'Wrong PIN' },
  { id: 'permission-denied', label: 'Deactivated user' },
  { id: 'throttled', label: 'LOGIN cooldown' },
  { id: 'invalidated', label: 'Session invalidated' },
  { id: 'draft', label: 'Tender draft waiting' },
  { id: 'incident', label: 'Kitchen printer emergency' },
];

// Copy is the artifact's, verbatim, except permission-denied.
export const NOTICES: Partial<Record<LockState, Notice>> = {
  error: {
    title: 'PIN not recognised',
    body: '2 attempts remaining before a five-minute cooldown.',
    failure: true,
  },
  // PROVISIONAL COPY. SCREEN-INVENTORY POS-01 declares this state ("a PIN
  // belonging to a deactivated user", FR-B3) but the reviewed artifact has no
  // drawing of it, so it has no reviewed wording. Flagged in the FE-001 handoff.
  'permission-denied': {
    title: 'This account is deactivated',
    body: 'Ask a manager to restore your access in the back office.',
    failure: true,
  },
  throttled: {
    title: 'Sign-in locked for 4 min 12 s',
    body:
      'Five failed attempts. This cooldown applies to sign-in only and is held by the server for the whole installation.',
    failure: true,
  },
  invalidated: {
    title: 'Your session was ended by a manager',
    body: 'Your account or PIN was changed in the back office. Ask a manager for your new PIN.',
  },
  draft: {
    title: 'Payment in progress on this tab',
    body: 'Table 7 — 155.925 outstanding, 2 tenders drafted. Sign in to continue. Nothing has been recorded yet.',
    soft: true,
  },
};

export function lockStateFrom(search: string): LockState {
  const requested = new URLSearchParams(search).get('state');
  return LOCK_STATES.find((s) => s.id === requested)?.id ?? 'default';
}
