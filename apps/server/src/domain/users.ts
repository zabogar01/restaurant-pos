import type pg from 'pg';
import { query, withTransaction } from '../db/pool.js';
import { writeAudit } from './audit.js';
import { hashPassword, insertBackOfficeCredential, normaliseUsername } from './back-office-credential.js';
import { insertStaffUser, preparePin } from './pin.js';
import type { StaffRole } from './pin.js';
import { restampOwnSession } from './session.js';

// The users commands (FR-A1, FR-A4, FR-B3; consult C3). Each is one transaction and writes
// nothing when it refuses. Every command:
//   1. is aimed at someone else if it changes a person's status or role (OWN_ACCOUNT, before
//      anything is read or hashed);
//   2. hashes outside any transaction, so no lock is held across Argon2id;
//   3. opens its transaction with `lockUsers`, which locks the acting manager's row and the
//      subject's together and re-reads the actor;
//   4. then decides: NOT_FOUND, the precondition (USER_CHANGED), the no-op rule, the writes
//      (a unique violation by constraint name is DUPLICATE with its field), the credential
//      version, the one audit entry;
//   5. commits and answers the view.
// The caller has already validated every field (the request schemas); the only checks here
// are the ones the database and the locked state decide. Nothing here names an HTTP code.

export type StaffClassification = 'CASHIER' | 'MANAGER' | 'KITCHEN';

/** A person as a route answers it. Never a hash, a lookup, a version or the throttle state. */
export interface User {
  staffUserId: string;
  name: string;
  classification: StaffClassification;
  isActive: boolean;
  username: string | null;
}

/** The acting manager: the guard's actor and the session the request came in on. */
export interface ActingManager {
  staffUserId: string;
  sessionId: string;
}

export type NewUser =
  | { classification: 'KITCHEN'; name: string }
  | { classification: 'CASHIER'; name: string; pin: string }
  | { classification: 'MANAGER'; name: string; pin: string; username: string; password: string };

export type RoleChange =
  | { change: 'KITCHEN_TO_CASHIER'; staffUserId: string; pin: string }
  | {
      change: 'KITCHEN_TO_MANAGER';
      staffUserId: string;
      pin: string;
      password: string;
      username?: string | undefined;
    }
  | { change: 'CASHIER_TO_MANAGER'; staffUserId: string; password: string; username?: string | undefined }
  | { change: 'MANAGER_TO_CASHIER'; staffUserId: string }
  | { change: 'CASHIER_TO_KITCHEN'; staffUserId: string }
  | { change: 'MANAGER_TO_KITCHEN'; staffUserId: string };

export type UserOutcome =
  | { kind: 'OK'; user: User }
  | { kind: 'NOT_FOUND' }
  /** The command may not be aimed at the acting manager. */
  | { kind: 'OWN_ACCOUNT' }
  /** The state the manager's screen was built on no longer holds. */
  | { kind: 'USER_CHANGED' }
  /** The acting manager is no longer an active manager on this session's credential version. */
  | { kind: 'UNAUTHENTICATED' }
  /** A unique key refused the write: the active PIN lookup or the username. */
  | { kind: 'DUPLICATE'; field: 'pin' | 'username' };

/**
 * The closed list of audited actions (C3 section 7), each meaning one fact so that an audit
 * viewer can render an entry without reading anything else. `audit.ts` holds no list, so the
 * check is here, inside the command's transaction and before `writeAudit`. The own-change
 * and reset actions are in it since PHASE1-S8b.
 */
export const USER_ACTIONS = {
  CREATE_CASHIER: 'user.create.cashier',
  CREATE_MANAGER: 'user.create.manager',
  DEACTIVATE: 'user.deactivate',
  REACTIVATE: 'user.reactivate',
  REACTIVATE_NEW_PIN: 'user.reactivate.new_pin',
  ROLE_KITCHEN_TO_CASHIER: 'user.role.kitchen_to_cashier',
  ROLE_KITCHEN_TO_MANAGER: 'user.role.kitchen_to_manager',
  ROLE_CASHIER_TO_MANAGER: 'user.role.cashier_to_manager',
  ROLE_MANAGER_TO_CASHIER: 'user.role.manager_to_cashier',
  ROLE_CASHIER_TO_KITCHEN: 'user.role.cashier_to_kitchen',
  ROLE_MANAGER_TO_KITCHEN: 'user.role.manager_to_kitchen',
  PIN_RESET: 'user.pin.reset',
  PASSWORD_RESET: 'user.password.reset',
  OWN_PIN_CHANGE: 'user.own_pin.change',
  OWN_PASSWORD_CHANGE: 'user.own_password.change',
} as const;

export type UserAction = (typeof USER_ACTIONS)[keyof typeof USER_ACTIONS];

const ALL_ACTIONS: readonly string[] = Object.values(USER_ACTIONS);

interface UserRow {
  id: string;
  name: string;
  role: StaffRole | null;
  is_active: boolean;
  username: string | null;
}

interface LockedRow {
  id: string;
  name: string;
  role: StaffRole | null;
  is_active: boolean;
  credential_version: number;
}

const UNIQUE_VIOLATION = '23505';
const ACTIVE_PIN_KEY = 'staff_user_active_pin_lookup_key';
const USERNAME_KEY = 'back_office_credential_username_key';

// A PostgreSQL error's `detail` quotes the PIN lookup or the username (ARCHITECTURE 7.3), so
// a database error here is replaced, never wrapped, and keeps no cause (ADR-010 rule 2, B-12).
const DATABASE_FAILURE = 'The staff user store failed';

const USER_SELECT = `SELECT u.id, u.name, u.role, u.is_active, c.username
                       FROM staff_user u
                       LEFT JOIN back_office_credential c ON c.staff_user_id = u.id`;

const classificationOf = (role: StaffRole | null): StaffClassification => role ?? 'KITCHEN';

const viewOf = (row: UserRow): User => ({
  staffUserId: row.id,
  name: row.name,
  classification: classificationOf(row.role),
  isActive: row.is_active,
  username: row.username,
});

/** Thrown inside a transaction to roll it back and answer with a refusal. */
class Refusal extends Error {
  constructor(readonly outcome: UserOutcome) {
    super('refused');
  }
}

/**
 * Runs one command's transaction. A unique violation on the active-PIN index or on the
 * username index is the answer `DUPLICATE` with its field; any other database error, a
 * unique violation on another constraint included, is a fault.
 */
async function command(run: (client: pg.PoolClient) => Promise<UserOutcome>): Promise<UserOutcome> {
  try {
    return await withTransaction(run);
  } catch (err) {
    if (err instanceof Refusal) return err.outcome;
    const { code, constraint } = (typeof err === 'object' && err !== null ? err : {}) as {
      code?: unknown;
      constraint?: unknown;
    };
    if (code === UNIQUE_VIOLATION && constraint === ACTIVE_PIN_KEY) return { kind: 'DUPLICATE', field: 'pin' };
    if (code === UNIQUE_VIOLATION && constraint === USERNAME_KEY) return { kind: 'DUPLICATE', field: 'username' };
    throw new Error(DATABASE_FAILURE);
  }
}

export type Locked =
  | { kind: 'LOCKED'; actor: LockedRow; subject: LockedRow | null }
  | { kind: 'UNAUTHENTICATED' };

/**
 * The first statement of every users transaction (C3 section 5). It locks the acting
 * manager's StaffUser row and the subject's together, in id order and `FOR NO KEY UPDATE`,
 * then re-reads the actor: the row must be active, a MANAGER, at the credential version of
 * the session the request came in on, and that session must be unreleased. Otherwise the
 * answer is UNAUTHENTICATED and nothing has been written.
 *
 * The guard read the actor's role without a lock. Two managers who deactivate or demote
 * each other at once each pass the guard and each lock the other's row: with both rows
 * locked in id order the commands serialise, and the second finds its actor demoted or
 * deactivated (and at a new version) and is refused. Whatever order they commit in, the
 * actor of the last committed command is still an active manager, so one always remains.
 *
 * Lock order (ARCHITECTURE section 8): the StaffUser rows in id order, then the subject's
 * BackOfficeCredential row, then (own changes only) the acting ActorSession. Nothing else
 * holds these in another order, so there is no cycle. `subjectId` is null where no row
 * exists yet (a create) and is lower-case, as PostgreSQL prints a uuid.
 */
export async function lockUsers(
  client: Pick<pg.PoolClient, 'query'>,
  actor: ActingManager,
  subjectId: string | null
): Promise<Locked> {
  const ids = subjectId === null || subjectId === actor.staffUserId ? [actor.staffUserId] : [actor.staffUserId, subjectId];
  const rows = await client.query<LockedRow>(
    `SELECT id, name, role, is_active, credential_version
       FROM staff_user
      WHERE id = ANY($1::uuid[])
      ORDER BY id
        FOR NO KEY UPDATE`,
    [ids]
  );
  const me = rows.rows.find((row) => row.id === actor.staffUserId);
  const session = await client.query<{ credential_version: number }>(
    'SELECT credential_version FROM actor_session WHERE id = $1 AND released_at IS NULL',
    [actor.sessionId]
  );
  const held = session.rows[0];
  if (!me || !me.is_active || me.role !== 'MANAGER' || !held || held.credential_version !== me.credential_version) {
    return { kind: 'UNAUTHENTICATED' };
  }
  const subject = subjectId === null ? null : (rows.rows.find((row) => row.id === subjectId) ?? null);
  return { kind: 'LOCKED', actor: me, subject };
}

async function readUser(client: Pick<pg.PoolClient, 'query'>, id: string): Promise<User> {
  const res = await client.query<UserRow>(`${USER_SELECT} WHERE u.id = $1`, [id]);
  const row = res.rows[0];
  if (!row) throw new Error(DATABASE_FAILURE);
  return viewOf(row);
}

/** One audit entry on the command's own client, so the change and its evidence commit together. */
async function audit(
  client: Pick<pg.PoolClient, 'query'>,
  actor: ActingManager,
  action: UserAction,
  subjectId: string
): Promise<void> {
  if (!ALL_ACTIONS.includes(action)) throw new Error('unknown user action');
  await writeAudit(client, {
    actorId: actor.staffUserId,
    action,
    outcome: 'SUCCESS',
    subject: { type: 'staff_user', id: subjectId },
  });
}

const typedUsername = (typed: string): string => {
  const username = normaliseUsername(typed);
  // The request schema holds the stored form, so this is not reachable from a request.
  if (username === null) throw new Error('Username does not fit the rule');
  return username;
};

/** Every user, active and inactive, in the order they were made. */
export async function listUsers(): Promise<User[]> {
  try {
    const rows = await query<UserRow>(`${USER_SELECT} ORDER BY u.created_at, u.id`);
    return rows.map(viewOf);
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}

/**
 * Creates kitchen staff (no entry), a cashier or a manager (one entry). The staff row and
 * the credential row share the transaction, so a refusal from either leaves neither.
 */
export async function createUser(actor: ActingManager, input: NewUser): Promise<UserOutcome> {
  const role: StaffRole | null = input.classification === 'KITCHEN' ? null : input.classification;
  const prepared = input.classification === 'KITCHEN' ? null : await preparePin(input.pin);
  const credential =
    input.classification === 'MANAGER'
      ? { username: typedUsername(input.username), passwordHash: await hashPassword(input.password) }
      : null;

  return command(async (client) => {
    const locked = await lockUsers(client, actor, null);
    if (locked.kind === 'UNAUTHENTICATED') return locked;

    // Nothing is written yet when the PIN is refused.
    const created = await insertStaffUser(client, { name: input.name, role, prepared });
    if (created === null) return { kind: 'DUPLICATE', field: 'pin' };
    if (credential !== null) {
      const inserted = await insertBackOfficeCredential(client, { staffUserId: created.id, ...credential });
      if (inserted === 'USERNAME_TAKEN') throw new Refusal({ kind: 'DUPLICATE', field: 'username' });
    }
    if (role !== null) {
      await audit(client, actor, role === 'MANAGER' ? USER_ACTIONS.CREATE_MANAGER : USER_ACTIONS.CREATE_CASHIER, created.id);
    }
    return { kind: 'OK', user: await readUser(client, created.id) };
  });
}

interface Move {
  from: StaffClassification;
  to: StaffClassification;
  action: UserAction;
}

const MOVES: Record<RoleChange['change'], Move> = {
  KITCHEN_TO_CASHIER: { from: 'KITCHEN', to: 'CASHIER', action: USER_ACTIONS.ROLE_KITCHEN_TO_CASHIER },
  KITCHEN_TO_MANAGER: { from: 'KITCHEN', to: 'MANAGER', action: USER_ACTIONS.ROLE_KITCHEN_TO_MANAGER },
  CASHIER_TO_MANAGER: { from: 'CASHIER', to: 'MANAGER', action: USER_ACTIONS.ROLE_CASHIER_TO_MANAGER },
  MANAGER_TO_CASHIER: { from: 'MANAGER', to: 'CASHIER', action: USER_ACTIONS.ROLE_MANAGER_TO_CASHIER },
  CASHIER_TO_KITCHEN: { from: 'CASHIER', to: 'KITCHEN', action: USER_ACTIONS.ROLE_CASHIER_TO_KITCHEN },
  MANAGER_TO_KITCHEN: { from: 'MANAGER', to: 'KITCHEN', action: USER_ACTIONS.ROLE_MANAGER_TO_KITCHEN },
};

/**
 * One of the six moves (C3 section 2). The origin is a precondition checked under the lock:
 * a person who is no longer where the manager's screen saw them, or who is inactive, is
 * `USER_CHANGED`. Every move increments the credential version, so every session of the
 * person ends. Promotion always sets a new password and writes `password_hash` only, so a
 * running cooldown on the account keeps running (ADR-009 section 4).
 */
export async function changeRole(actor: ActingManager, input: RoleChange): Promise<UserOutcome> {
  const subjectId = input.staffUserId.toLowerCase();
  if (subjectId === actor.staffUserId) return { kind: 'OWN_ACCOUNT' };
  const move = MOVES[input.change];

  const prepared = 'pin' in input ? await preparePin(input.pin) : null;
  const passwordHash = 'password' in input ? await hashPassword(input.password) : null;
  const username = 'username' in input && input.username !== undefined ? typedUsername(input.username) : null;

  return command(async (client) => {
    const locked = await lockUsers(client, actor, subjectId);
    if (locked.kind === 'UNAUTHENTICATED') return locked;
    const subject = locked.subject;
    if (subject === null) return { kind: 'NOT_FOUND' };
    if (!subject.is_active || classificationOf(subject.role) !== move.from) return { kind: 'USER_CHANGED' };

    // A username is required exactly when the person has no credential row, and must be
    // absent when they have one (a former manager, demoted earlier). A mismatch can come
    // only from a concurrent promotion and demotion.
    let hasCredential = false;
    if (move.to === 'MANAGER') {
      const credential = await client.query(
        'SELECT 1 FROM back_office_credential WHERE staff_user_id = $1 FOR UPDATE',
        [subjectId]
      );
      hasCredential = credential.rows.length === 1;
      if (hasCredential === (username !== null)) return { kind: 'USER_CHANGED' };
    }

    const role = move.to === 'KITCHEN' ? null : move.to;
    if (prepared !== null) {
      await client.query(
        `UPDATE staff_user
            SET role = $2, pin_hash = $3, pin_lookup = $4, credential_version = credential_version + 1
          WHERE id = $1`,
        [subjectId, role, prepared.pinHash, prepared.pinLookup]
      );
    } else if (move.to === 'KITCHEN') {
      await client.query(
        `UPDATE staff_user
            SET role = NULL, pin_hash = NULL, pin_lookup = NULL, credential_version = credential_version + 1
          WHERE id = $1`,
        [subjectId]
      );
    } else {
      await client.query(
        'UPDATE staff_user SET role = $2, credential_version = credential_version + 1 WHERE id = $1',
        [subjectId, role]
      );
    }

    if (move.to === 'MANAGER' && passwordHash !== null) {
      if (hasCredential) {
        await client.query('UPDATE back_office_credential SET password_hash = $2 WHERE staff_user_id = $1', [
          subjectId,
          passwordHash,
        ]);
      } else if (username !== null) {
        const inserted = await insertBackOfficeCredential(client, { staffUserId: subjectId, username, passwordHash });
        if (inserted === 'USERNAME_TAKEN') throw new Refusal({ kind: 'DUPLICATE', field: 'username' });
      }
    }

    await audit(client, actor, move.action, subjectId);
    return { kind: 'OK', user: await readUser(client, subjectId) };
  });
}

/**
 * Deactivates another user. The increment ends every session at once and keeps them dead
 * after a later reactivation. Deactivating the inactive is a no-op that writes nothing.
 */
export async function deactivateUser(actor: ActingManager, staffUserId: string): Promise<UserOutcome> {
  const subjectId = staffUserId.toLowerCase();
  if (subjectId === actor.staffUserId) return { kind: 'OWN_ACCOUNT' };
  return command(async (client) => {
    const locked = await lockUsers(client, actor, subjectId);
    if (locked.kind === 'UNAUTHENTICATED') return locked;
    if (locked.subject === null) return { kind: 'NOT_FOUND' };
    if (locked.subject.is_active) {
      await client.query(
        'UPDATE staff_user SET is_active = false, credential_version = credential_version + 1 WHERE id = $1',
        [subjectId]
      );
      await audit(client, actor, USER_ACTIONS.DEACTIVATE, subjectId);
    }
    return { kind: 'OK', user: await readUser(client, subjectId) };
  });
}

/**
 * Reactivates a user, keeping their PIN unless `pin` replaces it (FR-B3, Q6a). If an active
 * user holds the kept PIN the partial unique index refuses the update and the answer is
 * `DUPLICATE` on `pin`; the manager sends the command again with a new one. Reactivating
 * the active is a no-op that writes nothing, `pin` or none. A kitchen row has no PIN to
 * keep or replace, so a `pin` for one is `USER_CHANGED`.
 */
export async function reactivateUser(
  actor: ActingManager,
  staffUserId: string,
  pin?: string
): Promise<UserOutcome> {
  const subjectId = staffUserId.toLowerCase();
  const prepared = pin === undefined ? null : await preparePin(pin);
  return command(async (client) => {
    const locked = await lockUsers(client, actor, subjectId);
    if (locked.kind === 'UNAUTHENTICATED') return locked;
    const subject = locked.subject;
    if (subject === null) return { kind: 'NOT_FOUND' };
    if (!subject.is_active) {
      if (subject.role === null) {
        if (prepared !== null) return { kind: 'USER_CHANGED' };
        await client.query('UPDATE staff_user SET is_active = true WHERE id = $1', [subjectId]);
        await audit(client, actor, USER_ACTIONS.REACTIVATE, subjectId);
      } else if (prepared !== null) {
        await client.query(
          `UPDATE staff_user
              SET is_active = true, pin_hash = $2, pin_lookup = $3, credential_version = credential_version + 1
            WHERE id = $1`,
          [subjectId, prepared.pinHash, prepared.pinLookup]
        );
        await audit(client, actor, USER_ACTIONS.REACTIVATE_NEW_PIN, subjectId);
      } else {
        await client.query('UPDATE staff_user SET is_active = true WHERE id = $1', [subjectId]);
        await audit(client, actor, USER_ACTIONS.REACTIVATE, subjectId);
      }
    }
    return { kind: 'OK', user: await readUser(client, subjectId) };
  });
}

/**
 * Sets another user's PIN (FR-B3, Q7). A cashier or a manager, active, is set; an inactive
 * or kitchen subject is `USER_CHANGED`. The PIN is stored, the version increments (so every
 * session of the person ends) and one entry is written, even when the PIN is the value the
 * person already had. A taken PIN is `DUPLICATE` on `pin`, by the index.
 */
export async function setUserPin(actor: ActingManager, staffUserId: string, pin: string): Promise<UserOutcome> {
  const subjectId = staffUserId.toLowerCase();
  if (subjectId === actor.staffUserId) return { kind: 'OWN_ACCOUNT' };
  const prepared = await preparePin(pin);
  return command(async (client) => {
    const locked = await lockUsers(client, actor, subjectId);
    if (locked.kind === 'UNAUTHENTICATED') return locked;
    const subject = locked.subject;
    if (subject === null) return { kind: 'NOT_FOUND' };
    if (!subject.is_active || subject.role === null) return { kind: 'USER_CHANGED' };
    await client.query(
      `UPDATE staff_user
          SET pin_hash = $2, pin_lookup = $3, credential_version = credential_version + 1
        WHERE id = $1`,
      [subjectId, prepared.pinHash, prepared.pinLookup]
    );
    await audit(client, actor, USER_ACTIONS.PIN_RESET, subjectId);
    return { kind: 'OK', user: await readUser(client, subjectId) };
  });
}

/**
 * Sets another manager's back-office password. The subject must be an active MANAGER with a
 * credential row (a former manager's row stays and is not enough). The write touches
 * `password_hash` only, so a running cooldown keeps running (PHASE0-007b, ADR-009 section 4).
 */
export async function setUserPassword(
  actor: ActingManager,
  staffUserId: string,
  password: string
): Promise<UserOutcome> {
  const subjectId = staffUserId.toLowerCase();
  if (subjectId === actor.staffUserId) return { kind: 'OWN_ACCOUNT' };
  const passwordHash = await hashPassword(password);
  return command(async (client) => {
    const locked = await lockUsers(client, actor, subjectId);
    if (locked.kind === 'UNAUTHENTICATED') return locked;
    const subject = locked.subject;
    if (subject === null) return { kind: 'NOT_FOUND' };
    if (!subject.is_active || subject.role !== 'MANAGER') return { kind: 'USER_CHANGED' };
    const credential = await client.query(
      'SELECT 1 FROM back_office_credential WHERE staff_user_id = $1 FOR UPDATE',
      [subjectId]
    );
    if (credential.rows.length !== 1) return { kind: 'USER_CHANGED' };
    await client.query('UPDATE back_office_credential SET password_hash = $2 WHERE staff_user_id = $1', [
      subjectId,
      passwordHash,
    ]);
    await client.query('UPDATE staff_user SET credential_version = credential_version + 1 WHERE id = $1', [subjectId]);
    await audit(client, actor, USER_ACTIONS.PASSWORD_RESET, subjectId);
    return { kind: 'OK', user: await readUser(client, subjectId) };
  });
}

/**
 * The shared tail of the two own-credential commands (C3 section 3). The caller has verified
 * the current password for the acting manager, in its own committed transaction, and passes
 * the credential version that verification returned. Under the lock the actor must still be
 * at that version; the credential is written by `write`; the version increments; the acting
 * session is re-stamped (exactly one row, or the transaction rolls back); the entry is
 * written. The session's token, `issued_at` and absolute lifetime are not touched.
 */
async function changeOwn(
  actor: ActingManager,
  verifiedVersion: number,
  action: UserAction,
  write: (client: pg.PoolClient) => Promise<void>
): Promise<UserOutcome> {
  return command(async (client) => {
    const locked = await lockUsers(client, actor, actor.staffUserId);
    if (locked.kind === 'UNAUTHENTICATED') return locked;
    if (locked.actor.credential_version !== verifiedVersion) return { kind: 'UNAUTHENTICATED' };
    await write(client);
    const bumped = await client.query<{ credential_version: number }>(
      'UPDATE staff_user SET credential_version = credential_version + 1 WHERE id = $1 RETURNING credential_version',
      [actor.staffUserId]
    );
    const newVersion = bumped.rows[0]?.credential_version;
    if (newVersion === undefined) throw new Error(DATABASE_FAILURE);
    const restamped = await restampOwnSession(client, {
      sessionId: actor.sessionId,
      staffUserId: actor.staffUserId,
      oldVersion: verifiedVersion,
      newVersion,
    });
    if (!restamped) throw new Refusal({ kind: 'UNAUTHENTICATED' });
    await audit(client, actor, action, actor.staffUserId);
    return { kind: 'OK', user: await readUser(client, actor.staffUserId) };
  });
}

/**
 * The acting manager's own password. `verifiedVersion` is the credential version the
 * current-password verification returned; nothing is hashed before that succeeded (the
 * caller verifies first). The credential row is locked after the StaffUser rows, and
 * `password_hash` is the only column written.
 */
export async function changeOwnPassword(
  actor: ActingManager,
  verifiedVersion: number,
  password: string
): Promise<UserOutcome> {
  const passwordHash = await hashPassword(password);
  return changeOwn(actor, verifiedVersion, USER_ACTIONS.OWN_PASSWORD_CHANGE, async (client) => {
    const credential = await client.query(
      'SELECT 1 FROM back_office_credential WHERE staff_user_id = $1 FOR UPDATE',
      [actor.staffUserId]
    );
    if (credential.rows.length !== 1) throw new Refusal({ kind: 'UNAUTHENTICATED' });
    await client.query('UPDATE back_office_credential SET password_hash = $2 WHERE staff_user_id = $1', [
      actor.staffUserId,
      passwordHash,
    ]);
  });
}

/** The acting manager's own PIN. A PIN set to the current one is a success, not `DUPLICATE`. */
export async function changeOwnPin(actor: ActingManager, verifiedVersion: number, pin: string): Promise<UserOutcome> {
  const prepared = await preparePin(pin);
  return changeOwn(actor, verifiedVersion, USER_ACTIONS.OWN_PIN_CHANGE, async (client) => {
    await client.query('UPDATE staff_user SET pin_hash = $2, pin_lookup = $3 WHERE id = $1', [
      actor.staffUserId,
      prepared.pinHash,
      prepared.pinLookup,
    ]);
  });
}
