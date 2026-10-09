import type { FastifyPluginAsync } from 'fastify';
import { BackOfficeLoginRequest, ReauthenticateRequest } from '@pos/contracts';
import type { BackOfficeSessionView } from '@pos/contracts';
import { verifyPasswordThrottled } from '../../domain/back-office-credential.js';
import { readStaffIdentity } from '../../domain/staff.js';
import {
  actorOf,
  csrfTokenOf,
  presentedForRenewal,
  renewSession,
  renewableAccount,
  signIn,
  signOut,
} from '../session-guard.js';
import { parseBody } from '../validate.js';
import { verifiedUser } from '../verification.js';

// A manager always has a login; a row without one is a fault, never a partial body.
async function identityOf(staffUserId: string): Promise<{ name: string; username: string }> {
  const who = await readStaffIdentity(staffUserId);
  if (who === null || who.username === null) throw new Error('A manager has no back-office login');
  return { name: who.name, username: who.username };
}

/**
 * The back-office session routes. The guard has already required an active
 * session and the manager role by the time a guarded handler runs.
 */
export const backOfficeAuthRoutes: FastifyPluginAsync = async (api) => {
  // The schema checks type and size only: the domain is the one authority on what a
  // username or a password is, and treats a malformed one as a failed match.
  api.post(
    '/back-office/auth/login',
    { config: { access: { session: 'OPTIONAL', audience: 'BACK_OFFICE' } } },
    async (request, reply): Promise<BackOfficeSessionView> => {
      const { username, password } = parseBody(BackOfficeLoginRequest, request.body);
      const user = verifiedUser(
        await verifyPasswordThrottled({ username }, password, {
          clientInstanceId: request.clientInstanceId,
        })
      );
      const who = await identityOf(user.id);
      const { csrfToken } = await signIn(request, reply, user);
      return { staffUserId: user.id, name: who.name, username: who.username, role: user.role, csrfToken };
    }
  );

  api.get(
    '/back-office/auth/me',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: false } } },
    async (request): Promise<BackOfficeSessionView> => {
      const actor = actorOf(request);
      const who = await identityOf(actor.staffUserId);
      return {
        staffUserId: actor.staffUserId,
        name: who.name,
        username: who.username,
        role: actor.role,
        csrfToken: csrfTokenOf(request),
      };
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

  // M-6 (ARCH-012 section 7), in this order: the cookie and the anti-CSRF token,
  // the body, the session's resolution, the verification, the renewal. The
  // resolution comes before the verification so that a session past its eight
  // hours counts nothing, and the account is the one the session names: the body
  // cannot say whom to verify.
  api.post(
    '/back-office/auth/reauthenticate',
    { config: { access: { session: 'OPTIONAL', audience: 'BACK_OFFICE' } } },
    async (request, reply): Promise<BackOfficeSessionView> => {
      const token = presentedForRenewal(request, reply);
      const { password } = parseBody(ReauthenticateRequest, request.body);
      const staffUserId = await renewableAccount(reply, token, 'BACK_OFFICE');
      const user = verifiedUser(
        await verifyPasswordThrottled({ staffUserId }, password, {
          clientInstanceId: request.clientInstanceId,
        })
      );
      const who = await identityOf(user.id);
      const { csrfToken } = await renewSession(reply, token, 'BACK_OFFICE', user);
      return { staffUserId: user.id, name: who.name, username: who.username, role: user.role, csrfToken };
    }
  );
};
