import { inspect } from 'node:util';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveCategory,
  archiveItem,
  createCategory,
  createItem,
  editCategory,
  editItem,
  readCatalog,
  reorderCategories,
  reorderItems,
  restoreCategory,
  restoreItem,
} from '../src/domain/catalog.js';
import type {
  CatalogCategory,
  CatalogItem,
  CatalogOption,
  CatalogOutcome,
  CatalogSnapshot,
} from '../src/domain/catalog.js';
import { closePool } from '../src/db/pool.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';

// PHASE1-S4a: the catalog domain, called directly (as throttle.test.ts and session.test.ts
// do). Versions are asserted relative to the version read at the start of each case: the
// trigger refuses resetting the counter, so the file resets the database once and
// truncates the four catalog tables per case.

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const TABLES = ['menu_category', 'menu_item', 'menu_item_variant', 'menu_item_modifier'] as const;

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(async () => {
  await ownerQuery('TRUNCATE menu_item_modifier, menu_item_variant, menu_item, menu_category');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await closePool();
});

// ---- helpers --------------------------------------------------------------------------

const version = async () =>
  (await ownerQuery<{ version: number }>('SELECT version FROM catalog_revision'))[0]!.version;

/** Every catalog row's id and xmin, and the revision row's: equal before and after means nothing was written. */
async function stateOf(): Promise<string> {
  const parts: unknown[] = [await ownerQuery('SELECT xmin::text AS x, version FROM catalog_revision')];
  for (const table of TABLES) parts.push(await ownerQuery(`SELECT id, xmin::text AS x FROM ${table} ORDER BY id`));
  return JSON.stringify(parts);
}

/** The answer's record, failing the case if the command did not write. */
async function ok<R>(outcome: Promise<CatalogOutcome<R>>): Promise<R> {
  const result = await outcome;
  if (result.kind !== 'OK') throw new Error(`expected OK, got ${JSON.stringify(result)}`);
  return result.record;
}

const category = (name: string) => ok(createCategory(name));

const item = (
  categoryId: string,
  name: string,
  basePrice = 10000n,
  variants: Array<[string, bigint]> = [],
  modifiers: Array<[string, bigint]> = []
) =>
  ok(
    createItem({
      categoryId,
      name,
      basePrice,
      variants: variants.map(([n, priceDelta]) => ({ name: n, priceDelta })),
      modifiers: modifiers.map(([n, priceDelta]) => ({ name: n, priceDelta })),
    })
  );

/** Two categories, and in the first a soup with two variants and a modifier, and a salad. */
async function menu() {
  const food = await category('Food');
  const drinks = await category('Drinks');
  const soup = await item(food.categoryId, 'Soup', 25000n, [['Small', -5000n], ['Large', 8000n]], [['Spicy', 2000n]]);
  const salad = await item(food.categoryId, 'Salad', 18000n);
  return { food, drinks, soup, salad };
}

const byId = (options: CatalogOption[], id: string) => options.find((option) => option.optionId === id)!;
const namesOf = (options: CatalogOption[]) => options.map((option) => `${option.name}${option.isActive ? '' : ' (removed)'}`);
const activeNames = (options: CatalogOption[]) => options.filter((o) => o.isActive).map((o) => o.name);

async function itemNow(itemId: string): Promise<CatalogItem> {
  return (await readCatalog()).items.find((candidate) => candidate.itemId === itemId)!;
}

// ---- 12: every command advances the version once (C-10, C-11) ---------------------------

describe('every command, applied to a real change', () => {
  type Run = () => Promise<CatalogOutcome<unknown>>;
  const cases: Array<[string, () => Promise<Run>]> = [
    ['createCategory', async () => () => createCategory('Desserts')],
    ['editCategory', async () => { const m = await menu(); return () => editCategory(m.food.categoryId, await_v(), { name: 'Mains' }); }],
    ['reorderCategories', async () => { const m = await menu(); return () => reorderCategories(await_v(), [m.drinks.categoryId, m.food.categoryId]); }],
    ['archiveCategory', async () => { const m = await menu(); return () => archiveCategory(m.drinks.categoryId); }],
    ['restoreCategory', async () => { const m = await menu(); await archiveCategory(m.drinks.categoryId); return () => restoreCategory(m.drinks.categoryId); }],
    ['createItem', async () => { const m = await menu(); return () => createItem({ categoryId: m.drinks.categoryId, name: 'Tea', basePrice: 5000n, variants: [], modifiers: [] }); }],
    ['createItem with three variants and two modifiers', async () => {
      const m = await menu();
      return () => createItem({
        categoryId: m.drinks.categoryId,
        name: 'Coffee',
        basePrice: 15000n,
        variants: [{ name: 'S', priceDelta: 0n }, { name: 'M', priceDelta: 2000n }, { name: 'L', priceDelta: 4000n }],
        modifiers: [{ name: 'Oat', priceDelta: 3000n }, { name: 'Extra shot', priceDelta: 5000n }],
      });
    }],
    ['editItem', async () => { const m = await menu(); return () => editItem(m.soup.itemId, await_v(), { fields: { basePrice: 26000n } }); }],
    ['reorderItems', async () => { const m = await menu(); return () => reorderItems(m.food.categoryId, await_v(), [m.salad.itemId, m.soup.itemId]); }],
    ['archiveItem', async () => { const m = await menu(); return () => archiveItem(m.soup.itemId); }],
    ['restoreItem', async () => { const m = await menu(); await archiveItem(m.soup.itemId); return () => restoreItem(m.soup.itemId); }],
  ];
  // The expected version is read when the command starts, after the fixtures.
  let current = 0;
  const await_v = () => current;

  it.each(cases)('%s answers OK with the version one above the start, and the row reads back as answered', async (_name, setup) => {
    const run = await setup();
    const before = await version();
    current = before;
    const result = await run();
    if (result.kind !== 'OK') throw new Error(`expected OK, got ${JSON.stringify(result)}`);
    expect(result.version).toBe(before + 1);
    expect(await version()).toBe(before + 1);
    const snapshot = await readCatalog();
    expect(snapshot.version).toBe(before + 1);
    for (const record of Array.isArray(result.record) ? result.record : [result.record]) {
      const found =
        'itemId' in (record as object)
          ? snapshot.items.find((i) => i.itemId === (record as CatalogItem).itemId)
          : snapshot.categories.find((c) => c.categoryId === (record as CatalogCategory).categoryId);
      expect(found).toEqual(record);
    }
  });
});

// ---- 13: no-ops (C-12) --------------------------------------------------------------------

describe('a command that changes nothing', () => {
  it('answers UNCHANGED with the current version and writes nothing', async () => {
    const m = await menu();
    await archiveItem(m.salad.itemId);
    await archiveCategory(m.drinks.categoryId);
    const variants = m.soup.variants;
    const noops: Array<[string, () => Promise<CatalogOutcome<unknown>>]> = [
      ['editCategory to the identical name', () => editCategory(m.food.categoryId, v, { name: 'Food' })],
      ['reorderCategories into the current order', () => reorderCategories(v, [m.food.categoryId])],
      ['reorderItems into the current order', () => reorderItems(m.food.categoryId, v, [m.soup.itemId])],
      ['archiveCategory of an archived category', () => archiveCategory(m.drinks.categoryId)],
      ['restoreCategory of an active category', () => restoreCategory(m.food.categoryId)],
      ['archiveItem of an archived item', () => archiveItem(m.salad.itemId)],
      ['restoreItem of an active item', () => restoreItem(m.soup.itemId)],
      ['editItem with nothing', () => editItem(m.soup.itemId, v, {})],
      ['editItem with empty lists', () => editItem(m.soup.itemId, v, { variants: {}, modifiers: { added: [], edited: [], removed: [] } })],
      [
        'editItem whose every change equals the stored state',
        () =>
          editItem(m.soup.itemId, v, {
            fields: { name: 'Soup', basePrice: 25000n, categoryId: m.food.categoryId },
            variants: {
              edited: [{ id: variants[0]!.optionId, name: 'Small', priceDelta: -5000n }, { id: variants[1]!.optionId }],
              order: [{ id: variants[0]!.optionId }, { id: variants[1]!.optionId }],
            },
          }),
      ],
    ];
    let v = 0;
    for (const [label, run] of noops) {
      v = await version();
      const before = await stateOf();
      const result = await run();
      expect(result.kind, label).toBe('UNCHANGED');
      if (result.kind === 'UNCHANGED') expect(result.version, label).toBe(v);
      expect(await stateOf(), label).toBe(before);
    }
  });

  it('treats a change of case alone as a change', async () => {
    const m = await menu();
    const v = await version();
    const result = await editCategory(m.food.categoryId, v, { name: 'FOOD' });
    expect(result).toMatchObject({ kind: 'OK', version: v + 1 });
  });
});

// ---- 14: stale edits (C-13) ---------------------------------------------------------------

describe('a stale edit', () => {
  it('is refused STALE with the rows and the version unchanged', async () => {
    const m = await menu();
    const stale = (await version()) - 1;
    const attempts: Array<[string, () => Promise<CatalogOutcome<unknown>>]> = [
      ['editItem', () => editItem(m.soup.itemId, stale, { fields: { basePrice: 1n } })],
      ['editCategory', () => editCategory(m.food.categoryId, stale, { name: 'Mains' })],
      ['reorderCategories', () => reorderCategories(stale, [m.drinks.categoryId, m.food.categoryId])],
      ['reorderItems', () => reorderItems(m.food.categoryId, stale, [m.salad.itemId, m.soup.itemId])],
    ];
    for (const [label, run] of attempts) {
      const before = await stateOf();
      expect((await run()).kind, label).toBe('STALE');
      expect(await stateOf(), label).toBe(before);
    }
  });

  it('is STALE, not NOT_FOUND, for an unknown id: the version is judged first', async () => {
    await menu();
    const stale = (await version()) - 1;
    expect((await editCategory(UNKNOWN_ID, stale, { name: 'x' })).kind).toBe('STALE');
    expect((await editItem(UNKNOWN_ID, stale, {})).kind).toBe('STALE');
    expect((await editCategory(UNKNOWN_ID, await version(), { name: 'x' })).kind).toBe('NOT_FOUND');
  });
});

// ---- 15, 16: the lock (C-14) ----------------------------------------------------------------

/** The backends of the application pool that are waiting on a lock. */
async function waitingBackends(): Promise<number> {
  const rows = await ownerQuery<{ n: number }>(
    `SELECT count(DISTINCT pid)::int AS n FROM pg_stat_activity
      WHERE usename = 'pos_app' AND wait_event_type = 'Lock'`
  );
  return rows[0]?.n ?? 0;
}

async function untilWaiting(): Promise<number> {
  let waiting = 0;
  for (let i = 0; i < 200 && waiting < 1; i++) {
    waiting = await waitingBackends();
    if (waiting < 1) await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return waiting;
}

/** The statements the waiting application backends are stuck on. */
async function waitingStatements(): Promise<string[]> {
  const rows = await ownerQuery<{ query: string }>(
    `SELECT query FROM pg_stat_activity WHERE usename = 'pos_app' AND wait_event_type = 'Lock'`
  );
  return rows.map((row) => row.query);
}

describe('the lock', () => {
  it('decides under it: an edit that read the current version while another writer held the row is STALE once that writer commits', async () => {
    const m = await menu();
    const start = await version();
    const owner = await ownerClient();
    try {
      await owner.query('BEGIN');
      await owner.query('SELECT version FROM catalog_revision FOR UPDATE');
      const edit = editItem(m.soup.itemId, start, { fields: { basePrice: 1n } });
      expect(await untilWaiting(), 'the edit was waiting on the lock').toBeGreaterThanOrEqual(1);
      await owner.query('UPDATE catalog_revision SET version = version + 1');
      await owner.query('COMMIT');
      expect((await edit).kind).toBe('STALE');
    } finally {
      await owner.query('ROLLBACK').catch(() => undefined);
      await owner.end();
    }
    expect((await itemNow(m.soup.itemId)).basePrice).toBe(25000n);
    expect(await version()).toBe(start + 1);
  });

  it.each([['UPDATE'], ['SHARE']])(
    'makes an unversioned command wait for a holder of the row FOR %s',
    async (mode) => {
      const m = await menu();
      await archiveItem(m.salad.itemId);
      // The second writes nothing, so only a lock taken first can make it wait; the
      // statement it waits on must be the lock itself.
      for (const [label, run, answer] of [
        ['createCategory', () => createCategory('Held'), 'OK'],
        ['archiveItem', () => archiveItem(m.soup.itemId), 'OK'],
        ['archiveItem of an archived item', () => archiveItem(m.salad.itemId), 'UNCHANGED'],
      ] as const) {
        const owner = await ownerClient();
        let settled = false;
        let result: Promise<CatalogOutcome<unknown>> | undefined;
        try {
          await owner.query('BEGIN');
          await owner.query(`SELECT version FROM catalog_revision FOR ${mode}`);
          result = run().finally(() => { settled = true; });
          expect(await untilWaiting(), `${label} was waiting`).toBeGreaterThanOrEqual(1);
          expect(await waitingStatements(), `${label} waits on the lock, its first statement`).toEqual([
            'SELECT version FROM catalog_revision FOR UPDATE',
          ]);
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(settled, `${label} returned before the holder committed`).toBe(false);
          await owner.query('COMMIT');
          expect((await result).kind, label).toBe(answer);
        } finally {
          await owner.query('ROLLBACK').catch(() => undefined);
          await owner.end();
          await result?.catch(() => undefined);
        }
      }
    }
  );
});

// ---- 17: creates and state commands carry no version (C-15) ----------------------------------

describe('commands that carry no version', () => {
  it('succeed after other catalog writes the caller never read', async () => {
    const m = await menu();
    for (let i = 0; i < 3; i++) await editCategory(m.food.categoryId, await version(), { name: `Food ${i}` });
    // None of these knows the version, and all succeed.
    const created = await category('Sides');
    await item(created.categoryId, 'Fries');
    expect((await archiveItem(m.salad.itemId)).kind).toBe('OK');
    expect((await restoreItem(m.salad.itemId)).kind).toBe('OK');
    expect((await archiveCategory(created.categoryId)).kind).toBe('OK');
    expect((await restoreCategory(created.categoryId)).kind).toBe('OK');
  });
});

// ---- 18: archived destinations (C-16) ----------------------------------------------------------

describe('a category named as a destination', () => {
  it('is STALE when archived and NOT_FOUND when unknown, writing nothing', async () => {
    const m = await menu();
    await archiveCategory(m.drinks.categoryId);
    const input = (categoryId: string) => ({ categoryId, name: 'Tea', basePrice: 5000n, variants: [], modifiers: [] });
    const archivedId = m.drinks.categoryId;
    const v = await version();
    const attempts: Array<[string, () => Promise<CatalogOutcome<unknown>>, string]> = [
      ['createItem into an archived category', () => createItem(input(archivedId)), 'STALE'],
      ['editItem moving into an archived category', () => editItem(m.soup.itemId, v, { fields: { categoryId: archivedId } }), 'STALE'],
      ['reorderItems of an archived category', () => reorderItems(archivedId, v, []), 'STALE'],
      ['createItem into an unknown category', () => createItem(input(UNKNOWN_ID)), 'NOT_FOUND'],
      ['editItem moving into an unknown category', () => editItem(m.soup.itemId, v, { fields: { categoryId: UNKNOWN_ID } }), 'NOT_FOUND'],
      ['reorderItems of an unknown category', () => reorderItems(UNKNOWN_ID, v, []), 'NOT_FOUND'],
    ];
    for (const [label, run, kind] of attempts) {
      const before = await stateOf();
      expect((await run()).kind, label).toBe(kind);
      expect(await stateOf(), label).toBe(before);
    }
  });
});

// ---- 19: archive and restore keep everything (C-17, Q10) --------------------------------------

describe('archive and restore', () => {
  it('keep every row, advance by one, and read back as before', async () => {
    const m = await menu();
    const rowsBefore = await ownerQuery<{ n: string }>(
      `SELECT (SELECT count(*) FROM menu_category) + (SELECT count(*) FROM menu_item)
            + (SELECT count(*) FROM menu_item_variant) + (SELECT count(*) FROM menu_item_modifier) AS n`
    );
    const before = await readCatalog();
    const v = before.version;
    expect(await archiveItem(m.soup.itemId)).toMatchObject({ kind: 'OK', version: v + 1 });
    expect(await archiveCategory(m.food.categoryId)).toMatchObject({ kind: 'OK', version: v + 2 });
    const archived = await readCatalog();
    expect(archived.items.find((i) => i.itemId === m.soup.itemId)!.isActive).toBe(false);
    expect(archived.categories.find((c) => c.categoryId === m.food.categoryId)!.isActive).toBe(false);
    expect(await restoreCategory(m.food.categoryId)).toMatchObject({ kind: 'OK', version: v + 3 });
    expect(await restoreItem(m.soup.itemId)).toMatchObject({ kind: 'OK', version: v + 4 });

    const after = await readCatalog();
    expect({ ...after, version: 0 }).toEqual({ ...before, version: 0 });
    const rowsAfter = await ownerQuery<{ n: string }>(
      `SELECT (SELECT count(*) FROM menu_category) + (SELECT count(*) FROM menu_item)
            + (SELECT count(*) FROM menu_item_variant) + (SELECT count(*) FROM menu_item_modifier) AS n`
    );
    expect(rowsAfter).toEqual(rowsBefore);
  });

  it('changes one flag: archiving a category leaves its items untouched, archiving an item its options', async () => {
    const m = await menu();
    const rows = (table: string) => ownerQuery(`SELECT id, xmin::text AS x FROM ${table} ORDER BY id`);
    const itemsBefore = await rows('menu_item');
    await archiveCategory(m.food.categoryId);
    expect(await rows('menu_item')).toEqual(itemsBefore);

    const optionsBefore = [await rows('menu_item_variant'), await rows('menu_item_modifier')];
    await archiveItem(m.soup.itemId);
    expect([await rows('menu_item_variant'), await rows('menu_item_modifier')]).toEqual(optionsBefore);
  });

  it('lets an item be restored while its category is archived', async () => {
    const m = await menu();
    await archiveItem(m.soup.itemId);
    await archiveCategory(m.food.categoryId);
    expect(await restoreItem(m.soup.itemId)).toMatchObject({ kind: 'OK' });
    expect((await itemNow(m.soup.itemId)).isActive).toBe(true);
  });
});

// ---- 20: names held across rulings --------------------------------------------------------------

describe('names', () => {
  it('are held by an item in an archived category', async () => {
    const m = await menu();
    await archiveCategory(m.food.categoryId);
    const before = await stateOf();
    for (const name of ['Soup', 'SOUP', 'soup']) {
      expect(await createItem({ categoryId: m.drinks.categoryId, name, basePrice: 1n, variants: [], modifiers: [] })).toEqual({
        kind: 'DUPLICATE',
        of: 'ITEM',
      });
    }
    expect(await stateOf()).toBe(before);
  });

  it('refuse a restore into a name an active row holds, writing nothing', async () => {
    const m = await menu();
    await archiveItem(m.soup.itemId);
    await item(m.drinks.categoryId, 'Soup');
    await archiveCategory(m.food.categoryId);
    await category('Food');
    for (const [label, run, of] of [
      ['restoreItem', () => restoreItem(m.soup.itemId), 'ITEM'],
      ['restoreCategory', () => restoreCategory(m.food.categoryId), 'CATEGORY'],
    ] as const) {
      const before = await stateOf();
      expect(await run(), label).toEqual({ kind: 'DUPLICATE', of });
      expect(await stateOf(), label).toBe(before);
    }
  });

  it('may be taken by an archived category or item when renamed', async () => {
    const m = await menu();
    await archiveCategory(m.drinks.categoryId);
    await archiveItem(m.salad.itemId);
    const v = await version();
    expect(await editCategory(m.drinks.categoryId, v, { name: 'food' })).toMatchObject({ kind: 'OK' });
    expect(await editItem(m.salad.itemId, v + 1, { fields: { name: 'SOUP' } })).toMatchObject({ kind: 'OK' });
  });

  it('answer DUPLICATE with the right subject when an active row holds the name in another case', async () => {
    const m = await menu();
    const other = await category('Other');
    const v = await version();
    expect(await createCategory('fOOD')).toEqual({ kind: 'DUPLICATE', of: 'CATEGORY' });
    expect(await editCategory(other.categoryId, v, { name: 'FOOD' })).toEqual({ kind: 'DUPLICATE', of: 'CATEGORY' });
    expect(await createItem({ categoryId: other.categoryId, name: 'sOUP', basePrice: 1n, variants: [], modifiers: [] })).toEqual({
      kind: 'DUPLICATE',
      of: 'ITEM',
    });
    expect(await editItem(m.salad.itemId, v, { fields: { name: 'soup' } })).toEqual({ kind: 'DUPLICATE', of: 'ITEM' });
    expect(await version()).toBe(v);
  });
});

// ---- 21: another item's option (C-19) -------------------------------------------------------------

describe('editItem naming an option it may not', () => {
  it('is NOT_FOUND and writes nothing', async () => {
    const m = await menu();
    const tea = await item(m.drinks.categoryId, 'Tea', 5000n, [['Hot', 0n]], [['Honey', 500n]]);
    const removed = (await editItem(tea.itemId, await version(), { variants: { removed: [tea.variants[0]!.optionId] } }));
    expect(removed.kind).toBe('OK');
    const otherVariant = m.soup.variants[0]!.optionId;
    const modifier = m.soup.modifiers[0]!.optionId;
    const goneVariant = tea.variants[0]!.optionId;
    const v = await version();
    const attempts: Array<[string, ReturnType<typeof editItem>]> = [
      ["another item's variant, edited", editItem(tea.itemId, v, { variants: { edited: [{ id: otherVariant, name: 'X' }] } })],
      ["another item's variant, removed", editItem(tea.itemId, v, { variants: { removed: [otherVariant] } })],
      ['a variant id under modifiers', editItem(m.soup.itemId, v, { modifiers: { edited: [{ id: otherVariant, name: 'X' }] } })],
      ['a modifier id under variants', editItem(m.soup.itemId, v, { variants: { removed: [modifier] } })],
      ['an already removed option, edited', editItem(tea.itemId, v, { variants: { edited: [{ id: goneVariant, name: 'X' }] } })],
      ['an already removed option, removed', editItem(tea.itemId, v, { variants: { removed: [goneVariant] } })],
      ['an unknown option', editItem(tea.itemId, v, { variants: { removed: [UNKNOWN_ID] } })],
    ];
    for (const [label, attempt] of attempts) expect((await attempt).kind, label).toBe('NOT_FOUND');
    expect((await itemNow(m.soup.itemId)).variants[0]!.name).toBe('Small');
    expect(await version()).toBe(v);
  });
});

// ---- 22: INVALID -----------------------------------------------------------------------------------

describe('INVALID', () => {
  it('is the answer to a reorder that is not exactly the scope, each id once; nothing is written', async () => {
    const m = await menu();
    const tea = await item(m.drinks.categoryId, 'Tea');
    await archiveItem(tea.itemId);
    const extra = await category('Sides');
    await archiveCategory(extra.categoryId);
    const [food, drinks] = [m.food.categoryId, m.drinks.categoryId];
    const [soup, salad] = [m.soup.itemId, m.salad.itemId];
    const v = await version();
    const attempts: Array<[string, () => ReturnType<typeof reorderCategories | typeof reorderItems>]> = [
      ['categories: one missing', () => reorderCategories(v, [food])],
      ['categories: an archived id', () => reorderCategories(v, [food, drinks, extra.categoryId])],
      ['categories: an unknown id', () => reorderCategories(v, [food, UNKNOWN_ID])],
      ['categories: a repeat', () => reorderCategories(v, [food, drinks, food])],
      ['categories: a repeat in place of one', () => reorderCategories(v, [food, food])],
      ['items: one missing', () => reorderItems(food, v, [soup])],
      ['items: an archived item of another category', () => reorderItems(food, v, [soup, salad, tea.itemId])],
      ['items: an unknown id', () => reorderItems(food, v, [soup, UNKNOWN_ID])],
      ['items: a repeat', () => reorderItems(food, v, [soup, salad, soup])],
      ['items: an item of another category in place of one', () => reorderItems(food, v, [soup, tea.itemId])],
    ];
    const before = await stateOf();
    for (const [label, run] of attempts) expect((await run()).kind, label).toBe('INVALID');
    expect(await stateOf()).toBe(before);
  });

  it('is the answer to an editItem with an id twice, a key twice, or an order that is not the final active set', async () => {
    const m = await menu();
    const [small, large] = m.soup.variants.map((o) => o.optionId) as [string, string];
    const v = await version();
    const attempts: Array<[string, ReturnType<typeof editItem>]> = [
      ['an id in edited and removed', editItem(m.soup.itemId, v, { variants: { edited: [{ id: small, name: 'S' }], removed: [small] } })],
      ['an id edited twice', editItem(m.soup.itemId, v, { variants: { edited: [{ id: small, name: 'S' }, { id: small, name: 'T' }] } })],
      ['an id removed twice', editItem(m.soup.itemId, v, { variants: { removed: [small, small] } })],
      ['a key twice', editItem(m.soup.itemId, v, { modifiers: { added: [{ key: 'a', name: 'A', priceDelta: 0n }, { key: 'a', name: 'B', priceDelta: 0n }] } })],
      ['an order missing an option', editItem(m.soup.itemId, v, { variants: { order: [{ id: small }] } })],
      ['an order holding a removed option', editItem(m.soup.itemId, v, { variants: { removed: [small], order: [{ id: small }, { id: large }] } })],
      ['an order with a repeat', editItem(m.soup.itemId, v, { variants: { order: [{ id: small }, { id: small }] } })],
      ['an order missing an added key', editItem(m.soup.itemId, v, { variants: { added: [{ key: 'n', name: 'N', priceDelta: 0n }], order: [{ id: small }, { id: large }] } })],
      ['an order naming an unknown key', editItem(m.soup.itemId, v, { variants: { order: [{ id: small }, { id: large }, { key: 'zz' }] } })],
    ];
    const before = await stateOf();
    for (const [label, attempt] of attempts) expect((await attempt).kind, label).toBe('INVALID');
    expect(await stateOf()).toBe(before);
  });
});

// ---- 23: the swap (rule 6) ---------------------------------------------------------------------------

describe('one save over option names', () => {
  it('swaps two variants names, both staying active, in one version', async () => {
    const m = await menu();
    const [small, large] = m.soup.variants.map((o) => o.optionId) as [string, string];
    const v = await version();
    const result = await editItem(m.soup.itemId, v, {
      variants: { edited: [{ id: small, name: 'Large' }, { id: large, name: 'Small' }] },
    });
    expect(result).toMatchObject({ kind: 'OK', version: v + 1 });
    const after = await itemNow(m.soup.itemId);
    expect(byId(after.variants, small)).toMatchObject({ name: 'Large', isActive: true });
    expect(byId(after.variants, large)).toMatchObject({ name: 'Small', isActive: true });
  });

  it('renames a variant by case alone', async () => {
    const m = await menu();
    const tea = await item(m.drinks.categoryId, 'Tea', 1n, [['large', 0n]]);
    const v = await version();
    const result = await editItem(tea.itemId, v, { variants: { edited: [{ id: tea.variants[0]!.optionId, name: 'Large' }] } });
    expect(result).toMatchObject({ kind: 'OK', version: v + 1 });
    expect(byId((await itemNow(tea.itemId)).variants, tea.variants[0]!.optionId)).toMatchObject({ name: 'Large', isActive: true });
  });

  it('removes Regular and adds a new Regular: the old row inactive, the new one active', async () => {
    const m = await menu();
    const tea = await item(m.drinks.categoryId, 'Tea', 1n, [['Regular', 0n]]);
    const old = tea.variants[0]!.optionId;
    const result = await editItem(tea.itemId, await version(), {
      variants: { removed: [old], added: [{ key: 'r', name: 'Regular', priceDelta: 500n }] },
    });
    expect(result.kind).toBe('OK');
    const after = await itemNow(tea.itemId);
    expect(byId(after.variants, old).isActive).toBe(false);
    const fresh = after.variants.filter((o) => o.optionId !== old);
    expect(fresh).toEqual([expect.objectContaining({ name: 'Regular', priceDelta: 500n, isActive: true })]);
  });

  it('refuses a rename onto an untouched active name, and two added modifiers with one name, writing nothing', async () => {
    const m = await menu();
    const [small] = m.soup.variants.map((o) => o.optionId) as [string];
    const v = await version();
    const before = await stateOf();
    expect(await editItem(m.soup.itemId, v, { variants: { edited: [{ id: small, name: 'LARGE' }] } })).toEqual({
      kind: 'DUPLICATE',
      of: 'VARIANT',
    });
    expect(
      await editItem(m.soup.itemId, v, {
        modifiers: { added: [{ key: 'a', name: 'Cheese', priceDelta: 0n }, { key: 'b', name: 'cheese', priceDelta: 1n }] },
      })
    ).toEqual({ kind: 'DUPLICATE', of: 'MODIFIER' });
    expect(await version()).toBe(v);
    expect(await stateOf()).toBe(before);
  });

  it('applies a mix of removal, rename, price change and addition across both lists as one version', async () => {
    const m = await menu();
    const [small, large] = m.soup.variants.map((o) => o.optionId) as [string, string];
    const spicy = m.soup.modifiers[0]!.optionId;
    const v = await version();
    const result = await editItem(m.soup.itemId, v, {
      fields: { name: 'Big soup', basePrice: 30000n },
      variants: { removed: [small], edited: [{ id: large, name: 'Small', priceDelta: 1000n }], added: [{ key: 'x', name: 'Large', priceDelta: 9000n }] },
      modifiers: { edited: [{ id: spicy, priceDelta: 2500n }], added: [{ key: 'y', name: 'Cheese', priceDelta: 3000n }] },
    });
    expect(result).toMatchObject({ kind: 'OK', version: v + 1 });
    const after = await itemNow(m.soup.itemId);
    expect(after).toMatchObject({ name: 'Big soup', basePrice: 30000n });
    expect(namesOf(after.variants)).toEqual(['Small (removed)', 'Small', 'Large']);
    expect(byId(after.variants, large)).toMatchObject({ name: 'Small', priceDelta: 1000n, isActive: true });
    expect(activeNames(after.modifiers)).toEqual(['Spicy', 'Cheese']);
    expect(byId(after.modifiers, spicy).priceDelta).toBe(2500n);
  });
});

// ---- 24: order -------------------------------------------------------------------------------------------

describe('display order', () => {
  it('goes last for a new category, a new item, and a moved item; a create takes its options in order', async () => {
    const m = await menu();
    const sides = await category('Sides');
    expect(sides.displayOrder).toBeGreaterThan(m.drinks.displayOrder);
    const soup = await item(m.food.categoryId, 'Z', 1n, [['b', 0n], ['a', 0n], ['c', 0n]], [['y', 0n], ['x', 0n]]);
    expect(namesOf(soup.variants)).toEqual(['b', 'a', 'c']);
    expect(namesOf(soup.modifiers)).toEqual(['y', 'x']);
    expect(soup.displayOrder).toBeGreaterThan(m.salad.displayOrder);

    const moved = await ok(editItem(m.soup.itemId, await version(), { fields: { categoryId: m.drinks.categoryId } }));
    const tea = await item(m.drinks.categoryId, 'Tea');
    expect(moved.categoryId).toBe(m.drinks.categoryId);
    expect(tea.displayOrder).toBeGreaterThan(moved.displayOrder);
    const another = await ok(editItem(m.salad.itemId, await version(), { fields: { categoryId: m.drinks.categoryId } }));
    expect(another.displayOrder).toBeGreaterThan(tea.displayOrder);
  });

  it('puts added options last without an order, and in exactly the given order with one', async () => {
    const m = await menu();
    const [small, large] = m.soup.variants.map((o) => o.optionId) as [string, string];
    const withoutOrder = await ok(
      editItem(m.soup.itemId, await version(), {
        variants: { added: [{ key: 'p', name: 'P', priceDelta: 0n }, { key: 'q', name: 'Q', priceDelta: 0n }] },
      })
    );
    expect(activeNames(withoutOrder.variants)).toEqual(['Small', 'Large', 'P', 'Q']);

    const withOrder = await ok(
      editItem(m.soup.itemId, await version(), {
        variants: {
          added: [{ key: 'r', name: 'R', priceDelta: 0n }],
          removed: [small],
          order: [{ key: 'r' }, { id: large }, { id: withoutOrder.variants[3]!.optionId }, { id: withoutOrder.variants[2]!.optionId }],
        },
      })
    );
    expect(activeNames(withOrder.variants)).toEqual(['R', 'Large', 'Q', 'P']);
    expect(withOrder.variants.filter((o) => o.isActive).map((o) => o.displayOrder)).toEqual([0, 1, 2, 3]);
  });

  it('is rewritten for the active rows of a reorder only: archived rows keep their stored order', async () => {
    const m = await menu();
    const tea = await item(m.food.categoryId, 'Tea');
    await archiveItem(m.salad.itemId);
    const sides = await category('Sides');
    await archiveCategory(m.drinks.categoryId);
    const orderOf = async (table: string, id: string) =>
      (await ownerQuery<{ display_order: number }>(`SELECT display_order FROM ${table} WHERE id = $1`, [id]))[0]!.display_order;
    const saladOrder = await orderOf('menu_item', m.salad.itemId);
    const drinksOrder = await orderOf('menu_category', m.drinks.categoryId);

    await ok(reorderItems(m.food.categoryId, await version(), [tea.itemId, m.soup.itemId]));
    await ok(reorderCategories(await version(), [sides.categoryId, m.food.categoryId]));
    const items = (await itemNow(tea.itemId)).displayOrder;
    expect(items).toBe(0);
    expect((await itemNow(m.soup.itemId)).displayOrder).toBe(1);
    expect(await orderOf('menu_item', m.salad.itemId)).toBe(saladOrder);
    expect(await orderOf('menu_category', m.drinks.categoryId)).toBe(drinksOrder);
    const active = (await readCatalog()).categories.filter((c) => c.isActive);
    expect(active.map((c) => c.name)).toEqual(['Sides', 'Food']);
    expect(active.map((c) => c.displayOrder)).toEqual([0, 1]);
  });
});

// ---- 25: one snapshot (C-18) --------------------------------------------------------------------------------

describe('readCatalog', () => {
  it('returns a version and contents that belong together, though a write commits between its statements', async () => {
    const m = await menu();
    const start = await version();
    const competitor = await ownerClient();
    const original = pg.Client.prototype.query;
    let competed = false;
    // Runs after the read's first query returns, on a pooled client only (the competitor's
    // own queries pass through this wrapper too, and must not recurse).
    const spy = vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (this: pg.Client, ...args: unknown[]) {
      const result = (original as (...a: unknown[]) => unknown).apply(this, args);
      const text = typeof args[0] === 'string' ? args[0] : '';
      if (this !== competitor && !competed && text.includes('FROM catalog_revision')) {
        competed = true;
        return (result as Promise<unknown>).then(async (value) => {
          await (original as (...a: unknown[]) => Promise<unknown>).call(
            competitor,
            `WITH p AS (UPDATE menu_item SET base_price = 1 WHERE id = '${m.soup.itemId}')
             UPDATE catalog_revision SET version = version + 1`
          );
          return value;
        });
      }
      return result;
    } as never);
    try {
      const snapshot: CatalogSnapshot = await readCatalog();
      expect(competed, 'the competing commit ran after the first statement').toBe(true);
      expect(snapshot.version).toBe(start);
      expect(snapshot.items.find((i) => i.itemId === m.soup.itemId)!.basePrice).toBe(25000n);
    } finally {
      spy.mockRestore();
      await competitor.end();
    }
    const later = await readCatalog();
    expect(later.version).toBe(start + 1);
    expect(later.items.find((i) => i.itemId === m.soup.itemId)!.basePrice).toBe(1n);
  });

  it('includes archived and removed rows, marked, with isAvailable', async () => {
    const m = await menu();
    await ok(editItem(m.soup.itemId, await version(), { variants: { removed: [m.soup.variants[0]!.optionId] } }));
    await archiveItem(m.salad.itemId);
    await archiveCategory(m.drinks.categoryId);
    const snapshot = await readCatalog();
    expect(snapshot.categories.map((c) => [c.name, c.isActive])).toEqual([['Food', true], ['Drinks', false]]);
    expect(snapshot.items.map((i) => [i.name, i.isActive, i.isAvailable])).toEqual([['Soup', true, true], ['Salad', false, true]]);
    expect(snapshot.items[0]!.variants.map((o) => o.isActive)).toEqual([false, true]);
  });
});

// ---- 26: money ----------------------------------------------------------------------------------------------

describe('prices', () => {
  it('round-trip exactly at the bounds, as bigint', async () => {
    const m = await menu();
    const dear = await item(m.food.categoryId, 'Dear', 99999999n, [['Max', 99999999n], ['Min', -99999999n], ['Zero', 0n]], [['Top', 99999999n], ['Free', 0n]]);
    const free = await item(m.food.categoryId, 'Free', 0n);
    const snapshot = await readCatalog();
    const read = snapshot.items.find((i) => i.itemId === dear.itemId)!;
    expect(read.basePrice).toBe(99999999n);
    expect(read.variants.map((o) => o.priceDelta)).toEqual([99999999n, -99999999n, 0n]);
    expect(read.modifiers.map((o) => o.priceDelta)).toEqual([99999999n, 0n]);
    for (const value of [read.basePrice, ...read.variants.map((o) => o.priceDelta), snapshot.items.find((i) => i.itemId === free.itemId)!.basePrice]) {
      expect(typeof value).toBe('bigint');
    }
    expect(snapshot.items.find((i) => i.itemId === free.itemId)!.basePrice).toBe(0n);
  });

  it('are stored where base plus change falls below zero or above the line maximum: Phase 2 enforces those', async () => {
    const m = await menu();
    const low = await item(m.food.categoryId, 'Cheap', 100000n, [['Deal', -99999999n]]);
    const high = await item(m.food.categoryId, 'Pricey', 99999999n, [['Plus', 99999999n]]);
    expect((await itemNow(low.itemId)).variants[0]!.priceDelta).toBe(-99999999n);
    expect((await itemNow(high.itemId)).variants[0]!.priceDelta).toBe(99999999n);
  });
});

// ---- 27: faults ------------------------------------------------------------------------------------------------

describe('a database fault', () => {
  it('becomes an Error with a fixed message and no cause, and the name appears nowhere', async () => {
    const m = await menu();
    const marker = `MARK-CATALOG-${'x'.repeat(52)}`; // 65 code points: only the check refuses it
    expect([...marker].length).toBe(65);
    const logged: string[] = [];
    const capture = (chunk: unknown) => { logged.push(String(chunk)); return true; };
    vi.spyOn(process.stdout, 'write').mockImplementation(capture);
    vi.spyOn(process.stderr, 'write').mockImplementation(capture);
    const consoleLines: string[] = [];
    for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { consoleLines.push(args.map(String).join(' ')); });
    }

    const error = await createItem({ categoryId: m.food.categoryId, name: marker, basePrice: 1n, variants: [], modifiers: [] }).then(
      () => undefined,
      (err: unknown) => err
    );
    vi.restoreAllMocks();
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('The catalog store failed');
    expect((error as Error).cause).toBeUndefined();
    expect(inspect(error, { depth: 6 })).not.toContain('MARK-CATALOG');
    expect([...logged, ...consoleLines].join('\n')).not.toContain('MARK-CATALOG');
  });
});

// ---- 28: no audit ----------------------------------------------------------------------------------------------

describe('audit', () => {
  it('is not written by any catalog command, nor by a refusal', async () => {
    const count = async () => (await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM audit_entry'))[0]!.n;
    const before = await count();
    const m = await menu();
    const v = await version();
    await editCategory(m.food.categoryId, v, { name: 'Mains' });
    await editCategory(m.food.categoryId, v, { name: 'Stale' });
    await reorderCategories(await version(), [m.drinks.categoryId, m.food.categoryId]);
    await reorderItems(m.food.categoryId, await version(), [m.salad.itemId, m.soup.itemId]);
    await editItem(m.soup.itemId, await version(), { fields: { basePrice: 1n } });
    await archiveItem(m.soup.itemId);
    await restoreItem(m.soup.itemId);
    await archiveCategory(m.drinks.categoryId);
    await restoreCategory(m.drinks.categoryId);
    await createCategory('Mains');
    await archiveItem(UNKNOWN_ID);
    expect(await count()).toBe(before);
  });
});
