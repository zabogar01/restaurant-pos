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

type ConfigPath = Extract<keyof OfficeApi, `/api/back-office/config/${string}`>;

/**
 * What a screen may call: the configuration routes and no others (consult C2 section 7).
 * A screen cannot name sign-in, logout, re-authentication or `activity` through it, which
 * keeps the input listener the only caller of `activity`.
 */
export type ConfigApi = { [P in ConfigPath]: OfficeApi[P] };

/** The configuration routes of an API module, and only those. */
export function configApi(api: OfficeApi): ConfigApi {
  return {
    '/api/back-office/config/tables': api['/api/back-office/config/tables'],
    '/api/back-office/config/tables/create': api['/api/back-office/config/tables/create'],
    '/api/back-office/config/tables/update': api['/api/back-office/config/tables/update'],
    '/api/back-office/config/tables/deactivate': api['/api/back-office/config/tables/deactivate'],
    '/api/back-office/config/tables/reactivate': api['/api/back-office/config/tables/reactivate'],
    '/api/back-office/config/settings': api['/api/back-office/config/settings'],
    '/api/back-office/config/settings/save': api['/api/back-office/config/settings/save'],
    '/api/back-office/config/tender-methods': api['/api/back-office/config/tender-methods'],
    '/api/back-office/config/tender-methods/create': api['/api/back-office/config/tender-methods/create'],
    '/api/back-office/config/tender-methods/deactivate': api['/api/back-office/config/tender-methods/deactivate'],
    '/api/back-office/config/tender-methods/update': api['/api/back-office/config/tender-methods/update'],
    '/api/back-office/config/tender-methods/reactivate': api['/api/back-office/config/tender-methods/reactivate'],
    '/api/back-office/config/catalog': api['/api/back-office/config/catalog'],
    '/api/back-office/config/catalog/categories/create': api['/api/back-office/config/catalog/categories/create'],
    '/api/back-office/config/catalog/categories/update': api['/api/back-office/config/catalog/categories/update'],
    '/api/back-office/config/catalog/categories/reorder': api['/api/back-office/config/catalog/categories/reorder'],
    '/api/back-office/config/catalog/categories/archive': api['/api/back-office/config/catalog/categories/archive'],
    '/api/back-office/config/catalog/categories/restore': api['/api/back-office/config/catalog/categories/restore'],
    '/api/back-office/config/catalog/items/create': api['/api/back-office/config/catalog/items/create'],
    '/api/back-office/config/catalog/items/update': api['/api/back-office/config/catalog/items/update'],
    '/api/back-office/config/catalog/items/reorder': api['/api/back-office/config/catalog/items/reorder'],
    '/api/back-office/config/catalog/items/archive': api['/api/back-office/config/catalog/items/archive'],
    '/api/back-office/config/catalog/items/restore': api['/api/back-office/config/catalog/items/restore'],
    '/api/back-office/config/catalog/items/mark-unavailable': api['/api/back-office/config/catalog/items/mark-unavailable'],
    '/api/back-office/config/catalog/items/mark-available': api['/api/back-office/config/catalog/items/mark-available'],
  };
}

/** The one set of back-office calls, over the one core instance the store constructs. */
export function officeApi(client: ApiClient): OfficeApi {
  return {
    '/api/health': () => client.request(ROUTES.health),
    '/api/back-office/auth/login': (body) => client.request(ROUTES.backOfficeLogin, body),
    '/api/back-office/auth/me': () => client.request(ROUTES.backOfficeMe),
    '/api/back-office/auth/activity': () => client.request(ROUTES.backOfficeActivity),
    '/api/back-office/auth/logout': () => client.request(ROUTES.backOfficeLogout),
    '/api/back-office/auth/reauthenticate': (body) => client.request(ROUTES.backOfficeReauthenticate, body),
    // Reached by a screen only through `configApi` below.
    '/api/back-office/config/tables': () => client.request(ROUTES.tablesList),
    '/api/back-office/config/tables/create': (body) => client.request(ROUTES.tablesCreate, body),
    '/api/back-office/config/tables/update': (body) => client.request(ROUTES.tablesUpdate, body),
    '/api/back-office/config/tables/deactivate': (body) => client.request(ROUTES.tablesDeactivate, body),
    '/api/back-office/config/tables/reactivate': (body) => client.request(ROUTES.tablesReactivate, body),
    '/api/back-office/config/settings': () => client.request(ROUTES.settingsRead),
    '/api/back-office/config/settings/save': (body) => client.request(ROUTES.settingsSave, body),
    '/api/back-office/config/tender-methods': () => client.request(ROUTES.tenderMethodsList),
    '/api/back-office/config/tender-methods/create': (body) => client.request(ROUTES.tenderMethodsCreate, body),
    '/api/back-office/config/tender-methods/update': (body) => client.request(ROUTES.tenderMethodsUpdate, body),
    '/api/back-office/config/tender-methods/deactivate': (body) =>
      client.request(ROUTES.tenderMethodsDeactivate, body),
    '/api/back-office/config/tender-methods/reactivate': (body) =>
      client.request(ROUTES.tenderMethodsReactivate, body),
    '/api/back-office/config/catalog': () => client.request(ROUTES.catalogRead),
    '/api/back-office/config/catalog/categories/create': (body) =>
      client.request(ROUTES.catalogCategoriesCreate, body),
    '/api/back-office/config/catalog/categories/update': (body) =>
      client.request(ROUTES.catalogCategoriesUpdate, body),
    '/api/back-office/config/catalog/categories/reorder': (body) =>
      client.request(ROUTES.catalogCategoriesReorder, body),
    '/api/back-office/config/catalog/categories/archive': (body) =>
      client.request(ROUTES.catalogCategoriesArchive, body),
    '/api/back-office/config/catalog/categories/restore': (body) =>
      client.request(ROUTES.catalogCategoriesRestore, body),
    '/api/back-office/config/catalog/items/create': (body) => client.request(ROUTES.catalogItemsCreate, body),
    '/api/back-office/config/catalog/items/update': (body) => client.request(ROUTES.catalogItemsUpdate, body),
    '/api/back-office/config/catalog/items/reorder': (body) => client.request(ROUTES.catalogItemsReorder, body),
    '/api/back-office/config/catalog/items/archive': (body) => client.request(ROUTES.catalogItemsArchive, body),
    '/api/back-office/config/catalog/items/restore': (body) => client.request(ROUTES.catalogItemsRestore, body),
    '/api/back-office/config/catalog/items/mark-unavailable': (body) =>
      client.request(ROUTES.catalogItemsMarkUnavailable, body),
    '/api/back-office/config/catalog/items/mark-available': (body) =>
      client.request(ROUTES.catalogItemsMarkAvailable, body),
  };
}
