import type { FastifyPluginAsync } from 'fastify';
import { PosLoginRequest } from '@pos/contracts';
import type { SessionView } from '@pos/contracts';
import { readStaffIdentity } from '../../domain/staff.js';
import { verifyPinThrottled } from '../../domain/throttle.js';
import { actorOf, csrfTokenOf, signIn, signOut } from '../session-guard.js';
import { parseBody } from '../validate.js';
import { verifiedUser } from '../verification.js';

/**
 * The POS session routes. The session guard (declared in `config.access`) has
 * already resolved the session by the time a handler runs; a handler never touches
 * a cookie and never writes an error body.
 */
export const posAuthRoutes: FastifyPluginAsync = async (api) => {
  // A cashier signs in with a PIN. The schema runs first: a PIN that is not six
  // digits can never be valid, so it is refused without being counted. Then one
  // throttled verification, and only on VERIFIED a session.
  api.post(
    '/pos/auth/login',
    { config: { access: { session: 'OPTIONAL', audience: 'POS' } } },
    async (request, reply): Promise<SessionView> => {
      const { pin } = parseBody(PosLoginRequest, request.body);
      const user = verifiedUser(
        await verifyPinThrottled('LOGIN', pin, { clientInstanceId: request.clientInstanceId })
      );
      // Read before the session is made: a missing row is a fault, and it must not
      // leave a session the client was never told about.
      const who = await readStaffIdentity(user.id);
      if (who === null) throw new Error('A verified user has no staff row');
      const { csrfToken } = await signIn(request, reply, user);
      return { staffUserId: user.id, name: who.name, role: user.role, csrfToken };
    }
  );

  // The session read. Not interactive: the page asking is not a person acting.
  api.get(
    '/pos/auth/me',
    { config: { access: { session: 'ACTIVE', audience: 'POS', interactive: false } } },
    async (request): Promise<SessionView> => {
      const actor = actorOf(request);
      const who = await readStaffIdentity(actor.staffUserId);
      if (who === null) throw new Error('An active session has no staff row');
      return {
        staffUserId: actor.staffUserId,
        name: who.name,
        role: actor.role,
        csrfToken: csrfTokenOf(request),
      };
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
