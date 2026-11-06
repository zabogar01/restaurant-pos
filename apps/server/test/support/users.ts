import type { JarClient } from './client.js';
import { ownerClient, ownerQuery } from './database.js';

// What the users test files share (PHASE1-S8a): the five calls as a signed-in browser
// profile makes them, the exact refusal bodies, and the owner-connection readers that let
// a case prove a row was or was not written.

export const BASE = '/api/back-office/config/users';

export const BODY = {
  NOT_FOUND: '{"error":{"code":"NOT_FOUND"}}',
  VALIDATION: '{"error":{"code":"VALIDATION_FAILED"}}',
  UNAUTHENTICATED: '{"error":{"code":"UNAUTHENTICATED"}}',
  FORBIDDEN: '{"error":{"code":"FORBIDDEN"}}',
  CSRF_REFUSED: '{"error":{"code":"CSRF_REFUSED"}}',
  OWN_ACCOUNT: '{"error":{"code":"OWN_ACCOUNT"}}',
  USER_CHANGED: '{"error":{"code":"USER_CHANGED"}}',
  DUPLICATE_PIN: '{"error":{"code":"DUPLICATE","details":{"field":"pin"}}}',
  DUPLICATE_USERNAME: '{"error":{"code":"DUPLICATE","details":{"field":"username"}}}',
  INVALID_CREDENTIALS: '{"error":{"code":"INVALID_CREDENTIALS"}}',
  INTERNAL: '{"error":{"code":"INTERNAL"}}',
};

export const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

export interface UserView {
  staffUserId: string;
  name: string;
  classification: 'CASHIER' | 'MANAGER' | 'KITCHEN';
  isActive: boolean;
  username: string | null;
}

export function usersApi(client: JarClient) {
  const post = (path: string, payload: unknown) =>
    client.request({ method: 'POST', url: `${BASE}/${path}`, payload: payload as object });
  return {
    post,
    setPin: (staffUserId: unknown, pin: unknown) => post('set-pin', { staffUserId, pin }),
    setPassword: (staffUserId: unknown, password: unknown) => post('set-password', { staffUserId, password }),
    ownPassword: (currentPassword: unknown, password: unknown) => post('own-password', { currentPassword, password }),
    ownPin: (currentPassword: unknown, pin: unknown) => post('own-pin', { currentPassword, pin }),
    list: () => client.get(BASE),
    create: (payload: unknown) => post('create', payload),
    changeRole: (payload: unknown) => post('change-role', payload),
    deactivate: (staffUserId: unknown) => post('deactivate', { staffUserId }),
    reactivate: (staffUserId: unknown, pin?: unknown) =>
      post('reactivate', pin === undefined ? { staffUserId } : { staffUserId, pin }),
  };
}

export type Res = Awaited<ReturnType<ReturnType<typeof usersApi>['list']>>;

export const userOf = (res: Res) => (res.json() as { user: UserView }).user;
export const usersOf = (res: Res) => (res.json() as { users: UserView[] }).users;

export interface StaffRow {
  id: string;
  name: string;
  role: string | null;
  pin_hash: string | null;
  pin_lookup: string | null;
  is_active: boolean;
  credential_version: number;
}

export async function staffRow(id: string): Promise<StaffRow> {
  const rows = await ownerQuery<StaffRow>(
    `SELECT id, name, role, pin_hash, pin_lookup, is_active, credential_version
       FROM staff_user WHERE id = $1`,
    [id]
  );
  return rows[0]!;
}

export async function versionOf(id: string): Promise<number> {
  return (await staffRow(id)).credential_version;
}

export async function xminOf(id: string): Promise<string> {
  const rows = await ownerQuery<{ x: string }>('SELECT xmin::text AS x FROM staff_user WHERE id = $1', [id]);
  return rows[0]!.x;
}

/** Both user tables, every row whole and with the transaction that last wrote it. */
export async function wholeUsers(): Promise<string[]> {
  const staff = await ownerQuery<{ r: string }>(
    `SELECT 'staff|' || to_jsonb(s)::text || '|' || s.xmin::text AS r FROM staff_user s ORDER BY id`
  );
  const credentials = await ownerQuery<{ r: string }>(
    `SELECT 'credential|' || to_jsonb(c)::text || '|' || c.xmin::text AS r
       FROM back_office_credential c ORDER BY staff_user_id`
  );
  return [...staff, ...credentials].map((row) => row.r);
}

export interface AuditRow {
  actor_id: string;
  approver_id: string | null;
  action: string;
  outcome: string;
  subject_type: string | null;
  subject_id: string | null;
  reason: string | null;
}

export async function auditRows(): Promise<AuditRow[]> {
  return ownerQuery<AuditRow>(
    `SELECT actor_id, approver_id, action, outcome, subject_type, subject_id, reason
       FROM audit_entry ORDER BY id`
  );
}

export async function credentialRow(
  staffUserId: string
): Promise<{ username: string; password_hash: string; consecutive_failures: number; blocked_until: string | null } | undefined> {
  const rows = await ownerQuery<{
    username: string;
    password_hash: string;
    consecutive_failures: number;
    blocked_until: string | null;
  }>(
    `SELECT username, password_hash, consecutive_failures, blocked_until::text
       FROM back_office_credential WHERE staff_user_id = $1`,
    [staffUserId]
  );
  return rows[0];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls through an owner connection until `count` pos_app backends are waiting on a lock. */
export async function waitForLockWaits(count: number): Promise<void> {
  const watcher = await ownerClient();
  try {
    for (let i = 0; i < 500; i += 1) {
      const res = await watcher.query(
        `SELECT 1 FROM pg_stat_activity WHERE usename = 'pos_app' AND wait_event_type = 'Lock'`
      );
      if (res.rows.length >= count) return;
      await sleep(20);
    }
    throw new Error(`fewer than ${count} backends ever waited on a lock`);
  } finally {
    await watcher.end();
  }
}
