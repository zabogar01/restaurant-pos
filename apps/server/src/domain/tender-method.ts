import type pg from 'pg';
import { query, withTransaction } from '../db/pool.js';

// The custom tender method's five operations (FR-B7, consult C2 section 8). Each command
// is one transaction and writes nothing when it refuses. No audit entry: tender method
// changes are not audited (owner, Q11). The caller has already validated the name and
// the id (the request schemas), so the only checks here are the ones the database decides.
// Cash and card are not rows and appear nowhere in this module.

/** A custom tender method as a route answers it. */
export interface TenderMethod {
  tenderMethodId: string;
  name: string;
  isActive: boolean;
}

export type TenderMethodOutcome =
  | { kind: 'OK'; tenderMethod: TenderMethod }
  | { kind: 'NOT_FOUND' }
  /** An active method already holds the name, in any case. */
  | { kind: 'DUPLICATE' };

interface TenderMethodRow {
  id: string;
  name: string;
  is_active: boolean;
}

const COLUMNS = 'id, name, is_active';

const UNIQUE_VIOLATION = '23505';
const ACTIVE_NAME_KEY = 'tender_method_active_name_key';

// A PostgreSQL error's `detail` quotes the name, so a database error on this table is
// replaced, never wrapped, and keeps no cause (ADR-010 rule 2, B-12).
const DATABASE_FAILURE = 'The tender method store failed';

const viewOf = (row: TenderMethodRow): TenderMethod => ({
  tenderMethodId: row.id,
  name: row.name,
  isActive: row.is_active,
});

const ok = (row: TenderMethodRow): TenderMethodOutcome => ({ kind: 'OK', tenderMethod: viewOf(row) });

/**
 * The first statement of a command that decides on a method's state: the row, locked
 * `FOR UPDATE`, or null when there is none. The lock comes before the read, so a
 * command that finds nothing to change still waits for whoever holds the row.
 *
 * Exported for Phase 4's tender command, which reads a method while writing something
 * else. Where this row sits in ARCHITECTURE section 8's lock order is Phase 4's to
 * decide, with an architect; this phase's commands take no other lock.
 */
export async function lockTenderMethod(
  client: Pick<pg.PoolClient, 'query'>,
  tenderMethodId: string
): Promise<TenderMethodRow | null> {
  const res = await client.query<TenderMethodRow>(
    `SELECT ${COLUMNS} FROM tender_method WHERE id = $1 FOR UPDATE`,
    [tenderMethodId]
  );
  return res.rows[0] ?? null;
}

/**
 * Runs one command's transaction. A unique violation on the active-name index is the
 * answer `DUPLICATE`; any other database error, a unique violation on another
 * constraint included, is a fault.
 */
async function command(
  run: (client: pg.PoolClient) => Promise<TenderMethodOutcome>
): Promise<TenderMethodOutcome> {
  try {
    return await withTransaction(run);
  } catch (err) {
    const { code, constraint } = (typeof err === 'object' && err !== null ? err : {}) as {
      code?: unknown;
      constraint?: unknown;
    };
    if (code === UNIQUE_VIOLATION && constraint === ACTIVE_NAME_KEY) return { kind: 'DUPLICATE' };
    throw new Error(DATABASE_FAILURE);
  }
}

/** Every custom method, active and inactive, in the order they were made. */
export async function listTenderMethods(): Promise<TenderMethod[]> {
  try {
    const rows = await query<TenderMethodRow>(
      `SELECT ${COLUMNS} FROM tender_method ORDER BY created_at, id`
    );
    return rows.map(viewOf);
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}

/** No lock: the unique index serialises two creates of one name. */
export function createTenderMethod(name: string): Promise<TenderMethodOutcome> {
  return command(async (client) => {
    const res = await client.query<TenderMethodRow>(
      `INSERT INTO tender_method (name) VALUES ($1) RETURNING ${COLUMNS}`,
      [name]
    );
    return ok(res.rows[0]!);
  });
}

/** Renaming an inactive method to a name an active one holds is allowed. */
export function renameTenderMethod(tenderMethodId: string, name: string): Promise<TenderMethodOutcome> {
  return command(async (client) => {
    const row = await lockTenderMethod(client, tenderMethodId);
    if (row === null) return { kind: 'NOT_FOUND' };
    if (row.name === name) return ok(row);
    const res = await client.query<TenderMethodRow>(
      `UPDATE tender_method SET name = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [tenderMethodId, name]
    );
    return ok(res.rows[0]!);
  });
}

export function deactivateTenderMethod(tenderMethodId: string): Promise<TenderMethodOutcome> {
  return command(async (client) => {
    const row = await lockTenderMethod(client, tenderMethodId);
    if (row === null) return { kind: 'NOT_FOUND' };
    if (!row.is_active) return ok(row);
    const res = await client.query<TenderMethodRow>(
      `UPDATE tender_method SET is_active = false WHERE id = $1 RETURNING ${COLUMNS}`,
      [tenderMethodId]
    );
    return ok(res.rows[0]!);
  });
}

/** Refused `DUPLICATE` when an active method holds the name: reactivation takes no new name. */
export function reactivateTenderMethod(tenderMethodId: string): Promise<TenderMethodOutcome> {
  return command(async (client) => {
    const row = await lockTenderMethod(client, tenderMethodId);
    if (row === null) return { kind: 'NOT_FOUND' };
    if (row.is_active) return ok(row);
    const res = await client.query<TenderMethodRow>(
      `UPDATE tender_method SET is_active = true WHERE id = $1 RETURNING ${COLUMNS}`,
      [tenderMethodId]
    );
    return ok(res.rows[0]!);
  });
}
