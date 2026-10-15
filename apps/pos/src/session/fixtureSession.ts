import type { Person, SessionSnapshot, SessionStore } from './types.js';

// FIXTURE MODE ONLY. The cashier, and the idle figure, the fixture screens draw.
// This module is reached from `source.ts` behind `__FIXTURE_SESSION__` and from
// nowhere else, so a built bundle holds none of it (B-24): the bundle test looks
// for the marker below. It does not import the request module and it never
// touches the network: a sign-in, a touch and a Release make no request.

/** Exported only so the bundle test can prove this module is absent from a build. */
export const FIXTURE_SESSION_MARKER = 'fixture-session:rpos-8f3a1c';

const FIXTURE_CASHIER: Person = { name: 'Ana R.', role: 'CASHIER' };
const FIXTURE_IDLE_SECONDS = 90;

const SIGNED_IN: SessionSnapshot = {
  phase: 'signed-in',
  person: FIXTURE_CASHIER,
  remainingSeconds: FIXTURE_IDLE_SECONDS,
};
const RESTING: SessionSnapshot = { phase: 'signed-out', why: 'resting', attempt: { kind: 'none' }, busy: false };

export function createFixtureSession(): SessionStore {
  let snapshot: SessionSnapshot = SIGNED_IN;
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
    // The PIN is compared against nothing and goes nowhere.
    signIn: () => set(SIGNED_IN),
    release: () => set(RESTING),
    retry: () => {},
  };
}
