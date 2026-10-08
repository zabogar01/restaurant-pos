import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool } from '../src/db/pool.js';
import { StartupError } from '../src/http/errors.js';
import { assertLoopbackAddress, listenLoopback } from '../src/http/loopback.js';
import { buildServer } from '../src/http/server.js';
import { loadTls } from '../src/http/tls.js';
import { makeCert } from '../scripts/make-cert.js';

const ACCEPTED = [
  '127.0.0.1',
  '127.0.0.5',
  '127.255.255.254',
  '::1',
  '0:0:0:0:0:0:0:1',
  '0000:0000:0000:0000:0000:0000:0000:0001',
];

const REFUSED = [
  'localhost',
  'localhost.',
  'LOCALHOST',
  'example.com',
  '0.0.0.0',
  '::',
  '',
  '::ffff:127.0.0.1',
  '::ffff:7f00:1',
  '127.1',
  '2130706433',
  '0177.0.0.1',
  '0x7f.0.0.1',
  '::1%lo0',
  'fe80::1%en0',
  '192.168.1.10',
  '10.0.0.2',
  '169.254.1.1',
  '128.0.0.1',
  ' 127.0.0.1',
  '127.0.0.1 ',
];

let dir: string;
let tls: { key: Buffer; cert: Buffer };
const open: FastifyInstance[] = [];

function build(withTls: boolean): FastifyInstance {
  const app = buildServer({
    origin: 'https://localhost:8443',
    logLevel: 'silent',
    ...(withTls ? { tls } : {}),
  });
  open.push(app);
  return app;
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pos-loopback-test-'));
  const made = await makeCert({ dir });
  tls = loadTls(made);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(open.splice(0).map((app) => app.close()));
});

afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  await closePool();
});

describe('the loopback guard', () => {
  it.each(ACCEPTED)('1. accepts %j', (host) => {
    expect(() => assertLoopbackAddress(host)).not.toThrow();
  });

  it.each(REFUSED)('2. refuses %j, naming the value and loopback', (host) => {
    let thrown: unknown;
    try {
      assertLoopbackAddress(host);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(StartupError);
    const message = (thrown as Error).message;
    expect(message).toContain(`"${host}"`);
    expect(message).toContain('loopback');
  });

  it('2. the refusal is the sentence ARCH-010 gives', () => {
    expect(() => assertLoopbackAddress('0.0.0.0')).toThrow(
      'refusing to listen on "0.0.0.0": the MVP listens on a loopback IP address only ' +
        '(ARCHITECTURE 3.1; changing this is the pre-production gate in 3.2)'
    );
  });
});

describe('listenLoopback', () => {
  it('3. rejects an instance built without TLS, and nothing is listening', async () => {
    const app = build(false);
    await expect(listenLoopback(app, { host: '127.0.0.1', port: 0 })).rejects.toThrow(/without TLS/);
    expect(app.server.listening).toBe(false);
    expect(app.addresses()).toEqual([]);
  });

  it('refuses a non-loopback host before any socket exists', async () => {
    const app = build(true);
    await expect(listenLoopback(app, { host: '0.0.0.0', port: 0 })).rejects.toThrow(/loopback/);
    expect(app.server.listening).toBe(false);
  });

  it('4. listens on 127.0.0.1; HTTPS trusting exactly that certificate gets health; plain HTTP fails', async () => {
    const app = build(true);
    await listenLoopback(app, { host: '127.0.0.1', port: 0 });
    const addresses = app.addresses();
    expect(addresses.map((a) => a.address)).toEqual(['127.0.0.1']);
    const port = addresses[0]!.port;

    const secure = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      https
        .get({ host: '127.0.0.1', port, path: '/api/health', ca: tls.cert }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        })
        .on('error', reject);
    });
    expect(secure.status).toBe(200);
    expect(JSON.parse(secure.body)).toEqual({ status: 'ok' });

    await expect(
      new Promise((resolve, reject) => {
        http
          .get({ host: '127.0.0.1', port, path: '/api/health', timeout: 2000 }, resolve)
          .on('error', reject)
          .on('timeout', () => reject(new Error('timeout')));
      })
    ).rejects.toThrow();
  });

  it('5. closes the server and rejects when a bound address is not loopback', async () => {
    const app = build(true);
    vi.spyOn(app, 'addresses').mockReturnValue([
      { address: '0.0.0.0', family: 'IPv4', port: 1 },
    ] as never);
    await expect(listenLoopback(app, { host: '127.0.0.1', port: 0 })).rejects.toThrow(
      /refusing to listen on "0\.0\.0\.0"/
    );
    expect(app.server.listening).toBe(false);
  });

  it('6. exactly one .listen( call exists under apps/server/src', () => {
    const src = fileURLToPath(new URL('../src', import.meta.url));
    const hits: string[] = [];
    for (const file of readdirSync(src, { recursive: true, encoding: 'utf8' })) {
      if (!file.endsWith('.ts')) continue;
      readFileSync(join(src, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.includes('.listen(')) hits.push(`${file}:${i + 1}`);
        });
    }
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/^http\/loopback\.ts:/);
  });
});
