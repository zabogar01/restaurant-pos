import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManager } from '../scripts/create-manager.js';
import { getPool } from '../src/db/pool.js';
import { writeSecurityEvent } from '../src/domain/audit.js';
import * as credentialModule from '../src/domain/back-office-credential.js';
import {
  PASSWORD_COOLDOWN_MINUTES,
  PASSWORD_MAX_FAILURES,
  createBackOfficeCredential,
  normaliseUsername,
  verifyPasswordThrottled,
} from '../src/domain/back-office-credential.js';
import { createStaffUser, findUserByPin } from '../src/domain/pin.js';
import { verifyPinThrottled } from '../src/domain/throttle.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';

const PASSWORD = 'correct horse battery';
const WRONG = 'a password nobody holds';
const BUDI_PIN = '222222';
const SITI_PIN = '333333';
const CASHIER_PIN = '111111';
const WRONG_PIN = '987654';

let budiId: string;
let sitiId: string;

beforeEach(async () => {
  await resetDatabase();
  budiId = (await createStaffUser({ name: 'Budi', role: 'MANAGER', pin: BUDI_PIN })).id;
  sitiId = (await createStaffUser({ name: 'Siti', role: 'MANAGER', pin: SITI_PIN })).id;
  await createBackOfficeCredential({ staffUserId: budiId, username: 'budi', password: PASSWORD });
  await createBackOfficeCredential({ staffUserId: sitiId, username: 'siti', password: PASSWORD });
});

afterAll(async () => {
  await getPool().end();
});

interface CredentialRow {
  consecutive_failures: number;
  blocked_until: string | null;
  remaining: string | null;
}

async function credential(staffUserId: string): Promise<CredentialRow> {
  const rows = await ownerQuery<CredentialRow>(
    `SELECT consecutive_failures,
            blocked_until::text AS blocked_until,
            extract(epoch FROM blocked_until - clock_timestamp())::text AS remaining
       FROM back_office_credential
      WHERE staff_user_id = $1`,
    [staffUserId]
  );
  const row = rows[0];
  if (!row) throw new Error('credential row missing');
  return row;
}

async function buckets() {
  return ownerQuery(
    `SELECT throttle_class, consecutive_failures, blocked_until::text AS blocked_until
       FROM pin_throttle_bucket ORDER BY throttle_class`
  );
}

interface EventRow {
  event_type: string;
  throttle_class: string;
  client_instance_id: string | null;
}

async function events(): Promise<EventRow[]> {
  return ownerQuery(
    `SELECT event_type, throttle_class, client_instance_id FROM security_event ORDER BY id`
  );
}

async function count(table: 'audit_entry' | 'security_event' | 'staff_user' | 'back_office_credential') {
  const rows = await ownerQuery<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0]!.n;
}

async function wrong(account: credentialModule.BackOfficeAccount, times: number) {
  const results = [];
  for (let i = 0; i < times; i++) results.push(await verifyPasswordThrottled(account, WRONG));
  return results;
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

async function holdRow(staffUserId: string) {
  const owner = await ownerClient();
  await owner.query('BEGIN');
  await owner.query(`SELECT 1 FROM back_office_credential WHERE staff_user_id = $1 FOR UPDATE`, [
    staffUserId,
  ]);
  return owner;
}

function dump(err: unknown): string {
  return JSON.stringify(err, Object.getOwnPropertyNames(err));
}

describe('creation and the username', () => {
  it('1: normaliseUsername trims, lower-cases and refuses what does not fit', () => {
    expect(normaliseUsername('  Budi.S ')).toBe('budi.s');
    expect(normaliseUsername('ab')).toBeNull();
    expect(normaliseUsername('a'.repeat(33))).toBeNull();
    expect(normaliseUsername('a'.repeat(32))).toBe('a'.repeat(32));
    expect(normaliseUsername('bu di')).toBeNull();
    expect(normaliseUsername('budé')).toBeNull();
    expect(normaliseUsername('bu@di')).toBeNull();
    expect(normaliseUsername('.budi')).toBeNull();
    expect(normaliseUsername('_budi')).toBeNull();
    expect(normaliseUsername('-budi')).toBeNull();
    // U+212A lower-cases to an ASCII "k"; the rule is ASCII only.
    expect(normaliseUsername('Kate')).toBeNull();
  });

  it('2: a username is taken by anyone, active or not, whatever its case', async () => {
    const other = (await createStaffUser({ name: 'Other', role: 'MANAGER', pin: '444444' })).id;
    await expect(
      createBackOfficeCredential({ staffUserId: other, username: 'Budi', password: PASSWORD })
    ).rejects.toThrow('Username is already taken');
    await ownerQuery(`UPDATE staff_user SET is_active = false WHERE id = $1`, [budiId]);
    await expect(
      createBackOfficeCredential({ staffUserId: other, username: 'Budi', password: PASSWORD })
    ).rejects.toThrow('Username is already taken');
  });

  it('3: a password is 8 to 128 code points', async () => {
    let nextPin = 100100;
    const make = async (username: string, password: string) =>
      createBackOfficeCredential({
        staffUserId: (await createStaffUser({ name: username, role: 'MANAGER', pin: String(nextPin++) })).id,
        username,
        password,
      });
    await expect(make('user.seven', 'a'.repeat(7))).rejects.toThrow('Password must be 8 to 128');
    await expect(make('user.long', 'a'.repeat(129))).rejects.toThrow('Password must be 8 to 128');
    await expect(make('user.eight', 'a'.repeat(8))).resolves.toEqual({ username: 'user.eight' });
    await expect(make('user.max', 'a'.repeat(128))).resolves.toEqual({ username: 'user.max' });
    const emoji = '😀'.repeat(8);
    expect(emoji.length).toBe(16);
    await expect(make('user.emoji', emoji)).resolves.toEqual({ username: 'user.emoji' });
  });

  it('4: a second credential and an unknown staff user are refused, each in its own words', async () => {
    const messages: string[] = [];
    const attempt = async (staffUserId: string) => {
      try {
        await createBackOfficeCredential({ staffUserId, username: 'fresh.name', password: 'fresh-secret-1' });
      } catch (err) {
        messages.push((err as Error).message);
      }
    };
    await attempt(budiId);
    await attempt(randomUUID());
    expect(messages).toEqual([
      'Staff user already has a back-office credential',
      'Staff user does not exist',
    ]);
    for (const message of messages) {
      expect(message).not.toContain('fresh.name');
      expect(message).not.toContain('fresh-secret-1');
    }
  });

  it('5: the row holds the lower-cased username and an Argon2id hash, never the password', async () => {
    const id = (await createStaffUser({ name: 'Ani', role: 'MANAGER', pin: '555555' })).id;
    await createBackOfficeCredential({ staffUserId: id, username: 'Ani.Wati', password: 'plain-text-pw-1' });
    const rows = await ownerQuery<{ username: string; password_hash: string }>(
      `SELECT username, password_hash FROM back_office_credential WHERE staff_user_id = $1`,
      [id]
    );
    expect(rows[0]?.username).toBe('ani.wati');
    expect(rows[0]?.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('plain-text-pw-1');
  });
});

describe('counting', () => {
  it('6: four wrong passwords count without a cooldown, then the correct one verifies and resets', async () => {
    const results = await wrong({ username: 'budi' }, 4);
    expect(results).toEqual(Array(4).fill({ outcome: 'FAILED', retryAfterSeconds: null }));
    const row = await credential(budiId);
    expect(row.consecutive_failures).toBe(4);
    expect(row.blocked_until).toBeNull();
    expect(await verifyPasswordThrottled({ username: 'budi' }, PASSWORD)).toEqual({
      outcome: 'VERIFIED',
      user: { id: budiId, role: 'MANAGER', credentialVersion: 1 },
    });
    const after = await credential(budiId);
    expect(after.consecutive_failures).toBe(0);
    expect(after.blocked_until).toBeNull();
  });

  it('7: the fifth wrong password starts a five-minute cooldown', async () => {
    expect(PASSWORD_MAX_FAILURES).toBe(5);
    const results = await wrong({ username: 'budi' }, 5);
    expect(results[4]).toEqual({ outcome: 'FAILED', retryAfterSeconds: PASSWORD_COOLDOWN_MINUTES * 60 });
    const row = await credential(budiId);
    expect(row.consecutive_failures).toBe(5);
    expect(Number(row.remaining)).toBeGreaterThan(295);
    expect(Number(row.remaining)).toBeLessThanOrEqual(300);
  });

  it('8: during the cooldown the correct password is THROTTLED and nothing is written', async () => {
    await wrong({ username: 'budi' }, 5);
    const before = await credential(budiId);
    const result = await verifyPasswordThrottled({ username: 'budi' }, PASSWORD);
    expect(result.outcome).toBe('THROTTLED');
    if (result.outcome !== 'THROTTLED') throw new Error('unreachable');
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(300);
    const after = await credential(budiId);
    expect(after.consecutive_failures).toBe(before.consecutive_failures);
    expect(after.blocked_until).toBe(before.blocked_until);
  });

  it('9: retryAfterSeconds is the time left on a cooldown set by the owner', async () => {
    await ownerQuery(
      `UPDATE back_office_credential
          SET consecutive_failures = 5, blocked_until = clock_timestamp() + interval '30 seconds'
        WHERE staff_user_id = $1`,
      [budiId]
    );
    const result = await verifyPasswordThrottled({ username: 'budi' }, PASSWORD);
    expect(result.outcome).toBe('THROTTLED');
    if (result.outcome !== 'THROTTLED') throw new Error('unreachable');
    expect([29, 30]).toContain(result.retryAfterSeconds);
  });
});

describe('the reset when a cooldown ends', () => {
  async function ageCooldown() {
    await ownerQuery(
      `UPDATE back_office_credential
          SET consecutive_failures = 5, blocked_until = clock_timestamp() - interval '1 second'
        WHERE staff_user_id = $1`,
      [budiId]
    );
  }

  it('10: a wrong password after an ended cooldown counts as the first failure', async () => {
    await ageCooldown();
    expect(await verifyPasswordThrottled({ username: 'budi' }, WRONG)).toEqual({
      outcome: 'FAILED',
      retryAfterSeconds: null,
    });
    const row = await credential(budiId);
    expect(row.consecutive_failures).toBe(1);
    expect(row.blocked_until).toBeNull();
    const more = await wrong({ username: 'budi' }, 3);
    expect(more.every((r) => r.outcome === 'FAILED' && r.retryAfterSeconds === null)).toBe(true);
    expect(await wrong({ username: 'budi' }, 1)).toEqual([{ outcome: 'FAILED', retryAfterSeconds: 300 }]);
  });

  it('11: a correct password after an ended cooldown verifies and resets the row', async () => {
    await ageCooldown();
    expect((await verifyPasswordThrottled({ username: 'budi' }, PASSWORD)).outcome).toBe('VERIFIED');
    const row = await credential(budiId);
    expect(row.consecutive_failures).toBe(0);
    expect(row.blocked_until).toBeNull();
  });
});

describe('who may succeed', () => {
  it('12: a correct password for a deactivated manager or for a cashier is a counted failure', async () => {
    await ownerQuery(`UPDATE staff_user SET is_active = false WHERE id = $1`, [budiId]);
    await wrong({ username: 'budi' }, 4);
    expect(await verifyPasswordThrottled({ username: 'budi' }, PASSWORD)).toEqual({
      outcome: 'FAILED',
      retryAfterSeconds: 300,
    });
    expect((await credential(budiId)).consecutive_failures).toBe(5);

    const cashierId = (await createStaffUser({ name: 'Cashier', role: 'CASHIER', pin: CASHIER_PIN })).id;
    await createBackOfficeCredential({ staffUserId: cashierId, username: 'kasir', password: PASSWORD });
    await wrong({ username: 'kasir' }, 4);
    expect(await verifyPasswordThrottled({ username: 'kasir' }, PASSWORD)).toEqual({
      outcome: 'FAILED',
      retryAfterSeconds: 300,
    });
    expect((await credential(cashierId)).consecutive_failures).toBe(5);
  });

  it('13: an id and a username count on the same row, and the username is normalised', async () => {
    await wrong({ staffUserId: budiId }, 3);
    await wrong({ username: 'budi' }, 1);
    expect(await verifyPasswordThrottled({ username: 'BUDI ' }, WRONG)).toEqual({
      outcome: 'FAILED',
      retryAfterSeconds: 300,
    });
    expect((await credential(budiId)).consecutive_failures).toBe(5);
    expect((await credential(sitiId)).consecutive_failures).toBe(0);
  });
});

describe('no row', () => {
  it('14: an account that does not exist fails, is never throttled and counts nowhere', async () => {
    const noCredential = (await createStaffUser({ name: 'Nobody', role: 'MANAGER', pin: '666666' })).id;
    const accounts: credentialModule.BackOfficeAccount[] = [
      { username: 'nobody.here' },
      { username: 'x' },
      { staffUserId: 'not-a-uuid' },
      { staffUserId: noCredential },
    ];
    for (const account of accounts) {
      const before = (await events()).length;
      expect(await verifyPasswordThrottled(account, PASSWORD)).toEqual({
        outcome: 'FAILED',
        retryAfterSeconds: null,
      });
      expect((await events()).length).toBe(before + 1);
    }
    for (let i = 0; i < 20; i++) {
      expect(await verifyPasswordThrottled({ username: 'nobody.here' }, WRONG)).toEqual({
        outcome: 'FAILED',
        retryAfterSeconds: null,
      });
    }
    const written = await events();
    expect(written).toHaveLength(24);
    expect(written.every((e) => e.event_type === 'PASSWORD_FAILURE')).toBe(true);
    expect((await credential(budiId)).consecutive_failures).toBe(0);
  }, 30_000);
});

describe('isolation from the PIN throttle (FR-A5b, AC-35)', () => {
  it('15: five wrong passwords leave another account and both PIN buckets alone', async () => {
    const before = await buckets();
    await wrong({ username: 'budi' }, 5);
    expect((await verifyPasswordThrottled({ username: 'siti' }, PASSWORD)).outcome).toBe('VERIFIED');
    expect(await buckets()).toEqual(before);
  });

  it('16: a PIN cooldown leaves passwords alone, and a successful password leaves the buckets alone', async () => {
    for (let i = 0; i < 5; i++) await verifyPinThrottled('LOGIN', WRONG_PIN);
    const before = await buckets();
    expect(before.find((b) => b.throttle_class === 'LOGIN')?.consecutive_failures).toBe(5);
    expect((await verifyPasswordThrottled({ username: 'budi' }, PASSWORD)).outcome).toBe('VERIFIED');
    expect(await buckets()).toEqual(before);
  });

  it('17: a successful PIN login does not reset the password count', async () => {
    await wrong({ username: 'budi' }, 4);
    expect((await verifyPinThrottled('LOGIN', BUDI_PIN)).outcome).toBe('VERIFIED');
    expect(await verifyPasswordThrottled({ username: 'budi' }, WRONG)).toEqual({
      outcome: 'FAILED',
      retryAfterSeconds: 300,
    });
    expect((await credential(budiId)).blocked_until).not.toBeNull();
  });
});

describe('concurrency', () => {
  it('18: twenty-five simultaneous wrong passwords settle as five failures and twenty throttled', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => verifyPasswordThrottled({ username: 'budi' }, WRONG))
    );
    expect(results.filter((r) => r.outcome === 'FAILED')).toHaveLength(5);
    expect(results.filter((r) => r.outcome === 'THROTTLED')).toHaveLength(20);
    expect((await credential(budiId)).consecutive_failures).toBe(5);
    const written = await events();
    expect(written.filter((e) => e.event_type === 'PASSWORD_FAILURE')).toHaveLength(5);
    expect(written.filter((e) => e.event_type === 'COOLDOWN_STARTED')).toHaveLength(1);
  }, 30_000);

  it('19: the row lock is real: attempts queue behind it and are counted one at a time', async () => {
    const owner = await holdRow(budiId);
    try {
      const attempts = Array.from({ length: 12 }, () => verifyPasswordThrottled({ username: 'budi' }, WRONG));
      await until(async () => (await waitingBackends()) >= 6);
      await owner.query('COMMIT');
      const results = await Promise.all(attempts);
      expect(results.filter((r) => r.outcome === 'FAILED')).toHaveLength(5);
      expect(results.filter((r) => r.outcome === 'THROTTLED')).toHaveLength(7);
    } finally {
      await owner.end();
    }
  }, 30_000);

  it('20: the decision is made from the row as read under the lock', async () => {
    const owner = await holdRow(budiId);
    try {
      const attempt = verifyPasswordThrottled({ username: 'budi' }, PASSWORD);
      await until(async () => (await waitingBackends()) >= 1);
      await owner.query(
        `UPDATE back_office_credential
            SET consecutive_failures = 5, blocked_until = clock_timestamp() + interval '5 minutes'
          WHERE staff_user_id = $1`,
        [budiId]
      );
      await owner.query('COMMIT');
      expect((await attempt).outcome).toBe('THROTTLED');
    } finally {
      await owner.end();
    }
  }, 30_000);

  it('21: seconds remaining are read after the wait, never above 300', async () => {
    const owner = await holdRow(budiId);
    try {
      const attempt = verifyPasswordThrottled({ username: 'budi' }, PASSWORD);
      await until(async () => (await waitingBackends()) >= 1);
      await owner.query('SELECT pg_sleep(2)');
      await owner.query(
        `UPDATE back_office_credential
            SET consecutive_failures = 5, blocked_until = clock_timestamp() + interval '5 minutes'
          WHERE staff_user_id = $1`,
        [budiId]
      );
      await owner.query('COMMIT');
      const result = await attempt;
      expect(result.outcome).toBe('THROTTLED');
      if (result.outcome !== 'THROTTLED') throw new Error('unreachable');
      expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(298);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(300);
    } finally {
      await owner.end();
    }
  }, 30_000);

  it('22: a cooldown that ended during the wait no longer refuses', async () => {
    await ownerQuery(
      `UPDATE back_office_credential
          SET consecutive_failures = 5, blocked_until = clock_timestamp() + interval '2 seconds'
        WHERE staff_user_id = $1`,
      [budiId]
    );
    const owner = await holdRow(budiId);
    try {
      const attempt = verifyPasswordThrottled({ username: 'budi' }, PASSWORD);
      await until(async () => (await waitingBackends()) >= 1);
      await owner.query('SELECT pg_sleep(3)');
      await owner.query('COMMIT');
      expect((await attempt).outcome).toBe('VERIFIED');
      const row = await credential(budiId);
      expect(row.consecutive_failures).toBe(0);
      expect(row.blocked_until).toBeNull();
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

  it('23: failures write PASSWORD_FAILURE and the fifth a COOLDOWN_STARTED; nothing else writes', async () => {
    const instance = await clientInstance();
    await verifyPasswordThrottled({ username: 'budi' }, WRONG, { clientInstanceId: instance });
    await verifyPasswordThrottled({ username: 'budi' }, WRONG);
    expect(await events()).toEqual([
      { event_type: 'PASSWORD_FAILURE', throttle_class: 'BACK_OFFICE_LOGIN', client_instance_id: instance },
      { event_type: 'PASSWORD_FAILURE', throttle_class: 'BACK_OFFICE_LOGIN', client_instance_id: null },
    ]);
    await wrong({ username: 'budi' }, 3);
    const cooldowns = (await events()).filter((e) => e.event_type === 'COOLDOWN_STARTED');
    expect(cooldowns).toEqual([
      { event_type: 'COOLDOWN_STARTED', throttle_class: 'BACK_OFFICE_LOGIN', client_instance_id: null },
    ]);
    const written = (await events()).length;
    expect((await verifyPasswordThrottled({ username: 'budi' }, PASSWORD)).outcome).toBe('THROTTLED');
    await ownerQuery(
      `UPDATE back_office_credential SET blocked_until = clock_timestamp() - interval '1 second'
        WHERE staff_user_id = $1`,
      [budiId]
    );
    expect((await verifyPasswordThrottled({ username: 'budi' }, PASSWORD)).outcome).toBe('VERIFIED');
    expect(await events()).toHaveLength(written);
    expect(await count('audit_entry')).toBe(0);
  });

  it('24: an unknown client instance rejects the call but the failure is still counted', async () => {
    await expect(
      verifyPasswordThrottled({ username: 'budi' }, WRONG, { clientInstanceId: randomUUID() })
    ).rejects.toMatchObject({ code: '23503' });
    expect((await credential(budiId)).consecutive_failures).toBe(1);
  });

  it('25: no event and no error contains the username typed, the password or the hash', async () => {
    const typed = 'Typed.Name';
    const secret = 'my-very-secret-pw';
    let thrown = '';
    try {
      await verifyPasswordThrottled({ username: typed }, secret, { clientInstanceId: randomUUID() });
    } catch (err) {
      thrown += dump(err);
    }
    try {
      await verifyPasswordThrottled({ username: 'budi' }, secret, { clientInstanceId: randomUUID() });
    } catch (err) {
      thrown += dump(err);
    }
    for (const input of [
      { staffUserId: budiId, username: 'budi', password: secret },
      { staffUserId: randomUUID(), username: typed, password: secret },
      { staffUserId: sitiId, username: typed, password: 'short' },
    ]) {
      try {
        await createBackOfficeCredential(input);
      } catch (err) {
        thrown += dump(err);
      }
    }
    const hashes = await ownerQuery<{ password_hash: string }>(
      `SELECT password_hash FROM back_office_credential`
    );
    const everything = thrown + JSON.stringify(await events());
    expect(thrown).not.toBe('');
    for (const hidden of [typed, typed.toLowerCase(), secret, ...hashes.map((h) => h.password_hash)]) {
      expect(everything).not.toContain(hidden);
    }
  });
});

describe('durability, grants and shape', () => {
  it('26: a fresh module still refuses, and the table is a permanent one', async () => {
    await wrong({ username: 'budi' }, 5);
    vi.resetModules();
    const fresh = await import('../src/domain/back-office-credential.js');
    const freshPool = await import('../src/db/pool.js');
    try {
      expect((await fresh.verifyPasswordThrottled({ username: 'budi' }, PASSWORD)).outcome).toBe('THROTTLED');
    } finally {
      await freshPool.getPool().end();
    }
    const rows = await ownerQuery<{ relpersistence: string }>(
      `SELECT relpersistence FROM pg_class WHERE relname = 'back_office_credential'`
    );
    expect(rows[0]?.relpersistence).toBe('p');
  });

  it('27: pos_app cannot delete a credential or change its username or owner', async () => {
    const pool = getPool();
    await expect(pool.query('DELETE FROM back_office_credential')).rejects.toMatchObject({ code: '42501' });
    await expect(pool.query(`UPDATE back_office_credential SET username = 'changed.name'`)).rejects.toMatchObject({
      code: '42501',
    });
    await expect(
      pool.query('UPDATE back_office_credential SET staff_user_id = $1', [randomUUID()])
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('28: the module exports exactly the agreed names and audit accepts the new values', async () => {
    expect(Object.keys(credentialModule).sort()).toEqual([
      'PASSWORD_COOLDOWN_MINUTES',
      'PASSWORD_MAX_FAILURES',
      'createBackOfficeCredential',
      'normaliseUsername',
      'verifyPasswordThrottled',
    ]);
    await expect(
      writeSecurityEvent({ eventType: 'PASSWORD_FAILURE', throttleClass: 'BACK_OFFICE_LOGIN' })
    ).resolves.toBeUndefined();
    await expect(
      writeSecurityEvent({ eventType: 'LOGIN_OK' as never, throttleClass: 'BACK_OFFICE_LOGIN' })
    ).rejects.toThrow('invalid security event');
    await expect(
      writeSecurityEvent({ eventType: 'PASSWORD_FAILURE', throttleClass: 'X' as never })
    ).rejects.toThrow('invalid security event');
  });
});

describe('the first-manager script', () => {
  const answers = { name: 'Dewi', pin: '777777', username: 'Dewi.Owner', password: 'owner-password-1' };

  it('29: it creates an active manager with that PIN and a working credential, and writes no evidence', async () => {
    const created = await createManager(answers);
    expect(created.username).toBe('dewi.owner');
    expect(await findUserByPin(answers.pin)).toEqual({ id: created.id, role: 'MANAGER', credentialVersion: 1 });
    expect(await verifyPasswordThrottled({ username: 'dewi.owner' }, answers.password)).toEqual({
      outcome: 'VERIFIED',
      user: { id: created.id, role: 'MANAGER', credentialVersion: 1 },
    });
    expect(await count('audit_entry')).toBe(0);
    expect(await count('security_event')).toBe(0);
  });

  it('30: a refusal creates neither row and its message holds no value typed', async () => {
    const staff = await count('staff_user');
    const credentials = await count('back_office_credential');
    const refusals: string[] = [];
    for (const input of [
      { ...answers, username: 'budi' },
      { ...answers, pin: BUDI_PIN },
    ]) {
      try {
        await createManager(input);
      } catch (err) {
        refusals.push((err as Error).message);
      }
    }
    expect(refusals).toEqual(['Username is already taken', 'PIN already in use']);
    expect(await count('staff_user')).toBe(staff);
    expect(await count('back_office_credential')).toBe(credentials);
    for (const message of refusals) {
      for (const typed of Object.values(answers)) expect(message).not.toContain(typed);
    }
  });

  it('31: with a manager already present, a second one is created', async () => {
    const managers = async () =>
      (await ownerQuery<{ n: number }>(`SELECT count(*)::int AS n FROM staff_user WHERE role = 'MANAGER'`))[0]!.n;
    const before = await managers();
    await createManager(answers);
    await createManager({ name: 'Eko', pin: '888888', username: 'eko', password: 'another-pass-1' });
    expect(await managers()).toBe(before + 2);
  });
});
