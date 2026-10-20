import { createHmac } from 'node:crypto';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ROUTE_TABLE } from '@pos/contracts';
import { closePool } from '../src/db/pool.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';
import { auditCount, makePeople } from './support/people.js';
import { TEST_ORIGIN, inject } from './support/request.js';

// PHASE1-S1a: the dining_table record, its four commands, the list read and the five
// back-office routes (consult C2). Every case below is numbered by the task's
// acceptance criterion it proves.

const people = makePeople(670000);
const BASE = '/api/back-office/config/tables';
const DUPLICATE = '{"error":{"code":"DUPLICATE"}}';
const NOT_FOUND = '{"error":{"code":"NOT_FOUND"}}';
const VALIDATION = '{"error":{"code":"VALIDATION_FAILED"}}';
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
  await ownerQuery('TRUNCATE dining_table');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

// ---- the five calls, as the manager's signed-in browser profile -----------------

const list = () => client.get(BASE);
const create = (label: unknown) => client.request({ method: 'POST', url: `${BASE}/create`, payload: { label } });
const update = (tableId: unknown, label: unknown) =>
  client.request({ method: 'POST', url: `${BASE}/update`, payload: { tableId, label } });
const deactivate = (tableId: unknown) =>
  client.request({ method: 'POST', url: `${BASE}/deactivate`, payload: { tableId } });
const reactivate = (tableId: unknown) =>
  client.request({ method: 'POST', url: `${BASE}/reactivate`, payload: { tableId } });

type Res = Awaited<ReturnType<typeof create>>;
interface Table {
  tableId: string;
  label: string;
  isActive: boolean;
}

/** The id of a table made through the route; fails the case that needed it if it was not made. */
async function made(label: string, active = true): Promise<string> {
  const created = await create(label);
  expect(created.statusCode, `create ${label}`).toBe(200);
  const { tableId } = (created.json() as { table: Table }).table;
  if (!active) expect((await deactivate(tableId)).statusCode).toBe(200);
  return tableId;
}

/** Every row, with the transaction that last wrote it, so an unwritten row is provable. */
async function whole(): Promise<string[]> {
  const rows = await ownerQuery<{ r: string }>(
    `SELECT to_jsonb(t)::text || '|' || t.xmin::text AS r FROM dining_table t ORDER BY created_at, id`
  );
  return rows.map((row) => row.r);
}

async function xminOf(tableId: string): Promise<string> {
  const rows = await ownerQuery<{ x: string }>('SELECT xmin::text AS x FROM dining_table WHERE id = $1', [tableId]);
  return rows[0]!.x;
}

/** What the committed row says, in the contract's shape. */
async function committed(tableId: string): Promise<Table> {
  const rows = await ownerQuery<{ id: string; label: string; is_active: boolean }>(
    'SELECT id, label, is_active FROM dining_table WHERE id = $1',
    [tableId]
  );
  const row = rows[0]!;
  return { tableId: row.id, label: row.label, isActive: row.is_active };
}

const tableOf = (res: Res) => (res.json() as { table: Table }).table;
const tablesOf = (res: Res) => (res.json() as { tables: Table[] }).tables;

// ---- 1 and 3: the declarations and the guard ------------------------------------

describe('the five routes', () => {
  const entries = ROUTE_TABLE.filter((e) => e.path.startsWith(BASE));

  it('1. are the five of the route table, each ACTIVE and BACK_OFFICE with the interactive the table gives', async () => {
    expect(entries.map((e) => `${e.method} ${e.path}`)).toEqual([
      `GET ${BASE}`,
      `POST ${BASE}/create`,
      `POST ${BASE}/update`,
      `POST ${BASE}/deactivate`,
      `POST ${BASE}/reactivate`,
    ]);
  });

  // Independent of the production derivation, as session-guard.test.ts does it.
  const csrfOf = (token: string) => createHmac('sha256', token).update('rpos-csrf-v1').digest('base64url');

  const bodyFor = (path: string, tableId: string) => {
    if (path.endsWith('/create')) return { label: 'Refused' };
    if (path.endsWith('/update')) return { tableId, label: 'Refused' };
    return { tableId };
  };

  it('3. each refuses no cookie and a POS session in the cookie (401), a demoted manager (403) and, on a POST, a missing or wrong anti-CSRF header (403), writing nothing', async () => {
    const target = await made('Target');
    const before = await whole();
    const audits = await auditCount();
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
          ...(entry.method === 'POST' ? { payload: bodyFor(entry.path, target) } : {}),
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
    expect(await auditCount()).toBe(audits);
  });
});

// ---- 4 is schema.test.ts. 5: the label is unique among active tables ------------

describe('the label', () => {
  it('5. create answers DUPLICATE for a label an active table holds, in any case, and writes nothing', async () => {
    await made('T1');
    const before = await whole();
    for (const label of ['T1', 't1']) {
      const res = await create(label);
      expect([res.statusCode, res.body], label).toEqual([409, DUPLICATE]);
    }
    expect(await whole()).toEqual(before);
  });

  it('5. rename to a label an active table holds is DUPLICATE and writes nothing', async () => {
    await made('T1');
    const second = await made('T2');
    const before = await whole();
    for (const label of ['T1', 't1']) {
      const res = await update(second, label);
      expect([res.statusCode, res.body], label).toEqual([409, DUPLICATE]);
    }
    expect(await whole()).toEqual(before);
    expect((await committed(second)).label).toBe('T2');
  });

  it('5. reactivation into a label an active table holds is DUPLICATE and writes nothing', async () => {
    const old = await made('T1', false);
    await made('t1');
    const before = await whole();
    const res = await reactivate(old);
    expect([res.statusCode, res.body]).toEqual([409, DUPLICATE]);
    expect(await whole()).toEqual(before);
    expect((await committed(old)).isActive).toBe(false);
  });

  it('5. two inactive tables may share a label, and an inactive table may be renamed to a label an active table holds', async () => {
    const first = await made('T1', false);
    const second = await made('T1', false);
    expect(first).not.toBe(second);
    await made('T3');

    const renamed = await update(first, 'T3');
    expect(renamed.statusCode).toBe(200);
    expect(tableOf(renamed)).toEqual({ tableId: first, label: 'T3', isActive: false });
    expect(tablesOf(await list()).filter((t) => t.label.toLowerCase() === 't3')).toHaveLength(2);

    // The way out of a refused reactivation: rename the inactive one, then reactivate it.
    expect((await reactivate(first)).body).toBe(DUPLICATE);
    expect((await update(first, 'T4')).statusCode).toBe(200);
    expect((await reactivate(first)).statusCode).toBe(200);
  });

  it('5. a deactivated table frees its label for a new one', async () => {
    const old = await made('T1');
    expect((await deactivate(old)).statusCode).toBe(200);
    expect((await create('T1')).statusCode).toBe(200);
    expect((await create('T1')).body).toBe(DUPLICATE);
  });
});

// ---- 6: two writers at once ---------------------------------------------------

describe('two concurrent writers', () => {
  it('6. two creates of one label leave one row and one DUPLICATE', async () => {
    for (const label of ['Race A', 'Race B', 'Race C', 'Race D']) {
      const [a, b] = await Promise.all([create(label), create(label)]);
      expect([a.statusCode, b.statusCode].sort(), label).toEqual([200, 409]);
      expect([a, b].find((r) => r.statusCode === 409)!.body).toBe(DUPLICATE);
    }
    const rows = await whole();
    expect(rows).toHaveLength(4);
  });

  it('6. two reactivations of two inactive tables sharing a label leave one active and one DUPLICATE', async () => {
    for (const label of ['Race A', 'Race B', 'Race C', 'Race D']) {
      const first = await made(label, false);
      const second = await made(label, false);
      const [a, b] = await Promise.all([reactivate(first), reactivate(second)]);
      expect([a.statusCode, b.statusCode].sort(), label).toEqual([200, 409]);
      expect([a, b].find((r) => r.statusCode === 409)!.body).toBe(DUPLICATE);
      const active = await ownerQuery(
        'SELECT 1 FROM dining_table WHERE lower(label) = lower($1) AND is_active',
        [label]
      );
      expect(active, label).toHaveLength(1);
    }
  });
});

// ---- 7: the database's words never leave --------------------------------------

describe('the log scan', () => {
  it('7. a create refused DUPLICATE whose label is a marker leaves the marker in no log line and no response', async () => {
    const marker = 'MARK-DUP-LABEL-5521';
    const writes = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    });
    const first = await create(marker);
    expect(first.statusCode).toBe(200);
    const refused = await create(marker);
    expect([refused.statusCode, refused.body]).toEqual([409, DUPLICATE]);
    writes.mockRestore();

    // PostgreSQL's `detail` quotes the label, lower-cased by the index expression.
    const needle = marker.toLowerCase();
    // The first create's own answer names the label, as it should; the refusal does not.
    const everything = [...logLines, ...stdout, refused.body].join('\n').toLowerCase();
    expect(everything).not.toContain(needle);
    // The refusal itself was logged, by code and without a message.
    expect(logLines.some((l) => l.includes('request refused') && l.includes('DUPLICATE'))).toBe(true);
  });
});

// ---- 8: the locking read comes before the decision ----------------------------

describe('the locking read', () => {
  const PENDING = Symbol('pending');
  const within = async <T>(call: Promise<T>, ms: number): Promise<T | typeof PENDING> =>
    Promise.race([call, new Promise<typeof PENDING>((resolve) => setTimeout(() => resolve(PENDING), ms))]);

  /**
   * Sends a call while another connection holds the row `FOR UPDATE`, and says whether
   * the call had returned by a deadline the test sets. The other connection commits
   * before anything is asserted, so a call that wrongly returned early cannot leave
   * the row locked for the cases after it.
   */
  async function sentWhileHeld(tableId: string, send: () => Promise<Res>) {
    const other = await ownerClient();
    try {
      await other.query('BEGIN');
      await other.query('SELECT 1 FROM dining_table WHERE id = $1 FOR UPDATE', [tableId]);
      const call = send();
      const early = await within(call, 400);
      await other.query('COMMIT');
      return { waited: early === PENDING, answer: await call };
    } finally {
      await other.end();
    }
  }

  it('8. deactivating an already inactive table waits for another connection holding the row, then answers', async () => {
    const id = await made('Locked', false);
    const { waited, answer } = await sentWhileHeld(id, () => deactivate(id));
    expect(waited, 'the call returned while the row was locked').toBe(true);
    expect(answer.statusCode).toBe(200);
    expect(tableOf(answer)).toEqual({ tableId: id, label: 'Locked', isActive: false });
  });

  it('8. reactivating an already active table waits for another connection holding the row, then answers', async () => {
    const id = await made('Locked');
    const { waited, answer } = await sentWhileHeld(id, () => reactivate(id));
    expect(waited, 'the call returned while the row was locked').toBe(true);
    expect(answer.statusCode).toBe(200);
    expect(tableOf(answer)).toEqual({ tableId: id, label: 'Locked', isActive: true });
  });

  it('8. a rename to the same label waits for the row too', async () => {
    const id = await made('Locked');
    const { waited, answer } = await sentWhileHeld(id, () => update(id, 'Locked'));
    expect(waited, 'the call returned while the row was locked').toBe(true);
    expect(answer.statusCode).toBe(200);
  });
});

// ---- 9: a command that changes nothing writes nothing -------------------------

describe('the no-op rule', () => {
  it('9. deactivating an inactive table, reactivating an active one and renaming to the same label answer the record and do not write the row', async () => {
    const inactive = await made('Off', false);
    const active = await made('On');
    const before = await whole();
    const xmins = [await xminOf(inactive), await xminOf(active)];

    const off = await deactivate(inactive);
    expect(tableOf(off)).toEqual({ tableId: inactive, label: 'Off', isActive: false });
    const on = await reactivate(active);
    expect(tableOf(on)).toEqual({ tableId: active, label: 'On', isActive: true });
    const same = await update(active, 'On');
    expect(tableOf(same)).toEqual({ tableId: active, label: 'On', isActive: true });

    expect([await xminOf(inactive), await xminOf(active)]).toEqual(xmins);
    expect(await whole()).toEqual(before);
  });

  it('9. a change of case alone is a change and is written', async () => {
    const id = await made('on');
    const before = await xminOf(id);
    const res = await update(id, 'On');
    expect(tableOf(res).label).toBe('On');
    expect(await xminOf(id)).not.toBe(before);
  });
});

// ---- 10: what a command answers, and what it refuses ---------------------------

describe('the answers', () => {
  it('10. each command answers the record as committed, and the list then holds exactly that record', async () => {
    const created = await create('Terrace 12');
    expect(created.statusCode).toBe(200);
    const id = tableOf(created).tableId;
    expect(Object.keys(created.json() as object)).toEqual(['table']);
    expect(Object.keys(tableOf(created)).sort()).toEqual(['isActive', 'label', 'tableId']);
    expect(tableOf(created)).toEqual({ tableId: id, label: 'Terrace 12', isActive: true });
    expect(tableOf(created)).toEqual(await committed(id));
    expect(tablesOf(await list())).toEqual([tableOf(created)]);

    const renamed = await update(id, 'Terrace 13');
    expect(renamed.statusCode).toBe(200);
    expect(tableOf(renamed)).toEqual(await committed(id));
    expect(tablesOf(await list())).toEqual([tableOf(renamed)]);

    const off = await deactivate(id);
    expect(tableOf(off)).toEqual({ tableId: id, label: 'Terrace 13', isActive: false });
    expect(tableOf(off)).toEqual(await committed(id));
    expect(tablesOf(await list())).toEqual([tableOf(off)]);

    const on = await reactivate(id);
    expect(tableOf(on)).toEqual({ tableId: id, label: 'Terrace 13', isActive: true });
    expect(tableOf(on)).toEqual(await committed(id));
    expect(tablesOf(await list())).toEqual([tableOf(on)]);
  });

  it('10. the list is empty at first, holds active and inactive tables, and is in creation order', async () => {
    expect((await list()).json()).toEqual({ tables: [] });
    const a = await made('B');
    const b = await made('A', false);
    const c = await made('C');
    expect(tablesOf(await list()).map((t) => t.tableId)).toEqual([a, b, c]);
    expect(tablesOf(await list()).map((t) => t.isActive)).toEqual([true, false, true]);
  });

  it('10. an unknown tableId is 404 NOT_FOUND on update, deactivate and reactivate, and writes nothing', async () => {
    await made('T1');
    const before = await whole();
    for (const res of [await update(UNKNOWN_ID, 'T2'), await deactivate(UNKNOWN_ID), await reactivate(UNKNOWN_ID)]) {
      expect([res.statusCode, res.body]).toEqual([404, NOT_FOUND]);
    }
    expect(await whole()).toEqual(before);
  });

  it('10. a malformed tableId, an empty, over-long, untrimmed or control-character label and an extra key are each 400 VALIDATION_FAILED with no details', async () => {
    const id = await made('T1');
    const before = await whole();
    const bad: [string, () => Promise<Res>][] = [
      ['create: empty', () => create('')],
      ['create: 33 characters', () => create('x'.repeat(33))],
      ['create: leading space', () => create(' T2')],
      ['create: trailing space', () => create('T2 ')],
      ['create: a tab inside', () => create('T\t2')],
      ['create: a NUL', () => create('T\u00002')],
      ['create: not a string', () => create(2)],
      ['create: no body', () => client.request({ method: 'POST', url: `${BASE}/create` })],
      ['create: an extra key', () => client.request({ method: 'POST', url: `${BASE}/create`, payload: { label: 'T2', x: 1 } })],
      ['update: empty', () => update(id, '')],
      ['update: untrimmed', () => update(id, 'T2 ')],
      ['update: a malformed id', () => update('not-a-uuid', 'T2')],
      ['update: an extra key', () => client.request({ method: 'POST', url: `${BASE}/update`, payload: { tableId: id, label: 'T2', x: 1 } })],
      ['deactivate: a malformed id', () => deactivate('7')],
      ['deactivate: an extra key', () => client.request({ method: 'POST', url: `${BASE}/deactivate`, payload: { tableId: id, x: 1 } })],
      ['reactivate: a malformed id', () => reactivate('')],
      ['reactivate: no id', () => client.request({ method: 'POST', url: `${BASE}/reactivate`, payload: {} })],
    ];
    for (const [name, send] of bad) {
      const res = await send();
      expect([res.statusCode, res.body], name).toEqual([400, VALIDATION]);
    }
    expect(await whole()).toEqual(before);
  });

  it('10. a label of 32 characters and one with inner spaces and punctuation are stored as given', async () => {
    for (const label of ['x'.repeat(32), 'Bar  2 (patio)', 'Taman ☕']) {
      expect(tableOf(await create(label)).label).toBe(label);
    }
  });

  it('10. the list read and the commands carry no-store', async () => {
    expect((await list()).headers['cache-control']).toBe('no-store');
    expect((await create('T1')).headers['cache-control']).toBe('no-store');
  });
});

// ---- 11: no audit entry -------------------------------------------------------

describe('the audit trail', () => {
  it('11. no table command writes an audit entry (a guard against a later change)', async () => {
    const before = await auditCount();
    const id = await made('T1');
    await update(id, 'T2');
    await deactivate(id);
    await reactivate(id);
    await list();
    await create('T2').then(() => create('T2'));
    expect(await auditCount()).toBe(before);
  });
});
