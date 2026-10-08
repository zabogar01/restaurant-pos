import { createHmac } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type pg from 'pg';
import { pinPepper } from '../config.js';
import { query } from '../db/pool.js';
import { ARGON2 } from './argon2.js';

export type StaffRole = 'CASHIER' | 'MANAGER';

const ROLES: readonly string[] = ['CASHIER', 'MANAGER'];

// B-12: nothing that leaves these functions may carry a PIN, a lookup digest or
// a hash. A PostgreSQL error's `detail` holds the whole failing row, so a
// database error is replaced, never wrapped, and keeps no cause.
const DATABASE_FAILURE = 'The staff user store failed';

// Every public function takes its PIN as `unknown` at runtime. RegExp.test
// coerces its argument, so a number 123456 would pass a bare pattern and then
// reach an error that carries it (B-12): the type guard comes first.
function isPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^[0-9]{6}$/.test(pin);
}

export function assertValidPinFormat(pin: string): void {
  if (!isPin(pin)) throw new Error('PIN must be six digits');
}

export async function hashPin(pin: string): Promise<string> {
  assertValidPinFormat(pin);
  return hash(pin, ARGON2);
}

export async function verifyPin(pin: string, encoded: string): Promise<boolean> {
  if (!isPin(pin)) return false;
  try {
    return await verify(encoded, pin);
  } catch {
    return false;
  }
}

/** The keyed blind index: HMAC-SHA256 of the PIN under the pepper. Finds a row; never verifies. */
export function pinLookup(pin: string): string {
  assertValidPinFormat(pin);
  return createHmac('sha256', pinPepper()).update(pin).digest('hex');
}

export async function createStaffUser(
  input: {
    name: string;
    role: StaffRole;
    pin: string;
  },
  client?: Pick<pg.PoolClient, 'query'>
): Promise<{ id: string }> {
  assertValidPinFormat(input.pin);
  const name = input.name.trim();
  if (name === '') throw new Error('Name must not be blank');
  if (!ROLES.includes(input.role)) throw new Error('Role must be CASHIER or MANAGER');

  const pinHash = await hashPin(input.pin);
  const lookup = pinLookup(input.pin);

  let rows: { id: string }[];
  try {
    const sql = `INSERT INTO staff_user (name, role, pin_hash, pin_lookup)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pin_lookup) WHERE is_active DO NOTHING
       RETURNING id`;
    const params = [name, input.role, pinHash, lookup];
    rows = client ? (await client.query(sql, params)).rows : await query<{ id: string }>(sql, params);
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
  const created = rows[0];
  if (!created) throw new Error('PIN already in use');
  return { id: created.id };
}

/**
 * The active staff user a PIN belongs to, or null. The digest finds the one
 * row; Argon2id on that row's own hash decides. The credential version comes
 * from the same row and the same SELECT as the hash it was verified against.
 */
export async function findUserByPin(
  pin: string,
  client?: Pick<pg.PoolClient, 'query'>
): Promise<{ id: string; role: StaffRole; credentialVersion: number } | null> {
  if (!isPin(pin)) return null;
  const lookup = pinLookup(pin);
  let rows: { id: string; role: StaffRole; pin_hash: string; credential_version: number }[];
  try {
    const sql = `SELECT id, role, pin_hash, credential_version
         FROM staff_user
        WHERE pin_lookup = $1 AND is_active`;
    rows = client ? (await client.query(sql, [lookup])).rows : await query(sql, [lookup]);
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
  const row = rows[0];
  if (!row) return null;
  if (!(await verifyPin(pin, row.pin_hash))) return null;
  return { id: row.id, role: row.role, credentialVersion: row.credential_version };
}
