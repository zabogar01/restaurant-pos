import type { FastifyReply, FastifyRequest } from 'fastify';
import { query } from '../db/pool.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * A value PostgreSQL returned in this request, or undefined where the hook did
     * not run (health). UI continuity and security telemetry only: nothing may
     * grant or refuse anything by reading or comparing it (FR-A7, B-14).
     */
    clientInstanceId: string | undefined;
  }
  interface FastifyContextConfig {
    /** `false` opts a route out of the client-instance hook. */
    clientInstance?: boolean;
  }
}

export const CLIENT_INSTANCE_COOKIE = 'rpos_cid';
const MAX_AGE_SECONDS = 34_560_000; // 400 days, the most a browser keeps

// Exactly thirty-six characters, lower case, as PostgreSQL prints a uuid. Anything
// else would be a 22P02 error from the column, not an empty result, so it reaches
// no query at all.
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Finds or creates the browser profile's row, for every API route that does not
 * declare `config: { clientInstance: false }`. An absent, malformed or unknown
 * cookie is the same case: a new identity, issued silently.
 */
export async function clientInstanceHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.routeOptions.config.clientInstance === false) return;

  const presented = request.cookies[CLIENT_INSTANCE_COOKIE];
  if (typeof presented === 'string' && CANONICAL_UUID.test(presented)) {
    // The update can wait on a row lock held by another request from the same
    // browser, so the time is read after the lock; GREATEST never moves it back.
    const touched = await query<{ id: string }>(
      `UPDATE client_instance
          SET last_seen_at = GREATEST(last_seen_at, clock_timestamp())
        WHERE id = $1
      RETURNING id`,
      [presented]
    );
    if (touched[0]) {
      request.clientInstanceId = touched[0].id;
      return;
    }
  }

  const created = await query<{ id: string }>(
    'INSERT INTO client_instance DEFAULT VALUES RETURNING id'
  );
  const id = created[0]?.id;
  if (id === undefined) throw new Error('client_instance insert returned no row');
  request.clientInstanceId = id;
  reply.setCookie(CLIENT_INSTANCE_COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}
