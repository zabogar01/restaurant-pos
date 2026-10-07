import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '../src/db/pool.js';
import { createStaffUser, findUserByPin } from '../src/domain/pin.js';
import * as sessionModule from '../src/domain/session.js';
import {
  createSession,
  reauthenticateSession,
  releaseSession,
  resolveSession,
  SESSION_POLICY,
  type Audience,
  type VerifiedUser,
} from '../src/domain/session.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';

const CASHIER_PIN = '111111';
const MANAGER_PIN = '222222';
const OTHER_MANAGER_PIN = '333333';

let cashierId: string;
let managerId: string;
let otherManagerId: string;
let cashier: VerifiedUser;
let manager: VerifiedUser;
let otherManager: VerifiedUser;

async function verified(pin: string): Promise<VerifiedUser> {
  const user = await findUserByPin(pin);
  if (!user) throw new Error('fixture user not found');
  return { id: user.id, credentialVersion: user.credentialVersion };
}

beforeEach(async () => {
  await resetDatabase();
  cashierId = (await createStaffUser({ name: 'Cashier', role: 'CASHIER', pin: CASHIER_PIN })).id;
  managerId = (await createStaffUser({ name: 'Manager', role: 'MANAGER', pin: MANAGER_PIN })).id;
  otherManagerId = (
    await createStaffUser({ name: 'Other Manager', role: 'MANAGER', pin: OTHER_MANAGER_PIN })
  ).id;
  cashier = await verified(CASHIER_PIN);
  manager = await verified(MANAGER_PIN);
  otherManager = await verified(OTHER_MANAGER_PIN);
});

afterAll(async () => {
  await getPool().end();
});

// The whole row as the owner sees it, for byte-for-byte comparisons.
async function snapshot(sessionId: string): Promise<string> {
  const rows = await ownerQuery<{ row: string }>(
    `SELECT to_jsonb(actor_session)::text AS row FROM actor_session WHERE id = $1`,
    [sessionId]
  );
  const row = rows[0];
  if (!row) throw new Error('session row missing');
  return row.row;
}

// Make the session's last interactive moment `seconds` ago, by the database clock.
async function age(sessionId: string, seconds: number): Promise<void> {
  await ownerQuery(
    `UPDATE actor_session
        SET last_interactive_at = clock_timestamp() - make_interval(secs => $2::int)
      WHERE id = $1`,
    [sessionId, seconds]
  );
}

async function column(sessionId: string, expression: string): Promise<string> {
  const rows = await ownerQuery<{ value: string }>(
    `SELECT (${expression})::text AS value FROM actor_session WHERE id = $1`,
    [sessionId]
  );
  const row = rows[0];
  if (!row) throw new Error('session row missing');
  return row.value;
}

async function raiseVersion(userId: string): Promise<void> {
  await ownerQuery(
    `UPDATE staff_user SET credential_version = credential_version + 1 WHERE id = $1`,
    [userId]
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Poll through a second owner connection until a pos_app backend waits on a lock.
async function waitForLockWait(): Promise<void> {
  const watcher = await ownerClient();
  try {
    for (let i = 0; i < 250; i++) {
      const res = await watcher.query(
        `SELECT 1 FROM pg_stat_activity
          WHERE usename = 'pos_app' AND wait_event_type = 'Lock'`
      );
      if (res.rows.length > 0) return;
      await sleep(20);
    }
    throw new Error('no pos_app backend ever waited on a lock');
  } finally {
    await watcher.end();
  }
}

describe('policy and creation', () => {
  it('1. SESSION_POLICY is the FR-A2 and FR-A2b numbers, as literals', () => {
    expect(SESSION_POLICY).toEqual({
      POS: { idleSeconds: 90, absoluteSeconds: null },
      BACK_OFFICE: { idleSeconds: 1800, absoluteSeconds: 28800 },
    });
  });

  it('2. POS has no absolute limit; back office has eight hours and starts interactive', async () => {
    const pos = await createSession({ audience: 'POS', user: cashier });
    const posRows = await ownerQuery<{ absolute_expires_at: string | null }>(
      `SELECT absolute_expires_at::text FROM actor_session WHERE id = $1`,
      [pos.sessionId]
    );
    expect(posRows[0]?.absolute_expires_at).toBeNull();

    const bo = await createSession({ audience: 'BACK_OFFICE', user: manager });
    const rows = await ownerQuery<{ eight: boolean; same: boolean }>(
      `SELECT absolute_expires_at - issued_at = interval '8 hours' AS eight,
              last_interactive_at = issued_at AS same
         FROM actor_session WHERE id = $1`,
      [bo.sessionId]
    );
    expect(rows[0]).toEqual({ eight: true, same: true });
  });

  it('3. stores the credential version it was given, even a stale one', async () => {
    await raiseVersion(managerId);
    const issued = await createSession({ audience: 'POS', user: manager });
    expect(await column(issued.sessionId, 'credential_version')).toBe(
      String(manager.credentialVersion)
    );
    expect(manager.credentialVersion).not.toBe((await verified(MANAGER_PIN)).credentialVersion);
  });

  it('4. the token is 43 base64url characters; only its SHA-256 is stored', async () => {
    const a = await createSession({ audience: 'POS', user: cashier });
    const b = await createSession({ audience: 'POS', user: cashier });
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b.token).not.toBe(a.token);
    const expected = createHash('sha256').update(Buffer.from(a.token, 'base64url')).digest('hex');
    expect(await column(a.sessionId, `encode(token_hash, 'hex')`)).toBe(expected);
    expect(await column(a.sessionId, 'actor_session')).not.toContain(a.token);
    expect(await column(a.sessionId, 'id')).toBe(a.sessionId);
    expect(a.sessionId).not.toBe(a.token);
  });
});

describe('resolution', () => {
  it('5. a fresh session resolves ACTIVE with the user and role', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    expect(await resolveSession(issued.token, 'POS', false)).toEqual({
      status: 'ACTIVE',
      sessionId: issued.sessionId,
      staffUserId: cashierId,
      role: 'CASHIER',
    });
  });

  it('6. a token of one audience is NONE as the other (FR-A2c, AC-27)', async () => {
    const pos = await createSession({ audience: 'POS', user: manager });
    const bo = await createSession({ audience: 'BACK_OFFICE', user: manager });
    expect((await resolveSession(pos.token, 'BACK_OFFICE', true)).status).toBe('NONE');
    expect((await resolveSession(bo.token, 'POS', true)).status).toBe('NONE');
    expect((await resolveSession(pos.token, 'POS', true)).status).toBe('ACTIVE');
    expect((await resolveSession(bo.token, 'BACK_OFFICE', true)).status).toBe('ACTIVE');
  });

  it('7. malformed tokens resolve NONE', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    const bad: unknown[] = [
      '',
      'abc',
      issued.token.slice(0, 42),
      `${issued.token}A`,
      `${issued.token.slice(0, 42)}+`,
      `${issued.token.slice(0, 42)}!`,
      issued.sessionId,
      123456,
      null,
      undefined,
      {},
    ];
    for (const token of bad) {
      expect(await resolveSession(token as string, 'POS', true)).toEqual({ status: 'NONE' });
    }
  });

  it('8. resolves the same whatever client_instance_id it recorded (FR-A7)', async () => {
    const instance = randomUUID();
    await ownerQuery(`INSERT INTO client_instance (id) VALUES ($1)`, [instance]);
    const withInstance = await createSession({
      audience: 'POS',
      user: cashier,
      clientInstanceId: instance,
    });
    const without = await createSession({ audience: 'POS', user: cashier });
    expect(await column(withInstance.sessionId, 'client_instance_id')).toBe(instance);
    expect((await resolveSession(withInstance.token, 'POS', true)).status).toBe('ACTIVE');
    expect((await resolveSession(without.token, 'POS', true)).status).toBe('ACTIVE');
  });

  it('9. a role change shows on the next resolution', async () => {
    const issued = await createSession({ audience: 'BACK_OFFICE', user: manager });
    await ownerQuery(`UPDATE staff_user SET role = 'CASHIER' WHERE id = $1`, [managerId]);
    expect(await resolveSession(issued.token, 'BACK_OFFICE', true)).toMatchObject({
      status: 'ACTIVE',
      role: 'CASHIER',
    });
  });
});

describe('idle and absolute', () => {
  it('10. POS: 89 seconds is ACTIVE, 91 is IDLE', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    await age(issued.sessionId, 89);
    expect((await resolveSession(issued.token, 'POS', false)).status).toBe('ACTIVE');
    await age(issued.sessionId, 91);
    expect(await resolveSession(issued.token, 'POS', false)).toEqual({
      status: 'IDLE',
      sessionId: issued.sessionId,
      staffUserId: cashierId,
    });
  });

  it('11. back office: 29 minutes is ACTIVE, 31 is IDLE', async () => {
    const issued = await createSession({ audience: 'BACK_OFFICE', user: manager });
    await age(issued.sessionId, 29 * 60);
    expect((await resolveSession(issued.token, 'BACK_OFFICE', false)).status).toBe('ACTIVE');
    await age(issued.sessionId, 31 * 60);
    expect((await resolveSession(issued.token, 'BACK_OFFICE', true)).status).toBe('IDLE');
  });

  it('12. interactive moves last_interactive_at; non-interactive changes nothing', async () => {
    const issued = await createSession({ audience: 'BACK_OFFICE', user: manager });
    await age(issued.sessionId, 600);
    const before = await snapshot(issued.sessionId);
    expect((await resolveSession(issued.token, 'BACK_OFFICE', false)).status).toBe('ACTIVE');
    expect(await snapshot(issued.sessionId)).toBe(before);

    expect((await resolveSession(issued.token, 'BACK_OFFICE', true)).status).toBe('ACTIVE');
    const gap = await column(
      issued.sessionId,
      `abs(extract(epoch FROM clock_timestamp() - last_interactive_at)) < 1`
    );
    expect(gap).toBe('true');
  });

  it('13. polling does not extend a session (AC-28)', async () => {
    for (const [audience, user, near, step] of [
      ['BACK_OFFICE', manager, 29 * 60, 2 * 60],
      ['POS', cashier, 89, 2],
    ] as const) {
      const issued = await createSession({ audience, user });
      await age(issued.sessionId, near);
      expect((await resolveSession(issued.token, audience, false)).status).toBe('ACTIVE');
      // Move the row `step` seconds further back from wherever the poll left it,
      // so a poll that had touched the row would show as still ACTIVE.
      await ownerQuery(
        `UPDATE actor_session
            SET last_interactive_at = last_interactive_at - make_interval(secs => $2::int)
          WHERE id = $1`,
        [issued.sessionId, step]
      );
      expect((await resolveSession(issued.token, audience, false)).status).toBe('IDLE');
    }
  });

  it('14. an interactive resolution never moves last_interactive_at back', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    await ownerQuery(
      `UPDATE actor_session SET last_interactive_at = clock_timestamp() + interval '5 seconds'
        WHERE id = $1`,
      [issued.sessionId]
    );
    const before = await snapshot(issued.sessionId);
    expect((await resolveSession(issued.token, 'POS', true)).status).toBe('ACTIVE');
    expect(await snapshot(issued.sessionId)).toBe(before);
  });

  it('15. the absolute limit refuses a session that was interactive a moment ago', async () => {
    const issued = await createSession({ audience: 'BACK_OFFICE', user: manager });
    await ownerQuery(
      `UPDATE actor_session
          SET issued_at = clock_timestamp() - interval '8 hours',
              absolute_expires_at = clock_timestamp() - interval '1 second',
              last_interactive_at = clock_timestamp()
        WHERE id = $1`,
      [issued.sessionId]
    );
    expect(await resolveSession(issued.token, 'BACK_OFFICE', true)).toEqual({ status: 'NONE' });
    expect(await resolveSession(issued.token, 'BACK_OFFICE', false)).toEqual({ status: 'NONE' });
  });

  it('16. an interactive resolution never changes absolute_expires_at or issued_at', async () => {
    const issued = await createSession({ audience: 'BACK_OFFICE', user: manager });
    const columns = `issued_at::text || '|' || absolute_expires_at::text`;
    const before = await column(issued.sessionId, columns);
    await resolveSession(issued.token, 'BACK_OFFICE', true);
    expect(await column(issued.sessionId, columns)).toBe(before);
  });
});

describe('invalidation', () => {
  it('17. raising the credential version ends the session (FR-B3)', async () => {
    const issued = await createSession({ audience: 'POS', user: manager });
    await raiseVersion(managerId);
    expect(await resolveSession(issued.token, 'POS', true)).toEqual({ status: 'NONE' });
    expect(await resolveSession(issued.token, 'POS', false)).toEqual({ status: 'NONE' });
  });

  it('18. deactivating the user ends the session (AC-32)', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    await ownerQuery(`UPDATE staff_user SET is_active = false WHERE id = $1`, [cashierId]);
    expect(await resolveSession(issued.token, 'POS', true)).toEqual({ status: 'NONE' });
  });

  it('19. verify, raise the version, then create: the new session is NONE (ARCH-006 §4)', async () => {
    const verifiedUser = await verified(MANAGER_PIN);
    await raiseVersion(managerId);
    const issued = await createSession({ audience: 'POS', user: verifiedUser });
    expect(await resolveSession(issued.token, 'POS', true)).toEqual({ status: 'NONE' });
  });

  it("20. raising one user's version leaves another user's session ACTIVE", async () => {
    const a = await createSession({ audience: 'POS', user: manager });
    const b = await createSession({ audience: 'POS', user: cashier });
    await raiseVersion(managerId);
    expect((await resolveSession(a.token, 'POS', true)).status).toBe('NONE');
    expect((await resolveSession(b.token, 'POS', true)).status).toBe('ACTIVE');
  });
});

describe('release', () => {
  it('21. a released session is NONE, and a second release changes nothing', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    await releaseSession(issued.token, 'POS');
    expect(await resolveSession(issued.token, 'POS', true)).toEqual({ status: 'NONE' });
    expect(await resolveSession(issued.token, 'POS', false)).toEqual({ status: 'NONE' });
    const before = await snapshot(issued.sessionId);
    await releaseSession(issued.token, 'POS');
    expect(await snapshot(issued.sessionId)).toBe(before);
  });

  it('22. an idle session can be released and is then NONE, not IDLE', async () => {
    const issued = await createSession({ audience: 'BACK_OFFICE', user: manager });
    await age(issued.sessionId, 31 * 60);
    await releaseSession(issued.token, 'BACK_OFFICE');
    expect(await resolveSession(issued.token, 'BACK_OFFICE', true)).toEqual({ status: 'NONE' });
  });

  it('23. releasing a POS token as BACK_OFFICE releases nothing', async () => {
    const issued = await createSession({ audience: 'POS', user: manager });
    const before = await snapshot(issued.sessionId);
    await releaseSession(issued.token, 'BACK_OFFICE');
    expect(await snapshot(issued.sessionId)).toBe(before);
    expect((await resolveSession(issued.token, 'POS', true)).status).toBe('ACTIVE');
  });
});

describe('re-authentication', () => {
  it('24. an idle session is renewed for its own user under a new token', async () => {
    const issued = await createSession({ audience: 'BACK_OFFICE', user: manager });
    await age(issued.sessionId, 31 * 60);
    const fixed = `issued_at::text || '|' || absolute_expires_at::text`;
    const before = await column(issued.sessionId, fixed);

    const renewed = await reauthenticateSession(issued.token, 'BACK_OFFICE', manager);
    expect(renewed).not.toBeNull();
    if (!renewed) return;
    expect(renewed.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(renewed.token).not.toBe(issued.token);
    expect(renewed.sessionId).toBe(issued.sessionId);
    expect(await resolveSession(renewed.token, 'BACK_OFFICE', false)).toMatchObject({
      status: 'ACTIVE',
      sessionId: issued.sessionId,
    });
    expect(await resolveSession(issued.token, 'BACK_OFFICE', false)).toEqual({ status: 'NONE' });
    expect(await column(issued.sessionId, fixed)).toBe(before);
  });

  it('25. a different manager gets null and changes nothing (owner, 2026-10-05)', async () => {
    const issued = await createSession({ audience: 'BACK_OFFICE', user: manager });
    await age(issued.sessionId, 31 * 60);
    const before = await snapshot(issued.sessionId);
    expect(await reauthenticateSession(issued.token, 'BACK_OFFICE', otherManager)).toBeNull();
    expect(await snapshot(issued.sessionId)).toBe(before);
    expect(otherManager.id).toBe(otherManagerId);
  });

  it('26. null and no change when released, past the limit, inactive, or the version differs', async () => {
    const cases: [string, (sessionId: string, token: string) => Promise<void>, number][] = [
      ['released', async (_id, token) => releaseSession(token, 'BACK_OFFICE'), 0],
      [
        'absolute limit',
        async (id) => {
          await ownerQuery(
            `UPDATE actor_session
                SET issued_at = clock_timestamp() - interval '8 hours',
                    absolute_expires_at = clock_timestamp() - interval '1 second'
              WHERE id = $1`,
            [id]
          );
        },
        0,
      ],
      [
        'inactive',
        async () => {
          await ownerQuery(`UPDATE staff_user SET is_active = false WHERE id = $1`, [managerId]);
        },
        0,
      ],
      ['version differs', async () => {}, 1],
    ];
    for (const [label, spoil, versionOffset] of cases) {
      // Each case needs an untouched user and session.
      await resetDatabase();
      await createStaffUser({ name: 'Manager', role: 'MANAGER', pin: MANAGER_PIN });
      const user = await verified(MANAGER_PIN);
      managerId = user.id;
      const issued = await createSession({ audience: 'BACK_OFFICE', user });
      await age(issued.sessionId, 31 * 60);
      await spoil(issued.sessionId, issued.token);
      const before = await snapshot(issued.sessionId);
      const attempt = { id: user.id, credentialVersion: user.credentialVersion + versionOffset };
      expect(await reauthenticateSession(issued.token, 'BACK_OFFICE', attempt), label).toBeNull();
      expect(await snapshot(issued.sessionId), label).toBe(before);
    }
  });

  it('27. an ACTIVE session can be re-authenticated and the token still rotates', async () => {
    const issued = await createSession({ audience: 'BACK_OFFICE', user: manager });
    const renewed = await reauthenticateSession(issued.token, 'BACK_OFFICE', manager);
    expect(renewed).not.toBeNull();
    expect(renewed?.token).not.toBe(issued.token);
    expect((await resolveSession(issued.token, 'BACK_OFFICE', false)).status).toBe('NONE');
    expect((await resolveSession(renewed?.token ?? '', 'BACK_OFFICE', false)).status).toBe(
      'ACTIVE'
    );
  });
});

describe('concurrency', () => {
  it('28. a release that started first wins the race', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    const owner = await ownerClient();
    try {
      await owner.query('BEGIN');
      await owner.query(`UPDATE actor_session SET released_at = clock_timestamp() WHERE id = $1`, [
        issued.sessionId,
      ]);
      const resolving = resolveSession(issued.token, 'POS', true);
      await waitForLockWait();
      await owner.query('COMMIT');
      expect(await resolving).toEqual({ status: 'NONE' });
    } finally {
      await owner.end();
    }
  });

  it('29. the clock is read after the lock wait', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    const owner = await ownerClient();
    try {
      await owner.query('BEGIN');
      await owner.query(`SELECT 1 FROM actor_session WHERE id = $1 FOR UPDATE`, [
        issued.sessionId,
      ]);
      const resolving = resolveSession(issued.token, 'POS', true);
      await waitForLockWait();
      await owner.query(
        `UPDATE actor_session
            SET last_interactive_at = clock_timestamp() - interval '90 seconds'
          WHERE id = $1`,
        [issued.sessionId]
      );
      await owner.query('COMMIT');
      expect((await resolving).status).toBe('IDLE');
    } finally {
      await owner.end();
    }
  });

  it('30. twenty-five simultaneous resolutions all succeed', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    const results = await Promise.all(
      Array.from({ length: 25 }, () => resolveSession(issued.token, 'POS', true))
    );
    expect(results.map((r) => r.status)).toEqual(Array(25).fill('ACTIVE'));
  }, 30000);
});

describe('shape', () => {
  it('31. the module exports exactly the specified names', () => {
    expect(Object.keys(sessionModule).sort()).toEqual([
      'SESSION_POLICY',
      'createSession',
      'reauthenticateSession',
      'releaseSession',
      'resolveSession',
    ]);
  });

  it('32. no error carries a token or its digest', async () => {
    const issued = await createSession({ audience: 'POS', user: cashier });
    const digest = createHash('sha256')
      .update(Buffer.from(issued.token, 'base64url'))
      .digest('hex');
    const failures: unknown[] = [];
    for (const user of [
      { id: randomUUID(), credentialVersion: 1 },
      { id: cashier.id, credentialVersion: null as unknown as number },
    ]) {
      try {
        await createSession({ audience: 'POS' as Audience, user });
      } catch (err) {
        failures.push(err);
      }
    }
    expect(failures).toHaveLength(2);
    for (const err of failures) {
      const text = `${String(err)} ${JSON.stringify(err, Object.getOwnPropertyNames(err as object))}`;
      expect(text).not.toContain(issued.token);
      expect(text).not.toContain(digest);
      expect(text).not.toMatch(/\\x[0-9a-f]{64}/);
    }
  });
});
