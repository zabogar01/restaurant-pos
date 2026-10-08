import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { closePool, query } from '../src/db/pool.js';
import { buildServer } from '../src/http/server.js';

// Each marker travels by one channel. If any appears in the captured log or in
// any response body, that channel leaked.
const MARK = {
  bodyPin: 'MARK-BODY-PIN-4821',
  bodyPassword: 'MARK-BODY-PASSWORD-7733',
  malformed: 'MARK-MALFORMED-5510',
  cookie: 'MARK-COOKIE-9042',
  authorization: 'MARK-AUTHORIZATION-3318',
  query: 'MARK-QUERY-6604',
  setCookie: 'MARK-SETCOOKIE-1187',
  thrown: 'MARK-THROWN-2256',
  detail: 'MARK-DETAIL-8890',
  postgres: 'MARK-POSTGRES-4403',
  loggedPin: 'MARK-LOGGED-PIN-1029',
  loggedPassword: 'MARK-LOGGED-PASSWORD-2047',
  loggedDeep: 'MARK-LOGGED-DEEP-3065',
};

let app: FastifyInstance;
let lines: string[];
const bodies: string[] = [];
const errorBodies: { status: number; body: string }[] = [];

async function send(options: InjectOptions) {
  const res = await app.inject(options);
  bodies.push(res.body);
  if (res.statusCode >= 400) errorBodies.push({ status: res.statusCode, body: res.body });
  return res;
}

beforeAll(async () => {
  lines = [];
  const logStream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      done();
    },
  });
  app = buildServer({
    origin: 'https://localhost:8443',
    logLevel: 'trace',
    logStream,
    apiRoutes: [
      async (api) => {
        api.post('/probe-body', async () => ({ ok: true }));
        api.get('/probe-set-cookie', async (_request, reply) => {
          reply.header('set-cookie', `sid=${MARK.setCookie}; HttpOnly`);
          return { ok: true };
        });
        api.get('/probe-throw', async () => {
          const err = new Error(`failed with ${MARK.thrown}`) as Error & { detail: string };
          err.detail = MARK.detail;
          throw err;
        });
        api.get('/probe-postgres', async () => {
          await query('SELECT $1::uuid', [MARK.postgres]);
          return { ok: true };
        });
        api.get('/probe-log', async (request) => {
          request.log.info(
            {
              pin: MARK.loggedPin,
              password: MARK.loggedPassword,
              nested: { pin: MARK.loggedDeep },
            },
            'probe'
          );
          return { ok: true };
        });
      },
    ],
  });
  await app.ready();

  await send({
    method: 'POST',
    url: '/api/probe-body',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${MARK.authorization}` },
    payload: { pin: MARK.bodyPin, password: MARK.bodyPassword, nested: { pin: MARK.bodyPin } },
  });
  await send({
    method: 'POST',
    url: '/api/probe-body',
    headers: { 'content-type': 'application/json' },
    payload: `{"pin": "${MARK.malformed}`,
  });
  await send({
    method: 'GET',
    url: `/api/health?token=${MARK.query}`,
    headers: { cookie: `sid=${MARK.cookie}` },
  });
  await send({ method: 'GET', url: `/api/nope?token=${MARK.query}` });
  await send({ method: 'GET', url: '/api/probe-set-cookie' });
  await send({ method: 'GET', url: '/api/probe-throw' });
  await send({ method: 'GET', url: '/api/probe-postgres' });
  await send({ method: 'GET', url: '/api/probe-log' });
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe('what leaves the process', () => {
  it('has something to scan', () => {
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) JSON.parse(line);
  });

  it('21. no marker sent by any channel appears in the log at trace', () => {
    const log = lines.join('\n');
    const leaked = Object.entries(MARK)
      .filter(([, marker]) => log.includes(marker))
      .map(([channel]) => channel);
    expect(leaked, 'channels that leaked into the log').toEqual([]);
  });

  it('22. no marker appears in any response body, and every error body is exactly the envelope', () => {
    const everything = bodies.join('\n');
    const leaked = Object.entries(MARK)
      .filter(([, marker]) => everything.includes(marker))
      .map(([channel]) => channel);
    expect(leaked, 'channels that leaked into a response').toEqual([]);
    expect(errorBodies.length).toBeGreaterThanOrEqual(4);
    for (const { body } of errorBodies) {
      const parsed = JSON.parse(body) as { error: { code: string; details?: unknown } };
      expect(Object.keys(parsed)).toEqual(['error']);
      expect(Object.keys(parsed.error).every((k) => k === 'code' || k === 'details')).toBe(true);
      expect(typeof parsed.error.code).toBe('string');
    }
  });

  it('23. the 500 log lines carry stack frames and the SQLSTATE, and no message', () => {
    const parsed = lines.map((l) => JSON.parse(l) as Record<string, any>);
    const failures = parsed.filter((l) => l.level === 50);
    expect(failures).toHaveLength(2);

    const postgres = failures.find((l) => l.err?.code === '22P02');
    expect(postgres, 'the PostgreSQL failure was not logged with its SQLSTATE').toBeDefined();
    expect(postgres!.err.type).toBeTypeOf('string');
    expect(postgres!.err.stack.length).toBeGreaterThan(0);
    expect(postgres!.err.stack.every((f: string) => /^\s+at /.test(f))).toBe(true);
    expect(postgres!.msg).toBe('request failed');

    const thrown = failures.find((l) => l.err?.code === undefined);
    expect(thrown!.err.stack.length).toBeGreaterThan(0);

    for (const line of failures) {
      expect(line.err).not.toHaveProperty('message');
      expect(line.err).not.toHaveProperty('detail');
    }
  });

  it('24. a probe that logs { pin, password } produces a line without either key', () => {
    const line = lines
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((l) => l.msg === 'probe');
    expect(line).toBeDefined();
    expect(line).not.toHaveProperty('pin');
    expect(line).not.toHaveProperty('password');
    expect(line!.nested).toEqual({});
  });

  it('request lines carry the method and the path without its query string', () => {
    const request = lines
      .map((l) => JSON.parse(l) as { req?: { method: string; path: string } })
      .find((l) => l.req?.path === '/api/health');
    expect(request?.req).toEqual({ method: 'GET', path: '/api/health' });
  });

  it('25. no console. call exists under apps/server/src', () => {
    const src = fileURLToPath(new URL('../src', import.meta.url));
    const hits: string[] = [];
    for (const file of readdirSync(src, { recursive: true, encoding: 'utf8' })) {
      if (!file.endsWith('.ts')) continue;
      readFileSync(join(src, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.includes('console.')) hits.push(`${file}:${i + 1}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
