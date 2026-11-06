import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ROUTE_TABLE } from '@pos/contracts';
import { closePool } from '../src/db/pool.js';
import { verifyPasswordThrottled } from '../src/domain/back-office-credential.js';
import { findUserByPin } from '../src/domain/pin.js';
import { resolveSession } from '../src/domain/session.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';
import { makePeople } from './support/people.js';
import { TEST_ORIGIN, inject } from './support/request.js';
import {
  BASE,
  BODY,
  UNKNOWN_ID,
  auditRows,
  credentialRow,
  staffRow,
  userOf,
  usersApi,
  usersOf,
  versionOf,
  wholeUsers,
} from './support/users.js';
import type { Res } from './support/users.js';

// PHASE1-S8a: the users commands behind the five back-office routes (consult C3). Every
// case is numbered by the task's acceptance criterion it proves; the audit scan, the
// rollback proof and the crossing managers are in users-audit.test.ts and
// users-crossing.test.ts.

const people = makePeople(730000);

let app: FastifyInstance;
let client: JarClient;
let api: ReturnType<typeof usersApi>;
let manager: Awaited<ReturnType<typeof people.manager>>;

beforeAll(async () => {
  await resetDatabase();
  app = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent' });
  await app.ready();
  manager = await people.manager();
  client = new JarClient(app);
  api = usersApi(client);
  expect((await client.signInBackOffice(manager.username, manager.password)).statusCode).toBe(200);
});

afterAll(async () => {
  await app.close();
  await closePool();
});

// ---- fixtures: people, as the owner connection and the domain make them ------------------

let counter = 0;
const nextPin = () => String(731000 + (counter += 1));

/** Kitchen staff: no role, no PIN. The route can make one too; a fixture need not. */
async function kitchen(name = `Kitchen ${nextPin()}`): Promise<string> {
  const rows = await ownerQuery<{ id: string }>('INSERT INTO staff_user (name) VALUES ($1) RETURNING id', [name]);
  return rows[0]!.id;
}

async function bump(id: string): Promise<void> {
  await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [id]);
}

const csrfOf = (token: string) => createHmac('sha256', token).update('rpos-csrf-v1').digest('base64url');

/** Sessions of a person at both surfaces as far as their classification allows. */
async function signedIn(person: { pin: string; username?: string; password?: string }) {
  const pos = new JarClient(app);
  expect((await pos.signInPos(person.pin)).statusCode).toBe(200);
  const sessions: { audience: 'POS' | 'BACK_OFFICE'; token: string }[] = [
    { audience: 'POS', token: pos.valueOf('rpos_pos_sid')! },
  ];
  if (person.username !== undefined) {
    const office = new JarClient(app);
    expect((await office.signInBackOffice(person.username, person.password)).statusCode).toBe(200);
    sessions.push({ audience: 'BACK_OFFICE', token: office.valueOf('rpos_bo_sid')! });
  }
  return sessions;
}

async function allNone(sessions: Awaited<ReturnType<typeof signedIn>>): Promise<boolean[]> {
  const out: boolean[] = [];
  for (const { audience, token } of sessions) {
    out.push((await resolveSession(token, audience, false)).status === 'NONE');
  }
  return out;
}

// ---- 1 and 2: the declarations and the guard ---------------------------------------------

describe('the nine routes', () => {
  const entries = ROUTE_TABLE.filter((e) => e.path.startsWith(BASE));

  // The first five are S8a's; the four credential routes (S8b) have their own guard loop in
  // users-credentials.test.ts, and are listed here so this table stays the whole prefix.
  it('1. are the nine of the route table, with the list read not interactive', () => {
    expect(entries.map((e) => `${e.method} ${e.path} ${e.interactive}`)).toEqual([
      `GET ${BASE} false`,
      `POST ${BASE}/create true`,
      `POST ${BASE}/change-role true`,
      `POST ${BASE}/deactivate true`,
      `POST ${BASE}/reactivate true`,
      `POST ${BASE}/set-pin true`,
      `POST ${BASE}/set-password true`,
      `POST ${BASE}/own-password true`,
      `POST ${BASE}/own-pin true`,
    ]);
  });

  const bodyFor = (path: string, id: string) => {
    if (path.endsWith('/create')) return { classification: 'KITCHEN', name: 'Refused' };
    if (path.endsWith('/change-role')) return { change: 'MANAGER_TO_KITCHEN', staffUserId: id };
    if (path.endsWith('/set-pin')) return { staffUserId: id, pin: '123456' };
    if (path.endsWith('/set-password')) return { staffUserId: id, password: 'a password long enough' };
    if (path.endsWith('/own-password')) return { currentPassword: 'x', password: 'a password long enough' };
    if (path.endsWith('/own-pin')) return { currentPassword: 'x', pin: '123456' };
    return { staffUserId: id };
  };

  it('2. each refuses no cookie and a POS session in the cookie (401), a demoted manager (403) and, on a POST, a missing or wrong anti-CSRF header (403), writing nothing', async () => {
    const target = (await people.cashier()).id;
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

    const before = await wholeUsers();
    const audits = (await auditRows()).length;

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
      const post = entry.method === 'POST';

      const none = await send(undefined, post ? 'x'.repeat(43) : undefined);
      expect([none.statusCode, none.body], `${where}: no cookie`).toEqual([401, BODY.UNAUTHENTICATED]);
      const pos = await send(`rpos_bo_sid=${posToken}`, post ? csrfOf(posToken) : undefined);
      expect([pos.statusCode, pos.body], `${where}: a POS token`).toEqual([401, BODY.UNAUTHENTICATED]);
      const forbidden = await send(`rpos_bo_sid=${demotedToken}`, post ? csrfOf(demotedToken) : undefined);
      expect([forbidden.statusCode, forbidden.body], `${where}: a demoted manager`).toEqual([403, BODY.FORBIDDEN]);
      if (post) {
        const missing = await send(`rpos_bo_sid=${boToken}`, undefined);
        expect([missing.statusCode, missing.body], `${where}: no header`).toEqual([403, BODY.CSRF_REFUSED]);
        const wrong = await send(`rpos_bo_sid=${boToken}`, csrfOf(`${boToken}-other`));
        expect([wrong.statusCode, wrong.body], `${where}: wrong header`).toEqual([403, BODY.CSRF_REFUSED]);
      }
    }
    expect(await wholeUsers()).toEqual(before);
    expect((await auditRows()).length).toBe(audits);
  });
});

// ---- 4 and 16: create --------------------------------------------------------------------

describe('create', () => {
  it('4. kitchen staff: the view, a null role, PIN hash and lookup, and no audit entry (16)', async () => {
    const audits = (await auditRows()).length;
    const res = await api.create({ classification: 'KITCHEN', name: 'Cook Dewi' });
    expect(res.statusCode).toBe(200);
    const user = userOf(res);
    expect(user).toEqual({ staffUserId: user.staffUserId, name: 'Cook Dewi', classification: 'KITCHEN', isActive: true, username: null });
    const row = await staffRow(user.staffUserId);
    expect([row.role, row.pin_hash, row.pin_lookup, row.credential_version]).toEqual([null, null, null, 1]);
    expect(await credentialRow(user.staffUserId)).toBeUndefined();
    expect((await auditRows()).length).toBe(audits);
  });

  it('4. any number of kitchen staff coexist, with one name too', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await api.create({ classification: 'KITCHEN', name: 'Same Name' })).statusCode).toBe(200);
    }
  });

  it('4. a cashier: the view, and the PIN verifies at findUserByPin', async () => {
    const pin = nextPin();
    const res = await api.create({ classification: 'CASHIER', name: 'Cashier Rina', pin });
    expect(res.statusCode).toBe(200);
    const user = userOf(res);
    expect(user).toMatchObject({ name: 'Cashier Rina', classification: 'CASHIER', isActive: true, username: null });
    expect(await findUserByPin(pin)).toMatchObject({ id: user.staffUserId, role: 'CASHIER', credentialVersion: 1 });
    expect(await credentialRow(user.staffUserId)).toBeUndefined();
  });

  it('4. a manager: the view, the PIN at findUserByPin and the password at verifyPasswordThrottled', async () => {
    const pin = nextPin();
    const res = await api.create({
      classification: 'MANAGER',
      name: 'Manager Sari',
      pin,
      username: 'sari.manager',
      password: 'a password long enough',
    });
    expect(res.statusCode).toBe(200);
    const user = userOf(res);
    expect(user).toMatchObject({ classification: 'MANAGER', username: 'sari.manager' });
    expect(await findUserByPin(pin)).toMatchObject({ id: user.staffUserId, role: 'MANAGER' });
    expect(await verifyPasswordThrottled({ username: 'sari.manager' }, 'a password long enough')).toMatchObject({
      outcome: 'VERIFIED',
      user: { id: user.staffUserId },
    });
  });

  it('4. a PIN an active user holds is DUPLICATE on pin; nothing is written in either table', async () => {
    const holder = await people.cashier();
    const before = await wholeUsers();
    for (const payload of [
      { classification: 'CASHIER', name: 'Dup', pin: holder.pin },
      { classification: 'MANAGER', name: 'Dup', pin: holder.pin, username: 'dup.pin.user', password: 'a password long enough' },
    ]) {
      const res = await api.create(payload);
      expect([res.statusCode, res.body], payload.classification).toEqual([409, BODY.DUPLICATE_PIN]);
    }
    expect(await wholeUsers()).toEqual(before);
  });

  it('4. a PIN an inactive user held is free to give', async () => {
    const old = await people.cashier();
    await bump(old.id);
    expect((await api.create({ classification: 'CASHIER', name: 'Heir', pin: old.pin })).statusCode).toBe(200);
  });

  it('4. a username any row holds, an inactive one included, is DUPLICATE on username; no row is written in either table', async () => {
    const holder = await people.manager();
    await bump(holder.id);
    const before = await wholeUsers();
    const res = await api.create({
      classification: 'MANAGER',
      name: 'Dup',
      pin: nextPin(),
      username: holder.username,
      password: 'a password long enough',
    });
    expect([res.statusCode, res.body]).toEqual([409, BODY.DUPLICATE_USERNAME]);
    expect(await wholeUsers()).toEqual(before);
  });

  it('4. a command that would break both keys is refused on the PIN, the first statement to fail', async () => {
    const pinHolder = await people.cashier();
    const nameHolder = await people.manager();
    const res = await api.create({
      classification: 'MANAGER',
      name: 'Both',
      pin: pinHolder.pin,
      username: nameHolder.username,
      password: 'a password long enough',
    });
    expect([res.statusCode, res.body]).toEqual([409, BODY.DUPLICATE_PIN]);
  });

  it('4. a malformed body is VALIDATION_FAILED before anything is read, and writes nothing', async () => {
    const before = await wholeUsers();
    const good = { classification: 'MANAGER', name: 'Valid', pin: '123456', username: 'valid.user', password: 'a password long enough' };
    for (const payload of [
      { ...good, extra: 1 },
      { ...good, pin: '12345' },
      { ...good, pin: 123456 },
      { ...good, name: ' Padded' },
      { ...good, name: 'Bell\u0007' },
      { ...good, name: 'Csi\u009b' },
      { ...good, name: '' },
      { ...good, name: 'x'.repeat(65) },
      { ...good, username: 'Upper.Case' },
      { ...good, username: 'ab' },
      { ...good, password: 'short' },
      { ...good, password: ' '.repeat(7) },
      { classification: 'CASHIER', name: 'No pin' },
      { classification: 'KITCHEN', name: 'Cook', pin: '123456' },
      { classification: 'ADMIN', name: 'Nope' },
      { name: 'No classification' },
    ]) {
      const res = await api.create(payload);
      expect([res.statusCode, res.body], JSON.stringify(payload)).toEqual([400, BODY.VALIDATION]);
    }
    expect(await wholeUsers()).toEqual(before);
  });

  it('4. a password counts code points: 8 of them pass, 128 pass, 129 do not', async () => {
    const emoji = (n: number) => '\u{1F600}'.repeat(n);
    const base = { classification: 'MANAGER', name: 'Code points' };
    for (const [password, status] of [
      [emoji(8), 200],
      [emoji(129), 400],
    ] as const) {
      const res = await api.create({ ...base, pin: nextPin(), username: `cp.${status}.user`, password });
      expect(res.statusCode, `${[...password].length} code points`).toBe(status);
    }
    expect(
      (await api.create({ ...base, pin: nextPin(), username: 'cp.max.user', password: 'x'.repeat(128) })).statusCode
    ).toBe(200);
  });
});

// ---- 5: change role, per move ------------------------------------------------------------

describe('change role', () => {
  const PASSWORD = 'a promoted password 1';

  it('5. KITCHEN_TO_CASHIER sets a role and a PIN that verifies, and leaves no credential row', async () => {
    const id = await kitchen();
    const pin = nextPin();
    const res = await api.changeRole({ change: 'KITCHEN_TO_CASHIER', staffUserId: id, pin });
    expect(res.statusCode).toBe(200);
    expect(userOf(res)).toMatchObject({ staffUserId: id, classification: 'CASHIER', username: null });
    expect(await findUserByPin(pin)).toMatchObject({ id, role: 'CASHIER' });
    expect(await credentialRow(id)).toBeUndefined();
    expect(await versionOf(id)).toBe(2);
  });

  it('5. KITCHEN_TO_MANAGER sets a role, a PIN, a username and a password', async () => {
    const id = await kitchen();
    const pin = nextPin();
    const res = await api.changeRole({ change: 'KITCHEN_TO_MANAGER', staffUserId: id, pin, password: PASSWORD, username: 'kit.manager' });
    expect(res.statusCode).toBe(200);
    expect(userOf(res)).toMatchObject({ classification: 'MANAGER', username: 'kit.manager' });
    expect(await findUserByPin(pin)).toMatchObject({ id, role: 'MANAGER' });
    expect(await verifyPasswordThrottled({ username: 'kit.manager' }, PASSWORD)).toMatchObject({ outcome: 'VERIFIED' });
    expect(await versionOf(id)).toBe(2);
  });

  it('5. CASHIER_TO_MANAGER keeps the PIN and sets a username and a password', async () => {
    const cashier = await people.cashier();
    const res = await api.changeRole({ change: 'CASHIER_TO_MANAGER', staffUserId: cashier.id, password: PASSWORD, username: 'cash.manager' });
    expect(res.statusCode).toBe(200);
    expect(userOf(res)).toMatchObject({ classification: 'MANAGER', username: 'cash.manager' });
    expect(await findUserByPin(cashier.pin)).toMatchObject({ id: cashier.id, role: 'MANAGER' });
    expect(await verifyPasswordThrottled({ username: 'cash.manager' }, PASSWORD)).toMatchObject({ outcome: 'VERIFIED' });
    expect(await versionOf(cashier.id)).toBe(2);
  });

  it('5. MANAGER_TO_CASHIER keeps the PIN; the credential row stays and never verifies', async () => {
    const demoted = await people.manager();
    const before = await credentialRow(demoted.id);
    const res = await api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: demoted.id });
    expect(res.statusCode).toBe(200);
    expect(userOf(res)).toMatchObject({ classification: 'CASHIER', username: demoted.username });
    expect(await findUserByPin(demoted.pin)).toMatchObject({ id: demoted.id, role: 'CASHIER' });
    expect(await credentialRow(demoted.id)).toEqual(before);
    expect((await verifyPasswordThrottled({ username: demoted.username! }, demoted.password!)).outcome).toBe('FAILED');
    expect(await versionOf(demoted.id)).toBe(2);
  });

  it('5. CASHIER_TO_KITCHEN removes the PIN, and the PIN no longer signs in', async () => {
    const cashier = await people.cashier();
    const res = await api.changeRole({ change: 'CASHIER_TO_KITCHEN', staffUserId: cashier.id });
    expect(res.statusCode).toBe(200);
    expect(userOf(res)).toMatchObject({ classification: 'KITCHEN' });
    const row = await staffRow(cashier.id);
    expect([row.role, row.pin_hash, row.pin_lookup]).toEqual([null, null, null]);
    expect(await findUserByPin(cashier.pin)).toBeNull();
    expect(await versionOf(cashier.id)).toBe(2);
  });

  it('5. MANAGER_TO_KITCHEN removes the PIN; the credential row stays and never verifies', async () => {
    const former = await people.manager();
    const res = await api.changeRole({ change: 'MANAGER_TO_KITCHEN', staffUserId: former.id });
    expect(res.statusCode).toBe(200);
    expect(userOf(res)).toMatchObject({ classification: 'KITCHEN', username: former.username });
    expect(await findUserByPin(former.pin)).toBeNull();
    expect(await credentialRow(former.id)).toBeDefined();
    expect((await verifyPasswordThrottled({ username: former.username! }, former.password!)).outcome).toBe('FAILED');
  });

  it('5. promoting a former manager keeps the username, replaces the hash and leaves the throttle state as it was', async () => {
    const former = await people.manager();
    expect((await api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: former.id })).statusCode).toBe(200);
    await ownerQuery(
      `UPDATE back_office_credential
          SET consecutive_failures = 3, blocked_until = now() + interval '1 hour'
        WHERE staff_user_id = $1`,
      [former.id]
    );
    const before = (await credentialRow(former.id))!;
    const res = await api.changeRole({ change: 'CASHIER_TO_MANAGER', staffUserId: former.id, password: PASSWORD });
    expect(res.statusCode).toBe(200);
    const after = (await credentialRow(former.id))!;
    expect(after.username).toBe(former.username);
    expect(after.password_hash).not.toBe(before.password_hash);
    expect([after.consecutive_failures, after.blocked_until]).toEqual([before.consecutive_failures, before.blocked_until]);
    // The old password never comes back to life with the role.
    await ownerQuery('UPDATE back_office_credential SET blocked_until = NULL WHERE staff_user_id = $1', [former.id]);
    expect((await verifyPasswordThrottled({ username: former.username! }, former.password!)).outcome).toBe('FAILED');
    await ownerQuery('UPDATE back_office_credential SET blocked_until = NULL WHERE staff_user_id = $1', [former.id]);
    expect((await verifyPasswordThrottled({ username: former.username! }, PASSWORD)).outcome).toBe('VERIFIED');
  });

  it('5. a move whose origin differs from the row, or on an inactive user, is USER_CHANGED with nothing written', async () => {
    const cashier = await people.cashier();
    const gone = await people.cashier();
    await bump(gone.id);
    const before = await wholeUsers();
    const moves: [string, object][] = [
      ['a kitchen move on a cashier', { change: 'KITCHEN_TO_CASHIER', staffUserId: cashier.id, pin: nextPin() }],
      ['a manager move on a cashier', { change: 'MANAGER_TO_CASHIER', staffUserId: cashier.id }],
      ['a manager-to-kitchen on a cashier', { change: 'MANAGER_TO_KITCHEN', staffUserId: cashier.id }],
      ['an inactive cashier', { change: 'CASHIER_TO_KITCHEN', staffUserId: gone.id }],
      ['an inactive cashier promoted', { change: 'CASHIER_TO_MANAGER', staffUserId: gone.id, password: PASSWORD, username: 'gone.user' }],
    ];
    for (const [label, payload] of moves) {
      const res = await api.changeRole(payload);
      expect([res.statusCode, res.body], label).toEqual([409, BODY.USER_CHANGED]);
    }
    expect(await wholeUsers()).toEqual(before);
  });

  it('5. a username sent for a person who has one, or missing for one who has none, is USER_CHANGED', async () => {
    const former = await people.manager();
    expect((await api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: former.id })).statusCode).toBe(200);
    const fresh = await people.cashier();
    const before = await wholeUsers();
    const withName = await api.changeRole({ change: 'CASHIER_TO_MANAGER', staffUserId: former.id, password: PASSWORD, username: 'another.name' });
    expect([withName.statusCode, withName.body]).toEqual([409, BODY.USER_CHANGED]);
    const without = await api.changeRole({ change: 'CASHIER_TO_MANAGER', staffUserId: fresh.id, password: PASSWORD });
    expect([without.statusCode, without.body]).toEqual([409, BODY.USER_CHANGED]);
    expect(await wholeUsers()).toEqual(before);
  });

  it('5. a promotion to a username any row holds is DUPLICATE on username and changes nothing', async () => {
    const holder = await people.manager();
    const cashier = await people.cashier();
    const before = await wholeUsers();
    const res = await api.changeRole({ change: 'CASHIER_TO_MANAGER', staffUserId: cashier.id, password: PASSWORD, username: holder.username });
    expect([res.statusCode, res.body]).toEqual([409, BODY.DUPLICATE_USERNAME]);
    expect(await wholeUsers()).toEqual(before);
  });

  it('5. giving a cook a PIN an active user holds is DUPLICATE on pin and changes nothing', async () => {
    const holder = await people.cashier();
    const id = await kitchen();
    const before = await wholeUsers();
    const res = await api.changeRole({ change: 'KITCHEN_TO_CASHIER', staffUserId: id, pin: holder.pin });
    expect([res.statusCode, res.body]).toEqual([409, BODY.DUPLICATE_PIN]);
    expect(await wholeUsers()).toEqual(before);
  });

  it('5. an unknown id is NOT_FOUND, and a variant missing its field is VALIDATION_FAILED', async () => {
    const unknown = await api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: UNKNOWN_ID });
    expect([unknown.statusCode, unknown.body]).toEqual([404, BODY.NOT_FOUND]);
    const id = await kitchen();
    const before = await wholeUsers();
    for (const payload of [
      { change: 'KITCHEN_TO_CASHIER', staffUserId: id },
      { change: 'KITCHEN_TO_MANAGER', staffUserId: id, pin: nextPin() },
      { change: 'CASHIER_TO_MANAGER', staffUserId: id },
      { change: 'CASHIER_TO_KITCHEN', staffUserId: id, pin: nextPin() },
      { change: 'SIDEWAYS', staffUserId: id },
    ]) {
      const res = await api.changeRole(payload);
      expect([res.statusCode, res.body], JSON.stringify(payload)).toEqual([400, BODY.VALIDATION]);
    }
    expect(await wholeUsers()).toEqual(before);
  });
});

// ---- 6: the credential version and the sessions ------------------------------------------

describe('the credential version', () => {
  it('6. deactivation increments it by one, and every POS and back-office session of the person resolves NONE', async () => {
    const victim = await people.manager();
    const sessions = await signedIn(victim);
    expect(await allNone(sessions)).toEqual([false, false]);
    const res = await api.deactivate(victim.id);
    expect(res.statusCode).toBe(200);
    expect(userOf(res).isActive).toBe(false);
    expect(await versionOf(victim.id)).toBe(2);
    expect(await allNone(sessions)).toEqual([true, true]);
  });

  it('6. every move out of a classification that can sign in increments it by one and ends its sessions', async () => {
    const moves: [string, 'cashier' | 'manager', (id: string) => object][] = [
      ['CASHIER_TO_MANAGER', 'cashier', (id) => ({ change: 'CASHIER_TO_MANAGER', staffUserId: id, password: 'a promoted password 1', username: `v.${nextPin()}` })],
      ['CASHIER_TO_KITCHEN', 'cashier', (id) => ({ change: 'CASHIER_TO_KITCHEN', staffUserId: id })],
      ['MANAGER_TO_CASHIER', 'manager', (id) => ({ change: 'MANAGER_TO_CASHIER', staffUserId: id })],
      ['MANAGER_TO_KITCHEN', 'manager', (id) => ({ change: 'MANAGER_TO_KITCHEN', staffUserId: id })],
    ];
    for (const [label, kind, body] of moves) {
      const person = kind === 'cashier' ? await people.cashier() : await people.manager();
      const sessions = await signedIn(person);
      const res = await api.changeRole(body(person.id));
      expect(res.statusCode, label).toBe(200);
      expect(await versionOf(person.id), label).toBe(2);
      expect((await allNone(sessions)).every(Boolean), label).toBe(true);
    }
  });

  it('6. a move out of kitchen increments it by one too', async () => {
    const id = await kitchen();
    expect((await api.changeRole({ change: 'KITCHEN_TO_CASHIER', staffUserId: id, pin: nextPin() })).statusCode).toBe(200);
    expect(await versionOf(id)).toBe(2);
  });

  it('6. after a deactivation and a reactivation the person\'s old sessions still resolve NONE (AC-32, server half)', async () => {
    const victim = await people.manager();
    const sessions = await signedIn(victim);
    expect((await api.deactivate(victim.id)).statusCode).toBe(200);
    const back = await api.reactivate(victim.id);
    expect(back.statusCode).toBe(200);
    expect(userOf(back).isActive).toBe(true);
    expect(await allNone(sessions)).toEqual([true, true]);
    // A fresh sign-in works, on the new version.
    const fresh = await signedIn(victim);
    expect(await allNone(fresh)).toEqual([false, false]);
  });

  it('6. a no-op writes nothing at all: not a row, not an entry', async () => {
    const inactive = await people.cashier();
    await bump(inactive.id);
    const active = await people.cashier();
    const before = await wholeUsers();
    const audits = (await auditRows()).length;
    expect((await api.deactivate(inactive.id)).statusCode).toBe(200);
    expect((await api.reactivate(active.id)).statusCode).toBe(200);
    expect((await api.reactivate(active.id, nextPin())).statusCode).toBe(200);
    expect(await wholeUsers()).toEqual(before);
    expect((await auditRows()).length).toBe(audits);
  });

  it('6. reactivation keeping the PIN does not increment', async () => {
    const person = await people.cashier();
    expect((await api.deactivate(person.id)).statusCode).toBe(200);
    expect(await versionOf(person.id)).toBe(2);
    expect((await api.reactivate(person.id)).statusCode).toBe(200);
    expect(await versionOf(person.id)).toBe(2);
  });
});

// ---- 7: reactivation ---------------------------------------------------------------------

describe('reactivate', () => {
  it('7. keeping a free PIN reactivates, and the PIN signs in again', async () => {
    const person = await people.cashier();
    expect((await api.deactivate(person.id)).statusCode).toBe(200);
    expect(await findUserByPin(person.pin)).toBeNull();
    const res = await api.reactivate(person.id);
    expect(res.statusCode).toBe(200);
    expect(userOf(res).isActive).toBe(true);
    expect(await findUserByPin(person.pin)).toMatchObject({ id: person.id });
  });

  it('7. a PIN an active user now holds is DUPLICATE on pin with nothing written; the same command with a new PIN reactivates', async () => {
    const person = await people.cashier();
    expect((await api.deactivate(person.id)).statusCode).toBe(200);
    const heir = await api.create({ classification: 'CASHIER', name: 'Heir', pin: person.pin });
    expect(heir.statusCode).toBe(200);
    const before = await wholeUsers();
    const audits = (await auditRows()).length;
    const refused = await api.reactivate(person.id);
    expect([refused.statusCode, refused.body]).toEqual([409, BODY.DUPLICATE_PIN]);
    expect(await wholeUsers()).toEqual(before);
    expect((await auditRows()).length).toBe(audits);

    const newPin = nextPin();
    const res = await api.reactivate(person.id, newPin);
    expect(res.statusCode).toBe(200);
    expect(userOf(res).isActive).toBe(true);
    expect(await findUserByPin(newPin)).toMatchObject({ id: person.id });
    expect(await versionOf(person.id)).toBe(3);
  });

  it('7. a new PIN that is itself taken is DUPLICATE on pin and changes nothing', async () => {
    const person = await people.cashier();
    const holder = await people.cashier();
    expect((await api.deactivate(person.id)).statusCode).toBe(200);
    const before = await wholeUsers();
    const res = await api.reactivate(person.id, holder.pin);
    expect([res.statusCode, res.body]).toEqual([409, BODY.DUPLICATE_PIN]);
    expect(await wholeUsers()).toEqual(before);
  });

  it('7. a new PIN is accepted even when the old one was free, and the old one stops signing in', async () => {
    const person = await people.cashier();
    expect((await api.deactivate(person.id)).statusCode).toBe(200);
    const newPin = nextPin();
    expect((await api.reactivate(person.id, newPin)).statusCode).toBe(200);
    expect(await findUserByPin(person.pin)).toBeNull();
    expect(await findUserByPin(newPin)).toMatchObject({ id: person.id });
  });

  it('7. a pin for a kitchen row is USER_CHANGED; without one the cook comes back', async () => {
    const id = await kitchen();
    expect((await api.deactivate(id)).statusCode).toBe(200);
    const before = await wholeUsers();
    const refused = await api.reactivate(id, nextPin());
    expect([refused.statusCode, refused.body]).toEqual([409, BODY.USER_CHANGED]);
    expect(await wholeUsers()).toEqual(before);
    const res = await api.reactivate(id);
    expect(res.statusCode).toBe(200);
    expect(userOf(res)).toMatchObject({ classification: 'KITCHEN', isActive: true });
  });

  it('7. a reactivated manager keeps the username and the old password verifies again', async () => {
    const person = await people.manager();
    expect((await api.deactivate(person.id)).statusCode).toBe(200);
    expect((await verifyPasswordThrottled({ username: person.username! }, person.password!)).outcome).toBe('FAILED');
    await ownerQuery('UPDATE back_office_credential SET consecutive_failures = 0, blocked_until = NULL WHERE staff_user_id = $1', [person.id]);
    expect((await api.reactivate(person.id)).statusCode).toBe(200);
    expect((await verifyPasswordThrottled({ username: person.username! }, person.password!)).outcome).toBe('VERIFIED');
  });

  it('7. an unknown id is NOT_FOUND, on deactivate and on reactivate', async () => {
    for (const res of [await api.deactivate(UNKNOWN_ID), await api.reactivate(UNKNOWN_ID)]) {
      expect([res.statusCode, res.body]).toEqual([404, BODY.NOT_FOUND]);
    }
  });
});

// ---- 8: the acting manager's own account -------------------------------------------------

describe('the acting manager\'s own account', () => {
  const ownMoves = (id: string): [string, () => Promise<Res>][] => [
    ['deactivate', () => api.deactivate(id)],
    ['MANAGER_TO_CASHIER', () => api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: id })],
    ['MANAGER_TO_KITCHEN', () => api.changeRole({ change: 'MANAGER_TO_KITCHEN', staffUserId: id })],
    ['CASHIER_TO_MANAGER', () => api.changeRole({ change: 'CASHIER_TO_MANAGER', staffUserId: id, password: 'a promoted password 1' })],
    ['CASHIER_TO_KITCHEN', () => api.changeRole({ change: 'CASHIER_TO_KITCHEN', staffUserId: id })],
    ['KITCHEN_TO_CASHIER', () => api.changeRole({ change: 'KITCHEN_TO_CASHIER', staffUserId: id, pin: '123456' })],
    ['KITCHEN_TO_MANAGER', () => api.changeRole({ change: 'KITCHEN_TO_MANAGER', staffUserId: id, pin: '123456', password: 'a promoted password 1' })],
  ];

  it('8. deactivate and every change-role move on the actor\'s own id are OWN_ACCOUNT with nothing written', async () => {
    const before = await wholeUsers();
    const audits = (await auditRows()).length;
    for (const [label, send] of ownMoves(manager.id)) {
      const res = await send();
      expect([res.statusCode, res.body], label).toEqual([409, BODY.OWN_ACCOUNT]);
    }
    // The id in any letter case is the same account.
    const upper = await api.deactivate(manager.id.toUpperCase());
    expect([upper.statusCode, upper.body]).toEqual([409, BODY.OWN_ACCOUNT]);
    expect(await wholeUsers()).toEqual(before);
    expect((await auditRows()).length).toBe(audits);
  });

  it('8. the answer comes while another connection holds a lock on the actor\'s row: the check precedes the transaction', async () => {
    const holder = await ownerClient();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT 1 FROM staff_user WHERE id = $1 FOR UPDATE', [manager.id]);
      for (const [label, send] of ownMoves(manager.id).slice(0, 3)) {
        const timeout = new Promise<'WAITED'>((resolve) => setTimeout(() => resolve('WAITED'), 4000));
        const outcome = await Promise.race([send(), timeout]);
        expect(outcome, `${label} waited behind the lock`).not.toBe('WAITED');
        const res = outcome as Res;
        expect([res.statusCode, res.body], label).toEqual([409, BODY.OWN_ACCOUNT]);
      }
    } finally {
      await holder.query('ROLLBACK');
      await holder.end();
    }
  });
});

// ---- 11 and 12: the list -----------------------------------------------------------------

describe('the list', () => {
  it('12. answers every user, active and inactive, in creation order, with the view and nothing else', async () => {
    const first = await kitchen('List Kitchen');
    const second = await people.cashier();
    const third = await people.manager();
    await bump(second.id);
    const res = await api.list();
    expect(res.statusCode).toBe(200);
    const users = usersOf(res);
    const ids = users.map((u) => u.staffUserId);
    expect(ids.indexOf(first)).toBeLessThan(ids.indexOf(second.id));
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(third.id));
    expect(users.find((u) => u.staffUserId === first)).toEqual({ staffUserId: first, name: 'List Kitchen', classification: 'KITCHEN', isActive: true, username: null });
    expect(users.find((u) => u.staffUserId === second.id)).toMatchObject({ classification: 'CASHIER', isActive: false, username: null });
    expect(users.find((u) => u.staffUserId === third.id)).toMatchObject({ classification: 'MANAGER', isActive: true, username: third.username });
    for (const user of users) {
      expect(Object.keys(user).sort()).toEqual(['classification', 'isActive', 'name', 'staffUserId', 'username']);
    }
    const body = res.body;
    expect(body).not.toContain('$argon2id$');
    expect(body).not.toContain('pin');
  });
});
