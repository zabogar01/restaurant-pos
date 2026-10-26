import { createHmac } from 'node:crypto';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ErrorBody, ROUTE_TABLE } from '@pos/contracts';
import { closePool } from '../src/db/pool.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import { auditCount, makePeople } from './support/people.js';
import { TEST_ORIGIN, inject } from './support/request.js';

// PHASE1-S4b: the eleven catalog routes on S4a's domain (ADR-012 rules 13 and 15; consult
// C1 section 2.4). Every case below is numbered by the task's acceptance criterion it
// proves. The catalog_revision row is never reset between cases, so versions are asserted
// relative to the version read at the start of each case.

const people = makePeople(700000);
const BASE = '/api/back-office/config/catalog';
const DUPLICATE = '{"error":{"code":"DUPLICATE"}}';
const NOT_FOUND = '{"error":{"code":"NOT_FOUND"}}';
const VALIDATION = '{"error":{"code":"VALIDATION_FAILED"}}';
const CATALOG_CHANGED = '{"error":{"code":"CATALOG_CHANGED"}}';
const UNAUTHENTICATED = '{"error":{"code":"UNAUTHENTICATED"}}';
const FORBIDDEN = '{"error":{"code":"FORBIDDEN"}}';
const CSRF_REFUSED = '{"error":{"code":"CSRF_REFUSED"}}';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

let app: FastifyInstance;
let client: JarClient;
let manager: Awaited<ReturnType<typeof people.manager>>;
const logLines: string[] = [];
const stdout: string[] = [];

beforeAll(async () => {
  await resetDatabase();
  const logStream = new Writable({
    write(chunk, _encoding, done) {
      logLines.push(...chunk.toString().split('\n').filter(Boolean));
      done();
    },
  });
  app = buildServer({ origin: TEST_ORIGIN, logLevel: 'trace', logStream });
  await app.ready();
  manager = await people.manager();
  client = new JarClient(app);
  const signedIn = await client.signInBackOffice(manager.username, manager.password);
  expect(signedIn.statusCode).toBe(200);
});

beforeEach(async () => {
  await ownerQuery('TRUNCATE menu_item_modifier, menu_item_variant, menu_item, menu_category');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

// ---- the eleven calls, as the manager's signed-in browser profile ---------------------

const read = () => client.get(BASE);
const post = (path: string, payload: object) => client.request({ method: 'POST', url: `${BASE}/${path}`, payload });

type Res = Awaited<ReturnType<typeof read>>;

interface Category {
  categoryId: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}
interface Variant {
  variantId: string;
  name: string;
  priceDelta: string;
  displayOrder: number;
  isActive: boolean;
}
interface Modifier {
  modifierId: string;
  name: string;
  priceDelta: string;
  displayOrder: number;
  isActive: boolean;
}
interface Item {
  itemId: string;
  categoryId: string;
  name: string;
  basePrice: string;
  displayOrder: number;
  isAvailable: boolean;
  isActive: boolean;
  variants: Variant[];
  modifiers: Modifier[];
}
interface Catalog {
  version: number;
  categories: Category[];
  items: Item[];
}

const catalogOf = (res: Res) => res.json() as Catalog;
const versionNow = async () => catalogOf(await read()).version;

/** A category made through the route; fails the case that needed it if it was not made. */
async function madeCategory(name: string, archived = false): Promise<Category> {
  const res = await post('categories/create', { name });
  expect(res.statusCode, `create category ${name}: ${res.body}`).toBe(200);
  const { category } = res.json() as { category: Category };
  if (archived) expect((await post('categories/archive', { categoryId: category.categoryId })).statusCode).toBe(200);
  return category;
}

const itemBody = (categoryId: string, name: string, more: Record<string, unknown> = {}) => ({
  categoryId,
  name,
  basePrice: '25000',
  variants: [],
  modifiers: [],
  ...more,
});

async function madeItem(categoryId: string, name: string, more: Record<string, unknown> = {}): Promise<Item> {
  const res = await post('items/create', itemBody(categoryId, name, more));
  expect(res.statusCode, `create item ${name}: ${res.body}`).toBe(200);
  return (res.json() as { item: Item }).item;
}

/** An item with two variants and one modifier, in a fresh category. */
async function madeRichItem(name = 'Latte'): Promise<{ category: Category; item: Item }> {
  const category = await madeCategory(`Drinks for ${name}`);
  const item = await madeItem(category.categoryId, name, {
    variants: [
      { name: 'Small', priceDelta: '-1000' },
      { name: 'Large', priceDelta: '2000' },
    ],
    modifiers: [{ name: 'Oat milk', priceDelta: '3000' }],
  });
  return { category, item };
}

/** Every row of the four tables and the version, with the transaction that last wrote it. */
async function whole(): Promise<string[]> {
  const out: string[] = [];
  for (const table of ['catalog_revision', 'menu_category', 'menu_item', 'menu_item_variant', 'menu_item_modifier']) {
    const rows = await ownerQuery<{ r: string }>(
      `SELECT to_jsonb(t)::text || '|' || t.xmin::text AS r FROM ${table} t ORDER BY 1`
    );
    out.push(...rows.map((row) => `${table}:${row.r}`));
  }
  return out;
}

// ---- 1 and 2 are route-table.test.ts and routes.test.ts, unedited. 3: the guard ----------

describe('the eleven routes', () => {
  const entries = ROUTE_TABLE.filter((e) => e.path.startsWith(BASE));

  it('1. are the eleven of the route table, with the interactive the table gives', () => {
    expect(entries.map((e) => `${e.method} ${e.path} ${e.interactive}`)).toEqual([
      `GET ${BASE} false`,
      `POST ${BASE}/categories/create true`,
      `POST ${BASE}/categories/update true`,
      `POST ${BASE}/categories/reorder true`,
      `POST ${BASE}/categories/archive true`,
      `POST ${BASE}/categories/restore true`,
      `POST ${BASE}/items/create true`,
      `POST ${BASE}/items/update true`,
      `POST ${BASE}/items/reorder true`,
      `POST ${BASE}/items/archive true`,
      `POST ${BASE}/items/restore true`,
    ]);
  });

  // Independent of the production derivation, as session-guard.test.ts does it.
  const csrfOf = (token: string) => createHmac('sha256', token).update('rpos-csrf-v1').digest('base64url');

  const bodyFor = (path: string, categoryId: string, itemId: string, version: number) => {
    const route = path.slice(BASE.length + 1);
    switch (route) {
      case 'categories/create':
        return { name: 'Refused' };
      case 'categories/update':
        return { categoryId, expectedVersion: version, name: 'Refused' };
      case 'categories/reorder':
        return { expectedVersion: version, categoryIds: [categoryId] };
      case 'categories/archive':
      case 'categories/restore':
        return { categoryId };
      case 'items/create':
        return itemBody(categoryId, 'Refused');
      case 'items/update':
        return { itemId, expectedVersion: version, changes: { fields: { name: 'Refused' } } };
      case 'items/reorder':
        return { categoryId, expectedVersion: version, itemIds: [itemId] };
      default:
        return { itemId };
    }
  };

  it('3. each refuses no cookie and a POS session in the cookie (401), a demoted manager (403) and, on a POST, a missing or wrong anti-CSRF header (403), writing nothing', async () => {
    const category = await madeCategory('Mains');
    const item = await madeItem(category.categoryId, 'Soup');
    const before = await whole();
    const audits = await auditCount();
    const version = await versionNow();
    const boToken = client.valueOf('rpos_bo_sid')!;

    const cashier = await people.cashier();
    const posClient = new JarClient(app);
    expect((await posClient.signInPos(cashier.pin)).statusCode).toBe(200);
    const posToken = posClient.valueOf('rpos_pos_sid')!;

    const demoted = await people.manager();
    const demotedClient = new JarClient(app);
    expect((await demotedClient.signInBackOffice(demoted.username, demoted.password)).statusCode).toBe(200);
    const demotedToken = demotedClient.valueOf('rpos_bo_sid')!;
    await ownerQuery("UPDATE staff_user SET role = 'CASHIER' WHERE id = $1", [demoted.id]);

    for (const entry of entries) {
      const send = (cookie: string | undefined, csrf: string | undefined) =>
        inject(app, {
          method: entry.method,
          url: entry.path,
          ...(entry.method === 'POST'
            ? { payload: bodyFor(entry.path, category.categoryId, item.itemId, version) }
            : {}),
          headers: {
            ...(cookie === undefined ? {} : { cookie }),
            ...(csrf === undefined ? {} : { 'x-rpos-csrf': csrf }),
          },
        });
      const where = `${entry.method} ${entry.path}`;

      const none = await send(undefined, entry.method === 'POST' ? 'x'.repeat(43) : undefined);
      expect([none.statusCode, none.body], `${where}: no cookie`).toEqual([401, UNAUTHENTICATED]);

      const pos = await send(`rpos_bo_sid=${posToken}`, entry.method === 'POST' ? csrfOf(posToken) : undefined);
      expect([pos.statusCode, pos.body], `${where}: a POS token in the cookie`).toEqual([401, UNAUTHENTICATED]);

      const forbidden = await send(
        `rpos_bo_sid=${demotedToken}`,
        entry.method === 'POST' ? csrfOf(demotedToken) : undefined
      );
      expect([forbidden.statusCode, forbidden.body], `${where}: a demoted manager`).toEqual([403, FORBIDDEN]);

      if (entry.method === 'POST') {
        const missing = await send(`rpos_bo_sid=${boToken}`, undefined);
        expect([missing.statusCode, missing.body], `${where}: no anti-CSRF header`).toEqual([403, CSRF_REFUSED]);
        const wrong = await send(`rpos_bo_sid=${boToken}`, csrfOf(`${boToken}-other`));
        expect([wrong.statusCode, wrong.body], `${where}: a wrong anti-CSRF header`).toEqual([403, CSRF_REFUSED]);
      }
    }

    expect(await whole()).toEqual(before);
    expect(await versionNow()).toBe(version);
    expect(await auditCount()).toBe(audits);
  });
});

// ---- 4: CATALOG_CHANGED ----------------------------------------------------------------

describe('CATALOG_CHANGED', () => {
  it('4. a stale categories/update, categories/reorder, items/update and items/reorder are 409 with a bare body, and write nothing', async () => {
    const { category, item } = await madeRichItem();
    const before = await read();
    const behind = catalogOf(before).version - 1;

    const stale: Array<[string, object]> = [
      ['categories/update', { categoryId: category.categoryId, expectedVersion: behind, name: 'Renamed' }],
      ['categories/reorder', { expectedVersion: behind, categoryIds: [category.categoryId] }],
      ['items/update', { itemId: item.itemId, expectedVersion: behind, changes: { fields: { name: 'Renamed' } } }],
      ['items/reorder', { categoryId: category.categoryId, expectedVersion: behind, itemIds: [item.itemId] }],
    ];
    for (const [path, payload] of stale) {
      const res = await post(path, payload);
      expect([res.statusCode, res.body], path).toEqual([409, CATALOG_CHANGED]);
      expect(ErrorBody.safeParse(res.json()).success, path).toBe(true);
    }
    const after = await read();
    expect(after.body).toBe(before.body);
  });

  it('4. a version ahead of the current one is stale too', async () => {
    const category = await madeCategory('Mains');
    const ahead = (await versionNow()) + 1;
    const res = await post('categories/update', { categoryId: category.categoryId, expectedVersion: ahead, name: 'X' });
    expect([res.statusCode, res.body]).toEqual([409, CATALOG_CHANGED]);
  });

  it('4. an items/create into a category archived since carries no version and is 409 CATALOG_CHANGED', async () => {
    const category = await madeCategory('Gone', true);
    const before = await whole();
    const res = await post('items/create', itemBody(category.categoryId, 'Late'));
    expect([res.statusCode, res.body]).toEqual([409, CATALOG_CHANGED]);
    expect(await whole()).toEqual(before);
  });
});

// ---- 5: prices are strings ---------------------------------------------------------------

describe('the prices', () => {
  const NOT_CANONICAL = ['01', '-0', '+5', '1e3', '1.5', ' 5', '5 ', ''];

  /** Every place a price can be sent, built from one value. */
  async function priceSites() {
    const { item, category } = await madeRichItem('Priced');
    const version = await versionNow();
    const variantId = item.variants[0]!.variantId;
    const modifierId = item.modifiers[0]!.modifierId;
    const save = (changes: unknown) => ['items/update', { itemId: item.itemId, expectedVersion: version, changes }] as const;
    const sites = {
      base: {
        bounds: ['-1', '100000000'],
        build: (value: unknown) => ['items/create', itemBody(category.categoryId, 'Never', { basePrice: value })] as const,
      },
      variant: {
        bounds: ['-100000000', '100000000'],
        build: (value: unknown) =>
          ['items/create', itemBody(category.categoryId, 'Never', { variants: [{ name: 'V', priceDelta: value }] })] as const,
      },
      modifier: {
        bounds: ['-1', '100000000'],
        build: (value: unknown) =>
          ['items/create', itemBody(category.categoryId, 'Never', { modifiers: [{ name: 'M', priceDelta: value }] })] as const,
      },
      'edit base': { bounds: ['-1', '100000000'], build: (value: unknown) => save({ fields: { basePrice: value } }) },
      'edit variant': {
        bounds: ['-100000000', '100000000'],
        build: (value: unknown) => save({ variants: { edited: [{ id: variantId, priceDelta: value }] } }),
      },
      'added variant': {
        bounds: ['-100000000', '100000000'],
        build: (value: unknown) => save({ variants: { added: [{ key: 'k', name: 'New', priceDelta: value }] } }),
      },
      'edit modifier': {
        bounds: ['-1', '100000000'],
        build: (value: unknown) => save({ modifiers: { edited: [{ id: modifierId, priceDelta: value }] } }),
      },
      'added modifier': {
        bounds: ['-1', '100000000'],
        build: (value: unknown) => save({ modifiers: { added: [{ key: 'k', name: 'New', priceDelta: value }] } }),
      },
    };
    return { sites, version };
  }

  it('5. a price sent as a JSON number, or as a non-canonical or out-of-bound string, is 400 at every site and writes nothing', async () => {
    const { sites } = await priceSites();
    const before = await whole();
    for (const [label, site] of Object.entries(sites)) {
      for (const value of [10000, 0, -1, 1.5, ...NOT_CANONICAL, ...site.bounds]) {
        const [path, payload] = site.build(value);
        const res = await post(path, payload);
        expect([res.statusCode, res.body], `${label}: ${JSON.stringify(value)}`).toEqual([400, VALIDATION]);
      }
    }
    expect(await whole()).toEqual(before);
  });

  it('5. the bounds 0, 99999999 and the variant\'s -99999999 are accepted and round-trip exactly', async () => {
    const category = await madeCategory('Bounds');
    const created = await post(
      'items/create',
      itemBody(category.categoryId, 'Max', {
        basePrice: '99999999',
        variants: [
          { name: 'Down', priceDelta: '-99999999' },
          { name: 'Up', priceDelta: '99999999' },
          { name: 'Zero', priceDelta: '0' },
        ],
        modifiers: [
          { name: 'None', priceDelta: '0' },
          { name: 'Top', priceDelta: '99999999' },
        ],
      })
    );
    expect(created.statusCode, created.body).toBe(200);
    const free = await post('items/create', itemBody(category.categoryId, 'Free', { basePrice: '0' }));
    expect(free.statusCode, free.body).toBe(200);

    const items = catalogOf(await read()).items;
    const max = items.find((i) => i.name === 'Max')!;
    expect(max.basePrice).toBe('99999999');
    expect(max.variants.map((v) => v.priceDelta)).toEqual(['-99999999', '99999999', '0']);
    expect(max.modifiers.map((m) => m.priceDelta)).toEqual(['0', '99999999']);
    expect(items.find((i) => i.name === 'Free')!.basePrice).toBe('0');
    // The answer carries the same strings the read does.
    expect((created.json() as { item: Item }).item).toEqual(max);
  });

  it('5. an edit to the bounds is accepted and round-trips exactly', async () => {
    const { item } = await madeRichItem('Edge');
    const version = await versionNow();
    const res = await post('items/update', {
      itemId: item.itemId,
      expectedVersion: version,
      changes: {
        fields: { basePrice: '99999999' },
        variants: { edited: [{ id: item.variants[0]!.variantId, priceDelta: '-99999999' }] },
        modifiers: { edited: [{ id: item.modifiers[0]!.modifierId, priceDelta: '99999999' }] },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    const read1 = catalogOf(await read()).items.find((i) => i.itemId === item.itemId)!;
    expect(read1.basePrice).toBe('99999999');
    expect(read1.variants[0]!.priceDelta).toBe('-99999999');
    expect(read1.modifiers[0]!.priceDelta).toBe('99999999');
  });
});

// ---- 6: names ------------------------------------------------------------------------------

describe('the names', () => {
  let counter = 0;
  const kinds: Array<[string, number, (name: string) => Promise<Res>]> = [
    ['category', 32, (name) => post('categories/create', { name })],
    [
      'item',
      64,
      async (name) => post('items/create', itemBody((await madeCategory(`Host ${(counter += 1)}`)).categoryId, name)),
    ],
    [
      'variant',
      32,
      async (name) =>
        post(
          'items/create',
          itemBody((await madeCategory(`Host ${(counter += 1)}`)).categoryId, `Host item ${counter}`, {
            variants: [{ name, priceDelta: '0' }],
          })
        ),
    ],
    [
      'modifier',
      32,
      async (name) =>
        post(
          'items/create',
          itemBody((await madeCategory(`Host ${(counter += 1)}`)).categoryId, `Host item ${counter}`, {
            modifiers: [{ name, priceDelta: '0' }],
          })
        ),
    ],
  ];

  for (const [kind, max, attempt] of kinds) {
    it(`6. a ${kind} name that is empty, over ${max} code points, untrimmed, or holds a line feed or ESC is 400 with no details; ${max} emoji is accepted`, async () => {
      const refused = ['', 'x'.repeat(max + 1), '😀'.repeat(max + 1), ' x', 'x ', 'a\nb', 'a\u001bb', 'a\tb'];
      for (const name of refused) {
        const res = await attempt(name);
        expect([res.statusCode, res.body], `${kind}: ${JSON.stringify(name)}`).toEqual([400, VALIDATION]);
      }
      const ok = await attempt('😀'.repeat(max));
      expect(ok.statusCode, ok.body).toBe(200);
    });
  }

  it('6. the names in an item save follow the same rules and are 400', async () => {
    const { item } = await madeRichItem('Named');
    const version = await versionNow();
    const save = (changes: unknown) => post('items/update', { itemId: item.itemId, expectedVersion: version, changes });
    for (const changes of [
      { fields: { name: ' Named' } },
      { fields: { name: 'x'.repeat(65) } },
      { variants: { edited: [{ id: item.variants[0]!.variantId, name: 'x'.repeat(33) }] } },
      { variants: { added: [{ key: 'k', name: 'a\nb', priceDelta: '0' }] } },
      { modifiers: { edited: [{ id: item.modifiers[0]!.modifierId, name: ' ' }] } },
    ]) {
      const res = await save(changes);
      expect([res.statusCode, res.body], JSON.stringify(changes)).toEqual([400, VALIDATION]);
    }
  });
});

// ---- 7: strictness and shape ---------------------------------------------------------------

describe('strictness and shape', () => {
  async function bodies() {
    const { category, item } = await madeRichItem('Strict');
    const version = await versionNow();
    const variantId = item.variants[0]!.variantId;
    const all: Array<[string, Record<string, unknown>]> = [
      ['categories/create', { name: 'New' }],
      ['categories/update', { categoryId: category.categoryId, expectedVersion: version, name: 'New' }],
      ['categories/reorder', { expectedVersion: version, categoryIds: [category.categoryId] }],
      ['categories/archive', { categoryId: category.categoryId }],
      ['categories/restore', { categoryId: category.categoryId }],
      ['items/create', itemBody(category.categoryId, 'New')],
      ['items/update', { itemId: item.itemId, expectedVersion: version, changes: {} }],
      ['items/reorder', { categoryId: category.categoryId, expectedVersion: version, itemIds: [item.itemId] }],
      ['items/archive', { itemId: item.itemId }],
      ['items/restore', { itemId: item.itemId }],
    ];
    return { category, item, version, variantId, all };
  }

  it('7. an extra key at the top level of each of the ten request bodies is 400, writing nothing', async () => {
    const { all } = await bodies();
    const before = await whole();
    for (const [path, body] of all) {
      const res = await post(path, { ...body, extra: 1 });
      expect([res.statusCode, res.body], path).toEqual([400, VALIDATION]);
    }
    expect(await whole()).toEqual(before);
  });

  it('7. an extra key inside changes, fields, a list\'s changes, and an added or edited entry is 400', async () => {
    const { item, version, variantId } = await bodies();
    const before = await whole();
    const save = (changes: unknown) => post('items/update', { itemId: item.itemId, expectedVersion: version, changes });
    for (const changes of [
      { extra: 1 },
      { fields: { extra: 1 } },
      { variants: { extra: [] } },
      { modifiers: { extra: [] } },
      { variants: { added: [{ key: 'k', name: 'S', priceDelta: '0', extra: 1 }] } },
      { variants: { edited: [{ id: variantId, extra: 1 }] } },
      { modifiers: { added: [{ key: 'k', name: 'S', priceDelta: '0', extra: 1 }] } },
      { modifiers: { edited: [{ id: item.modifiers[0]!.modifierId, extra: 1 }] } },
    ]) {
      const res = await save(changes);
      expect([res.statusCode, res.body], JSON.stringify(changes)).toEqual([400, VALIDATION]);
    }
    expect(await whole()).toEqual(before);
  });

  it('7. a malformed UUID is 400 wherever an id is sent', async () => {
    const { category, item, version } = await bodies();
    const before = await whole();
    const bad: Array<[string, object]> = [
      ['categories/update', { categoryId: 'x', expectedVersion: version, name: 'N' }],
      ['categories/reorder', { expectedVersion: version, categoryIds: ['x'] }],
      ['categories/archive', { categoryId: 'x' }],
      ['categories/restore', { categoryId: 'x' }],
      ['items/create', itemBody('x', 'N')],
      ['items/update', { itemId: 'x', expectedVersion: version, changes: {} }],
      ['items/update', { itemId: item.itemId, expectedVersion: version, changes: { fields: { categoryId: 'x' } } }],
      ['items/update', { itemId: item.itemId, expectedVersion: version, changes: { variants: { removed: ['x'] } } }],
      ['items/update', { itemId: item.itemId, expectedVersion: version, changes: { modifiers: { edited: [{ id: 'x' }] } } }],
      ['items/update', { itemId: item.itemId, expectedVersion: version, changes: { variants: { order: [{ id: 'x' }] } } }],
      ['items/reorder', { categoryId: 'x', expectedVersion: version, itemIds: [item.itemId] }],
      ['items/reorder', { categoryId: category.categoryId, expectedVersion: version, itemIds: ['x'] }],
      ['items/archive', { itemId: 'x' }],
      ['items/restore', { itemId: 'x' }],
    ];
    for (const [path, payload] of bad) {
      const res = await post(path, payload);
      expect([res.statusCode, res.body], `${path} ${JSON.stringify(payload)}`).toEqual([400, VALIDATION]);
    }
    expect(await whole()).toEqual(before);
  });

  it('7. an expectedVersion of -1, 1.5, "1" or none is 400 on each of the four versioned routes', async () => {
    const { all } = await bodies();
    const before = await whole();
    const versioned = all.filter(([, body]) => 'expectedVersion' in body);
    expect(versioned.map(([path]) => path)).toEqual([
      'categories/update',
      'categories/reorder',
      'items/update',
      'items/reorder',
    ]);
    for (const [path, body] of versioned) {
      for (const expectedVersion of [-1, 1.5, '1']) {
        const res = await post(path, { ...body, expectedVersion });
        expect([res.statusCode, res.body], `${path} ${JSON.stringify(expectedVersion)}`).toEqual([400, VALIDATION]);
      }
      const { expectedVersion: _dropped, ...without } = body;
      const res = await post(path, without);
      expect([res.statusCode, res.body], `${path} without a version`).toEqual([400, VALIDATION]);
    }
    expect(await whole()).toEqual(before);
  });

  it('7. an order entry carrying both id and key, and an empty key, are 400', async () => {
    const { item, version, variantId } = await bodies();
    const before = await whole();
    const save = (changes: unknown) => post('items/update', { itemId: item.itemId, expectedVersion: version, changes });
    for (const changes of [
      { variants: { order: [{ id: variantId, key: 'k' }] } },
      { variants: { order: [{ key: '' }] } },
      { variants: { added: [{ key: '', name: 'New', priceDelta: '0' }] } },
      { modifiers: { order: [{ id: item.modifiers[0]!.modifierId, key: 'k' }] } },
    ]) {
      const res = await save(changes);
      expect([res.statusCode, res.body], JSON.stringify(changes)).toEqual([400, VALIDATION]);
    }
    expect(await whole()).toEqual(before);
  });
});

// ---- 8: INVALID is VALIDATION_FAILED -------------------------------------------------------

describe('INVALID', () => {
  it('8. a categories/reorder missing one active category is 400 with a bare body, and writes nothing', async () => {
    const a = await madeCategory('A');
    await madeCategory('B');
    const before = await whole();
    const res = await post('categories/reorder', { expectedVersion: await versionNow(), categoryIds: [a.categoryId] });
    expect([res.statusCode, res.body]).toEqual([400, VALIDATION]);
    expect(await whole()).toEqual(before);
  });

  it('8. an items/update whose order is not the list\'s final active set is 400 with a bare body, and writes nothing', async () => {
    const { item } = await madeRichItem('Ordered');
    const before = await whole();
    const version = await versionNow();
    const [small, large] = item.variants;
    for (const order of [
      [{ id: small!.variantId }],
      [{ id: small!.variantId }, { id: large!.variantId }, { key: 'nobody' }],
      [{ id: small!.variantId }, { id: small!.variantId }],
    ]) {
      const res = await post('items/update', {
        itemId: item.itemId,
        expectedVersion: version,
        changes: { variants: { order } },
      });
      expect([res.statusCode, res.body], JSON.stringify(order)).toEqual([400, VALIDATION]);
    }
    expect(await whole()).toEqual(before);
  });
});

// ---- 9: DUPLICATE is bare ------------------------------------------------------------------

describe('DUPLICATE', () => {
  const dup = (res: Res) => [res.statusCode, res.body] as const;

  it('9. a category create, rename and restore into a held name are 409 with a bare body', async () => {
    const mains = await madeCategory('Mains');
    const sides = await madeCategory('Sides');
    const old = await madeCategory('Desserts', true);
    await madeCategory('Desserts');
    const before = await whole();

    expect(dup(await post('categories/create', { name: 'MAINS' }))).toEqual([409, DUPLICATE]);
    expect(
      dup(await post('categories/update', { categoryId: sides.categoryId, expectedVersion: await versionNow(), name: 'mains' }))
    ).toEqual([409, DUPLICATE]);
    expect(dup(await post('categories/restore', { categoryId: old.categoryId }))).toEqual([409, DUPLICATE]);
    expect(mains.name).toBe('Mains');
    expect(await whole()).toEqual(before);
  });

  it('9. an item create, rename and restore into a held name are 409 with a bare body', async () => {
    const category = await madeCategory('Mains');
    await madeItem(category.categoryId, 'Soup');
    const other = await madeItem(category.categoryId, 'Salad');
    const old = await madeItem(category.categoryId, 'Pie');
    expect((await post('items/archive', { itemId: old.itemId })).statusCode).toBe(200);
    await madeItem(category.categoryId, 'Pie');
    const before = await whole();

    expect(dup(await post('items/create', itemBody(category.categoryId, 'soup')))).toEqual([409, DUPLICATE]);
    expect(
      dup(
        await post('items/update', {
          itemId: other.itemId,
          expectedVersion: await versionNow(),
          changes: { fields: { name: 'SOUP' } },
        })
      )
    ).toEqual([409, DUPLICATE]);
    expect(dup(await post('items/restore', { itemId: old.itemId }))).toEqual([409, DUPLICATE]);
    expect(await whole()).toEqual(before);
  });

  it('9. an item save with two added modifiers sharing one name is 409 with a bare body', async () => {
    const { item } = await madeRichItem('Twin');
    const before = await whole();
    const res = await post('items/update', {
      itemId: item.itemId,
      expectedVersion: await versionNow(),
      changes: {
        modifiers: {
          added: [
            { key: 'a', name: 'Extra', priceDelta: '1000' },
            { key: 'b', name: 'extra', priceDelta: '2000' },
          ],
        },
      },
    });
    expect(dup(res)).toEqual([409, DUPLICATE]);
    expect(await whole()).toEqual(before);
  });

  it('9. an items/create with two variants sharing one name is 409 with a bare body', async () => {
    const category = await madeCategory('Mains');
    const res = await post(
      'items/create',
      itemBody(category.categoryId, 'Twins', {
        variants: [
          { name: 'Same', priceDelta: '0' },
          { name: 'Same', priceDelta: '1' },
        ],
      })
    );
    expect(dup(res)).toEqual([409, DUPLICATE]);
  });
});

// ---- 10: NOT_FOUND --------------------------------------------------------------------------

describe('NOT_FOUND', () => {
  it('10. an unknown category or item id is 404 on update, archive and restore, and writes nothing', async () => {
    const { category, item } = await madeRichItem();
    const before = await whole();
    const version = await versionNow();
    const unknown: Array<[string, object]> = [
      ['categories/update', { categoryId: UNKNOWN_ID, expectedVersion: version, name: 'N' }],
      ['categories/archive', { categoryId: UNKNOWN_ID }],
      ['categories/restore', { categoryId: UNKNOWN_ID }],
      ['items/update', { itemId: UNKNOWN_ID, expectedVersion: version, changes: { fields: { name: 'N' } } }],
      ['items/archive', { itemId: UNKNOWN_ID }],
      ['items/restore', { itemId: UNKNOWN_ID }],
      ['items/create', itemBody(UNKNOWN_ID, 'N')],
      ['items/reorder', { categoryId: UNKNOWN_ID, expectedVersion: version, itemIds: [item.itemId] }],
      [
        'items/update',
        { itemId: item.itemId, expectedVersion: version, changes: { fields: { categoryId: UNKNOWN_ID } } },
      ],
    ];
    for (const [path, payload] of unknown) {
      const res = await post(path, payload);
      expect([res.statusCode, res.body], `${path} ${JSON.stringify(payload)}`).toEqual([404, NOT_FOUND]);
    }
    expect(category.isActive).toBe(true);
    expect(await whole()).toEqual(before);
  });

  it('10. another item\'s variant id in edited is 404, and writes nothing', async () => {
    const { item: first } = await madeRichItem('First');
    const { item: second } = await madeRichItem('Second');
    const before = await whole();
    const res = await post('items/update', {
      itemId: second.itemId,
      expectedVersion: await versionNow(),
      changes: { variants: { edited: [{ id: first.variants[0]!.variantId, name: 'Stolen' }] } },
    });
    expect([res.statusCode, res.body]).toEqual([404, NOT_FOUND]);
    expect(await whole()).toEqual(before);
  });
});

// ---- 11: the answers are authoritative -------------------------------------------------------

describe('the answers', () => {
  /** The answered version is the start plus one, and the read then shows the same version. */
  async function applied(res: Res, start: number): Promise<Record<string, unknown>> {
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.version).toBe(start + 1);
    expect((await read()).json()).toMatchObject({ version: start + 1 });
    return body;
  }

  it('11. each of the ten commands, applied to a real change, answers start + 1 and the record the following read holds', async () => {
    // categories/create
    let v = await versionNow();
    let body = (await applied(await post('categories/create', { name: 'Mains' }), v)) as { category: Category };
    const mains = body.category;
    expect(catalogOf(await read()).categories.find((c) => c.categoryId === mains.categoryId)).toEqual(mains);
    const drinks = ((await applied(await post('categories/create', { name: 'Drinks' }), v + 1)) as { category: Category })
      .category;

    // categories/update
    v = await versionNow();
    body = (await applied(
      await post('categories/update', { categoryId: mains.categoryId, expectedVersion: v, name: 'Big plates' }),
      v
    )) as { category: Category };
    expect(body.category.name).toBe('Big plates');
    expect(catalogOf(await read()).categories.find((c) => c.categoryId === mains.categoryId)).toEqual(body.category);

    // categories/reorder
    v = await versionNow();
    const reordered = (await applied(
      await post('categories/reorder', { expectedVersion: v, categoryIds: [drinks.categoryId, mains.categoryId] }),
      v
    )) as { categories: Category[] };
    expect(reordered.categories.map((c) => c.categoryId)).toEqual([drinks.categoryId, mains.categoryId]);
    expect(catalogOf(await read()).categories.filter((c) => c.isActive)).toEqual(reordered.categories);

    // items/create
    v = await versionNow();
    const created = (await applied(
      await post(
        'items/create',
        itemBody(mains.categoryId, 'Steak', {
          variants: [{ name: 'Medium', priceDelta: '0' }],
          modifiers: [{ name: 'Sauce', priceDelta: '5000' }],
        })
      ),
      v
    )) as { item: Item };
    expect(created.item.variants).toHaveLength(1);
    expect(catalogOf(await read()).items.find((i) => i.itemId === created.item.itemId)).toEqual(created.item);
    const fish = ((await applied(await post('items/create', itemBody(mains.categoryId, 'Fish')), v + 1)) as {
      item: Item;
    }).item;

    // items/update
    v = await versionNow();
    const updated = (await applied(
      await post('items/update', {
        itemId: created.item.itemId,
        expectedVersion: v,
        changes: { fields: { name: 'Ribeye', basePrice: '150000' } },
      }),
      v
    )) as { item: Item };
    expect(updated.item).toMatchObject({ name: 'Ribeye', basePrice: '150000' });
    expect(catalogOf(await read()).items.find((i) => i.itemId === updated.item.itemId)).toEqual(updated.item);

    // items/reorder
    v = await versionNow();
    const itemsReordered = (await applied(
      await post('items/reorder', {
        categoryId: mains.categoryId,
        expectedVersion: v,
        itemIds: [fish.itemId, created.item.itemId],
      }),
      v
    )) as { items: Item[] };
    expect(itemsReordered.items.map((i) => i.itemId)).toEqual([fish.itemId, created.item.itemId]);
    expect(
      catalogOf(await read()).items.filter((i) => i.categoryId === mains.categoryId && i.isActive)
    ).toEqual(itemsReordered.items);

    // items/archive and items/restore
    v = await versionNow();
    const archived = (await applied(await post('items/archive', { itemId: fish.itemId }), v)) as { item: Item };
    expect(archived.item.isActive).toBe(false);
    expect(catalogOf(await read()).items.find((i) => i.itemId === fish.itemId)).toEqual(archived.item);
    const restored = (await applied(await post('items/restore', { itemId: fish.itemId }), v + 1)) as { item: Item };
    expect(restored.item.isActive).toBe(true);
    expect(catalogOf(await read()).items.find((i) => i.itemId === fish.itemId)).toEqual(restored.item);

    // categories/archive and categories/restore
    v = await versionNow();
    const catArchived = (await applied(await post('categories/archive', { categoryId: drinks.categoryId }), v)) as {
      category: Category;
    };
    expect(catArchived.category.isActive).toBe(false);
    const catRestored = (await applied(await post('categories/restore', { categoryId: drinks.categoryId }), v + 1)) as {
      category: Category;
    };
    expect(catRestored.category.isActive).toBe(true);
    expect(catalogOf(await read()).categories.find((c) => c.categoryId === drinks.categoryId)).toEqual(
      catRestored.category
    );
  });

  it('11. an unchanged command answers 200 with the version unchanged and writes nothing', async () => {
    const category = await madeCategory('Mains');
    const item = await madeItem(category.categoryId, 'Soup');
    const gone = await madeItem(category.categoryId, 'Old');
    expect((await post('items/archive', { itemId: gone.itemId })).statusCode).toBe(200);
    const v = await versionNow();
    const before = await whole();

    const same: Array<[string, object]> = [
      ['categories/update', { categoryId: category.categoryId, expectedVersion: v, name: 'Mains' }],
      ['categories/reorder', { expectedVersion: v, categoryIds: [category.categoryId] }],
      ['categories/restore', { categoryId: category.categoryId }],
      ['items/update', { itemId: item.itemId, expectedVersion: v, changes: {} }],
      ['items/update', { itemId: item.itemId, expectedVersion: v, changes: { fields: { name: 'Soup', basePrice: '25000' } } }],
      ['items/reorder', { categoryId: category.categoryId, expectedVersion: v, itemIds: [item.itemId] }],
      ['items/archive', { itemId: gone.itemId }],
      ['items/restore', { itemId: item.itemId }],
    ];
    for (const [path, payload] of same) {
      const res = await post(path, payload);
      expect(res.statusCode, `${path}: ${res.body}`).toBe(200);
      expect((res.json() as { version: number }).version, path).toBe(v);
    }
    expect(await whole()).toEqual(before);
  });

  it('11. an items/update that swaps two variants\' names answers both with their new names', async () => {
    const { item } = await madeRichItem('Swap');
    const [small, large] = item.variants;
    const v = await versionNow();
    const res = await post('items/update', {
      itemId: item.itemId,
      expectedVersion: v,
      changes: {
        variants: {
          edited: [
            { id: small!.variantId, name: 'Large' },
            { id: large!.variantId, name: 'Small' },
          ],
        },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    const answered = (res.json() as { version: number; item: Item });
    expect(answered.version).toBe(v + 1);
    expect(answered.item.variants.map((x) => [x.variantId, x.name])).toEqual([
      [small!.variantId, 'Large'],
      [large!.variantId, 'Small'],
    ]);
    expect(catalogOf(await read()).items.find((i) => i.itemId === item.itemId)).toEqual(answered.item);
  });

  it('11. the read includes archived categories and items and removed options, each marked, and isAvailable on every item', async () => {
    const { category, item } = await madeRichItem('Marked');
    const old = await madeCategory('Old', true);
    const oldItem = await madeItem(category.categoryId, 'Retired');
    expect((await post('items/archive', { itemId: oldItem.itemId })).statusCode).toBe(200);
    const removed = await post('items/update', {
      itemId: item.itemId,
      expectedVersion: await versionNow(),
      changes: { variants: { removed: [item.variants[0]!.variantId] }, modifiers: { removed: [item.modifiers[0]!.modifierId] } },
    });
    expect(removed.statusCode, removed.body).toBe(200);

    const catalog = catalogOf(await read());
    expect(catalog.categories.find((c) => c.categoryId === old.categoryId)!.isActive).toBe(false);
    expect(catalog.items.find((i) => i.itemId === oldItem.itemId)!.isActive).toBe(false);
    const marked = catalog.items.find((i) => i.itemId === item.itemId)!;
    expect(marked.variants.map((x) => x.isActive)).toEqual([false, true]);
    expect(marked.modifiers.map((x) => x.isActive)).toEqual([false]);
    for (const i of catalog.items) expect(i.isAvailable, i.name).toBe(true);
  });

  it('11. the read of an empty catalog is version-bearing and empty', async () => {
    const catalog = catalogOf(await read());
    expect(catalog.categories).toEqual([]);
    expect(catalog.items).toEqual([]);
    expect(Number.isInteger(catalog.version)).toBe(true);
  });

  it('11. the read and the commands carry no-store', async () => {
    const res = await read();
    expect(res.headers['cache-control']).toBe('no-store');
    const created = await post('categories/create', { name: 'Cached?' });
    expect(created.headers['cache-control']).toBe('no-store');
  });
});

// ---- 13: the database's words never leave ------------------------------------------------------

describe('the log scan', () => {
  it('13. a refused DUPLICATE, a refused VALIDATION_FAILED and a stale update leave their markers in no log line and no response', async () => {
    const dupMarker = 'MARK-DUP-CATALOG-7731';
    const invalidMarker = 'MARK-INV-CATALOG-7732';
    const staleMarker = 'MARK-STALE-CATALOG-7733';
    const writes = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    });

    const category = await madeCategory('Mains');
    await madeItem(category.categoryId, dupMarker);
    const duplicate = await post('items/create', itemBody(category.categoryId, dupMarker));
    expect([duplicate.statusCode, duplicate.body]).toEqual([409, DUPLICATE]);

    const invalid = await post('categories/create', { name: `${invalidMarker}\u001b` });
    expect([invalid.statusCode, invalid.body]).toEqual([400, VALIDATION]);

    const target = await madeItem(category.categoryId, 'Target');
    const stale = await post('items/update', {
      itemId: target.itemId,
      expectedVersion: (await versionNow()) - 1,
      changes: { fields: { name: staleMarker } },
    });
    expect([stale.statusCode, stale.body]).toEqual([409, CATALOG_CHANGED]);
    writes.mockRestore();

    // PostgreSQL's `detail` quotes the name, lower-cased by the index expression. The
    // successful create's own answer names the item, as it should; the refusals do not.
    const everything = [...logLines, ...stdout, duplicate.body, invalid.body, stale.body].join('\n').toLowerCase();
    for (const marker of [invalidMarker, staleMarker]) expect(everything).not.toContain(marker.toLowerCase());
    // The one marker that was stored legitimately appears nowhere in a log line.
    expect([...logLines, ...stdout].join('\n').toLowerCase()).not.toContain(dupMarker.toLowerCase());
    expect(duplicate.body.toLowerCase()).not.toContain(dupMarker.toLowerCase());
    // The refusals themselves were logged, by code and without a message.
    for (const code of ['DUPLICATE', 'VALIDATION_FAILED', 'CATALOG_CHANGED']) {
      expect(logLines.some((l) => l.includes('request refused') && l.includes(code)), code).toBe(true);
    }
  });
});

// ---- 15: no audit entry ---------------------------------------------------------------------------

describe('the audit trail', () => {
  it('15. no catalog route writes an audit entry (a guard against a later change)', async () => {
    const before = await auditCount();
    await read();
    const { category, item } = await madeRichItem('Quiet');
    const v = await versionNow();
    await post('categories/update', { categoryId: category.categoryId, expectedVersion: v, name: 'Quieter' });
    await post('categories/reorder', { expectedVersion: v + 1, categoryIds: [category.categoryId] });
    await post('items/update', { itemId: item.itemId, expectedVersion: v + 1, changes: { fields: { name: 'Hush' } } });
    await post('items/reorder', { categoryId: category.categoryId, expectedVersion: v + 2, itemIds: [item.itemId] });
    await post('items/archive', { itemId: item.itemId });
    await post('items/restore', { itemId: item.itemId });
    await post('categories/archive', { categoryId: category.categoryId });
    await post('categories/restore', { categoryId: category.categoryId });
    // A refusal, a stale edit and an unknown id as well.
    await post('categories/create', { name: '' });
    await post('categories/update', { categoryId: category.categoryId, expectedVersion: 0, name: 'Stale' });
    await post('items/archive', { itemId: UNKNOWN_ID });
    expect(await auditCount()).toBe(before);
  });
});
