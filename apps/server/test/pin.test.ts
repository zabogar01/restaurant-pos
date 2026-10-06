import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '../src/db/pool.js';
import {
  createStaffUser,
  findUserByPin,
  hashPin,
  pinLookup,
  verifyPin,
} from '../src/domain/pin.js';
import { ownerQuery, resetDatabase } from './support/database.js';

const PEPPER = process.env.PIN_PEPPER;

beforeEach(async () => {
  process.env.PIN_PEPPER = PEPPER;
  await resetDatabase();
});

afterAll(async () => {
  process.env.PIN_PEPPER = PEPPER;
  await getPool().end();
});

/** Everything an error exposes: message, stack, and every own property, deeply. */
function exposed(err: unknown): string {
  const seen = new Set<unknown>();
  const walk = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value === null || typeof value !== 'object' || seen.has(value)) return '';
    seen.add(value);
    return Object.getOwnPropertyNames(value)
      .map((key) => walk((value as Record<string, unknown>)[key]))
      .join('\n');
  };
  return walk(err);
}

async function failureOf(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected the call to fail');
}

describe('PIN format', () => {
  it('accepts six digits and rejects everything else', async () => {
    for (const ok of ['000000', '123456', '999999']) {
      await expect(hashPin(ok)).resolves.toMatch(/^\$argon2id\$/);
    }
    for (const bad of ['12345', '1234567', 'abcdef', '12 456', '', '12345a', '１２３４５６']) {
      await expect(hashPin(bad)).rejects.toThrow('PIN must be six digits');
    }
  });
});

describe('hashPin and verifyPin', () => {
  it('emits Argon2id with the stated parameters, verifies the PIN and refuses another', async () => {
    const encoded = await hashPin('123456');
    expect(encoded.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    await expect(verifyPin(encoded, '123456')).resolves.toBe(true);
    await expect(verifyPin(encoded, '654321')).resolves.toBe(false);
  });

  it('never contains the PIN and salts every hash', async () => {
    const a = await hashPin('123456');
    const b = await hashPin('123456');
    expect(a).not.toContain('123456');
    expect(a).not.toBe(b);
  });

  it('returns false, never throws, for a malformed hash or a PIN that is not six digits', async () => {
    await expect(verifyPin('not-a-hash', '123456')).resolves.toBe(false);
    await expect(verifyPin('$argon2id$garbage', '123456')).resolves.toBe(false);
    const encoded = await hashPin('123456');
    await expect(verifyPin(encoded, '12345')).resolves.toBe(false);
    await expect(verifyPin(encoded, 'abcdef')).resolves.toBe(false);
  });
});

describe('pinLookup', () => {
  it('is a deterministic, keyed, 64-character hex digest that never contains the PIN', () => {
    const a = pinLookup('123456');
    expect(pinLookup('123456')).toBe(a);
    expect(pinLookup('654321')).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('123456');
    process.env.PIN_PEPPER = 'a-different-pepper-of-at-least-32-characters';
    expect(pinLookup('123456')).not.toBe(a);
  });

  it('refuses an unset or short PIN_PEPPER, naming it without its value', () => {
    delete process.env.PIN_PEPPER;
    expect(() => pinLookup('123456')).toThrow(/PIN_PEPPER/);

    const short = 'x'.repeat(31);
    process.env.PIN_PEPPER = short;
    let message = '';
    try {
      pinLookup('123456');
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/PIN_PEPPER/);
    expect(message).not.toContain(short);
  });
});

describe('createStaffUser', () => {
  it('stores an Argon2id hash, the lookup digest, an active row at credential version 1', async () => {
    const id = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    const [found] = await ownerQuery<{
      pin_hash: string;
      pin_lookup: string;
      is_active: boolean;
      credential_version: number;
    }>('SELECT pin_hash, pin_lookup, is_active, credential_version FROM staff_user WHERE id = $1', [
      id,
    ]);
    const row = found!;
    expect(row.pin_hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPin(row.pin_hash, '123456')).resolves.toBe(true);
    expect(row.pin_lookup).toBe(pinLookup('123456'));
    expect(row.is_active).toBe(true);
    expect(row.credential_version).toBe(1);
  });

  it('refuses a duplicate PIN and writes no second row', async () => {
    await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    await expect(createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '123456' })).rejects.toThrow(
      'PIN already in use'
    );
    const [count] = await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM staff_user');
    expect(count?.n).toBe('1');
  });

  it('refuses an invalid PIN, a blank name and a bad role before any row is written', async () => {
    await expect(createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '12345' })).rejects.toThrow(
      'PIN must be six digits'
    );
    await expect(createStaffUser({ name: '', role: 'CASHIER', pin: '123456' })).rejects.toThrow();
    await expect(createStaffUser({ name: '   ', role: 'CASHIER', pin: '123456' })).rejects.toThrow();
    await expect(
      createStaffUser({ name: 'Sari', role: 'OWNER' as 'CASHIER', pin: '123456' })
    ).rejects.toThrow();
    const [count] = await ownerQuery<{ n: string }>('SELECT count(*) AS n FROM staff_user');
    expect(count?.n).toBe('0');
  });

  it('lets no error expose the PIN, its digest or a hash', async () => {
    await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    const failures = [
      await failureOf(() => createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '123456' })),
      await failureOf(() => createStaffUser({ name: ' ', role: 'MANAGER', pin: '246810' })),
      await failureOf(() => createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '24681' })),
    ];

    // A database failure that reaches the INSERT: a check violation, whose
    // PostgreSQL `detail` carries the whole failing row.
    await ownerQuery("ALTER TABLE staff_user ADD CONSTRAINT forced CHECK (name <> 'Forced')");
    failures.push(
      await failureOf(() => createStaffUser({ name: 'Forced', role: 'MANAGER', pin: '246810' }))
    );

    const secrets = ['123456', '246810', pinLookup('123456'), pinLookup('246810'), '$argon2id$'];
    for (const err of failures) {
      const text = exposed(err);
      for (const secret of secrets) expect(text).not.toContain(secret);
    }
  });
});

describe('findUserByPin', () => {
  it('finds a user by PIN alone', async () => {
    const id = await createStaffUser({ name: 'Sari', role: 'MANAGER', pin: '123456' });
    await expect(findUserByPin('123456')).resolves.toEqual({
      id,
      role: 'MANAGER',
      credentialVersion: 1,
    });
  });

  it('returns null for an unknown PIN, a deactivated user and a non-six-digit value', async () => {
    const id = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    await expect(findUserByPin('654321')).resolves.toBeNull();
    await expect(findUserByPin('12345')).resolves.toBeNull();
    await expect(findUserByPin('')).resolves.toBeNull();
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [id]);
    await expect(findUserByPin('123456')).resolves.toBeNull();
  });

  it('lets Argon2id, not the digest, decide', async () => {
    await ownerQuery(
      `INSERT INTO staff_user (name, role, pin_hash, pin_lookup) VALUES ($1, 'CASHIER', $2, $3)`,
      ['Planted', await hashPin('654321'), pinLookup('123456')]
    );
    await expect(findUserByPin('123456')).resolves.toBeNull();
  });

  it('returns the credential version of the row it verified', async () => {
    const id = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    await ownerQuery('UPDATE staff_user SET credential_version = 2 WHERE id = $1', [id]);
    const found = await findUserByPin('123456');
    expect(found?.credentialVersion).toBe(2);
  });
});
