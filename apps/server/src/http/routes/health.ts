import type { FastifyPluginAsync } from 'fastify';
import { ErrorCode } from '@pos/contracts';
import { query } from '../../db/pool.js';
import { AppError } from '../errors.js';

/**
 * Reads no cookie, makes no client instance, resolves no session, writes
 * nothing. An "ok" with the database down would contradict ARCHITECTURE 12.
 */
export const healthRoutes: FastifyPluginAsync = async (api) => {
  api.get('/health', { config: { clientInstance: false } }, async (request) => {
    try {
      await query('SELECT 1');
    } catch (err) {
      request.log.warn({ err }, 'health check could not reach the database');
      throw new AppError(ErrorCode.UNAVAILABLE, 503);
    }
    return { status: 'ok' };
  });
};
