import type { FastifyPluginAsync } from 'fastify';
import type { SessionView } from '@pos/contracts';
import { actorOf, csrfTokenOf, signOut } from '../session-guard.js';

/**
 * The POS session routes that need no credential. The session guard (declared in
 * `config.access`) has already resolved the session by the time a handler runs;
 * a handler never touches a cookie and never writes an error body.
 */
export const posAuthRoutes: FastifyPluginAsync = async (api) => {
  // The session read. Not interactive: the page asking is not a person acting.
  api.get(
    '/pos/auth/me',
    { config: { access: { session: 'ACTIVE', audience: 'POS', interactive: false } } },
    async (request): Promise<SessionView> => {
      const actor = actorOf(request);
      return { staffUserId: actor.staffUserId, role: actor.role, csrfToken: csrfTokenOf(request) };
    }
  );

  // A person touched the screen. The interactive resolution is the whole effect.
  api.post(
    '/pos/auth/activity',
    { config: { access: { session: 'ACTIVE', audience: 'POS', interactive: true } } },
    async (_request, reply) => reply.code(204).send()
  );

  api.post(
    '/pos/auth/release',
    { config: { access: { session: 'OPTIONAL', audience: 'POS' } } },
    async (request, reply) => {
      await signOut(request, reply);
      return reply.code(204).send();
    }
  );
};
