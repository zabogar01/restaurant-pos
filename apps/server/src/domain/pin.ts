import { createHmac } from 'node:crypto';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { pinPepper } from '../config.js';
import { query } from '../db/pool.js';

export type StaffRole = 'CASHIER' | 'MANAGER';

const ROLES: readonly string[] = ['CASHIER', 'MANAGER'];

// OWASP's minimum for Argon2id, stated here so a library upgrade cannot weaken
// it silently (FR-A3, B-11).
const ARGON2 = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// B-12: nothing that leaves these functions may carry a PIN, a lookup digest or
// a hash. A PostgreSQL error's `detail` holds the whole failing row, so a
// database error is replaced, never wrapped, and keeps no cause.
const DATABASE_FAILURE = 'The staff user store failed';

function isPin(pin: string): boolean {
  return /^[0-9]{6}$/.test(pin);
}

function assertPin(pin: string): void {
  if (!isPin(pin)) throw new Error('PIN must be six digits');
}

export async function hashPin(pin: string): Promise<string> {
  assertPin(pin);
  return hash(pin, ARGON2);
}

export async function verifyPin(encoded: string, pin: string): Promise<boolean> {
  if (!isPin(pin)) return false;
  try {
    return await verify(encoded, pin);
  } catch {
    return false;
  }
}

/** The keyed blind index: HMAC-SHA256 of the PIN under the pepper. Finds a row; never verifies. */
export function pinLookup(pin: string): string {
  assertPin(pin);
  return createHmac('sha256', pinPepper()).update(pin).digest('hex');
}

export async function createStaffUser(input: {
  name: string;
  role: StaffRole;
  pin: string;
}): Promise<string> {
  assertPin(input.pin);
  const name = input.name.trim();
  if (name === '') throw new Error('Name must not be blank');
  if (!ROLES.includes(input.role)) throw new Error('Role must be CASHIER or MANAGER');

  const pinHash = await hashPin(input.pin);
  const lookup = pinLookup(input.pin);

  let rows: { id: string }[];
  try {
    rows = await query<{ id: string }>(
      `INSERT INTO staff_user (name, role, pin_hash, pin_lookup)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pin_lookup) DO NOTHING
       RETURNING id`,
      [name, input.role, pinHash, lookup]
    );
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
  const created = rows[0];
  if (!created) throw new Error('PIN already in use');
  return created.id;
}

/**
 * The active staff user a PIN belongs to, or null. The digest finds the one
 * row; Argon2id on that row's own hash decides. The credential version comes
 * from the same row and the same SELECT as the hash it was verified against.
 */
export async function findUserByPin(
  pin: string
): Promise<{ id: string; role: StaffRole; credentialVersion: number } | null> {
  if (!isPin(pin)) return null;
  const lookup = pinLookup(pin);
  let rows: { id: string; role: StaffRole; pin_hash: string; credential_version: number }[];
  try {
    rows = await query(
      `SELECT id, role, pin_hash, credential_version
         FROM staff_user
        WHERE pin_lookup = $1 AND is_active`,
      [lookup]
    );
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
  const row = rows[0];
  if (!row) return null;
  if (!(await verifyPin(row.pin_hash, pin))) return null;
  return { id: row.id, role: row.role, credentialVersion: row.credential_version };
}
