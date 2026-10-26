import type pg from 'pg';
import type { Money } from '@pos/money';
import { withTransaction } from '../db/pool.js';

// The menu catalog (FR-C1 to FR-C8, ADR-012 Part 2, consult C1 section 2): categories,
// items, and each item's variants and modifiers, behind one coordination row. Every
// command writes through `catalogWrite`, which locks the row first, refuses a stale edit
// with nothing written, and advances the version by exactly one when it wrote anything.
// No audit entry: catalog changes are not audited (owner, Q11). The caller has already
// validated the shape of every value (the request schemas), so the only checks here are
// the ones the stored state and the database decide. Like tender-method.ts, the domain
// answers with outcomes; the routes raise the errors.

// ---- the records a command answers with ------------------------------------------

export interface CatalogCategory {
  categoryId: string;
  name: string;
  displayOrder: number;
  /** false = archived. */
  isActive: boolean;
}

/** A variant or a modifier. */
export interface CatalogOption {
  optionId: string;
  name: string;
  /** Signed for a variant, zero or more for a modifier. */
  priceDelta: Money;
  displayOrder: number;
  /** false = removed. */
  isActive: boolean;
}

/** An item with all its options, removed ones included and marked. */
export interface CatalogItem {
  itemId: string;
  categoryId: string;
  name: string;
  /** Tax-inclusive. */
  basePrice: Money;
  displayOrder: number;
  /** false = 86'd; written by the 86 commands only. */
  isAvailable: boolean;
  /** false = archived. */
  isActive: boolean;
  variants: CatalogOption[];
  modifiers: CatalogOption[];
}

/** The whole catalog and the version it was read at, from one snapshot. */
export interface CatalogSnapshot {
  version: number;
  categories: CatalogCategory[];
  items: CatalogItem[];
}

// ---- the outcomes -----------------------------------------------------------------

/** Which record's name an active row already holds. */
export type DuplicateSubject = 'CATEGORY' | 'ITEM' | 'VARIANT' | 'MODIFIER';

export type CatalogOutcome<R> =
  /** Wrote; `version` is the advanced one. */
  | { kind: 'OK'; version: number; record: R }
  /** Nothing to write; `version` is the current one. */
  | { kind: 'UNCHANGED'; version: number; record: R }
  /** The expected version is not current, or an archived category was named as a destination. */
  | { kind: 'STALE' }
  /** An unknown category, item or option id. */
  | { kind: 'NOT_FOUND' }
  /** An active row already holds the name, in any case. */
  | { kind: 'DUPLICATE'; of: DuplicateSubject }
  /** A command whose shape only the stored state can judge: a list that is not the whole scope, a repeated id or key. */
  | { kind: 'INVALID' };

// ---- the one write path -------------------------------------------------------------

/**
 * What a command that carries no version passes to `catalogWrite`. A symbol, so that a
 * versioned command's `expected: number` can never be this by accident: version 0 is a
 * real version, the empty catalog.
 */
export const UNVERSIONED = Symbol('unversioned');

/** What a command body reports: whether it wrote anything, and the record to answer with. */
export interface Written<R> {
  wrote: boolean;
  record: R;
}

/** A database transaction a body runs in. */
export type CatalogTx = Pick<pg.PoolClient, 'query'>;

type Refusal = 'STALE' | 'NOT_FOUND' | 'INVALID';

/** Thrown from inside a body so the transaction rolls back and nothing it wrote survives. */
class Refused extends Error {
  constructor(readonly refusal: Refusal) {
    super(refusal);
  }
}

/** Stops a body: the transaction is rolled back and the command answers `refusal`. */
export function refuse(refusal: Refusal): never {
  throw new Refused(refusal);
}

const UNIQUE_VIOLATION = '23505';
const DUPLICATE_OF: Record<string, DuplicateSubject> = {
  menu_category_active_name_key: 'CATEGORY',
  menu_item_active_name_key: 'ITEM',
  menu_item_variant_active_name_key: 'VARIANT',
  menu_item_modifier_active_name_key: 'MODIFIER',
};

// A PostgreSQL error's `detail` quotes the offending row, so a database error on these
// tables is replaced, never wrapped, and keeps no cause (ADR-010 rule 2, B-12).
const DATABASE_FAILURE = 'The catalog store failed';

/**
 * Every catalog write (ADR-012 rules 9, 10, 13 and 14), in one transaction. In order:
 * lock `catalog_revision` `FOR UPDATE` as the first statement, before anything the body
 * validates is read; answer `STALE` and write nothing if `expected` is a number that is
 * not the version; run the body; advance the version by one if the body wrote anything;
 * answer the version now current. A body stops itself with `refuse`. A unique violation
 * on one of the four active-name indexes is `DUPLICATE`; any other database error is a
 * fault.
 *
 * Commands that edit pass the version they were built on. Creates and state commands
 * (archive, restore) pass `UNVERSIONED`, and still take the lock.
 */
export async function catalogWrite<R>(
  expected: number | typeof UNVERSIONED,
  body: (tx: CatalogTx) => Promise<Written<R>>
): Promise<CatalogOutcome<R>> {
  try {
    return await withTransaction<CatalogOutcome<R>>(async (client) => {
      const locked = await client.query<{ version: number }>(
        'SELECT version FROM catalog_revision FOR UPDATE'
      );
      const current = locked.rows[0]!.version;
      if (expected !== UNVERSIONED && expected !== current) return { kind: 'STALE' };

      const { wrote, record } = await body(client);
      if (!wrote) return { kind: 'UNCHANGED', version: current, record };
      const advanced = await client.query<{ version: number }>(
        'UPDATE catalog_revision SET version = version + 1 RETURNING version'
      );
      return { kind: 'OK', version: advanced.rows[0]!.version, record };
    });
  } catch (err) {
    if (err instanceof Refused) return { kind: err.refusal };
    const { code, constraint } = (typeof err === 'object' && err !== null ? err : {}) as {
      code?: unknown;
      constraint?: unknown;
    };
    if (code === UNIQUE_VIOLATION && typeof constraint === 'string' && constraint in DUPLICATE_OF) {
      return { kind: 'DUPLICATE', of: DUPLICATE_OF[constraint]! };
    }
    throw new Error(DATABASE_FAILURE);
  }
}

// ---- reading ------------------------------------------------------------------------

interface CategoryRow {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

interface ItemRow {
  id: string;
  category_id: string;
  name: string;
  base_price: string;
  display_order: number;
  is_available: boolean;
  is_active: boolean;
}

interface OptionRow {
  id: string;
  item_id: string;
  name: string;
  price_delta: string;
  display_order: number;
  is_active: boolean;
}

const CATEGORY_COLUMNS = 'id, name, display_order, is_active';
const ITEM_COLUMNS = 'id, category_id, name, base_price, display_order, is_available, is_active';
const OPTION_COLUMNS = 'id, item_id, name, price_delta, display_order, is_active';

const categoryOf = (row: CategoryRow): CatalogCategory => ({
  categoryId: row.id,
  name: row.name,
  displayOrder: row.display_order,
  isActive: row.is_active,
});

// pg returns bigint as a string (pool.ts); money is a bigint from the string, never a number.
const optionOf = (row: OptionRow): CatalogOption => ({
  optionId: row.id,
  name: row.name,
  priceDelta: BigInt(row.price_delta),
  displayOrder: row.display_order,
  isActive: row.is_active,
});

const itemOf = (row: ItemRow, variants: CatalogOption[], modifiers: CatalogOption[]): CatalogItem => ({
  itemId: row.id,
  categoryId: row.category_id,
  name: row.name,
  basePrice: BigInt(row.base_price),
  displayOrder: row.display_order,
  isAvailable: row.is_available,
  isActive: row.is_active,
  variants,
  modifiers,
});

/** Categories matching `where` (with `params`), by display order then id. */
async function loadCategories(db: CatalogTx, where: string, params: unknown[] = []): Promise<CatalogCategory[]> {
  const res = await db.query<CategoryRow>(
    `SELECT ${CATEGORY_COLUMNS} FROM menu_category WHERE ${where} ORDER BY display_order, id`,
    params
  );
  return res.rows.map(categoryOf);
}

async function loadOptions(db: CatalogTx, table: OptionTable, itemIds: string[]): Promise<Map<string, CatalogOption[]>> {
  const res = await db.query<OptionRow>(
    `SELECT ${OPTION_COLUMNS} FROM ${table} WHERE item_id = ANY($1::uuid[]) ORDER BY display_order, id`,
    [itemIds]
  );
  const byItem = new Map<string, CatalogOption[]>();
  for (const row of res.rows) {
    const list = byItem.get(row.item_id) ?? [];
    list.push(optionOf(row));
    byItem.set(row.item_id, list);
  }
  return byItem;
}

/** Items matching `where` (with `params`), each with all its options, by display order then id. */
async function loadItems(db: CatalogTx, where: string, params: unknown[] = []): Promise<CatalogItem[]> {
  const res = await db.query<ItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM menu_item WHERE ${where} ORDER BY display_order, id`,
    params
  );
  const ids = res.rows.map((row) => row.id);
  const variants = await loadOptions(db, 'menu_item_variant', ids);
  const modifiers = await loadOptions(db, 'menu_item_modifier', ids);
  return res.rows.map((row) => itemOf(row, variants.get(row.id) ?? [], modifiers.get(row.id) ?? []));
}

async function loadItem(db: CatalogTx, itemId: string): Promise<CatalogItem> {
  return (await loadItems(db, 'id = $1', [itemId]))[0]!;
}

/**
 * The version and every category, item and option from one snapshot (ADR-012 rule 11):
 * a read-only `REPEATABLE READ` transaction, whose snapshot is taken by its first
 * query, the version. Archived categories and items and removed options are included,
 * marked. Ordered by display order then id; grouping and tie-breaking by name are the
 * screens'.
 */
export async function readCatalog(): Promise<CatalogSnapshot> {
  try {
    return await withTransaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const revision = await client.query<{ version: number }>('SELECT version FROM catalog_revision');
      const categories = await loadCategories(client, 'true');
      const items = await loadItems(client, 'true');
      return { version: revision.rows[0]!.version, categories, items };
    });
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}

// ---- display order --------------------------------------------------------------------

/** Rewrites the display order of `ids` to 0..n-1 in the given order, and of nothing else. */
async function writeOrder(db: CatalogTx, table: string, ids: string[]): Promise<void> {
  await db.query(
    `UPDATE ${table} t SET display_order = v.ord
       FROM unnest($1::uuid[], $2::int[]) AS v(id, ord)
      WHERE t.id = v.id`,
    [ids, ids.map((_, index) => index)]
  );
}

/**
 * Whether `ids` is already the order of `rows`: the same ids in the same sequence, and
 * display orders that already tell them apart. Gaps (an archived row between two) are
 * fine; a tie is not, because the screens then break it by name, so a save that settles
 * it is a change.
 */
function isCurrentOrder(rows: Array<{ id: string; display_order: number }>, ids: string[]): boolean {
  return rows.every(
    (row, index) =>
      row.id === ids[index] && (index === 0 || rows[index - 1]!.display_order < row.display_order)
  );
}

/** `ids` is the active rows' ids, each once and nothing else. */
function isExactlyTheSet(activeIds: string[], ids: string[]): boolean {
  if (ids.length !== activeIds.length || new Set(ids).size !== ids.length) return false;
  const active = new Set(activeIds);
  return ids.every((id) => active.has(id));
}

// ---- categories -----------------------------------------------------------------------

interface CategoryScopeRow {
  id: string;
  display_order: number;
}

async function readCategory(db: CatalogTx, categoryId: string): Promise<CatalogCategory | null> {
  return (await loadCategories(db, 'id = $1', [categoryId]))[0] ?? null;
}

/** A new category goes last among all categories. */
export function createCategory(name: string): Promise<CatalogOutcome<CatalogCategory>> {
  return catalogWrite(UNVERSIONED, async (tx) => {
    const res = await tx.query<CategoryRow>(
      `INSERT INTO menu_category (name, display_order)
       VALUES ($1, (SELECT COALESCE(MAX(display_order) + 1, 0) FROM menu_category))
       RETURNING ${CATEGORY_COLUMNS}`,
      [name]
    );
    return { wrote: true, record: categoryOf(res.rows[0]!) };
  });
}

/** Renaming an archived category to a name an active one holds is allowed. */
export function editCategory(
  categoryId: string,
  expected: number,
  changes: { name: string }
): Promise<CatalogOutcome<CatalogCategory>> {
  return catalogWrite(expected, async (tx) => {
    const current = await readCategory(tx, categoryId);
    if (current === null) return refuse('NOT_FOUND');
    if (current.name === changes.name) return { wrote: false, record: current };
    const res = await tx.query<CategoryRow>(
      `UPDATE menu_category SET name = $2 WHERE id = $1 RETURNING ${CATEGORY_COLUMNS}`,
      [categoryId, changes.name]
    );
    return { wrote: true, record: categoryOf(res.rows[0]!) };
  });
}

/**
 * The list must be exactly the active categories, each once. Archived categories keep
 * their stored order. Answers the active categories in their new order.
 */
export function reorderCategories(
  expected: number,
  categoryIds: string[]
): Promise<CatalogOutcome<CatalogCategory[]>> {
  return catalogWrite(expected, async (tx) => {
    const active = await tx.query<CategoryScopeRow>(
      'SELECT id, display_order FROM menu_category WHERE is_active ORDER BY display_order, id'
    );
    if (!isExactlyTheSet(active.rows.map((row) => row.id), categoryIds)) return refuse('INVALID');
    const unchanged = isCurrentOrder(active.rows, categoryIds);
    if (!unchanged) await writeOrder(tx, 'menu_category', categoryIds);
    return { wrote: !unchanged, record: await loadCategories(tx, 'is_active') };
  });
}

async function setCategoryActive(categoryId: string, isActive: boolean): Promise<CatalogOutcome<CatalogCategory>> {
  return catalogWrite(UNVERSIONED, async (tx) => {
    const current = await readCategory(tx, categoryId);
    if (current === null) return refuse('NOT_FOUND');
    if (current.isActive === isActive) return { wrote: false, record: current };
    const res = await tx.query<CategoryRow>(
      `UPDATE menu_category SET is_active = $2 WHERE id = $1 RETURNING ${CATEGORY_COLUMNS}`,
      [categoryId, isActive]
    );
    return { wrote: true, record: categoryOf(res.rows[0]!) };
  });
}

/** Changes one flag: its items are not touched. */
export const archiveCategory = (categoryId: string) => setCategoryActive(categoryId, false);

/** `DUPLICATE` when an active category holds the name. */
export const restoreCategory = (categoryId: string) => setCategoryActive(categoryId, true);

// ---- items ----------------------------------------------------------------------------

export type OptionTable = 'menu_item_variant' | 'menu_item_modifier';

/** A variant or modifier a new item is created with, in the order given. */
export interface OptionInput {
  name: string;
  priceDelta: Money;
}

export interface CreateItemInput {
  categoryId: string;
  name: string;
  basePrice: Money;
  variants: OptionInput[];
  modifiers: OptionInput[];
}

/** An option added by an edit; `key` is chosen by the client, unique within the list, and names the option in `order`. */
export interface OptionAdd extends OptionInput {
  key: string;
}

/** An existing active option of this item and list, with only what changes. */
export interface OptionEdit {
  id: string;
  name?: string;
  priceDelta?: Money;
}

/** An option in `order`: an existing one by id, or an added one by its key. */
export type OptionRef = { id: string } | { key: string };

/** What an edit does to one list. Nothing here replaces the list. */
export interface OptionListChanges {
  added?: OptionAdd[];
  edited?: OptionEdit[];
  /** Set inactive. A removed option is not restored. */
  removed?: string[];
  /** Every option of the list that will be active after the save, each once. */
  order?: OptionRef[];
}

export interface ItemChanges {
  /** Only what changes. */
  fields?: { name?: string; basePrice?: Money; categoryId?: string };
  variants?: OptionListChanges;
  modifiers?: OptionListChanges;
}

const LISTS = [
  { list: 'variants', table: 'menu_item_variant' },
  { list: 'modifiers', table: 'menu_item_modifier' },
] as const satisfies ReadonlyArray<{ list: 'variants' | 'modifiers'; table: OptionTable }>;

/** The display order after the largest one among the rows where `where` equals `param`; 0 when there are none. */
async function nextOrder(db: CatalogTx, table: string, where: string, param: string): Promise<number> {
  const res = await db.query<{ next: number }>(
    `SELECT COALESCE(MAX(display_order) + 1, 0) AS next FROM ${table} WHERE ${where} = $1`,
    [param]
  );
  return res.rows[0]!.next;
}

/** Inserts options last in their list, in the given order; answers each new id by its position in `options`. */
async function insertOptions(db: CatalogTx, table: OptionTable, itemId: string, options: OptionInput[]): Promise<string[]> {
  if (options.length === 0) return [];
  const first = await nextOrder(db, table, 'item_id', itemId);
  const res = await db.query<{ id: string; display_order: number }>(
    `INSERT INTO ${table} (item_id, name, price_delta, display_order)
     SELECT $1, v.name, v.price_delta, v.ord
       FROM unnest($2::text[], $3::bigint[], $4::int[]) AS v(name, price_delta, ord)
     RETURNING id, display_order`,
    [
      itemId,
      options.map((option) => option.name),
      options.map((option) => option.priceDelta.toString(10)),
      options.map((_, index) => first + index),
    ]
  );
  const ids: string[] = [];
  for (const row of res.rows) ids[row.display_order - first] = row.id;
  return ids;
}

/**
 * A new item goes last among all items of its category, with its options in the given
 * order, as one write: the version advances once however many rows are written. An
 * unknown category is `NOT_FOUND`; an archived one is `STALE` (the only way to name one
 * is a read from before it was archived). `DUPLICATE` is the item's name, or two
 * options of one list with one name.
 */
export function createItem(input: CreateItemInput): Promise<CatalogOutcome<CatalogItem>> {
  return catalogWrite(UNVERSIONED, async (tx) => {
    await requireActiveCategory(tx, input.categoryId);
    const order = await nextOrder(tx, 'menu_item', 'category_id', input.categoryId);
    const res = await tx.query<{ id: string }>(
      `INSERT INTO menu_item (category_id, name, base_price, display_order)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.categoryId, input.name, input.basePrice.toString(10), order]
    );
    const itemId = res.rows[0]!.id;
    await insertOptions(tx, 'menu_item_variant', itemId, input.variants);
    await insertOptions(tx, 'menu_item_modifier', itemId, input.modifiers);
    return { wrote: true, record: await loadItem(tx, itemId) };
  });
}

/** An unknown category stops the command `NOT_FOUND`, an archived one `STALE`. */
async function requireActiveCategory(tx: CatalogTx, categoryId: string): Promise<void> {
  const res = await tx.query<{ is_active: boolean }>('SELECT is_active FROM menu_category WHERE id = $1', [categoryId]);
  const row = res.rows[0];
  if (row === undefined) return refuse('NOT_FOUND');
  if (!row.is_active) return refuse('STALE');
}

/** A list of changes, checked against the stored options and ready to apply. */
interface ListPlan {
  table: OptionTable;
  changes: OptionListChanges;
  /** The item's active options in this list, by display order then id. */
  active: OptionRow[];
  /** Edits that change something, split by whether the name does. */
  renamed: OptionEdit[];
  repriced: OptionEdit[];
  removed: string[];
}

const hasEdit = (changes: OptionListChanges | undefined) =>
  changes !== undefined &&
  ((changes.added?.length ?? 0) > 0 ||
    (changes.edited?.length ?? 0) > 0 ||
    (changes.removed?.length ?? 0) > 0 ||
    changes.order !== undefined);

/** An id twice across `edited` and `removed`, or a key twice in `added`. */
function shapeIsValid(changes: OptionListChanges): boolean {
  const ids = [...(changes.edited ?? []).map((edit) => edit.id), ...(changes.removed ?? [])];
  const keys = (changes.added ?? []).map((add) => add.key);
  return new Set(ids).size === ids.length && new Set(keys).size === keys.length;
}

const refToken = (ref: OptionRef): string => ('id' in ref ? `id:${ref.id}` : `key:${ref.key}`);

/** `order` is exactly the options that will be active after the save, each once. */
function orderIsFinalSet(plan: ListPlan): boolean {
  const { changes, active } = plan;
  if (changes.order === undefined) return true;
  const removed = new Set(plan.removed);
  const final = [
    ...active.filter((row) => !removed.has(row.id)).map((row) => `id:${row.id}`),
    ...(changes.added ?? []).map((add) => `key:${add.key}`),
  ];
  return isExactlyTheSet(final, changes.order.map(refToken));
}

async function planList(
  tx: CatalogTx,
  itemId: string,
  table: OptionTable,
  changes: OptionListChanges
): Promise<ListPlan> {
  const res = await tx.query<OptionRow>(
    `SELECT ${OPTION_COLUMNS} FROM ${table} WHERE item_id = $1 AND is_active ORDER BY display_order, id`,
    [itemId]
  );
  const active = res.rows;
  const byId = new Map(active.map((row) => [row.id, row]));
  const edited = changes.edited ?? [];
  const removed = changes.removed ?? [];
  // Another item's option, the other list's option and an already removed one are all
  // not in `active`.
  if (![...edited.map((edit) => edit.id), ...removed].every((id) => byId.has(id))) return refuse('NOT_FOUND');

  const differs = (edit: OptionEdit, field: 'name' | 'priceDelta'): boolean => {
    const stored = byId.get(edit.id)!;
    return field === 'name'
      ? edit.name !== undefined && edit.name !== stored.name
      : edit.priceDelta !== undefined && edit.priceDelta !== BigInt(stored.price_delta);
  };
  return {
    table,
    changes,
    active,
    renamed: edited.filter((edit) => differs(edit, 'name')),
    repriced: edited.filter((edit) => !differs(edit, 'name') && differs(edit, 'priceDelta')),
    removed,
  };
}

/** The plan writes nothing: no addition, removal or edit, and an order that is the current one. */
function listIsUnchanged(plan: ListPlan): boolean {
  const { changes, active } = plan;
  if ((changes.added?.length ?? 0) > 0 || plan.removed.length > 0) return false;
  if (plan.renamed.length > 0 || plan.repriced.length > 0) return false;
  if (changes.order === undefined) return true;
  return isCurrentOrder(active, changes.order.map((ref) => ('id' in ref ? ref.id : '')));
}

/**
 * Applies one list's changes in the order that lets one save swap two names, or remove
 * an option and add another with its name (DESIGN-020). The active-name index is checked
 * row by row, so every row whose name changes, or that is removed, is first made
 * inactive, and the renamed ones are made active again in one statement after their
 * names are written. A real duplicate in the final state still fails on the index, at
 * the reactivation or at the insertion, and the whole transaction rolls back. Every
 * intermediate state is invisible: one transaction, and the catalog_revision lock keeps
 * any other catalog write out.
 */
async function applyList(tx: CatalogTx, itemId: string, plan: ListPlan): Promise<void> {
  const { table, changes } = plan;
  const renamedIds = plan.renamed.map((edit) => edit.id);

  // 1. removals
  if (plan.removed.length > 0) {
    await tx.query(`UPDATE ${table} SET is_active = false WHERE id = ANY($1::uuid[])`, [plan.removed]);
  }
  // 2. renamed options step out of the index
  if (renamedIds.length > 0) {
    await tx.query(`UPDATE ${table} SET is_active = false WHERE id = ANY($1::uuid[])`, [renamedIds]);
  }
  // 3. the edits: names and price changes of the renamed, price changes of the rest
  for (const edit of [...plan.renamed, ...plan.repriced]) {
    await tx.query(
      `UPDATE ${table} SET name = COALESCE($2, name), price_delta = COALESCE($3::bigint, price_delta) WHERE id = $1`,
      [edit.id, edit.name ?? null, edit.priceDelta === undefined ? null : edit.priceDelta.toString(10)]
    );
  }
  // 4. the renamed options step back in, together
  if (renamedIds.length > 0) {
    await tx.query(`UPDATE ${table} SET is_active = true WHERE id = ANY($1::uuid[])`, [renamedIds]);
  }
  // 5. the additions, last in the order given
  const addedIds = await insertOptions(tx, table, itemId, changes.added ?? []);
  // 6. the order, when the save carries one
  if (changes.order !== undefined) {
    const keyed = new Map((changes.added ?? []).map((add, index) => [add.key, addedIds[index]!]));
    await writeOrder(tx, table, changes.order.map((ref) => ('id' in ref ? ref.id : keyed.get(ref.key)!)));
  }
}

/**
 * One save of BO-04 (DESIGN-020): an explicit change list under one version check,
 * applied in one transaction, advancing the version once. Checks, in order: the version;
 * the item (`NOT_FOUND`); the shape (`INVALID`: an id twice across `edited` and
 * `removed`, or a key twice); every edited or removed id being an active option of this
 * item and this list (`NOT_FOUND`); a move into a category (`NOT_FOUND`, or `STALE` when
 * it is archived); `order` being exactly the list's final active set (`INVALID`). A
 * save whose every change equals the stored state writes nothing. Editing an archived
 * item is allowed.
 */
export function editItem(
  itemId: string,
  expected: number,
  changes: ItemChanges
): Promise<CatalogOutcome<CatalogItem>> {
  return catalogWrite(expected, async (tx) => {
    const found = await tx.query<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM menu_item WHERE id = $1`, [itemId]);
    const item = found.rows[0];
    if (item === undefined) return refuse('NOT_FOUND');

    for (const { list } of LISTS) {
      const listChanges = changes[list];
      if (listChanges !== undefined && !shapeIsValid(listChanges)) return refuse('INVALID');
    }
    const plans: ListPlan[] = [];
    for (const { list, table } of LISTS) {
      const listChanges = changes[list];
      if (hasEdit(listChanges)) plans.push(await planList(tx, itemId, table, listChanges!));
    }

    const fields = changes.fields ?? {};
    const rename = fields.name !== undefined && fields.name !== item.name;
    const reprice = fields.basePrice !== undefined && fields.basePrice !== BigInt(item.base_price);
    const move = fields.categoryId !== undefined && fields.categoryId !== item.category_id;
    if (move) await requireActiveCategory(tx, fields.categoryId!);
    if (!plans.every(orderIsFinalSet)) return refuse('INVALID');

    if (!rename && !reprice && !move && plans.every(listIsUnchanged)) {
      return { wrote: false, record: await loadItem(tx, itemId) };
    }

    if (rename || reprice || move) {
      // A moved item goes last in its new category.
      const order = move ? await nextOrder(tx, 'menu_item', 'category_id', fields.categoryId!) : item.display_order;
      await tx.query(
        `UPDATE menu_item SET name = $2, base_price = $3, category_id = $4, display_order = $5 WHERE id = $1`,
        [
          itemId,
          rename ? fields.name : item.name,
          reprice ? fields.basePrice!.toString(10) : item.base_price,
          move ? fields.categoryId : item.category_id,
          order,
        ]
      );
    }
    for (const plan of plans) await applyList(tx, itemId, plan);
    return { wrote: true, record: await loadItem(tx, itemId) };
  });
}

/**
 * The list must be exactly the category's active items, each once. Answers them in
 * their new order. An unknown category is `NOT_FOUND`, an archived one `STALE`.
 */
export function reorderItems(
  categoryId: string,
  expected: number,
  itemIds: string[]
): Promise<CatalogOutcome<CatalogItem[]>> {
  return catalogWrite(expected, async (tx) => {
    await requireActiveCategory(tx, categoryId);
    const active = await tx.query<CategoryScopeRow>(
      'SELECT id, display_order FROM menu_item WHERE category_id = $1 AND is_active ORDER BY display_order, id',
      [categoryId]
    );
    if (!isExactlyTheSet(active.rows.map((row) => row.id), itemIds)) return refuse('INVALID');
    const unchanged = isCurrentOrder(active.rows, itemIds);
    if (!unchanged) await writeOrder(tx, 'menu_item', itemIds);
    return {
      wrote: !unchanged,
      record: await loadItems(tx, 'category_id = $1 AND is_active', [categoryId]),
    };
  });
}

async function setItemActive(itemId: string, isActive: boolean): Promise<CatalogOutcome<CatalogItem>> {
  return catalogWrite(UNVERSIONED, async (tx) => {
    const current = (await loadItems(tx, 'id = $1', [itemId]))[0];
    if (current === undefined) return refuse('NOT_FOUND');
    if (current.isActive === isActive) return { wrote: false, record: current };
    await tx.query('UPDATE menu_item SET is_active = $2 WHERE id = $1', [itemId, isActive]);
    return { wrote: true, record: await loadItem(tx, itemId) };
  });
}

/** Changes one flag: its options are not touched. */
export const archiveItem = (itemId: string) => setItemActive(itemId, false);

/**
 * `DUPLICATE` when an active item holds the name, anywhere on the menu. An item whose
 * category is archived may be restored; it stays hidden from the POS until the category
 * is restored.
 */
export const restoreItem = (itemId: string) => setItemActive(itemId, true);
