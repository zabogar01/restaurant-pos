import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool, withTransaction } from '../src/db/pool.js';
import * as auditModule from '../src/domain/audit.js';
import {
  writeAudit,
  writeAuditOwnTransaction,
  writeSecurityEvent,
  type AuditInput,
} from '../src/domain/audit.js';
import { createStaffUser } from '../src/domain/pin.js';
import { ownerQuery, resetDatabase } from './support/database.js';

let cashierId: string;
let managerId: string;

beforeEach(async () => {
  await resetDatabase();
  cashierId = (await createStaffUser({ name: 'Cashier', role: 'CASHIER', pin: '123456' })).id;
  managerId = (await createStaffUser({ name: 'Manager', role: 'MANAGER', pin: '654321' })).id;
});

afterAll(async () => {
  await getPool().end();
});

interface AuditRow {
  actor_id: string;
  approver_id: string | null;
  action: string;
  outcome: string;
  subject_type: string | null;
  subject_id: string | null;
  reason: string | null;
  before_amount: string | null;
  after_amount: string | null;
  occurred_at: Date;
}

const auditRows = () =>
  ownerQuery<AuditRow>('SELECT * FROM audit_entry ORDER BY id');
const eventRows = () =>
  ownerQuery<{ event_type: string; throttle_class: string; client_instance_id: string | null }>(
    'SELECT * FROM security_event ORDER BY id'
  );

async function failureOf(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected the call to fail');
}

/** A client that records every query and answers none. */
function recordingClient() {
  const calls: unknown[][] = [];
  return {
    calls,
    client: {
      query: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve({ rows: [] });
      },
    } as never,
  };
}

const entry = (over: Record<string, unknown> = {}): AuditInput =>
  ({ actorId: cashierId, action: 'order.void', outcome: 'SUCCESS', ...over }) as AuditInput;

describe('writeAudit', () => {
  it('case 1: writes one row with every field and a database timestamp', async () => {
    await withTransaction((c) =>
      writeAudit(c, {
        actorId: cashierId,
        approverId: managerId,
        action: 'order.void',
        outcome: 'SUCCESS',
        subject: { type: 'order', id: 'o-1' },
        reason: 'guest left',
        beforeAmount: 5000n,
        afterAmount: 0n,
      })
    );
    const rows = await auditRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actor_id: cashierId,
      approver_id: managerId,
      action: 'order.void',
      outcome: 'SUCCESS',
      subject_type: 'order',
      subject_id: 'o-1',
      reason: 'guest left',
      before_amount: '5000',
      after_amount: '0',
    });
    const drift = await ownerQuery<{ drift: number }>(
      'SELECT abs(extract(epoch FROM now() - max(occurred_at)))::float8 AS drift FROM audit_entry'
    );
    expect(drift[0]?.drift).toBeLessThan(5);
  });

  it('case 2: a rolled-back transaction leaves no row and the original error surfaces', async () => {
    const boom = new Error('business write failed');
    const err = await failureOf(() =>
      withTransaction(async (c) => {
        await writeAudit(c, entry());
        throw boom;
      })
    );
    expect(err).toBe(boom);
    expect(await auditRows()).toHaveLength(0);
  });

  it('case 3: entries in one transaction commit together', async () => {
    await withTransaction(async (c) => {
      await writeAudit(c, entry({ action: 'a.one' }));
      await writeAudit(c, entry({ action: 'a.two' }));
    });
    expect((await auditRows()).map((r) => r.action)).toEqual(['a.one', 'a.two']);
  });

  it('case 4: amounts beyond 2^53, zero and negative are stored exactly', async () => {
    await withTransaction((c) =>
      writeAudit(c, entry({ beforeAmount: 9007199254740993n, afterAmount: 0n }))
    );
    await withTransaction((c) => writeAudit(c, entry({ beforeAmount: -9007199254740993n })));
    const rows = await auditRows();
    expect(rows.map((r) => [r.before_amount, r.after_amount])).toEqual([
      ['9007199254740993', '0'],
      ['-9007199254740993', null],
    ]);
  });

  it('case 6: a SUCCESS entry may name the actor as approver', async () => {
    await withTransaction((c) => writeAudit(c, entry({ approverId: cashierId })));
    expect((await auditRows())[0]?.approver_id).toBe(cashierId);
  });

  it('case 8: an unknown actor is a foreign key error, rethrown, with no row', async () => {
    const err = (await failureOf(() =>
      withTransaction((c) =>
        writeAudit(c, entry({ actorId: '00000000-0000-4000-8000-000000000000' }))
      )
    )) as { code?: string };
    expect(err.code).toBe('23503');
    expect(await auditRows()).toHaveLength(0);
  });
});

describe('writeAuditOwnTransaction', () => {
  it('case 5: failed and cancelled approvals commit on their own', async () => {
    await writeAuditOwnTransaction(
      entry({ action: 'approval', outcome: 'APPROVAL_FAILED', approverId: null })
    );
    await writeAuditOwnTransaction(entry({ action: 'approval', outcome: 'APPROVAL_CANCELLED' }));
    const rows = await auditRows();
    expect(rows.map((r) => [r.outcome, r.approver_id])).toEqual([
      ['APPROVAL_FAILED', null],
      ['APPROVAL_CANCELLED', null],
    ]);
  });
});

describe('refusals before SQL', () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ['actorId null', { actorId: null }, 'actorId'],
    ['actorId empty', { actorId: '' }, 'actorId'],
    ['actorId number', { actorId: 42 }, 'actorId'],
    ['action empty', { action: '' }, 'action'],
    ['action blank', { action: '   ' }, 'action'],
    ['action number', { action: 7 }, 'action'],
    ['unknown outcome', { outcome: 'REFUSED' }, 'outcome'],
    ['approver with APPROVAL_FAILED', { outcome: 'APPROVAL_FAILED', approverId: 'x' }, 'approverId'],
    [
      'approver with APPROVAL_CANCELLED',
      { outcome: 'APPROVAL_CANCELLED', approverId: 'x' },
      'approverId',
    ],
    ['subject blank type', { subject: { type: ' ', id: 'a' } }, 'subject'],
    ['subject blank id', { subject: { type: 'order', id: '' } }, 'subject'],
    ['beforeAmount number', { beforeAmount: 100 }, 'beforeAmount'],
    ['afterAmount string', { afterAmount: '100' }, 'afterAmount'],
    ['reason number', { reason: 5 }, 'reason'],
  ];

  it.each(cases)('case 7: %s', async (_name, over, field) => {
    const { calls, client } = recordingClient();
    const err = (await failureOf(() => writeAudit(client, entry(over)))) as Error;
    expect(err.message).toBe(`invalid audit entry: ${field}`);
    expect(calls).toHaveLength(0);
    await expect(writeAuditOwnTransaction(entry(over))).rejects.toThrow(
      `invalid audit entry: ${field}`
    );
    expect(await auditRows()).toHaveLength(0);
  });

  it.each([null, 'text', 5, undefined])('case 7: the entry itself is %s', async (bad) => {
    const { calls, client } = recordingClient();
    const err = (await failureOf(() => writeAudit(client, bad as never))) as Error;
    expect(err.message).toBe('invalid audit entry: entry');
    expect(calls).toHaveLength(0);
  });

  it('case 9: no message contains the offending value', async () => {
    const { client } = recordingClient();
    const secret = 'zz-secret-reason-zz';
    const err = (await failureOf(() =>
      writeAudit(client, entry({ action: '   ', reason: { secret } }))
    )) as Error;
    expect(err.message).not.toContain(secret);
    expect(err.message).not.toContain('   ');
    const err2 = (await failureOf(() =>
      writeAudit(client, entry({ reason: { secret } }))
    )) as Error;
    expect(err2.message).toBe('invalid audit entry: reason');
    expect(err2.message).not.toContain(secret);
  });
});

describe('writeSecurityEvent', () => {
  it('case 10: writes a security_event and never an audit_entry', async () => {
    await writeSecurityEvent({ eventType: 'PIN_FAILURE', throttleClass: 'LOGIN' });
    expect(await eventRows()).toEqual([
      expect.objectContaining({
        event_type: 'PIN_FAILURE',
        throttle_class: 'LOGIN',
        client_instance_id: null,
      }),
    ]);
    expect(await auditRows()).toHaveLength(0);
  });

  it('case 10: stores a client instance id', async () => {
    const made = await ownerQuery<{ id: string }>(
      'INSERT INTO client_instance DEFAULT VALUES RETURNING id'
    );
    const id = made[0]?.id;
    await writeSecurityEvent({
      eventType: 'COOLDOWN_STARTED',
      throttleClass: 'MANAGER_APPROVAL',
      clientInstanceId: id,
    });
    const rows = await eventRows();
    expect(rows[0]).toMatchObject({
      event_type: 'COOLDOWN_STARTED',
      throttle_class: 'MANAGER_APPROVAL',
      client_instance_id: id,
    });
  });

  const bad: [string, unknown, string][] = [
    ['unknown eventType', { eventType: 'LOGIN_OK', throttleClass: 'LOGIN' }, 'eventType'],
    ['missing throttleClass', { eventType: 'PIN_FAILURE' }, 'throttleClass'],
    ['unknown throttleClass', { eventType: 'PIN_FAILURE', throttleClass: 'X' }, 'throttleClass'],
    [
      'blank clientInstanceId',
      { eventType: 'PIN_FAILURE', throttleClass: 'LOGIN', clientInstanceId: ' ' },
      'clientInstanceId',
    ],
    ['null input', null, 'input'],
  ];

  it.each(bad)('case 11: refuses %s before any row is written', async (_n, input, field) => {
    const spy = vi.spyOn(getPool(), 'query');
    try {
      await expect(writeSecurityEvent(input as never)).rejects.toThrow(
        `invalid security event: ${field}`
      );
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect(await eventRows()).toHaveLength(0);
  });

  it('case 11: detail and actorId keys are ignored and never written', async () => {
    await writeSecurityEvent({
      eventType: 'PIN_FAILURE',
      throttleClass: 'LOGIN',
      detail: '123456',
      actorId: cashierId,
    } as never);
    expect(await eventRows()).toHaveLength(1);
    expect(await auditRows()).toHaveLength(0);
    const columns = await ownerQuery<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'security_event'"
    );
    expect(columns.map((c) => c.column_name).sort()).toEqual([
      'client_instance_id',
      'event_type',
      'id',
      'occurred_at',
      'throttle_class',
    ]);
  });
});

describe('module surface', () => {
  it('case 12: exports only the three writers', () => {
    expect(Object.keys(auditModule).sort()).toEqual([
      'writeAudit',
      'writeAuditOwnTransaction',
      'writeSecurityEvent',
    ]);
  });
});
