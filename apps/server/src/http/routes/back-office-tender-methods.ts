import type { FastifyPluginAsync } from 'fastify';
import {
  CreateTenderMethodRequest,
  DeactivateTenderMethodRequest,
  ErrorCode,
  ReactivateTenderMethodRequest,
  UpdateTenderMethodRequest,
} from '@pos/contracts';
import type { TenderMethodResponse, TenderMethodsResponse } from '@pos/contracts';
import {
  createTenderMethod,
  deactivateTenderMethod,
  listTenderMethods,
  reactivateTenderMethod,
  renameTenderMethod,
} from '../../domain/tender-method.js';
import type { TenderMethodOutcome } from '../../domain/tender-method.js';
import { AppError } from '../errors.js';
import { parseBody } from '../validate.js';

// A refusal is raised here, from the domain's answer; the domain never names a code.
function answered(outcome: TenderMethodOutcome): TenderMethodResponse {
  if (outcome.kind === 'NOT_FOUND') throw new AppError(ErrorCode.NOT_FOUND, 404);
  if (outcome.kind === 'DUPLICATE') throw new AppError(ErrorCode.DUPLICATE, 409);
  return { tenderMethod: outcome.tenderMethod };
}

/**
 * Custom tender method configuration (BO-08; ARCHITECTURE section 13). The guard has
 * already required an active back-office session, a manager and, on a POST, the
 * anti-CSRF token by the time a handler runs. The list read is not interactive; every
 * command is, because a command is a person pressing a control.
 */
export const backOfficeTenderMethodRoutes: FastifyPluginAsync = async (api) => {
  api.get(
    '/back-office/config/tender-methods',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: false } } },
    async (): Promise<TenderMethodsResponse> => ({ tenderMethods: await listTenderMethods() })
  );

  api.post(
    '/back-office/config/tender-methods/create',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<TenderMethodResponse> => {
      const { name } = parseBody(CreateTenderMethodRequest, request.body);
      return answered(await createTenderMethod(name));
    }
  );

  api.post(
    '/back-office/config/tender-methods/update',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<TenderMethodResponse> => {
      const { tenderMethodId, name } = parseBody(UpdateTenderMethodRequest, request.body);
      return answered(await renameTenderMethod(tenderMethodId, name));
    }
  );

  api.post(
    '/back-office/config/tender-methods/deactivate',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<TenderMethodResponse> => {
      const { tenderMethodId } = parseBody(DeactivateTenderMethodRequest, request.body);
      return answered(await deactivateTenderMethod(tenderMethodId));
    }
  );

  api.post(
    '/back-office/config/tender-methods/reactivate',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<TenderMethodResponse> => {
      const { tenderMethodId } = parseBody(ReactivateTenderMethodRequest, request.body);
      return answered(await reactivateTenderMethod(tenderMethodId));
    }
  );
};
