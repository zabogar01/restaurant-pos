import type { FastifyPluginAsync } from 'fastify';
import type { SessionView } from '@pos/contracts';
import { actorOf, csrfTokenOf, signOut } from '../session-guard.js';

/**
 * The back-office session routes that need no credential. The guard has already
 * required an active session and the manager role by the time a handler runs.
 */
export const backOfficeAuthRoutes: FastifyPluginAsync = async (api) => {
  api.get(
    '/back-office/auth/me',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: false } } },
    async (request): Promise<SessionView> => {
      const actor = actorOf(request);
      return { staffUserId: actor.staffUserId, role: actor.role, csrfToken: csrfTokenOf(request) };
    }
  );

  api.post(
    '/back-office/auth/activity',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (_request, reply) => reply.code(204).send()
  );

  api.post(
    '/back-office/auth/logout',
    { config: { access: { session: 'OPTIONAL', audience: 'BACK_OFFICE' } } },
    async (request, reply) => {
      await signOut(request, reply);
      return reply.code(204).send();
    }
  );
};
