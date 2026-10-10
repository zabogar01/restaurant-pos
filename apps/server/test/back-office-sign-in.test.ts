import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool } from '../src/db/pool.js';
import {
  PASSWORD_COOLDOWN_MINUTES,
  PASSWORD_MAX_FAILURES,
  createBackOfficeCredential,
} from '../src/domain/back-office-credential.js';
import { createStaffUser } from '../src/domain/pin.js';
import { SESSION_POLICY } from '../src/domain/session.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import {
  ageOutPasswordCooldown,
  ageSession,
  bucket,
  credentialCount,
  makePeople,
  securityEvents,
  sessionIdOfUser,
  sessionRow,
  setCookiesNamed,
  wholeSecurityLog,
} from './support/people.js';
import { TEST_ORIGIN } from './support/request.js';

const people = makePeople(620000);
const WRONG = 'definitely not the password';
const INVALID = '{"error":{"code":"INVALID_CREDENTIALS"}}';
const VALIDATION = '{"error":{"code":"VALIDATION_FAILED"}}';
const MAX_RETRY_SECONDS = PASSWORD_COOLDOWN_MINUTES * 60;

let app: FastifyInstance;

beforeAll(async () => {
  await resetDatabase();
  app = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent' });
  await app.ready();
});

beforeEach(async () => {
  await ownerQuery('UPDATE pin_throttle_bucket SET consecutive_failures = 0, blocked_until = NULL');
});

afterAll(async () => {
  await app.close();
  await closePool();
});

async function passwordFailures(): Promise<number> {
  return (await securityEvents()).filter((e) => e.event_type === 'PASSWORD_FAILURE').length;
}

describe('the back-office sign-in', () => {
  it('12. a correct username and password: 200, the back-office cookie, eight hours', async () => {
    const manager = await people.manager();
    const client = new JarClient(app);
    const res = await client.signInBackOffice(manager.username, manager.password);
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['csrfToken', 'name', 'role', 'staffUserId', 'username']);
    expect(body.staffUserId).toBe(manager.id);
    expect(body.name).toBe(manager.name);
    expect(body.username).toBe(manager.username);
    expect(body.role).toBe('MANAGER');
    expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const cookies = setCookiesNamed(res, 'rpos_bo_sid');
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(
      /^rpos_bo_sid=[A-Za-z0-9_-]{43}; Path=\/api\/back-office; HttpOnly; Secure; SameSite=Strict$/
    );
    expect(setCookiesNamed(res, 'rpos_pos_sid')).toEqual([]);

    const [sessionId] = await sessionIdOfUser(manager.id, 'BACK_OFFICE');
    const row = await sessionRow(sessionId!);
    expect(row.audience).toBe('BACK_OFFICE');
    expect(row.credential_version).toBe(manager.credentialVersion);
    expect(row.client_instance_id).toBe(client.valueOf('rpos_cid'));
    const [span] = await ownerQuery<{ seconds: number }>(
      'SELECT extract(epoch FROM absolute_expires_at - issued_at)::int AS seconds FROM actor_session WHERE id = $1',
      [sessionId]
    );
    expect(span!.seconds).toBe(SESSION_POLICY.BACK_OFFICE.absoluteSeconds);

    const me = await client.get('/api/back-office/auth/me');
    expect(me.statusCode).toBe(200);
    expect((me.json() as { username: string }).username).toBe(manager.username);
  });

  it('13. AC-35: four kinds of failure give four identical responses, each counted once and naming no username', async () => {
    const wrongPassword = await people.manager();
    const deactivated = await people.manager();
    const demoted = await people.manager();
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [deactivated.id]);
    await ownerQuery("UPDATE staff_user SET role = 'CASHIER' WHERE id = $1", [demoted.id]);

    const attempts: [string, string, string][] = [
      ['an unknown username', 'nobody-by-this-name', 'a password nobody has'],
      ['a wrong password', wrongPassword.username!, WRONG],
      ['a deactivated manager with the right password', deactivated.username!, deactivated.password!],
      ['a demoted manager with the right password', demoted.username!, demoted.password!],
    ];
    const responses: { status: number; body: string }[] = [];
    for (const [name, username, password] of attempts) {
      const before = await passwordFailures();
      const client = new JarClient(app);
      const res = await client.signInBackOffice(username, password);
      responses.push({ status: res.statusCode, body: res.body });
      expect(setCookiesNamed(res, 'rpos_bo_sid'), name).toEqual([]);
      expect(await passwordFailures(), name).toBe(before + 1);
    }
    expect(new Set(responses.map((r) => r.status))).toEqual(new Set([401]));
    expect(new Set(responses.map((r) => r.body))).toEqual(new Set([INVALID]));

    const log = await wholeSecurityLog();
    for (const [, username] of attempts) expect(log).not.toContain(username);
    const failures = (await securityEvents()).filter((e) => e.event_type === 'PASSWORD_FAILURE');
    for (const event of failures) expect(event.throttle_class).toBe('BACK_OFFICE_LOGIN');
  });

  it('14. AC-35: a PIN is refused, and the LOGIN class is not touched by either attempt', async () => {
    const manager = await people.manager();
    const loginBefore = await bucket('LOGIN');
    const client = new JarClient(app);

    const pinBody = await client.request({
      method: 'POST',
      url: '/api/back-office/auth/login',
      payload: { pin: manager.pin },
    });
    expect(pinBody.statusCode).toBe(400);
    expect(pinBody.body).toBe(VALIDATION);

    const pinAsPassword = await client.signInBackOffice(manager.username, manager.pin);
    expect(pinAsPassword.statusCode).toBe(401);
    expect(pinAsPassword.body).toBe(INVALID);
    expect(setCookiesNamed(pinAsPassword, 'rpos_bo_sid')).toEqual([]);

    expect(await bucket('LOGIN')).toBe(loginBefore);
  });

  it('15. AC-35: five wrong passwords, the cooldown, isolation between accounts, an unknown name, a restart', async () => {
    const target = await people.manager();
    const other = await people.manager();
    const client = new JarClient(app);

    for (let i = 0; i < PASSWORD_MAX_FAILURES - 1; i += 1) {
      const res = await client.signInBackOffice(target.username, WRONG);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(INVALID);
    }
    const fifth = await client.signInBackOffice(target.username, WRONG);
    expect(fifth.statusCode).toBe(401);
    // Case 28: the whole body, with no other key at any level.
    const body = fifth.json() as { error: { code: string; details: { retryAfterSeconds: number } } };
    expect(Object.keys(body)).toEqual(['error']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'details']);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
    expect(Object.keys(body.error.details)).toEqual(['retryAfterSeconds']);
    expect(body.error.details.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(body.error.details.retryAfterSeconds).toBeLessThanOrEqual(MAX_RETRY_SECONDS);

    const refused = async (who: JarClient) => {
      const res = await who.signInBackOffice(target.username, target.password);
      expect(res.statusCode).toBe(429);
      const refusal = res.json() as { error: { code: string; details: { retryAfterSeconds: number } } };
      expect(Object.keys(refusal)).toEqual(['error']);
      expect(Object.keys(refusal.error).sort()).toEqual(['code', 'details']);
      expect(refusal.error.code).toBe('THROTTLED');
      expect(Object.keys(refusal.error.details)).toEqual(['retryAfterSeconds']);
      expect(refusal.error.details.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(refusal.error.details.retryAfterSeconds).toBeLessThanOrEqual(MAX_RETRY_SECONDS);
      expect(setCookiesNamed(res, 'rpos_bo_sid')).toEqual([]);
    };
    await refused(client);

    // Another manager signs in.
    expect((await new JarClient(app).signInBackOffice(other.username, other.password)).statusCode).toBe(200);

    // The same person's PIN still signs in at the POS, and does not reset the count.
    const countBefore = await credentialCount(target.id);
    expect((await new JarClient(app).signInPos(target.pin)).statusCode).toBe(200);
    expect(await credentialCount(target.id)).toBe(countBefore);
    await refused(client);

    // A name that does not exist is never blocked.
    for (let i = 0; i < PASSWORD_MAX_FAILURES * 2; i += 1) {
      const res = await client.signInBackOffice('no-such-manager', WRONG);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(INVALID);
    }

    // A rebuilt server reads the same row.
    const rebuilt = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent' });
    await rebuilt.ready();
    try {
      await refused(new JarClient(rebuilt));
    } finally {
      await rebuilt.close();
    }

    await ageOutPasswordCooldown(target.id);
    expect((await client.signInBackOffice(target.username, target.password)).statusCode).toBe(200);
  });

  it('16. a padded, mixed-case username signs in as the stored one; the wrong shapes are 400', async () => {
    const { id } = await createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '629999' });
    await createBackOfficeCredential({ staffUserId: id, username: 'budi', password: 'budi has a password' });
    const client = new JarClient(app);
    const res = await client.signInBackOffice(' Budi ', 'budi has a password');
    expect(res.statusCode).toBe(200);
    expect((res.json() as { username: string }).username).toBe('budi');

    const shapes: [string, unknown, unknown][] = [
      ['a non-string username', 123, 'budi has a password'],
      ['a non-string password', 'budi', { password: 'x' }],
      ['an empty username', '', 'budi has a password'],
      ['an empty password', 'budi', ''],
      ['an over-long username', 'b'.repeat(257), 'budi has a password'],
      ['an over-long password', 'budi', 'p'.repeat(1025)],
    ];
    const countBefore = await credentialCount(id);
    const eventsBefore = await passwordFailures();
    for (const [name, username, password] of shapes) {
      const bad = await new JarClient(app).signInBackOffice(username, password);
      expect(bad.statusCode, name).toBe(400);
      expect(bad.body, name).toBe(VALIDATION);
    }
    expect(await credentialCount(id)).toBe(countBefore);
    expect(await passwordFailures()).toBe(eventsBefore);
  });

  describe('17. a sign-in while the jar holds another manager\'s idle session', () => {
    it('on success the idle session is released', async () => {
      const a = await people.manager();
      const b = await people.manager();
      const client = new JarClient(app);
      expect((await client.signInBackOffice(a.username, a.password)).statusCode).toBe(200);
      const [aSession] = await sessionIdOfUser(a.id, 'BACK_OFFICE');
      await ageSession(aSession!, SESSION_POLICY.BACK_OFFICE.idleSeconds + 60);

      expect((await client.signInBackOffice(b.username, b.password)).statusCode).toBe(200);
      expect((await sessionRow(aSession!)).released_at).not.toBeNull();
      expect(((await client.get('/api/back-office/auth/me')).json() as { staffUserId: string }).staffUserId).toBe(b.id);
    });

    it('on failure the idle session is still renewable', async () => {
      const a = await people.manager();
      const b = await people.manager();
      const client = new JarClient(app);
      expect((await client.signInBackOffice(a.username, a.password)).statusCode).toBe(200);
      const [aSession] = await sessionIdOfUser(a.id, 'BACK_OFFICE');
      await ageSession(aSession!, SESSION_POLICY.BACK_OFFICE.idleSeconds + 60);

      const failed = await client.signInBackOffice(b.username, WRONG);
      expect(failed.statusCode).toBe(401);
      expect((await sessionRow(aSession!)).released_at).toBeNull();
      const renewed = await client.reauthenticate(a.password);
      expect(renewed.statusCode).toBe(200);
      expect((renewed.json() as { staffUserId: string }).staffUserId).toBe(a.id);
    });
  });
});
