import type { ComponentType } from 'react';
import { App } from '../App.js';
import { createFixtureCatalog, fixtureMenuFacts } from '../catalog/fixtureCatalog.js';
import type { CatalogSnapshot, CatalogStore, FixtureMenuFacts } from '../catalog/types.js';
import { createFixtureSession } from './fixtureSession.js';
import { createRealSession } from './realSession.js';
import type { SessionStore } from './types.js';

// THE switch (ARCH-014 question 3, mechanism 1). `__FIXTURE_SESSION__` is defined
// by vite.config.ts from the command, so a served build cannot be flipped by an
// environment variable, a `--mode` or a query string. It is the one constant for
// everything fixture: the session, POS-01's `?state=` pictures (App), the fixture
// menu with its `?state=` pictures and item sheets, and POS-03's list of fixture
// states (ARCH-021 consult C4 item 5). Each is reached only through the lines
// below, and the minifier drops the branch a build does not take: the bundle
// tests find none of them in a built output.

// Vitest does not load this package's vite.config.ts (the root vitest.config.ts
// is its own), so under test the constant is undefined, and a test run is a
// `serve`. Every build defines it, and the bundle test proves the build's value.
const FIXTURE = typeof __FIXTURE_SESSION__ === 'undefined' || __FIXTURE_SESSION__;

export function createSessionStore(): SessionStore {
  return FIXTURE ? createFixtureSession() : createRealSession();
}

/** POS-01's fixture pictures, drawn at `/pos/` in fixture mode. `null` in a built bundle. */
export const FixtureLockPictures: ComponentType | null = FIXTURE ? App : null;

/** The catalog behind the switch: the fixture menu in fixture mode, the server's in a build. */
export function createCatalogStore(): CatalogStore {
  return FIXTURE ? createFixtureCatalog() : createServedCatalog();
}

/** The fixture menu's `?state=` pictures, item sheets and prices. `null` in a built bundle. */
export const FixtureMenu: FixtureMenuFacts | null = FIXTURE ? fixtureMenuFacts : null;

/** POS-03's list of fixture states (a review aid). False in a built bundle, whatever NODE_ENV says. */
export const FIXTURE_ORDER_STATES: boolean = FIXTURE;

// Until the served store is wired (next commit) a build holds an empty catalog,
// never the fixture menu (B-24).
const EMPTY: CatalogSnapshot = {
  menu: { version: 0, categories: [], items: [], presets: [] },
  read: 'ready',
  failure: null,
  outOfDate: false,
  availabilityChanges: 0,
};

function createServedCatalog(): CatalogStore {
  return { kind: 'real', getSnapshot: () => EMPTY, subscribe: () => () => {}, start: () => () => {}, retry: () => {} };
}
