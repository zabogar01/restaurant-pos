import type pg from 'pg';
import { withTransaction } from '../db/pool.js';
import { writeAudit, writeAuditOwnTransaction } from './audit.js';
import { verifyPinThrottled } from './throttle.js';

// Inline manager approval (FR-A6, B-14). There is no value that means
// "approved": the PIN and the work arrive in one call, the work runs once, and
// the approver's id exists only as the parameter of the work callback. This
// module holds no state, never reads or changes a session, and never imports
// pin.ts: the role rule is verifyPinThrottled's, under its lock.

export interface ApprovalRequest {
  /** The initiating actor, from actorOf(request). Never from a request body. */
  actorId: string;
  /** Six digits from this request's body. Passed to verifyPinThrottled and nowhere else (B-12). */
  managerPin: string;
  /** What is being approved. A literal at the call site, never a value the client chose. */
  action: string;
  subject?: { type: string; id: string };
  /** Written on the SUCCESS entry only. */
  reason?: string;
  clientInstanceId?: string;
}

export interface ApprovedWork<T> {
  result: T;
  /** Minor units (B-1). Known only once the work has run. */
  beforeAmount?: bigint;
  afterAmount?: bigint;
}

export type ApprovalOutcome<T> =
  | { outcome: 'APPROVED'; result: T }
  // retryAfterSeconds is a number when this failure started a cooldown, otherwise null.
  | { outcome: 'FAILED'; retryAfterSeconds: number | null }
  | { outcome: 'THROTTLED'; retryAfterSeconds: number };

// Two transactions, in this order, by decision (ARCH-007 section 5): the
// verification commits inside verifyPinThrottled before the business
// transaction opens, so a strike can never be undone by the work's failure or
// by a failed evidence write. A work that throws is rethrown unchanged and
// writes no entry; a failed evidence write throws, because ADR-007 says the
// protected request fails when its evidence cannot commit.
export async function withManagerApproval<T>(
  request: ApprovalRequest,
  work: (client: pg.PoolClient, approver: { id: string }) => Promise<ApprovedWork<T>>
): Promise<ApprovalOutcome<T>> {
  const { actorId, managerPin, action, subject, reason, clientInstanceId } = request;

  // Before any PIN is looked at: otherwise a strike could be counted and its
  // evidence then refused. A dry run through the one writer that owns the audit
  // rules, with a client that touches no database: the SUCCESS shape checks every
  // field written below, and audit.ts exports no second copy of its validation.
  await writeAudit(
    { query: (async () => ({ rows: [] })) as unknown as pg.PoolClient['query'] },
    { actorId, action, subject, reason, outcome: 'SUCCESS' }
  );
  if (clientInstanceId !== undefined && (typeof clientInstanceId !== 'string' || clientInstanceId.trim() === '')) {
    throw new Error('invalid approval request: clientInstanceId');
  }

  const verified = await verifyPinThrottled('MANAGER_APPROVAL', managerPin, { clientInstanceId });
  if (verified.outcome === 'THROTTLED') {
    await writeAuditOwnTransaction({ actorId, action, subject, outcome: 'APPROVAL_THROTTLED' });
    return { outcome: 'THROTTLED', retryAfterSeconds: verified.retryAfterSeconds };
  }
  if (verified.outcome === 'FAILED') {
    await writeAuditOwnTransaction({ actorId, action, subject, outcome: 'APPROVAL_FAILED' });
    return { outcome: 'FAILED', retryAfterSeconds: verified.retryAfterSeconds };
  }

  // The throttle enforces the role under its lock and has already reset the
  // count; a non-manager here is its defect, never a failed approval.
  if (verified.user.role !== 'MANAGER') {
    throw new Error('manager approval verified a user who is not a manager');
  }
  const approver = { id: verified.user.id };

  return withTransaction(async (client) => {
    const done = await work(client, approver);
    await writeAudit(client, {
      actorId,
      approverId: approver.id,
      action,
      subject,
      reason,
      outcome: 'SUCCESS',
      beforeAmount: done.beforeAmount,
      afterAmount: done.afterAmount,
    });
    return { outcome: 'APPROVED' as const, result: done.result };
  });
}

/** A cancelled approval prompt (FR-J3). Verifies nothing and touches no bucket. */
export async function recordApprovalCancelled(input: {
  actorId: string;
  action: string;
  subject?: { type: string; id: string };
}): Promise<void> {
  const { actorId, action, subject } = input;
  await writeAuditOwnTransaction({ actorId, action, subject, outcome: 'APPROVAL_CANCELLED' });
}
