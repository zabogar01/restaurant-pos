import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool } from '../src/db/pool.js';
import { SESSION_POLICY } from '../src/domain/session.js';
import type { Audience } from '../src/domain/session.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { resetDatabase } from './support/database.js';
import { ageSession, makePeople, sessionIdOfUser } from './support/people.js';
import { TEST_ORIGIN } from './support/request.js';

// The session clock (PHASE0-011b, ARCH-014 question 6): every session view carries the
// audience's idle limit and what is left of it, both whole seconds, the second computed
// by PostgreSQL in the statement that judged the session.

const people = makePeople(660000);
const SESSION_IDLE = '{"error":{"code":"SESSION_IDLE"}}';

interface Surface {
  audience: Audience;
  me: string;
  activity: string;
  keys: string[];
}

const COMMON = ['csrfToken', 'idleRemainingSeconds', 'idleSeconds', 'name', 'role', 'staffUserId'];
const SURFACES: Surface[] = [
  { audience: 'POS', me: '/api/pos/auth/me', activity: '/api/pos/auth/activity', keys: COMMON },
  {
    audience: 'BACK_OFFICE',
    me: '/api/back-office/auth/me',
    activity: '/api/back-office/auth/activity',
    keys: [...COMMON, 'username'],
  },
];

interface View {
  idleSeconds: number;
  idleRemainingSeconds: number;
}

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

// A signed-in profile, through the real sign-in of its surface.
async function signedIn(surface: Surface) {
  const client = new JarClient(app);
  let res;
  let staffUserId: string;
  if (surface.audience === 'POS') {
    const who = await people.cashier();
    staffUserId = who.id;
    res = await client.signInPos(who.pin);
  } else {
    const who = await people.manager();
    staffUserId = who.id;
    res = await client.signInBackOffice(who.username, who.password);
  }
  expect(res.statusCode).toBe(200);
  const [sessionId] = await sessionIdOfUser(staffUserId, surface.audience);
  return { client, sessionId: sessionId!, signIn: res.json() as Record<string, unknown> & View };
}

async function meOf(client: JarClient, surface: Surface) {
  const res = await client.get(surface.me);
  return { res, view: res.json() as Record<string, unknown> & View };
}

describe.each(SURFACES)('the session clock on $audience', (surface) => {
  const limit = SESSION_POLICY[surface.audience].idleSeconds;

  it('1. a sign-in returns idleSeconds equal to the policy and idleRemainingSeconds equal to it', async () => {
    const { signIn } = await signedIn(surface);
    expect(signIn.idleSeconds).toBe(limit);
    expect(signIn.idleRemainingSeconds).toBe(limit);
  });

  it('2. me, after the session is aged by n seconds, returns the policy less n, within one', async () => {
    for (const n of [1, Math.floor(limit / 3), limit - 10]) {
      const { client, sessionId } = await signedIn(surface);
      await ageSession(sessionId, n);
      const { res, view } = await meOf(client, surface);
      expect(res.statusCode, `aged ${n}`).toBe(200);
      expect(view.idleSeconds).toBe(limit);
      expect(Math.abs(view.idleRemainingSeconds - (limit - n)), `aged ${n}`).toBeLessThanOrEqual(1);
      expect(view.idleRemainingSeconds).toBeLessThanOrEqual(limit);
      // Rounded down: some fraction of a second has passed since the aging, so the
      // true value is just under limit - n and never reads as limit - n itself.
      expect(view.idleRemainingSeconds, `aged ${n}`).toBeLessThan(limit - n);
    }
  });

  it('3. me does not move it: two reads a moment apart do not increase the number', async () => {
    const { client, sessionId } = await signedIn(surface);
    await ageSession(sessionId, Math.floor(limit / 2));
    const first = (await meOf(client, surface)).view.idleRemainingSeconds;
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = (await meOf(client, surface)).view.idleRemainingSeconds;
    expect(second).toBeLessThanOrEqual(first);
    expect(second).toBeLessThan(limit - 1);
  });

  it('4. activity, then me, returns it to the policy within one', async () => {
    const { client, sessionId } = await signedIn(surface);
    await ageSession(sessionId, Math.floor(limit / 2));
    expect((await client.post(surface.activity)).statusCode).toBe(204);
    const { view } = await meOf(client, surface);
    expect(limit - view.idleRemainingSeconds).toBeLessThanOrEqual(1);
    expect(view.idleRemainingSeconds).toBeLessThanOrEqual(limit);
  });

  it('5. one second short of the limit is 0 or 1, never negative; past it is SESSION_IDLE', async () => {
    const { client, sessionId } = await signedIn(surface);
    await ageSession(sessionId, limit - 1);
    const { res, view } = await meOf(client, surface);
    expect(res.statusCode).toBe(200);
    expect([0, 1]).toContain(view.idleRemainingSeconds);
    // 0.99 seconds are left and the number rounds down.
    expect(view.idleRemainingSeconds).toBe(0);

    await ageSession(sessionId, limit + 1);
    const past = await client.get(surface.me);
    expect(past.statusCode).toBe(401);
    expect(past.body).toBe(SESSION_IDLE);
  });

  it('7. both numbers are integers and the response has exactly the expected keys', async () => {
    const { client, signIn, sessionId } = await signedIn(surface);
    await ageSession(sessionId, 7);
    const { view } = await meOf(client, surface);
    for (const body of [signIn, view]) {
      expect(Object.keys(body).sort()).toEqual(surface.keys);
      expect(Number.isInteger(body.idleSeconds)).toBe(true);
      expect(Number.isInteger(body.idleRemainingSeconds)).toBe(true);
    }
  });
});

describe('the session clock on the back office, re-authentication', () => {
  it('6. a re-authentication returns the policy for both numbers', async () => {
    const surface = SURFACES[1]!;
    const limit = SESSION_POLICY.BACK_OFFICE.idleSeconds;
    const who = await people.manager();
    const client = new JarClient(app);
    expect((await client.signInBackOffice(who.username, who.password)).statusCode).toBe(200);
    const [sessionId] = await sessionIdOfUser(who.id, 'BACK_OFFICE');
    await ageSession(sessionId!, limit + 60);
    expect((await client.get(surface.me)).body).toBe(SESSION_IDLE);

    const res = await client.reauthenticate(who.password);
    expect(res.statusCode).toBe(200);
    const view = res.json() as View;
    expect(view.idleSeconds).toBe(limit);
    expect(view.idleRemainingSeconds).toBe(limit);
    expect(Object.keys(res.json() as object).sort()).toEqual(surface.keys);

    // The renewed session reads back its whole limit, within one.
    const after = (await meOf(client, surface)).view;
    expect(limit - after.idleRemainingSeconds).toBeLessThanOrEqual(1);
  });
});
