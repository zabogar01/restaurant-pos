import type { ComponentType } from 'react';
import { App } from '../App.js';
import { createRealCatalog } from '../catalog/catalogStore.js';
import { createFixtureCatalog, fixtureMenuFacts } from '../catalog/fixtureCatalog.js';
import type { CatalogReads, CatalogStore, FixtureMenuFacts } from '../catalog/types.js';
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
// tests find none of them in a built output. `createSessionStore` and
// `createCatalogStore` each pick one of two things; nothing else names either.

// Vitest does not load this package's vite.config.ts (the root vitest.config.ts
// is its own), so under test the constant is undefined, and a test run is a
// `serve`. Every build defines it, and the bundle test proves the build's value.
const FIXTURE = typeof __FIXTURE_SESSION__ === 'undefined' || __FIXTURE_SESSION__;

export function createSessionStore(): SessionStore {
  return FIXTURE ? createFixtureSession() : createRealSession();
}

/** POS-01's fixture pictures, drawn at `/pos/` in fixture mode. `null` in a built bundle. */
export const FixtureLockPictures: ComponentType | null = FIXTURE ? App : null;

/**
 * The catalog behind the switch: the fixture menu in fixture mode, the server's in a build.
 * A build is handed the session's two reads; there is no fallback in either direction, so an
 * empty served catalog is empty and a served failure is a failure, never the fixture menu (B-24).
 */
export function createCatalogStore(reads?: CatalogReads): CatalogStore {
  if (FIXTURE) return createFixtureCatalog();
  if (!reads) throw new Error('a served catalog needs the session store\'s reads');
  return createRealCatalog(reads);
}

/** The fixture menu's `?state=` pictures and item sheets. `null` in a built bundle. */
export const FixtureMenu: FixtureMenuFacts | null = FIXTURE ? fixtureMenuFacts : null;

/** POS-03's list of fixture states (a review aid). False in a built bundle, whatever NODE_ENV says. */
export const FIXTURE_ORDER_STATES: boolean = FIXTURE;
