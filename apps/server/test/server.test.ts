import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ErrorCode } from '@pos/contracts';
import { closePool, getPool, query } from '../src/db/pool.js';
import Fastify from 'fastify';
import { AppError, frameworkErrorHandler } from '../src/http/errors.js';
import { buildServer } from '../src/http/server.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import { inject } from './support/request.js';

const ORIGIN = 'https://localhost:8443';

async function build(): Promise<FastifyInstance> {
  const app = buildServer({
    origin: ORIGIN,
    logLevel: 'silent',
    apiRoutes: [
      async (api) => {
        const config = { access: { session: 'NONE' } } as const;
        api.get('/probe-app-error', { config }, async () => {
          throw new AppError(ErrorCode.NOT_FOUND, 409);
        });
        api.get('/probe-ok', { config }, async () => ({ ok: true }));
        api.get('/probe-plain-error', { config }, async () => {
          throw new Error('a message that must not be sent: secret-marker');
        });
        api.post('/probe-echo', { config }, async (request) => ({ got: request.body }));
      },
    ],
  });
  await app.ready();
  return app;
}

async function rowCounts(): Promise<Record<string, string>> {
  const tables = await ownerQuery<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  );
  const counts: Record<string, string> = {};
  for (const { table_name } of tables) {
    const rows = await ownerQuery<{ n: string }>(`SELECT count(*)::text AS n FROM "${table_name}"`);
    counts[table_name] = rows[0]!.n;
  }
  return counts;
}

const ENVELOPE_KEYS = (body: unknown) => Object.keys((body as { error: object }).error);

describe('server', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await resetDatabase();
    app = await build();
  });

  afterAll(async () => {
    await app.close();
    await closePool();
  });

  it('14. health is 200 ok with no-store, sets no cookie and writes no row', async () => {
    const before = await rowCounts();
    const res = await inject(app,{ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await rowCounts()).toEqual(before);
  });

  it('15. health is 503 UNAVAILABLE in the envelope when the database does not answer', async () => {
    const spy = vi
      .spyOn(getPool(), 'query')
      .mockRejectedValueOnce(new Error('connection refused: secret-marker') as never);
    try {
      const res = await inject(app,{ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ error: { code: 'UNAVAILABLE' } });
      expect(res.headers['cache-control']).toBe('no-store');
    } finally {
      spy.mockRestore();
    }
  });

  it('16. an unknown /api path is the NOT_FOUND envelope; elsewhere a plain 404', async () => {
    const api = await inject(app,{ method: 'GET', url: '/api/nope?x=1' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: { code: 'NOT_FOUND' } });
    expect(api.headers['cache-control']).toBe('no-store');

    const elsewhere = await inject(app,{ method: 'GET', url: '/nope' });
    expect(elsewhere.statusCode).toBe(404);
    expect(elsewhere.body).toBe('Not Found');
    expect(elsewhere.headers['content-type']).toMatch(/^text\/plain/);
  });

  it('17. malformed JSON is 400, text/plain 415 and an oversized body 413, each exactly the envelope', async () => {
    const malformed = await inject(app,{
      method: 'POST',
      url: '/api/probe-echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"pin": "123',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({ error: { code: 'VALIDATION_FAILED' } });

    const text = await inject(app,{
      method: 'POST',
      url: '/api/probe-echo',
      headers: { 'content-type': 'text/plain' },
      payload: 'hello',
    });
    expect(text.statusCode).toBe(415);
    expect(text.json()).toEqual({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } });

    const big = await inject(app,{
      method: 'POST',
      url: '/api/probe-echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ filler: 'x'.repeat(2 * 1024 * 1024) }),
    });
    expect(big.statusCode).toBe(413);
    expect(big.json()).toEqual({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('18. an AppError sends its status and code; any other error is 500 INTERNAL and nothing more', async () => {
    const known = await inject(app,{ method: 'GET', url: '/api/probe-app-error' });
    expect(known.statusCode).toBe(409);
    expect(known.json()).toEqual({ error: { code: 'NOT_FOUND' } });

    const plain = await inject(app,{ method: 'GET', url: '/api/probe-plain-error' });
    expect(plain.statusCode).toBe(500);
    expect(plain.json()).toEqual({ error: { code: 'INTERNAL' } });
    expect(ENVELOPE_KEYS(plain.json())).toEqual(['code']);
    expect(plain.body).not.toContain('secret-marker');
  });

  // No current code declares details, so the details half of the handler cannot
  // be exercised without a cast, and a cast is what the contract forbids. What
  // can be shown is that a typed AppError sends exactly the code, with no
  // `details` key at all. The first details-bearing code (PHASE0-009) is the
  // first to exercise the other half.
  it('29. an AppError for a code that declares no details sends no details key', async () => {
    const res = await inject(app,{ method: 'GET', url: '/api/probe-app-error' });
    expect(Object.keys(res.json().error)).toEqual(['code']);
    expect(new AppError(ErrorCode.INTERNAL, 500).details).toBeUndefined();
  });

  it('27. a failed async constraint is the INTERNAL envelope with no-store, and echoes nothing', async () => {
    const bare = Fastify({
      frameworkErrors: frameworkErrorHandler,
      routerOptions: {
        constraints: {
          probe: {
            name: 'probe',
            storage() {
              const routes = new Map<string, unknown>();
              return { get: (v: string) => routes.get(v) ?? null, set: (v: string, h: unknown) => routes.set(v, h) };
            },
            deriveConstraint(_req: unknown, _ctx: unknown, done: (err: Error | null, v?: string) => void) {
              done(new Error('constraint failed: secret-marker'));
            },
            validate() {},
          },
        },
      },
    } as never);
    bare.get('/api/x', { constraints: { probe: 'a' } } as never, async () => ({ ok: true }));
    try {
      const res = await bare.inject({ method: 'GET', url: '/api/x?pin=secret-marker' });
      expect(res.statusCode).toBe(500);
      expect(res.body).toBe('{"error":{"code":"INTERNAL"}}');
      expect(res.headers['cache-control']).toBe('no-store');
    } finally {
      await bare.close();
    }
  });

  const SAME = (res: { statusCode: number; body: string; headers: Record<string, unknown> }) => ({
    status: res.statusCode,
    body: res.body,
    cacheControl: res.headers['cache-control'],
    contentType: res.headers['content-type'],
  });

  it.each(['/%61pi/health', '/a%70i/health', '/%61%70%69/health'])(
    '30. %s is answered exactly as /api/health, no-store included',
    async (url) => {
      const plain = SAME(await inject(app,{ method: 'GET', url: '/api/health' }));
      const encoded = SAME(await inject(app,{ method: 'GET', url }));
      expect(encoded).toEqual(plain);
      expect(encoded.cacheControl).toBe('no-store');
    }
  );

  it('30. a probe registered through apiRoutes carries no-store when reached by an encoded prefix', async () => {
    const res = await inject(app,{ method: 'GET', url: '/%61pi/probe-ok' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it.each(['/%61pi/nope', '/a%70i/nope', '/%61pi/nope?x=1'])(
    '31. %s is answered exactly as /api/nope: the 404 envelope with no-store',
    async (url) => {
      const plain = SAME(await inject(app,{ method: 'GET', url: '/api/nope' }));
      const encoded = SAME(await inject(app,{ method: 'GET', url }));
      expect(encoded).toEqual(plain);
      expect(encoded.status).toBe(404);
      expect(encoded.body).toBe('{"error":{"code":"NOT_FOUND"}}');
      expect(encoded.cacheControl).toBe('no-store');
    }
  );

  it.each(['/API/nope', '/elsewhere', '/%41PI/nope', '/api%2Fnope'])(
    '31. %s stays a plain 404',
    async (url) => {
      const res = await inject(app,{ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(res.body).toBe('Not Found');
      expect(res.headers['cache-control']).toBeUndefined();
    }
  );

  it('19. no response carries an Access-Control-* or Strict-Transport-Security header', async () => {
    const responses = [
      await inject(app,{ method: 'GET', url: '/api/health', headers: { origin: 'https://evil.example' } }),
      await inject(app,{
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          origin: 'https://evil.example',
          'access-control-request-method': 'GET',
        },
      }),
      await inject(app,{ method: 'GET', url: '/api/nope' }),
      await inject(app,{ method: 'GET', url: '/nope' }),
      await inject(app,{ method: 'GET', url: '/api/probe-plain-error' }),
    ];
    for (const res of responses) {
      const names = Object.keys(res.headers);
      expect(names.filter((n) => n.startsWith('access-control-'))).toEqual([]);
      expect(names).not.toContain('strict-transport-security');
    }
  });

  it('20. closePool then a query opens a new pool; building and closing two servers leaves the pool usable', async () => {
    const first = getPool();
    await closePool();
    expect(await query<{ one: number }>('SELECT 1 AS one')).toEqual([{ one: 1 }]);
    expect(getPool()).not.toBe(first);

    // A server closing must not end the pool: whoever holds it (a test file, the
    // next server) would find it ended. Only index.ts closes it, after the server.
    const held = getPool();
    const a = await build();
    const b = await build();
    await a.close();
    await b.close();
    expect(getPool()).toBe(held);
    expect((await held.query('SELECT 1 AS one')).rows).toEqual([{ one: 1 }]);
  });
});
