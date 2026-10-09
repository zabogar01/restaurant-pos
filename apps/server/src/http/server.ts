import type { Writable } from 'node:stream';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyPluginAsync, FastifyServerOptions } from 'fastify';
import { ErrorCode } from '@pos/contracts';
import { installAccessChecks } from './access.js';
import { clientInstanceHook } from './client-instance.js';
import {
  AppError,
  clientErrorHandler,
  errorHandler,
  frameworkErrorHandler,
  notFoundHandler,
} from './errors.js';
import { loggerOptions } from './log.js';
import { checkHost, checkOrigin, ownOrigin } from './origin.js';
import { backOfficeAuthRoutes } from './routes/back-office-auth.js';
import { healthRoutes } from './routes/health.js';
import { posAuthRoutes } from './routes/pos-auth.js';
import { decorateActor, sessionGuard } from './session-guard.js';

export interface BuildServerOptions {
  /** The one origin this server answers for, e.g. https://localhost:8443. */
  origin: string;
  logLevel: string;
  /** Without it the instance can be injected into but never listens. */
  tls?: { key: Buffer; cert: Buffer };
  logStream?: Writable;
  /** Further API route plugins, registered inside the /api context. */
  apiRoutes?: FastifyPluginAsync[];
}

/**
 * Builds the server and does not listen: listenLoopback is the only code that
 * does. No CORS, no HSTS (it is recorded per host and ignores the port, so it
 * would reach every other localhost port in the browser), trustProxy off
 * (there is no proxy), no HTTP/2, and JSON as the only body type.
 */
export function buildServer({
  origin,
  logLevel,
  tls,
  logStream,
  apiRoutes = [],
}: BuildServerOptions): FastifyInstance {
  const own = ownOrigin(origin);
  // The https option changes the instance's generic type; the one type the rest of
  // the code uses is the plain FastifyInstance.
  const options: FastifyServerOptions & { https?: typeof tls | null } = {
    logger: loggerOptions(logLevel, logStream),
    trustProxy: false,
    frameworkErrors: frameworkErrorHandler,
    clientErrorHandler,
    // Fastify's own 503 while closing has a fixed body outside the envelope; the
    // hook below sends the envelope instead.
    return503OnClosing: false,
    https: tls ?? null,
  };
  const app = Fastify(options as FastifyServerOptions) as unknown as FastifyInstance;

  // A cross-site HTML form can send text/plain; no parser means it gets a 415.
  app.removeContentTypeParser('text/plain');
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  let closing = false;
  app.addHook('preClose', async () => {
    closing = true;
  });
  app.addHook('onRequest', async (_request, reply) => {
    if (!closing) return;
    reply.header('connection', 'close');
    throw new AppError(ErrorCode.UNAVAILABLE, 503);
  });
  // Every request, before routing reaches a handler, bundles included.
  app.addHook('onRequest', checkHost(own));

  // Before anything is registered, so the startup refusals see every route.
  const access = installAccessChecks(app);
  decorateActor(app);

  app.register(cookie);
  app.register(
    async (api) => {
      access.api(api);
      // A matched route is answered under the API policy because it is registered
      // here, however its path was spelled. Misses and errors set the header
      // themselves (errors.ts).
      api.addHook('onRequest', async (_request, reply) => {
        reply.header('cache-control', 'no-store');
      });
      // Origin first, then the client instance, then the session: a refused request
      // writes nothing and never reaches the guard.
      api.addHook('onRequest', checkOrigin(own));
      api.addHook('onRequest', clientInstanceHook);
      api.addHook('onRequest', sessionGuard);
      await api.register(healthRoutes);
      await api.register(posAuthRoutes);
      await api.register(backOfficeAuthRoutes);
      for (const routes of apiRoutes) await api.register(routes);
    },
    { prefix: '/api' }
  );

  return app;
}
