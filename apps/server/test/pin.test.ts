import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '../src/db/pool.js';
import {
  assertValidPinFormat,
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
    await expect(verifyPin('123456', encoded)).resolves.toBe(true);
    await expect(verifyPin('654321', encoded)).resolves.toBe(false);
  });

  it('never contains the PIN and salts every hash', async () => {
    const a = await hashPin('123456');
    const b = await hashPin('123456');
    expect(a).not.toContain('123456');
    expect(a).not.toBe(b);
  });

  it('returns false, never throws, for a malformed hash or a PIN that is not six digits', async () => {
    await expect(verifyPin('123456', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPin('123456', '$argon2id$garbage')).resolves.toBe(false);
    const encoded = await hashPin('123456');
    await expect(verifyPin('12345', encoded)).resolves.toBe(false);
    await expect(verifyPin('abcdef', encoded)).resolves.toBe(false);
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
    const { id } = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
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
    await expect(verifyPin('123456', row.pin_hash)).resolves.toBe(true);
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

// FR-A4: a PIN is unique among active users only. Deactivation and
// reactivation are fixtures here; no domain function does them yet.
describe('PIN uniqueness among active users', () => {
  const countWithPin = async (pin: string) => {
    const [row] = await ownerQuery<{ n: string }>(
      'SELECT count(*) AS n FROM staff_user WHERE pin_lookup = $1',
      [pinLookup(pin)]
    );
    return row?.n;
  };

  it('still refuses a PIN held by an active user and writes no second row (case 1)', async () => {
    await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    await expect(createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '123456' })).rejects.toThrow(
      'PIN already in use'
    );
    expect(await countWithPin('123456')).toBe('1');
  });

  it('gives a PIN held only by a deactivated user to a new user (case 2)', async () => {
    const old = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [old.id]);
    const fresh = await createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '123456' });
    expect(fresh.id).toEqual(expect.any(String));
    expect(fresh.id).not.toBe(old.id);
    expect(await countWithPin('123456')).toBe('2');
    const [inactive] = await ownerQuery<{ n: string }>(
      'SELECT count(*) AS n FROM staff_user WHERE pin_lookup = $1 AND NOT is_active',
      [pinLookup('123456')]
    );
    expect(inactive?.n).toBe('1');
  });

  it('finds the new user, never the deactivated one, by that PIN (case 3)', async () => {
    const old = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [old.id]);
    const fresh = await createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '123456' });
    await expect(findUserByPin('123456')).resolves.toEqual({
      id: fresh.id,
      role: 'MANAGER',
      credentialVersion: 1,
    });
  });

  it('refuses to reactivate a user whose PIN an active user now holds (case 4)', async () => {
    const old = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [old.id]);
    await createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '123456' });

    const failure = (await failureOf(() =>
      ownerQuery('UPDATE staff_user SET is_active = true WHERE id = $1', [old.id])
    )) as { code?: string; constraint?: string };
    expect(failure.code).toBe('23505');
    expect(failure.constraint).toBe('staff_user_active_pin_lookup_key');
    const [row] = await ownerQuery<{ is_active: boolean }>(
      'SELECT is_active FROM staff_user WHERE id = $1',
      [old.id]
    );
    expect(row?.is_active).toBe(false);
  });

  it('lets deactivated users share a PIN, and a new active user take it too (case 5)', async () => {
    const a = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [a.id]);
    const b = await createStaffUser({ name: 'Budi', role: 'CASHIER', pin: '123456' });
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [b.id]);
    expect(await countWithPin('123456')).toBe('2');

    const c = await createStaffUser({ name: 'Dewi', role: 'MANAGER', pin: '123456' });
    expect(await countWithPin('123456')).toBe('3');
    await expect(findUserByPin('123456')).resolves.toMatchObject({ id: c.id });
  });
});

describe('findUserByPin', () => {
  it('finds a user by PIN alone', async () => {
    const { id } = await createStaffUser({ name: 'Sari', role: 'MANAGER', pin: '123456' });
    await expect(findUserByPin('123456')).resolves.toEqual({
      id,
      role: 'MANAGER',
      credentialVersion: 1,
    });
  });

  it('returns null for an unknown PIN, a deactivated user and a non-six-digit value', async () => {
    const { id } = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
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
    const { id } = await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
    await ownerQuery('UPDATE staff_user SET credential_version = 2 WHERE id = $1', [id]);
    const found = await findUserByPin('123456');
    expect(found?.credentialVersion).toBe(2);
  });
});

// Every function takes its PIN as `unknown` at runtime. A number must not pass
// the pattern (RegExp.test coerces it) and must not reach an error that carries it.
describe('a PIN that is not a string', () => {
  const notStrings: [string, unknown][] = [
    ['the number 123456', 123456],
    ['null', null],
    ['undefined', undefined],
    ['an object', { toString: () => '123456' }],
  ];
  const asPin = (value: unknown) => value as string;

  for (const [label, value] of notStrings) {
    describe(label, () => {
      it('is refused by every throwing function with the fixed message and no PIN', async () => {
        const calls: (() => unknown)[] = [
          () => assertValidPinFormat(asPin(value)),
          () => hashPin(asPin(value)),
          () => pinLookup(asPin(value)),
          () => createStaffUser({ name: 'Sari', role: 'CASHIER', pin: asPin(value) }),
        ];
        for (const call of calls) {
          const err = await failureOf(async () => call());
          expect((err as Error).message).toBe('PIN must be six digits');
          expect(exposed(err)).not.toContain('123456');
        }
      });

      it('makes verifyPin return false and findUserByPin return null', async () => {
        const encoded = await hashPin('123456');
        await expect(verifyPin(asPin(value), encoded)).resolves.toBe(false);
        await createStaffUser({ name: 'Sari', role: 'CASHIER', pin: '123456' });
        await expect(findUserByPin(asPin(value))).resolves.toBeNull();
      });
    });
  }
});
