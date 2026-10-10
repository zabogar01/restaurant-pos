import { createHmac, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool, getPool } from '../src/db/pool.js';
import {
  PASSWORD_COOLDOWN_MINUTES,
  PASSWORD_MAX_FAILURES,
} from '../src/domain/back-office-credential.js';
import { SESSION_POLICY, releaseSession } from '../src/domain/session.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import {
  ageOutPasswordCooldown,
  ageSession,
  credentialCount,
  failuresOf,
  makePeople,
  sessionCount,
  sessionIdOfUser,
  sessionRow,
  setCookiesNamed,
  wholeSecurityLog,
  wholeSessionTable,
} from './support/people.js';
import type { Person } from './support/people.js';
import { TEST_ORIGIN, inject } from './support/request.js';

const people = makePeople(630000);
const WRONG = 'definitely not the password';
const REAUTH = '/api/back-office/auth/reauthenticate';
const INVALID = '{"error":{"code":"INVALID_CREDENTIALS"}}';
const UNAUTHENTICATED = '{"error":{"code":"UNAUTHENTICATED"}}';
const SESSION_IDLE = '{"error":{"code":"SESSION_IDLE"}}';
const CSRF_REFUSED = '{"error":{"code":"CSRF_REFUSED"}}';
const VALIDATION = '{"error":{"code":"VALIDATION_FAILED"}}';
const MAX_RETRY_SECONDS = PASSWORD_COOLDOWN_MINUTES * 60;

let app: FastifyInstance;

beforeAll(async () => {
  await resetDatabase();
  app = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

// Independent of the production derivation (ARCH-012 section 3).
function csrfOf(token: string): string {
  return createHmac('sha256', token).update('rpos-csrf-v1').digest('base64url');
}

async function signedIn(manager?: Person) {
  const who = manager ?? (await people.manager());
  const client = new JarClient(app);
  const res = await client.signInBackOffice(who.username, who.password);
  expect(res.statusCode).toBe(200);
  const [sessionId] = await sessionIdOfUser(who.id, 'BACK_OFFICE');
  return {
    who,
    client,
    sessionId: sessionId!,
    token: client.valueOf('rpos_bo_sid')!,
    csrf: (res.json() as { csrfToken: string }).csrfToken,
  };
}

async function idle(sessionId: string) {
  await ageSession(sessionId, SESSION_POLICY.BACK_OFFICE.idleSeconds + 60);
}

// What a request the server must not act on leaves behind.
async function footprint(staffUserId: string) {
  return [await credentialCount(staffUserId), await wholeSecurityLog(), await wholeSessionTable()];
}

function rawReauth(token: string | undefined, csrf: string | undefined, payload: unknown) {
  return inject(app, {
    method: 'POST',
    url: REAUTH,
    payload: payload as object,
    headers: {
      ...(token === undefined ? {} : { cookie: `rpos_bo_sid=${token}` }),
      ...(csrf === undefined ? {} : { 'x-rpos-csrf': csrf }),
    },
  });
}

describe('M-6: re-authentication', () => {
  it('18. AC-35: an idle session, the right password: the same session under a new token', async () => {
    const { who, client, sessionId, token, csrf } = await signedIn();
    const before = await sessionRow(sessionId);
    await idle(sessionId);
    expect((await client.get('/api/back-office/auth/me')).body).toBe(SESSION_IDLE);

    const res = await client.reauthenticate(who.password);
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['csrfToken', 'name', 'role', 'staffUserId', 'username']);
    expect(body.staffUserId).toBe(who.id);
    expect(body.username).toBe(who.username);
    expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.csrfToken).not.toBe(csrf);

    const cookies = setCookiesNamed(res, 'rpos_bo_sid');
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(
      /^rpos_bo_sid=[A-Za-z0-9_-]{43}; Path=\/api\/back-office; HttpOnly; Secure; SameSite=Strict$/
    );
    const renewed = client.valueOf('rpos_bo_sid')!;
    expect(renewed).not.toBe(token);

    // The same row: one session for the manager, and its two limits unchanged.
    expect(await sessionIdOfUser(who.id, 'BACK_OFFICE')).toEqual([sessionId]);
    const after = await sessionRow(sessionId);
    expect(after.issued_at).toBe(before.issued_at);
    expect(after.absolute_expires_at).toBe(before.absolute_expires_at);
    expect(after.released_at).toBeNull();

    const stranger = new JarClient(app);
    stranger.plant('rpos_bo_sid', '/api/back-office', token);
    const old = await stranger.get('/api/back-office/auth/me');
    expect(old.statusCode).toBe(401);
    expect(old.body).toBe(UNAUTHENTICATED);

    const me = await client.get('/api/back-office/auth/me');
    expect(me.statusCode).toBe(200);
    expect((me.json() as { csrfToken: string }).csrfToken).toBe(body.csrfToken);
  });

  it('19. a wrong password is 401, counts on the manager\'s row, and leaves the session renewable', async () => {
    const { who, client, sessionId } = await signedIn();
    await idle(sessionId);

    // Failures at Login and at M-6 share one count: all but two at Login, the last
    // two at M-6, the second of which reaches the limit.
    const atLogin = PASSWORD_MAX_FAILURES - 2;
    for (let i = 0; i < atLogin; i += 1) {
      expect((await new JarClient(app).signInBackOffice(who.username, WRONG)).statusCode).toBe(401);
    }
    expect(await failuresOf(who.id)).toBe(atLogin);
    const nextToLast = await client.reauthenticate(WRONG);
    expect(nextToLast.statusCode).toBe(401);
    expect(nextToLast.body).toBe(INVALID);
    expect(await failuresOf(who.id)).toBe(PASSWORD_MAX_FAILURES - 1);
    const last = await client.reauthenticate(WRONG);
    expect(last.statusCode).toBe(401);
    expect(await failuresOf(who.id)).toBe(PASSWORD_MAX_FAILURES);
    const detail = (last.json() as { error: { details: { retryAfterSeconds: number } } }).error.details;
    expect(Object.keys(detail)).toEqual(['retryAfterSeconds']);
    expect(detail.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(detail.retryAfterSeconds).toBeLessThanOrEqual(MAX_RETRY_SECONDS);
    expect(setCookiesNamed(last, 'rpos_bo_sid')).toEqual([]);

    // Still idle, still the same session, and renewable once the cooldown is over.
    expect((await client.get('/api/back-office/auth/me')).body).toBe(SESSION_IDLE);
    expect((await sessionRow(sessionId)).released_at).toBeNull();
    await ageOutPasswordCooldown(who.id);
    const renewed = await client.reauthenticate(who.password);
    expect(renewed.statusCode).toBe(200);
    expect((await client.get('/api/back-office/auth/me')).statusCode).toBe(200);
  });

  it('20. the body cannot name an account: a username is 400, and another manager\'s password is 401', async () => {
    const mine = await signedIn();
    const other = await people.manager();
    await idle(mine.sessionId);
    const before = await footprint(mine.who.id);

    const named = await mine.client.request({
      method: 'POST',
      url: REAUTH,
      payload: { username: other.username, password: other.password },
    });
    expect(named.statusCode).toBe(400);
    expect(named.body).toBe(VALIDATION);
    expect(await footprint(mine.who.id)).toEqual(before);

    const otherCount = await credentialCount(other.id);
    const theirs = await mine.client.reauthenticate(other.password);
    expect(theirs.statusCode).toBe(401);
    expect(theirs.body).toBe(INVALID);
    // Counted on the session's account, never on the one whose password it was.
    expect(await failuresOf(mine.who.id)).toBe(1);
    expect(await credentialCount(other.id)).toBe(otherCount);
    expect((await sessionRow(mine.sessionId)).released_at).toBeNull();
  });

  describe('21. there is nothing to renew: 401 UNAUTHENTICATED, and nothing is verified or counted', () => {
    it('with no cookie', async () => {
      const { who } = await signedIn();
      const before = await footprint(who.id);
      const res = await new JarClient(app).reauthenticate(who.password);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(UNAUTHENTICATED);
      expect(await footprint(who.id)).toEqual(before);
    });

    it('with a released session, the cookie cleared', async () => {
      const { who, client, sessionId, token } = await signedIn();
      await releaseSession(token, 'BACK_OFFICE');
      const before = await footprint(who.id);
      const res = await client.reauthenticate(WRONG);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(UNAUTHENTICATED);
      const cleared = setCookiesNamed(res, 'rpos_bo_sid');
      expect(cleared).toHaveLength(1);
      expect(cleared[0]).toMatch(/^rpos_bo_sid=; Max-Age=0; Path=\/api\/back-office; HttpOnly; Secure; SameSite=Strict$/);
      expect(await footprint(who.id)).toEqual(before);
      expect((await sessionRow(sessionId)).released_at).not.toBeNull();
    });

    it('past the eight hours, the cookie cleared', async () => {
      const { who, client, sessionId } = await signedIn();
      await ownerQuery(
        `UPDATE actor_session
            SET issued_at = clock_timestamp() - make_interval(secs => $2::int),
                absolute_expires_at = clock_timestamp() - interval '1 second',
                last_interactive_at = clock_timestamp() - make_interval(secs => $3::int)
          WHERE id = $1`,
        [
          sessionId,
          SESSION_POLICY.BACK_OFFICE.absoluteSeconds,
          SESSION_POLICY.BACK_OFFICE.idleSeconds + 60,
        ]
      );
      const before = await footprint(who.id);
      const res = await client.reauthenticate(WRONG);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(UNAUTHENTICATED);
      expect(setCookiesNamed(res, 'rpos_bo_sid')).toHaveLength(1);
      expect(client.valueOf('rpos_bo_sid')).toBeUndefined();
      expect(await footprint(who.id)).toEqual(before);
    });

    it('with the cookie name repeated', async () => {
      const { who, token, csrf } = await signedIn();
      const before = await footprint(who.id);
      const res = await inject(app, {
        method: 'POST',
        url: REAUTH,
        payload: { password: WRONG },
        headers: {
          cookie: `rpos_bo_sid=${token}; rpos_bo_sid=${randomBytes(32).toString('base64url')}`,
          'x-rpos-csrf': csrf,
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(UNAUTHENTICATED);
      expect(await footprint(who.id)).toEqual(before);
    });
  });

  it('22. no CSRF token: 403, and nothing verified or counted', async () => {
    const { who, token, sessionId } = await signedIn();
    await idle(sessionId);
    const before = await footprint(who.id);
    for (const csrf of [undefined, '', randomBytes(32).toString('base64url'), token]) {
      const res = await rawReauth(token, csrf, { password: WRONG });
      expect(res.statusCode, String(csrf)).toBe(403);
      expect(res.body, String(csrf)).toBe(CSRF_REFUSED);
    }
    expect(await footprint(who.id)).toEqual(before);
  });

  it('23. an active session is renewed the same way', async () => {
    const { who, client, sessionId, token } = await signedIn();
    const res = await client.reauthenticate(who.password);
    expect(res.statusCode).toBe(200);
    expect(await sessionIdOfUser(who.id, 'BACK_OFFICE')).toEqual([sessionId]);
    expect(client.valueOf('rpos_bo_sid')).not.toBe(token);
    expect((await client.get('/api/back-office/auth/me')).statusCode).toBe(200);

    // A wrong password on an active session is checked too.
    const wrong = await client.reauthenticate(WRONG);
    expect(wrong.statusCode).toBe(401);
    expect(await failuresOf(who.id)).toBe(1);
  });

  it('24. during a cooldown: 429, and the session is untouched', async () => {
    const { who, client, sessionId, token } = await signedIn();
    await idle(sessionId);
    for (let i = 0; i < PASSWORD_MAX_FAILURES; i += 1) {
      expect((await new JarClient(app).signInBackOffice(who.username, WRONG)).statusCode).toBe(401);
    }
    const before = await wholeSessionTable();
    const res = await client.reauthenticate(who.password);
    expect(res.statusCode).toBe(429);
    const body = res.json() as { error: { code: string; details: { retryAfterSeconds: number } } };
    expect(Object.keys(body.error).sort()).toEqual(['code', 'details']);
    expect(body.error.code).toBe('THROTTLED');
    expect(Object.keys(body.error.details)).toEqual(['retryAfterSeconds']);
    expect(body.error.details.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(body.error.details.retryAfterSeconds).toBeLessThanOrEqual(MAX_RETRY_SECONDS);
    expect(setCookiesNamed(res, 'rpos_bo_sid')).toEqual([]);
    expect(client.valueOf('rpos_bo_sid')).toBe(token);
    expect(await wholeSessionTable()).toEqual(before);
  });

  it('25. a credential version raised while idle: 401 UNAUTHENTICATED and no new session', async () => {
    const { who, client, sessionId } = await signedIn();
    await idle(sessionId);
    await ownerQuery(
      'UPDATE staff_user SET credential_version = credential_version + 1 WHERE id = $1',
      [who.id]
    );
    const sessions = await sessionCount();
    const before = await footprint(who.id);
    const res = await client.reauthenticate(who.password);
    expect(res.statusCode).toBe(401);
    expect(res.body).toBe(UNAUTHENTICATED);
    expect(await sessionCount()).toBe(sessions);
    expect(await footprint(who.id)).toEqual(before);
    expect(await sessionIdOfUser(who.id, 'BACK_OFFICE')).toEqual([sessionId]);
  });

  it('25b. a row released between the resolution and the renewal: 401 with the cookie cleared, and no new session', async () => {
    const { who, client, sessionId } = await signedIn();
    await idle(sessionId);
    const pool = getPool();
    const real = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
    // The renewal is the one statement that sets token_hash from $3. The row is
    // released just before it runs, as a logout from another tab would.
    vi.spyOn(pool, 'query').mockImplementation((async (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('token_hash = $3')) {
        await ownerQuery('UPDATE actor_session SET released_at = clock_timestamp() WHERE id = $1', [sessionId]);
      }
      return real(...args);
    }) as never);
    const sessions = await sessionCount();
    const res = await client.reauthenticate(who.password);
    vi.restoreAllMocks();
    expect(res.statusCode).toBe(401);
    expect(res.body).toBe(UNAUTHENTICATED);
    expect(setCookiesNamed(res, 'rpos_bo_sid')).toHaveLength(1);
    expect(client.valueOf('rpos_bo_sid')).toBeUndefined();
    expect(await sessionCount()).toBe(sessions);
  });

  it('26. the POS has no re-authentication', async () => {
    const res = await inject(app, { method: 'POST', url: '/api/pos/auth/reauthenticate', payload: { password: 'x' } });
    expect(res.statusCode).toBe(404);
    expect(res.body).toBe('{"error":{"code":"NOT_FOUND"}}');
  });

  it('csrf is derived from the renewed token, not the old one', async () => {
    const { who, client, token } = await signedIn();
    await client.reauthenticate(who.password);
    const renewed = client.valueOf('rpos_bo_sid')!;
    const res = await rawReauth(renewed, csrfOf(token), { password: who.password });
    expect(res.statusCode).toBe(403);
    const ok = await rawReauth(renewed, csrfOf(renewed), { password: who.password });
    expect(ok.statusCode).toBe(200);
  });
});
