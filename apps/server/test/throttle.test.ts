import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '../src/db/pool.js';
import { createStaffUser } from '../src/domain/pin.js';
import * as throttleModule from '../src/domain/throttle.js';
import {
  COOLDOWN_MINUTES,
  MAX_FAILURES,
  verifyPinThrottled,
  type ThrottleClass,
} from '../src/domain/throttle.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';

const CASHIER_PIN = '111111';
const MANAGER_PIN = '222222';
const WRONG_PIN = '987654';

let cashierId: string;

beforeEach(async () => {
  await resetDatabase();
  cashierId = (await createStaffUser({ name: 'Cashier', role: 'CASHIER', pin: CASHIER_PIN })).id;
  await createStaffUser({ name: 'Manager', role: 'MANAGER', pin: MANAGER_PIN });
});

afterAll(async () => {
  await getPool().end();
});

interface BucketRow {
  consecutive_failures: number;
  blocked_until: string | null;
  remaining: string | null;
}

async function bucket(throttleClass: ThrottleClass): Promise<BucketRow> {
  const rows = await ownerQuery<BucketRow>(
    `SELECT consecutive_failures,
            blocked_until::text AS blocked_until,
            extract(epoch FROM blocked_until - now())::text AS remaining
       FROM pin_throttle_bucket
      WHERE throttle_class = $1`,
    [throttleClass]
  );
  const row = rows[0];
  if (!row) throw new Error('bucket row missing');
  return row;
}

async function events(): Promise<
  { event_type: string; throttle_class: string; client_instance_id: string | null }[]
> {
  return ownerQuery(
    `SELECT event_type, throttle_class, client_instance_id FROM security_event ORDER BY id`
  );
}

async function wrong(throttleClass: ThrottleClass, times: number, clientInstanceId?: string) {
  const results = [];
  for (let i = 0; i < times; i++) {
    results.push(await verifyPinThrottled(throttleClass, WRONG_PIN, { clientInstanceId }));
  }
  return results;
}

async function ageCooldown(throttleClass: ThrottleClass): Promise<void> {
  await ownerQuery(
    `UPDATE pin_throttle_bucket
        SET consecutive_failures = 5, blocked_until = now() - interval '1 second'
      WHERE throttle_class = $1`,
    [throttleClass]
  );
}

async function waitingBackends(): Promise<number> {
  const rows = await ownerQuery<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM pg_stat_activity
      WHERE usename = 'pos_app' AND wait_event_type = 'Lock'`
  );
  return rows[0]?.n ?? 0;
}

async function until(condition: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('condition not reached');
}

describe('counting', () => {
  it('1: four wrong PINs count without a cooldown, then a correct PIN verifies', async () => {
    const results = await wrong('LOGIN', 4);
    expect(results).toEqual(Array(4).fill({ outcome: 'FAILED', retryAfterSeconds: null }));
    const row = await bucket('LOGIN');
    expect(row.consecutive_failures).toBe(4);
    expect(row.blocked_until).toBeNull();
    expect(await verifyPinThrottled('LOGIN', CASHIER_PIN)).toEqual({
      outcome: 'VERIFIED',
      user: { id: cashierId, role: 'CASHIER', credentialVersion: 1 },
    });
  });

  it('2: the fifth wrong PIN starts a five-minute cooldown', async () => {
    const results = await wrong('LOGIN', MAX_FAILURES);
    expect(results[4]).toEqual({ outcome: 'FAILED', retryAfterSeconds: COOLDOWN_MINUTES * 60 });
    const row = await bucket('LOGIN');
    expect(row.consecutive_failures).toBe(5);
    expect(Number(row.remaining)).toBeGreaterThan(295);
    expect(Number(row.remaining)).toBeLessThanOrEqual(300);
  });

  it('3: during the cooldown the correct PIN is THROTTLED and nothing is written', async () => {
    await wrong('LOGIN', 5);
    const before = await bucket('LOGIN');
    const result = await verifyPinThrottled('LOGIN', CASHIER_PIN);
    expect(result.outcome).toBe('THROTTLED');
    if (result.outcome !== 'THROTTLED') throw new Error('unreachable');
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(300);
    const after = await bucket('LOGIN');
    expect(after.consecutive_failures).toBe(before.consecutive_failures);
    expect(after.blocked_until).toBe(before.blocked_until);
  });

  it('4: retryAfterSeconds is the time left on a cooldown set by the owner', async () => {
    await ownerQuery(
      `UPDATE pin_throttle_bucket
          SET consecutive_failures = 5, blocked_until = now() + interval '30 seconds'
        WHERE throttle_class = 'LOGIN'`
    );
    const result = await verifyPinThrottled('LOGIN', CASHIER_PIN);
    expect(result.outcome).toBe('THROTTLED');
    if (result.outcome !== 'THROTTLED') throw new Error('unreachable');
    expect([29, 30]).toContain(result.retryAfterSeconds);
  });
});

describe('the reset', () => {
  it('5: a wrong PIN after an ended cooldown counts as the first failure', async () => {
    await ageCooldown('LOGIN');
    expect(await verifyPinThrottled('LOGIN', WRONG_PIN)).toEqual({
      outcome: 'FAILED',
      retryAfterSeconds: null,
    });
    const row = await bucket('LOGIN');
    expect(row.consecutive_failures).toBe(1);
    expect(row.blocked_until).toBeNull();
    const more = await wrong('LOGIN', 3);
    expect(more.every((r) => r.outcome === 'FAILED' && r.retryAfterSeconds === null)).toBe(true);
    expect(await wrong('LOGIN', 1)).toEqual([{ outcome: 'FAILED', retryAfterSeconds: 300 }]);
  });

  it('6: a correct PIN after an ended cooldown verifies and resets the row', async () => {
    await ageCooldown('LOGIN');
    expect((await verifyPinThrottled('LOGIN', CASHIER_PIN)).outcome).toBe('VERIFIED');
    const row = await bucket('LOGIN');
    expect(row.consecutive_failures).toBe(0);
    expect(row.blocked_until).toBeNull();
  });
});

describe('classes', () => {
  it('7: a cooldown in one class leaves the other verifying', async () => {
    await wrong('LOGIN', 5);
    expect((await verifyPinThrottled('MANAGER_APPROVAL', MANAGER_PIN)).outcome).toBe('VERIFIED');
    await resetDatabase();
    await createStaffUser({ name: 'Cashier', role: 'CASHIER', pin: CASHIER_PIN });
    await createStaffUser({ name: 'Manager', role: 'MANAGER', pin: MANAGER_PIN });
    await wrong('MANAGER_APPROVAL', 5);
    expect((await verifyPinThrottled('LOGIN', CASHIER_PIN)).outcome).toBe('VERIFIED');
  });

  it('8: a correct login does not reset the approval class (FR-A5, AC-19)', async () => {
    await wrong('MANAGER_APPROVAL', 4);
    expect((await verifyPinThrottled('LOGIN', CASHIER_PIN)).outcome).toBe('VERIFIED');
    expect(await wrong('MANAGER_APPROVAL', 1)).toEqual([
      { outcome: 'FAILED', retryAfterSeconds: 300 },
    ]);
    const row = await bucket('MANAGER_APPROVAL');
    expect(row.consecutive_failures).toBe(5);
    expect(row.blocked_until).not.toBeNull();
  });

  it("9: a cashier's own PIN fails approval; a manager's verifies and resets", async () => {
    await wrong('MANAGER_APPROVAL', 4);
    expect(await verifyPinThrottled('MANAGER_APPROVAL', CASHIER_PIN)).toEqual({
      outcome: 'FAILED',
      retryAfterSeconds: 300,
    });
    expect((await bucket('MANAGER_APPROVAL')).consecutive_failures).toBe(5);

    await resetDatabase();
    await createStaffUser({ name: 'Cashier', role: 'CASHIER', pin: CASHIER_PIN });
    const managerId = (await createStaffUser({ name: 'Manager', role: 'MANAGER', pin: MANAGER_PIN })).id;
    await wrong('MANAGER_APPROVAL', 2);
    expect(await verifyPinThrottled('MANAGER_APPROVAL', MANAGER_PIN)).toEqual({
      outcome: 'VERIFIED',
      user: { id: managerId, role: 'MANAGER', credentialVersion: 1 },
    });
    expect((await bucket('MANAGER_APPROVAL')).consecutive_failures).toBe(0);
  });

  it("10: a success resets its own class's row only", async () => {
    await wrong('LOGIN', 2);
    await wrong('MANAGER_APPROVAL', 3);
    await verifyPinThrottled('LOGIN', CASHIER_PIN);
    expect((await bucket('LOGIN')).consecutive_failures).toBe(0);
    expect((await bucket('MANAGER_APPROVAL')).consecutive_failures).toBe(3);
  });
});

describe('concurrency', () => {
  it('11: twenty-five simultaneous wrong PINs settle as five failures and twenty throttled', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => verifyPinThrottled('LOGIN', WRONG_PIN))
    );
    expect(results.filter((r) => r.outcome === 'FAILED')).toHaveLength(5);
    expect(results.filter((r) => r.outcome === 'THROTTLED')).toHaveLength(20);
    expect((await bucket('LOGIN')).consecutive_failures).toBe(5);
    const written = await events();
    expect(written.filter((e) => e.event_type === 'PIN_FAILURE')).toHaveLength(5);
    expect(written.filter((e) => e.event_type === 'COOLDOWN_STARTED')).toHaveLength(1);
  }, 30_000);

  it('12: the row lock is real: attempts queue behind it and are counted one at a time', async () => {
    const owner = await ownerClient();
    try {
      await owner.query('BEGIN');
      await owner.query(
        `SELECT 1 FROM pin_throttle_bucket WHERE throttle_class = 'LOGIN' FOR UPDATE`
      );
      const attempts = Array.from({ length: 12 }, () => verifyPinThrottled('LOGIN', WRONG_PIN));
      await until(async () => (await waitingBackends()) >= 6);
      await owner.query('COMMIT');
      const results = await Promise.all(attempts);
      expect(results.filter((r) => r.outcome === 'FAILED')).toHaveLength(5);
      expect(results.filter((r) => r.outcome === 'THROTTLED')).toHaveLength(7);
    } finally {
      await owner.end();
    }
  }, 30_000);

  it('13: the decision is made from the row as read under the lock', async () => {
    const owner = await ownerClient();
    try {
      await owner.query('BEGIN');
      await owner.query(
        `SELECT 1 FROM pin_throttle_bucket WHERE throttle_class = 'LOGIN' FOR UPDATE`
      );
      const attempt = verifyPinThrottled('LOGIN', CASHIER_PIN);
      await until(async () => (await waitingBackends()) >= 1);
      await owner.query(
        `UPDATE pin_throttle_bucket
            SET consecutive_failures = 5, blocked_until = now() + interval '5 minutes'
          WHERE throttle_class = 'LOGIN'`
      );
      await owner.query('COMMIT');
      expect((await attempt).outcome).toBe('THROTTLED');
    } finally {
      await owner.end();
    }
  }, 30_000);
});

describe('evidence', () => {
  async function clientInstance(): Promise<string> {
    const rows = await ownerQuery<{ id: string }>(
      'INSERT INTO client_instance DEFAULT VALUES RETURNING id'
    );
    return rows[0]!.id;
  }

  it('14: a LOGIN failure writes one PIN_FAILURE; an approval failure writes none', async () => {
    const instance = await clientInstance();
    await verifyPinThrottled('LOGIN', WRONG_PIN, { clientInstanceId: instance });
    await verifyPinThrottled('LOGIN', WRONG_PIN);
    await verifyPinThrottled('MANAGER_APPROVAL', WRONG_PIN, { clientInstanceId: instance });
    expect(await events()).toEqual([
      { event_type: 'PIN_FAILURE', throttle_class: 'LOGIN', client_instance_id: instance },
      { event_type: 'PIN_FAILURE', throttle_class: 'LOGIN', client_instance_id: null },
    ]);
  });

  it('15: the fifth failure writes one COOLDOWN_STARTED per class; throttled and verified write none', async () => {
    await wrong('LOGIN', 5);
    await wrong('MANAGER_APPROVAL', 5);
    const cooldowns = (await events()).filter((e) => e.event_type === 'COOLDOWN_STARTED');
    expect(cooldowns.map((e) => e.throttle_class).sort()).toEqual(['LOGIN', 'MANAGER_APPROVAL']);
    const countBefore = (await events()).length;
    expect((await verifyPinThrottled('LOGIN', CASHIER_PIN)).outcome).toBe('THROTTLED');
    await ageCooldown('LOGIN');
    expect((await verifyPinThrottled('LOGIN', CASHIER_PIN)).outcome).toBe('VERIFIED');
    expect(await events()).toHaveLength(countBefore);
  });

  it('16: an unknown client instance rejects the call but the failure is still counted', async () => {
    await expect(
      verifyPinThrottled('LOGIN', WRONG_PIN, { clientInstanceId: randomUUID() })
    ).rejects.toMatchObject({ code: '23503' });
    expect((await bucket('LOGIN')).consecutive_failures).toBe(1);
  });

  it('17: failures from different client instances, and none, share one bucket', async () => {
    const a = await clientInstance();
    const b = await clientInstance();
    await verifyPinThrottled('LOGIN', WRONG_PIN, { clientInstanceId: a });
    await verifyPinThrottled('LOGIN', WRONG_PIN, { clientInstanceId: b });
    await verifyPinThrottled('LOGIN', WRONG_PIN);
    await verifyPinThrottled('LOGIN', WRONG_PIN, { clientInstanceId: a });
    expect(await verifyPinThrottled('LOGIN', WRONG_PIN, { clientInstanceId: b })).toEqual({
      outcome: 'FAILED',
      retryAfterSeconds: 300,
    });
    expect((await bucket('LOGIN')).consecutive_failures).toBe(5);
  });
});

describe('durability and shape', () => {
  it('18: a fresh module still refuses, and the table is a permanent one', async () => {
    await wrong('LOGIN', 5);
    vi.resetModules();
    const fresh = await import('../src/domain/throttle.js');
    const freshPool = await import('../src/db/pool.js');
    try {
      expect((await fresh.verifyPinThrottled('LOGIN', CASHIER_PIN)).outcome).toBe('THROTTLED');
    } finally {
      await freshPool.getPool().end();
    }
    const rows = await ownerQuery<{ relpersistence: string }>(
      `SELECT relpersistence FROM pg_class WHERE relname = 'pin_throttle_bucket'`
    );
    expect(rows[0]?.relpersistence).toBe('p');
  });

  it('19: the module exports exactly the agreed names', () => {
    expect(Object.keys(throttleModule).sort()).toEqual([
      'COOLDOWN_MINUTES',
      'MAX_FAILURES',
      'verifyPinThrottled',
    ]);
  });

  it('20: a missing bucket row is an error, never "not throttled"', async () => {
    await ownerQuery(`DELETE FROM pin_throttle_bucket WHERE throttle_class = 'LOGIN'`);
    await expect(verifyPinThrottled('LOGIN', CASHIER_PIN)).rejects.toThrow();
  });

  it('21: no error and no event row contains the PIN', async () => {
    const pin = WRONG_PIN;
    let thrown = '';
    try {
      await verifyPinThrottled('LOGIN', pin, { clientInstanceId: randomUUID() });
    } catch (err) {
      thrown += JSON.stringify(err, Object.getOwnPropertyNames(err));
    }
    await ownerQuery(`DELETE FROM pin_throttle_bucket WHERE throttle_class = 'MANAGER_APPROVAL'`);
    try {
      await verifyPinThrottled('MANAGER_APPROVAL', pin);
    } catch (err) {
      thrown += JSON.stringify(err, Object.getOwnPropertyNames(err));
    }
    expect(thrown).not.toBe('');
    expect(thrown).not.toContain(pin);
    expect(JSON.stringify(await events())).not.toContain(pin);
  });
});
