import {
  FIXTURE_MENU_MARKER,
  MENU_CATEGORIES,
  MENU_ITEMS,
  itemDestination,
  itemSheetFixtures,
  menuFixtureFor,
} from '../menuFixtures.js';
import type { CatalogMenu, CatalogSnapshot, CatalogStore, FixtureMenuFacts } from './types.js';

// FIXTURE MODE ONLY, and reached only through session/source.ts. The fixture
// source of the catalog: it makes no request and starts no timer (ARCH-021
// consult C4 item 5). Its menu is the reviewed artifact's, held as the same
// client shape the served store gives, so MenuRegion and the sheets read one
// shape and do not know which source it is.

const FIXTURE_MENU: CatalogMenu = {
  version: 0,
  categories: MENU_CATEGORIES,
  items: /* @__PURE__ */ MENU_ITEMS.map((i) => ({
    id: i.id,
    categoryId: i.category,
    name: i.name,
    price: i.price,
    available: true,
    variants: [],
    modifiers: [],
  })),
  presets: [],
};

const SNAPSHOT: CatalogSnapshot = {
  menu: FIXTURE_MENU,
  read: 'ready',
  failure: null,
  outOfDate: false,
  availabilityChanges: 0,
};

export function createFixtureCatalog(): CatalogStore {
  return {
    kind: 'fixture',
    getSnapshot: () => SNAPSHOT,
    subscribe: () => () => {},
    start: () => () => {},
    retry: () => {},
  };
}

/** The marker rides on the facts, which are what a build drops, so the bundle test cannot pass vacuously. */
export const fixtureMenuFacts: FixtureMenuFacts & { readonly marker: string } = {
  marker: FIXTURE_MENU_MARKER,
  pictureFor: menuFixtureFor,
  eightySixedFor: (view) => menuFixtureFor(view).eightySixed ?? [],
  itemDestination,
  itemSheet: (state) => itemSheetFixtures()[state],
};
