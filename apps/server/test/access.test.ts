import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { closePool } from '../src/db/pool.js';
import { createStaffUser, findUserByPin } from '../src/domain/pin.js';
import { createSession } from '../src/domain/session.js';
import type { RouteAccess } from '../src/http/access.js';
import { StartupError } from '../src/http/errors.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import { TEST_ORIGIN, inject } from './support/request.js';

const ok = async () => ({ ok: true });

function build(apiRoutes: FastifyPluginAsync[] = []): FastifyInstance {
  return buildServer({ origin: TEST_ORIGIN, logLevel: 'silent', apiRoutes });
}

// Registration may throw at the call or at ready(), depending on where Fastify
// runs the hook; both are a refusal to start.
async function refusal(app: FastifyInstance, register?: (app: FastifyInstance) => void) {
  try {
    register?.(app);
    await app.ready();
  } catch (err) {
    return err;
  } finally {
    await app.close().catch(() => undefined);
  }
  return undefined;
}

const probe = (path: string, access: unknown): FastifyPluginAsync => async (api) => {
  api.get(path, { config: { access: access as RouteAccess } }, ok);
};

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closePool();
});

describe('declaration and startup', () => {
  it('1. an API route with no access: ready() rejects with a StartupError naming the method and path', async () => {
    const err = await refusal(
      build([
        async (api) => {
          api.get('/pos/undeclared', ok);
        },
      ])
    );
    expect(err).toBeInstanceOf(StartupError);
    expect((err as Error).message).toContain('GET /api/pos/undeclared');
  });

  const MALFORMED: [string, unknown][] = [
    ['an unknown session', { session: 'EITHER', audience: 'POS' }],
    ['ACTIVE with no interactive', { session: 'ACTIVE', audience: 'POS' }],
    ['a non-boolean interactive', { session: 'ACTIVE', audience: 'POS', interactive: 'yes' }],
    ['ACTIVE with no audience', { session: 'ACTIVE', interactive: true }],
    ['OPTIONAL with no audience', { session: 'OPTIONAL' }],
    ['an unknown audience', { session: 'ACTIVE', audience: 'KITCHEN', interactive: true }],
    ['NONE with an audience', { session: 'NONE', audience: 'POS' }],
    ['OPTIONAL with interactive', { session: 'OPTIONAL', audience: 'POS', interactive: false }],
    ['an extra key', { session: 'NONE', role: 'MANAGER' }],
    ['not an object', 'NONE'],
  ];

  it.each(MALFORMED)('2. %s is refused', async (_name, access) => {
    const err = await refusal(build([probe('/pos/malformed', access)]));
    expect(err).toBeInstanceOf(StartupError);
    expect((err as Error).message).toContain('GET /api/pos/malformed');
  });

  it('3. an audience that does not match the surface is refused', async () => {
    const wrongSurface = await refusal(
      build([probe('/pos/x', { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: false })])
    );
    expect(wrongSurface).toBeInstanceOf(StartupError);
    expect((wrongSurface as Error).message).toContain('GET /api/pos/x');

    const noSurface = await refusal(
      build([probe('/other/x', { session: 'ACTIVE', audience: 'POS', interactive: false })])
    );
    expect(noSurface).toBeInstanceOf(StartupError);
    expect((noSurface as Error).message).toContain('GET /api/other/x');
  });

  it('4. a declared route on the root instance, and one in a second plugin under /api, are refused', async () => {
    const onRoot = await refusal(build(), (app) => {
      app.get('/api/rootx', { config: { access: { session: 'NONE' } } }, ok);
    });
    expect(onRoot).toBeInstanceOf(StartupError);
    expect((onRoot as Error).message).toContain('GET /api/rootx');

    const beside = await refusal(build(), (app) => {
      app.register(
        async (second) => {
          second.get('/second', { config: { access: { session: 'NONE' } } }, ok);
        },
        { prefix: '/api' }
      );
    });
    expect(beside).toBeInstanceOf(StartupError);
    expect((beside as Error).message).toContain('GET /api/second');
  });

  describe('4b. a constrained namesake is a different registration', () => {
    const declared: FastifyPluginAsync = async (api) => {
      api.get('/dup', { config: { access: { session: 'NONE' } } }, ok);
    };
    const config = { access: { session: 'NONE' } } as const;
    const constraints = { version: '1.0.0' };

    it('on the root instance beside a declared route in the context: refused', async () => {
      const err = await refusal(build([declared]), (app) => {
        app.get('/api/dup', { constraints, config }, ok);
      });
      expect(err).toBeInstanceOf(StartupError);
      expect((err as Error).message).toContain('GET /api/dup');
    });

    it('in a sibling plugin under /api beside a declared route in the context: refused', async () => {
      const err = await refusal(build([declared]), (app) => {
        app.register(
          async (second) => {
            second.get('/dup', { constraints, config }, ok);
          },
          { prefix: '/api' }
        );
      });
      expect(err).toBeInstanceOf(StartupError);
      expect((err as Error).message).toContain('GET /api/dup');
    });

    it('a constrained registration inside the context still starts', async () => {
      const err = await refusal(
        build([
          declared,
          async (api) => {
            api.get('/dup', { constraints, config }, ok);
          },
        ])
      );
      expect(err).toBeUndefined();
    });
  });

  it('5. a route outside /api that carries access is refused', async () => {
    const err = await refusal(build(), (app) => {
      app.get('/outside', { config: { access: { session: 'NONE' } } }, ok);
    });
    expect(err).toBeInstanceOf(StartupError);
    expect((err as Error).message).toContain('GET /outside');

    // A route outside /api without one is not this check's business.
    const plain = await refusal(build(), (app) => {
      app.get('/outside', ok);
    });
    expect(plain).toBeUndefined();
  });
});

// Every route the server registers, with the declaration it carries, read from
// the same onRoute event the startup checks read.
async function declaredRoutes(): Promise<{ method: string; url: string; access: unknown }[]> {
  const app = build();
  const routes: { method: string; url: string; access: unknown }[] = [];
  app.addHook('onRoute', (options) => {
    routes.push({
      method: String(options.method),
      url: options.url,
      access: options.config?.access,
    });
  });
  await app.ready();
  await app.close();
  return routes;
}

describe('what the real server declares', () => {
  it('6. health declares NONE, creates no client instance and leaves a session cookie unread', async () => {
    const health = (await declaredRoutes()).find((r) => r.method === 'GET' && r.url === '/api/health');
    expect(health?.access).toEqual({ session: 'NONE' });

    const app = build();
    await app.ready();
    try {
      const before = (await ownerQuery('SELECT 1 FROM client_instance')).length;
      const res = await inject(app, {
        method: 'GET',
        url: '/api/health',
        headers: { cookie: 'rpos_pos_sid=whatever; rpos_bo_sid=whatever' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect((await ownerQuery('SELECT 1 FROM client_instance')).length).toBe(before);
    } finally {
      await app.close();
    }
  });

  it('7. the routes declared NONE or OPTIONAL are exactly the listed ones', async () => {
    const open = (await declaredRoutes())
      .filter((r) => r.method !== 'HEAD')
      .filter((r) => (r.access as RouteAccess).session !== 'ACTIVE')
      .map((r) => `${r.method} ${r.url} ${JSON.stringify(r.access)}`)
      .sort();
    // A later task that adds a route to either class edits this list, where a
    // reviewer will see it. 009b adds the two sign-ins and re-authentication.
    expect(open).toEqual(
      [
        'GET /api/health {"session":"NONE"}',
        'POST /api/pos/auth/release {"session":"OPTIONAL","audience":"POS"}',
        'POST /api/back-office/auth/logout {"session":"OPTIONAL","audience":"BACK_OFFICE"}',
      ].sort()
    );
  });

  it('8. a generated HEAD route carries its GET declaration and is guarded as its GET is', async () => {
    const routes = await declaredRoutes();
    for (const url of ['/api/pos/auth/me', '/api/back-office/auth/me']) {
      const get = routes.find((r) => r.method === 'GET' && r.url === url);
      const head = routes.find((r) => r.method === 'HEAD' && r.url === url);
      expect(get?.access).toBeDefined();
      expect(head?.access).toEqual(get?.access);
    }

    const app = build();
    await app.ready();
    try {
      const user = await createStaffUser({ name: 'Head', role: 'MANAGER', pin: '123456' });
      const found = await findUserByPin('123456');
      const issued = await createSession({
        audience: 'BACK_OFFICE',
        user: { id: user.id, credentialVersion: found!.credentialVersion },
      });
      const client = new JarClient(app);
      client.plant('rpos_bo_sid', '/api/back-office', issued.token);

      const withSession = await client.request({ method: 'HEAD', url: '/api/back-office/auth/me' });
      expect(withSession.statusCode).toBe(200);

      const stranger = new JarClient(app);
      const without = await stranger.request({ method: 'HEAD', url: '/api/back-office/auth/me' });
      expect(without.statusCode).toBe(401);
      const posWithout = await stranger.request({ method: 'HEAD', url: '/api/pos/auth/me' });
      expect(posWithout.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
