import type { SettingsReadView } from '@pos/contracts';
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

// Every configuration call answers `unavailable` and sends nothing, so BO-05 shows its
// designed failed-to-load state here. An in-memory fake of the table commands would
// reimplement uniqueness and no-ops in a second place (consult C2 section 7).
const unavailable = async () => ({ kind: 'unavailable' as const });

// BO-08 reads one fixture version, so the fixture session draws the settings screen's read
// view. The values are the Frost artifact's version 4 (settings.js), fixture data and not a
// seed. A save answers `unavailable` like the table commands: an in-memory fake of the
// version rule would reimplement it in a second place.
const FIXTURE_SETTINGS: SettingsReadView = {
  installation: { currency: 'IDR', minorUnitPrecision: 0 },
  current: {
    version: 4,
    createdAt: '2026-10-12T07:05:00.000Z',
    createdByName: 'M. Iqbal',
    taxRatePpm: '100000',
    serviceChargeRatePpm: '50000',
    outletName: 'Warung Sederhana',
    address: 'Jl. Melati No. 12\nKebayoran Baru\nJakarta Selatan 12160',
    phone: '021 555 0134',
    npwpd: 'P.2.0012345.07.001',
    footer: 'Terima kasih atas kunjungan Anda',
  },
};

const CONFIG: SessionStore['config'] = {
  '/api/back-office/config/settings': async () => ({ kind: 'ok' as const, value: FIXTURE_SETTINGS }),
  '/api/back-office/config/settings/save': unavailable,
  '/api/back-office/config/tables': unavailable,
  '/api/back-office/config/tables/create': unavailable,
  '/api/back-office/config/tables/update': unavailable,
  '/api/back-office/config/tables/deactivate': unavailable,
  '/api/back-office/config/tables/reactivate': unavailable,
  // The payment methods answer `unavailable` too: BO-08 then draws its methods read failure
  // under the fixture settings, and there is no fixture method list to seed.
  '/api/back-office/config/tender-methods': unavailable,
  '/api/back-office/config/tender-methods/create': unavailable,
  '/api/back-office/config/tender-methods/update': unavailable,
  '/api/back-office/config/tender-methods/deactivate': unavailable,
  '/api/back-office/config/tender-methods/reactivate': unavailable,
  // The catalog answers `unavailable` as well: BO-03 then draws its read failure, and there is
  // no fixture menu to seed.
  '/api/back-office/config/catalog': unavailable,
  '/api/back-office/config/catalog/categories/create': unavailable,
  '/api/back-office/config/catalog/categories/update': unavailable,
  '/api/back-office/config/catalog/categories/reorder': unavailable,
  '/api/back-office/config/catalog/categories/archive': unavailable,
  '/api/back-office/config/catalog/categories/restore': unavailable,
  '/api/back-office/config/catalog/items/create': unavailable,
  '/api/back-office/config/catalog/items/update': unavailable,
  '/api/back-office/config/catalog/items/reorder': unavailable,
  '/api/back-office/config/catalog/items/archive': unavailable,
  '/api/back-office/config/catalog/items/restore': unavailable,
  '/api/back-office/config/catalog/items/mark-unavailable': unavailable,
  '/api/back-office/config/catalog/items/mark-available': unavailable,
  // The discount presets answer `unavailable` as well: BO-07 then draws its read failure, and
  // there is no fixture preset list to seed.
  '/api/back-office/config/catalog/presets': unavailable,
  '/api/back-office/config/catalog/presets/create': unavailable,
  '/api/back-office/config/catalog/presets/update': unavailable,
  '/api/back-office/config/catalog/presets/deactivate': unavailable,
  '/api/back-office/config/catalog/presets/reactivate': unavailable,
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
    config: CONFIG,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => () => {},
    // The credentials are compared against nothing and go nowhere.
    signIn: () =>
      set({ phase: 'signed-in', person: FIXTURE_MANAGER, logout: { inFlight: false, failure: 'none' }, arrival: 'fresh' }),
    logout: () => set(RESTING),
    retry: () => {},
    dismiss: () => {},
    // The fixture session never goes idle, so nothing of M-6 is drawn in fixture mode.
    reauthenticate: () => {},
    chooseOtherManager: () => {},
    stayWithCurrentManager: () => {},
    continueToOtherSignIn: () => {},
    backToCurrentManager: () => {},
    askLogout: () => {},
    keepDraft: () => {},
    takeFocusMemory: () => null,
  };
}
