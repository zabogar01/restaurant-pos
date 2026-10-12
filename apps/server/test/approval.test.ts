import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '../src/db/pool.js';
import {
  recordApprovalCancelled,
  withManagerApproval,
  type ApprovalRequest,
} from '../src/domain/approval.js';
import { COOLDOWN_MINUTES, MAX_FAILURES, verifyPinThrottled } from '../src/domain/throttle.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import {
  ageOutPinCooldown,
  auditCount,
  bucket,
  makePeople,
  securityEvents,
  type Person,
} from './support/people.js';

const people = makePeople(640000);
const NOBODY_PIN = '999111';
const OTHER_NOBODY_PIN = '999222';

let cashier: Person;
let manager: Person;
let otherManager: Person;

beforeEach(async () => {
  await resetDatabase();
  // A table the work callback can write to, so a rollback is observable.
  await ownerQuery('CREATE TABLE approval_probe (note text NOT NULL)');
  await ownerQuery('GRANT INSERT ON approval_probe TO pos_app');
  cashier = await people.cashier();
  manager = await people.manager();
  otherManager = await people.manager();
});

afterAll(async () => {
  await getPool().end();
});

interface EntryRow {
  actor_id: string;
  approver_id: string | null;
  action: string;
  outcome: string;
  subject_type: string | null;
  subject_id: string | null;
  reason: string | null;
  before_amount: string | null;
  after_amount: string | null;
}

async function entriesOf(actorId: string): Promise<EntryRow[]> {
  return ownerQuery<EntryRow>(
    `SELECT actor_id, approver_id, action, outcome, subject_type, subject_id, reason,
            before_amount::text, after_amount::text
       FROM audit_entry WHERE actor_id = $1 ORDER BY id`,
    [actorId]
  );
}

async function probeRows(): Promise<string[]> {
  return (await ownerQuery<{ note: string }>('SELECT note FROM approval_probe')).map((r) => r.note);
}

function request(overrides: Partial<ApprovalRequest> & { actorId: string; managerPin: string }): ApprovalRequest {
  return {
    action: 'TEST_ACTION',
    subject: { type: 'probe', id: 'p-1' },
    ...overrides,
  };
}

/** A work callback that was never meant to run; counts its calls. */
function countingWork() {
  const calls = { n: 0 };
  const work = async () => {
    calls.n += 1;
    return { result: 'ran' };
  };
  return { calls, work };
}

async function fail(actorId: string, pin: string, times = 1) {
  const { work } = countingWork();
  const results = [];
  for (let i = 0; i < times; i++) {
    results.push(await withManagerApproval(request({ actorId, managerPin: pin }), work));
  }
  return results;
}

async function failedLogins(times: number) {
  for (let i = 0; i < times; i++) {
    await verifyPinThrottled('LOGIN', NOBODY_PIN);
  }
}

async function eventsOfClass(throttleClass: string) {
  return (await securityEvents()).filter((e) => e.throttle_class === throttleClass);
}

describe('approved', () => {
  it('4: another manager approves; the work runs once inside a transaction and one SUCCESS entry carries everything', async () => {
    let calls = 0;
    let visibleElsewhere: string[] | undefined;
    let approverSeen: string | undefined;
    const outcome = await withManagerApproval(
      request({ actorId: cashier.id, managerPin: manager.pin, reason: 'wrong item rung', action: 'VOID_ITEM' }),
      async (client, approver) => {
        calls += 1;
        approverSeen = approver.id;
        await client.query(`INSERT INTO approval_probe (note) VALUES ('from work')`);
        // Another connection cannot see it yet: the work is inside an open transaction.
        visibleElsewhere = await probeRows();
        return { result: { done: true }, beforeAmount: 12500n, afterAmount: 0n };
      }
    );

    expect(outcome).toEqual({ outcome: 'APPROVED', result: { done: true } });
    expect(calls).toBe(1);
    expect(approverSeen).toBe(manager.id);
    expect(visibleElsewhere).toEqual([]);
    expect(await entriesOf(cashier.id)).toEqual([
      {
        actor_id: cashier.id,
        approver_id: manager.id,
        action: 'VOID_ITEM',
        outcome: 'SUCCESS',
        subject_type: 'probe',
        subject_id: 'p-1',
        reason: 'wrong item rung',
        before_amount: '12500',
        after_amount: '0',
      },
    ]);
  });

  it('5: an approval resets MANAGER_APPROVAL after two failures and leaves the LOGIN row identical', async () => {
    await failedLogins(1);
    await fail(cashier.id, NOBODY_PIN, 2);
    expect(JSON.parse(await bucket('MANAGER_APPROVAL')).consecutive_failures).toBe(2);
    const loginBefore = await bucket('LOGIN');

    const { work } = countingWork();
    const outcome = await withManagerApproval(request({ actorId: cashier.id, managerPin: manager.pin }), work);

    expect(outcome.outcome).toBe('APPROVED');
    const after = JSON.parse(await bucket('MANAGER_APPROVAL'));
    expect(after.consecutive_failures).toBe(0);
    expect(after.blocked_until).toBeNull();
    expect(await bucket('LOGIN')).toBe(loginBefore);
  });

  it('6: a manager approves their own action with their own PIN, approver equal to actor', async () => {
    const { work } = countingWork();
    const outcome = await withManagerApproval(request({ actorId: manager.id, managerPin: manager.pin }), work);
    expect(outcome.outcome).toBe('APPROVED');
    const [entry] = await entriesOf(manager.id);
    expect(entry?.outcome).toBe('SUCCESS');
    expect(entry?.approver_id).toBe(manager.id);
    expect(entry?.actor_id).toBe(manager.id);
  });

  it('12: once the cooldown has passed the right PIN approves', async () => {
    await fail(cashier.id, NOBODY_PIN, MAX_FAILURES);
    await ageOutPinCooldown('MANAGER_APPROVAL');
    const { calls, work } = countingWork();
    const outcome = await withManagerApproval(request({ actorId: cashier.id, managerPin: manager.pin }), work);
    expect(outcome.outcome).toBe('APPROVED');
    expect(calls.n).toBe(1);
  });
});

describe('refused', () => {
  async function expectFailureLeavesOneStrike(actorId: string, pin: string, expected: unknown) {
    const before = JSON.parse(await bucket('MANAGER_APPROVAL')).consecutive_failures as number;
    const eventsBefore = (await securityEvents()).length;
    const { calls, work } = countingWork();

    const outcome = await withManagerApproval(request({ actorId, managerPin: pin }), work);

    expect(outcome).toEqual(expected);
    expect(calls.n).toBe(0);
    expect(JSON.parse(await bucket('MANAGER_APPROVAL')).consecutive_failures).toBe(before + 1);
    expect((await securityEvents()).length).toBe(eventsBefore);
    const entries = await entriesOf(actorId);
    expect(entries).toEqual([
      {
        actor_id: actorId,
        approver_id: null,
        action: 'TEST_ACTION',
        outcome: 'APPROVAL_FAILED',
        subject_type: 'probe',
        subject_id: 'p-1',
        reason: null,
        before_amount: null,
        after_amount: null,
      },
    ]);
  }

  it('7: a PIN that matches nobody fails, runs nothing, counts one strike and writes one APPROVAL_FAILED', async () => {
    await expectFailureLeavesOneStrike(cashier.id, NOBODY_PIN, { outcome: 'FAILED', retryAfterSeconds: null });
  });

  it('8: an active cashier\'s PIN, the actor\'s own included, answers exactly as a PIN that matches nobody', async () => {
    const nobody = await fail(otherManager.id, NOBODY_PIN);
    const { calls, work } = countingWork();
    const bystander = await people.cashier();
    const theirs = await withManagerApproval(request({ actorId: manager.id, managerPin: bystander.pin }), work);
    const own = await withManagerApproval(request({ actorId: cashier.id, managerPin: cashier.pin }), work);

    expect(theirs).toEqual(nobody[0]);
    expect(own).toEqual(nobody[0]);
    expect(own).toEqual({ outcome: 'FAILED', retryAfterSeconds: null });
    expect(calls.n).toBe(0);
    // Three strikes, never reset by a cashier's valid PIN.
    expect(JSON.parse(await bucket('MANAGER_APPROVAL')).consecutive_failures).toBe(3);
    for (const actor of [manager.id, cashier.id]) {
      const [entry] = await entriesOf(actor);
      expect(entry?.outcome).toBe('APPROVAL_FAILED');
      expect(entry?.approver_id).toBeNull();
    }
    expect(await securityEvents()).toEqual([]);
  });

  it('9: a deactivated manager\'s PIN fails like any other', async () => {
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [otherManager.id]);
    await expectFailureLeavesOneStrike(cashier.id, otherManager.pin, { outcome: 'FAILED', retryAfterSeconds: null });
  });

  it('10: the failure that reaches MAX_FAILURES reports the cooldown and starts exactly one COOLDOWN_STARTED', async () => {
    const results = await fail(cashier.id, NOBODY_PIN, MAX_FAILURES);

    for (const earlier of results.slice(0, MAX_FAILURES - 1)) {
      expect(earlier).toEqual({ outcome: 'FAILED', retryAfterSeconds: null });
    }
    const last = results[MAX_FAILURES - 1];
    expect(last?.outcome).toBe('FAILED');
    if (last?.outcome !== 'FAILED') throw new Error('unreachable');
    expect(last.retryAfterSeconds).toBeGreaterThan(0);
    expect(last.retryAfterSeconds).toBeLessThanOrEqual(COOLDOWN_MINUTES * 60);

    const entries = await entriesOf(cashier.id);
    expect(entries.map((e) => e.outcome)).toEqual(Array(MAX_FAILURES).fill('APPROVAL_FAILED'));
    const events = await securityEvents();
    expect(events.map((e) => `${e.event_type}:${e.throttle_class}`)).toEqual([
      'COOLDOWN_STARTED:MANAGER_APPROVAL',
    ]);
  });

  it('11: during the cooldown the right manager PIN is THROTTLED, runs nothing and leaves the bucket alone', async () => {
    await fail(cashier.id, NOBODY_PIN, MAX_FAILURES);
    const before = await bucket('MANAGER_APPROVAL');
    const eventsBefore = (await securityEvents()).length;
    const { calls, work } = countingWork();

    const outcome = await withManagerApproval(
      request({ actorId: cashier.id, managerPin: manager.pin, reason: 'must not be kept' }),
      work
    );

    expect(outcome.outcome).toBe('THROTTLED');
    if (outcome.outcome !== 'THROTTLED') throw new Error('unreachable');
    expect(outcome.retryAfterSeconds).toBeGreaterThan(0);
    expect(calls.n).toBe(0);
    expect(await bucket('MANAGER_APPROVAL')).toBe(before);
    expect((await securityEvents()).length).toBe(eventsBefore);

    const entries = await entriesOf(cashier.id);
    expect(entries).toHaveLength(MAX_FAILURES + 1);
    expect(entries[MAX_FAILURES]).toEqual({
      actor_id: cashier.id,
      approver_id: null,
      action: 'TEST_ACTION',
      outcome: 'APPROVAL_THROTTLED',
      subject_type: 'probe',
      subject_id: 'p-1',
      reason: null,
      before_amount: null,
      after_amount: null,
    });
  });
});

describe('failures of the work and of the evidence', () => {
  it('13: a work that throws surfaces the same error, writes no entry, rolls back its row and keeps the reset', async () => {
    await verifyPinThrottled('MANAGER_APPROVAL', NOBODY_PIN);
    expect(JSON.parse(await bucket('MANAGER_APPROVAL')).consecutive_failures).toBe(1);
    const boom = new Error('the work failed');

    await expect(
      withManagerApproval(request({ actorId: cashier.id, managerPin: manager.pin }), async (client) => {
        await client.query(`INSERT INTO approval_probe (note) VALUES ('should vanish')`);
        throw boom;
      })
    ).rejects.toBe(boom);

    expect(await entriesOf(cashier.id)).toEqual([]);
    expect(await probeRows()).toEqual([]);
    expect(JSON.parse(await bucket('MANAGER_APPROVAL')).consecutive_failures).toBe(0);
  });

  it('14: a SUCCESS entry that cannot be written fails the request and rolls back the work', async () => {
    const stranger = randomUUID();
    await expect(
      withManagerApproval(request({ actorId: stranger, managerPin: manager.pin }), async (client) => {
        await client.query(`INSERT INTO approval_probe (note) VALUES ('should vanish')`);
        return { result: 1 };
      })
    ).rejects.toThrow();

    expect(await probeRows()).toEqual([]);
    expect(await entriesOf(stranger)).toEqual([]);
  });

  it('14: a commit that fails leaves no SUCCESS entry, because the entry shares the work\'s transaction', async () => {
    // A deferred constraint is only checked at COMMIT, after the entry was written.
    await ownerQuery(
      'ALTER TABLE approval_probe ADD CONSTRAINT approval_probe_note_key UNIQUE (note) DEFERRABLE INITIALLY DEFERRED'
    );
    await expect(
      withManagerApproval(request({ actorId: cashier.id, managerPin: manager.pin }), async (client) => {
        await client.query(`INSERT INTO approval_probe (note) VALUES ('twice'), ('twice')`);
        return { result: 1 };
      })
    ).rejects.toMatchObject({ code: '23505' });

    expect(await probeRows()).toEqual([]);
    expect(await entriesOf(cashier.id)).toEqual([]);
  });

  it('15: an APPROVAL_FAILED entry that cannot be written makes the primitive throw, with the strike standing', async () => {
    const stranger = randomUUID();
    const { calls, work } = countingWork();

    await expect(
      withManagerApproval(request({ actorId: stranger, managerPin: NOBODY_PIN }), work)
    ).rejects.toThrow();

    expect(calls.n).toBe(0);
    expect(JSON.parse(await bucket('MANAGER_APPROVAL')).consecutive_failures).toBe(1);
    expect(await auditCount()).toBe(0);
  });

  it('16: an invalid request throws before any verification and changes nothing', async () => {
    const before = await bucket('MANAGER_APPROVAL');
    const { calls, work } = countingWork();
    const invalid: ApprovalRequest[] = [
      request({ actorId: cashier.id, managerPin: NOBODY_PIN, action: '   ' }),
      request({ actorId: '', managerPin: NOBODY_PIN }),
      request({ actorId: cashier.id, managerPin: NOBODY_PIN, subject: { type: 'probe', id: '' } }),
      request({ actorId: cashier.id, managerPin: NOBODY_PIN, subject: { type: '', id: 'p-1' } }),
    ];
    for (const bad of invalid) {
      await expect(withManagerApproval(bad, work)).rejects.toThrow(/invalid audit entry/);
    }
    // The PIN is wrong in every request, so a verification that ran first would have
    // counted a strike.
    expect(calls.n).toBe(0);
    expect(await bucket('MANAGER_APPROVAL')).toBe(before);
    expect(await auditCount()).toBe(0);
    expect(await securityEvents()).toEqual([]);
  });

  it('17: the transaction is committed before the function resolves', async () => {
    await withManagerApproval(request({ actorId: cashier.id, managerPin: manager.pin }), async (client) => {
      await client.query(`INSERT INTO approval_probe (note) VALUES ('committed')`);
      return { result: null };
    });
    expect(await probeRows()).toEqual(['committed']);
    expect((await entriesOf(cashier.id)).map((e) => e.outcome)).toEqual(['SUCCESS']);
  });
});

describe('the classes and the lock', () => {
  it('18: failed approvals and a successful login do not touch each other\'s count', async () => {
    await fail(cashier.id, NOBODY_PIN, MAX_FAILURES - 1);
    expect(await verifyPinThrottled('LOGIN', cashier.pin)).toMatchObject({ outcome: 'VERIFIED' });
    const [last] = await fail(cashier.id, NOBODY_PIN);
    expect(last?.outcome).toBe('FAILED');
    expect(typeof (last as { retryAfterSeconds: number | null }).retryAfterSeconds).toBe('number');
    expect((await eventsOfClass('MANAGER_APPROVAL')).map((e) => e.event_type)).toEqual(['COOLDOWN_STARTED']);
  });

  it('18: failed logins do not move the LOGIN row when an action is approved', async () => {
    await failedLogins(MAX_FAILURES - 1);
    const loginBefore = await bucket('LOGIN');
    const { work } = countingWork();
    const outcome = await withManagerApproval(request({ actorId: cashier.id, managerPin: manager.pin }), work);
    expect(outcome.outcome).toBe('APPROVED');
    expect(await bucket('LOGIN')).toBe(loginBefore);
    expect(JSON.parse(loginBefore).consecutive_failures).toBe(MAX_FAILURES - 1);
  });

  it('19: concurrent wrong approvals split into MAX_FAILURES failures and the rest throttled, one entry each', async () => {
    const total = MAX_FAILURES + 3;
    const { calls, work } = countingWork();
    const results = await Promise.all(
      Array.from({ length: total }, () =>
        withManagerApproval(request({ actorId: cashier.id, managerPin: OTHER_NOBODY_PIN }), work)
      )
    );

    expect(results.filter((r) => r.outcome === 'FAILED')).toHaveLength(MAX_FAILURES);
    expect(results.filter((r) => r.outcome === 'THROTTLED')).toHaveLength(total - MAX_FAILURES);
    expect(calls.n).toBe(0);

    const outcomes = (await entriesOf(cashier.id)).map((e) => e.outcome);
    expect(outcomes.filter((o) => o === 'APPROVAL_FAILED')).toHaveLength(MAX_FAILURES);
    expect(outcomes.filter((o) => o === 'APPROVAL_THROTTLED')).toHaveLength(total - MAX_FAILURES);
    expect(outcomes).toHaveLength(total);
    expect((await securityEvents()).map((e) => e.event_type)).toEqual(['COOLDOWN_STARTED']);
  });
});

describe('cancelled', () => {
  it('20: a cancelled approval is one APPROVAL_CANCELLED entry and touches no bucket or event', async () => {
    await failedLogins(1);
    await fail(manager.id, NOBODY_PIN);
    const eventsBefore = await securityEvents();
    const buckets = [await bucket('LOGIN'), await bucket('MANAGER_APPROVAL')];
    const entriesBefore = (await entriesOf(cashier.id)).length;

    await recordApprovalCancelled({ actorId: cashier.id, action: 'VOID_ITEM', subject: { type: 'order', id: 'o-1' } });

    expect(await entriesOf(cashier.id)).toHaveLength(entriesBefore + 1);
    expect((await entriesOf(cashier.id))[0]).toEqual({
      actor_id: cashier.id,
      approver_id: null,
      action: 'VOID_ITEM',
      outcome: 'APPROVAL_CANCELLED',
      subject_type: 'order',
      subject_id: 'o-1',
      reason: null,
      before_amount: null,
      after_amount: null,
    });
    expect([await bucket('LOGIN'), await bucket('MANAGER_APPROVAL')]).toEqual(buckets);
    expect(await securityEvents()).toEqual(eventsBefore);

    const total = await auditCount();
    await expect(recordApprovalCancelled({ actorId: cashier.id, action: ' ' })).rejects.toThrow();
    await expect(
      recordApprovalCancelled({ actorId: cashier.id, action: 'X', subject: { type: 'order', id: '' } })
    ).rejects.toThrow();
    expect(await auditCount()).toBe(total);
  });
});

describe('secrets and time', () => {
  // A PIN is six digits, so a bare substring match would also hit a timestamp or a
  // uuid. A PIN is a whole token: not flanked by anything that can continue one.
  function leaks(text: string, pin: string): boolean {
    return new RegExp(`(?<![0-9A-Za-z.:+-])${pin}(?![0-9A-Za-z.:+-])`).test(text);
  }

  it('21: no PIN used in this file appears in either evidence table, a returned value or an error', async () => {
    expect(leaks(`{"reason":"${NOBODY_PIN}"}`, NOBODY_PIN)).toBe(true);
    expect(leaks('2026-10-12 11:22:33.999111+00', NOBODY_PIN)).toBe(false);

    const pins = [cashier.pin, manager.pin, otherManager.pin, NOBODY_PIN, OTHER_NOBODY_PIN];
    const seen: string[] = [];
    const record = (value: unknown) => seen.push(JSON.stringify(value));
    const recordError = (err: unknown) => {
      if (err instanceof Error) seen.push(`${err.name} ${err.message} ${err.stack ?? ''}`);
      else seen.push(String(err));
    };
    const { work } = countingWork();

    record(await withManagerApproval(request({ actorId: cashier.id, managerPin: NOBODY_PIN }), work));
    record(await withManagerApproval(request({ actorId: cashier.id, managerPin: cashier.pin }), work));
    record(await withManagerApproval(request({ actorId: cashier.id, managerPin: manager.pin, reason: 'ok' }), work));
    try {
      await withManagerApproval(request({ actorId: randomUUID(), managerPin: OTHER_NOBODY_PIN }), work);
    } catch (err) {
      recordError(err);
    }
    try {
      await withManagerApproval(request({ actorId: randomUUID(), managerPin: manager.pin }), work);
    } catch (err) {
      recordError(err);
    }
    try {
      await withManagerApproval(request({ actorId: cashier.id, managerPin: otherManager.pin }), async () => {
        throw new Error('work failed');
      });
    } catch (err) {
      recordError(err);
    }
    for (let i = 0; i < MAX_FAILURES; i++) {
      record(await withManagerApproval(request({ actorId: cashier.id, managerPin: OTHER_NOBODY_PIN }), work));
    }
    record(await withManagerApproval(request({ actorId: cashier.id, managerPin: manager.pin }), work));
    try {
      await withManagerApproval(request({ actorId: cashier.id, managerPin: otherManager.pin, action: '' }), work);
    } catch (err) {
      recordError(err);
    }

    const audit = (
      await ownerQuery<{ r: string }>('SELECT to_jsonb(audit_entry)::text AS r FROM audit_entry')
    ).map((r) => r.r);
    const events = (
      await ownerQuery<{ r: string }>('SELECT to_jsonb(security_event)::text AS r FROM security_event')
    ).map((r) => r.r);
    expect(audit.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    expect(seen.length).toBeGreaterThan(0);

    for (const pin of pins) {
      for (const text of [...audit, ...events, ...seen]) {
        expect(leaks(text, pin), `${pin} in ${text.slice(0, 80)}`).toBe(false);
      }
    }
  });

  it('22: the entry\'s occurred_at is not earlier than a clock reading the work took after a sleep', async () => {
    let reading = '';
    await withManagerApproval(request({ actorId: cashier.id, managerPin: manager.pin }), async (client) => {
      await client.query('SELECT pg_sleep(0.3)');
      const read = await client.query<{ t: string }>('SELECT clock_timestamp()::text AS t');
      reading = read.rows[0]!.t;
      return { result: null };
    });

    const rows = await ownerQuery<{ ok: boolean }>(
      'SELECT occurred_at >= $1::timestamptz AS ok FROM audit_entry WHERE actor_id = $2',
      [reading, cashier.id]
    );
    expect(rows).toEqual([{ ok: true }]);
  });
});

describe('source', () => {
  const SRC = fileURLToPath(new URL('../src', import.meta.url));
  const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(SRC, file));
  const allowed = ['domain/approval.ts', 'domain/audit.ts', 'domain/throttle.ts'];

  function namedIn(pattern: RegExp): string[] {
    return files
      .filter((file) => pattern.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
      .sort();
  }

  it('23: only approval.ts, audit.ts and throttle.ts name the approver, the class or the outcomes', () => {
    expect(namedIn(/approverId/).filter((f) => !allowed.includes(f))).toEqual([]);
    expect(namedIn(/MANAGER_APPROVAL/).filter((f) => !allowed.includes(f))).toEqual([]);
    expect(namedIn(/APPROVAL_(FAILED|CANCELLED|THROTTLED)/).filter((f) => !allowed.includes(f))).toEqual([]);
    // The one writer that names an approver is the approval module.
    expect(namedIn(/approverId:/).filter((f) => f !== 'domain/approval.ts')).toEqual([]);
  });

  it('23: approval.ts does not import pin.ts', () => {
    const text = readFileSync(join(SRC, 'domain/approval.ts'), 'utf8');
    expect(text).not.toMatch(/from\s+['"][^'"]*\/pin(\.js)?['"]/);
  });
});
