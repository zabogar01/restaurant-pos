import type { ComponentType } from 'react';
import { App } from '../App.js';
import { createFixtureSession } from './fixtureSession.js';
import { createRealSession } from './realSession.js';
import type { SessionStore } from './types.js';

// THE switch (ARCH-014 question 3, mechanism 1). `__FIXTURE_SESSION__` is defined
// by vite.config.ts from the command, so a served build cannot be flipped by an
// environment variable, a `--mode` or a query string. Both the fixture session
// and POS-01's `?state=` pictures (App) are reached only through the two lines
// below, and the minifier drops the branch a build does not take: the bundle test
// finds neither in a built output.

// Vitest does not load this package's vite.config.ts (the root vitest.config.ts
// is its own), so under test the constant is undefined, and a test run is a
// `serve`. Every build defines it, and the bundle test proves the build's value.
const FIXTURE = typeof __FIXTURE_SESSION__ === 'undefined' || __FIXTURE_SESSION__;

export function createSessionStore(): SessionStore {
  return FIXTURE ? createFixtureSession() : createRealSession();
}

/** POS-01's fixture pictures, drawn at `/pos/` in fixture mode. `null` in a built bundle. */
export const FixtureLockPictures: ComponentType | null = FIXTURE ? App : null;
