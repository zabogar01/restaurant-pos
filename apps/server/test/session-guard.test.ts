import { createHash, createHmac, randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool, getPool } from '../src/db/pool.js';
import { createBackOfficeCredential } from '../src/domain/back-office-credential.js';
import { createStaffUser, findUserByPin } from '../src/domain/pin.js';
import type { StaffRole } from '../src/domain/pin.js';
import { SESSION_POLICY, createSession, releaseSession } from '../src/domain/session.js';
import type { Audience, VerifiedUser } from '../src/domain/session.js';
import { buildServer } from '../src/http/server.js';
import { actorOf } from '../src/http/session-guard.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import { TEST_ORIGIN, inject } from './support/request.js';

interface Surface {
  audience: Audience;
  cookie: string;
  path: string;
  base: string;
  role: StaffRole;
}

const SURFACES: Surface[] = [
  { audience: 'POS', cookie: 'rpos_pos_sid', path: '/api/pos', base: '/api/pos/auth', role: 'CASHIER' },
  {
    audience: 'BACK_OFFICE',
    cookie: 'rpos_bo_sid',
    path: '/api/back-office',
    base: '/api/back-office/auth',
    role: 'MANAGER',
  },
];
const [POS, BACK_OFFICE] = SURFACES as [Surface, Surface];

const UNAUTHENTICATED = '{"error":{"code":"UNAUTHENTICATED"}}';
const SESSION_IDLE = '{"error":{"code":"SESSION_IDLE"}}';
const FORBIDDEN = '{"error":{"code":"FORBIDDEN"}}';
const CSRF_REFUSED = '{"error":{"code":"CSRF_REFUSED"}}';

let app: FastifyInstance;
let probeRuns = 0;
let counter = 0;

beforeAll(async () => {
  await resetDatabase();
  app = buildServer({
    origin: TEST_ORIGIN,
    logLevel: 'silent',
    apiRoutes: [
      async (api) => {
        for (const surface of SURFACES) {
          api.get(
            `${surface.path.replace('/api', '')}/probe-actor`,
            {
              config: {
                access: { session: 'ACTIVE', audience: surface.audience, interactive: false },
              },
            },
            async (request) => {
              probeRuns += 1;
              return actorOf(request);
            }
          );
        }
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

// ---- fixtures -------------------------------------------------------------

async function makeUser(role: StaffRole): Promise<VerifiedUser> {
  counter += 1;
  const pin = String(300000 + counter);
  const { id } = await createStaffUser({ name: `User ${counter}`, role, pin });
  const found = await findUserByPin(pin);
  if (!found) throw new Error('fixture user not found');
  if (role === 'MANAGER') {
    await createBackOfficeCredential({
      staffUserId: id,
      username: `manager-${counter}`,
      password: `a long password ${counter}`,
    });
  }
  return { id, credentialVersion: found.credentialVersion };
}

async function makeSession(surface: Surface, user?: VerifiedUser) {
  const who = user ?? (await makeUser(surface.role));
  const issued = await createSession({ audience: surface.audience, user: who });
  return { ...issued, user: who };
}

// Independent of the production derivation (ARCH-012 section 3).
function csrfOf(token: string): string {
  return createHmac('sha256', token).update('rpos-csrf-v1').digest('base64url');
}

function unknownToken(): string {
  return randomBytes(32).toString('base64url');
}

async function newClientInstance(): Promise<string> {
  const res = await inject(app, { method: 'GET', url: '/api/pos/auth/me' });
  const line = setCookies(res).find((c) => c.startsWith('rpos_cid='));
  return /^rpos_cid=([^;]+)/.exec(line ?? '')![1]!;
}

type Res = Awaited<ReturnType<typeof inject>>;

function setCookies(res: Res): string[] {
  const header = res.headers['set-cookie'];
  return Array.isArray(header) ? header : header === undefined ? [] : [String(header)];
}

function setCookiesNamed(res: Res, name: string): string[] {
  return setCookies(res).filter((c) => c.startsWith(`${name}=`));
}

function attributesOf(line: string): string[] {
  return line
    .split(';')
    .slice(1)
    .map((part) => part.trim())
    .sort();
}

function expectCleared(res: Res, surface: Surface): void {
  const lines = setCookiesNamed(res, surface.cookie);
  expect(lines).toHaveLength(1);
  expect(lines[0]!.split(';')[0]).toBe(`${surface.cookie}=`);
  expect(attributesOf(lines[0]!)).toEqual(
    ['HttpOnly', 'Max-Age=0', `Path=${surface.path}`, 'SameSite=Strict', 'Secure'].sort()
  );
}

function get(surface: Surface, path: string, token: string | undefined, cid?: string) {
  return inject(app, {
    method: 'GET',
    url: `${surface.base}/${path}`,
    headers: cookieHeaders(surface, token, cid),
  });
}

function post(
  surface: Surface,
  path: string,
  token: string | undefined,
  csrf?: string | string[],
  cid?: string
) {
  return inject(app, {
    method: 'POST',
    url: `${surface.base}/${path}`,
    headers: {
      ...cookieHeaders(surface, token, cid),
      ...(csrf === undefined ? {} : { 'x-rpos-csrf': csrf }),
    },
  });
}

function cookieHeaders(surface: Surface, token: string | undefined, cid?: string) {
  const pairs = [
    ...(token === undefined ? [] : [`${surface.cookie}=${token}`]),
    ...(cid === undefined ? [] : [`rpos_cid=${cid}`]),
  ];
  return pairs.length === 0 ? {} : { cookie: pairs.join('; ') };
}

async function row(sessionId: string): Promise<string> {
  const rows = await ownerQuery<{ row: string }>(
    'SELECT to_jsonb(actor_session)::text AS row FROM actor_session WHERE id = $1',
    [sessionId]
  );
  return rows[0]!.row;
}

async function lastInteractive(sessionId: string): Promise<string> {
  const rows = await ownerQuery<{ at: string }>(
    'SELECT last_interactive_at::text AS at FROM actor_session WHERE id = $1',
    [sessionId]
  );
  return rows[0]!.at;
}

async function releasedAt(sessionId: string): Promise<string | null> {
  const rows = await ownerQuery<{ at: string | null }>(
    'SELECT released_at::text AS at FROM actor_session WHERE id = $1',
    [sessionId]
  );
  return rows[0]!.at;
}

async function age(sessionId: string, seconds: number): Promise<void> {
  await ownerQuery(
    `UPDATE actor_session
        SET last_interactive_at = clock_timestamp() - make_interval(secs => $2::int)
      WHERE id = $1`,
    [sessionId, seconds]
  );
}

// ---- the guard -------------------------------------------------------------

describe('the session guard', () => {
  it.each(SURFACES)('9. an active $audience session on me: 200, the actor is right, a csrfToken is returned', async (surface) => {
    const { token, sessionId, user } = await makeSession(surface);
    const res = await get(surface, 'me', token);
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['csrfToken', 'role', 'staffUserId']);
    expect(body.staffUserId).toBe(user.id);
    expect(body.role).toBe(surface.role);
    expect(typeof body.csrfToken).toBe('string');

    const actor = await inject(app, {
      method: 'GET',
      url: `${surface.path}/probe-actor`,
      headers: cookieHeaders(surface, token),
    });
    expect(actor.json()).toEqual({
      staffUserId: user.id,
      role: surface.role,
      sessionId,
      audience: surface.audience,
    });
  });

  it.each(SURFACES)('10. $audience with no cookie: 401 UNAUTHENTICATED and no session cookie set', async (surface) => {
    const res = await get(surface, 'me', undefined);
    expect(res.statusCode).toBe(401);
    expect(res.body).toBe(UNAUTHENTICATED);
    expect(setCookiesNamed(res, surface.cookie)).toEqual([]);

    // The other surface's cookie under this surface's path is not this surface's.
    const other = SURFACES.find((s) => s !== surface)!;
    const wrongName = await inject(app, {
      method: 'GET',
      url: `${surface.base}/me`,
      headers: { cookie: `${other.cookie}=${unknownToken()}` },
    });
    expect(wrongName.statusCode).toBe(401);
    expect(setCookiesNamed(wrongName, surface.cookie)).toEqual([]);
  });

  describe.each(SURFACES)('11. $audience: a token that can never be accepted', (surface) => {
    const cases: [string, () => Promise<string>][] = [
      ['an unknown well-formed token', async () => unknownToken()],
      ['a malformed value', async () => 'not-a-token!'],
      [
        'a released session',
        async () => {
          const { token } = await makeSession(surface);
          await releaseSession(token, surface.audience);
          return token;
        },
      ],
      [
        'a deactivated user',
        async () => {
          const { token, user } = await makeSession(surface);
          await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [user.id]);
          return token;
        },
      ],
      [
        'a raised credential version',
        async () => {
          const { token, user } = await makeSession(surface);
          await ownerQuery(
            'UPDATE staff_user SET credential_version = credential_version + 1 WHERE id = $1',
            [user.id]
          );
          return token;
        },
      ],
      ...(surface.audience === 'BACK_OFFICE'
        ? ([
            [
              'a session past the absolute limit',
              async () => {
                const { token, sessionId } = await makeSession(surface);
                await ownerQuery(
                  `UPDATE actor_session
                      SET issued_at = clock_timestamp() - make_interval(secs => $2::int),
                          absolute_expires_at = clock_timestamp() - interval '1 second',
                          last_interactive_at = clock_timestamp()
                    WHERE id = $1`,
                  [sessionId, SESSION_POLICY.BACK_OFFICE.absoluteSeconds]
                );
                return token;
              },
            ],
          ] as [string, () => Promise<string>][])
        : []),
    ];

    it.each(cases)('%s is 401 UNAUTHENTICATED with the exact clearing cookie', async (_name, prepare) => {
      const token = await prepare();
      const res = await get(surface, 'me', token);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(UNAUTHENTICATED);
      expectCleared(res, surface);
    });
  });

  it('12. AC-27: a manager\'s token from the other surface is answered as an unknown token is', async () => {
    const manager = await makeUser('MANAGER');
    const pos = await makeSession(POS, manager);
    const office = await makeSession(BACK_OFFICE, manager);
    const cid = await newClientInstance();

    // [the surface asked, the token presented, the session it really belongs to]
    const crossed: [Surface, string, string][] = [
      [BACK_OFFICE, pos.token, pos.sessionId],
      [POS, office.token, office.sessionId],
    ];
    for (const [surface, token, sessionId] of crossed) {
      const before = await row(sessionId);
      const control = await get(surface, 'me', unknownToken(), cid);
      const crossedRes = await get(surface, 'me', token, cid);
      expect(crossedRes.statusCode).toBe(control.statusCode);
      expect(crossedRes.statusCode).toBe(401);
      expect(crossedRes.body).toBe(control.body);
      expect(crossedRes.headers['set-cookie']).toEqual(control.headers['set-cookie']);
      expectCleared(crossedRes, surface);

      // The interactive route too, with a token derived from what was presented.
      const unknown = unknownToken();
      const control2 = await post(surface, 'activity', unknown, csrfOf(unknown), cid);
      const crossedPost = await post(surface, 'activity', token, csrfOf(token), cid);
      expect(crossedPost.statusCode).toBe(control2.statusCode);
      expect(crossedPost.body).toBe(control2.body);
      expect(crossedPost.headers['set-cookie']).toEqual(control2.headers['set-cookie']);
      expect(await row(sessionId)).toBe(before);
    }
  });

  it.each(SURFACES)('13. $audience: the cookie name twice is no session, in either order', async (surface) => {
    const { token, sessionId } = await makeSession(surface);
    const planted = unknownToken();
    const before = await row(sessionId);
    for (const cookie of [
      `${surface.cookie}=${token}; ${surface.cookie}=${planted}`,
      `${surface.cookie}=${planted}; ${surface.cookie}=${token}`,
    ]) {
      const res = await inject(app, {
        method: 'POST',
        url: `${surface.base}/activity`,
        headers: { cookie, 'x-rpos-csrf': csrfOf(token) },
      });
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(UNAUTHENTICATED);
      expectCleared(res, surface);
      const read = await inject(app, { method: 'GET', url: `${surface.base}/me`, headers: { cookie } });
      expect(read.statusCode).toBe(401);
    }
    expect(await row(sessionId)).toBe(before);
  });

  describe('14. AC-28: the limits', () => {
    it('the POS: just inside is 200, just outside is SESSION_IDLE and the cookie is cleared', async () => {
      const idle = SESSION_POLICY.POS.idleSeconds;
      const { token, sessionId } = await makeSession(POS);
      await age(sessionId, idle - 2);
      expect((await get(POS, 'me', token)).statusCode).toBe(200);
      await age(sessionId, idle + 2);
      const res = await get(POS, 'me', token);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(SESSION_IDLE);
      expectCleared(res, POS);
    });

    it('the back office: just inside is 200, just outside is SESSION_IDLE and the cookie is kept', async () => {
      const idle = SESSION_POLICY.BACK_OFFICE.idleSeconds;
      const { token, sessionId } = await makeSession(BACK_OFFICE);
      await age(sessionId, idle - 60);
      expect((await get(BACK_OFFICE, 'me', token)).statusCode).toBe(200);
      await age(sessionId, idle + 60);
      const res = await get(BACK_OFFICE, 'me', token);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(SESSION_IDLE);
      expect(setCookiesNamed(res, BACK_OFFICE.cookie)).toEqual([]);
    });

    it('the back office past its absolute limit is UNAUTHENTICATED', async () => {
      const { token, sessionId } = await makeSession(BACK_OFFICE);
      await ownerQuery(
        `UPDATE actor_session
            SET issued_at = clock_timestamp() - make_interval(secs => $2::int),
                absolute_expires_at = clock_timestamp() - interval '1 second',
                last_interactive_at = clock_timestamp()
          WHERE id = $1`,
        [sessionId, SESSION_POLICY.BACK_OFFICE.absoluteSeconds]
      );
      const res = await get(BACK_OFFICE, 'me', token);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(UNAUTHENTICATED);
    });
  });

  describe.each(SURFACES)('15. AC-28: polling does not extend $audience', (surface) => {
    const idle = SESSION_POLICY[surface.audience].idleSeconds;
    // Just inside the limit, with a margin a slow request cannot eat; then `step`
    // seconds further back relative to wherever the request left the row.
    const near = idle - Math.round(idle / 30);
    const step = Math.round(idle / 15);

    it('me twice leaves last_interactive_at unchanged, and a row moved further back is idle', async () => {
      const { token, sessionId } = await makeSession(surface);
      await age(sessionId, near);
      const before = await lastInteractive(sessionId);
      expect((await get(surface, 'me', token)).statusCode).toBe(200);
      expect((await get(surface, 'me', token)).statusCode).toBe(200);
      expect(await lastInteractive(sessionId)).toBe(before);

      await ownerQuery(
        `UPDATE actor_session
            SET last_interactive_at = last_interactive_at - make_interval(secs => $2::int)
          WHERE id = $1`,
        [sessionId, step]
      );
      const res = await get(surface, 'me', token);
      expect(res.statusCode).toBe(401);
      expect(res.body).toBe(SESSION_IDLE);
    });

    it('activity moves it, and the same step back is still active', async () => {
      const { token, sessionId } = await makeSession(surface);
      await age(sessionId, near);
      const before = await lastInteractive(sessionId);
      const moved = await post(surface, 'activity', token, csrfOf(token));
      expect(moved.statusCode).toBe(204);
      expect(await lastInteractive(sessionId)).not.toBe(before);

      await ownerQuery(
        `UPDATE actor_session
            SET last_interactive_at = last_interactive_at - make_interval(secs => $2::int)
          WHERE id = $1`,
        [sessionId, step]
      );
      expect((await get(surface, 'me', token)).statusCode).toBe(200);
    });
  });

  it('16. a demoted manager is FORBIDDEN at the back office, keeps the cookie, and recovers; their POS session reads CASHIER', async () => {
    const manager = await makeUser('MANAGER');
    const office = await makeSession(BACK_OFFICE, manager);
    const pos = await makeSession(POS, manager);

    await ownerQuery("UPDATE staff_user SET role = 'CASHIER' WHERE id = $1", [manager.id]);
    const me = await get(BACK_OFFICE, 'me', office.token);
    expect(me.statusCode).toBe(403);
    expect(me.body).toBe(FORBIDDEN);
    expect(setCookiesNamed(me, BACK_OFFICE.cookie)).toEqual([]);
    const activity = await post(BACK_OFFICE, 'activity', office.token, csrfOf(office.token));
    expect(activity.statusCode).toBe(403);
    expect(activity.body).toBe(FORBIDDEN);
    expect(setCookiesNamed(activity, BACK_OFFICE.cookie)).toEqual([]);

    const posMe = await get(POS, 'me', pos.token);
    expect(posMe.statusCode).toBe(200);
    expect((posMe.json() as { role: string }).role).toBe('CASHIER');

    await ownerQuery("UPDATE staff_user SET role = 'MANAGER' WHERE id = $1", [manager.id]);
    expect((await get(BACK_OFFICE, 'me', office.token)).statusCode).toBe(200);
  });

  describe.each(SURFACES)('17. CSRF on $audience activity', (surface) => {
    it('a missing, wrong, foreign, client-instance or repeated token is CSRF_REFUSED and moves nothing', async () => {
      const { token, sessionId } = await makeSession(surface);
      const other = await makeSession(surface);
      const cid = await newClientInstance();
      await age(sessionId, 5);
      const before = await lastInteractive(sessionId);

      const good = csrfOf(token);
      const attempts: [string, string | string[] | undefined][] = [
        ['no header', undefined],
        ['an empty header', ''],
        ['a wrong value', unknownToken()],
        ['another session\'s token', csrfOf(other.token)],
        ['the session token itself', token],
        ['the client-instance id', cid],
        ['the header sent twice (array)', [good, good]],
        ['the header sent twice (joined)', `${good}, ${good}`],
        ['the token with a suffix', `${good}x`],
      ];
      for (const [name, header] of attempts) {
        const res = await post(surface, 'activity', token, header, cid);
        expect(res.statusCode, name).toBe(403);
        expect(res.body, name).toBe(CSRF_REFUSED);
        expect(await lastInteractive(sessionId), name).toBe(before);
      }

      const accepted = await post(surface, 'activity', token, good, cid);
      expect(accepted.statusCode).toBe(204);
      expect(accepted.body).toBe('');
      expect(await lastInteractive(sessionId)).not.toBe(before);
    });

    it('a GET needs no token', async () => {
      const { token } = await makeSession(surface);
      expect((await get(surface, 'me', token)).statusCode).toBe(200);
    });
  });

  it('18. the CSRF token is 43 base64url characters, bound to the session, and stable', async () => {
    const a = await makeSession(POS);
    const b = await makeSession(POS);
    const read = async (token: string) =>
      ((await get(POS, 'me', token)).json() as { csrfToken: string }).csrfToken;
    const first = await read(a.token);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).toBe(await read(a.token));
    expect(first).toBe(csrfOf(a.token));
    expect(first).not.toBe(a.token);
    expect(first).not.toBe(await read(b.token));

    const [hash] = await ownerQuery<{ hex: string; base64: string }>(
      "SELECT encode(token_hash, 'hex') AS hex, encode(token_hash, 'base64') AS base64 FROM actor_session WHERE id = $1",
      [a.sessionId]
    );
    const digest = createHash('sha256').update(Buffer.from(a.token, 'base64url')).digest();
    expect(hash!.hex).toBe(digest.toString('hex'));
    for (const encoding of [
      hash!.hex,
      hash!.base64,
      digest.toString('base64url'),
      digest.toString('base64'),
    ]) {
      expect(first).not.toBe(encoding);
    }
  });

  describe.each(SURFACES)('19. $audience: ending the session', (surface) => {
    const path = surface.audience === 'POS' ? 'release' : 'logout';

    it('with the cookie and token: 204, released, cookie cleared; again: 204', async () => {
      const { token, sessionId } = await makeSession(surface);
      const res = await post(surface, path, token, csrfOf(token));
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      expect(await releasedAt(sessionId)).not.toBeNull();
      expectCleared(res, surface);

      const again = await post(surface, path, token, csrfOf(token));
      expect(again.statusCode).toBe(204);
      expectCleared(again, surface);
      expect((await get(surface, 'me', token)).statusCode).toBe(401);
    });

    it('an idle session is released', async () => {
      const { token, sessionId } = await makeSession(surface);
      await age(sessionId, SESSION_POLICY[surface.audience].idleSeconds + 60);
      const res = await post(surface, path, token, csrfOf(token));
      expect(res.statusCode).toBe(204);
      expect(await releasedAt(sessionId)).not.toBeNull();
      expectCleared(res, surface);
    });

    it('with no cookie: 204 and nothing written', async () => {
      const { sessionId } = await makeSession(surface);
      const before = await ownerQuery('SELECT to_jsonb(actor_session)::text AS r FROM actor_session ORDER BY id');
      const res = await post(surface, path, undefined);
      expect(res.statusCode).toBe(204);
      expect(setCookiesNamed(res, surface.cookie)).toEqual([]);
      expect(await ownerQuery('SELECT to_jsonb(actor_session)::text AS r FROM actor_session ORDER BY id')).toEqual(before);
      expect(await releasedAt(sessionId)).toBeNull();
    });

    it('with a cookie and no token: 403 and the session is not released', async () => {
      const { token, sessionId } = await makeSession(surface);
      const res = await post(surface, path, token);
      expect(res.statusCode).toBe(403);
      expect(res.body).toBe(CSRF_REFUSED);
      expect(await releasedAt(sessionId)).toBeNull();
      expect((await get(surface, 'me', token)).statusCode).toBe(200);
    });
  });

  it('19. a POS release leaves the same user\'s back-office session alone, and the reverse', async () => {
    const manager = await makeUser('MANAGER');
    const pos = await makeSession(POS, manager);
    const office = await makeSession(BACK_OFFICE, manager);
    expect((await post(POS, 'release', pos.token, csrfOf(pos.token))).statusCode).toBe(204);
    expect(await releasedAt(office.sessionId)).toBeNull();
    expect((await get(BACK_OFFICE, 'me', office.token)).statusCode).toBe(200);

    const pos2 = await makeSession(POS, manager);
    expect((await post(BACK_OFFICE, 'logout', office.token, csrfOf(office.token))).statusCode).toBe(204);
    expect(await releasedAt(pos2.sessionId)).toBeNull();
    expect((await get(POS, 'me', pos2.token)).statusCode).toBe(200);
  });

  it.each(SURFACES)('20. $audience: an origin-refused activity moves nothing', async (surface) => {
    const { token, sessionId } = await makeSession(surface);
    await age(sessionId, 5);
    const before = await row(sessionId);
    for (const origin of ['https://evil.example', 'https://localhost:9999']) {
      const res = await inject(app, {
        method: 'POST',
        url: `${surface.base}/activity`,
        headers: { origin, cookie: `${surface.cookie}=${token}`, 'x-rpos-csrf': csrfOf(token) },
      });
      expect(res.statusCode).toBe(403);
      expect(res.body).toBe('{"error":{"code":"ORIGIN_REFUSED"}}');
    }
    const crossSite = await inject(app, {
      method: 'GET',
      url: `${surface.base}/me`,
      headers: { 'sec-fetch-site': 'cross-site', cookie: `${surface.cookie}=${token}` },
    });
    expect(crossSite.statusCode).toBe(403);
    expect(await row(sessionId)).toBe(before);
  });

  it.each(SURFACES)('21. $audience: the session store failing in the guard is 500 INTERNAL and the handler does not run', async (surface) => {
    const { token } = await makeSession(surface);
    const pool = getPool();
    const real = pool.query.bind(pool) as (...args: unknown[]) => unknown;
    vi.spyOn(pool, 'query').mockImplementation(((...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('actor_session')) {
        return Promise.reject(new Error('the store is down'));
      }
      return real(...args);
    }) as never);

    const ran = probeRuns;
    const res = await inject(app, {
      method: 'GET',
      url: `${surface.path}/probe-actor`,
      headers: cookieHeaders(surface, token),
    });
    expect(res.statusCode).toBe(500);
    expect(res.body).toBe('{"error":{"code":"INTERNAL"}}');
    expect(probeRuns).toBe(ran);
    expect(setCookiesNamed(res, surface.cookie)).toEqual([]);

    const activity = await post(surface, 'activity', token, csrfOf(token));
    expect(activity.statusCode).toBe(500);
    expect(activity.body).toBe('{"error":{"code":"INTERNAL"}}');
  });

  it.each(SURFACES)('22. $audience: a miss under the surface is the 404 envelope; the cookie is unread and not cleared', async (surface) => {
    const { token, sessionId } = await makeSession(surface);
    await age(sessionId, 5);
    const before = await row(sessionId);
    const res = await inject(app, {
      method: 'GET',
      url: `${surface.path}/nope`,
      headers: cookieHeaders(surface, token),
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).toBe('{"error":{"code":"NOT_FOUND"}}');
    expect(setCookiesNamed(res, surface.cookie)).toEqual([]);
    expect(await row(sessionId)).toBe(before);
  });
});
