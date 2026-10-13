import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, RouteOptions } from 'fastify';
import { ROUTE_TABLE } from '@pos/contracts';
import { closePool } from '../src/db/pool.js';
import { buildServer } from '../src/http/server.js';
import { TEST_ORIGIN } from './support/request.js';

// The route table in @pos/contracts is held equal to the registered API routes, in
// both directions (PHASE0-011b rule 5). The server is built without `apiRoutes`, so no
// test probe is present.

interface Registered {
  method: string;
  path: string;
  /** The route's own declaration; null where it declares no ACTIVE access. */
  interactive: boolean | null;
}

let app: FastifyInstance;
const registered: Registered[] = [];

beforeAll(async () => {
  app = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent' });
  // Registration happens at ready(), so a hook added now sees every route.
  app.addHook('onRoute', (options: RouteOptions) => {
    const methods = Array.isArray(options.method) ? options.method : [options.method];
    const access = options.config?.access;
    for (const method of methods) {
      // Fastify adds a HEAD twin to every GET: not a route anyone declared.
      if (method === 'HEAD' || !options.url.startsWith('/api')) continue;
      registered.push({
        method,
        path: options.url,
        interactive: access?.session === 'ACTIVE' ? access.interactive : null,
      });
    }
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`;

describe('the route table', () => {
  it('8. holds the registered API routes equal to @pos/contracts, in both directions', () => {
    expect(registered.length).toBeGreaterThan(0);
    const inServer = registered.map(key).sort();
    const inTable = ROUTE_TABLE.map(key).sort();
    expect(inServer.filter((k) => !inTable.includes(k)), 'registered but not in the table').toEqual([]);
    expect(inTable.filter((k) => !inServer.includes(k)), 'in the table but not registered').toEqual([]);
    expect(new Set(inTable).size, 'no duplicate entry').toBe(inTable.length);
  });

  it('8. for each ACTIVE route the table\'s interactive equals the route\'s declaration', () => {
    const active = registered.filter((r) => r.interactive !== null);
    expect(active.length).toBeGreaterThanOrEqual(4);
    for (const route of active) {
      const entry = ROUTE_TABLE.find((e) => key(e) === key(route));
      expect(entry?.interactive, key(route)).toBe(route.interactive);
    }
  });

  it('8. every route that is not ACTIVE is interactive: false in the table', () => {
    for (const route of registered.filter((r) => r.interactive === null)) {
      const entry = ROUTE_TABLE.find((e) => key(e) === key(route));
      expect(entry?.interactive, key(route)).toBe(false);
    }
  });
});
