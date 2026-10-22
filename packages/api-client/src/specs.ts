import {
  BackOfficeLoginRequest,
  BackOfficeSessionView,
  CreateTableRequest,
  CreateTenderMethodRequest,
  DeactivateTableRequest,
  DeactivateTenderMethodRequest,
  PosLoginRequest,
  ReactivateTableRequest,
  ReactivateTenderMethodRequest,
  ReauthenticateRequest,
  ROUTE_TABLE,
  SaveSettingsRequest,
  SessionView,
  SettingsReadView,
  TableResponse,
  TablesResponse,
  TenderMethodResponse,
  TenderMethodsResponse,
  UpdateTableRequest,
  UpdateTenderMethodRequest,
} from '@pos/contracts';

/** The one thing the core needs of a schema; every zod schema in the contracts has it. */
export interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

/** A route as the route table lists it. A caller passes the entry, never a path string. */
export type Route = (typeof ROUTE_TABLE)[number];
export type RoutePath = Route['path'];

const HealthBody: Schema<{ status: 'ok' }> = {
  safeParse(input) {
    const ok =
      typeof input === 'object' && input !== null && (input as { status?: unknown }).status === 'ok';
    return ok ? { success: true, data: { status: 'ok' } } : { success: false };
  },
};

interface Spec {
  /** Checked before the request is sent. Absent: the request has no body. */
  body?: Schema<unknown>;
  /** Checked on a 2xx. Null: the route answers with no body. */
  response: Schema<unknown> | null;
  /** The response is a session view: it replaces the token and sets the deadline. */
  session?: true;
  /** A sign-in: judged obsolete only by another session installed since it was sent. */
  signIn?: true;
  /** The route ends the session whatever the server answers. */
  ends?: true;
}

/**
 * What each route sends and receives. `satisfies` holds this to the route table: a
 * route added to the table stops this compiling until it is declared here.
 */
export const SPECS = {
  '/api/health': { response: HealthBody },
  '/api/pos/auth/login': {
    body: PosLoginRequest,
    response: SessionView,
    session: true,
    signIn: true,
  },
  '/api/pos/auth/me': { response: SessionView, session: true },
  '/api/pos/auth/activity': { response: null },
  '/api/pos/auth/release': { response: null, ends: true },
  '/api/back-office/auth/login': {
    body: BackOfficeLoginRequest,
    response: BackOfficeSessionView,
    session: true,
    signIn: true,
  },
  '/api/back-office/auth/me': { response: BackOfficeSessionView, session: true },
  '/api/back-office/auth/activity': { response: null },
  '/api/back-office/auth/logout': { response: null, ends: true },
  '/api/back-office/auth/reauthenticate': {
    body: ReauthenticateRequest,
    response: BackOfficeSessionView,
    session: true,
  },
  '/api/back-office/config/tables': { response: TablesResponse },
  '/api/back-office/config/tables/create': { body: CreateTableRequest, response: TableResponse },
  '/api/back-office/config/tables/update': { body: UpdateTableRequest, response: TableResponse },
  '/api/back-office/config/tables/deactivate': { body: DeactivateTableRequest, response: TableResponse },
  '/api/back-office/config/tables/reactivate': { body: ReactivateTableRequest, response: TableResponse },
  '/api/back-office/config/settings': { response: SettingsReadView },
  '/api/back-office/config/settings/save': { body: SaveSettingsRequest, response: SettingsReadView },
  '/api/back-office/config/tender-methods': { response: TenderMethodsResponse },
  '/api/back-office/config/tender-methods/create': { body: CreateTenderMethodRequest, response: TenderMethodResponse },
  '/api/back-office/config/tender-methods/update': { body: UpdateTenderMethodRequest, response: TenderMethodResponse },
  '/api/back-office/config/tender-methods/deactivate': {
    body: DeactivateTenderMethodRequest,
    response: TenderMethodResponse,
  },
  '/api/back-office/config/tender-methods/reactivate': {
    body: ReactivateTenderMethodRequest,
    response: TenderMethodResponse,
  },
} as const satisfies Record<RoutePath, Spec>;

type Specs = typeof SPECS;

type Infer<S> = S extends Schema<infer T> ? T : never;

/** The anti-CSRF token never leaves the core: a session view in a result lacks it. */
type WithoutToken<T> = T extends { csrfToken: string } ? Omit<T, 'csrfToken'> : T;

/** The value a 2xx from this route carries: `void` for a route with no body. */
export type ValueOf<P extends RoutePath> = Specs[P]['response'] extends null
  ? void
  : WithoutToken<Infer<Specs[P]['response']>>;

/** The body a call to this route must carry, or `undefined` when it has none. */
export type BodyOf<P extends RoutePath> = Specs[P] extends { body: infer B } ? Infer<B> : undefined;

export type ArgsOf<P extends RoutePath> = [BodyOf<P>] extends [undefined] ? [] : [body: BodyOf<P>];
