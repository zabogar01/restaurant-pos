import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { createSessionStore } from './source.js';
import type { SessionSnapshot, SessionStore } from './types.js';

// The store above the frame. A screen rendered on its own reads the module's
// default store without a provider; a test that wants a particular store passes one.

const SessionContext = createContext<SessionStore | null>(null);

let standalone: SessionStore | null = null;

export function SessionProvider({ store, children }: { store: SessionStore; children: ReactNode }) {
  return <SessionContext.Provider value={store}>{children}</SessionContext.Provider>;
}

export function useSessionStore(): SessionStore {
  const provided = useContext(SessionContext);
  if (provided) return provided;
  standalone ??= createSessionStore();
  return standalone;
}

/** The configuration routes, for a screen; it can call no other route. */
export function useConfig(): SessionStore['config'] {
  return useSessionStore().config;
}

export function useSession(): SessionSnapshot {
  const store = useSessionStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
