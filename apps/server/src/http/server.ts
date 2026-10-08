import type { Writable } from 'node:stream';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyPluginAsync, FastifyServerOptions } from 'fastify';
import { errorHandler, frameworkErrorHandler, notFoundHandler } from './errors.js';
import { loggerOptions } from './log.js';
import { healthRoutes } from './routes/health.js';

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
  logLevel,
  tls,
  logStream,
  apiRoutes = [],
}: BuildServerOptions): FastifyInstance {
  // The https option changes the instance's generic type; the one type the rest of
  // the code uses is the plain FastifyInstance.
  const options: FastifyServerOptions & { https?: typeof tls | null } = {
    logger: loggerOptions(logLevel, logStream),
    trustProxy: false,
    frameworkErrors: frameworkErrorHandler,
    https: tls ?? null,
  };
  const app = Fastify(options as FastifyServerOptions) as unknown as FastifyInstance;

  // A cross-site HTML form can send text/plain; no parser means it gets a 415.
  app.removeContentTypeParser('text/plain');
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  app.register(
    async (api) => {
      // A matched route is answered under the API policy because it is registered
      // here, however its path was spelled. Misses and errors set the header
      // themselves (errors.ts).
      api.addHook('onRequest', async (_request, reply) => {
        reply.header('cache-control', 'no-store');
      });
      await api.register(healthRoutes);
      for (const routes of apiRoutes) await api.register(routes);
    },
    { prefix: '/api' }
  );

  return app;
}
