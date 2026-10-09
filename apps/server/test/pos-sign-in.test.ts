import { randomBytes, randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool } from '../src/db/pool.js';
import { COOLDOWN_MINUTES, MAX_FAILURES, verifyPinThrottled } from '../src/domain/throttle.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import {
  ageOutPinCooldown,
  auditCount,
  bucket,
  makePeople,
  securityEvents,
  sessionCount,
  sessionIdOfUser,
  sessionRow,
  setCookiesNamed,
  wholeSecurityLog,
} from './support/people.js';
import type { Person } from './support/people.js';
import { TEST_ORIGIN, inject } from './support/request.js';

const people = makePeople(610000);
const WRONG_PIN = '000001';
const LOGIN = '/api/pos/auth/login';
const INVALID = '{"error":{"code":"INVALID_CREDENTIALS"}}';
const VALIDATION = '{"error":{"code":"VALIDATION_FAILED"}}';
const UNAUTHENTICATED = '{"error":{"code":"UNAUTHENTICATED"}}';
const MAX_RETRY_SECONDS = COOLDOWN_MINUTES * 60;

let app: FastifyInstance;
let lines: string[] = [];

function buildLoggingServer(): FastifyInstance {
  const logStream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      done();
    },
  });
  return buildServer({ origin: TEST_ORIGIN, logLevel: 'trace', logStream });
}

beforeAll(async () => {
  await resetDatabase();
  app = buildLoggingServer();
  await app.ready();
});

beforeEach(async () => {
  await ownerQuery('UPDATE pin_throttle_bucket SET consecutive_failures = 0, blocked_until = NULL');
});

afterAll(async () => {
  await app.close();
  await closePool();
});

function wrongPins(client: JarClient, times: number) {
  return Promise.all(Array.from({ length: times }, () => client.signInPos(WRONG_PIN)));
}

async function failFiveTimes(client: JarClient) {
  let last;
  for (let i = 0; i < MAX_FAILURES; i += 1) last = await client.signInPos(WRONG_PIN);
  return last!;
}

describe('the POS sign-in', () => {
  it('1. a correct PIN: 200 SessionView, the exact cookie, and a row for the user and the client instance', async () => {
    const cashier = await people.cashier();
    const client = new JarClient(app);
    const res = await client.signInPos(cashier.pin);
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['csrfToken', 'name', 'role', 'staffUserId']);
    expect(body.staffUserId).toBe(cashier.id);
    expect(body.name).toBe(cashier.name);
    expect(body.role).toBe('CASHIER');
    expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const cookies = setCookiesNamed(res, 'rpos_pos_sid');
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(
      /^rpos_pos_sid=[A-Za-z0-9_-]{43}; Path=\/api\/pos; HttpOnly; Secure; SameSite=Strict$/
    );
    expect(cookies[0]).not.toMatch(/Max-Age|Expires|Domain/i);

    const [sessionId] = await sessionIdOfUser(cashier.id, 'POS');
    const row = await sessionRow(sessionId!);
    expect(row.audience).toBe('POS');
    expect(row.credential_version).toBe(cashier.credentialVersion);
    expect(row.absolute_expires_at).toBeNull();
    expect(row.client_instance_id).toBe(client.valueOf('rpos_cid'));
    expect(row.client_instance_id).not.toBeNull();

    // The session works with what the response gave.
    const me = await client.get('/api/pos/auth/me');
    expect(me.statusCode).toBe(200);
    expect((me.json() as { csrfToken: string }).csrfToken).toBe(body.csrfToken);
  });

  it('2. a wrong PIN: 401 INVALID_CREDENTIALS, no details, no cookie, one PIN_FAILURE, no audit entry', async () => {
    await people.cashier();
    const audits = await auditCount();
    const events = (await securityEvents()).length;
    const client = new JarClient(app);
    const res = await client.signInPos(WRONG_PIN);
    expect(res.statusCode).toBe(401);
    expect(res.body).toBe(INVALID);
    expect(setCookiesNamed(res, 'rpos_pos_sid')).toEqual([]);
    expect(res.body).not.toContain(WRONG_PIN);

    const after = await securityEvents();
    expect(after).toHaveLength(events + 1);
    expect(after.at(-1)).toMatchObject({ event_type: 'PIN_FAILURE', throttle_class: 'LOGIN' });
    expect(await auditCount()).toBe(audits);
  });

  it('3. a deactivated user\'s PIN is answered as a wrong PIN is', async () => {
    const gone = await people.cashier();
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [gone.id]);
    const client = new JarClient(app);
    const wrong = await client.signInPos(WRONG_PIN);
    const deactivated = await client.signInPos(gone.pin);
    expect(deactivated.statusCode).toBe(wrong.statusCode);
    expect(deactivated.body).toBe(wrong.body);
    expect(deactivated.body).toBe(INVALID);
    expect(setCookiesNamed(deactivated, 'rpos_pos_sid')).toEqual([]);
  });

  describe('4. a PIN that is not six ASCII digits never reaches the throttle', () => {
    const MARK = 'MARK-PIN-LETTERS-4410';
    const cases: [string, unknown][] = [
      ['five digits', '12345'],
      ['seven digits', '1234567'],
      ['letters', MARK],
      ['the number 123456', 123456],
      ['null', null],
      ['an object', { pin: '123456' }],
      ['a trailing newline', '123456\n'],
      ['full-width digits', '１２３４５６'],
      ['an Arabic-Indic digit', '12345٦'],
    ];

    it.each(cases)('%s is 400 VALIDATION_FAILED and counts nowhere', async (_name, pin) => {
      await people.cashier();
      const before = [await bucket('LOGIN'), await bucket('MANAGER_APPROVAL'), await wholeSecurityLog()];
      const client = new JarClient(app);
      const res = await client.signInPos(pin);
      expect(res.statusCode).toBe(400);
      expect(res.body).toBe(VALIDATION);
      expect(setCookiesNamed(res, 'rpos_pos_sid')).toEqual([]);
      expect([await bucket('LOGIN'), await bucket('MANAGER_APPROVAL'), await wholeSecurityLog()]).toEqual(before);
      expect(lines.join('\n')).not.toContain(MARK);
    });

    it('a missing field and an extra key are 400 too', async () => {
      const cashier = await people.cashier();
      const before = [await bucket('LOGIN'), await wholeSecurityLog()];
      for (const payload of [{}, { pin: cashier.pin, username: 'MARK-EXTRA-KEY-8830' }, { pin: cashier.pin, extra: 1 }]) {
        const res = await inject(app, { method: 'POST', url: LOGIN, payload });
        expect(res.statusCode).toBe(400);
        expect(res.body).toBe(VALIDATION);
      }
      expect([await bucket('LOGIN'), await wholeSecurityLog()]).toEqual(before);
      expect(lines.join('\n')).not.toContain('MARK-EXTRA-KEY-8830');
    });
  });

  it('5. AC-19: five wrong PINs, the cooldown, a correct PIN refused through every identity, then signed in', async () => {
    const cashier = await people.cashier();
    const approvalBefore = await bucket('MANAGER_APPROVAL');
    const client = new JarClient(app);
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) {
      const res = await client.signInPos(WRONG_PIN);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(INVALID);
    }
    const fifth = await client.signInPos(WRONG_PIN);
    expect(fifth.statusCode).toBe(401);
    // Case 28: the whole body, with no other key at any level.
    const fifthBody = fifth.json() as { error: { code: string; details: { retryAfterSeconds: number } } };
    expect(Object.keys(fifthBody)).toEqual(['error']);
    expect(Object.keys(fifthBody.error).sort()).toEqual(['code', 'details']);
    expect(fifthBody.error.code).toBe('INVALID_CREDENTIALS');
    expect(Object.keys(fifthBody.error.details)).toEqual(['retryAfterSeconds']);
    expect(Number.isInteger(fifthBody.error.details.retryAfterSeconds)).toBe(true);
    expect(fifthBody.error.details.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(fifthBody.error.details.retryAfterSeconds).toBeLessThanOrEqual(MAX_RETRY_SECONDS);

    const sessionsBefore = await sessionCount();
    const refused = async (who: JarClient, headers?: Record<string, string>) => {
      const res = await who.request({
        method: 'POST',
        url: LOGIN,
        payload: { pin: cashier.pin },
        ...(headers ? { headers } : {}),
      });
      expect(res.statusCode).toBe(429);
      const body = res.json() as { error: { code: string; details: { retryAfterSeconds: number } } };
      expect(Object.keys(body)).toEqual(['error']);
      expect(Object.keys(body.error).sort()).toEqual(['code', 'details']);
      expect(body.error.code).toBe('THROTTLED');
      expect(Object.keys(body.error.details)).toEqual(['retryAfterSeconds']);
      expect(body.error.details.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(body.error.details.retryAfterSeconds).toBeLessThanOrEqual(MAX_RETRY_SECONDS);
      expect(setCookiesNamed(res, 'rpos_pos_sid')).toEqual([]);
    };
    await refused(client);
    // No rpos_cid, a fresh jar, a cleared one and a replaced one change nothing.
    await refused(new JarClient(app), { cookie: '' });
    await refused(new JarClient(app));
    await refused(new JarClient(app), { cookie: `rpos_cid=${randomUUID()}` });
    expect(await sessionCount()).toBe(sessionsBefore);
    expect(await bucket('MANAGER_APPROVAL')).toBe(approvalBefore);

    // A rebuilt server reads the same bucket.
    const rebuilt = buildLoggingServer();
    await rebuilt.ready();
    try {
      await refused(new JarClient(rebuilt));
    } finally {
      await rebuilt.close();
    }

    await ageOutPinCooldown('LOGIN');
    const ok = await client.signInPos(cashier.pin);
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { staffUserId: string }).staffUserId).toBe(cashier.id);
  });

  it('6. AC-19: failures planted in MANAGER_APPROVAL survive a successful sign-in', async () => {
    const manager = await people.manager();
    const cashier = await people.cashier();
    for (let i = 0; i < MAX_FAILURES - 2; i += 1) {
      expect((await verifyPinThrottled('MANAGER_APPROVAL', cashier.pin)).outcome).toBe('FAILED');
    }
    const planted = await bucket('MANAGER_APPROVAL');
    expect(planted).toContain(`"consecutive_failures": ${MAX_FAILURES - 2}`);
    const res = await new JarClient(app).signInPos(manager.pin);
    expect(res.statusCode).toBe(200);
    expect(await bucket('MANAGER_APPROVAL')).toBe(planted);
  });

  it('7. a malformed PIN during a cooldown is 400, not 429', async () => {
    await people.cashier();
    const client = new JarClient(app);
    await failFiveTimes(client);
    expect((await client.signInPos(WRONG_PIN)).statusCode).toBe(429);
    const malformed = await client.signInPos('12345');
    expect(malformed.statusCode).toBe(400);
    expect(malformed.body).toBe(VALIDATION);
  });

  describe('8. a sign-in when the browser already holds a session', () => {
    async function signedIn(person: Person) {
      const client = new JarClient(app);
      expect((await client.signInPos(person.pin)).statusCode).toBe(200);
      const [id] = await sessionIdOfUser(person.id, 'POS');
      return { client, oldToken: client.valueOf('rpos_pos_sid')!, oldId: id! };
    }

    it('on success the old row is released, the token is new, and the old token is UNAUTHENTICATED', async () => {
      const first = await people.cashier();
      const second = await people.cashier();
      const { client, oldToken, oldId } = await signedIn(first);

      const res = await client.signInPos(second.pin);
      expect(res.statusCode).toBe(200);
      expect((await sessionRow(oldId)).released_at).not.toBeNull();
      const newToken = client.valueOf('rpos_pos_sid')!;
      expect(newToken).not.toBe(oldToken);

      const stranger = new JarClient(app);
      stranger.plant('rpos_pos_sid', '/api/pos', oldToken);
      const old = await stranger.get('/api/pos/auth/me');
      expect(old.statusCode).toBe(401);
      expect(old.body).toBe(UNAUTHENTICATED);
      const now = await client.get('/api/pos/auth/me');
      expect((now.json() as { staffUserId: string }).staffUserId).toBe(second.id);
    });

    it('on failure, and when throttled, the old session is still active and the cookie unchanged', async () => {
      const first = await people.cashier();
      const { client, oldToken, oldId } = await signedIn(first);

      const wrong = await client.signInPos(WRONG_PIN);
      expect(wrong.statusCode).toBe(401);
      expect(setCookiesNamed(wrong, 'rpos_pos_sid')).toEqual([]);
      expect((await sessionRow(oldId)).released_at).toBeNull();
      expect(client.valueOf('rpos_pos_sid')).toBe(oldToken);
      expect((await client.get('/api/pos/auth/me')).statusCode).toBe(200);

      await failFiveTimes(client);
      const throttled = await client.signInPos(first.pin);
      expect(throttled.statusCode).toBe(429);
      expect((await sessionRow(oldId)).released_at).toBeNull();
      expect(client.valueOf('rpos_pos_sid')).toBe(oldToken);
      expect((await client.get('/api/pos/auth/me')).statusCode).toBe(200);
    });
  });

  it('9. a cookie the server never issued is not adopted', async () => {
    const cashier = await people.cashier();
    const planted = randomBytes(32).toString('base64url');
    const res = await inject(app, {
      method: 'POST',
      url: LOGIN,
      payload: { pin: cashier.pin },
      headers: { cookie: `rpos_pos_sid=${planted}` },
    });
    expect(res.statusCode).toBe(200);
    const issued = /^rpos_pos_sid=([^;]+)/.exec(setCookiesNamed(res, 'rpos_pos_sid')[0] ?? '')![1]!;
    expect(issued).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued).not.toBe(planted);

    const stranger = new JarClient(app);
    stranger.plant('rpos_pos_sid', '/api/pos', planted);
    expect((await stranger.get('/api/pos/auth/me')).statusCode).toBe(401);
  });

  it('10. a cross-site Origin, a form body, a text body and a PIN in the query string', async () => {
    const cashier = await people.cashier();
    const before = [await bucket('LOGIN'), await wholeSecurityLog()];
    const sessionsBefore = await sessionCount();

    const origin = await inject(app, {
      method: 'POST',
      url: LOGIN,
      payload: { pin: WRONG_PIN },
      headers: { origin: 'https://evil.example' },
    });
    expect(origin.statusCode).toBe(403);
    expect(origin.body).toBe('{"error":{"code":"ORIGIN_REFUSED"}}');

    for (const [type, payload] of [
      ['application/x-www-form-urlencoded', `pin=${cashier.pin}`],
      ['text/plain', `pin=${cashier.pin}`],
    ] as const) {
      const res = await inject(app, { method: 'POST', url: LOGIN, payload, headers: { 'content-type': type } });
      expect(res.statusCode, type).toBe(415);
      expect(res.body, type).toBe('{"error":{"code":"UNSUPPORTED_MEDIA_TYPE"}}');
    }

    const query = await inject(app, { method: 'POST', url: `${LOGIN}?pin=MARK-PIN-QUERY-9921` });
    expect(query.statusCode).toBe(400);
    expect(query.body).toBe(VALIDATION);

    expect([await bucket('LOGIN'), await wholeSecurityLog()]).toEqual(before);
    expect(await sessionCount()).toBe(sessionsBefore);
    expect(lines.join('\n')).not.toContain('MARK-PIN-QUERY-9921');
  });

  it('11. ten wrong PINs sent together count as the domain says and never as more than were sent', async () => {
    await people.cashier();
    const sent = 10;
    const eventsBefore = (await securityEvents()).filter((e) => e.event_type === 'PIN_FAILURE').length;
    const results = await wrongPins(new JarClient(app), sent);
    const counts = new Map<number, number>();
    for (const res of results) counts.set(res.statusCode, (counts.get(res.statusCode) ?? 0) + 1);
    // The lock queues them: MAX_FAILURES are counted, the rest meet the cooldown.
    expect(counts.get(401)).toBe(MAX_FAILURES);
    expect(counts.get(429)).toBe(sent - MAX_FAILURES);
    const failures = (await securityEvents()).filter((e) => e.event_type === 'PIN_FAILURE');
    expect(failures.length - eventsBefore).toBe(MAX_FAILURES);
    expect((await bucket('LOGIN'))).toContain(`"consecutive_failures": ${MAX_FAILURES}`);
    // Exactly one response named a cooldown as just begun.
    expect(results.filter((r) => r.statusCode === 401 && r.body !== INVALID)).toHaveLength(1);
  });
});
