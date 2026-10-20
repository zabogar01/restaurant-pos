import { ROUTES, type ApiClient, type ApiResult, type ArgsOf, type RoutePath, type ValueOf } from '@pos/api-client';

// ARCH-014 question 3, mechanism 3: the back office's API module and its route
// manifest. It maps every route of the back-office surface (and health) in the route
// table to the function that sends it, through a mapped type with no optional keys.
// A back-office route added to the table without a function here is a compile error
// in this package, and that is the moment a builder wires the call (FR-A2c: this
// module can name no route of the POS, because `OfficePath` excludes them). It
// cannot prove a function is used by a screen; review does that.
//
// `reauthenticate` is declared and not called until M-6 (PHASE0-011d2).

type OfficePath = Extract<RoutePath, '/api/health' | `/api/back-office/${string}`>;

export type OfficeApi = {
  [P in OfficePath]: (...body: ArgsOf<P>) => Promise<ApiResult<ValueOf<P>>>;
};

/** The one set of back-office calls, over the one core instance the store constructs. */
export function officeApi(client: ApiClient): OfficeApi {
  return {
    '/api/health': () => client.request(ROUTES.health),
    '/api/back-office/auth/login': (body) => client.request(ROUTES.backOfficeLogin, body),
    '/api/back-office/auth/me': () => client.request(ROUTES.backOfficeMe),
    '/api/back-office/auth/activity': () => client.request(ROUTES.backOfficeActivity),
    '/api/back-office/auth/logout': () => client.request(ROUTES.backOfficeLogout),
    '/api/back-office/auth/reauthenticate': (body) => client.request(ROUTES.backOfficeReauthenticate, body),
    // Declared, not called by any screen until BO-05 (PHASE1-S1b).
    '/api/back-office/config/tables': () => client.request(ROUTES.tablesList),
    '/api/back-office/config/tables/create': (body) => client.request(ROUTES.tablesCreate, body),
    '/api/back-office/config/tables/update': (body) => client.request(ROUTES.tablesUpdate, body),
    '/api/back-office/config/tables/deactivate': (body) => client.request(ROUTES.tablesDeactivate, body),
    '/api/back-office/config/tables/reactivate': (body) => client.request(ROUTES.tablesReactivate, body),
  };
}
