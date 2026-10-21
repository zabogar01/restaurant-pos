import { createHmac } from 'node:crypto';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ErrorBody, ROUTE_TABLE, SettingsReadView } from '@pos/contracts';
import { INSTALLATION_CURRENCY, INSTALLATION_MINOR_UNIT_PRECISION } from '@pos/money';
import { closePool } from '../src/db/pool.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';
import { auditCount, makePeople } from './support/people.js';
import { TEST_ORIGIN, inject } from './support/request.js';

// PHASE1-S2a: the settings_version record, the settings read and the save (ADR-012
// Part 1, consult C1 section 1). Every case is numbered by the task's S2-n.

const people = makePeople(680000);
const READ = '/api/back-office/config/settings';
const SAVE = '/api/back-office/config/settings/save';
const SETTINGS_CHANGED = '{"error":{"code":"SETTINGS_CHANGED"}}';
const VALIDATION = '{"error":{"code":"VALIDATION_FAILED"}}';
const UNAUTHENTICATED = '{"error":{"code":"UNAUTHENTICATED"}}';
const FORBIDDEN = '{"error":{"code":"FORBIDDEN"}}';
const CSRF_REFUSED = '{"error":{"code":"CSRF_REFUSED"}}';

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
  expect((await client.signInBackOffice(manager.username, manager.password)).statusCode).toBe(200);
});

// The table is append-only, so only the owner (a superuser-free owner connection that
// disables the trigger for the statement) can empty it between cases: drop and recreate
// the rows by resetting the table with the trigger off.
beforeEach(async () => {
  const owner = await ownerClient();
  try {
    await owner.query('ALTER TABLE settings_version DISABLE TRIGGER settings_version_immutable');
    await owner.query('DELETE FROM settings_version');
    await owner.query('ALTER TABLE settings_version ENABLE TRIGGER settings_version_immutable');
  } finally {
    await owner.end();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

// ---- the calls, as the manager's signed-in browser profile -----------------------

interface Values {
  taxRatePpm: unknown;
  serviceChargeRatePpm: unknown;
  outletName: unknown;
  address: unknown;
  phone: unknown;
  npwpd: unknown;
  footer: unknown;
}

const VALUES: Values = {
  taxRatePpm: '100000',
  serviceChargeRatePpm: '50000',
  outletName: 'Warung Contoh',
  address: 'Jl. Contoh 1\nBandung',
  phone: '+62 (22) 555-0100',
  npwpd: null,
  footer: 'Terima kasih',
};

const read = () => client.get(READ);
const save = (expectedVersion: unknown, over: Partial<Values> = {}, extra: Record<string, unknown> = {}) =>
  client.request({ method: 'POST', url: SAVE, payload: { expectedVersion, ...VALUES, ...over, ...extra } });

type Res = Awaited<ReturnType<typeof save>>;
const viewOf = (res: Res) => res.json() as SettingsReadView;

interface Row {
  version: number;
  tax_rate_ppm: string;
  service_rate_ppm: string;
  outlet_name: string;
  address: string;
  phone: string;
  npwpd: string | null;
  footer: string;
  calculation_policy: number;
  created_by: string;
  created_at: string;
}

/** Every stored column of every version, in order, as the owner reads them. */
const rows = () =>
  ownerQuery<Row>(
    `SELECT version, tax_rate_ppm::text, service_rate_ppm::text, outlet_name, address, phone, npwpd,
            footer, calculation_policy, created_by, created_at::text FROM settings_version ORDER BY version`
  );

/** A save that must succeed, for the cases that need a version to exist. */
async function saved(expectedVersion: number | null, over: Partial<Values> = {}): Promise<SettingsReadView> {
  const res = await save(expectedVersion, over);
  expect(res.statusCode, `save ${String(expectedVersion)}: ${res.body}`).toBe(200);
  return viewOf(res);
}

// ---- S2-9 to S2-17: the versions -------------------------------------------------

describe('the versions', () => {
  it('S2-9. the first save, carrying no number, writes version 1, which is then current', async () => {
    expect((await read()).json()).toEqual({
      installation: { currency: 'IDR', minorUnitPrecision: 0 },
      current: null,
    });
    const first = await saved(null);
    expect(first.current?.version).toBe(1);
    expect((await rows()).map((r) => r.version)).toEqual([1]);
    expect(viewOf(await read()).current?.version).toBe(1);
  });

  it('S2-10. a save with the current number writes the next, and every earlier version reads back column for column unchanged', async () => {
    await saved(null);
    const v1 = (await rows())[0]!;
    await saved(1, { taxRatePpm: '110000', outletName: 'Warung Baru' });
    await saved(2, { taxRatePpm: '110000', outletName: 'Warung Baru', phone: '0812 555 0101' });

    const all = await rows();
    expect(all.map((r) => r.version)).toEqual([1, 2, 3]);
    expect(all[0]).toEqual(v1);
    expect(all[1]).toMatchObject({ tax_rate_ppm: '110000', outlet_name: 'Warung Baru', phone: '+62 (22) 555-0100' });
    expect(all[2]).toMatchObject({ tax_rate_ppm: '110000', outlet_name: 'Warung Baru', phone: '0812 555 0101' });
    expect(viewOf(await read()).current?.version).toBe(3);
  });

  it('S2-11. a save carrying an older number is refused SETTINGS_CHANGED and writes nothing', async () => {
    await saved(null);
    await saved(1, { footer: 'Sampai jumpa' });
    const before = await rows();
    const stale = await save(1, { footer: 'Lain lagi' });
    expect([stale.statusCode, stale.body]).toEqual([409, SETTINGS_CHANGED]);
    expect(await rows()).toEqual(before);
    expect(viewOf(await read()).current?.version).toBe(2);
  });

  it('S2-11. a save carrying a number ahead of the current one is refused too', async () => {
    await saved(null);
    const before = await rows();
    const ahead = await save(5, { footer: 'Lain lagi' });
    expect([ahead.statusCode, ahead.body]).toEqual([409, SETTINGS_CHANGED]);
    expect(await rows()).toEqual(before);
  });

  it('S2-12. a save carrying no number when a version exists is refused SETTINGS_CHANGED', async () => {
    await saved(null);
    const before = await rows();
    const res = await save(null, { footer: 'Lain lagi' });
    expect([res.statusCode, res.body]).toEqual([409, SETTINGS_CHANGED]);
    expect(await rows()).toEqual(before);
  });

  it('S2-12. a save carrying a number when none exists is refused SETTINGS_CHANGED', async () => {
    const res = await save(1);
    expect([res.statusCode, res.body]).toEqual([409, SETTINGS_CHANGED]);
    expect(await rows()).toEqual([]);
  });

  it('S2-14. an identical submission writes nothing and answers the current version', async () => {
    const first = await saved(null);
    const before = await rows();
    const again = await save(1);
    expect(again.statusCode).toBe(200);
    expect(viewOf(again)).toEqual(first);
    expect(await rows()).toEqual(before);
  });

  it('S2-14. a stale submission whose values differ from the current version is refused and writes nothing', async () => {
    await saved(null);
    await saved(1, { footer: 'Sampai jumpa' });
    // These values equal version 1's, not version 2's, and the number is not the current one.
    const before = await rows();
    const res = await save(1);
    expect([res.statusCode, res.body]).toEqual([409, SETTINGS_CHANGED]);
    expect(await rows()).toEqual(before);
  });

  it('S2-14. a stale submission whose values equal the current version\'s is refused first, not answered as unchanged (ADR-012 rule 4)', async () => {
    await saved(null);
    await saved(1, { footer: 'Sampai jumpa' });
    const before = await rows();
    // Version 2 already holds these values, but the submission was built on version 1.
    const res = await save(1, { footer: 'Sampai jumpa' });
    expect([res.statusCode, res.body]).toEqual([409, SETTINGS_CHANGED]);
    expect(res.json()).toEqual({ error: { code: 'SETTINGS_CHANGED' } });
    expect(await rows()).toEqual(before);
    expect(viewOf(await read()).current?.version).toBe(2);
  });

  it('S2-15. a change of the footer alone writes a new version', async () => {
    await saved(null);
    const next = await saved(1, { footer: 'Sampai jumpa' });
    expect(next.current?.version).toBe(2);
    expect((await rows()).map((r) => r.footer)).toEqual(['Terima kasih', 'Sampai jumpa']);
  });

  it('S2-15. a change of each other field alone writes a new version, and a NPWPD set, changed and cleared does too', async () => {
    await saved(null);
    const changes: Partial<Values>[] = [
      { taxRatePpm: '110000' },
      { serviceChargeRatePpm: '0' },
      { outletName: 'Warung Lain' },
      { address: 'Jl. Lain 2' },
      { phone: '0812 555 0101' },
      { npwpd: '01.234.567.8-901.000' },
      { npwpd: '99.999.999.9-999.999' },
      { npwpd: null },
    ];
    let expected = 1;
    let state: Values = { ...VALUES };
    for (const change of changes) {
      state = { ...state, ...change };
      const res = await save(expected, state);
      expect(res.statusCode, JSON.stringify(change)).toBe(200);
      expect(viewOf(res).current?.version, JSON.stringify(change)).toBe(expected + 1);
      expected += 1;
    }
    expect((await rows()).map((r) => r.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('S2-16. a service-charge rate of 11 percent (110000) is stored (owner, Q3)', async () => {
    const res = await saved(null, { serviceChargeRatePpm: '110000' });
    expect(res.current?.serviceChargeRatePpm).toBe('110000');
    expect((await rows())[0]!.service_rate_ppm).toBe('110000');
  });

  it('S2-17. every written version has calculation_policy 1', async () => {
    await saved(null);
    await saved(1, { footer: 'Sampai jumpa' });
    expect((await rows()).map((r) => r.calculation_policy)).toEqual([1, 1]);
  });

  it('records the signed-in manager as created_by, whatever the request says', async () => {
    const other = await people.manager();
    const res = await save(null, {}, { createdBy: other.id });
    expect([res.statusCode, res.body]).toEqual([400, VALIDATION]);
    await saved(null);
    expect((await rows())[0]!.created_by).toBe(manager.id);
  });
});

// ---- S2-13: two saves at once ------------------------------------------------------

describe('two concurrent saves', () => {
  async function waitingBackends(): Promise<number> {
    const found = await ownerQuery<{ n: number }>(
      `SELECT count(DISTINCT pid)::int AS n FROM pg_stat_activity
        WHERE usename = 'pos_app' AND wait_event_type = 'Lock'`
    );
    return found[0]?.n ?? 0;
  }

  it('S2-13. the owner inserts version N+1 in an open transaction; a save expecting N waits, and is refused SETTINGS_CHANGED once the owner commits', async () => {
    await saved(null);
    const other = await ownerClient();
    let call: Promise<Res> | undefined;
    try {
      await other.query('BEGIN');
      await other.query(
        `INSERT INTO settings_version
           (version, tax_rate_ppm, service_rate_ppm, outlet_name, address, phone, npwpd, footer,
            calculation_policy, created_by)
         VALUES (2, 1, 1, 'Rival', 'Jl. Rival', '1', NULL, 'Rival', 1, $1)`,
        [manager.id]
      );
      call = save(1, { footer: 'Sampai jumpa' });
      let waiting = 0;
      for (let i = 0; i < 200 && waiting < 1; i++) {
        waiting = await waitingBackends();
        if (waiting < 1) await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(waiting, 'the save was waiting on the competing insert').toBe(1);
      await other.query('COMMIT');
    } finally {
      await other.end();
    }
    const answer = await call!;
    expect([answer.statusCode, answer.body]).toEqual([409, SETTINGS_CHANGED]);
    const all = await rows();
    expect(all.map((r) => r.version)).toEqual([1, 2]);
    expect(all[1]!.outlet_name).toBe('Rival');
  });

  it('S2-13. two saves of one number at once, both in flight behind a barrier, leave one version and one SETTINGS_CHANGED', async () => {
    await saved(null);
    const barrier = await ownerClient();
    let calls: Promise<Res>[] = [];
    try {
      await barrier.query('BEGIN');
      await barrier.query('LOCK TABLE settings_version IN ACCESS EXCLUSIVE MODE');
      calls = [save(1, { footer: 'Satu' }), save(1, { footer: 'Dua' })];
      let waiting = 0;
      for (let i = 0; i < 200 && waiting < 2; i++) {
        waiting = await waitingBackends();
        if (waiting < 2) await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(waiting, 'both saves were waiting when the barrier was released').toBe(2);
      await barrier.query('COMMIT');
    } finally {
      await barrier.end();
    }
    const answers = await Promise.all(calls);
    expect(answers.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(answers.find((r) => r.statusCode === 409)!.body).toBe(SETTINGS_CHANGED);
    expect((await rows()).map((r) => r.version)).toEqual([1, 2]);
  });
});

// ---- S2-18 is packages/money. S2-19: the boundary --------------------------------

describe('the boundary', () => {
  it('S2-19. a save the schema refuses is 400 VALIDATION_FAILED with no details, and writes nothing', async () => {
    await saved(null);
    const before = await rows();
    const bad: [string, () => Promise<Res>][] = [
      ['a rate as a JSON number', () => save(1, { taxRatePpm: 110000 })],
      ['a service rate as a JSON number', () => save(1, { serviceChargeRatePpm: 0 })],
      ['a rate of 1000001', () => save(1, { taxRatePpm: '1000001' })],
      ['a rate with a leading zero', () => save(1, { taxRatePpm: '01' })],
      ['a rate with an exponent', () => save(1, { taxRatePpm: '1e5' })],
      ['a negative rate', () => save(1, { taxRatePpm: '-1' })],
      ['a rate with a fraction', () => save(1, { taxRatePpm: '1.5' })],
      ['an empty rate', () => save(1, { taxRatePpm: '' })],
      ['a control character in the outlet name', () => save(1, { outletName: 'A\u001bB' })],
      ['a control character in the address', () => save(1, { address: 'A\u009bB' })],
      ['a control character in the phone', () => save(1, { phone: '1\u001b2' })],
      ['a control character in the NPWPD', () => save(1, { npwpd: 'P\u001b1' })],
      ['a control character in the footer', () => save(1, { footer: 'A\u001bB' })],
      ['an unknown field currency', () => save(1, {}, { currency: 'USD' })],
      ['an unknown field minorUnitPrecision', () => save(1, {}, { minorUnitPrecision: 2 })],
      ['an unknown field calculationPolicy', () => save(1, {}, { calculationPolicy: 2 })],
      ['an unknown field version', () => save(1, {}, { version: 9 })],
      ['an unknown field createdBy', () => save(1, {}, { createdBy: manager.id })],
      ['an expectedVersion of 0', () => save(0)],
      ['an expectedVersion of -1', () => save(-1)],
      ['an expectedVersion of 1.5', () => save(1.5)],
      ['an expectedVersion of "1"', () => save('1')],
      ['no body', () => client.request({ method: 'POST', url: SAVE })],
    ];
    for (const [name, send] of bad) {
      const res = await send();
      expect([res.statusCode, res.body], name).toEqual([400, VALIDATION]);
    }
    expect(await rows()).toEqual(before);
  });

  it('S2-20. a stale save answers 409 with the code alone, and the envelope validates against ErrorBody', async () => {
    await saved(null);
    const stale = await save(null);
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: { code: 'SETTINGS_CHANGED' } });
    expect(Object.keys((stale.json() as { error: object }).error)).toEqual(['code']);
    expect(ErrorBody.safeParse(stale.json()).success).toBe(true);
  });

  it('S2-21. the read reports the installation constants, not a stored value', async () => {
    const { installation } = viewOf(await read());
    expect(installation).toEqual({
      currency: INSTALLATION_CURRENCY,
      minorUnitPrecision: INSTALLATION_MINOR_UNIT_PRECISION,
    });
    await saved(null);
    expect(viewOf(await read()).installation).toEqual({
      currency: INSTALLATION_CURRENCY,
      minorUnitPrecision: INSTALLATION_MINOR_UNIT_PRECISION,
    });
  });
});

// ---- S2-22: the guard ----------------------------------------------------------------

describe('the two routes', () => {
  const entries = ROUTE_TABLE.filter((e) => e.path.startsWith(READ));

  it('S2-22. are the two of the route table, the read not interactive', () => {
    expect(entries.map((e) => `${e.method} ${e.path} ${e.interactive}`)).toEqual([
      `GET ${READ} false`,
      `POST ${SAVE} true`,
    ]);
  });

  const csrfOf = (token: string) => createHmac('sha256', token).update('rpos-csrf-v1').digest('base64url');

  it('S2-22. each refuses no cookie and a POS session in the cookie (401), a demoted manager (403) and, on the POST, a missing or wrong anti-CSRF header (403), writing nothing', async () => {
    await saved(null);
    const before = await rows();
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
          ...(entry.method === 'POST' ? { payload: { expectedVersion: 1, ...VALUES, footer: 'Refused' } } : {}),
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

    expect(await rows()).toEqual(before);
    expect(await auditCount()).toBe(audits);
  });
});

// ---- S2-23: what the save answers ---------------------------------------------------

describe('the answers', () => {
  it('S2-23. the save answers the full settings view, exactly as the following read returns it, with the signed-in manager\'s name', async () => {
    const first = await save(null);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual((await read()).json());
    expect(SettingsReadView.safeParse(first.json()).success).toBe(true);

    const current = viewOf(first).current!;
    expect(current.createdByName).toBe(manager.name);
    expect(current.version).toBe(1);
    expect(current.createdAt).toBe(new Date((await rows())[0]!.created_at).toISOString());
    expect(current).toMatchObject({
      taxRatePpm: '100000',
      serviceChargeRatePpm: '50000',
      outletName: 'Warung Contoh',
      address: 'Jl. Contoh 1\nBandung',
      phone: '+62 (22) 555-0100',
      npwpd: null,
      footer: 'Terima kasih',
    });
    expect(Object.keys(current).sort()).toEqual(
      ['address', 'createdAt', 'createdByName', 'footer', 'npwpd', 'outletName', 'phone', 'serviceChargeRatePpm', 'taxRatePpm', 'version'].sort()
    );

    const second = await save(1, { footer: 'Sampai jumpa' });
    expect(second.json()).toEqual((await read()).json());
    expect(viewOf(second).current?.version).toBe(2);
  });

  it('S2-23. an identical save answers the existing version, whose number equals expectedVersion, and the row count is unchanged', async () => {
    await saved(null);
    await saved(1, { footer: 'Sampai jumpa' });
    const known = viewOf(await read());
    const count = (await rows()).length;
    const again = await save(2, { footer: 'Sampai jumpa' });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(known);
    expect(viewOf(again).current?.version).toBe(2);
    expect((await rows()).length).toBe(count);
  });

  it('the read and the save carry no-store', async () => {
    expect((await read()).headers['cache-control']).toBe('no-store');
    expect((await save(null)).headers['cache-control']).toBe('no-store');
  });
});

// ---- S2-24: no audit entry ---------------------------------------------------------

describe('the audit trail', () => {
  it('S2-24. no settings route writes an audit entry (a guard against a later change)', async () => {
    const before = await auditCount();
    await read();
    await save(null);
    await save(null); // stale
    await save(1); // identical
    await save(1, { footer: 'Sampai jumpa' });
    await read();
    expect(await auditCount()).toBe(before);
  });
});

// ---- S2-25: the database's words and the business's text never leave -----------------

describe('the log scan', () => {
  it('S2-25. a save refused VALIDATION_FAILED whose outlet name carries a marker, and a stale save whose footer carries one, leave the marker in no log line and no response', async () => {
    const outletMarker = 'MARK-SETTINGS-OUTLET-7731';
    const footerMarker = 'MARK-SETTINGS-FOOTER-7732';
    await saved(null);

    const writes = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    });
    const invalid = await save(1, { outletName: `${outletMarker}\u001b` });
    const stale = await save(null, { footer: footerMarker });
    writes.mockRestore();

    expect([invalid.statusCode, invalid.body]).toEqual([400, VALIDATION]);
    expect([stale.statusCode, stale.body]).toEqual([409, SETTINGS_CHANGED]);

    const everything = [...logLines, ...stdout, invalid.body, stale.body].join('\n').toLowerCase();
    expect(everything).not.toContain(outletMarker.toLowerCase());
    expect(everything).not.toContain(footerMarker.toLowerCase());
    // Both refusals were logged, by code and without a message.
    expect(logLines.some((l) => l.includes('request refused') && l.includes('VALIDATION_FAILED'))).toBe(true);
    expect(logLines.some((l) => l.includes('request refused') && l.includes('SETTINGS_CHANGED'))).toBe(true);
  });
});
