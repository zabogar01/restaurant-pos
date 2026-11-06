import type { FastifyPluginAsync } from 'fastify';
import {
  ChangeRoleRequest,
  CreateUserRequest,
  DeactivateUserRequest,
  ErrorCode,
  OwnPasswordRequest,
  OwnPinRequest,
  ReactivateUserRequest,
  SetPasswordRequest,
  SetPinRequest,
} from '@pos/contracts';
import type { UserResponse, UsersResponse } from '@pos/contracts';
import { verifyPasswordThrottled } from '../../domain/back-office-credential.js';
import {
  changeOwnPassword,
  changeOwnPin,
  changeRole,
  createUser,
  deactivateUser,
  listUsers,
  reactivateUser,
  setUserPassword,
  setUserPin,
} from '../../domain/users.js';
import type { ActingManager, UserOutcome } from '../../domain/users.js';
import { AppError } from '../errors.js';
import { actorOf } from '../session-guard.js';
import { parseBody } from '../validate.js';
import { verifiedUser } from '../verification.js';

// A refusal is raised here, from the domain's answer; the domain never names a code. The
// `field` of a DUPLICATE is a constant the domain chose from a constraint's name.
function answered(outcome: UserOutcome): UserResponse {
  switch (outcome.kind) {
    case 'OK':
      return { user: outcome.user };
    case 'NOT_FOUND':
      throw new AppError(ErrorCode.NOT_FOUND, 404);
    case 'DUPLICATE':
      throw new AppError(ErrorCode.DUPLICATE, 409, { field: outcome.field });
    case 'OWN_ACCOUNT':
      throw new AppError(ErrorCode.OWN_ACCOUNT, 409);
    case 'USER_CHANGED':
      throw new AppError(ErrorCode.USER_CHANGED, 409);
    case 'UNAUTHENTICATED':
      throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }
}

const actingManager = (actor: ReturnType<typeof actorOf>): ActingManager => ({
  staffUserId: actor.staffUserId,
  sessionId: actor.sessionId,
});

/**
 * Users (BO-06; ARCHITECTURE section 13; consult C3). The guard has already required an
 * active back-office session, a manager and, on a POST, the anti-CSRF token by the time a
 * handler runs. The list read is not interactive; every command is, because a command is a
 * person pressing a control. A request body is parsed by `parseBody` and nowhere else, and
 * no body, credential or database message reaches a log or a response.
 */
export const backOfficeUserRoutes: FastifyPluginAsync = async (api) => {
  api.get(
    '/back-office/config/users',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: false } } },
    async (): Promise<UsersResponse> => ({ users: await listUsers() })
  );

  api.post(
    '/back-office/config/users/create',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<UserResponse> => {
      const body = parseBody(CreateUserRequest, request.body);
      return answered(await createUser(actingManager(actorOf(request)), body));
    }
  );

  api.post(
    '/back-office/config/users/change-role',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<UserResponse> => {
      const body = parseBody(ChangeRoleRequest, request.body);
      return answered(await changeRole(actingManager(actorOf(request)), body));
    }
  );

  api.post(
    '/back-office/config/users/deactivate',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<UserResponse> => {
      const { staffUserId } = parseBody(DeactivateUserRequest, request.body);
      return answered(await deactivateUser(actingManager(actorOf(request)), staffUserId));
    }
  );

  api.post(
    '/back-office/config/users/reactivate',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<UserResponse> => {
      const { staffUserId, pin } = parseBody(ReactivateUserRequest, request.body);
      return answered(await reactivateUser(actingManager(actorOf(request)), staffUserId, pin));
    }
  );

  api.post(
    '/back-office/config/users/set-pin',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<UserResponse> => {
      const { staffUserId, pin } = parseBody(SetPinRequest, request.body);
      return answered(await setUserPin(actingManager(actorOf(request)), staffUserId, pin));
    }
  );

  api.post(
    '/back-office/config/users/set-password',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<UserResponse> => {
      const { staffUserId, password } = parseBody(SetPasswordRequest, request.body);
      return answered(await setUserPassword(actingManager(actorOf(request)), staffUserId, password));
    }
  );

  // The own changes, in C3 section 3's order: the guard, the schema (so a malformed new secret
  // verifies and counts nothing), the current password verified for the guard's actor, never
  // for a name from the body, then the change. The session is not a sign-in: no cookie is set
  // and no token is issued or rotated, so the tab carries on as it was.
  api.post(
    '/back-office/config/users/own-password',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<UserResponse> => {
      const { currentPassword, password } = parseBody(OwnPasswordRequest, request.body);
      const actor = actingManager(actorOf(request));
      const verified = verifiedUser(
        await verifyPasswordThrottled({ staffUserId: actor.staffUserId }, currentPassword, {
          clientInstanceId: request.clientInstanceId,
        })
      );
      return answered(await changeOwnPassword(actor, verified.credentialVersion, password));
    }
  );

  api.post(
    '/back-office/config/users/own-pin',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<UserResponse> => {
      const { currentPassword, pin } = parseBody(OwnPinRequest, request.body);
      const actor = actingManager(actorOf(request));
      const verified = verifiedUser(
        await verifyPasswordThrottled({ staffUserId: actor.staffUserId }, currentPassword, {
          clientInstanceId: request.clientInstanceId,
        })
      );
      return answered(await changeOwnPin(actor, verified.credentialVersion, pin));
    }
  );
};
