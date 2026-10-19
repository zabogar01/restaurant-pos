import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:tls';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool } from '../src/db/pool.js';
import { CONTENT_SECURITY_POLICY, defaultBundleRoots } from '../src/http/bundles.js';
import { listenLoopback } from '../src/http/loopback.js';
import { buildServer } from '../src/http/server.js';
import { loadTls } from '../src/http/tls.js';
import { makeCert } from '../scripts/make-cert.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import { TEST_HOST, TEST_ORIGIN, TEST_PORT, inject } from './support/request.js';

const POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const IMMUTABLE = 'public, max-age=31536000, immutable';
const POS_MARK = 'MARK-POS-INDEX-4410';
const BACK_MARK = 'MARK-BACKOFFICE-INDEX-5521';
const SECRET_MARK = 'MARK-OUTSIDE-SECRET-6632';
const DOTFILE_MARK = 'MARK-DOTFILE-7743';
const NOT_BUILT_POS = 'The POS client has not been built. Run: npm run build -w apps/pos';

let base: string;
let posDir: string;
let backDir: string;
let app: FastifyInstance;
const open: FastifyInstance[] = [];

function makeBundle(dir: string, mark: string): void {
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), `<!doctype html><html><body>${mark}</body></html>`);
  writeFileSync(join(dir, 'assets', 'app-abc123.js'), `console.log('${mark}');`);
  writeFileSync(join(dir, 'robots.txt'), 'robots');
}

function build(bundles?: { pos: string; backOffice: string }): FastifyInstance {
  const server = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent', bundles });
  open.push(server);
  return server;
}

async function clients(): Promise<number> {
  return (await ownerQuery('SELECT 1 FROM client_instance')).length;
}

function expectPolicy(headers: Record<string, unknown>): void {
  expect(headers['content-security-policy']).toBe(POLICY);
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['cross-origin-resource-policy']).toBe('same-origin');
  expect(headers['strict-transport-security']).toBeUndefined();
  expect(Object.keys(headers).filter((h) => h.startsWith('access-control-'))).toEqual([]);
  expect(headers['set-cookie']).toBeUndefined();
}

function expectPlain404(res: { statusCode: number; headers: Record<string, unknown>; body: string }) {
  expect(res.statusCode).toBe(404);
  expect(String(res.headers['content-type'])).toMatch(/^text\/plain/);
  expect(res.headers['cache-control']).toBe('no-store');
  expect(res.body).toBe('Not Found');
  expect(res.body).not.toContain('<');
}

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'pos-bundles-test-'));
  posDir = join(base, 'pos');
  backDir = join(base, 'back-office');
  makeBundle(posDir, POS_MARK);
  makeBundle(backDir, BACK_MARK);
  // Outside both bundles, to prove traversal reaches nothing.
  writeFileSync(join(base, 'secret.txt'), SECRET_MARK);
  writeFileSync(join(posDir, '.secret'), DOTFILE_MARK);
  await resetDatabase();
  app = build({ pos: posDir, backOffice: backDir });
  await app.ready();
});

afterAll(async () => {
  await Promise.all(open.splice(0).map((a) => a.close().catch(() => undefined)));
  rmSync(base, { recursive: true, force: true });
  await closePool();
});

describe('where the bundles are', () => {
  it('1. the default roots are each client package\'s dist/, whatever the working directory is', () => {
    const expected = {
      pos: fileURLToPath(new URL('../../pos/dist/', import.meta.url)),
      backOffice: fileURLToPath(new URL('../../back-office/dist/', import.meta.url)),
    };
    const here = process.cwd();
    process.chdir(base);
    try {
      expect(defaultBundleRoots()).toEqual(expected);
    } finally {
      process.chdir(here);
    }
    expect(defaultBundleRoots()).toEqual(expected);
  });

  it('1. process.cwd() appears nowhere under src/http', () => {
    const src = fileURLToPath(new URL('../src/http', import.meta.url));
    const hits = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => readFileSync(join(src, f), 'utf8').includes('process.cwd'));
    expect(hits).toEqual([]);
  });
});

describe('what each path answers', () => {
  it('1. GET /pos/ and /pos/index.html are the POS index.html, text/html, no-cache', async () => {
    for (const url of ['/pos/', '/pos/index.html']) {
      const res = await inject(app, { method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(String(res.headers['content-type'])).toMatch(/^text\/html/);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.body).toContain(POS_MARK);
    }
  });

  it('1. HEAD /pos/ answers the headers and no body', async () => {
    const res = await inject(app, { method: 'HEAD', url: '/pos/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.body).toBe('');
  });

  it('2. GET /pos/assets/<hashed> is the file, public immutable for a year', async () => {
    const res = await inject(app, { method: 'GET', url: '/pos/assets/app-abc123.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe(IMMUTABLE);
    expect(String(res.headers['content-type'])).toMatch(/javascript/);
    expect(res.body).toContain(POS_MARK);
  });

  it('2. another file in the bundle root is no-cache', async () => {
    const res = await inject(app, { method: 'GET', url: '/pos/robots.txt' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.body).toBe('robots');
  });

  it.each(['/pos/floor', '/pos/closed-orders', '/pos/orders/deep/path', '/pos/floor/'])(
    '3. GET %s is the POS index.html, no-cache',
    async (url) => {
      const res = await inject(app, { method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(String(res.headers['content-type'])).toMatch(/^text\/html/);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.body).toContain(POS_MARK);
    }
  );

  it.each(['/pos/assets/missing.js', '/pos/missing.js', '/pos/favicon.ico', '/pos/assets', '/pos/assets/'])(
    '4. GET %s is a plain-text 404, never HTML, no-store',
    async (url) => {
      expectPlain404(await inject(app, { method: 'GET', url }));
    }
  );

  it.each(['/back-office/anything', '/back-office/', '/back-office/a/b'])(
    '5. GET %s is the back-office index.html and never the POS one',
    async (url) => {
      const res = await inject(app, { method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain(BACK_MARK);
      expect(res.body).not.toContain(POS_MARK);
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  );

  it('5. the back office has its own asset and its own misses', async () => {
    const hit = await inject(app, { method: 'GET', url: '/back-office/assets/app-abc123.js' });
    expect(hit.statusCode).toBe(200);
    expect(hit.body).toContain(BACK_MARK);
    expect(hit.headers['cache-control']).toBe(IMMUTABLE);
    expectPlain404(await inject(app, { method: 'GET', url: '/back-office/assets/missing.js' }));
  });

  it.each(['/pos', '/back-office'])('6. GET %s is 302 to the constant slash path', async (url) => {
    const res = await inject(app, { method: 'GET', url: `${url}?next=https://evil.example` });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${url}/`);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH'] as const)(
    '7. %s /pos/ is a plain-text 404',
    async (method) => {
      expectPlain404(await inject(app, { method, url: '/pos/' }));
    }
  );

  it('7. a POST with no content type and no body under a prefix is a plain-text 404', async () => {
    expectPlain404(await inject(app, { method: 'POST', url: '/pos/floor' }));
    expectPlain404(await inject(app, { method: 'POST', url: '/back-office/x' }));
  });

  it.each(['/', '/other', '/favicon.ico', '/posx', '/pos-floor', '/back-officex/'])(
    '8. GET %s is a plain-text 404',
    async (url) => {
      const res = await inject(app, { method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(String(res.headers['content-type'])).toMatch(/^text\/plain/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toBe('Not Found');
    }
  );

  it('8. GET /api/missing is still the envelope', async () => {
    const res = await inject(app, { method: 'GET', url: '/api/missing' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'NOT_FOUND' } });
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});

describe('a bundle that is not built', () => {
  it('9. a missing POS directory answers 503 on /pos/ and the fallback, and the back office still serves', async () => {
    const server = build({ pos: join(base, 'no-such-dir'), backOffice: backDir });
    await server.ready();
    for (const url of ['/pos/', '/pos/floor', '/pos/index.html']) {
      const res = await inject(server, { method: 'GET', url });
      expect(res.statusCode).toBe(503);
      expect(String(res.headers['content-type'])).toMatch(/^text\/plain/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toBe(NOT_BUILT_POS);
      expectPolicy(res.headers);
    }
    expectPlain404(await inject(server, { method: 'GET', url: '/pos/assets/app-abc123.js' }));
    const back = await inject(server, { method: 'GET', url: '/back-office/x' });
    expect(back.statusCode).toBe(200);
    expect(back.body).toContain(BACK_MARK);
  });

  it('9. a directory without an index.html answers the same 503', async () => {
    const empty = join(base, 'empty');
    mkdirSync(empty);
    const server = build({ pos: empty, backOffice: backDir });
    await server.ready();
    const res = await inject(server, { method: 'GET', url: '/pos/floor' });
    expect(res.statusCode).toBe(503);
    expect(res.body).toBe(NOT_BUILT_POS);
  });

  it('9. the back office, never built until 011d, answers its own 503 sentence', async () => {
    const server = build({ pos: posDir, backOffice: join(base, 'no-such-dir') });
    await server.ready();
    const res = await inject(server, { method: 'GET', url: '/back-office/' });
    expect(res.statusCode).toBe(503);
    expect(res.body).toBe(
      'The back-office client has not been built. Run: npm run build -w apps/back-office'
    );
  });

  it('10. a bundle built after the server was built is served without rebuilding the server', async () => {
    const late = join(base, 'late');
    const server = build({ pos: late, backOffice: backDir });
    await server.ready();
    expect((await inject(server, { method: 'GET', url: '/pos/' })).statusCode).toBe(503);
    makeBundle(late, POS_MARK);
    const res = await inject(server, { method: 'GET', url: '/pos/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(POS_MARK);
  });
});

describe('what a bundle path can reach', () => {
  it.each([
    '/pos/../secret.txt',
    '/pos/..%2fsecret.txt',
    '/pos/..%2f..%2fsecret.txt',
    '/pos/%2e%2e/secret.txt',
    '/pos/%2e%2e/%2e%2e/db/dev.env',
    '/pos/assets/..%2f..%2fsecret.txt',
    '/pos/..%5csecret.txt',
    '/pos/.secret',
    '/pos/assets/.secret',
    '/pos/%00.txt',
  ])('11. %s returns no file content', async (url) => {
    const res = await inject(app, { method: 'GET', url });
    expect(res.body).not.toContain(SECRET_MARK);
    expect(res.body).not.toContain(DOTFILE_MARK);
    expect(res.body).not.toContain('POSTGRES');
    expect([403, 404, 400]).toContain(res.statusCode);
    expect(String(res.headers['content-type'])).not.toMatch(/html/);
  });

  it('11. a raw request line with dot segments reaches no file either', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pos-bundles-cert-'));
    const tls = loadTls(await makeCert({ dir }));
    const listening = buildServer({
      origin: TEST_ORIGIN,
      logLevel: 'silent',
      tls,
      bundles: { pos: posDir, backOffice: backDir },
    });
    open.push(listening);
    await listenLoopback(listening, { host: '127.0.0.1', port: 0 });
    const port = listening.addresses()[0]!.port;
    for (const target of ['/pos/../secret.txt', '/pos/%2e%2e/secret.txt', '/pos/assets/../../secret.txt']) {
      const received = await new Promise<string>((resolve, reject) => {
        const socket = connect({ host: '127.0.0.1', port, ca: tls.cert, servername: 'localhost' });
        let data = '';
        socket.on('secureConnect', () =>
          socket.write(`GET ${target} HTTP/1.1\r\nHost: ${TEST_HOST}\r\nConnection: close\r\n\r\n`)
        );
        socket.on('data', (chunk) => (data += chunk.toString('latin1')));
        socket.on('error', reject);
        socket.on('close', () => resolve(data));
      });
      expect(received).not.toContain(SECRET_MARK);
    }
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('the headers', () => {
  const CASES: [string, string, 'GET' | 'POST'][] = [
    ['hit', '/pos/', 'GET'],
    ['index.html', '/pos/index.html', 'GET'],
    ['asset', '/pos/assets/app-abc123.js', 'GET'],
    ['fallback', '/pos/floor', 'GET'],
    ['asset miss', '/pos/assets/missing.js', 'GET'],
    ['dotted miss', '/pos/missing.js', 'GET'],
    ['redirect', '/pos', 'GET'],
    ['wrong method', '/pos/', 'POST'],
    ['back-office hit', '/back-office/x', 'GET'],
    ['back-office redirect', '/back-office', 'GET'],
  ];

  it.each(CASES)('12. %s carries the exact policy and none of the forbidden headers', async (_n, url, method) => {
    const res = await inject(app, { method, url });
    expectPolicy(res.headers);
  });

  it('12. the policy is the one constant in source', () => {
    expect(CONTENT_SECURITY_POLICY).toBe(POLICY);
  });

  it('12. no response of the not-built 503 sets a cookie', async () => {
    const server = build({ pos: join(base, 'no-such-dir'), backOffice: backDir });
    await server.ready();
    expectPolicy((await inject(server, { method: 'GET', url: '/pos/' })).headers);
  });
});

describe('the guards', () => {
  const HOSTS = [`127.0.0.1:${TEST_PORT}`, 'evil.example', 'localhost', `LOCALHOST:${TEST_PORT}`];

  it.each(HOSTS.flatMap((h) => ['/pos/', '/pos/assets/app-abc123.js', '/pos/floor'].map((u) => [h, u] as const)))(
    '13. Host %j on %s is a 403 in plain text with no envelope, naming the one address',
    async (host, url) => {
      const res = await inject(app, { method: 'GET', url, headers: { host } });
      expect(res.statusCode).toBe(403);
      expect(String(res.headers['content-type'])).toMatch(/^text\/plain/);
      expect(res.body).toBe(`This application answers only at ${TEST_ORIGIN}.`);
      expect(res.body).not.toContain('{');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  );

  it.each(
    ['GET', 'HEAD'].flatMap((m) =>
      ['/pos', '/pos/', '/back-office', '/back-office/'].map((u) => [m, u] as const)
    )
  )('13. a refused Host on %s %s carries the bundle headers and no-store', async (method, url) => {
    const res = await inject(app, {
      method: method as 'GET' | 'HEAD',
      url,
      headers: { host: `127.0.0.1:${TEST_PORT}` },
    });
    expect(res.statusCode).toBe(403);
    expect(String(res.headers['content-type'])).toMatch(/^text\/plain/);
    expect(res.headers['cache-control']).toBe('no-store');
    expectPolicy(res.headers);
  });

  it.each(['/', '/other', '/posx', '/api/health', '/api/missing'])(
    '13. a refused Host outside both prefixes and under /api carries no bundle headers: %s',
    async (url) => {
      const res = await inject(app, { method: 'GET', url, headers: { host: `127.0.0.1:${TEST_PORT}` } });
      expect(res.statusCode).toBe(403);
      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBeUndefined();
      expect(res.headers['referrer-policy']).toBeUndefined();
      expect(res.headers['cross-origin-resource-policy']).toBeUndefined();
    }
  );

  it.each(['cross-site', 'same-site', 'none', 'same-origin', 'bogus'])(
    '14. a bundle request with Sec-Fetch-Site %j is served',
    async (site) => {
      const res = await inject(app, { method: 'GET', url: '/pos/', headers: { 'sec-fetch-site': site } });
      expect(res.statusCode).toBe(200);
      const asset = await inject(app, {
        method: 'GET',
        url: '/pos/assets/app-abc123.js',
        headers: { 'sec-fetch-site': site },
      });
      expect(asset.statusCode).toBe(200);
    }
  );

  const URLS = [
    '/pos/',
    '/pos/assets/app-abc123.js',
    '/pos/floor',
    '/pos/assets/missing.js',
    '/back-office/x',
  ];

  async function sweep(): Promise<void> {
    for (const url of URLS) {
      const res = await inject(app, {
        method: 'GET',
        url,
        headers: { cookie: 'rpos_cid=11111111-1111-4111-8111-111111111111' },
      });
      expect([200, 404]).toContain(res.statusCode);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  }

  it('15. bundle requests neither create nor read a client_instance row', async () => {
    const before = await clients();
    await sweep();
    expect(await clients()).toBe(before);
  });

  it('15. with the database unreachable the same requests still pass', async () => {
    const saved = process.env.DATABASE_URL;
    await closePool();
    process.env.DATABASE_URL = 'postgres://pos_app:none@127.0.0.1:1/none';
    try {
      await sweep();
    } finally {
      process.env.DATABASE_URL = saved;
      await closePool();
    }
  });
});

describe('without bundles', () => {
  it('16. with bundles omitted GET /pos/ is a plain-text 404', async () => {
    const server = build();
    await server.ready();
    for (const url of ['/pos/', '/pos/floor', '/pos', '/back-office/']) {
      const res = await inject(server, { method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(String(res.headers['content-type'])).toMatch(/^text\/plain/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toBe('Not Found');
      expect(res.headers['content-security-policy']).toBeUndefined();
    }
  });
});
