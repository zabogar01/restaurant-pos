import { Writable } from 'node:stream';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PosMenuResponse, PosRevisionResponse, ROUTE_TABLE } from '@pos/contracts';
import { rateFromPpm } from '@pos/money';
import { closePool, getPool } from '../src/db/pool.js';
import {
  archiveCategory,
  archiveItem,
  createCategory,
  createItem,
  editItem,
  markItemUnavailable,
} from '../src/domain/catalog.js';
import { createPreset, deactivatePreset } from '../src/domain/discount-preset.js';
import { readPosMenu } from '../src/domain/pos-menu.js';
import { SESSION_POLICY } from '../src/domain/session.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';
import { makePeople, sessionIdOfUser } from './support/people.js';
import { ageSession } from './support/people.js';
import { TEST_ORIGIN } from './support/request.js';

// PHASE1-S7a: the POS's two catalog reads (consult C4; ADR-012 rules 10 to 12; FR-A2b,
// AC-28). Cases are numbered by the task's acceptance criterion. The catalog_revision row
// is never reset between cases, so versions are asserted relative to the version read.

const people = makePeople(720000);
const REVISION = '/api/pos/catalog/revision';
const MENU = '/api/pos/catalog/menu';
const UNAUTHENTICATED = '{"error":{"code":"UNAUTHENTICATED"}}';
const SESSION_IDLE = '{"error":{"code":"SESSION_IDLE"}}';

let app: FastifyInstance;
let cashier: Awaited<ReturnType<typeof people.cashier>>;
let manager: Awaited<ReturnType<typeof people.manager>>;
let pos: JarClient;
const logLines: string[] = [];

beforeAll(async () => {
  await resetDatabase();
  const logStream = new Writable({
    write(chunk, _encoding, done) {
      logLines.push(...chunk.toString().split('\n').filter(Boolean));
      done();
    },
  });
  // The default level of the real server, so that a poll's lines would show.
  app = buildServer({ origin: TEST_ORIGIN, logLevel: 'info', logStream });
  await app.ready();
  cashier = await people.cashier();
  manager = await people.manager();
  pos = await signedInCashier();
});

beforeEach(async () => {
  await ownerQuery('TRUNCATE menu_item_modifier, menu_item_variant, menu_item, menu_category, discount_preset');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

async function signedInCashier(): Promise<JarClient> {
  const client = new JarClient(app);
  const res = await client.signInPos(cashier.pin);
  expect(res.statusCode, res.body).toBe(200);
  return client;
}

async function signedInManager(): Promise<JarClient> {
  const client = new JarClient(app);
  const res = await client.signInBackOffice(manager.username, manager.password);
  expect(res.statusCode, res.body).toBe(200);
  return client;
}

const versionNow = async () =>
  (await ownerQuery<{ version: number }>('SELECT version FROM catalog_revision'))[0]!.version;

async function menu(client: JarClient = pos) {
  const res = await client.get(MENU);
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as PosMenuResponse;
}

/** Fails the case that needed it if the domain refused. */
function made<R>(outcome: { kind: string; record?: R }): R {
  expect(outcome.kind).toBe('OK');
  return outcome.record as R;
}

const ids = (rows: Array<{ name: string }>) => rows.map((row) => row.name);

async function category(name: string) {
  return made(await createCategory(name));
}

async function item(categoryId: string, name: string, more: Partial<Parameters<typeof createItem>[0]> = {}) {
  return made(await createItem({ categoryId, name, basePrice: 25000n, variants: [], modifiers: [], ...more }));
}

// ---- 1: access and the route table ------------------------------------------------------

describe('declaration', () => {
  it('1. both routes are GET, not interactive, and in the route table', () => {
    const entries = ROUTE_TABLE.filter((entry) => entry.path.startsWith('/api/pos/catalog/'));
    expect(entries.map((e) => `${e.method} ${e.path} ${e.interactive}`).sort()).toEqual([
      `GET ${MENU} false`,
      `GET ${REVISION} false`,
    ]);
  });
});

// ---- 2 and 3: who may read, and what a read does to the idle -------------------------------

describe('the session', () => {
  it.each([REVISION, MENU])('2. %s: no session is UNAUTHENTICATED', async (url) => {
    const res = await new JarClient(app).get(url);
    expect(res.statusCode).toBe(401);
    expect(res.body).toBe(UNAUTHENTICATED);
  });

  it.each([REVISION, MENU])('2. %s: a back-office session is refused, though its cookie is sent', async (url) => {
    const office = await signedInManager();
    const cookie = `rpos_bo_sid=${office.valueOf('rpos_bo_sid')}`;
    const res = await office.get(url, { cookie });
    expect(res.statusCode).toBe(401);
    expect(res.body).toBe(UNAUTHENTICATED);
  });

  it.each([REVISION, MENU])('3. %s: reading does not move last_interactive_at', async (url) => {
    const client = await signedInCashier();
    const sessionId = (await sessionIdOfUser(cashier.id, 'POS')).at(-1)!;
    const stamp = async () =>
      (
        await ownerQuery<{ at: string }>(
          'SELECT last_interactive_at::text AS at FROM actor_session WHERE id = $1',
          [sessionId]
        )
      )[0]!.at;
    const before = await stamp();
    for (let i = 0; i < 3; i += 1) expect((await client.get(url)).statusCode).toBe(200);
    expect(await stamp()).toBe(before);
  });

  it.each([REVISION, MENU])('3. %s: a session idled past the limit is answered SESSION_IDLE', async (url) => {
    const client = await signedInCashier();
    const sessionId = (await sessionIdOfUser(cashier.id, 'POS')).at(-1)!;
    await ageSession(sessionId, SESSION_POLICY.POS.idleSeconds + 5);
    const res = await client.get(url);
    expect(res.statusCode).toBe(401);
    expect(res.body).toBe(SESSION_IDLE);
  });
});

// ---- 4 to 6, 8 and 11: the projection --------------------------------------------------------

describe('what reaches the POS', () => {
  it('4. omits an archived category and its items, an archived item, removed options and a deactivated preset', async () => {
    const drinks = await category('Drinks');
    const old = await category('Old');
    const latte = await item(drinks.categoryId, 'Latte', {
      variants: [
        { name: 'Small', priceDelta: -1000n },
        { name: 'Large', priceDelta: 2000n },
      ],
      modifiers: [
        { name: 'Oat milk', priceDelta: 3000n },
        { name: 'Syrup', priceDelta: 500n },
      ],
    });
    await item(drinks.categoryId, 'Retired');
    await item(old.categoryId, 'Still active, still available');
    const retired = (await menu()).items.find((i) => i.name === 'Retired')!;
    made(await archiveItem(retired.itemId));
    made(await archiveCategory(old.categoryId));
    made(
      await editItem(latte.itemId, await versionNow(), {
        variants: { removed: [latte.variants[0]!.optionId] },
        modifiers: { removed: [latte.modifiers[1]!.optionId] },
      })
    );
    made(await createPreset('Staff', { kind: 'PERCENTAGE', ratePpm: rateFromPpm(100000n) }));
    const gone = made(await createPreset('Gone', { kind: 'FIXED', amount: 5000n }));
    made(await deactivatePreset(gone.presetId));

    const served = await menu();
    expect(ids(served.categories)).toEqual(['Drinks']);
    expect(ids(served.items)).toEqual(['Latte']);
    expect(ids(served.items[0]!.variants)).toEqual(['Large']);
    expect(ids(served.items[0]!.modifiers)).toEqual(['Oat milk']);
    expect(ids(served.presets)).toEqual(['Staff']);
    const wire = JSON.stringify(served);
    for (const name of ['Old', 'Retired', 'Still active', 'Small', 'Syrup', 'Gone']) {
      expect(wire, name).not.toContain(name);
    }
  });

  it('4. every entry holds exactly the shown fields: no isActive, no displayOrder', async () => {
    const drinks = await category('Drinks');
    await item(drinks.categoryId, 'Latte', {
      variants: [{ name: 'Large', priceDelta: 2000n }],
      modifiers: [{ name: 'Oat milk', priceDelta: 3000n }],
    });
    made(await createPreset('Staff', { kind: 'FIXED', amount: 5000n }));
    const served = await menu();
    expect(Object.keys(served).sort()).toEqual(['categories', 'items', 'presets', 'version']);
    expect(Object.keys(served.categories[0]!).sort()).toEqual(['categoryId', 'name']);
    expect(Object.keys(served.items[0]!).sort()).toEqual([
      'basePrice',
      'categoryId',
      'isAvailable',
      'itemId',
      'modifiers',
      'name',
      'variants',
    ]);
    expect(Object.keys(served.items[0]!.variants[0]!).sort()).toEqual(['name', 'priceDelta', 'variantId']);
    expect(Object.keys(served.items[0]!.modifiers[0]!).sort()).toEqual(['modifierId', 'name', 'priceDelta']);
    expect(Object.keys(served.presets[0]!).sort()).toEqual(['name', 'presetId', 'value']);
  });

  it('5. an 86\'d active item is present, marked; one both 86\'d and archived is absent', async () => {
    const drinks = await category('Drinks');
    const soup = await item(drinks.categoryId, 'Soup');
    const gone = await item(drinks.categoryId, 'Gone');
    await item(drinks.categoryId, 'Tea');
    made(await markItemUnavailable(soup.itemId));
    made(await markItemUnavailable(gone.itemId));
    made(await archiveItem(gone.itemId));

    const served = await menu();
    expect(served.items.map((i) => [i.name, i.isAvailable])).toEqual([
      ['Soup', false],
      ['Tea', true],
    ]);
  });

  it('6. orders by display order, ties by name with the collator, then id, for categories, items and options', async () => {
    const [a, b, c] = [await category('x1'), await category('x2'), await category('x3')];
    const rows = [a, b, c].sort((p, q) => (p.categoryId < q.categoryId ? -1 : 1));
    // The lowest id gets the name that sorts last, so removing the tie-break shows.
    const names = ['B', 'a10', 'a2'];
    for (const [index, row] of rows.entries()) {
      await ownerQuery('UPDATE menu_category SET name = $2, display_order = 0 WHERE id = $1', [row.categoryId, names[index]]);
    }
    const first = rows[0]!;
    const items = [await item(first.categoryId, 'i1'), await item(first.categoryId, 'i2'), await item(first.categoryId, 'i3')]
      .sort((p, q) => (p.itemId < q.itemId ? -1 : 1));
    for (const [index, row] of items.entries()) {
      await ownerQuery('UPDATE menu_item SET name = $2, display_order = 0 WHERE id = $1', [row.itemId, names[index]]);
    }
    const holder = await item(first.categoryId, 'Holder', {
      variants: [
        { name: 'v1', priceDelta: 0n },
        { name: 'v2', priceDelta: 0n },
        { name: 'v3', priceDelta: 0n },
      ],
      modifiers: [
        { name: 'm1', priceDelta: 0n },
        { name: 'm2', priceDelta: 0n },
        { name: 'm3', priceDelta: 0n },
      ],
    });
    const variants = [...holder.variants].sort((p, q) => (p.optionId < q.optionId ? -1 : 1));
    const modifiers = [...holder.modifiers].sort((p, q) => (p.optionId < q.optionId ? -1 : 1));
    for (const [index, row] of variants.entries()) {
      await ownerQuery('UPDATE menu_item_variant SET name = $2, display_order = 0 WHERE id = $1', [row.optionId, names[index]]);
    }
    for (const [index, row] of modifiers.entries()) {
      await ownerQuery('UPDATE menu_item_modifier SET name = $2, display_order = 0 WHERE id = $1', [row.optionId, names[index]]);
    }

    const served = await menu();
    expect(ids(served.categories)).toEqual(['a2', 'a10', 'B']);
    const inFirst = served.items.filter((i) => i.categoryId === first.categoryId);
    // The three tied items, then the one created last with a later display order.
    expect(ids(inFirst).slice(0, 3)).toEqual(['a2', 'a10', 'B']);
    const held = served.items.find((i) => i.name === 'Holder')!;
    expect(ids(held.variants)).toEqual(['a2', 'a10', 'B']);
    expect(ids(held.modifiers)).toEqual(['a2', 'a10', 'B']);
  });

  it('6. a smaller display order comes first whatever the names, and items follow their category\'s place', async () => {
    const zeta = await category('Zeta');
    const alpha = await category('Alpha');
    await item(alpha.categoryId, 'Second item');
    await item(zeta.categoryId, 'First item');
    const served = await menu();
    expect(ids(served.categories)).toEqual(['Zeta', 'Alpha']);
    expect(ids(served.items)).toEqual(['First item', 'Second item']);
  });

  it('6. presets keep creation order, then id', async () => {
    for (const name of ['Third', 'First', 'Second']) made(await createPreset(name, { kind: 'FIXED', amount: 1000n }));
    expect(ids((await menu()).presets)).toEqual(['Third', 'First', 'Second']);
  });

  it('8. money and rates are canonical strings, and every answer validates against its schema', async () => {
    const drinks = await category('Drinks');
    await item(drinks.categoryId, 'Latte', {
      basePrice: 99999999n,
      variants: [{ name: 'Small', priceDelta: -1000n }],
      modifiers: [{ name: 'Oat milk', priceDelta: 3000n }],
    });
    made(await createPreset('Percent', { kind: 'PERCENTAGE', ratePpm: rateFromPpm(125000n) }));
    made(await createPreset('Fixed', { kind: 'FIXED', amount: 5000n }));

    const raw = await pos.get(MENU);
    expect(PosMenuResponse.safeParse(raw.json()).success).toBe(true);
    const served = raw.json() as PosMenuResponse;
    expect(served.items[0]!.basePrice).toBe('99999999');
    expect(served.items[0]!.variants[0]!.priceDelta).toBe('-1000');
    expect(served.items[0]!.modifiers[0]!.priceDelta).toBe('3000');
    expect(served.presets.map((p) => p.value)).toEqual([
      { kind: 'PERCENTAGE', ratePpm: '125000' },
      { kind: 'FIXED', amount: '5000' },
    ]);
    const revision = await pos.get(REVISION);
    expect(PosRevisionResponse.safeParse(revision.json()).success).toBe(true);
    // A number where a string belongs is refused by the schema the core holds.
    expect(PosMenuResponse.safeParse({ ...served, items: [{ ...served.items[0]!, basePrice: 25000 }] }).success).toBe(false);
  });

  it('11. an empty catalog answers the current version and empty lists, not an error', async () => {
    const res = await pos.get(MENU);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ version: await versionNow(), categories: [], items: [], presets: [] });
    expect((await pos.get(REVISION)).json()).toEqual({ version: await versionNow() });
  });
});

// ---- 7: one snapshot (AC-31, C-18's pattern) ----------------------------------------------------

describe('readPosMenu', () => {
  it('7. returns a version and contents that belong together, though a write commits between its statements', async () => {
    const drinks = await category('Drinks');
    const soup = await item(drinks.categoryId, 'Soup');
    const start = await versionNow();
    const competitor = await ownerClient();
    const original = pg.Client.prototype.query;
    let competed = false;
    // Runs after the read's version query returns, on a pooled client only (the competitor's
    // own queries pass through this wrapper too, and must not recurse).
    const spy = vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (this: pg.Client, ...args: unknown[]) {
      const result = (original as (...a: unknown[]) => unknown).apply(this, args);
      const text = typeof args[0] === 'string' ? args[0] : '';
      if (this !== competitor && !competed && text.includes('FROM catalog_revision')) {
        competed = true;
        return (result as Promise<unknown>).then(async (value) => {
          await (original as (...a: unknown[]) => Promise<unknown>).call(
            competitor,
            `WITH p AS (UPDATE menu_item SET base_price = 1 WHERE id = '${soup.itemId}')
             UPDATE catalog_revision SET version = version + 1`
          );
          return value;
        });
      }
      return result;
    } as never);
    try {
      const snapshot = await readPosMenu();
      expect(competed, 'the competing commit ran after the first statement').toBe(true);
      expect(snapshot.version).toBe(start);
      expect(snapshot.items.find((i) => i.itemId === soup.itemId)!.basePrice).toBe(25000n);
    } finally {
      spy.mockRestore();
      await competitor.end();
    }
    const later = await readPosMenu();
    expect(later.version).toBe(start + 1);
    expect(later.items.find((i) => i.itemId === soup.itemId)!.basePrice).toBe(1n);
  });
});

// ---- 9: the revision follows every command class -------------------------------------------------

describe('the revision', () => {
  it('9. equals the version after every command class, advancing by one each time', async () => {
    const office = await signedInManager();
    const post = (path: string, payload: object) =>
      office.request({ method: 'POST', url: `/api/back-office/config/catalog/${path}`, payload });
    const revision = async () => ((await pos.get(REVISION)).json() as { version: number }).version;

    let last = await revision();
    expect(last).toBe(await versionNow());
    const step = async (label: string, res: Awaited<ReturnType<typeof post>>) => {
      expect(res.statusCode, `${label}: ${res.body}`).toBe(200);
      const now = await revision();
      expect(now, label).toBe(last + 1);
      expect((res.json() as { version: number }).version, label).toBe(now);
      expect(now, label).toBe(await versionNow());
      last = now;
    };

    const drinksRes = await post('categories/create', { name: 'Drinks' });
    await step('category create', drinksRes);
    const drinks = (drinksRes.json() as { category: { categoryId: string } }).category;
    const foodRes = await post('categories/create', { name: 'Food' });
    await step('category create 2', foodRes);
    const food = (foodRes.json() as { category: { categoryId: string } }).category;
    await step('category reorder', await post('categories/reorder', { expectedVersion: last, categoryIds: [food.categoryId, drinks.categoryId] }));

    const itemRes = await post('items/create', {
      categoryId: drinks.categoryId,
      name: 'Latte',
      basePrice: '25000',
      variants: [],
      modifiers: [],
    });
    await step('item create', itemRes);
    const latte = (itemRes.json() as { item: { itemId: string } }).item;
    await step(
      'option add',
      await post('items/update', {
        itemId: latte.itemId,
        expectedVersion: last,
        changes: { variants: { added: [{ key: 'k', name: 'Large', priceDelta: '2000' }] } },
      })
    );
    await step(
      'price change',
      await post('items/update', { itemId: latte.itemId, expectedVersion: last, changes: { fields: { basePrice: '27000' } } })
    );
    await step('86', await post('items/mark-unavailable', { itemId: latte.itemId }));
    await step('un-86', await post('items/mark-available', { itemId: latte.itemId }));
    await step('item archive', await post('items/archive', { itemId: latte.itemId }));
    await step('item restore', await post('items/restore', { itemId: latte.itemId }));
    await step('category archive', await post('categories/archive', { categoryId: food.categoryId }));
    await step('category restore', await post('categories/restore', { categoryId: food.categoryId }));

    const presetRes = await post('presets/create', { name: 'Staff', value: { kind: 'FIXED', amount: '5000' } });
    await step('preset create', presetRes);
    const preset = (presetRes.json() as { preset: { presetId: string } }).preset;
    await step(
      'preset edit',
      await post('presets/update', {
        presetId: preset.presetId,
        expectedVersion: last,
        name: 'Staff',
        value: { kind: 'FIXED', amount: '6000' },
      })
    );
    await step('preset deactivate', await post('presets/deactivate', { presetId: preset.presetId }));
    await step('preset reactivate', await post('presets/reactivate', { presetId: preset.presetId }));
  });
});

// ---- 10: the client instance ----------------------------------------------------------------------

describe('the client instance', () => {
  async function lastSeen(id: string): Promise<string> {
    return (await ownerQuery<{ at: string }>('SELECT last_seen_at::text AS at FROM client_instance WHERE id = $1', [id]))[0]!.at;
  }
  async function aged(client: JarClient): Promise<{ id: string; at: string }> {
    const id = client.valueOf('rpos_cid')!;
    await ownerQuery(`UPDATE client_instance SET last_seen_at = now() - interval '1 hour' WHERE id = $1`, [id]);
    return { id, at: await lastSeen(id) };
  }

  it('10. the revision route does not touch client_instance', async () => {
    const client = await signedInCashier();
    const { id, at } = await aged(client);
    expect((await client.get(REVISION)).statusCode).toBe(200);
    expect(await lastSeen(id)).toBe(at);
  });

  it('10. the menu route does, as every other API route', async () => {
    const client = await signedInCashier();
    const { id, at } = await aged(client);
    expect((await client.get(MENU)).statusCode).toBe(200);
    expect(await lastSeen(id)).not.toBe(at);
  });
});

// ---- 12: the log ---------------------------------------------------------------------------------

interface Line {
  level: number;
  msg?: string;
}
const parsed = (from: number): Line[] => logLines.slice(from).map((line) => JSON.parse(line) as Line);

describe('the log', () => {
  it('12. a poll writes no request or reply line at info; the menu read writes them', async () => {
    const before = logLines.length;
    for (let i = 0; i < 3; i += 1) expect((await pos.get(REVISION)).statusCode).toBe(200);
    expect(parsed(before).filter((line) => line.level <= 30)).toEqual([]);

    const mark = logLines.length;
    expect((await pos.get(MENU)).statusCode).toBe(200);
    expect(parsed(mark).map((line) => line.msg)).toEqual(['incoming request', 'request completed']);
  });

  it('12. a 500 on the revision route is still logged', async () => {
    const original = getPool().query.bind(getPool()) as (...a: unknown[]) => Promise<unknown>;
    vi.spyOn(getPool(), 'query').mockImplementation(((...args: unknown[]) => {
      const text = typeof args[0] === 'string' ? args[0] : '';
      return text.includes('FROM catalog_revision') ? Promise.reject(new Error('down')) : original(...args);
    }) as never);
    const before = logLines.length;
    const res = await pos.get(REVISION);
    expect(res.statusCode).toBe(500);
    expect(parsed(before).some((line) => line.level >= 50 && line.msg === 'request failed')).toBe(true);
  });
});
