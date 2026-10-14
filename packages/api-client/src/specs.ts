import {
  BackOfficeLoginRequest,
  BackOfficeSessionView,
  PosLoginRequest,
  ReauthenticateRequest,
  ROUTE_TABLE,
  SessionView,
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
  /** The route ends the session whatever the server answers. */
  ends?: true;
}

/**
 * What each route sends and receives. `satisfies` holds this to the route table: a
 * route added to the table stops this compiling until it is declared here.
 */
export const SPECS = {
  '/api/health': { response: HealthBody },
  '/api/pos/auth/login': { body: PosLoginRequest, response: SessionView, session: true },
  '/api/pos/auth/me': { response: SessionView, session: true },
  '/api/pos/auth/activity': { response: null },
  '/api/pos/auth/release': { response: null, ends: true },
  '/api/back-office/auth/login': {
    body: BackOfficeLoginRequest,
    response: BackOfficeSessionView,
    session: true,
  },
  '/api/back-office/auth/me': { response: BackOfficeSessionView, session: true },
  '/api/back-office/auth/activity': { response: null },
  '/api/back-office/auth/logout': { response: null, ends: true },
  '/api/back-office/auth/reauthenticate': {
    body: ReauthenticateRequest,
    response: BackOfficeSessionView,
    session: true,
  },
} as const satisfies Record<RoutePath, Spec>;

type Specs = typeof SPECS;

type Infer<S> = S extends Schema<infer T> ? T : never;

/** The value a 2xx from this route carries: `void` for a route with no body. */
export type ValueOf<P extends RoutePath> = Specs[P]['response'] extends null
  ? void
  : Infer<Specs[P]['response']>;

/** The body a call to this route must carry, or `undefined` when it has none. */
export type BodyOf<P extends RoutePath> = Specs[P] extends { body: infer B } ? Infer<B> : undefined;

export type ArgsOf<P extends RoutePath> = [BodyOf<P>] extends [undefined] ? [] : [body: BodyOf<P>];
