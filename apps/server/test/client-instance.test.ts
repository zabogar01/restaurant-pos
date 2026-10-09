import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool, getPool } from '../src/db/pool.js';
import { writeSecurityEvent } from '../src/domain/audit.js';
import { createStaffUser, findUserByPin } from '../src/domain/pin.js';
import { createSession } from '../src/domain/session.js';
import { buildServer } from '../src/http/server.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import { inject } from './support/request.js';

let app: FastifyInstance;
let cashier: { id: string; credentialVersion: number };

beforeAll(async () => {
  await resetDatabase();
  await createStaffUser({ name: 'Cashier', role: 'CASHIER', pin: '111111' });
  const found = await findUserByPin('111111');
  if (!found) throw new Error('fixture user not found');
  cashier = { id: found.id, credentialVersion: found.credentialVersion };
  app = buildServer({
    origin: 'https://localhost:8443',
    logLevel: 'silent',
    apiRoutes: [
      async (api) => {
        api.get('/probe-id', { config: { access: { session: 'NONE' } } }, async (request) => ({
          id: request.clientInstanceId,
        }));
        api.get('/probe-event', { config: { access: { session: 'NONE' } } }, async (request) => {
          await writeSecurityEvent({
            eventType: 'PIN_FAILURE',
            throttleClass: 'LOGIN',
            clientInstanceId: request.clientInstanceId,
          });
          return { id: request.clientInstanceId };
        });
        api.get('/probe-session', { config: { access: { session: 'NONE' } } }, async (request) => {
          const issued = await createSession({
            audience: 'POS',
            user: cashier,
            clientInstanceId: request.clientInstanceId,
          });
          return { id: request.clientInstanceId, sessionId: issued.sessionId };
        });
      },
    ],
  });
  await app.ready();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

interface Row {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
}

async function rows(): Promise<Row[]> {
  return ownerQuery<Row>(
    'SELECT id, first_seen_at::text, last_seen_at::text FROM client_instance ORDER BY first_seen_at, id'
  );
}

async function count(): Promise<number> {
  return (await rows()).length;
}

function cookieOf(res: { headers: Record<string, unknown> }): string | undefined {
  const header = res.headers['set-cookie'];
  return Array.isArray(header) ? header[0] : (header as string | undefined);
}

function cookieValue(setCookie: string): string {
  return /^rpos_cid=([^;]*)/.exec(setCookie)![1]!;
}

async function probe(cookie?: string) {
  return inject(app, {
    method: 'GET',
    url: '/api/probe-id',
    ...(cookie === undefined ? {} : { headers: { cookie } }),
  });
}

describe('the client instance', () => {
  it('1. a first API request makes one row and sets rpos_cid with exactly the specified attributes', async () => {
    const before = await count();
    const res = await probe();
    expect(res.statusCode).toBe(200);
    const created = (await rows()).slice(before);
    expect(created).toHaveLength(1);

    const setCookie = cookieOf(res)!;
    expect(cookieValue(setCookie)).toBe(created[0]!.id);
    expect(res.json()).toEqual({ id: created[0]!.id });

    const parts = setCookie.split(';').map((p) => p.trim());
    expect(parts[0]).toBe(`rpos_cid=${created[0]!.id}`);
    expect(parts.slice(1).sort()).toEqual(
      ['HttpOnly', 'Max-Age=34560000', 'Path=/', 'SameSite=Strict', 'Secure'].sort()
    );
    expect(setCookie).not.toMatch(/domain/i);
  });

  it('2. with that cookie a second request sets no cookie, makes no row, keeps first_seen_at and moves last_seen_at on', async () => {
    const first = await probe();
    const id = cookieValue(cookieOf(first)!);
    await ownerQuery(
      `UPDATE client_instance
          SET first_seen_at = now() - interval '2 hours',
              last_seen_at = now() - interval '1 hour'
        WHERE id = $1`,
      [id]
    );
    const aged = (await rows()).find((r) => r.id === id)!;
    const before = await count();

    const second = await probe(`rpos_cid=${id}`);
    expect(second.statusCode).toBe(200);
    expect(cookieOf(second)).toBeUndefined();
    expect(second.json()).toEqual({ id });
    expect(await count()).toBe(before);

    const after = (await rows()).find((r) => r.id === id)!;
    expect(after.first_seen_at).toBe(aged.first_seen_at);
    const moved = await ownerQuery<{ moved: boolean }>(
      'SELECT last_seen_at > $2::timestamptz AS moved FROM client_instance WHERE id = $1',
      [id, aged.last_seen_at]
    );
    expect(moved[0]!.moved).toBe(true);
  });

  it('3. a well-formed UUID that names no row is a new row, a new cookie and the new id', async () => {
    const stranger = randomUUID();
    const before = await count();
    const res = await probe(`rpos_cid=${stranger}`);
    expect(res.statusCode).toBe(200);
    expect(await count()).toBe(before + 1);
    const issued = cookieValue(cookieOf(res)!);
    expect(issued).not.toBe(stranger);
    expect(res.json()).toEqual({ id: issued });
    expect((await rows()).map((r) => r.id)).toContain(issued);
    expect((await rows()).map((r) => r.id)).not.toContain(stranger);
  });

  const MALFORMED: [string, string][] = [
    ['empty', ''],
    ['abc', 'abc'],
    ['an upper-case UUID', randomUUID().toUpperCase()],
    ['a UUID in braces', `{${randomUUID()}}`],
    ['ten thousand characters', 'a'.repeat(10_000)],
    ['a quote and a semicolon', '"\';--'],
  ];

  it.each(MALFORMED)('4. %s is 200 and a new identity, and reaches no query', async (_name, value) => {
    const spy = vi.spyOn(getPool(), 'query');
    const before = await count();
    const res = await probe(`rpos_cid=${value}`);
    expect(res.statusCode).toBe(200);
    const presented = spy.mock.calls.flatMap((call) => {
      const params = (call as unknown[])[1];
      return Array.isArray(params) ? params : [];
    });
    expect(presented).not.toContain(value);
    expect(presented.filter((p) => typeof p === 'string' && p.toLowerCase() === value.toLowerCase())).toEqual(
      []
    );
    spy.mockRestore();

    expect(await count()).toBe(before + 1);
    const issued = cookieValue(cookieOf(res)!);
    expect(res.json()).toEqual({ id: issued });
    expect(issued).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('5. a last_seen_at an hour ahead is not moved back', async () => {
    const id = cookieValue(cookieOf(await probe())!);
    await ownerQuery(
      `UPDATE client_instance SET last_seen_at = clock_timestamp() + interval '1 hour' WHERE id = $1`,
      [id]
    );
    const ahead = (await rows()).find((r) => r.id === id)!;
    const res = await probe(`rpos_cid=${id}`);
    expect(res.statusCode).toBe(200);
    expect((await rows()).find((r) => r.id === id)!.last_seen_at).toBe(ahead.last_seen_at);
  });

  it('6. health with no cookie makes no row and sets no cookie', async () => {
    const before = await count();
    const res = await inject(app, { method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(cookieOf(res)).toBeUndefined();
    expect(await count()).toBe(before);
  });

  it('6. health with a valid cookie does not touch the row either', async () => {
    const id = cookieValue(cookieOf(await probe())!);
    await ownerQuery(
      `UPDATE client_instance SET last_seen_at = now() - interval '1 hour' WHERE id = $1`,
      [id]
    );
    const aged = (await rows()).find((r) => r.id === id)!;
    await inject(app, { method: 'GET', url: '/api/health', headers: { cookie: `rpos_cid=${id}` } });
    expect((await rows()).find((r) => r.id === id)!.last_seen_at).toBe(aged.last_seen_at);
  });

  it('7. an unknown UUID, then a security event with request.clientInstanceId, succeeds and references the new row', async () => {
    const stranger = randomUUID();
    const res = await inject(app, {
      method: 'GET',
      url: '/api/probe-event',
      headers: { cookie: `rpos_cid=${stranger}` },
    });
    expect(res.statusCode).toBe(200);
    const issued = cookieValue(cookieOf(res)!);
    expect(issued).not.toBe(stranger);
    const events = await ownerQuery<{ client_instance_id: string }>(
      'SELECT client_instance_id FROM security_event WHERE client_instance_id = $1',
      [issued]
    );
    expect(events).toHaveLength(1);
    const strangers = await ownerQuery(
      'SELECT 1 FROM security_event WHERE client_instance_id = $1',
      [stranger]
    );
    expect(strangers).toEqual([]);
  });

  it('8. a session created with request.clientInstanceId stores it', async () => {
    const res = await inject(app, { method: 'GET', url: '/api/probe-session' });
    expect(res.statusCode).toBe(200);
    const { id, sessionId } = res.json() as { id: string; sessionId: string };
    expect(id).toBe(cookieValue(cookieOf(res)!));
    const stored = await ownerQuery<{ client_instance_id: string }>(
      'SELECT client_instance_id FROM actor_session WHERE id = $1',
      [sessionId]
    );
    expect(stored).toEqual([{ client_instance_id: id }]);
  });

  it('12. client-instance.ts never calls now()', () => {
    const file = fileURLToPath(new URL('../src/http/client-instance.ts', import.meta.url));
    expect(readFileSync(file, 'utf8')).not.toContain('now()');
  });
});
