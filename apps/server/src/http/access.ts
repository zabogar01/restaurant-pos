import type { FastifyInstance, RouteOptions } from 'fastify';
import type { Audience } from '../domain/session.js';
import { StartupError, isApiPath } from './errors.js';

/**
 * What a route says it needs, declared in `config.access`. There is no "either"
 * audience and no role field: the back-office guard requires a manager on every
 * ACTIVE route because of the audience, and the anti-CSRF token follows from the
 * method (ARCH-012 section 4).
 */
export type RouteAccess =
  // No session cookie is read. Health; later, the lock screen's incident-presence read.
  | { session: 'NONE' }
  // The handler manages the presented session through the session module.
  // Sign-in, release, logout and re-authentication only.
  | { session: 'OPTIONAL'; audience: Audience }
  // The guard requires an ACTIVE session of this audience and sets request.actor.
  | { session: 'ACTIVE'; audience: Audience; interactive: boolean };

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Optional in the type, required at startup for every API route. */
    access?: RouteAccess;
  }
}

// The cookie is scoped to its surface's path, so a route anywhere else would
// never receive it.
const SURFACE: Record<Audience, string> = {
  POS: '/api/pos/',
  BACK_OFFICE: '/api/back-office/',
};

const AUDIENCES: readonly unknown[] = ['POS', 'BACK_OFFICE'];

function sameKeys(value: object, keys: string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
}

/** True only for exactly one of the three shapes. Anything else is a typo. */
function wellFormed(access: unknown): access is RouteAccess {
  if (typeof access !== 'object' || access === null || Array.isArray(access)) return false;
  const { session, audience, interactive } = access as Record<string, unknown>;
  if (session === 'NONE') return sameKeys(access, ['session']);
  if (session === 'OPTIONAL') {
    return sameKeys(access, ['session', 'audience']) && AUDIENCES.includes(audience);
  }
  if (session === 'ACTIVE') {
    return (
      sameKeys(access, ['session', 'audience', 'interactive']) &&
      AUDIENCES.includes(audience) &&
      typeof interactive === 'boolean'
    );
  }
  return false;
}

// Both come from source, never from a request, so they may be quoted.
function describe(options: RouteOptions): string {
  const method = Array.isArray(options.method) ? options.method.join('|') : options.method;
  return `${method} ${options.url}`;
}

/**
 * Installs the startup refusals (ARCH-012 section 4). Call it on the root
 * instance before anything is registered, and call `.api()` first thing inside
 * the API context. A root `onRoute` hook sees every route in every descendant
 * context with its full path; the hook inside the context records the routes
 * that really sit under the API policy. A route in the first set and not the
 * second was registered on the root or in a sibling plugin and has neither the
 * origin guard, `no-store` nor the session guard.
 *
 * Every refusal is a StartupError: `ready()` and `listen()` reject and the
 * process never listens. No flag disables any of them.
 */
export function installAccessChecks(app: FastifyInstance): { api(api: FastifyInstance): void } {
  const seenOnRoot = new Set<string>();
  const seenInApi = new Set<string>();

  app.addHook('onRoute', (options) => {
    const where = describe(options);
    const access = options.config?.access;

    if (!isApiPath(options.url)) {
      if (access !== undefined) {
        throw new StartupError(
          `route ${where} is outside /api and declares config.access, which no guard reads there`
        );
      }
      return;
    }

    if (!wellFormed(access)) {
      throw new StartupError(
        `route ${where} must declare config.access as exactly one of ` +
          `{ session: 'NONE' }, { session: 'OPTIONAL', audience } or ` +
          `{ session: 'ACTIVE', audience, interactive }`
      );
    }
    if (access.session !== 'NONE' && !options.url.startsWith(SURFACE[access.audience])) {
      throw new StartupError(
        `route ${where} declares audience ${access.audience} but is not under ${SURFACE[access.audience]}`
      );
    }
    seenOnRoot.add(where);
  });

  app.addHook('onReady', async () => {
    const outside = [...seenOnRoot].filter((key) => !seenInApi.has(key));
    if (outside.length > 0) {
      throw new StartupError(
        `API route ${outside[0]} is registered outside the API context, ` +
          `so it has no origin guard, no-store or session guard`
      );
    }
  });

  return {
    api(api) {
      api.addHook('onRoute', (options) => {
        seenInApi.add(describe(options));
      });
    },
  };
}
