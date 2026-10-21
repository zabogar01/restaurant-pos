import type { FastifyPluginAsync } from 'fastify';
import {
  CreateTableRequest,
  DeactivateTableRequest,
  ErrorCode,
  ReactivateTableRequest,
  UpdateTableRequest,
} from '@pos/contracts';
import type { TableResponse, TablesResponse } from '@pos/contracts';
import {
  createTable,
  deactivateTable,
  listTables,
  reactivateTable,
  renameTable,
} from '../../domain/dining-table.js';
import type { TableOutcome } from '../../domain/dining-table.js';
import { AppError } from '../errors.js';
import { parseBody } from '../validate.js';

// A refusal is raised here, from the domain's answer; the domain never names a code.
function answered(outcome: TableOutcome): TableResponse {
  if (outcome.kind === 'NOT_FOUND') throw new AppError(ErrorCode.NOT_FOUND, 404);
  if (outcome.kind === 'DUPLICATE') throw new AppError(ErrorCode.DUPLICATE, 409);
  return { table: outcome.table };
}

/**
 * Table configuration (BO-05; ARCHITECTURE section 13). The guard has already
 * required an active back-office session, a manager and, on a POST, the anti-CSRF
 * token by the time a handler runs. The list read is not interactive; every command
 * is, because a command is a person pressing a control.
 */
export const backOfficeTableRoutes: FastifyPluginAsync = async (api) => {
  api.get(
    '/back-office/config/tables',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: false } } },
    async (): Promise<TablesResponse> => ({ tables: await listTables() })
  );

  api.post(
    '/back-office/config/tables/create',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<TableResponse> => {
      const { label } = parseBody(CreateTableRequest, request.body);
      return answered(await createTable(label));
    }
  );

  api.post(
    '/back-office/config/tables/update',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<TableResponse> => {
      const { tableId, label } = parseBody(UpdateTableRequest, request.body);
      return answered(await renameTable(tableId, label));
    }
  );

  api.post(
    '/back-office/config/tables/deactivate',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<TableResponse> => {
      const { tableId } = parseBody(DeactivateTableRequest, request.body);
      return answered(await deactivateTable(tableId));
    }
  );

  api.post(
    '/back-office/config/tables/reactivate',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<TableResponse> => {
      const { tableId } = parseBody(ReactivateTableRequest, request.body);
      return answered(await reactivateTable(tableId));
    }
  );
};
