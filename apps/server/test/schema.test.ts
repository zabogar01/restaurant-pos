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

  it('gives pos_app exactly the privileges in the expected map, and none on schema_migration (case 1)', async () => {
    const actual = await actualPrivileges();

    expect(actual.schema_migration).toEqual({ table: [], columns: {} });

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

  it('rejects an approver on a failed or cancelled approval and accepts SUCCESS with or without one (case 10)', async () => {
    const actor = await insertStaff();
    const approver = await insertStaff({ role: 'MANAGER' });

    for (const outcome of ['APPROVAL_FAILED', 'APPROVAL_CANCELLED']) {
      const failure = await refusal(auditInsert(actor, approver, outcome));
      expect(failure.code, outcome).toBe(CHECK_VIOLATION);
      expect(failure.constraint, outcome).toBe('audit_entry_unapproved_outcome_check');
      // Without an approver the same outcome is accepted.
      await auditInsert(actor, null, outcome);
    }

    await auditInsert(actor, approver, 'SUCCESS');
    await auditInsert(actor, null, 'SUCCESS');
    const stored = await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM audit_entry');
    expect(only(stored).n).toBe('4');
  });

  it('rejects an outcome outside the three (case 11)', async () => {
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

describe('throttle', () => {
  it('holds exactly the LOGIN and MANAGER_APPROVAL buckets (case 21)', async () => {
    const rows = await ownerQuery<{ throttle_class: string }>(
      'SELECT throttle_class FROM pin_throttle_bucket ORDER BY throttle_class'
    );
    expect(rows.map((r) => r.throttle_class)).toEqual(['LOGIN', 'MANAGER_APPROVAL']);
  });
});
