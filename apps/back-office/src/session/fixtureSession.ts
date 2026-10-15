import type { Person, SessionSnapshot, SessionStore } from './types.js';

// FIXTURE MODE ONLY. The manager the Frost shell draws. This module is reached from
// `source.ts` behind `__FIXTURE_SESSION__` and from nowhere else, so a built bundle
// holds none of it (B-24): the bundle test looks for the marker below. It does not
// import the request module and it never touches the network: a sign-in and a
// Log out make no request.

/** Exported only so the bundle test can prove this module is absent from a build. */
export const FIXTURE_SESSION_MARKER = 'fixture-session:rpos-office-5b2e7d';

// Fixture data from the Frost shell (shell.html, office.js), not product copy.
const FIXTURE_MANAGER: Person = { staffUserId: 'fixture-manager', name: 'M. Iqbal', username: 'm.iqbal' };

const RESTING: SessionSnapshot = {
  phase: 'signed-out',
  why: 'resting',
  attempt: { kind: 'none' },
  waits: [],
  busy: false,
  held: null,
};

export function createFixtureSession(): SessionStore {
  let snapshot: SessionSnapshot = RESTING;
  const listeners = new Set<() => void>();
  const set = (next: SessionSnapshot) => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    kind: 'fixture',
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => () => {},
    // The credentials are compared against nothing and go nowhere.
    signIn: () => set({ phase: 'signed-in', person: FIXTURE_MANAGER, logout: { inFlight: false, failure: 'none' } }),
    logout: () => set(RESTING),
    retry: () => {},
    dismiss: () => {},
  };
}
