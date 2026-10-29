import { createHmac } from 'node:crypto';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ErrorBody, ROUTE_TABLE } from '@pos/contracts';
import { closePool } from '../src/db/pool.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';
import { auditCount, makePeople } from './support/people.js';
import { TEST_ORIGIN, inject } from './support/request.js';

// PHASE1-S6a: the five preset routes on the preset domain (FR-B5; ADR-012 rules 10 and 13;
// consult C1 section 4). Cases are numbered by the task's acceptance criterion. The
// catalog_revision row is never reset between cases, so versions are asserted relative to
// the version read at the start of each case.

const people = makePeople(710000);
const BASE = '/api/back-office/config/catalog/presets';
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
  await ownerQuery('TRUNCATE discount_preset');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

// ---- the five calls, as the manager's signed-in browser profile ------------------------

const read = () => client.get(BASE);
const post = (path: string, payload: object) => client.request({ method: 'POST', url: `${BASE}/${path}`, payload });

type Res = Awaited<ReturnType<typeof read>>;

type Value = { kind: 'PERCENTAGE'; ratePpm: string } | { kind: 'FIXED'; amount: string };
interface Preset {
  presetId: string;
  name: string;
  value: Value;
  isActive: boolean;
}
interface Presets {
  version: number;
  presets: Preset[];
}

const PERCENT: Value = { kind: 'PERCENTAGE', ratePpm: '100000' };
const FIXED: Value = { kind: 'FIXED', amount: '5000' };

const presetsOf = (res: Res) => res.json() as Presets;
const versionNow = async () => presetsOf(await read()).version;

/** A preset made through the route; fails the case that needed it if it was not made. */
async function made(name: string, value: Value = PERCENT, inactive = false): Promise<Preset> {
  const res = await post('create', { name, value });
  expect(res.statusCode, `create ${name}: ${res.body}`).toBe(200);
  const { preset } = res.json() as { preset: Preset };
  if (inactive) expect((await post('deactivate', { presetId: preset.presetId })).statusCode).toBe(200);
  return { ...preset, isActive: !inactive };
}

const update = async (preset: Preset, changes: Partial<Pick<Preset, 'name' | 'value'>>, version?: number) =>
  post('update', {
    presetId: preset.presetId,
    expectedVersion: version ?? (await versionNow()),
    name: changes.name ?? preset.name,
    value: changes.value ?? preset.value,
  });

/** Every preset row and the version, with the transaction that last wrote it. */
async function whole(): Promise<string[]> {
  const out: string[] = [];
  for (const table of ['catalog_revision', 'discount_preset']) {
    const rows = await ownerQuery<{ r: string }>(
      `SELECT to_jsonb(t)::text || '|' || t.xmin::text AS r FROM ${table} t ORDER BY 1`
    );
    out.push(...rows.map((row) => `${table}:${row.r}`));
  }
  return out;
}

// ---- 11 and 12: the guard and the table ------------------------------------------------

describe('the five routes', () => {
  const entries = ROUTE_TABLE.filter((e) => e.path.startsWith(BASE));

  it('12. are the five of the route table, with the interactive the table gives', () => {
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

  const bodyFor = (path: string, presetId: string, version: number) => {
    switch (path.slice(BASE.length + 1)) {
      case 'create':
        return { name: 'Refused', value: PERCENT };
      case 'update':
        return { presetId, expectedVersion: version, name: 'Refused', value: PERCENT };
      default:
        return { presetId };
    }
  };

  it('11. each refuses no cookie and a POS session in the cookie (401), a demoted manager (403) and, on a POST, a missing or wrong anti-CSRF header (403), writing nothing', async () => {
    const preset = await made('Staff');
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
          ...(entry.method === 'POST' ? { payload: bodyFor(entry.path, preset.presetId, version) } : {}),
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

// ---- 4: the version ---------------------------------------------------------------------

describe('the catalog version', () => {
  it('4. create, edit, deactivate and reactivate each advance it by exactly one, and the answer carries the new version', async () => {
    const v0 = await versionNow();
    const created = await post('create', { name: 'Staff', value: PERCENT });
    expect(created.statusCode).toBe(200);
    expect((created.json() as { version: number }).version).toBe(v0 + 1);
    const preset = (created.json() as { preset: Preset }).preset;
    expect(await versionNow()).toBe(v0 + 1);

    const edited = await update(preset, { name: 'Staff meal', value: FIXED });
    expect([edited.statusCode, (edited.json() as { version: number }).version]).toEqual([200, v0 + 2]);

    const deactivated = await post('deactivate', { presetId: preset.presetId });
    expect([deactivated.statusCode, (deactivated.json() as { version: number }).version]).toEqual([200, v0 + 3]);

    const reactivated = await post('reactivate', { presetId: preset.presetId });
    expect([reactivated.statusCode, (reactivated.json() as { version: number }).version]).toEqual([200, v0 + 4]);
    expect(await versionNow()).toBe(v0 + 4);
  });

  it('4. a no-op edit, deactivating an inactive preset and reactivating an active one advance nothing, answer the current version and leave the row untouched', async () => {
    const active = await made('Active');
    const inactive = await made('Inactive', FIXED, true);
    const version = await versionNow();
    const before = await whole();

    const sameEdit = await update(active, {});
    expect([sameEdit.statusCode, (sameEdit.json() as { version: number }).version]).toEqual([200, version]);
    expect((sameEdit.json() as { preset: Preset }).preset).toEqual(active);

    const again = await post('deactivate', { presetId: inactive.presetId });
    expect([again.statusCode, (again.json() as { version: number }).version]).toEqual([200, version]);
    expect((again.json() as { preset: Preset }).preset).toEqual(inactive);

    const already = await post('reactivate', { presetId: active.presetId });
    expect([already.statusCode, (already.json() as { version: number }).version]).toEqual([200, version]);
    expect((already.json() as { preset: Preset }).preset).toEqual(active);

    expect(await whole()).toEqual(before);
  });

  it('4. a change of case alone, of kind alone or of value alone is a change', async () => {
    const preset = await made('Staff', PERCENT);
    const v0 = await versionNow();
    const renamed = await update(preset, { name: 'STAFF' });
    expect((renamed.json() as { version: number }).version).toBe(v0 + 1);
    const revalued = await update({ ...preset, name: 'STAFF' }, { value: { kind: 'PERCENTAGE', ratePpm: '100001' } });
    expect((revalued.json() as { version: number }).version).toBe(v0 + 2);
    const rekinded = await update({ ...preset, name: 'STAFF', value: { kind: 'PERCENTAGE', ratePpm: '100001' } }, { value: { kind: 'FIXED', amount: '100001' } });
    expect((rekinded.json() as { version: number }).version).toBe(v0 + 3);
  });
});

describe('CATALOG_CHANGED', () => {
  it('5. an update with a stale expectedVersion is 409 with a bare body and writes nothing', async () => {
    const preset = await made('Staff');
    await made('Other');
    const before = await whole();
    const behind = (await versionNow()) - 1;
    const res = await update(preset, { name: 'Renamed' }, behind);
    expect([res.statusCode, res.body]).toEqual([409, CATALOG_CHANGED]);
    expect(ErrorBody.safeParse(res.json()).success).toBe(true);
    expect(await whole()).toEqual(before);
  });

  it('5. a version ahead of the current one is stale too', async () => {
    const preset = await made('Staff');
    const res = await update(preset, { name: 'Renamed' }, (await versionNow()) + 1);
    expect([res.statusCode, res.body]).toEqual([409, CATALOG_CHANGED]);
  });

  it('5. deactivate and reactivate carry no version and succeed whatever the catalog has done since', async () => {
    const preset = await made('Staff');
    await made('Other');
    await made('Another');
    expect((await post('deactivate', { presetId: preset.presetId })).statusCode).toBe(200);
    await made('More');
    expect((await post('reactivate', { presetId: preset.presetId })).statusCode).toBe(200);
  });
});

// ---- 6 and 10: deactivation keeps the row; answers --------------------------------------

describe('what the routes answer', () => {
  it('6. deactivate keeps the row and the list still holds it, readable; reactivate restores it', async () => {
    const preset = await made('Staff', { kind: 'PERCENTAGE', ratePpm: '125000' });
    const deactivated = await post('deactivate', { presetId: preset.presetId });
    expect((deactivated.json() as { preset: Preset }).preset).toEqual({ ...preset, isActive: false });
    expect(presetsOf(await read()).presets).toEqual([{ ...preset, isActive: false }]);

    const reactivated = await post('reactivate', { presetId: preset.presetId });
    expect((reactivated.json() as { preset: Preset }).preset).toEqual({ ...preset, isActive: true });
    expect(presetsOf(await read()).presets).toEqual([{ ...preset, isActive: true }]);
  });

  it('10. each command answers the preset as committed, and the list that follows holds exactly that record at the version answered', async () => {
    const created = (await post('create', { name: 'Staff', value: PERCENT })).json() as { version: number; preset: Preset };
    expect(presetsOf(await read())).toEqual({ version: created.version, presets: [created.preset] });

    const edited = (await update(created.preset, { name: 'Staff meal', value: FIXED })).json() as { version: number; preset: Preset };
    expect(edited.preset).toEqual({ presetId: created.preset.presetId, name: 'Staff meal', value: FIXED, isActive: true });
    expect(presetsOf(await read())).toEqual({ version: edited.version, presets: [edited.preset] });

    const off = (await post('deactivate', { presetId: created.preset.presetId })).json() as { version: number; preset: Preset };
    expect(presetsOf(await read())).toEqual({ version: off.version, presets: [off.preset] });

    const on = (await post('reactivate', { presetId: created.preset.presetId })).json() as { version: number; preset: Preset };
    expect(presetsOf(await read())).toEqual({ version: on.version, presets: [on.preset] });
  });

  it('10. the list holds active and inactive presets in creation order, not name order', async () => {
    const b = await made('B');
    const a = await made('A', FIXED, true);
    const c = await made('C', { kind: 'FIXED', amount: '0' });
    expect(presetsOf(await read()).presets.map((p) => p.presetId)).toEqual([b.presetId, a.presetId, c.presetId]);
  });

  it('10. the read of an empty table is version-bearing and empty', async () => {
    const empty = presetsOf(await read());
    expect(empty.presets).toEqual([]);
    expect(Number.isInteger(empty.version)).toBe(true);
  });

  it('10. a value round-trips, and an edit from one kind to the other leaves the other column NULL', async () => {
    const percent = await made('Rate', { kind: 'PERCENTAGE', ratePpm: '125000' });
    const fixed = await made('Amount', { kind: 'FIXED', amount: '99999999' });
    expect(presetsOf(await read()).presets.map((p) => p.value)).toEqual([
      { kind: 'PERCENTAGE', ratePpm: '125000' },
      { kind: 'FIXED', amount: '99999999' },
    ]);
    expect(await ownerQuery('SELECT kind, rate_ppm, amount FROM discount_preset ORDER BY created_at, id')).toEqual([
      { kind: 'PERCENTAGE', rate_ppm: '125000', amount: null },
      { kind: 'FIXED', rate_ppm: null, amount: '99999999' },
    ]);

    await update(percent, { value: { kind: 'FIXED', amount: '0' } });
    await update(fixed, { value: { kind: 'PERCENTAGE', ratePpm: '1000000' } });
    expect(await ownerQuery('SELECT kind, rate_ppm, amount FROM discount_preset ORDER BY created_at, id')).toEqual([
      { kind: 'FIXED', rate_ppm: null, amount: '0' },
      { kind: 'PERCENTAGE', rate_ppm: '1000000', amount: null },
    ]);
  });

  it('10. an unknown presetId is 404 NOT_FOUND on update, deactivate and reactivate, writing nothing and leaving the version', async () => {
    await made('Staff');
    const before = await whole();
    const version = await versionNow();
    for (const [path, payload] of [
      ['update', { presetId: UNKNOWN_ID, expectedVersion: version, name: 'X', value: PERCENT }],
      ['deactivate', { presetId: UNKNOWN_ID }],
      ['reactivate', { presetId: UNKNOWN_ID }],
    ] as const) {
      const res = await post(path, payload);
      expect([res.statusCode, res.body], path).toEqual([404, NOT_FOUND]);
    }
    expect(await whole()).toEqual(before);
  });

  it('10. every answer is not cached', async () => {
    expect((await read()).headers['cache-control']).toBe('no-store');
    expect((await post('create', { name: 'Staff', value: PERCENT })).headers['cache-control']).toBe('no-store');
  });
});

// ---- 7: names ----------------------------------------------------------------------------

describe('names', () => {
  it('7. a create is bare DUPLICATE when an active preset holds the name in any case, and writes nothing', async () => {
    await made('Staff');
    const before = await whole();
    for (const name of ['Staff', 'staff', 'STAFF']) {
      const res = await post('create', { name, value: FIXED });
      expect([res.statusCode, res.body], name).toEqual([409, DUPLICATE]);
    }
    expect(await whole()).toEqual(before);
  });

  it('7. an edit of an active preset into a held name, in any case, is DUPLICATE and writes nothing', async () => {
    await made('Staff');
    const other = await made('Other');
    const before = await whole();
    for (const name of ['Staff', 'sTAFF']) {
      const res = await update(other, { name });
      expect([res.statusCode, res.body], name).toEqual([409, DUPLICATE]);
    }
    expect(await whole()).toEqual(before);
  });

  it('7. a reactivation into a held name is DUPLICATE and writes nothing', async () => {
    const old = await made('Staff', PERCENT, true);
    await made('staff');
    const before = await whole();
    const res = await post('reactivate', { presetId: old.presetId });
    expect([res.statusCode, res.body]).toEqual([409, DUPLICATE]);
    expect(await whole()).toEqual(before);
  });

  it('7. two inactive presets may share a name, and may share it with an active one', async () => {
    await made('Staff', PERCENT, true);
    await made('Staff', FIXED, true);
    await made('STAFF');
    expect(presetsOf(await read()).presets).toHaveLength(3);
  });

  it('7. an inactive preset may be edited to a name an active one holds, and a rename of its own case is no conflict', async () => {
    const inactive = await made('Old', PERCENT, true);
    await made('Staff');
    expect((await update(inactive, { name: 'Staff' })).statusCode).toBe(200);
    const mine = await made('Mine');
    expect((await update(mine, { name: 'MINE' })).statusCode).toBe(200);
  });

  it('7. the way out of a refused reactivation is to rename the inactive preset, then reactivate it', async () => {
    const old = await made('Staff', PERCENT, true);
    await made('Staff');
    expect((await post('reactivate', { presetId: old.presetId })).statusCode).toBe(409);
    expect((await update(old, { name: 'Staff old' })).statusCode).toBe(200);
    expect((await post('reactivate', { presetId: old.presetId })).statusCode).toBe(200);
  });
});

// ---- 8: concurrency -------------------------------------------------------------------------

describe('two concurrent writers', () => {
  // The backends of the application pool that are waiting on a lock, counted apart.
  async function waitingBackends(): Promise<number> {
    const rows = await ownerQuery<{ n: number }>(
      `SELECT count(DISTINCT pid)::int AS n FROM pg_stat_activity
        WHERE usename = 'pos_app' AND wait_event_type = 'Lock'`
    );
    return rows[0]?.n ?? 0;
  }

  // Both commands queue on the first statement of `catalogWrite`, the lock on
  // catalog_revision; the barrier is the owner holding that lock. Only when two distinct
  // pos_app backends are waiting does it commit, and the commands proceed together.
  async function raced(first: () => Promise<Res>, second: () => Promise<Res>) {
    const barrier = await ownerClient();
    try {
      await barrier.query('BEGIN');
      await barrier.query('SELECT version FROM catalog_revision FOR UPDATE');
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

  it('8. two creates of one name, both in flight behind a barrier, leave one row and one DUPLICATE, and the version advanced once', async () => {
    const v0 = await versionNow();
    const { waiting, answers } = await raced(
      () => post('create', { name: 'Race', value: PERCENT }),
      () => post('create', { name: 'Race', value: FIXED })
    );
    expect(waiting, 'both commands were waiting when the barrier was released').toBe(2);
    expect(answers.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(answers.find((r) => r.statusCode === 409)!.body).toBe(DUPLICATE);
    expect(presetsOf(await read()).presets).toHaveLength(1);
    expect(await versionNow()).toBe(v0 + 1);
  });
});

// ---- 9: the wire -------------------------------------------------------------------------------

describe('the wire', () => {
  const create = (name: unknown, value: unknown, more: object = {}) => post('create', { name, value, ...more });

  it('9. a malformed value, name, id or extra key is 400 VALIDATION_FAILED with no details, writing nothing', async () => {
    const preset = await made('Staff');
    const version = await versionNow();
    const before = await whole();

    const badValues: unknown[] = [
      { kind: 'PERCENTAGE', ratePpm: 100000 },
      { kind: 'FIXED', amount: 5000 },
      { kind: 'PERCENTAGE', ratePpm: '1000001' },
      { kind: 'PERCENTAGE', ratePpm: '010' },
      { kind: 'FIXED', amount: '100000000' },
      { kind: 'FIXED', amount: '-1' },
      { kind: 'FIXED', ratePpm: '100000' },
      { kind: 'PERCENTAGE', amount: '5000' },
      { kind: 'PERCENT', ratePpm: '100000' },
      { kind: 'PERCENTAGE', ratePpm: '100000', extra: true },
      { kind: 'FIXED', amount: '5000', ratePpm: '100000' },
      {},
    ];
    const badNames = ['', 'x'.repeat(33), '😀'.repeat(33), ' Staff', 'Staff ', 'St\u001baff', 'St\naff'];
    const attempts: Array<[string, object]> = [];
    for (const value of badValues) {
      attempts.push(['create', { name: 'Never', value }]);
      attempts.push(['update', { presetId: preset.presetId, expectedVersion: version, name: 'Never', value }]);
    }
    for (const name of badNames) {
      attempts.push(['create', { name, value: PERCENT }]);
      attempts.push(['update', { presetId: preset.presetId, expectedVersion: version, name, value: PERCENT }]);
    }
    attempts.push(
      ['create', { name: 'Never', value: PERCENT, isActive: true }],
      ['create', { name: 'Never' }],
      ['update', { presetId: 'nope', expectedVersion: version, name: 'Never', value: PERCENT }],
      ['update', { presetId: preset.presetId, name: 'Never', value: PERCENT }],
      ['update', { presetId: preset.presetId, expectedVersion: version, name: 'Never', value: PERCENT, extra: 1 }],
      ['deactivate', { presetId: 'nope' }],
      ['deactivate', { presetId: preset.presetId, expectedVersion: version }],
      ['reactivate', { presetId: 'nope' }],
      ['reactivate', { presetId: preset.presetId, extra: 1 }]
    );
    for (const [path, payload] of attempts) {
      const res = await post(path, payload);
      expect([res.statusCode, res.body], `${path} ${JSON.stringify(payload)}`).toEqual([400, VALIDATION]);
    }
    expect(await whole()).toEqual(before);
  });

  it('9. the bounds are accepted: a rate of 0 and 1000000, an amount of 0 and 99999999, and a 32-emoji name', async () => {
    for (const [name, value] of [
      ['Rate zero', { kind: 'PERCENTAGE', ratePpm: '0' }],
      ['Rate full', { kind: 'PERCENTAGE', ratePpm: '1000000' }],
      ['Amount zero', { kind: 'FIXED', amount: '0' }],
      ['Amount full', { kind: 'FIXED', amount: '99999999' }],
      ['😀'.repeat(32), PERCENT],
    ] as const) {
      const res = await create(name, value);
      expect([res.statusCode, res.json()], name).toMatchObject([200, { preset: { name, value } }]);
    }
  });
});

// ---- 13: the database's words never leave -----------------------------------------------------

describe('the log scan', () => {
  it('13. a create refused DUPLICATE leaves its marker in no log line and no response', async () => {
    const marker = 'MARK-DUP-PRESET-7741';
    const writes = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    });
    await made(marker);
    const duplicate = await post('create', { name: marker, value: FIXED });
    expect([duplicate.statusCode, duplicate.body]).toEqual([409, DUPLICATE]);
    writes.mockRestore();

    // PostgreSQL's `detail` quotes the name, lower-cased by the index expression. The
    // successful create's own answer names the preset, as it should; the refusal does not.
    expect([...logLines, ...stdout].join('\n').toLowerCase()).not.toContain(marker.toLowerCase());
    expect(duplicate.body.toLowerCase()).not.toContain(marker.toLowerCase());
    expect(logLines.some((l) => l.includes('request refused') && l.includes('DUPLICATE'))).toBe(true);
  });
});

// ---- 14: no audit entry ---------------------------------------------------------------------------

describe('the audit trail', () => {
  it('14. no preset route writes an audit entry (a guard against a later change)', async () => {
    const before = await auditCount();
    await read();
    const preset = await made('Staff');
    expect((await update(preset, { name: 'Staff meal' })).statusCode).toBe(200);
    expect((await post('deactivate', { presetId: preset.presetId })).statusCode).toBe(200);
    expect((await post('reactivate', { presetId: preset.presetId })).statusCode).toBe(200);
    expect(await auditCount()).toBe(before);
  });
});
