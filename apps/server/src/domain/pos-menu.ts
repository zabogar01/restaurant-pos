import type { Money } from '@pos/money';
import { rateFromPpm } from '@pos/money';
import { query, withTransaction } from '../db/pool.js';
import type { CatalogTx } from './catalog.js';
import type { PresetValue } from './discount-preset.js';

// What the POS may read of the catalog (ARCHITECTURE 4.3, ADR-012 rules 10 to 12, consult
// C4, PHASE1-S7a). Two reads, neither of which writes or audits: the catalog version alone,
// which the POS polls, and the menu projection with the version of the same snapshot. The
// projection holds only what the POS may show, and the filter is in SQL, so an archived
// name is never loaded: an archived category and everything in it, an archived item, a
// removed variant or modifier and a deactivated preset are absent. An 86'd item is
// present, marked. It cannot be built from `readCatalog` and `listPresets`, which are two
// snapshots.

export interface PosMenuOption {
  optionId: string;
  name: string;
  /** Signed for a variant, zero or more for a modifier. */
  priceDelta: Money;
}

export interface PosMenuItem {
  itemId: string;
  categoryId: string;
  name: string;
  /** Tax-inclusive. */
  basePrice: Money;
  /** false = 86'd. */
  isAvailable: boolean;
  variants: PosMenuOption[];
  modifiers: PosMenuOption[];
}

export interface PosMenuPreset {
  presetId: string;
  name: string;
  value: PresetValue;
}

/** The menu and the catalog version it was read at, from one snapshot, each list in the order the POS draws it. */
export interface PosMenuSnapshot {
  version: number;
  categories: Array<{ categoryId: string; name: string }>;
  items: PosMenuItem[];
  presets: PosMenuPreset[];
}

interface CategoryRow {
  id: string;
  name: string;
  display_order: number;
}

interface ItemRow {
  id: string;
  category_id: string;
  name: string;
  base_price: string;
  display_order: number;
  is_available: boolean;
}

interface OptionRow {
  id: string;
  item_id: string;
  name: string;
  price_delta: string;
  display_order: number;
}

interface PresetRow {
  id: string;
  name: string;
  kind: 'PERCENTAGE' | 'FIXED';
  rate_ppm: string | null;
  amount: string | null;
}

// A PostgreSQL error's `detail` quotes the offending row, so a database error on these
// tables is replaced, never wrapped, and keeps no cause (ADR-010 rule 2, B-12).
const DATABASE_FAILURE = 'The POS catalog store failed';

// BO-03's collator: the order a manager saw is the order a cashier sees.
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * Display order, ties by name, then id. The database already gives display order and id;
 * a name is compared with a collator it has no equivalent of, so the tie is settled here.
 */
type Ordered = { id: string; name: string; display_order: number };

const orderThenName = (a: Ordered, b: Ordered): number =>
  a.display_order - b.display_order ||
  collator.compare(a.name, b.name) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const byOrderThenName = <T extends Ordered>(rows: T[]): T[] => [...rows].sort(orderThenName);

// pg returns bigint as a string (pool.ts); money is a bigint from the string, never a number.
const optionOf = (row: OptionRow): PosMenuOption => ({
  optionId: row.id,
  name: row.name,
  priceDelta: BigInt(row.price_delta),
});

const presetOf = (row: PresetRow): PosMenuPreset => ({
  presetId: row.id,
  name: row.name,
  value:
    row.kind === 'PERCENTAGE'
      ? { kind: 'PERCENTAGE', ratePpm: rateFromPpm(BigInt(row.rate_ppm!)) }
      : { kind: 'FIXED', amount: BigInt(row.amount!) },
});

/** The active options of the given items from `table`, grouped by item, each list in the POS's order. */
async function loadOptions(
  db: CatalogTx,
  table: 'menu_item_variant' | 'menu_item_modifier',
  itemIds: string[]
): Promise<Map<string, PosMenuOption[]>> {
  const res = await db.query<OptionRow>(
    `SELECT id, item_id, name, price_delta, display_order FROM ${table}
      WHERE item_id = ANY($1::uuid[]) AND is_active ORDER BY display_order, id`,
    [itemIds]
  );
  const byItem = new Map<string, OptionRow[]>();
  for (const row of res.rows) byItem.set(row.item_id, [...(byItem.get(row.item_id) ?? []), row]);
  return new Map([...byItem].map(([itemId, rows]) => [itemId, byOrderThenName(rows).map(optionOf)]));
}

/**
 * The version and the menu from one snapshot (ADR-012 rule 11): a read-only `REPEATABLE
 * READ` transaction, whose snapshot is taken by its first query, the version. Categories,
 * the items of each and each item's options by display order, ties by name, then id;
 * presets in creation order, then id, as BO-07 lists them.
 */
export async function readPosMenu(): Promise<PosMenuSnapshot> {
  try {
    return await withTransaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const revision = await client.query<{ version: number }>('SELECT version FROM catalog_revision');
      const categoryRows = await client.query<CategoryRow>(
        'SELECT id, name, display_order FROM menu_category WHERE is_active ORDER BY display_order, id'
      );
      const categories = byOrderThenName(categoryRows.rows);
      const itemRows = await client.query<ItemRow>(
        `SELECT i.id, i.category_id, i.name, i.base_price, i.display_order, i.is_available
           FROM menu_item i JOIN menu_category c ON c.id = i.category_id
          WHERE i.is_active AND c.is_active
          ORDER BY i.display_order, i.id`
      );
      const itemIds = itemRows.rows.map((row) => row.id);
      const variants = await loadOptions(client, 'menu_item_variant', itemIds);
      const modifiers = await loadOptions(client, 'menu_item_modifier', itemIds);
      const presetRows = await client.query<PresetRow>(
        `SELECT id, name, kind, rate_ppm, amount FROM discount_preset
          WHERE is_active ORDER BY created_at, id`
      );

      // The items of each category, in the categories' order. Only the SQL filter keeps an
      // item of an archived category out: nothing here drops one.
      const place = new Map(categories.map((row, index) => [row.id, index]));
      const placeOf = (row: ItemRow) => place.get(row.category_id) ?? categories.length;
      const items = [...itemRows.rows]
        .sort((a, b) => placeOf(a) - placeOf(b) || orderThenName(a, b))
        .map(
          (row): PosMenuItem => ({
            itemId: row.id,
            categoryId: row.category_id,
            name: row.name,
            basePrice: BigInt(row.base_price),
            isAvailable: row.is_available,
            variants: variants.get(row.id) ?? [],
            modifiers: modifiers.get(row.id) ?? [],
          })
        );
      return {
        version: revision.rows[0]!.version,
        categories: categories.map((row) => ({ categoryId: row.id, name: row.name })),
        items,
        presets: presetRows.rows.map(presetOf),
      };
    });
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}

/** The catalog version alone: one single-row read, for the poll. */
export async function readCatalogVersion(): Promise<number> {
  try {
    const rows = await query<{ version: number }>('SELECT version FROM catalog_revision');
    return rows[0]!.version;
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}
