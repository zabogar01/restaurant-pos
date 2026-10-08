import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:tls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool } from '../src/db/pool.js';
import { StartupError, clientErrorHandler } from '../src/http/errors.js';
import { listenLoopback } from '../src/http/loopback.js';
import { buildServer } from '../src/http/server.js';
import { loadTls } from '../src/http/tls.js';
import { makeCert } from '../scripts/make-cert.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import { TEST_HOST, TEST_ORIGIN, TEST_PORT, inject } from './support/request.js';

const NOT_ALLOWED = '{"error":{"code":"ORIGIN_REFUSED"}}';
const BAD_REQUEST = '{"error":{"code":"VALIDATION_FAILED"}}';
const UNAVAILABLE = '{"error":{"code":"UNAVAILABLE"}}';

let dir: string;
let tls: { key: Buffer; cert: Buffer };
const open: FastifyInstance[] = [];

function build(): FastifyInstance {
  const app = buildServer({
    origin: TEST_ORIGIN,
    logLevel: 'silent',
    tls,
    apiRoutes: [
      async (api) => {
        api.get('/probe-id', async (request) => ({ id: request.clientInstanceId }));
        api.post('/probe-post', async (request) => ({ id: request.clientInstanceId }));
        api.delete('/probe-post', async () => ({ ok: true }));
      },
    ],
  });
  open.push(app);
  return app;
}

async function clients(): Promise<number> {
  return (await ownerQuery('SELECT 1 FROM client_instance')).length;
}

let app: FastifyInstance;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pos-origin-test-'));
  tls = loadTls(await makeCert({ dir }));
  await resetDatabase();
  app = build();
  await app.ready();
});

afterAll(async () => {
  await Promise.all(open.splice(0).map((a) => a.close().catch(() => undefined)));
  rmSync(dir, { recursive: true, force: true });
  await closePool();
});

describe('the Host check', () => {
  const HOSTS = [
    `127.0.0.1:${TEST_PORT}`,
    `evil.example:${TEST_PORT}`,
    'localhost',
    'localhost:9999',
    `LOCALHOST:${TEST_PORT}`,
    `localhost:${TEST_PORT}.evil.example`,
    `localhost:${TEST_PORT} `,
  ];
  const URLS = ['/api/health', '/api/probe-id', '/api/nope', '/nope', '/'];

  it.each(HOSTS.flatMap((host) => URLS.map((url) => [host, url] as const)))(
    '11. Host %j on %s is refused as ORIGIN_REFUSED and writes nothing',
    async (host, url) => {
      const before = await clients();
      const res = await inject(app, { method: 'GET', url, headers: { host } });
      expect(res.statusCode).toBe(403);
      expect(res.body).toBe(NOT_ALLOWED);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(await clients()).toBe(before);
    }
  );

  it('11. the exact Host passes on an API route and outside /api', async () => {
    expect((await inject(app, { method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    expect((await inject(app, { method: 'GET', url: '/nope' })).statusCode).toBe(404);
  });

  it('an API miss passes the Host check, answers the plain envelope and writes nothing', async () => {
    const before = await clients();
    const res = await inject(app, { method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'NOT_FOUND' } });
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await clients()).toBe(before);
  });
});

describe('the origin guard on GET and HEAD', () => {
  it.each(['cross-site', 'same-site', 'bogus', ''])(
    '9. Sec-Fetch-Site %j is 403 ORIGIN_REFUSED and creates no row',
    async (site) => {
      const before = await clients();
      for (const method of ['GET', 'HEAD'] as const) {
        const res = await inject(app, {
          method,
          url: '/api/probe-id',
          headers: { 'sec-fetch-site': site },
        });
        expect(res.statusCode).toBe(403);
        if (method === 'GET') expect(res.body).toBe(NOT_ALLOWED);
        expect(res.headers['set-cookie']).toBeUndefined();
      }
      expect(await clients()).toBe(before);
    }
  );

  it.each(['same-origin', 'none', undefined])('9. Sec-Fetch-Site %j passes', async (site) => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/probe-id',
      headers: site === undefined ? {} : { 'sec-fetch-site': site },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('the origin guard on mutating methods', () => {
  const REFUSED: [string, string | undefined][] = [
    ['no Origin', undefined],
    ['http://localhost', `http://localhost:${TEST_PORT}`],
    ['another port', 'https://localhost:9999'],
    ['127.0.0.1', `https://127.0.0.1:${TEST_PORT}`],
    ['null', 'null'],
    ['a trailing slash', `${TEST_ORIGIN}/`],
    ['an upper-case host', `https://LOCALHOST:${TEST_PORT}`],
  ];

  it.each(REFUSED)('10. POST with %s is refused and creates no row', async (_name, origin) => {
    const before = await clients();
    const res = await app.inject({
      method: 'POST',
      url: '/api/probe-post',
      headers: { host: TEST_HOST, ...(origin === undefined ? {} : { origin }) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.body).toBe(NOT_ALLOWED);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await clients()).toBe(before);
  });

  it('10. POST with the exact origin passes', async () => {
    const res = await inject(app, { method: 'POST', url: '/api/probe-post' });
    expect(res.statusCode).toBe(200);
  });

  it.each(['cross-site', 'same-site', 'none'])(
    '10. POST with the exact origin and Sec-Fetch-Site %j is refused',
    async (site) => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/probe-post',
        headers: { 'sec-fetch-site': site },
      });
      expect(res.statusCode).toBe(403);
      expect(res.body).toBe(NOT_ALLOWED);
    }
  );

  it('10. POST with the exact origin and Sec-Fetch-Site same-origin passes', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/probe-post',
      headers: { 'sec-fetch-site': 'same-origin' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('every other method is held to the same rule', async () => {
    const refused = await app.inject({
      method: 'DELETE',
      url: '/api/probe-post',
      headers: { host: TEST_HOST },
    });
    expect(refused.statusCode).toBe(403);
    expect((await inject(app, { method: 'DELETE', url: '/api/probe-post' })).statusCode).toBe(200);
  });
});

describe('the server origin', () => {
  it.each(['http://localhost:8443', 'https://127.0.0.1:8443', 'https://localhost', 'https://localhost:0', 'nonsense', ''])(
    'refuses to be built for %j',
    (origin) => {
      expect(() => buildServer({ origin, logLevel: 'silent' })).toThrow(StartupError);
    }
  );
});

// What a client sends before the request is parsed into anything Fastify's inject
// can imitate: these go over a real socket to a listening server.
interface Raw {
  status: number;
  head: string;
  body: string;
}

function rawRequest(port: number, bytes: string, chunks?: { later: string; afterMs: number }): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port, ca: tls.cert, servername: 'localhost' });
    let received = '';
    socket.on('secureConnect', () => {
      socket.write(bytes);
      if (chunks) setTimeout(() => socket.write(chunks.later), chunks.afterMs);
    });
    socket.on('data', (chunk) => (received += chunk.toString('latin1')));
    socket.on('error', () => undefined);
    socket.on('close', () => {
      const [head = '', ...rest] = received.split('\r\n\r\n');
      resolve({
        status: Number(/^HTTP\/1\.1 (\d{3})/.exec(head)?.[1] ?? 0),
        head,
        body: rest.join('\r\n\r\n'),
      });
    });
    setTimeout(() => {
      socket.destroy();
      reject(new Error('raw request timed out'));
    }, 5000).unref();
  });
}

describe('at the parser boundary', () => {
  let listening: FastifyInstance;
  let port: number;

  beforeAll(async () => {
    listening = build();
    await listenLoopback(listening, { host: '127.0.0.1', port: 0 });
    port = listening.addresses()[0]!.port;
  });

  const request = (target: string, host = TEST_HOST) =>
    `GET ${target} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`;

  it('control: an origin-form target with the right Host is answered', async () => {
    const res = await rawRequest(port, request('/api/health'));
    expect(res.status).toBe(200);
    expect(res.body).toContain('"ok"');
  });

  it.each([
    ['a matched route', `https://localhost:${TEST_PORT}/api/health`],
    ['an API miss', `https://localhost:${TEST_PORT}/api/nope`],
    ['an encoded API miss', `https://localhost:${TEST_PORT}/%61pi/nope`],
    ['an outside miss', `https://localhost:${TEST_PORT}/nope`],
    ['another origin in the target', 'https://evil.example/api/health'],
  ])('an absolute-form target for %s is refused through the envelope with no-store', async (_name, target) => {
    const res = await rawRequest(port, request(target));
    expect(res.status).toBe(400);
    expect(res.body).toBe(BAD_REQUEST);
    expect(res.head.toLowerCase()).toContain('cache-control: no-store');
  });

  it('an absolute-form target does not create a client instance', async () => {
    const before = await clients();
    await rawRequest(port, request(`https://localhost:${TEST_PORT}/api/probe-id`));
    expect(await clients()).toBe(before);
  });

  it('a request the parser rejects gets the envelope, not Fastify\'s body, and the connection closes', async () => {
    const res = await rawRequest(port, 'NOT AN HTTP REQUEST\r\n\r\n');
    expect(res.status).toBe(400);
    expect(res.body).toBe(BAD_REQUEST);
    expect(res.body).not.toContain('Client Error');
    expect(res.head.toLowerCase()).toContain('cache-control: no-store');
    expect(res.head.toLowerCase()).toContain('connection: close');
  });

  it('an over-long header block gets a 431 with no body', async () => {
    const res = await rawRequest(
      port,
      `GET /api/health HTTP/1.1\r\nHost: ${TEST_HOST}\r\nX-Pad: ${'a'.repeat(70_000)}\r\n\r\n`
    );
    expect(res.status).toBe(431);
    expect(res.body).toBe('');
    expect(res.head).not.toContain('Exceeded');
  });

  it('a request timeout is answered with a 408 and no body', () => {
    const written: string[] = [];
    let destroyed = false;
    const socket = {
      destroyed: false,
      writable: true,
      write: (data: string) => written.push(data),
      destroy: () => (destroyed = true),
    };
    clientErrorHandler.call(
      listening,
      Object.assign(new Error('timeout'), { code: 'ERR_HTTP_REQUEST_TIMEOUT' }),
      socket as never
    );
    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(/^HTTP\/1\.1 408 /);
    expect(written[0]).toMatch(/Content-Length: 0\r\n/);
    expect(written[0]!.endsWith('\r\n\r\n')).toBe(true);
    expect(written[0]).not.toContain('Client Timeout');
    expect(destroyed).toBe(true);
  });

  it('a request that arrives while the server is closing gets the UNAVAILABLE envelope, not Fastify\'s 503 body', async () => {
    const closing = build();
    await listenLoopback(closing, { host: '127.0.0.1', port: 0 });
    const closingPort = closing.addresses()[0]!.port;

    // Headers sent in two parts: the request is in flight (so the connection is
    // not idle and survives the close) when the server starts closing.
    const pending = rawRequest(
      closingPort,
      `GET /api/health HTTP/1.1\r\nHost: ${TEST_HOST}\r\n`,
      { later: 'Connection: close\r\n\r\n', afterMs: 300 }
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    const closed = closing.close();
    const res = await pending;
    await closed;

    expect(res.status).toBe(503);
    expect(res.body).toBe(UNAVAILABLE);
    expect(res.body).not.toContain('Service Unavailable');
    expect(res.head.toLowerCase()).toContain('cache-control: no-store');
  });
});
