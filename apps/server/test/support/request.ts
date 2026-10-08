import type { FastifyInstance, InjectOptions } from 'fastify';

export const TEST_PORT = 8443;
export const TEST_ORIGIN = `https://localhost:${TEST_PORT}`;
export const TEST_HOST = `localhost:${TEST_PORT}`;

/**
 * inject() sends `Host: localhost:80`, which the Host check refuses, and no
 * `Origin`, which the origin check refuses on a mutating request. A browser on
 * the real origin sends both; this adds them and lets a test's own headers win.
 */
export function inject(app: FastifyInstance, options: InjectOptions) {
  const method = String(options.method ?? 'GET').toUpperCase();
  const mutating = method !== 'GET' && method !== 'HEAD';
  return app.inject({
    ...options,
    headers: {
      host: TEST_HOST,
      ...(mutating ? { origin: TEST_ORIGIN } : {}),
      ...options.headers,
    },
  });
}
