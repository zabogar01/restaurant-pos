export type RouteMethod = 'GET' | 'POST';

export interface RouteEntry {
  method: RouteMethod;
  /** The full path, `/api` included, as a client requests it. */
  path: string;
  /**
   * True only for a route the server declares as an interactive, active session
   * route: its resolution counts as a person acting. False for health, the sign-ins
   * and every route that is not an active session route.
   */
  interactive: boolean;
}

/**
 * Every API route the server registers, for health and both surfaces. A server test
 * holds this equal to the registered routes in both directions, so a route added on
 * the server fails that test until it is listed here, and a client that maps every
 * entry fails to compile until it declares the call. Test-only probe routes are not
 * in it.
 */
export const ROUTE_TABLE = [
  { method: 'GET', path: '/api/health', interactive: false },
  { method: 'POST', path: '/api/pos/auth/login', interactive: false },
  { method: 'GET', path: '/api/pos/auth/me', interactive: false },
  { method: 'POST', path: '/api/pos/auth/activity', interactive: true },
  { method: 'POST', path: '/api/pos/auth/release', interactive: false },
  { method: 'POST', path: '/api/back-office/auth/login', interactive: false },
  { method: 'GET', path: '/api/back-office/auth/me', interactive: false },
  { method: 'POST', path: '/api/back-office/auth/activity', interactive: true },
  { method: 'POST', path: '/api/back-office/auth/logout', interactive: false },
  { method: 'POST', path: '/api/back-office/auth/reauthenticate', interactive: false },
] as const satisfies readonly RouteEntry[];
