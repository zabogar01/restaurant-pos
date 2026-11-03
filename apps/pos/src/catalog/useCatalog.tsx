import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { MenuFixture } from '../menuFixtures.js';
import type { OrderState, OrderView } from '../orderFixtures.js';
import type { ItemSheetFixture } from '../sheetFixtures.js';
import { createCatalogStore, FixtureMenu } from '../session/source.js';
import type { SessionStore } from '../session/types.js';
import { useSessionStore } from '../session/useSession.js';
import type { CatalogItem, CatalogSnapshot, CatalogStore } from './types.js';

// The catalog store above the routes, as the session store is (session/useSession.tsx).
// A test that wants a particular store, a served one, passes it.

const CatalogContext = createContext<CatalogStore | null>(null);

// One catalog store for each session store: the served one is built from the reads the
// session store holds, and a screen on its own gets the same store the routes would.
const defaults = new WeakMap<SessionStore, CatalogStore>();

export function CatalogProvider({ store, children }: { store: CatalogStore; children: ReactNode }) {
  return <CatalogContext.Provider value={store}>{children}</CatalogContext.Provider>;
}

export function useCatalogStore(): CatalogStore {
  const provided = useContext(CatalogContext);
  const session = useSessionStore();
  if (provided) return provided;
  let store = defaults.get(session);
  if (!store) {
    store = createCatalogStore(session.catalogReads);
    defaults.set(session, store);
  }
  return store;
}

/** The ids of the items the menu has 86'd. */
export const unavailableIn = (items: ReadonlyArray<CatalogItem>): ReadonlyArray<string> =>
  items.filter((i) => !i.available).map((i) => i.id);

/**
 * The items 86'd **now**, for a fire or a close at the press (consult C4 item 5):
 * the store's own list when it is the server's, the fixture's picture for the
 * place a view draws otherwise. It is read at the press and never kept.
 */
export function unavailableAt(store: CatalogStore, view: OrderView): ReadonlyArray<string> {
  if (store.kind === 'fixture') return FixtureMenu?.eightySixedFor(view) ?? [];
  return unavailableIn(store.getSnapshot().menu?.items ?? []);
}

export type CatalogView = {
  store: CatalogStore;
  snapshot: CatalogSnapshot;
  /**
   * POS-03's `?state=` picture of the menu: fixture mode only, `null` when the
   * menu is the server's. In a served build `?state=` chooses nothing about it.
   */
  picture: MenuFixture | null;
  /** The ids of the items the menu has 86'd, for the tiles, the order's tags and the Send refusal. */
  unavailable: ReadonlyArray<string>;
  /** A tile's destination, or `null` when a tile opens nothing (a served menu, until M-2 is built for it). */
  destinationOf: ((itemId: string, from?: OrderState) => string) | null;
  /** The item sheet a `sheet-item…` state draws: the fixture's own, and nothing at all for a served menu. */
  itemSheetFor: (state: OrderState) => ItemSheetFixture | undefined;
};

export function useCatalog(view: OrderView): CatalogView {
  const store = useCatalogStore();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const fixture = store.kind === 'fixture' ? FixtureMenu : null;
  return {
    store,
    snapshot,
    picture: fixture ? fixture.pictureFor(view) : null,
    unavailable: fixture ? fixture.eightySixedFor(view) : unavailableIn(snapshot.menu?.items ?? []),
    destinationOf: fixture ? fixture.itemDestination : null,
    itemSheetFor: (state) => fixture?.itemSheet(state),
  };
}
