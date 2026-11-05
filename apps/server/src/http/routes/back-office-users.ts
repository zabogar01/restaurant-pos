import type { FastifyPluginAsync } from 'fastify';
import {
  ChangeRoleRequest,
  CreateUserRequest,
  DeactivateUserRequest,
  ErrorCode,
  ReactivateUserRequest,
} from '@pos/contracts';
import type { UserResponse, UsersResponse } from '@pos/contracts';
import {
  changeRole,
  createUser,
  deactivateUser,
  listUsers,
  reactivateUser,
} from '../../domain/users.js';
import type { ActingManager, UserOutcome } from '../../domain/users.js';
import { AppError } from '../errors.js';
import { actorOf } from '../session-guard.js';
import { parseBody } from '../validate.js';

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
};
