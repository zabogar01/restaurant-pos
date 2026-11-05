import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { closePool, query } from '../src/db/pool.js';
import { pinLookup } from '../src/domain/pin.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { resetDatabase } from './support/database.js';
import { makePeople } from './support/people.js';
import { inject } from './support/request.js';
import { usersApi } from './support/users.js';

// PHASE1-S8a: the users routes' credentials. Each travels in a body by one field, with a
// marker no other field shares. A PIN is six digits by rule, so these six-digit numbers are
// chosen apart from anything the log prints, and the scan reads each line without its `time`.
const USERS_MARK = {
  pins: {
    created: '987651',
    cashier: '987652',
    promoted: '987653',
    reactivated: '987654',
    collider: '987655',
    taken: '987656',
    extraKey: '987657',
  },
  passwords: {
    created: 'MARK-USERS-PASSWORD-CREATED-7731',
    promoted: 'MARK-USERS-PASSWORD-PROMOTED-7732',
    duplicateUsername: 'MARK-USERS-PASSWORD-DUPLICATE-7733',
  },
  usernames: {
    created: 'mark.users.created.4411',
    promoted: 'mark.users.promoted.4412',
  },
  extraKey: 'MARK-USERS-EXTRA-KEY-9901',
  malformedPin: 'MARK-USERS-MALFORMED-PIN-9902',
  malformedPassword: 'MK-PW-7',
};
const usersPeople = makePeople(760000);
const usersBodies: string[] = [];
const usersRefusals: { status: number; body: string }[] = [];

// A request's path is logged by design (the method and the path, never the
// query), so a marker in a path would be a false alarm. These two travel in the
// path and are checked against the response bodies only.
const PATH_MARK = { segment: 'MARK-BADURL-SEGMENT-8153', param: 'MARK-LONGPARAM-9264' };

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
  loggedCurrentPassword: 'MARK-LOGGED-CURRENTPASSWORD-4471',
  loggedUsername: 'MARK-LOGGED-USERNAME-5582',
  badUrlPin: 'MARK-BADURL-PIN-6021',
  badUrlPassword: 'MARK-BADURL-PASSWORD-7742',
  bundleQuery: 'MARK-BUNDLE-QUERY-8815',
};

let app: FastifyInstance;
let bundleDir: string;
let lines: string[];
const bodies: string[] = [];
const badUrls: Awaited<ReturnType<typeof send>>[] = [];
let longParam: Awaited<ReturnType<typeof send>>;
const errorBodies: { status: number; body: string }[] = [];

async function send(options: InjectOptions) {
  const res = await inject(app, options);
  bodies.push(res.body);
  // Outside /api an error is plain text (ADR-010 rule 1); the envelope rule is the API's.
  if (res.statusCode >= 400 && String(options.url).startsWith('/api/')) {
    errorBodies.push({ status: res.statusCode, body: res.body });
  }
  return res;
}

beforeAll(async () => {
  await resetDatabase();
  lines = [];
  const logStream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      done();
    },
  });
  bundleDir = mkdtempSync(join(tmpdir(), 'pos-logscan-bundle-'));
  mkdirSync(join(bundleDir, 'assets'));
  writeFileSync(join(bundleDir, 'index.html'), '<!doctype html>');
  writeFileSync(join(bundleDir, 'assets', 'a-1.js'), '');
  app = buildServer({
    origin: 'https://localhost:8443',
    logLevel: 'trace',
    logStream,
    bundles: { pos: bundleDir, backOffice: join(bundleDir, 'not-built') },
    apiRoutes: [
      async (api) => {
        const config = { access: { session: 'NONE' } } as const;
        api.post('/probe-body', { config }, async () => ({ ok: true }));
        api.get('/probe-set-cookie', { config }, async (_request, reply) => {
          reply.header('set-cookie', `sid=${MARK.setCookie}; HttpOnly`);
          return { ok: true };
        });
        api.get('/probe-throw', { config }, async () => {
          const err = new Error(`failed with ${MARK.thrown}`) as Error & { detail: string };
          err.detail = MARK.detail;
          throw err;
        });
        api.get('/probe-postgres', { config }, async () => {
          await query('SELECT $1::uuid', [MARK.postgres]);
          return { ok: true };
        });
        api.get('/probe-param/:id', { config }, async () => ({ ok: true }));
        api.get('/probe-log', { config }, async (request) => {
          request.log.info(
            {
              pin: MARK.loggedPin,
              password: MARK.loggedPassword,
              currentPassword: MARK.loggedCurrentPassword,
              username: MARK.loggedUsername,
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

  // Case 17: a marker in a bundle URL's query string, on a hit, the fallback, an
  // asset, a miss and the not-built 503.
  for (const url of [
    `/pos/?token=${MARK.bundleQuery}`,
    `/pos/floor?token=${MARK.bundleQuery}`,
    `/pos/assets/a-1.js?token=${MARK.bundleQuery}`,
    `/pos/assets/none.js?token=${MARK.bundleQuery}`,
    `/pos?token=${MARK.bundleQuery}`,
    `/back-office/?token=${MARK.bundleQuery}`,
  ]) {
    await send({ method: 'GET', url });
  }

  // Case 26: a URL the router cannot decode is rejected before routing.
  for (const url of [
    `/api/%zz?pin=${MARK.badUrlPin}`,
    `/api/%zz?password=${MARK.badUrlPassword}`,
    `/api/${PATH_MARK.segment}%zz/x?pin=${MARK.badUrlPin}`,
    `/nowhere/%zz?pin=${MARK.badUrlPin}`,
  ]) {
    badUrls.push(await send({ method: 'GET', url }));
  }
  // Case 27: a parameter longer than maxParamLength is the other early rejection.
  longParam = await send({
    method: 'GET',
    url: `/api/probe-param/${PATH_MARK.param}${'x'.repeat(200)}?pin=${MARK.badUrlPin}`,
  });

  // S8a: every users route with a marker in every credential field, through the success
  // path, a DUPLICATE on the PIN (the collision made against a marker PIN) and on the
  // username, and a strict-schema refusal with a marker in an extra key and in a malformed
  // value. The responses are kept for the body scan and, when they are errors, for the
  // envelope check.
  const manager = await usersPeople.manager();
  const jar = new JarClient(app);
  await jar.signInBackOffice(manager.username, manager.password);
  const users = usersApi(jar);
  const sendUsers = async (call: () => ReturnType<typeof users.list>) => {
    const res = await call();
    usersBodies.push(res.body);
    bodies.push(res.body);
    if (res.statusCode >= 400) {
      errorBodies.push({ status: res.statusCode, body: res.body });
      usersRefusals.push({ status: res.statusCode, body: res.body });
    }
    return res;
  };
  const idOf = (res: Awaited<ReturnType<typeof sendUsers>>) =>
    (res.json() as { user: { staffUserId: string } }).user.staffUserId;

  await sendUsers(() => users.list());
  const created = await sendUsers(() =>
    users.create({
      classification: 'MANAGER',
      name: 'Scan Manager',
      pin: USERS_MARK.pins.created,
      username: USERS_MARK.usernames.created,
      password: USERS_MARK.passwords.created,
    })
  );
  const cashier = await sendUsers(() =>
    users.create({ classification: 'CASHIER', name: 'Scan Cashier', pin: USERS_MARK.pins.cashier })
  );
  const cook = await sendUsers(() => users.create({ classification: 'KITCHEN', name: 'Scan Cook' }));
  await sendUsers(() =>
    users.changeRole({
      change: 'KITCHEN_TO_MANAGER',
      staffUserId: idOf(cook),
      pin: USERS_MARK.pins.promoted,
      password: USERS_MARK.passwords.promoted,
      username: USERS_MARK.usernames.promoted,
    })
  );
  const spare = await usersPeople.cashier();
  await sendUsers(() => users.deactivate(spare.id));
  await sendUsers(() => users.reactivate(spare.id, USERS_MARK.pins.reactivated));
  await sendUsers(() => users.deactivate(idOf(cashier)));
  // A DUPLICATE on the PIN: the create, then the reactivation, each against a marker PIN.
  await sendUsers(() => users.create({ classification: 'CASHIER', name: 'Collides', pin: USERS_MARK.pins.created }));
  await sendUsers(() => users.reactivate(idOf(cashier), USERS_MARK.pins.reactivated));
  // A DUPLICATE on the username, with markers in the PIN and the password beside it.
  await sendUsers(() =>
    users.create({
      classification: 'MANAGER',
      name: 'Collides',
      pin: USERS_MARK.pins.taken,
      username: USERS_MARK.usernames.created,
      password: USERS_MARK.passwords.duplicateUsername,
    })
  );
  // A strict-schema refusal: a marker in an extra key, and in two malformed values.
  await sendUsers(() =>
    users.create({ classification: 'CASHIER', name: 'Extra', pin: USERS_MARK.pins.extraKey, extra: USERS_MARK.extraKey })
  );
  await sendUsers(() => users.create({ classification: 'CASHIER', name: 'Malformed', pin: USERS_MARK.malformedPin }));
  await sendUsers(() =>
    users.create({
      classification: 'MANAGER',
      name: 'Short',
      pin: USERS_MARK.pins.collider,
      username: 'short.password',
      password: USERS_MARK.malformedPassword,
    })
  );
  await sendUsers(() => users.deactivate(idOf(created)));
});

afterAll(async () => {
  await app.close();
  rmSync(bundleDir, { recursive: true, force: true });
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

  it('22. no marker appears in any response body, and every error body under /api is exactly the envelope', () => {
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

  it('26. a malformed URL is the VALIDATION_FAILED envelope with no-store, and echoes nothing', () => {
    expect(badUrls).toHaveLength(4);
    for (const res of badUrls) {
      expect(res.statusCode).toBe(400);
      expect(res.body).toBe('{"error":{"code":"VALIDATION_FAILED"}}');
      expect(res.headers['cache-control']).toBe('no-store');
    }
    const rejected = lines
      .map((l) => JSON.parse(l) as Record<string, any>)
      .filter((l) => l.err?.code === 'FST_ERR_BAD_URL');
    expect(rejected).toHaveLength(4);
    for (const line of rejected) {
      expect(line.msg).toBe('request rejected before routing');
      expect(line.err).not.toHaveProperty('message');
    }
    for (const marker of Object.values(PATH_MARK)) {
      expect(bodies.join('\n')).not.toContain(marker);
    }
  });

  it('27. an over-long parameter is the same envelope, and echoes nothing', () => {
    expect(longParam.statusCode).toBe(400);
    expect(longParam.body).toBe('{"error":{"code":"VALIDATION_FAILED"}}');
    expect(longParam.headers['cache-control']).toBe('no-store');
    const logged = lines
      .map((l) => JSON.parse(l) as Record<string, any>)
      .find((l) => l.err?.code === 'FST_ERR_MAX_PARAM_LENGTH');
    expect(logged?.msg).toBe('request rejected before routing');
    expect(logged?.err).not.toHaveProperty('message');
  });

  it('24. a probe that logs { pin, password, currentPassword, username } produces a line without any of the four keys', () => {
    const line = lines
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((l) => l.msg === 'probe');
    expect(line).toBeDefined();
    expect(line).not.toHaveProperty('pin');
    expect(line).not.toHaveProperty('password');
    expect(line).not.toHaveProperty('currentPassword');
    expect(line).not.toHaveProperty('username');
    expect(line!.nested).toEqual({});
  });

  describe('S8a: the users routes', () => {
    const lookups = Object.values(USERS_MARK.pins).map((pin) => pinLookup(pin));
    // Every marker leaf of USERS_MARK, however it is grouped, so a standalone marker (the
    // malformed password was one) can never be sent and left out of the search again.
    const leaves = (value: unknown): string[] =>
      typeof value === 'string' ? [value] : Object.values(value as object).flatMap(leaves);
    const secrets = [...leaves(USERS_MARK), ...lookups, '$argon2id$'];

    it('has the requests it scans, and the refusals it expects', () => {
      expect(usersBodies.length).toBeGreaterThanOrEqual(14);
      expect(usersRefusals.map((r) => `${r.status} ${r.body}`)).toEqual([
        '409 {"error":{"code":"DUPLICATE","details":{"field":"pin"}}}',
        '409 {"error":{"code":"DUPLICATE","details":{"field":"pin"}}}',
        '409 {"error":{"code":"DUPLICATE","details":{"field":"username"}}}',
        '400 {"error":{"code":"VALIDATION_FAILED"}}',
        '400 {"error":{"code":"VALIDATION_FAILED"}}',
        '400 {"error":{"code":"VALIDATION_FAILED"}}',
      ]);
    });

    it('13. no marker PIN, password or username, no PIN lookup and no hash appears in any log line at trace', () => {
      // Read without `time`: a timestamp is thirteen digits and could spell a six-digit marker.
      const log = lines
        .map((line) => {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          delete parsed.time;
          return JSON.stringify(parsed);
        })
        .join('\n');
      const leaked = secrets.filter((secret) => log.includes(secret));
      expect(leaked, 'secrets that reached the log').toEqual([]);
    });

    it('12 and 13. no marker PIN, password, lookup or hash appears in any response body; the username appears only where the view says it', () => {
      const everything = usersBodies.join('\n');
      const leaked = secrets
        .filter((secret) => !Object.values(USERS_MARK.usernames).includes(secret))
        .filter((secret) => everything.includes(secret));
      expect(leaked, 'secrets that reached a response').toEqual([]);
      // A username comes back only in a user view (create and promote), never in a refusal.
      for (const { body } of usersRefusals) {
        for (const username of Object.values(USERS_MARK.usernames)) expect(body).not.toContain(username);
      }
    });
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
