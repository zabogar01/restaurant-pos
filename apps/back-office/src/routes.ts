// The back office's own route manifest (consult C2 section 7, ADR-011 rule 11). The
// server answers any extensionless path under /back-office/ with the entry point, and
// answers /back-office/assets/ and any path with a dot in its last segment as files, so
// a client path may be neither. A client path names a screen and nothing else: no
// record id, no draft, no query string. Nothing here or anywhere in src reads the
// address bar's query or hash, in either build (a test scans for it).

export type Screen = 'landing' | 'tables' | 'settings';

/** One row per screen: a screen added to the type stops compiling until it has a path. */
export const PATHS = {
  landing: '/back-office/',
  tables: '/back-office/tables',
  settings: '/back-office/settings',
} as const satisfies Record<Screen, string>;

export const MANIFEST: ReadonlyArray<{ path: string; screen: Screen }> = (Object.keys(PATHS) as Screen[]).map(
  (screen) => ({ path: PATHS[screen], screen })
);

/** The screen a pathname names, or null when it names none (the caller replaces it with the landing). */
export function screenAt(pathname: string): Screen | null {
  return MANIFEST.find((entry) => entry.path === pathname)?.screen ?? null;
}
