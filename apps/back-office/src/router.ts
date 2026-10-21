import { useSyncExternalStore } from 'react';
import { PATHS, screenAt, type Screen } from './routes.js';
import { workGuard } from './work/guard.js';

// Two destinations need no router dependency (consult C2 section 7): `pushState`,
// `popstate`, and the manifest. The current screen is read from the address bar, never
// held twice. The path holds no draft, so it lives outside the keyed working area.
//
// A screen with unsaved work or a save in flight is asked before the manager leaves it
// (`workGuard`). On browser Back or Forward the address has already changed, so it is put
// back with `pushState` while the decision is shown, and the destination is pushed again
// only when the manager discards. No `beforeunload` prompt exists: its wording is the
// browser's, not the design's (rule 24), and a reload destroys the working area (rule 22).

const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of [...listeners]) listener();
};

/** The screen the address bar names; an unknown path reads as the landing until it is replaced. */
const read = (): Screen => screenAt(window.location.pathname) ?? 'landing';

/** The screen the work area shows. Differs from the address bar only while a decision restores it. */
let shown: Screen = read();

function arrive(destination: Screen): void {
  if (screenAt(window.location.pathname) !== destination) window.history.pushState(null, '', PATHS[destination]);
  shown = destination;
  notify();
}

export const router = {
  current: (): Screen => shown,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Replaces a path that names no screen with the landing; listens for Back and Forward. Returns the stop. */
  start(): () => void {
    if (screenAt(window.location.pathname) === null) window.history.replaceState(null, '', PATHS.landing);
    shown = read();
    notify();
    const onPop = () => {
      const destination = read();
      const guard = workGuard.current();
      if (guard === null) {
        shown = destination;
        notify();
        return;
      }
      const outcome = guard.leave(() => arrive(destination));
      if (outcome === 'held') window.history.pushState(null, '', PATHS[shown]);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  },

  /** A rail entry. */
  navigate(destination: Screen): void {
    const guard = workGuard.current();
    if (guard === null) {
      if (destination !== shown) arrive(destination);
      return;
    }
    guard.leave(() => {
      if (destination !== shown) arrive(destination);
    });
  },
};

export function useScreen(): Screen {
  return useSyncExternalStore(router.subscribe, router.current);
}
