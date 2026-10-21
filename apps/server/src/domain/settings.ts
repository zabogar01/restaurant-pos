import type pg from 'pg';
import { rateFromPpm } from '@pos/money';
import type { Rate } from '@pos/money';
import { getPool, withTransaction } from '../db/pool.js';

// The installation's settings, versioned (ADR-012 Part 1, consult C1 section 1). A
// save is a new row; the current version is the highest number. No audit entry:
// settings changes are not audited (owner, Q11). The caller has already validated the
// shape of every value (the request schema) and decoded the rates, so the only checks
// here are the ones the database decides and the version comparison.

/** What a save carries. No currency, precision or calculation policy: none can be passed. */
export interface SettingsValues {
  taxRate: Rate;
  serviceChargeRate: Rate;
  outletName: string;
  address: string;
  phone: string;
  /** Optional; null is none. */
  npwpd: string | null;
  footer: string;
}

/** A saved version as a route answers it. */
export interface SettingsVersion extends SettingsValues {
  version: number;
  createdAt: Date;
  /** The saving manager's name (B-13), read in the same statement. */
  createdByName: string;
}

export type SaveOutcome =
  /** A new version was written and is now current. */
  | { kind: 'SAVED'; current: SettingsVersion }
  /** Every value equals the current version's: nothing was written; `current` is that version. */
  | { kind: 'UNCHANGED'; current: SettingsVersion }
  /** The request was built on a version that is no longer current (or none, or one that now exists). */
  | { kind: 'STALE' };

interface VersionRow {
  version: number;
  tax_rate_ppm: string;
  service_rate_ppm: string;
  outlet_name: string;
  address: string;
  phone: string;
  npwpd: string | null;
  footer: string;
  created_at: Date;
  created_by_name: string;
}

/**
 * The only value `calculation_policy` takes today (ADR-012 rule 6): written from here,
 * never from a request. The database check refuses any other value.
 */
const CALCULATION_POLICY = 1;

const UNIQUE_VIOLATION = '23505';
const VERSION_KEY = 'settings_version_pkey';

// A PostgreSQL error's `detail` quotes the offending value, so a database error on this
// table is replaced, never wrapped, and keeps no cause (ADR-010 rule 2, B-12).
const DATABASE_FAILURE = 'The settings store failed';

const viewOf = (row: VersionRow): SettingsVersion => ({
  version: row.version,
  createdAt: row.created_at,
  createdByName: row.created_by_name,
  taxRate: rateFromPpm(BigInt(row.tax_rate_ppm)),
  serviceChargeRate: rateFromPpm(BigInt(row.service_rate_ppm)),
  outletName: row.outlet_name,
  address: row.address,
  phone: row.phone,
  npwpd: row.npwpd,
  footer: row.footer,
});

/** The version with the highest number, or null when none has been saved. One statement. */
async function highest(db: Pick<pg.PoolClient, 'query'>): Promise<SettingsVersion | null> {
  const res = await db.query<VersionRow>(
    `SELECT v.version, v.tax_rate_ppm, v.service_rate_ppm, v.outlet_name, v.address,
            v.phone, v.npwpd, v.footer, v.created_at, s.name AS created_by_name
       FROM settings_version v
       JOIN staff_user s ON s.id = v.created_by
      ORDER BY v.version DESC
      LIMIT 1`
  );
  const row = res.rows[0];
  return row === undefined ? null : viewOf(row);
}

/** The current settings version, or null before the first save (ADR-012 rule 1). */
export async function readCurrentSettings(): Promise<SettingsVersion | null> {
  try {
    return await highest(getPool());
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}

const sameValues = (a: SettingsValues, b: SettingsValues): boolean =>
  a.taxRate === b.taxRate &&
  a.serviceChargeRate === b.serviceChargeRate &&
  a.outletName === b.outletName &&
  a.address === b.address &&
  a.phone === b.phone &&
  a.npwpd === b.npwpd &&
  a.footer === b.footer;

/**
 * One transaction (C1 section 1.3; ADR-012 rules 2 to 4). In order: read the highest
 * number; refuse `STALE` if `expectedVersion` is not it (null when none exists); answer
 * `UNCHANGED` and write nothing if every value equals that version's; otherwise insert
 * the next number. A unique violation on the version key is the same stale condition
 * reached by two saves at once. Any other database error is a fault.
 */
export async function saveSettings(input: {
  actorId: string;
  expectedVersion: number | null;
  values: SettingsValues;
}): Promise<SaveOutcome> {
  const { actorId, expectedVersion, values } = input;
  try {
    return await withTransaction<SaveOutcome>(async (client) => {
      const current = await highest(client);
      if ((current?.version ?? null) !== expectedVersion) return { kind: 'STALE' };
      if (current !== null && sameValues(current, values)) return { kind: 'UNCHANGED', current };

      const next = (current?.version ?? 0) + 1;
      await client.query(
        `INSERT INTO settings_version
           (version, tax_rate_ppm, service_rate_ppm, outlet_name, address, phone, npwpd,
            footer, calculation_policy, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          next,
          values.taxRate.toString(10),
          values.serviceChargeRate.toString(10),
          values.outletName,
          values.address,
          values.phone,
          values.npwpd,
          values.footer,
          CALCULATION_POLICY,
          actorId,
        ]
      );
      // The row as committed in this transaction, so the answer carries the database's
      // own created_at and the manager's name.
      const saved = await highest(client);
      return { kind: 'SAVED', current: saved! };
    });
  } catch (err) {
    const { code, constraint } = (typeof err === 'object' && err !== null ? err : {}) as {
      code?: unknown;
      constraint?: unknown;
    };
    if (code === UNIQUE_VIOLATION && constraint === VERSION_KEY) return { kind: 'STALE' };
    throw new Error(DATABASE_FAILURE);
  }
}
