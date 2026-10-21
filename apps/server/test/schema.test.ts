import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool, query } from '../src/db/pool.js';
import { ownerQuery, resetDatabase } from './support/database.js';

// The Phase 0 core schema (ARCH-006). Every case starts from resetDatabase();
// nothing here cleans with DELETE, and audit_entry is only ever written to, and
// only touched by UPDATE, DELETE or TRUNCATE in the case that proves the
// trigger refuses them (B-7).

interface Refusal {
  code?: string;
  constraint?: string;
  message: string;
}

const PERMISSION_DENIED = '42501';
const NOT_NULL_VIOLATION = '23502';
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const RAISE_EXCEPTION = 'P0001';

/** Runs a statement that must fail and returns what PostgreSQL said. */
async function refusal(statement: Promise<unknown>): Promise<Refusal> {
  let outcome: Refusal | undefined;
  try {
    await statement;
  } catch (err) {
    outcome = err as Refusal;
  }
  if (!outcome) throw new Error('the statement succeeded; it was expected to be refused');
  return outcome;
}

/** The one row a query must have returned. */
function only<T>(rows: T[]): T {
  if (rows.length !== 1 || rows[0] === undefined) throw new Error(`expected one row, got ${rows.length}`);
  return rows[0];
}

const ARGON2 = '$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA';
let lookupCounter = 0;

/** A staff row, written through the owner connection. */
async function insertStaff(overrides: { role?: string; pin_hash?: string; pin_lookup?: string } = {}) {
  lookupCounter += 1;
  const rows = await ownerQuery<{ id: string }>(
    `INSERT INTO staff_user (name, role, pin_hash, pin_lookup)
     VALUES ('Test Staff', $1, $2, $3) RETURNING id`,
    [overrides.role ?? 'CASHIER', overrides.pin_hash ?? ARGON2, overrides.pin_lookup ?? `lookup-${lookupCounter}`]
  );
  return only(rows).id;
}

function auditInsert(actor: string | null, approver: string | null, outcome: string) {
  return ownerQuery(
    `INSERT INTO audit_entry (actor_id, approver_id, action, outcome) VALUES ($1, $2, 'TEST_ACTION', $3)`,
    [actor, approver, outcome]
  );
}

function sessionInsert(staffId: string, over: Record<string, unknown> = {}) {
  const row = {
    token_hash: Buffer.alloc(32, 1),
    audience: 'POS',
    credential_version: 1,
    absolute_expires_at: null,
    ...over,
  };
  return ownerQuery(
    `INSERT INTO actor_session (token_hash, audience, staff_user_id, credential_version, absolute_expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [row.token_hash, row.audience, staffId, row.credential_version, row.absolute_expires_at]
  );
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await getPool().end();
});

describe('privileges', () => {
  // Case 1. Written out table by table and column by column. A column entry is
  // a privilege held on that column alone; a table entry is held on the whole
  // table.
  const EXPECTED: Record<string, { table: string[]; columns: Record<string, string[]> }> = {
    staff_user: { table: ['INSERT', 'SELECT', 'UPDATE'], columns: {} },
    client_instance: { table: ['INSERT', 'SELECT', 'UPDATE'], columns: {} },
    actor_session: { table: ['INSERT', 'SELECT', 'UPDATE'], columns: {} },
    audit_entry: {
      table: [],
      columns: {
        actor_id: ['INSERT'],
        approver_id: ['INSERT'],
        action: ['INSERT'],
        outcome: ['INSERT'],
        subject_type: ['INSERT'],
        subject_id: ['INSERT'],
        reason: ['INSERT'],
        before_amount: ['INSERT'],
        after_amount: ['INSERT'],
      },
    },
    security_event: {
      table: [],
      columns: {
        event_type: ['INSERT'],
        throttle_class: ['INSERT'],
        client_instance_id: ['INSERT'],
      },
    },
    pin_throttle_bucket: {
      table: ['SELECT'],
      columns: { consecutive_failures: ['UPDATE'], blocked_until: ['UPDATE'] },
    },
    back_office_credential: {
      table: ['INSERT', 'SELECT'],
      columns: {
        password_hash: ['UPDATE'],
        consecutive_failures: ['UPDATE'],
        blocked_until: ['UPDATE'],
      },
    },
    dining_table: {
      table: ['INSERT', 'SELECT'],
      columns: { label: ['UPDATE'], is_active: ['UPDATE'] },
    },
    // S2-1: SELECT on the table, INSERT on each of the ten insertable columns, and no
    // UPDATE or DELETE anywhere; created_at is the database's alone.
    settings_version: {
      table: ['SELECT'],
      columns: {
        version: ['INSERT'],
        tax_rate_ppm: ['INSERT'],
        service_rate_ppm: ['INSERT'],
        outlet_name: ['INSERT'],
        address: ['INSERT'],
        phone: ['INSERT'],
        npwpd: ['INSERT'],
        footer: ['INSERT'],
        calculation_policy: ['INSERT'],
        created_by: ['INSERT'],
      },
    },
  };

  const TABLE_PRIVILEGES = ['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'];
  const COLUMN_PRIVILEGES = ['INSERT', 'REFERENCES', 'SELECT', 'UPDATE'];

  async function actualPrivileges() {
    const relations = await ownerQuery<{ name: string }>(
      `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f') ORDER BY c.relname`
    );
    const actual: Record<string, { table: string[]; columns: Record<string, string[]> }> = {};
    for (const { name } of relations) {
      const table = (
        await ownerQuery<{ priv: string }>(
          `SELECT p AS priv FROM unnest($2::text[]) AS p
            WHERE has_table_privilege('pos_app', $1::regclass, p) ORDER BY p`,
          [`public.${name}`, TABLE_PRIVILEGES]
        )
      ).map((r) => r.priv);
      const columns: Record<string, string[]> = {};
      const grants = await ownerQuery<{ column: string; priv: string }>(
        `SELECT a.attname AS column, p AS priv
           FROM pg_attribute a CROSS JOIN unnest($2::text[]) AS p
          WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
            AND has_column_privilege('pos_app', $1::regclass, a.attname, p)
          ORDER BY a.attnum, p`,
        [`public.${name}`, COLUMN_PRIVILEGES]
      );
      for (const g of grants) {
        // has_column_privilege is also true where the table grant covers the column.
        if (table.includes(g.priv)) continue;
        (columns[g.column] ??= []).push(g.priv);
      }
      actual[name] = { table, columns };
    }
    return actual;
  }

  it('gives pos_app exactly the privileges in the expected map, and only SELECT on schema_migration (case 1)', async () => {
    const actual = await actualPrivileges();

    expect(actual.schema_migration).toEqual({ table: ['SELECT'], columns: {} });

    // A table the map does not name fails here, whatever grants it has.
    const { schema_migration: _migration, ...application } = actual;
    expect(Object.keys(application).sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(application).toEqual(EXPECTED);

    // No grant on a sequence, either.
    const sequences = await ownerQuery<{ name: string; usage: boolean; sel: boolean; upd: boolean }>(
      `SELECT c.relname AS name,
              has_sequence_privilege('pos_app', c.oid, 'USAGE') AS usage,
              has_sequence_privilege('pos_app', c.oid, 'SELECT') AS sel,
              has_sequence_privilege('pos_app', c.oid, 'UPDATE') AS upd
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S'`
    );
    expect(sequences.length).toBeGreaterThan(0);
    for (const s of sequences) expect(s, s.name).toMatchObject({ usage: false, sel: false, upd: false });
  });

  it('makes pos_app the owner of nothing and gives it no CREATE on schema public (case 2)', async () => {
    const owned = await ownerQuery<{ name: string }>(
      `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND pg_get_userbyid(c.relowner) = 'pos_app'`
    );
    expect(owned).toEqual([]);

    const create = await ownerQuery<{ allowed: boolean }>(
      `SELECT has_schema_privilege('pos_app', 'public', 'CREATE') AS allowed`
    );
    expect(only(create).allowed).toBe(false);
  });

  it('lets pos_app insert into audit_entry and refuses UPDATE, DELETE, TRUNCATE and SELECT (case 3)', async () => {
    const actor = await insertStaff();
    await query(`INSERT INTO audit_entry (actor_id, action, outcome) VALUES ($1, 'TEST_ACTION', 'SUCCESS')`, [actor]);
    const stored = await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM audit_entry');
    expect(only(stored).n).toBe('1');

    for (const sql of [
      `UPDATE audit_entry SET reason = 'x'`,
      'DELETE FROM audit_entry',
      'TRUNCATE audit_entry',
      'SELECT * FROM audit_entry',
      'SELECT id FROM audit_entry',
    ]) {
      expect((await refusal(query(sql))).code, sql).toBe(PERMISSION_DENIED);
    }
  });

  it('refuses a pos_app insert into audit_entry that supplies occurred_at or id (case 4)', async () => {
    const actor = await insertStaff();

    const time = await refusal(
      query(
        `INSERT INTO audit_entry (actor_id, action, outcome, occurred_at) VALUES ($1, 'TEST_ACTION', 'SUCCESS', now())`,
        [actor]
      )
    );
    expect(time.code).toBe(PERMISSION_DENIED);

    // GENERATED ALWAYS refuses a supplied id before the privilege check is reached;
    // OVERRIDING SYSTEM VALUE gets past that, so the grant is what refuses it.
    const plain = await refusal(
      query(`INSERT INTO audit_entry (id, actor_id, action, outcome) VALUES (999, $1, 'TEST_ACTION', 'SUCCESS')`, [actor])
    );
    expect(plain.message).toContain('id');
    const overriding = await refusal(
      query(
        `INSERT INTO audit_entry (id, actor_id, action, outcome) OVERRIDING SYSTEM VALUE
         VALUES (999, $1, 'TEST_ACTION', 'SUCCESS')`,
        [actor]
      )
    );
    expect(overriding.code).toBe(PERMISSION_DENIED);

    const stored = await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM audit_entry');
    expect(only(stored).n).toBe('0');
  });

  it('gives security_event the same refusals and lets pos_app insert (case 5)', async () => {
    await query(`INSERT INTO security_event (event_type, throttle_class) VALUES ('PIN_FAILURE', 'LOGIN')`);
    const stored = await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM security_event');
    expect(only(stored).n).toBe('1');

    for (const sql of [
      `UPDATE security_event SET throttle_class = 'LOGIN'`,
      'DELETE FROM security_event',
      'TRUNCATE security_event',
      'SELECT * FROM security_event',
      `INSERT INTO security_event (event_type, throttle_class, occurred_at) VALUES ('PIN_FAILURE', 'LOGIN', now())`,
      `INSERT INTO security_event (id, event_type, throttle_class) OVERRIDING SYSTEM VALUE VALUES (999, 'PIN_FAILURE', 'LOGIN')`,
    ]) {
      expect((await refusal(query(sql))).code, sql).toBe(PERMISSION_DENIED);
    }
  });

  it('makes the trigger refuse UPDATE, DELETE and TRUNCATE on audit_entry, even for the owner (case 6)', async () => {
    const statements = [
      { sql: `UPDATE audit_entry SET reason = 'x'`, op: 'UPDATE' },
      { sql: 'DELETE FROM audit_entry', op: 'DELETE' },
      { sql: 'TRUNCATE audit_entry', op: 'TRUNCATE' },
    ];

    for (const { sql, op } of statements) {
      const failure = await refusal(ownerQuery(sql));
      expect(failure.code, `${sql} on an empty table`).toBe(RAISE_EXCEPTION);
      expect(failure.message).toContain(`${op} is not permitted (B-7)`);
    }

    const actor = await insertStaff();
    await auditInsert(actor, null, 'SUCCESS');
    for (const { sql, op } of statements) {
      const failure = await refusal(ownerQuery(sql));
      expect(failure.code, `${sql} on a table with a row`).toBe(RAISE_EXCEPTION);
      expect(failure.message).toContain(`${op} is not permitted (B-7)`);
    }

    const stored = await ownerQuery<{ n: string; reason: string | null }>(
      'SELECT count(*) AS n, max(reason) AS reason FROM audit_entry'
    );
    expect(only(stored)).toEqual({ n: '1', reason: null });
  });

  it('refuses pos_app INSERT, DELETE and a class rename on pin_throttle_bucket, and allows a counter update (case 7)', async () => {
    for (const sql of [
      `INSERT INTO pin_throttle_bucket (throttle_class) VALUES ('LOGIN')`,
      'DELETE FROM pin_throttle_bucket',
      `UPDATE pin_throttle_bucket SET throttle_class = 'MANAGER_APPROVAL' WHERE throttle_class = 'LOGIN'`,
    ]) {
      expect((await refusal(query(sql))).code, sql).toBe(PERMISSION_DENIED);
    }

    await query(`UPDATE pin_throttle_bucket SET consecutive_failures = 3 WHERE throttle_class = 'LOGIN'`);
    const rows = await ownerQuery<{ throttle_class: string; consecutive_failures: number }>(
      'SELECT throttle_class, consecutive_failures FROM pin_throttle_bucket ORDER BY throttle_class'
    );
    expect(rows).toEqual([
      { throttle_class: 'LOGIN', consecutive_failures: 3 },
      { throttle_class: 'MANAGER_APPROVAL', consecutive_failures: 0 },
    ]);
  });

  it('refuses pos_app DELETE on staff_user, actor_session and client_instance (case 8)', async () => {
    for (const table of ['staff_user', 'actor_session', 'client_instance']) {
      const failure = await refusal(query(`DELETE FROM ${table}`));
      expect(failure.code, table).toBe(PERMISSION_DENIED);
    }
  });
});

describe('audit entry and security event', () => {
  it('rejects a null actor_id on audit_entry (case 9)', async () => {
    const failure = await refusal(auditInsert(null, null, 'SUCCESS'));
    expect(failure.code).toBe(NOT_NULL_VIOLATION);
    expect(failure.message).toContain('actor_id');
  });

  it('rejects an approver on a failed, cancelled or throttled approval and accepts SUCCESS with or without one (case 10)', async () => {
    const actor = await insertStaff();
    const approver = await insertStaff({ role: 'MANAGER' });

    for (const outcome of ['APPROVAL_FAILED', 'APPROVAL_CANCELLED', 'APPROVAL_THROTTLED']) {
      const failure = await refusal(auditInsert(actor, approver, outcome));
      expect(failure.code, outcome).toBe(CHECK_VIOLATION);
      expect(failure.constraint, outcome).toBe('audit_entry_unapproved_outcome_check');
      // Without an approver the same outcome is accepted.
      await auditInsert(actor, null, outcome);
    }

    await auditInsert(actor, approver, 'SUCCESS');
    await auditInsert(actor, null, 'SUCCESS');
    const stored = await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM audit_entry');
    expect(only(stored).n).toBe('5');
  });

  it('rejects an outcome outside the four (case 11)', async () => {
    const actor = await insertStaff();
    for (const outcome of ['REFUSED', 'SUCCEEDED', '']) {
      const failure = await refusal(auditInsert(actor, null, outcome));
      expect(failure.constraint, outcome).toBe('audit_entry_outcome_check');
    }
  });

  it('has exactly the columns written here on audit_entry and security_event (case 12)', async () => {
    const columns = async (table: string) =>
      (
        await ownerQuery<{ column_name: string; data_type: string; is_nullable: string }>(
          `SELECT column_name, data_type, is_nullable FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [table]
        )
      ).map((c) => `${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);

    expect(await columns('audit_entry')).toEqual([
      'id bigint NOT NULL',
      'actor_id uuid NOT NULL',
      'approver_id uuid NULL',
      'action text NOT NULL',
      'outcome text NOT NULL',
      'subject_type text NULL',
      'subject_id text NULL',
      'reason text NULL',
      'before_amount bigint NULL',
      'after_amount bigint NULL',
      'occurred_at timestamp with time zone NOT NULL',
    ]);
    expect(await columns('security_event')).toEqual([
      'id bigint NOT NULL',
      'event_type text NOT NULL',
      'throttle_class text NOT NULL',
      'client_instance_id uuid NULL',
      'occurred_at timestamp with time zone NOT NULL',
    ]);
  });

  it('gives security_event no foreign key to staff_user (case 13)', async () => {
    const references = await ownerQuery<{ referenced: string }>(
      `SELECT confrelid::regclass::text AS referenced FROM pg_constraint
        WHERE contype = 'f' AND conrelid = 'public.security_event'::regclass`
    );
    expect(references.map((r) => r.referenced)).toEqual(['client_instance']);
  });
});

describe('types', () => {
  it('has no floating-point, numeric or money column, and keeps bigint amounts exact (case 14)', async () => {
    const forbidden = await ownerQuery<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (data_type IN ('real', 'double precision', 'numeric', 'money')
               OR udt_name IN ('float4', 'float8', 'numeric', 'money'))`
    );
    expect(forbidden).toEqual([]);

    const amounts = await ownerQuery<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_entry'
          AND column_name IN ('before_amount', 'after_amount') ORDER BY column_name`
    );
    expect(amounts).toEqual([
      { column_name: 'after_amount', data_type: 'bigint' },
      { column_name: 'before_amount', data_type: 'bigint' },
    ]);

    // 2^53 + 1 is the first integer a double cannot hold.
    const beyondDouble = '9007199254740993';
    const actor = await insertStaff();
    await query(
      `INSERT INTO audit_entry (actor_id, action, outcome, before_amount, after_amount)
       VALUES ($1, 'TEST_ACTION', 'SUCCESS', $2, $2)`,
      [actor, beyondDouble]
    );
    const stored = await ownerQuery<{ before_amount: string; after_amount: string }>(
      'SELECT before_amount, after_amount FROM audit_entry'
    );
    expect(stored).toEqual([{ before_amount: beyondDouble, after_amount: beyondDouble }]);
  });
});

describe('identity', () => {
  it('rejects a duplicate pin_lookup on staff_user (case 15)', async () => {
    await insertStaff({ pin_lookup: 'same' });
    const failure = await refusal(insertStaff({ pin_lookup: 'same' }));
    expect(failure.code).toBe(UNIQUE_VIOLATION);
    expect(failure.constraint).toBe('staff_user_active_pin_lookup_key');
  });

  it('accepts the same pin_lookup on two rows when one is inactive (case 15)', async () => {
    const first = await insertStaff({ pin_lookup: 'same' });
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [first]);
    await insertStaff({ pin_lookup: 'same' });
    const rows = await ownerQuery<{ n: string }>(
      `SELECT count(*) AS n FROM staff_user WHERE pin_lookup = 'same'`
    );
    expect(only(rows).n).toBe('2');
  });

  it('rejects KITCHEN as a staff_user role (case 16)', async () => {
    const failure = await refusal(insertStaff({ role: 'KITCHEN' }));
    expect(failure.constraint).toBe('staff_user_role_check');
  });

  it('rejects a pin_hash that is not an Argon2id encoded hash (case 17)', async () => {
    for (const pin_hash of ['1234', '$argon2i$v=19$abc', '$2b$10$abcdefghijklmnopqrstuv']) {
      const failure = await refusal(insertStaff({ pin_hash }));
      expect(failure.constraint, pin_hash).toBe('staff_user_pin_hash_check');
    }
  });

  it('starts credential_version at 1 on a new staff_user row (case 18)', async () => {
    const id = await insertStaff();
    const rows = await ownerQuery<{ credential_version: number }>(
      'SELECT credential_version FROM staff_user WHERE id = $1',
      [id]
    );
    expect(only(rows).credential_version).toBe(1);
  });

  it('rejects an actor_session insert without credential_version (case 19)', async () => {
    const staff = await insertStaff();
    const failure = await refusal(
      ownerQuery(
        `INSERT INTO actor_session (token_hash, audience, staff_user_id) VALUES ($1, 'POS', $2)`,
        [Buffer.alloc(32, 1), staff]
      )
    );
    expect(failure.code).toBe(NOT_NULL_VIOLATION);
    expect(failure.message).toContain('credential_version');
  });

  it('rejects an unknown audience, a BACK_OFFICE session with no expiry and a duplicate token_hash (case 20)', async () => {
    const staff = await insertStaff();

    const audience = await refusal(sessionInsert(staff, { audience: 'KITCHEN' }));
    expect(audience.constraint).toBe('actor_session_audience_check');

    const noExpiry = await refusal(sessionInsert(staff, { audience: 'BACK_OFFICE' }));
    expect(noExpiry.constraint).toBe('actor_session_back_office_expiry_check');

    await sessionInsert(staff, { audience: 'BACK_OFFICE', absolute_expires_at: new Date(Date.now() + 3_600_000) });
    await sessionInsert(staff, { token_hash: Buffer.alloc(32, 2) });
    const duplicate = await refusal(sessionInsert(staff, { token_hash: Buffer.alloc(32, 2) }));
    expect(duplicate.code).toBe(UNIQUE_VIOLATION);
    expect(duplicate.constraint).toBe('actor_session_token_hash_key');
  });
});

describe('dining_table', () => {
  const insert = (label: string, active = true) =>
    ownerQuery<{ id: string }>('INSERT INTO dining_table (label, is_active) VALUES ($1, $2) RETURNING id', [
      label,
      active,
    ]);

  it('is empty after migration (B-24) (S1a case 4)', async () => {
    expect(await ownerQuery('SELECT 1 FROM dining_table')).toEqual([]);
  });

  it('has exactly the columns written here (S1a case 4)', async () => {
    const columns = (
      await ownerQuery<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'dining_table' ORDER BY ordinal_position`
      )
    ).map(
      (c) =>
        `${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${c.column_default}`
    );
    expect(columns).toEqual([
      'id uuid NOT NULL gen_random_uuid()',
      'label text NOT NULL null',
      'is_active boolean NOT NULL true',
      'created_at timestamp with time zone NOT NULL now()',
    ]);
  });

  it('lets pos_app insert, read and update label and is_active, and refuses DELETE, TRUNCATE and an update of id or created_at (S1a case 4)', async () => {
    const [row] = await query<{ id: string }>(`INSERT INTO dining_table (label) VALUES ('T1') RETURNING id`);
    await query(`UPDATE dining_table SET label = 'T2', is_active = false WHERE id = $1`, [row!.id]);
    expect(await query('SELECT label, is_active FROM dining_table')).toEqual([{ label: 'T2', is_active: false }]);

    for (const sql of [
      'DELETE FROM dining_table',
      'TRUNCATE dining_table',
      `UPDATE dining_table SET id = gen_random_uuid()`,
      `UPDATE dining_table SET created_at = now()`,
    ]) {
      expect((await refusal(query(sql))).code, sql).toBe(PERMISSION_DENIED);
    }
  });

  it('refuses a label that is empty, over 32 characters, or has leading or trailing whitespace (S1a case 4)', async () => {
    for (const label of ['', 'x'.repeat(33), ' T1', 'T1 ', '\tT1', 'T1\n']) {
      const failure = await refusal(insert(label));
      expect(failure.code, JSON.stringify(label)).toBe(CHECK_VIOLATION);
      expect(failure.constraint, JSON.stringify(label)).toBe('dining_table_label_check');
    }
    await insert('x'.repeat(32));
    await insert('Bar 2');
  });

  it('holds one active table per label in any case, and any number of inactive ones (S1a case 5)', async () => {
    await insert('T1');
    for (const label of ['T1', 't1']) {
      const failure = await refusal(insert(label));
      expect(failure.code, label).toBe(UNIQUE_VIOLATION);
      expect(failure.constraint, label).toBe('dining_table_active_label_key');
    }
    await insert('T1', false);
    await insert('t1', false);
    await insert('T2', false);
    const count = await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM dining_table');
    expect(only(count).n).toBe('4');
  });
});

describe('settings_version', () => {
  const GOOD = {
    tax: 100000,
    service: 0,
    outlet: 'Warung Contoh',
    address: 'Jl. Contoh 1\nBandung',
    phone: '+62 (22) 555-0100',
    npwpd: null as string | null,
    footer: 'Terima kasih',
  };
  let manager: string;

  /** Written through the owner connection, so the trigger and the checks are all that refuse it. */
  const insert = (over: Partial<Record<keyof typeof GOOD | 'version' | 'policy', unknown>> = {}) => {
    const row = { version: 1, policy: 1, ...GOOD, ...over };
    return ownerQuery(
      `INSERT INTO settings_version
         (version, tax_rate_ppm, service_rate_ppm, outlet_name, address, phone, npwpd, footer,
          calculation_policy, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [row.version, row.tax, row.service, row.outlet, row.address, row.phone, row.npwpd, row.footer, row.policy, manager]
    );
  };

  beforeEach(async () => {
    manager = await insertStaff({ role: 'MANAGER' });
  });

  it('is empty after migration (B-24) (S2-8)', async () => {
    expect(await ownerQuery('SELECT 1 FROM settings_version')).toEqual([]);
  });

  it('has exactly the columns written here, and no currency or precision column (S2-6)', async () => {
    const columns = (
      await ownerQuery<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'settings_version' ORDER BY ordinal_position`
      )
    ).map(
      (c) =>
        `${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${c.column_default}`
    );
    expect(columns).toEqual([
      'version integer NOT NULL null',
      'tax_rate_ppm bigint NOT NULL null',
      'service_rate_ppm bigint NOT NULL null',
      'outlet_name text NOT NULL null',
      'address text NOT NULL null',
      'phone text NOT NULL null',
      'npwpd text NULL null',
      'footer text NOT NULL null',
      'calculation_policy smallint NOT NULL null',
      'created_by uuid NOT NULL null',
      'created_at timestamp with time zone NOT NULL now()',
    ]);
  });

  it('refuses UPDATE, DELETE and TRUNCATE to pos_app as permission denied, and an insert that supplies created_at (S2-2)', async () => {
    await insert();
    for (const sql of [
      `UPDATE settings_version SET footer = 'x'`,
      'DELETE FROM settings_version',
      'TRUNCATE settings_version',
    ]) {
      expect((await refusal(query(sql))).code, sql).toBe(PERMISSION_DENIED);
    }
    const supplied = await refusal(
      query(
        `INSERT INTO settings_version
           (version, tax_rate_ppm, service_rate_ppm, outlet_name, address, phone, footer,
            calculation_policy, created_by, created_at)
         VALUES (2, 0, 0, 'A', 'B', '1', 'F', 1, $1, now())`,
        [manager]
      )
    );
    expect(supplied.code).toBe(PERMISSION_DENIED);
  });

  it('refuses UPDATE, DELETE and TRUNCATE to the owner by the trigger, with the table empty and with a row (S2-3)', async () => {
    const statements = [
      `UPDATE settings_version SET footer = 'x'`,
      'DELETE FROM settings_version',
      'TRUNCATE settings_version',
    ];
    for (const sql of statements) {
      const failure = await refusal(ownerQuery(sql));
      expect([failure.code, failure.message], `empty: ${sql}`).toEqual([RAISE_EXCEPTION, expect.stringContaining('immutable')]);
    }
    await insert();
    for (const sql of statements) {
      const failure = await refusal(ownerQuery(sql));
      expect([failure.code, failure.message], `with a row: ${sql}`).toEqual([RAISE_EXCEPTION, expect.stringContaining('immutable')]);
    }
    expect(only(await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM settings_version')).n).toBe('1');
  });

  it('holds each rate to 0 to 1,000,000 parts per million (S2-4)', async () => {
    for (const [column, key, constraint] of [
      ['tax', 'tax', 'settings_version_tax_rate_check'],
      ['service', 'service', 'settings_version_service_rate_check'],
    ] as const) {
      for (const bad of [-1, 1000001]) {
        const failure = await refusal(insert({ [key]: bad }));
        expect([failure.code, failure.constraint], `${column} ${bad}`).toEqual([CHECK_VIOLATION, constraint]);
      }
    }
    await insert({ version: 1, tax: 0, service: 1000000 });
    await insert({ version: 2, tax: 1000000, service: 0 });
  });

  it('refuses version 0, a duplicate version and calculation_policy 2 (S2-5)', async () => {
    expect((await refusal(insert({ version: 0 }))).constraint).toBe('settings_version_version_check');
    expect((await refusal(insert({ policy: 2 }))).constraint).toBe('settings_version_policy_check');
    await insert();
    const duplicate = await refusal(insert());
    expect([duplicate.code, duplicate.constraint]).toEqual([UNIQUE_VIOLATION, 'settings_version_pkey']);
  });

  // S2-7. [[:cntrl:]] is spelled out and proved here, not assumed: it must match the C1
  // controls (U+0085, U+009B) under this database's encoding and collation.
  it('refuses a blank or untrimmed text and a control character, and holds each length (S2-7)', async () => {
    const refused: [string, Partial<Parameters<typeof insert>[0]>, string][] = [
      ['outlet: blank', { outlet: ' ' }, 'settings_version_outlet_name_check'],
      ['outlet: empty', { outlet: '' }, 'settings_version_outlet_name_check'],
      ['outlet: leading space', { outlet: ' A' }, 'settings_version_outlet_name_check'],
      ['outlet: trailing space', { outlet: 'A ' }, 'settings_version_outlet_name_check'],
      ['outlet: 65 characters', { outlet: 'x'.repeat(65) }, 'settings_version_outlet_name_check'],
      ['outlet: ESC', { outlet: 'A\u001bB' }, 'settings_version_outlet_name_check'],
      ['outlet: U+009B', { outlet: 'A\u009bB' }, 'settings_version_outlet_name_check'],
      ['outlet: U+0085', { outlet: 'A\u0085B' }, 'settings_version_outlet_name_check'],
      ['outlet: DEL', { outlet: 'A\u007fB' }, 'settings_version_outlet_name_check'],
      ['outlet: a line feed', { outlet: 'A\nB' }, 'settings_version_outlet_name_check'],
      ['outlet: a tab', { outlet: 'A\tB' }, 'settings_version_outlet_name_check'],
      ['address: empty', { address: '' }, 'settings_version_address_check'],
      ['address: 201 characters', { address: 'x'.repeat(201) }, 'settings_version_address_check'],
      ['address: trailing line feed', { address: 'A\n' }, 'settings_version_address_check'],
      ['address: a third line feed', { address: 'A\nB\nC\nD' }, 'settings_version_address_check'],
      ['address: a carriage return', { address: 'A\r\nB' }, 'settings_version_address_check'],
      ['address: ESC', { address: 'A\u001bB' }, 'settings_version_address_check'],
      ['address: U+009B', { address: 'A\u009bB' }, 'settings_version_address_check'],
      ['address: a tab', { address: 'A\tB' }, 'settings_version_address_check'],
      ['phone: empty', { phone: '' }, 'settings_version_phone_check'],
      ['phone: 33 characters', { phone: '1'.repeat(33) }, 'settings_version_phone_check'],
      ['phone: a slash', { phone: '022/555' }, 'settings_version_phone_check'],
      ['phone: a letter', { phone: '022 555 x' }, 'settings_version_phone_check'],
      ['phone: an Arabic-Indic digit', { phone: '٢٢٢' }, 'settings_version_phone_check'],
      ['phone: leading space', { phone: ' 022' }, 'settings_version_phone_check'],
      ['phone: a line feed', { phone: '022\n' }, 'settings_version_phone_check'],
      ['npwpd: blank string', { npwpd: '' }, 'settings_version_npwpd_check'],
      ['npwpd: whitespace only', { npwpd: '  ' }, 'settings_version_npwpd_check'],
      ['npwpd: 33 characters', { npwpd: 'x'.repeat(33) }, 'settings_version_npwpd_check'],
      ['npwpd: trailing space', { npwpd: 'P.1 ' }, 'settings_version_npwpd_check'],
      ['npwpd: ESC', { npwpd: 'P\u001b1' }, 'settings_version_npwpd_check'],
      ['npwpd: U+009B', { npwpd: 'P\u009b1' }, 'settings_version_npwpd_check'],
      ['footer: empty', { footer: '' }, 'settings_version_footer_check'],
      ['footer: blank', { footer: '   ' }, 'settings_version_footer_check'],
      ['footer: 121 characters', { footer: 'x'.repeat(121) }, 'settings_version_footer_check'],
      ['footer: untrimmed', { footer: ' Terima kasih' }, 'settings_version_footer_check'],
      ['footer: a line feed', { footer: 'A\nB' }, 'settings_version_footer_check'],
      ['footer: ESC', { footer: 'A\u001bB' }, 'settings_version_footer_check'],
    ];
    for (const [name, over, constraint] of refused) {
      const failure = await refusal(insert(over));
      expect([failure.code, failure.constraint], name).toEqual([CHECK_VIOLATION, constraint]);
    }

    // The null columns: a null NPWPD is accepted, a null phone is not.
    await insert({ version: 1, npwpd: null });
    expect((await refusal(insert({ version: 2, phone: null }))).code).toBe(NOT_NULL_VIOLATION);
    expect((await refusal(insert({ version: 2, footer: null }))).code).toBe(NOT_NULL_VIOLATION);

    // The longest accepted values, and a line feed in the address (two of them).
    await insert({
      version: 2,
      outlet: 'x'.repeat(64),
      address: `${'x'.repeat(100)}\n${'y'.repeat(96)}\nz`,
      phone: '1'.repeat(32),
      npwpd: 'n'.repeat(32),
      footer: 'f'.repeat(120),
    });
    await insert({ version: 3, address: 'A\nB\nC', phone: '+62 (22) 555-0100.', npwpd: '01.234.567.8-901.000' });
  });
});

describe('throttle', () => {
  it('holds exactly the LOGIN and MANAGER_APPROVAL buckets (case 21)', async () => {
    const rows = await ownerQuery<{ throttle_class: string }>(
      'SELECT throttle_class FROM pin_throttle_bucket ORDER BY throttle_class'
    );
    expect(rows.map((r) => r.throttle_class)).toEqual(['LOGIN', 'MANAGER_APPROVAL']);
  });
});
