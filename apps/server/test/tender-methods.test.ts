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

// PHASE1-S3a: the tender_method record, its four commands, the list read and the five
// back-office routes (consult C2 section 8). Every case below is numbered by the task's
// acceptance criterion it proves.

const people = makePeople(690000);
const BASE = '/api/back-office/config/tender-methods';
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
  await ownerQuery('TRUNCATE tender_method');
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
const create = (name: unknown) => client.request({ method: 'POST', url: `${BASE}/create`, payload: { name } });
const update = (tenderMethodId: unknown, name: unknown) =>
  client.request({ method: 'POST', url: `${BASE}/update`, payload: { tenderMethodId, name } });
const deactivate = (tenderMethodId: unknown) =>
  client.request({ method: 'POST', url: `${BASE}/deactivate`, payload: { tenderMethodId } });
const reactivate = (tenderMethodId: unknown) =>
  client.request({ method: 'POST', url: `${BASE}/reactivate`, payload: { tenderMethodId } });

type Res = Awaited<ReturnType<typeof create>>;
interface Method {
  tenderMethodId: string;
  name: string;
  isActive: boolean;
}

/** The id of a method made through the route; fails the case that needed it if it was not made. */
async function made(name: string, active = true): Promise<string> {
  const created = await create(name);
  expect(created.statusCode, `create ${name}`).toBe(200);
  const { tenderMethodId } = (created.json() as { tenderMethod: Method }).tenderMethod;
  if (!active) expect((await deactivate(tenderMethodId)).statusCode).toBe(200);
  return tenderMethodId;
}

/** Every row, with the transaction that last wrote it, so an unwritten row is provable. */
async function whole(): Promise<string[]> {
  const rows = await ownerQuery<{ r: string }>(
    `SELECT to_jsonb(t)::text || '|' || t.xmin::text AS r FROM tender_method t ORDER BY created_at, id`
  );
  return rows.map((row) => row.r);
}

async function xminOf(tenderMethodId: string): Promise<string> {
  const rows = await ownerQuery<{ x: string }>('SELECT xmin::text AS x FROM tender_method WHERE id = $1', [
    tenderMethodId,
  ]);
  return rows[0]!.x;
}

/** What the committed row says, in the contract's shape. */
async function committed(tenderMethodId: string): Promise<Method> {
  const rows = await ownerQuery<{ id: string; name: string; is_active: boolean }>(
    'SELECT id, name, is_active FROM tender_method WHERE id = $1',
    [tenderMethodId]
  );
  const row = rows[0]!;
  return { tenderMethodId: row.id, name: row.name, isActive: row.is_active };
}

const methodOf = (res: Res) => (res.json() as { tenderMethod: Method }).tenderMethod;
const methodsOf = (res: Res) => (res.json() as { tenderMethods: Method[] }).tenderMethods;

// ---- 1 and 3: the declarations and the guard ------------------------------------

describe('the five routes', () => {
  const entries = ROUTE_TABLE.filter((e) => e.path.startsWith(BASE));

  it('1. are the five of the route table, each ACTIVE and BACK_OFFICE with the interactive the table gives', async () => {
    expect(entries.map((e) => `${e.method} ${e.path} ${e.interactive}`)).toEqual([
      `GET ${BASE} false`,
      `POST ${BASE}/create true`,
      `POST ${BASE}/update true`,
      `POST ${BASE}/deactivate true`,
      `POST ${BASE}/reactivate true`,
    ]);
  });

  // Independent of the production derivation, as session-guard.test.ts does it.
  const csrfOf = (token: string) => createHmac('sha256', token).update('rpos-csrf-v1').digest('base64url');

  const bodyFor = (path: string, tenderMethodId: string) => {
    if (path.endsWith('/create')) return { name: 'Refused' };
    if (path.endsWith('/update')) return { tenderMethodId, name: 'Refused' };
    return { tenderMethodId };
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

// ---- 4 is schema.test.ts. 5: the name is unique among active methods ------------

describe('the name', () => {
  it('5. create answers DUPLICATE for a name an active method holds, in any case, and writes nothing', async () => {
    await made('QRIS');
    const before = await whole();
    for (const name of ['QRIS', 'qris']) {
      const res = await create(name);
      expect([res.statusCode, res.body], name).toEqual([409, DUPLICATE]);
    }
    expect(await whole()).toEqual(before);
  });

  it('5. rename to a name an active method holds is DUPLICATE and writes nothing', async () => {
    await made('QRIS');
    const second = await made('GoPay');
    const before = await whole();
    for (const name of ['QRIS', 'qris']) {
      const res = await update(second, name);
      expect([res.statusCode, res.body], name).toEqual([409, DUPLICATE]);
    }
    expect(await whole()).toEqual(before);
    expect((await committed(second)).name).toBe('GoPay');
  });

  it('5. reactivation into a name an active method holds is DUPLICATE and writes nothing', async () => {
    const old = await made('QRIS', false);
    await made('qris');
    const before = await whole();
    const res = await reactivate(old);
    expect([res.statusCode, res.body]).toEqual([409, DUPLICATE]);
    expect(await whole()).toEqual(before);
    expect((await committed(old)).isActive).toBe(false);
  });

  it('5. two inactive methods may share a name, and an inactive method may be renamed to a name an active method holds', async () => {
    const first = await made('QRIS', false);
    const second = await made('QRIS', false);
    expect(first).not.toBe(second);
    await made('GoPay');

    const renamed = await update(first, 'GoPay');
    expect(renamed.statusCode).toBe(200);
    expect(methodOf(renamed)).toEqual({ tenderMethodId: first, name: 'GoPay', isActive: false });
    expect(methodsOf(await list()).filter((m) => m.name.toLowerCase() === 'gopay')).toHaveLength(2);

    // The way out of a refused reactivation: rename the inactive one, then reactivate it.
    expect((await reactivate(first)).body).toBe(DUPLICATE);
    expect((await update(first, 'OVO')).statusCode).toBe(200);
    expect((await reactivate(first)).statusCode).toBe(200);
  });

  it('5. a deactivated method frees its name for a new one', async () => {
    const old = await made('QRIS');
    expect((await deactivate(old)).statusCode).toBe(200);
    expect((await create('QRIS')).statusCode).toBe(200);
    expect((await create('QRIS')).body).toBe(DUPLICATE);
  });

  it('5. a custom method may be named Cash, cash or Card: those are fixed kinds, not rows (C2 section 8)', async () => {
    for (const name of ['Cash', 'cash', 'Card']) {
      await ownerQuery('TRUNCATE tender_method');
      const res = await create(name);
      expect([res.statusCode, methodOf(res).name], name).toEqual([200, name]);
    }
    // An ordinary method from then on: a second active "CARD" is a duplicate.
    expect((await create('CARD')).body).toBe(DUPLICATE);
  });
});

// ---- 6: two writers at once ---------------------------------------------------

describe('two concurrent writers', () => {
  // The backends of the application pool that are waiting on a lock, counted apart.
  async function waitingBackends(): Promise<number> {
    const rows = await ownerQuery<{ n: number }>(
      `SELECT count(DISTINCT pid)::int AS n FROM pg_stat_activity
        WHERE usename = 'pos_app' AND wait_event_type = 'Lock'`
    );
    return rows[0]?.n ?? 0;
  }

  /**
   * Starts two commands behind a barrier: the owner connection holds LOCK TABLE ...
   * IN EXCLUSIVE MODE, which conflicts with the ROW EXCLUSIVE an INSERT or UPDATE
   * takes and the ROW SHARE of SELECT ... FOR UPDATE, so both commands are in flight
   * and blocked on their first statement. Only when two distinct pos_app backends are
   * waiting does the barrier commit, and the commands proceed together. The barrier
   * is released in `finally`, so a failed wait cannot leave the table locked.
   */
  async function raced(first: () => Promise<Res>, second: () => Promise<Res>) {
    const barrier = await ownerClient();
    try {
      await barrier.query('BEGIN');
      await barrier.query('LOCK TABLE tender_method IN EXCLUSIVE MODE');
      const calls = [first(), second()];
      let waiting = 0;
      for (let i = 0; i < 200 && waiting < 2; i++) {
        waiting = await waitingBackends();
        if (waiting < 2) await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await barrier.query('COMMIT');
      return { waiting, answers: await Promise.all(calls) };
    } finally {
      await barrier.end();
    }
  }

  it('6. two creates of one name, both in flight behind a barrier, leave one row and one DUPLICATE', async () => {
    const { waiting, answers } = await raced(() => create('Race'), () => create('Race'));
    expect(waiting, 'both commands were waiting when the barrier was released').toBe(2);
    expect(answers.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(answers.find((r) => r.statusCode === 409)!.body).toBe(DUPLICATE);
    expect(await whole()).toHaveLength(1);
  });

  it('6. two reactivations of two inactive methods sharing a name, behind a barrier, leave one active and one DUPLICATE', async () => {
    const first = await made('Race', false);
    const second = await made('Race', false);
    const { waiting, answers } = await raced(() => reactivate(first), () => reactivate(second));
    expect(waiting, 'both commands were waiting when the barrier was released').toBe(2);
    expect(answers.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(answers.find((r) => r.statusCode === 409)!.body).toBe(DUPLICATE);
    const active = await ownerQuery('SELECT 1 FROM tender_method WHERE lower(name) = lower($1) AND is_active', [
      'Race',
    ]);
    expect(active).toHaveLength(1);
    expect(await whole()).toHaveLength(2);
  });
});

// ---- 7: the database's words never leave --------------------------------------

describe('the log scan', () => {
  it('7. a create refused DUPLICATE whose name is a marker leaves the marker in no log line and no response', async () => {
    const marker = 'MARK-DUP-TENDER-5521';
    const writes = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    });
    const first = await create(marker);
    expect(first.statusCode).toBe(200);
    const refused = await create(marker);
    expect([refused.statusCode, refused.body]).toEqual([409, DUPLICATE]);
    writes.mockRestore();

    // PostgreSQL's `detail` quotes the name, lower-cased by the index expression.
    const needle = marker.toLowerCase();
    // The first create's own answer names the method, as it should; the refusal does not.
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
  async function sentWhileHeld(tenderMethodId: string, send: () => Promise<Res>) {
    const other = await ownerClient();
    try {
      await other.query('BEGIN');
      await other.query('SELECT 1 FROM tender_method WHERE id = $1 FOR UPDATE', [tenderMethodId]);
      const call = send();
      const early = await within(call, 400);
      await other.query('COMMIT');
      return { waited: early === PENDING, answer: await call };
    } finally {
      await other.end();
    }
  }

  it('8. deactivating an already inactive method waits for another connection holding the row, then answers', async () => {
    const id = await made('Locked', false);
    const { waited, answer } = await sentWhileHeld(id, () => deactivate(id));
    expect(waited, 'the call returned while the row was locked').toBe(true);
    expect(answer.statusCode).toBe(200);
    expect(methodOf(answer)).toEqual({ tenderMethodId: id, name: 'Locked', isActive: false });
  });

  it('8. reactivating an already active method waits for another connection holding the row, then answers', async () => {
    const id = await made('Locked');
    const { waited, answer } = await sentWhileHeld(id, () => reactivate(id));
    expect(waited, 'the call returned while the row was locked').toBe(true);
    expect(answer.statusCode).toBe(200);
    expect(methodOf(answer)).toEqual({ tenderMethodId: id, name: 'Locked', isActive: true });
  });

  it('8. a rename to the same name waits for the row too', async () => {
    const id = await made('Locked');
    const { waited, answer } = await sentWhileHeld(id, () => update(id, 'Locked'));
    expect(waited, 'the call returned while the row was locked').toBe(true);
    expect(answer.statusCode).toBe(200);
  });
});

// ---- 9: a command that changes nothing writes nothing -------------------------

describe('the no-op rule', () => {
  it('9. deactivating an inactive method, reactivating an active one and renaming to the same name answer the record and do not write the row', async () => {
    const inactive = await made('Off', false);
    const active = await made('On');
    const before = await whole();
    const xmins = [await xminOf(inactive), await xminOf(active)];

    const off = await deactivate(inactive);
    expect(methodOf(off)).toEqual({ tenderMethodId: inactive, name: 'Off', isActive: false });
    const on = await reactivate(active);
    expect(methodOf(on)).toEqual({ tenderMethodId: active, name: 'On', isActive: true });
    const same = await update(active, 'On');
    expect(methodOf(same)).toEqual({ tenderMethodId: active, name: 'On', isActive: true });

    expect([await xminOf(inactive), await xminOf(active)]).toEqual(xmins);
    expect(await whole()).toEqual(before);
  });

  it('9. a change of case alone is a change and is written', async () => {
    const id = await made('on');
    const before = await xminOf(id);
    const res = await update(id, 'On');
    expect(methodOf(res).name).toBe('On');
    expect(await xminOf(id)).not.toBe(before);
  });
});

// ---- 10: what a command answers, and what it refuses ---------------------------

describe('the answers', () => {
  it('10. each command answers the record as committed, and the list then holds exactly that record', async () => {
    const created = await create('Bank transfer');
    expect(created.statusCode).toBe(200);
    const id = methodOf(created).tenderMethodId;
    expect(Object.keys(created.json() as object)).toEqual(['tenderMethod']);
    expect(Object.keys(methodOf(created)).sort()).toEqual(['isActive', 'name', 'tenderMethodId']);
    expect(methodOf(created)).toEqual({ tenderMethodId: id, name: 'Bank transfer', isActive: true });
    expect(methodOf(created)).toEqual(await committed(id));
    expect(methodsOf(await list())).toEqual([methodOf(created)]);

    const renamed = await update(id, 'Bank transfer BCA');
    expect(renamed.statusCode).toBe(200);
    expect(methodOf(renamed)).toEqual(await committed(id));
    expect(methodsOf(await list())).toEqual([methodOf(renamed)]);

    const off = await deactivate(id);
    expect(methodOf(off)).toEqual({ tenderMethodId: id, name: 'Bank transfer BCA', isActive: false });
    expect(methodOf(off)).toEqual(await committed(id));
    expect(methodsOf(await list())).toEqual([methodOf(off)]);

    const on = await reactivate(id);
    expect(methodOf(on)).toEqual({ tenderMethodId: id, name: 'Bank transfer BCA', isActive: true });
    expect(methodOf(on)).toEqual(await committed(id));
    expect(methodsOf(await list())).toEqual([methodOf(on)]);
  });

  it('10. the list is empty at first, holds active and inactive methods, and is in creation order', async () => {
    expect((await list()).json()).toEqual({ tenderMethods: [] });
    const a = await made('B');
    const b = await made('A', false);
    const c = await made('C');
    expect(methodsOf(await list()).map((m) => m.tenderMethodId)).toEqual([a, b, c]);
    expect(methodsOf(await list()).map((m) => m.isActive)).toEqual([true, false, true]);
  });

  it('10. an unknown tenderMethodId is 404 NOT_FOUND on update, deactivate and reactivate, and writes nothing', async () => {
    await made('QRIS');
    const before = await whole();
    for (const res of [
      await update(UNKNOWN_ID, 'GoPay'),
      await deactivate(UNKNOWN_ID),
      await reactivate(UNKNOWN_ID),
    ]) {
      expect([res.statusCode, res.body]).toEqual([404, NOT_FOUND]);
    }
    expect(await whole()).toEqual(before);
  });

  it('10. a malformed tenderMethodId, an empty, over-long, untrimmed, line-feed or control-character name and an extra key are each 400 VALIDATION_FAILED with no details', async () => {
    const id = await made('QRIS');
    const before = await whole();
    const post = (action: string, payload?: object) =>
      client.request({ method: 'POST', url: `${BASE}/${action}`, ...(payload === undefined ? {} : { payload }) });
    const bad: [string, () => Promise<Res>][] = [
      ['create: empty', () => create('')],
      ['create: 33 characters', () => create('x'.repeat(33))],
      ['create: 33 emoji', () => create('😀'.repeat(33))],
      ['create: leading space', () => create(' GoPay')],
      ['create: trailing space', () => create('GoPay ')],
      ['create: a tab inside', () => create('Go\tPay')],
      ['create: a line feed inside', () => create('Go\nPay')],
      ['create: a NUL', () => create('Go\u0000Pay')],
      ['create: an ESC', () => create('Go\u001bPay')],
      ['create: not a string', () => create(2)],
      ['create: no body', () => post('create')],
      ['create: an extra key', () => post('create', { name: 'GoPay', x: 1 })],
      ['update: empty', () => update(id, '')],
      ['update: untrimmed', () => update(id, 'GoPay ')],
      ['update: a malformed id', () => update('not-a-uuid', 'GoPay')],
      ['update: an extra key', () => post('update', { tenderMethodId: id, name: 'GoPay', x: 1 })],
      ['deactivate: a malformed id', () => deactivate('7')],
      ['deactivate: an extra key', () => post('deactivate', { tenderMethodId: id, x: 1 })],
      ['reactivate: a malformed id', () => reactivate('')],
      ['reactivate: no id', () => post('reactivate', {})],
    ];
    for (const [name, send] of bad) {
      const res = await send();
      expect([res.statusCode, res.body], name).toEqual([400, VALIDATION]);
    }
    expect(await whole()).toEqual(before);
  });

  it('10. a name of 32 characters, one of 32 emoji and one with inner spaces and punctuation are stored as given', async () => {
    for (const name of ['x'.repeat(32), '😀'.repeat(32), 'Bank  transfer (BCA)', 'Kartu ☕']) {
      expect(methodOf(await create(name)).name).toBe(name);
    }
  });

  it('10. the list read and the commands carry no-store', async () => {
    expect((await list()).headers['cache-control']).toBe('no-store');
    expect((await create('QRIS')).headers['cache-control']).toBe('no-store');
  });
});

// ---- 12: no audit entry -------------------------------------------------------

describe('the audit trail', () => {
  it('12. no tender method command writes an audit entry (a guard against a later change)', async () => {
    const before = await auditCount();
    const id = await made('QRIS');
    await update(id, 'GoPay');
    await deactivate(id);
    await reactivate(id);
    await list();
    await create('OVO').then(() => create('OVO'));
    expect(await auditCount()).toBe(before);
  });
});
