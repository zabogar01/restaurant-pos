import type { Money, Rate } from '@pos/money';
import { rateFromPpm } from '@pos/money';
import { withTransaction } from '../db/pool.js';
import { catalogWrite, refuse, UNVERSIONED } from './catalog.js';
import type { CatalogOutcome, CatalogTx } from './catalog.js';

// Discount presets (FR-B5, ADR-012 rule 10, consult C1 section 4). A preset is a catalog
// row: every committed write goes through `catalogWrite`, which locks `catalog_revision`,
// refuses a stale edit with nothing written and advances the version by exactly one. An
// edit carries the version; create, deactivate and reactivate do not (rule 13). No audit
// entry: preset changes are not audited (owner, Q11). The caller has already validated the
// shape of every value (the request schemas), so the only checks here are the ones the
// stored state and the database decide. Like catalog.ts, the domain answers with
// outcomes; the routes raise the errors.

/** What a preset takes off a subtotal: a rate in parts per million, or an amount in minor units. */
export type PresetValue = { kind: 'PERCENTAGE'; ratePpm: Rate } | { kind: 'FIXED'; amount: Money };

export interface DiscountPreset {
  presetId: string;
  name: string;
  value: PresetValue;
  /** false = deactivated; the row stays readable (FR-F5). */
  isActive: boolean;
}

/** The presets and the catalog version they were read at, from one snapshot. */
export interface PresetsSnapshot {
  version: number;
  presets: DiscountPreset[];
}

interface PresetRow {
  id: string;
  name: string;
  kind: 'PERCENTAGE' | 'FIXED';
  rate_ppm: string | null;
  amount: string | null;
  is_active: boolean;
}

const COLUMNS = 'id, name, kind, rate_ppm, amount, is_active';

// A PostgreSQL error's `detail` quotes the offending row, so a database error on this
// table is replaced, never wrapped, and keeps no cause (ADR-010 rule 2, B-12).
const DATABASE_FAILURE = 'The discount preset store failed';

// pg returns bigint as a string (pool.ts); the value is a bigint from the string, never a number.
const valueOf = (row: PresetRow): PresetValue =>
  row.kind === 'PERCENTAGE'
    ? { kind: 'PERCENTAGE', ratePpm: rateFromPpm(BigInt(row.rate_ppm!)) }
    : { kind: 'FIXED', amount: BigInt(row.amount!) };

const presetOf = (row: PresetRow): DiscountPreset => ({
  presetId: row.id,
  name: row.name,
  value: valueOf(row),
  isActive: row.is_active,
});

/** The two value columns for a value: the other one is NULL, as the table's check requires. */
const columnsOf = (value: PresetValue): { ratePpm: string | null; amount: string | null } =>
  value.kind === 'PERCENTAGE'
    ? { ratePpm: value.ratePpm.toString(10), amount: null }
    : { ratePpm: null, amount: value.amount.toString(10) };

const sameValue = (a: PresetValue, b: PresetValue): boolean =>
  a.kind === 'PERCENTAGE'
    ? b.kind === 'PERCENTAGE' && a.ratePpm === b.ratePpm
    : b.kind === 'FIXED' && a.amount === b.amount;

/**
 * One preset, or null when there is none. Within a catalog write the version lock is
 * already held, so this takes no second lock. Phase 2's apply, which takes
 * `catalog_revision` `FOR SHARE` first (ADR-012 rule 14), reads the preset it applies
 * with this.
 */
export async function readPreset(db: CatalogTx, presetId: string): Promise<DiscountPreset | null> {
  const res = await db.query<PresetRow>(`SELECT ${COLUMNS} FROM discount_preset WHERE id = $1`, [presetId]);
  return res.rows[0] === undefined ? null : presetOf(res.rows[0]);
}

/**
 * The version and every preset, active and deactivated, from one snapshot (ADR-012 rule
 * 11): a read-only `REPEATABLE READ` transaction, whose snapshot is taken by its first
 * query, the version. In creation order, then id.
 */
export async function listPresets(): Promise<PresetsSnapshot> {
  try {
    return await withTransaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const revision = await client.query<{ version: number }>('SELECT version FROM catalog_revision');
      const rows = await client.query<PresetRow>(
        `SELECT ${COLUMNS} FROM discount_preset ORDER BY created_at, id`
      );
      return { version: revision.rows[0]!.version, presets: rows.rows.map(presetOf) };
    });
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}

/** `DUPLICATE` when an active preset holds the name, in any case. */
export function createPreset(name: string, value: PresetValue): Promise<CatalogOutcome<DiscountPreset>> {
  return catalogWrite(UNVERSIONED, async (tx) => {
    const { ratePpm, amount } = columnsOf(value);
    const res = await tx.query<PresetRow>(
      `INSERT INTO discount_preset (name, kind, rate_ppm, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [name, value.kind, ratePpm, amount]
    );
    return { wrote: true, record: presetOf(res.rows[0]!) };
  });
}

/**
 * The whole preset: its name and value together. An inactive preset may be edited, to a
 * name an active one holds included (that is the way out of a refused reactivation); an
 * active preset edited into a held name is `DUPLICATE`. A name and value equal to the
 * stored ones write nothing; a change of case alone is a change.
 */
export function editPreset(
  presetId: string,
  expected: number,
  changes: { name: string; value: PresetValue }
): Promise<CatalogOutcome<DiscountPreset>> {
  return catalogWrite(expected, async (tx) => {
    const current = await readPreset(tx, presetId);
    if (current === null) return refuse('NOT_FOUND');
    if (current.name === changes.name && sameValue(current.value, changes.value)) {
      return { wrote: false, record: current };
    }
    const { ratePpm, amount } = columnsOf(changes.value);
    const res = await tx.query<PresetRow>(
      `UPDATE discount_preset SET name = $2, kind = $3, rate_ppm = $4, amount = $5
        WHERE id = $1 RETURNING ${COLUMNS}`,
      [presetId, changes.name, changes.value.kind, ratePpm, amount]
    );
    return { wrote: true, record: presetOf(res.rows[0]!) };
  });
}

function setPresetActive(presetId: string, isActive: boolean): Promise<CatalogOutcome<DiscountPreset>> {
  return catalogWrite(UNVERSIONED, async (tx) => {
    const current = await readPreset(tx, presetId);
    if (current === null) return refuse('NOT_FOUND');
    if (current.isActive === isActive) return { wrote: false, record: current };
    const res = await tx.query<PresetRow>(
      `UPDATE discount_preset SET is_active = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [presetId, isActive]
    );
    return { wrote: true, record: presetOf(res.rows[0]!) };
  });
}

/** Changes one flag; the row is kept (FR-F5). */
export const deactivatePreset = (presetId: string) => setPresetActive(presetId, false);

/** `DUPLICATE` when an active preset holds the name. */
export const reactivatePreset = (presetId: string) => setPresetActive(presetId, true);
