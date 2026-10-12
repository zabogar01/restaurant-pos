import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ManagerPin } from '@pos/contracts';
import { closePool } from '../src/db/pool.js';
import { withManagerApproval } from '../src/domain/approval.js';
import { SESSION_POLICY } from '../src/domain/session.js';
import { COOLDOWN_MINUTES, MAX_FAILURES } from '../src/domain/throttle.js';
import type { RouteAccess } from '../src/http/access.js';
import { approvalRequest, approved } from '../src/http/approval.js';
import { buildServer } from '../src/http/server.js';
import { parseBody } from '../src/http/validate.js';
import { JarClient } from './support/client.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import {
  ageOutPinCooldown,
  ageSession,
  auditCount,
  bucket,
  makePeople,
  securityEvents,
  sessionIdOfUser,
  setCookiesNamed,
  wholeSecurityLog,
} from './support/people.js';
import type { Person } from './support/people.js';
import { TEST_ORIGIN, inject } from './support/request.js';

// The probe is the only gated route there is: it is declared here, registered
// through apiRoutes, and not in src (ARCH-013 section 6). Its work writes one row
// the tests can look for.
const PROBE = '/api/pos/approval-probe';
const PROBE_THROWS = '/api/pos/approval-probe-throws';
const ACTION = 'PROBE_APPROVED';

const people = makePeople(650000);
const UNKNOWN_PIN = '737373';
const VALIDATION = '{"error":{"code":"VALIDATION_FAILED"}}';
const APPROVAL_FAILED = '{"error":{"code":"APPROVAL_FAILED"}}';
const UNAUTHENTICATED = '{"error":{"code":"UNAUTHENTICATED"}}';
const MAX_RETRY_SECONDS = COOLDOWN_MINUTES * 60;

// The probe's body, strict: exactly one key, `managerPin`, under the contract's
// field schema. zod belongs to @pos/contracts alone, so the object is composed here
// by hand from the one exported field.
const ProbeBody = {
  safeParse(input: unknown): { success: true; data: { managerPin: string } } | { success: false } {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { success: false as const };
    }
    const keys = Object.keys(input);
    if (keys.length !== 1 || keys[0] !== 'managerPin') return { success: false as const };
    const pin = ManagerPin.safeParse((input as { managerPin?: unknown }).managerPin);
    if (!pin.success) return { success: false as const };
    return { success: true as const, data: { managerPin: pin.data } };
  },
};

const probeAccess: RouteAccess = { session: 'ACTIVE', audience: 'POS', interactive: true };

const probe: FastifyPluginAsync = async (api) => {
  api.post(PROBE.replace('/api', ''), { config: { access: probeAccess } }, async (request) => {
    const { managerPin } = parseBody(ProbeBody, request.body);
    return approved(
      await withManagerApproval(
        approvalRequest(request, {
          managerPin,
          action: ACTION,
          subject: { type: 'probe', id: 'probe-1' },
        }),
        async (client, approver) => {
          await client.query('INSERT INTO approval_route_probe (note) VALUES ($1)', [approver.id]);
          return { result: { approvedBy: approver.id } };
        }
      )
    );
  });

  api.post(PROBE_THROWS.replace('/api', ''), { config: { access: probeAccess } }, async (request) => {
    const { managerPin } = parseBody(ProbeBody, request.body);
    return approved(
      await withManagerApproval(
        approvalRequest(request, { managerPin, action: ACTION }),
        async () => {
          throw new Error('probe work failed MARK-WORK-ERROR-6641');
        }
      )
    );
  });
};

let app: FastifyInstance;
let lines: string[] = [];
let cashier: Person;
let manager: Person;
let otherManager: Person;

function buildProbeServer(logLevel = 'silent', stream?: Writable): FastifyInstance {
  return buildServer({
    origin: TEST_ORIGIN,
    logLevel,
    ...(stream ? { logStream: stream } : {}),
    apiRoutes: [probe],
  });
}

beforeAll(async () => {
  const logStream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      done();
    },
  });
  app = buildProbeServer('trace', logStream);
  await app.ready();
});

beforeEach(async () => {
  await resetDatabase();
  await ownerQuery('CREATE TABLE approval_route_probe (note text NOT NULL)');
  await ownerQuery('GRANT INSERT ON approval_route_probe TO pos_app');
  lines = [];
  cashier = await people.cashier();
  manager = await people.manager();
  otherManager = await people.manager();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

interface EntryRow {
  actor_id: string;
  approver_id: string | null;
  action: string;
  outcome: string;
  subject_type: string | null;
  subject_id: string | null;
}

async function entriesOf(actorId: string): Promise<EntryRow[]> {
  return ownerQuery<EntryRow>(
    `SELECT actor_id, approver_id, action, outcome, subject_type, subject_id
       FROM audit_entry WHERE actor_id = $1 ORDER BY id`,
    [actorId]
  );
}

async function probeRows(): Promise<string[]> {
  return (await ownerQuery<{ note: string }>('SELECT note FROM approval_route_probe')).map((r) => r.note);
}

async function signedIn(person: Person, server: FastifyInstance = app): Promise<JarClient> {
  const client = new JarClient(server);
  const res = await client.signInPos(person.pin);
  expect(res.statusCode).toBe(200);
  return client;
}

function gated(client: JarClient, payload: object, url = PROBE) {
  return client.request({ method: 'POST', url, payload });
}

async function failMany(client: JarClient, times: number) {
  const out = [];
  for (let i = 0; i < times; i += 1) out.push(await gated(client, { managerPin: UNKNOWN_PIN }));
  return out;
}

// What the database holds that an approval could touch.
async function evidence() {
  return {
    approval: await bucket('MANAGER_APPROVAL'),
    login: await bucket('LOGIN'),
    audits: await auditCount(),
    events: await wholeSecurityLog(),
    rows: await probeRows(),
  };
}

type Body = { error: { code: string; details?: { retryAfterSeconds: number } } };

function expectRetryDetails(body: Body) {
  expect(Object.keys(body)).toEqual(['error']);
  expect(Object.keys(body.error).sort()).toEqual(['code', 'details']);
  expect(Object.keys(body.error.details!)).toEqual(['retryAfterSeconds']);
  expect(Number.isInteger(body.error.details!.retryAfterSeconds)).toBe(true);
  expect(body.error.details!.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  expect(body.error.details!.retryAfterSeconds).toBeLessThanOrEqual(MAX_RETRY_SECONDS);
}

// A PIN is six digits and so can sit inside a timestamp or an id; a PIN counts as
// leaked only where it is not part of a longer token.
function leaks(text: string, pin: string): boolean {
  return new RegExp(`(?<![0-9A-Za-z.:+-])${pin}(?![0-9A-Za-z.:+-])`).test(text);
}

describe('inline manager approval through a guarded route', () => {
  it('1. approved through the probe: 200 with the work\'s result, one SUCCESS entry naming the actor and the approver', async () => {
    const client = await signedIn(cashier);
    const res = await gated(client, { managerPin: manager.pin });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ approvedBy: manager.id });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(await probeRows()).toEqual([manager.id]);
    expect(await entriesOf(cashier.id)).toEqual([
      {
        actor_id: cashier.id,
        approver_id: manager.id,
        action: ACTION,
        outcome: 'SUCCESS',
        subject_type: 'probe',
        subject_id: 'probe-1',
      },
    ]);
  });

  describe('2. a body that does not fit the schema is 400 and counts nowhere', () => {
    const bodies = (): [string, object][] => [
      ['no managerPin', {}],
      ['five digits', { managerPin: '12345' }],
      ['seven digits', { managerPin: '1234567' }],
      ['the number 123456', { managerPin: 123456 }],
      ['null', { managerPin: null }],
      ['full-width digits', { managerPin: '１２３４５６' }],
      ['an Arabic-Indic digit', { managerPin: '12345٦' }],
      ['a trailing newline', { managerPin: '123456\n' }],
      ['an array', [manager.pin]],
      ['an extra actorId', { managerPin: manager.pin, actorId: manager.id }],
      ['an extra approverId', { managerPin: manager.pin, approverId: manager.id }],
    ];

    async function allRefused(client: JarClient) {
      const before = await evidence();
      for (const [name, payload] of bodies()) {
        const res = await gated(client, payload);
        expect(res.statusCode, name).toBe(400);
        expect(res.body, name).toBe(VALIDATION);
      }
      expect(await evidence()).toEqual(before);
    }

    it('before any failure, and again while the class is cooling down', async () => {
      const client = await signedIn(cashier);
      await allRefused(client);
      expect(await probeRows()).toEqual([]);

      const results = await failMany(client, MAX_FAILURES);
      expect(results.at(-1)!.statusCode).toBe(403);
      expect((await gated(client, { managerPin: manager.pin })).statusCode).toBe(429);
      await allRefused(client);
    });
  });

  it('3. a wrong PIN: 403 APPROVAL_FAILED with no details, the session stays, every kind of failed PIN answers identically', async () => {
    const goneManager = await people.manager();
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [goneManager.id]);
    const otherCashier = await people.cashier();
    const client = await signedIn(cashier);

    const answers = [];
    for (const pin of [UNKNOWN_PIN, otherCashier.pin, cashier.pin, goneManager.pin]) {
      const res = await gated(client, { managerPin: pin });
      expect(res.statusCode).toBe(403);
      expect(res.body).toBe(APPROVAL_FAILED);
      expect(setCookiesNamed(res, 'rpos_pos_sid')).toEqual([]);
      const { date: _date, ...headers } = res.headers;
      answers.push({ status: res.statusCode, body: res.body, headers });
    }
    for (const answer of answers.slice(1)) expect(answer).toEqual(answers[0]);

    const me = await client.get('/api/pos/auth/me');
    expect(me.statusCode).toBe(200);
    expect((me.json() as { staffUserId: string }).staffUserId).toBe(cashier.id);
    expect((await entriesOf(cashier.id)).map((e) => e.outcome)).toEqual(Array(4).fill('APPROVAL_FAILED'));
    expect(await probeRows()).toEqual([]);
  });

  it('4. the failure that starts the cooldown reports it; the next request is 429 APPROVAL_THROTTLED and audited', async () => {
    const client = await signedIn(cashier);
    const failures = await failMany(client, MAX_FAILURES);
    for (const res of failures.slice(0, -1)) {
      expect(res.statusCode).toBe(403);
      expect(res.body).toBe(APPROVAL_FAILED);
    }
    const fifth = failures.at(-1)!;
    expect(fifth.statusCode).toBe(403);
    const fifthBody = fifth.json() as Body;
    expect(fifthBody.error.code).toBe('APPROVAL_FAILED');
    expectRetryDetails(fifthBody);

    const refused = await gated(client, { managerPin: manager.pin });
    expect(refused.statusCode).toBe(429);
    const refusedBody = refused.json() as Body;
    expect(refusedBody.error.code).toBe('APPROVAL_THROTTLED');
    expectRetryDetails(refusedBody);
    expect(setCookiesNamed(refused, 'rpos_pos_sid')).toEqual([]);

    const entries = await entriesOf(cashier.id);
    expect(entries.map((e) => e.outcome)).toEqual([
      ...Array(MAX_FAILURES).fill('APPROVAL_FAILED'),
      'APPROVAL_THROTTLED',
    ]);
    expect(entries.at(-1)).toMatchObject({ actor_id: cashier.id, approver_id: null, action: ACTION });
    expect(await probeRows()).toEqual([]);
    expect((await client.get('/api/pos/auth/me')).statusCode).toBe(200);
  });

  describe('5. AC-27: a back-office session approves nothing', () => {
    it('a jar with a manager\'s back-office session and a cashier\'s POS session: no PIN is 400, and rpos_bo_sid was never sent', async () => {
      const client = new JarClient(app);
      expect((await client.signInBackOffice(manager.username, manager.password)).statusCode).toBe(200);
      expect((await client.signInPos(cashier.pin)).statusCode).toBe(200);
      const before = await evidence();

      const res = await gated(client, {});
      expect(res.statusCode).toBe(400);
      expect(res.body).toBe(VALIDATION);
      const sent = client.sent.at(-1)!;
      expect(sent.url).toBe(PROBE);
      expect(sent.cookie).toContain('rpos_pos_sid=');
      expect(sent.cookie).not.toContain('rpos_bo_sid');
      expect(await evidence()).toEqual(before);
    });

    it('a jar with only the back-office session: 401 UNAUTHENTICATED, no entry, the bucket identical', async () => {
      const client = new JarClient(app);
      expect((await client.signInBackOffice(manager.username, manager.password)).statusCode).toBe(200);
      const before = await evidence();

      const res = await gated(client, { managerPin: manager.pin });
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(UNAUTHENTICATED);
      expect(client.sent.at(-1)!.cookie ?? '').not.toContain('rpos_bo_sid');
      expect(await evidence()).toEqual(before);
    });
  });

  it('6. a manager signed in at the POS: no PIN is 400; their own PIN approves with approver = actor', async () => {
    const client = await signedIn(manager);
    const none = await gated(client, {});
    expect(none.statusCode).toBe(400);
    expect(none.body).toBe(VALIDATION);
    expect(await probeRows()).toEqual([]);
    expect(await entriesOf(manager.id)).toEqual([]);

    const own = await gated(client, { managerPin: manager.pin });
    expect(own.statusCode).toBe(200);
    expect(own.json()).toEqual({ approvedBy: manager.id });
    expect(await entriesOf(manager.id)).toEqual([
      {
        actor_id: manager.id,
        approver_id: manager.id,
        action: ACTION,
        outcome: 'SUCCESS',
        subject_type: 'probe',
        subject_id: 'probe-1',
      },
    ]);
  });

  describe('7. the guard runs before any PIN is looked at', () => {
    // A wrong PIN is what would be counted if the handler were reached.
    const body = { managerPin: UNKNOWN_PIN };

    it('no session: UNAUTHENTICATED, nothing counted', async () => {
      const before = await evidence();
      const res = await gated(new JarClient(app), body);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(UNAUTHENTICATED);
      expect(await evidence()).toEqual(before);
    });

    it('an idle session: SESSION_IDLE, nothing counted', async () => {
      const client = await signedIn(cashier);
      const [id] = await sessionIdOfUser(cashier.id, 'POS');
      await ageSession(id!, SESSION_POLICY.POS.idleSeconds + 60);
      const before = await evidence();
      const res = await gated(client, body);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe('{"error":{"code":"SESSION_IDLE"}}');
      expect(await evidence()).toEqual(before);
    });

    it('a missing anti-CSRF token: CSRF_REFUSED, nothing counted', async () => {
      const client = await signedIn(cashier);
      const before = await evidence();
      const res = await inject(app, {
        method: 'POST',
        url: PROBE,
        payload: body,
        headers: { cookie: `rpos_pos_sid=${client.valueOf('rpos_pos_sid')!}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.body).toBe('{"error":{"code":"CSRF_REFUSED"}}');
      expect(await evidence()).toEqual(before);
    });
  });

  it('8. AC-19: five failed approvals leave sign-in alone; a sign-in, a replaced client instance and a rebuilt server leave the cooldown alone', async () => {
    const client = await signedIn(cashier);
    const loginBefore = await bucket('LOGIN');
    await failMany(client, MAX_FAILURES);
    expect(await bucket('LOGIN')).toBe(loginBefore);

    // The sign-in route still verifies, and the approval cooldown still stands.
    const approvalBucket = await bucket('MANAGER_APPROVAL');
    const again = await client.signInPos(cashier.pin);
    expect(again.statusCode).toBe(200);
    expect(await bucket('MANAGER_APPROVAL')).toBe(approvalBucket);
    expect((await gated(client, { managerPin: manager.pin })).statusCode).toBe(429);

    // A cleared jar and a replaced rpos_cid are other browsers to the server.
    const fresh = await signedIn(otherManager);
    const freshRes = await gated(fresh, { managerPin: manager.pin });
    expect(freshRes.statusCode).toBe(429);
    expect((freshRes.json() as Body).error.code).toBe('APPROVAL_THROTTLED');
    const replaced = new JarClient(app);
    replaced.plant('rpos_cid', '/', randomUUID());
    expect((await replaced.signInPos(cashier.pin)).statusCode).toBe(200);
    expect((await gated(replaced, { managerPin: manager.pin })).statusCode).toBe(429);

    // A rebuilt server reads the same bucket.
    const rebuilt = buildProbeServer();
    await rebuilt.ready();
    try {
      const other = await signedIn(cashier, rebuilt);
      expect((await gated(other, { managerPin: manager.pin })).statusCode).toBe(429);
    } finally {
      await rebuilt.close();
    }
    expect(await bucket('MANAGER_APPROVAL')).toBe(approvalBucket);
    expect(await probeRows()).toEqual([]);

    await ageOutPinCooldown('MANAGER_APPROVAL');
    const ok = await gated(client, { managerPin: manager.pin });
    expect(ok.statusCode).toBe(200);
  });

  it('9. a work that throws: 500 INTERNAL, nothing of the error in the body or the log, no entry', async () => {
    const client = await signedIn(cashier);
    const res = await gated(client, { managerPin: manager.pin }, PROBE_THROWS);
    expect(res.statusCode).toBe(500);
    expect(res.body).toBe('{"error":{"code":"INTERNAL"}}');
    expect(await entriesOf(cashier.id)).toEqual([]);
    expect(res.body).not.toContain('MARK-WORK-ERROR-6641');
    expect(lines.join('\n')).not.toContain('MARK-WORK-ERROR-6641');
  });

  it('10. B-14 at the wire: straight after an approved request, the same request without the PIN is 400', async () => {
    const client = await signedIn(cashier);
    expect((await gated(client, { managerPin: manager.pin })).statusCode).toBe(200);
    expect(await probeRows()).toEqual([manager.id]);

    const res = await gated(client, {});
    expect(res.statusCode).toBe(400);
    expect(res.body).toBe(VALIDATION);
    const wrong = await client.request({ method: 'POST', url: PROBE });
    expect(wrong.statusCode).toBe(400);
    expect(await probeRows()).toEqual([manager.id]);
    expect((await entriesOf(cashier.id)).map((e) => e.outcome)).toEqual(['SUCCESS']);
  });

  it('11. a marker PIN appears in no log line at trace, no response body and neither evidence table', async () => {
    expect(leaks(`{"reason":"${UNKNOWN_PIN}"}`, UNKNOWN_PIN)).toBe(true);
    expect(leaks('2026-10-12 11:22:33.737373+00', UNKNOWN_PIN)).toBe(false);

    const MALFORMED = 'MARK-PIN-LETTERS-5520';
    const pins = [UNKNOWN_PIN, cashier.pin, manager.pin, otherManager.pin, MALFORMED];
    const bodies: string[] = [];
    const client = await signedIn(cashier);
    for (const payload of [
      { managerPin: UNKNOWN_PIN },
      { managerPin: MALFORMED },
      { managerPin: cashier.pin },
      { managerPin: manager.pin },
      { managerPin: otherManager.pin, actorId: 'MARK-EXTRA-KEY-9013' },
    ]) {
      bodies.push((await gated(client, payload)).body);
    }
    await failMany(client, MAX_FAILURES);
    bodies.push((await gated(client, { managerPin: manager.pin })).body);
    bodies.push((await gated(client, { managerPin: manager.pin }, PROBE_THROWS)).body);

    const audit = (
      await ownerQuery<{ r: string }>('SELECT to_jsonb(audit_entry)::text AS r FROM audit_entry')
    ).map((r) => r.r);
    const events = (await wholeSecurityLog()).split('\n');
    expect(audit.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    expect(lines.length).toBeGreaterThan(0);

    for (const pin of pins) {
      for (const text of [...audit, ...events, ...bodies, ...lines]) {
        expect(leaks(text, pin), `${pin} in ${text.slice(0, 80)}`).toBe(false);
      }
    }
    for (const text of [...audit, ...events, ...bodies, ...lines]) {
      expect(text).not.toContain('MARK-EXTRA-KEY-9013');
    }
  });
});

// Every route a server registers with its declaration, read from the event the
// startup checks read.
async function declared(apiRoutes: FastifyPluginAsync[]) {
  const server = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent', apiRoutes });
  const routes: { method: string; url: string; access: RouteAccess | undefined }[] = [];
  server.addHook('onRoute', (options) => {
    routes.push({
      method: String(options.method),
      url: options.url,
      access: options.config?.access as RouteAccess | undefined,
    });
  });
  await server.ready();
  await server.close();
  return routes.filter((r) => r.method !== 'HEAD');
}

function openList(routes: Awaited<ReturnType<typeof declared>>): string[] {
  return routes
    .filter((r) => r.access?.session !== 'ACTIVE')
    .map((r) => `${r.method} ${r.url} ${JSON.stringify(r.access)}`)
    .sort();
}

describe('12. the probe adds no production surface', () => {
  const SRC_HTTP = fileURLToPath(new URL('../src/http', import.meta.url));

  // The list access.test.ts case 7 holds, read from its source so there is one list.
  function accessTestList(): string[] {
    const text = readFileSync(fileURLToPath(new URL('./access.test.ts', import.meta.url)), 'utf8');
    const found = [...text.matchAll(/'((?:GET|POST) \/api\/[^' ]+ \{"session":[^']*\})'/g)].map((m) => m[1]!);
    return found.sort();
  }

  it('the tripwire list is unchanged with and without the probe, and the probe is the only addition', async () => {
    const listed = accessTestList();
    expect(listed).toHaveLength(6);

    const without = await declared([]);
    const withProbe = await declared([probe]);
    expect(openList(without)).toEqual(listed);
    expect(openList(withProbe)).toEqual(listed);

    const known = new Set(without.map((r) => `${r.method} ${r.url}`));
    expect(without.filter((r) => /approval/.test(r.url))).toEqual([]);
    const added = withProbe.filter((r) => !known.has(`${r.method} ${r.url}`));
    expect(added.map((r) => `${r.method} ${r.url}`).sort()).toEqual([`POST ${PROBE}`, `POST ${PROBE_THROWS}`].sort());
    for (const route of added) expect(route.access).toEqual(probeAccess);
  });

  it('buildServer and the shipped routes do not import the approval adapter', () => {
    const server = readFileSync(`${SRC_HTTP}/server.ts`, 'utf8');
    expect(server).not.toMatch(/approval/i);
    for (const file of ['routes/pos-auth.ts', 'routes/back-office-auth.ts', 'routes/health.ts']) {
      expect(readFileSync(`${SRC_HTTP}/${file}`, 'utf8'), file).not.toMatch(/approval/i);
    }
  });
});

describe('telemetry through the route', () => {
  it('4b. a failed approval writes a security event only on the failure that starts the cooldown', async () => {
    const client = await signedIn(cashier);
    const before = (await securityEvents()).length;
    await failMany(client, MAX_FAILURES - 1);
    expect(await securityEvents()).toHaveLength(before);
    await failMany(client, 1);
    const after = await securityEvents();
    expect(after).toHaveLength(before + 1);
    expect(after.at(-1)).toMatchObject({ event_type: 'COOLDOWN_STARTED', throttle_class: 'MANAGER_APPROVAL' });
  });
});
