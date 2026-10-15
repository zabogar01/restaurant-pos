import { ROUTES, type ApiClient, type ApiResult, type ArgsOf, type RoutePath, type ValueOf } from '@pos/api-client';

// ARCH-014 question 3, mechanism 3: the POS's API module. It maps every route of
// the POS surface (and health) in the route table to the function that sends it,
// through a mapped type with no optional keys. A POS route added to the table
// without a function here is a compile error in this package, and that is the
// moment a builder wires the call and deletes the stand-in (FR-A2c: this module
// can name no route of the back office, because `PosPath` excludes them).
// It cannot prove a function is used by a screen; review does that.

type PosPath = Extract<RoutePath, '/api/health' | `/api/pos/${string}`>;

export type PosApi = {
  [P in PosPath]: (...body: ArgsOf<P>) => Promise<ApiResult<ValueOf<P>>>;
};

/** The one set of POS calls, over the one core instance the store constructs. */
export function posApi(client: ApiClient): PosApi {
  return {
    '/api/health': () => client.request(ROUTES.health),
    '/api/pos/auth/login': (body) => client.request(ROUTES.posLogin, body),
    '/api/pos/auth/me': () => client.request(ROUTES.posMe),
    '/api/pos/auth/activity': () => client.request(ROUTES.posActivity),
    '/api/pos/auth/release': () => client.request(ROUTES.posRelease),
  };
}
