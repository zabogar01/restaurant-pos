import type pg from 'pg';
import { query, withTransaction } from '../db/pool.js';

// The dining table's five operations (FR-B2, consult C2). Each command is one
// transaction and writes nothing when it refuses. No audit entry: table changes are
// not audited (owner, Q11). The caller has already validated the label and the id
// (the request schemas), so the only checks here are the ones the database decides.

/** A table as a route answers it. */
export interface DiningTable {
  tableId: string;
  label: string;
  isActive: boolean;
}

export type TableOutcome =
  | { kind: 'OK'; table: DiningTable }
  | { kind: 'NOT_FOUND' }
  /** An active table already holds the label, in any case. */
  | { kind: 'DUPLICATE' };

interface TableRow {
  id: string;
  label: string;
  is_active: boolean;
}

const COLUMNS = 'id, label, is_active';

const UNIQUE_VIOLATION = '23505';
const ACTIVE_LABEL_KEY = 'dining_table_active_label_key';

// A PostgreSQL error's `detail` quotes the label, so a database error on this
// table is replaced, never wrapped, and keeps no cause (ADR-010 rule 2, B-12).
const DATABASE_FAILURE = 'The dining table store failed';

const viewOf = (row: TableRow): DiningTable => ({
  tableId: row.id,
  label: row.label,
  isActive: row.is_active,
});

const ok = (row: TableRow): TableOutcome => ({ kind: 'OK', table: viewOf(row) });

/**
 * The first statement of a command that decides on a table's state: the row, locked
 * `FOR UPDATE`, or null when there is none. The lock comes before the read, so a
 * command that finds nothing to change still waits for whoever holds the row.
 *
 * This is the one lock the tables share (ARCHITECTURE section 8: catalog row,
 * BusinessDay, DiningTable, Order, CheckoutLease and ReceiptSeries). Phase 2's
 * open-order command takes it after the BusinessDay row and before inserting the
 * order, and reads `is_active` from the row it returns. Phase 2's refusal to
 * deactivate a table holding an open order goes in `deactivateTable`, between this
 * lock and the write.
 */
export async function lockDiningTable(
  client: Pick<pg.PoolClient, 'query'>,
  tableId: string
): Promise<TableRow | null> {
  const res = await client.query<TableRow>(
    `SELECT ${COLUMNS} FROM dining_table WHERE id = $1 FOR UPDATE`,
    [tableId]
  );
  return res.rows[0] ?? null;
}

/**
 * Runs one command's transaction. A unique violation on the active-label index is
 * the answer `DUPLICATE`; any other database error, a unique violation on another
 * constraint included, is a fault.
 */
async function command(run: (client: pg.PoolClient) => Promise<TableOutcome>): Promise<TableOutcome> {
  try {
    return await withTransaction(run);
  } catch (err) {
    const { code, constraint } = (typeof err === 'object' && err !== null ? err : {}) as {
      code?: unknown;
      constraint?: unknown;
    };
    if (code === UNIQUE_VIOLATION && constraint === ACTIVE_LABEL_KEY) return { kind: 'DUPLICATE' };
    throw new Error(DATABASE_FAILURE);
  }
}

/** Every table, active and inactive, in the order they were made. */
export async function listTables(): Promise<DiningTable[]> {
  try {
    const rows = await query<TableRow>(`SELECT ${COLUMNS} FROM dining_table ORDER BY created_at, id`);
    return rows.map(viewOf);
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}

/** No lock: the unique index serialises two creates of one label. */
export function createTable(label: string): Promise<TableOutcome> {
  return command(async (client) => {
    const res = await client.query<TableRow>(
      `INSERT INTO dining_table (label) VALUES ($1) RETURNING ${COLUMNS}`,
      [label]
    );
    return ok(res.rows[0]!);
  });
}

/** Renaming an inactive table to a label an active one holds is allowed. */
export function renameTable(tableId: string, label: string): Promise<TableOutcome> {
  return command(async (client) => {
    const row = await lockDiningTable(client, tableId);
    if (row === null) return { kind: 'NOT_FOUND' };
    if (row.label === label) return ok(row);
    const res = await client.query<TableRow>(
      `UPDATE dining_table SET label = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [tableId, label]
    );
    return ok(res.rows[0]!);
  });
}

export function deactivateTable(tableId: string): Promise<TableOutcome> {
  return command(async (client) => {
    const row = await lockDiningTable(client, tableId);
    if (row === null) return { kind: 'NOT_FOUND' };
    if (!row.is_active) return ok(row);
    const res = await client.query<TableRow>(
      `UPDATE dining_table SET is_active = false WHERE id = $1 RETURNING ${COLUMNS}`,
      [tableId]
    );
    return ok(res.rows[0]!);
  });
}

/** Refused `DUPLICATE` when an active table holds the label: reactivation takes no new label. */
export function reactivateTable(tableId: string): Promise<TableOutcome> {
  return command(async (client) => {
    const row = await lockDiningTable(client, tableId);
    if (row === null) return { kind: 'NOT_FOUND' };
    if (row.is_active) return ok(row);
    const res = await client.query<TableRow>(
      `UPDATE dining_table SET is_active = true WHERE id = $1 RETURNING ${COLUMNS}`,
      [tableId]
    );
    return ok(res.rows[0]!);
  });
}
