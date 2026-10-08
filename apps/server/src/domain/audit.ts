import type pg from 'pg';
import { query, withTransaction } from '../db/pool.js';

// The only writers of audit_entry and security_event. pos_app has column INSERT
// and no SELECT on either table, so nothing here reads, updates or deletes.
// Later commands call these from HTTP handlers, so every check is a runtime
// check; a message names the field and never its value.

export type AuditOutcome = 'SUCCESS' | 'APPROVAL_FAILED' | 'APPROVAL_CANCELLED';

export interface AuditInput {
  /** B-13: always a person. An event with no identified actor is a security event. */
  actorId: string;
  /** Only with SUCCESS (ADR-007). May equal actorId. */
  approverId?: string | null;
  action: string;
  outcome: AuditOutcome;
  subject?: { type: string; id: string };
  reason?: string;
  /** Minor units, bigint only (B-1). */
  beforeAmount?: bigint;
  afterAmount?: bigint;
}

export interface SecurityEventInput {
  eventType: 'PIN_FAILURE' | 'COOLDOWN_STARTED' | 'PASSWORD_FAILURE';
  throttleClass: 'LOGIN' | 'MANAGER_APPROVAL' | 'BACK_OFFICE_LOGIN';
  clientInstanceId?: string;
}

const OUTCOMES: readonly string[] = ['SUCCESS', 'APPROVAL_FAILED', 'APPROVAL_CANCELLED'];
const EVENT_TYPES: readonly string[] = ['PIN_FAILURE', 'COOLDOWN_STARTED', 'PASSWORD_FAILURE'];
const THROTTLE_CLASSES: readonly string[] = ['LOGIN', 'MANAGER_APPROVAL', 'BACK_OFFICE_LOGIN'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function invalidAudit(field: string): never {
  throw new Error(`invalid audit entry: ${field}`);
}

function invalidEvent(field: string): never {
  throw new Error(`invalid security event: ${field}`);
}

function validateAudit(entry: unknown): AuditInput {
  if (!isObject(entry)) invalidAudit('entry');
  if (typeof entry.actorId !== 'string' || entry.actorId === '') invalidAudit('actorId');
  if (!isNonBlank(entry.action)) invalidAudit('action');
  if (typeof entry.outcome !== 'string' || !OUTCOMES.includes(entry.outcome)) {
    invalidAudit('outcome');
  }
  const approver = entry.approverId;
  if (approver !== undefined && approver !== null) {
    if (typeof approver !== 'string' || approver === '') invalidAudit('approverId');
    if (entry.outcome !== 'SUCCESS') invalidAudit('approverId');
  }
  const subject = entry.subject;
  if (subject !== undefined) {
    if (!isObject(subject) || !isNonBlank(subject.type) || !isNonBlank(subject.id)) {
      invalidAudit('subject');
    }
  }
  if (entry.reason !== undefined && typeof entry.reason !== 'string') invalidAudit('reason');
  if (entry.beforeAmount !== undefined && typeof entry.beforeAmount !== 'bigint') {
    invalidAudit('beforeAmount');
  }
  if (entry.afterAmount !== undefined && typeof entry.afterAmount !== 'bigint') {
    invalidAudit('afterAmount');
  }
  return entry as unknown as AuditInput;
}

function validateEvent(input: unknown): SecurityEventInput {
  if (!isObject(input)) invalidEvent('input');
  if (typeof input.eventType !== 'string' || !EVENT_TYPES.includes(input.eventType)) {
    invalidEvent('eventType');
  }
  if (typeof input.throttleClass !== 'string' || !THROTTLE_CLASSES.includes(input.throttleClass)) {
    invalidEvent('throttleClass');
  }
  if (input.clientInstanceId !== undefined && !isNonBlank(input.clientInstanceId)) {
    invalidEvent('clientInstanceId');
  }
  return input as unknown as SecurityEventInput;
}

/**
 * Write one audit entry on the caller's client, inside the caller's
 * transaction, so the action and its history commit or roll back together
 * (ADR-007, B-7). A database error is rethrown unchanged.
 */
export async function writeAudit(
  client: Pick<pg.PoolClient, 'query'>,
  entry: AuditInput
): Promise<void> {
  const e = validateAudit(entry);
  await client.query(
    `INSERT INTO audit_entry
       (actor_id, approver_id, action, outcome, subject_type, subject_id,
        reason, before_amount, after_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      e.actorId,
      e.approverId ?? null,
      e.action,
      e.outcome,
      e.subject?.type ?? null,
      e.subject?.id ?? null,
      e.reason ?? null,
      e.beforeAmount === undefined ? null : e.beforeAmount.toString(),
      e.afterAmount === undefined ? null : e.afterAmount.toString(),
    ]
  );
}

/** For an entry with no business write to share a transaction with, such as a failed approval. */
export async function writeAuditOwnTransaction(entry: AuditInput): Promise<void> {
  validateAudit(entry);
  await withTransaction((client) => writeAudit(client, entry));
}

/** Evidence of an event with no identified actor (B-13). Never reaches audit_entry. */
export async function writeSecurityEvent(input: SecurityEventInput): Promise<void> {
  const e = validateEvent(input);
  await query(
    `INSERT INTO security_event (event_type, throttle_class, client_instance_id)
     VALUES ($1, $2, $3)`,
    [e.eventType, e.throttleClass, e.clientInstanceId ?? null]
  );
}
