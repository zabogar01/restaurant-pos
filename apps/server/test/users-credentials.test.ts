import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ROUTE_TABLE } from '@pos/contracts';
import { closePool } from '../src/db/pool.js';
import { verifyPasswordThrottled } from '../src/domain/back-office-credential.js';
import { findUserByPin } from '../src/domain/pin.js';
import { resolveSession } from '../src/domain/session.js';
import { changeOwnPassword, changeOwnPin } from '../src/domain/users.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerClient, ownerQuery, resetDatabase } from './support/database.js';
import {
  ageOutPasswordCooldown,
  failuresOf,
  makePeople,
  securityEvents,
  sessionCount,
  sessionIdOfUser,
  wholeSecurityLog,
} from './support/people.js';
import type { Person } from './support/people.js';
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
  versionOf,
  waitForLockWaits,
  wholeUsers,
} from './support/users.js';
import type { Res } from './support/users.js';

// PHASE1-S8b: the four credential commands (consult C3 sections 3, 4 and 7): another user's
// PIN, another manager's password, and a manager's own password and own PIN, with the
// re-stamp that keeps the session each own change was made from. Cases are numbered by the
// task's acceptance criterion.

const people = makePeople(770000);

let app: FastifyInstance;
let client: JarClient;
let api: ReturnType<typeof usersApi>;
let manager: Person;

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

let counter = 0;
const nextPin = () => String(771000 + (counter += 1));
const NEW_PASSWORD = 'a brand new password 1';
const csrfOf = (token: string) => createHmac('sha256', token).update('rpos-csrf-v1').digest('base64url');

async function kitchen(): Promise<string> {
  const rows = await ownerQuery<{ id: string }>('INSERT INTO staff_user (name) VALUES ($1) RETURNING id', [
    `Kitchen ${nextPin()}`,
  ]);
  return rows[0]!.id;
}

/** A manager signed in at the back office through a profile of their own. */
async function signedIn(person?: Person) {
  const who = person ?? (await people.manager());
  const office = new JarClient(app);
  expect((await office.signInBackOffice(who.username, who.password)).statusCode).toBe(200);
  return { person: who, office, api: usersApi(office), token: office.valueOf('rpos_bo_sid')! };
}

/** Everything about a session row that an own change must leave as it was. */
async function sessionFacts(token: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  const digest = createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
  const rows = await ownerQuery<{ r: string }>(
    `SELECT concat_ws('|', encode(token_hash, 'hex'), issued_at::text, coalesce(released_at::text, '-'),
                      coalesce(absolute_expires_at::text, '-'), staff_user_id::text, audience) AS r
       FROM actor_session WHERE token_hash = decode($1, 'hex')`,
    [digest]
  );
  return rows[0]!.r;
}

const noSetCookie = (res: Res) => expect(res.headers['set-cookie']).toBeUndefined();
const noCsrfToken = (res: Res) => expect(res.body).not.toContain('csrfToken');

// ---- 1: the declarations and the guard ---------------------------------------------------

describe('the four routes', () => {
  const paths = ['set-pin', 'set-password', 'own-password', 'own-pin'].map((p) => `${BASE}/${p}`);

  it('1. are in the route table, interactive, and in the order the task gives', () => {
    const entries = ROUTE_TABLE.filter((e) => paths.includes(e.path));
    expect(entries.map((e) => `${e.method} ${e.path} ${e.interactive}`)).toEqual(
      paths.map((p) => `POST ${p} true`)
    );
  });

  const bodyFor = (path: string, id: string) => {
    if (path.endsWith('/set-pin')) return { staffUserId: id, pin: '123456' };
    if (path.endsWith('/set-password')) return { staffUserId: id, password: NEW_PASSWORD };
    if (path.endsWith('/own-password')) return { currentPassword: 'whatever it was', password: NEW_PASSWORD };
    return { currentPassword: 'whatever it was', pin: '123456' };
  };

  it('2. each refuses no cookie and a POS session in the cookie (401), a demoted manager (403) and a missing or wrong anti-CSRF header (403), writing and counting nothing', async () => {
    const target = (await people.cashier()).id;
    const boToken = client.valueOf('rpos_bo_sid')!;
    const posClient = new JarClient(app);
    expect((await posClient.signInPos((await people.cashier()).pin)).statusCode).toBe(200);
    const posToken = posClient.valueOf('rpos_pos_sid')!;
    const demoted = await signedIn();
    await ownerQuery("UPDATE staff_user SET role = 'CASHIER' WHERE id = $1", [demoted.person.id]);

    const before = await wholeUsers();
    const audits = (await auditRows()).length;
    const events = (await securityEvents()).length;

    for (const path of paths) {
      const send = (cookie: string | undefined, csrf: string | undefined) =>
        inject(app, {
          method: 'POST',
          url: path,
          payload: bodyFor(path, target),
          headers: {
            ...(cookie === undefined ? {} : { cookie }),
            ...(csrf === undefined ? {} : { 'x-rpos-csrf': csrf }),
          },
        });
      const none = await send(undefined, 'x'.repeat(43));
      expect([none.statusCode, none.body], `${path}: no cookie`).toEqual([401, BODY.UNAUTHENTICATED]);
      const pos = await send(`rpos_bo_sid=${posToken}`, csrfOf(posToken));
      expect([pos.statusCode, pos.body], `${path}: a POS token`).toEqual([401, BODY.UNAUTHENTICATED]);
      const forbidden = await send(`rpos_bo_sid=${demoted.token}`, csrfOf(demoted.token));
      expect([forbidden.statusCode, forbidden.body], `${path}: a demoted manager`).toEqual([403, BODY.FORBIDDEN]);
      const missing = await send(`rpos_bo_sid=${boToken}`, undefined);
      expect([missing.statusCode, missing.body], `${path}: no header`).toEqual([403, BODY.CSRF_REFUSED]);
      const wrong = await send(`rpos_bo_sid=${boToken}`, csrfOf(`${boToken}-other`));
      expect([wrong.statusCode, wrong.body], `${path}: wrong header`).toEqual([403, BODY.CSRF_REFUSED]);
    }
    expect(await wholeUsers()).toEqual(before);
    expect((await auditRows()).length).toBe(audits);
    expect((await securityEvents()).length).toBe(events);
  });
});

// ---- 2: another user's PIN ---------------------------------------------------------------

describe('set-pin', () => {
  it('2. the new PIN verifies and the old does not; every session of the person ends; the version moves by one', async () => {
    const person = await people.manager();
    const pos = new JarClient(app);
    expect((await pos.signInPos(person.pin)).statusCode).toBe(200);
    const office = await signedIn(person);
    const sessions = [
      { audience: 'POS' as const, token: pos.valueOf('rpos_pos_sid')! },
      { audience: 'BACK_OFFICE' as const, token: office.token },
    ];
    for (const s of sessions) expect((await resolveSession(s.token, s.audience, false)).status).toBe('ACTIVE');

    const pin = nextPin();
    const res = await api.setPin(person.id, pin);
    expect(res.statusCode).toBe(200);
    expect(userOf(res)).toMatchObject({ staffUserId: person.id, classification: 'MANAGER', username: person.username });
    expect(await findUserByPin(pin)).toMatchObject({ id: person.id });
    expect(await findUserByPin(person.pin)).toBeNull();
    expect(await versionOf(person.id)).toBe(2);
    for (const s of sessions) expect((await resolveSession(s.token, s.audience, false)).status, s.audience).toBe('NONE');
  });

  it('2. a PIN an active user holds is DUPLICATE on pin and changes nothing; an inactive holder\'s is free', async () => {
    const target = await people.cashier();
    const holder = await people.cashier();
    const before = await wholeUsers();
    const audits = (await auditRows()).length;
    const res = await api.setPin(target.id, holder.pin);
    expect([res.statusCode, res.body]).toEqual([409, BODY.DUPLICATE_PIN]);
    expect(await wholeUsers()).toEqual(before);
    expect((await auditRows()).length).toBe(audits);

    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [holder.id]);
    expect((await api.setPin(target.id, holder.pin)).statusCode).toBe(200);
  });

  it('13. an unknown id is NOT_FOUND; an inactive or a kitchen subject is USER_CHANGED; each writes nothing and no entry', async () => {
    const inactive = await people.cashier();
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [inactive.id]);
    const cook = await kitchen();
    const before = await wholeUsers();
    const audits = (await auditRows()).length;
    const unknown = await api.setPin(UNKNOWN_ID, nextPin());
    expect([unknown.statusCode, unknown.body]).toEqual([404, BODY.NOT_FOUND]);
    for (const [label, id] of [['inactive', inactive.id], ['kitchen', cook]] as const) {
      const res = await api.setPin(id, nextPin());
      expect([res.statusCode, res.body], label).toEqual([409, BODY.USER_CHANGED]);
    }
    expect(await wholeUsers()).toEqual(before);
    expect((await auditRows()).length).toBe(audits);
  });

  it('13. a cashier or a manager, active, is set', async () => {
    const cashier = await people.cashier();
    const other = await people.manager();
    for (const person of [cashier, other]) {
      const pin = nextPin();
      expect((await api.setPin(person.id, pin)).statusCode).toBe(200);
      expect(await findUserByPin(pin)).toMatchObject({ id: person.id });
    }
  });
});

// ---- 3: another manager's password -------------------------------------------------------

describe('set-password', () => {
  it('3. the new password verifies and the old does not; every session ends; the throttle columns are what they were, a running cooldown included', async () => {
    const person = await people.manager();
    const office = await signedIn(person);
    const pos = new JarClient(app);
    expect((await pos.signInPos(person.pin)).statusCode).toBe(200);
    await ownerQuery(
      `UPDATE back_office_credential
          SET consecutive_failures = 3, blocked_until = now() + interval '1 hour'
        WHERE staff_user_id = $1`,
      [person.id]
    );
    const before = (await credentialRow(person.id))!;

    const res = await api.setPassword(person.id, NEW_PASSWORD);
    expect(res.statusCode).toBe(200);
    const after = (await credentialRow(person.id))!;
    expect(after.password_hash).not.toBe(before.password_hash);
    expect(after.username).toBe(before.username);
    // Byte for byte: the columns as text, a running cooldown included.
    expect([after.consecutive_failures, after.blocked_until]).toEqual([before.consecutive_failures, before.blocked_until]);
    expect(await versionOf(person.id)).toBe(2);
    expect((await resolveSession(office.token, 'BACK_OFFICE', false)).status).toBe('NONE');
    expect((await resolveSession(pos.valueOf('rpos_pos_sid')!, 'POS', false)).status).toBe('NONE');

    await ageOutPasswordCooldown(person.id);
    expect((await verifyPasswordThrottled({ username: person.username! }, person.password!)).outcome).toBe('FAILED');
    await ageOutPasswordCooldown(person.id);
    expect((await verifyPasswordThrottled({ username: person.username! }, NEW_PASSWORD)).outcome).toBe('VERIFIED');
  });

  it('13. an unknown id is NOT_FOUND; an inactive manager, a cashier, kitchen staff, a former manager and a manager with no credential row are USER_CHANGED; nothing is written', async () => {
    const inactive = await people.manager();
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [inactive.id]);
    const cashier = await people.cashier();
    const cook = await kitchen();
    const formerCashier = await people.manager();
    await ownerQuery("UPDATE staff_user SET role = 'CASHIER' WHERE id = $1", [formerCashier.id]);
    const formerCook = await people.manager();
    await ownerQuery('UPDATE staff_user SET role = NULL, pin_hash = NULL, pin_lookup = NULL WHERE id = $1', [formerCook.id]);
    // A manager made outside the application has no credential row.
    const loginless = await people.cashier();
    await ownerQuery("UPDATE staff_user SET role = 'MANAGER' WHERE id = $1", [loginless.id]);

    const before = await wholeUsers();
    const audits = (await auditRows()).length;
    const unknown = await api.setPassword(UNKNOWN_ID, NEW_PASSWORD);
    expect([unknown.statusCode, unknown.body]).toEqual([404, BODY.NOT_FOUND]);
    for (const [label, id] of [
      ['an inactive manager', inactive.id],
      ['a cashier', cashier.id],
      ['kitchen staff', cook],
      ['a former manager, now a cashier', formerCashier.id],
      ['a former manager, now kitchen', formerCook.id],
      ['a manager with no credential row', loginless.id],
    ] as const) {
      const res = await api.setPassword(id, NEW_PASSWORD);
      expect([res.statusCode, res.body], label).toEqual([409, BODY.USER_CHANGED]);
    }
    expect(await wholeUsers()).toEqual(before);
    expect((await auditRows()).length).toBe(audits);
  });
});

// ---- 13: the acting manager's own account on the other-user commands ---------------------

describe('the other-user commands aimed at oneself', () => {
  it('13. set-pin and set-password on the actor\'s own id, in any letter case, are OWN_ACCOUNT with nothing written', async () => {
    const before = await wholeUsers();
    const audits = (await auditRows()).length;
    for (const [label, res] of [
      ['set-pin', await api.setPin(manager.id, nextPin())],
      ['set-password', await api.setPassword(manager.id, NEW_PASSWORD)],
      ['set-pin upper', await api.setPin(manager.id.toUpperCase(), nextPin())],
      ['set-password upper', await api.setPassword(manager.id.toUpperCase(), NEW_PASSWORD)],
    ] as const) {
      expect([res.statusCode, res.body], label).toEqual([409, BODY.OWN_ACCOUNT]);
    }
    expect(await wholeUsers()).toEqual(before);
    expect((await auditRows()).length).toBe(audits);
  });

  it('13. the answer comes while another connection holds a lock on the actor\'s row', async () => {
    const holder = await ownerClient();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT 1 FROM staff_user WHERE id = $1 FOR UPDATE', [manager.id]);
      for (const [label, send] of [
        ['set-pin', () => api.setPin(manager.id, nextPin())],
        ['set-password', () => api.setPassword(manager.id, NEW_PASSWORD)],
      ] as const) {
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

// ---- 4: the own changes and the re-stamp -------------------------------------------------

describe('the own changes keep the session they were made from', () => {
  it('4. own password: S1 resolves ACTIVE with the same token and anti-CSRF token and its next command succeeds; S2 and P1 end; the new password verifies', async () => {
    const person = await people.manager();
    const s1 = await signedIn(person);
    const s2 = await signedIn(person);
    const p1 = new JarClient(app);
    expect((await p1.signInPos(person.pin)).statusCode).toBe(200);
    const csrf = s1.office.csrfFor('/api/back-office');
    const facts = await sessionFacts(s1.token);

    const res = await s1.api.ownPassword(person.password, NEW_PASSWORD);
    expect(res.statusCode).toBe(200);
    expect(userOf(res)).toMatchObject({ staffUserId: person.id, classification: 'MANAGER' });
    expect(Object.keys(res.json())).toEqual(['user']);
    noSetCookie(res);
    noCsrfToken(res);
    expect(s1.office.csrfFor('/api/back-office')).toBe(csrf);
    expect(s1.office.valueOf('rpos_bo_sid')).toBe(s1.token);
    expect(await sessionFacts(s1.token)).toBe(facts);

    expect((await resolveSession(s1.token, 'BACK_OFFICE', false)).status).toBe('ACTIVE');
    expect((await s1.api.create({ classification: 'KITCHEN', name: 'After own password' })).statusCode).toBe(200);
    expect((await resolveSession(s2.token, 'BACK_OFFICE', false)).status).toBe('NONE');
    expect((await resolveSession(p1.valueOf('rpos_pos_sid')!, 'POS', false)).status).toBe('NONE');
    expect(await versionOf(person.id)).toBe(2);
    expect((await verifyPasswordThrottled({ username: person.username! }, NEW_PASSWORD)).outcome).toBe('VERIFIED');
    expect((await verifyPasswordThrottled({ username: person.username! }, person.password!)).outcome).toBe('FAILED');
  });

  it('4. own PIN: S1 continues, S2 and P1 end, the new PIN verifies at findUserByPin and the old does not', async () => {
    const person = await people.manager();
    const s1 = await signedIn(person);
    const s2 = await signedIn(person);
    const p1 = new JarClient(app);
    expect((await p1.signInPos(person.pin)).statusCode).toBe(200);
    const csrf = s1.office.csrfFor('/api/back-office');
    const facts = await sessionFacts(s1.token);

    const pin = nextPin();
    const res = await s1.api.ownPin(person.password, pin);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json())).toEqual(['user']);
    noSetCookie(res);
    noCsrfToken(res);
    expect(s1.office.csrfFor('/api/back-office')).toBe(csrf);
    expect(await sessionFacts(s1.token)).toBe(facts);
    expect((await resolveSession(s1.token, 'BACK_OFFICE', false)).status).toBe('ACTIVE');
    expect((await s1.api.create({ classification: 'KITCHEN', name: 'After own PIN' })).statusCode).toBe(200);
    expect((await resolveSession(s2.token, 'BACK_OFFICE', false)).status).toBe('NONE');
    expect((await resolveSession(p1.valueOf('rpos_pos_sid')!, 'POS', false)).status).toBe('NONE');
    expect(await findUserByPin(pin)).toMatchObject({ id: person.id });
    expect(await findUserByPin(person.pin)).toBeNull();
    expect(await versionOf(person.id)).toBe(2);
  });

  it('4. only the session the change was made from is re-stamped: another manager\'s sessions are not touched', async () => {
    const a = await signedIn();
    const b = await signedIn();
    expect((await a.api.ownPassword(a.person.password, NEW_PASSWORD)).statusCode).toBe(200);
    expect((await resolveSession(b.token, 'BACK_OFFICE', false)).status).toBe('ACTIVE');
    expect(await versionOf(b.person.id)).toBe(1);
  });
});

// ---- 5 and 6: the re-stamp is in the change's transaction, and exactly one row -----------

describe('the re-stamp', () => {
  async function actingSession(person: Person) {
    const office = await signedIn(person);
    const [sessionId] = await sessionIdOfUser(person.id, 'BACK_OFFICE');
    return { office, actor: { staffUserId: person.id, sessionId: sessionId! } };
  }

  async function holdSession(sessionId: string) {
    const holder = await ownerClient();
    await holder.query('BEGIN');
    await holder.query('SELECT 1 FROM actor_session WHERE id = $1 FOR UPDATE', [sessionId]);
    return holder;
  }

  it('5. with S1\'s session row held, a third connection sees neither the new hash nor the new version until the holder lets go and the command commits', async () => {
    const person = await people.manager();
    const { actor } = await actingSession(person);
    const before = (await credentialRow(person.id))!;
    const holder = await holdSession(actor.sessionId);
    let waiting: Promise<unknown> | undefined;
    try {
      waiting = changeOwnPassword(actor, 1, NEW_PASSWORD);
      await waitForLockWaits(1);
      expect((await credentialRow(person.id))!.password_hash).toBe(before.password_hash);
      expect(await versionOf(person.id)).toBe(1);
      expect((await auditRows()).filter((r) => r.subject_id === person.id)).toEqual([]);
    } finally {
      await holder.query('ROLLBACK');
      await holder.end();
    }
    expect(await waiting).toEqual({ kind: 'OK', user: expect.objectContaining({ staffUserId: person.id }) });
    expect((await credentialRow(person.id))!.password_hash).not.toBe(before.password_hash);
    expect(await versionOf(person.id)).toBe(2);
  });

  it('6. a session released before the transaction is refused by the lock\'s own read: UNAUTHENTICATED, nothing changes', async () => {
    const person = await people.manager();
    const { actor, office } = await actingSession(person);
    await ownerQuery('UPDATE actor_session SET released_at = now() WHERE id = $1', [actor.sessionId]);
    const before = (await credentialRow(person.id))!;
    const audits = (await auditRows()).length;
    expect(await changeOwnPassword(actor, 1, NEW_PASSWORD)).toEqual({ kind: 'UNAUTHENTICATED' });
    expect(await changeOwnPin(actor, 1, nextPin())).toEqual({ kind: 'UNAUTHENTICATED' });
    expect((await credentialRow(person.id))!.password_hash).toBe(before.password_hash);
    expect(await versionOf(person.id)).toBe(1);
    expect((await auditRows()).length).toBe(audits);
    void office;
  });

  it('6. a session released inside the window, while the command waits at the re-stamp, is UNAUTHENTICATED; the hash, the PIN, the version and the audit table are as they were', async () => {
    for (const kind of ['password', 'pin'] as const) {
      const person = await people.manager();
      const { actor } = await actingSession(person);
      const hash = (await credentialRow(person.id))!.password_hash;
      const staff = await staffRow(person.id);
      const audits = (await auditRows()).length;
      const holder = await holdSession(actor.sessionId);
      let waiting: Promise<unknown> | undefined;
      try {
        waiting = kind === 'password' ? changeOwnPassword(actor, 1, NEW_PASSWORD) : changeOwnPin(actor, 1, nextPin());
        await waitForLockWaits(1);
        await holder.query('UPDATE actor_session SET released_at = now() WHERE id = $1', [actor.sessionId]);
        await holder.query('COMMIT');
      } finally {
        await holder.query('ROLLBACK').catch(() => undefined);
        await holder.end();
      }
      expect(await waiting, kind).toEqual({ kind: 'UNAUTHENTICATED' });
      expect((await credentialRow(person.id))!.password_hash, kind).toBe(hash);
      const after = await staffRow(person.id);
      expect([after.pin_hash, after.pin_lookup, after.credential_version], kind).toEqual([
        staff.pin_hash,
        staff.pin_lookup,
        1,
      ]);
      expect((await auditRows()).length, kind).toBe(audits);
    }
  });
});

// ---- 7: the current password -------------------------------------------------------------

describe('the current password', () => {
  it('7. wrong is 401 INVALID_CREDENTIALS, with retryAfterSeconds only on the fifth; then 429 THROTTLED with nothing verified; one PASSWORD_FAILURE each and COOLDOWN_STARTED on the fifth, naming nobody; no entry; the session as it was', async () => {
    const s = await signedIn();
    const id = s.person.id;
    const facts = await sessionFacts(s.token);
    const sessions = await sessionCount();
    const audits = (await auditRows()).length;
    const events = (await securityEvents()).length;
    const before = (await credentialRow(id))!;

    const answers: Res[] = [];
    for (let i = 0; i < 5; i += 1) answers.push(await s.api.ownPassword('not the password', NEW_PASSWORD));
    for (const [i, res] of answers.entries()) {
      expect(res.statusCode, `attempt ${i + 1}`).toBe(401);
      noSetCookie(res);
      const error = (res.json() as { error: { code: string; details?: { retryAfterSeconds: number } } }).error;
      expect(error.code).toBe('INVALID_CREDENTIALS');
      if (i < 4) expect(res.body).toBe(BODY.INVALID_CREDENTIALS);
      else expect(error.details?.retryAfterSeconds).toBeGreaterThan(290);
    }
    expect(await failuresOf(id)).toBe(5);

    // Throttled: even the right password verifies nothing now.
    const throttled = await s.api.ownPin(s.person.password, nextPin());
    expect(throttled.statusCode).toBe(429);
    const t = (throttled.json() as { error: { code: string; details: { retryAfterSeconds: number } } }).error;
    expect(t.code).toBe('THROTTLED');
    expect(t.details.retryAfterSeconds).toBeGreaterThan(290);
    noSetCookie(throttled);
    expect(await failuresOf(id)).toBe(5);

    const written = (await securityEvents()).slice(events);
    expect(written.map((e) => `${e.event_type} ${e.throttle_class}`)).toEqual([
      ...Array(5).fill('PASSWORD_FAILURE BACK_OFFICE_LOGIN'),
      'COOLDOWN_STARTED BACK_OFFICE_LOGIN',
    ]);
    expect(await wholeSecurityLog()).not.toContain(id);
    expect((await auditRows()).length).toBe(audits);
    expect(await sessionCount()).toBe(sessions);
    expect(await sessionFacts(s.token)).toBe(facts);
    expect((await credentialRow(id))!.password_hash).toBe(before.password_hash);
    expect(await versionOf(id)).toBe(1);
  });

  it('7. a username in the body is VALIDATION_FAILED, and the verification is of the session\'s manager: another manager\'s password, named by username, verifies nobody', async () => {
    const s = await signedIn();
    const other = await people.manager();
    const mine = await failuresOf(s.person.id);
    const theirs = await failuresOf(other.id);
    const events = (await securityEvents()).length;
    for (const route of ['own-password', 'own-pin']) {
      const body =
        route === 'own-password'
          ? { username: other.username, currentPassword: other.password, password: NEW_PASSWORD }
          : { username: other.username, currentPassword: other.password, pin: nextPin() };
      const res = await s.api.post(route, body);
      expect([res.statusCode, res.body], route).toEqual([400, BODY.VALIDATION]);
    }
    // The other manager's password, sent as the current password, is a failure on the actor.
    const res = await s.api.ownPassword(other.password, NEW_PASSWORD);
    expect([res.statusCode, res.body]).toEqual([401, BODY.INVALID_CREDENTIALS]);
    expect(await failuresOf(s.person.id)).toBe(mine + 1);
    expect(await failuresOf(other.id)).toBe(theirs);
    expect((await securityEvents()).length).toBe(events + 1);
  });

  it('7. a right current password resets the account\'s count', async () => {
    const s = await signedIn();
    expect((await s.api.ownPassword('wrong one', NEW_PASSWORD)).statusCode).toBe(401);
    expect(await failuresOf(s.person.id)).toBe(1);
    expect((await s.api.ownPin(s.person.password, nextPin())).statusCode).toBe(200);
    expect(await failuresOf(s.person.id)).toBe(0);
  });
});

// ---- 8: a taken PIN on own PIN -----------------------------------------------------------

describe('own PIN taken', () => {
  it('8. DUPLICATE on pin leaves the hash, the version, the PIN and the session as they were', async () => {
    const s = await signedIn();
    const holder = await people.cashier();
    const staff = await staffRow(s.person.id);
    const hash = (await credentialRow(s.person.id))!.password_hash;
    const facts = await sessionFacts(s.token);
    const audits = (await auditRows()).length;
    const res = await s.api.ownPin(s.person.password, holder.pin);
    expect([res.statusCode, res.body]).toEqual([409, BODY.DUPLICATE_PIN]);
    noSetCookie(res);
    expect(await staffRow(s.person.id)).toEqual(staff);
    expect((await credentialRow(s.person.id))!.password_hash).toBe(hash);
    expect(await sessionFacts(s.token)).toBe(facts);
    expect((await resolveSession(s.token, 'BACK_OFFICE', false)).status).toBe('ACTIVE');
    expect((await auditRows()).length).toBe(audits);
  });
});

// ---- 9: the audit ------------------------------------------------------------------------

describe('the audit entries', () => {
  it('9. each success writes one entry with its action, the actor and the subject; the own ones name the actor as the subject', async () => {
    const s = await signedIn();
    const cashier = await people.cashier();
    const target = await people.manager();
    const steps: [string, () => Promise<Res>, string, string][] = [
      ['user.pin.reset', () => api.setPin(cashier.id, nextPin()), manager.id, cashier.id],
      ['user.password.reset', () => api.setPassword(target.id, NEW_PASSWORD), manager.id, target.id],
      ['user.own_password.change', () => s.api.ownPassword(s.person.password, 'own new password 12'), s.person.id, s.person.id],
      ['user.own_pin.change', () => s.api.ownPin('own new password 12', nextPin()), s.person.id, s.person.id],
    ];
    for (const [action, run, actorId, subjectId] of steps) {
      const before = (await auditRows()).length;
      const res = await run();
      expect(res.statusCode, action).toBe(200);
      expect((await auditRows()).slice(before), action).toEqual([
        { actor_id: actorId, approver_id: null, action, outcome: 'SUCCESS', subject_type: 'staff_user', subject_id: subjectId, reason: null },
      ]);
    }
  });

  it('9. when the audit insert fails, each of the four leaves the hash, the PIN, the version and the session as they were', async () => {
    const s = await signedIn();
    const cashier = await people.cashier();
    const target = await people.manager();
    const staff = await Promise.all([s.person.id, cashier.id, target.id].map(staffRow));
    const hashes = await Promise.all([s.person.id, target.id].map(async (id) => (await credentialRow(id))!.password_hash));
    const facts = await sessionFacts(s.token);
    await ownerQuery('REVOKE INSERT (action) ON audit_entry FROM pos_app');
    try {
      const attempts: [string, Res][] = [
        ['set-pin', await api.setPin(cashier.id, nextPin())],
        ['set-password', await api.setPassword(target.id, NEW_PASSWORD)],
        ['own-password', await s.api.ownPassword(s.person.password, NEW_PASSWORD)],
        ['own-pin', await s.api.ownPin(s.person.password, nextPin())],
      ];
      for (const [label, res] of attempts) expect([res.statusCode, res.body], label).toEqual([500, BODY.INTERNAL]);
    } finally {
      await ownerQuery('GRANT INSERT (action) ON audit_entry TO pos_app');
    }
    expect(await Promise.all([s.person.id, cashier.id, target.id].map(staffRow))).toEqual(staff);
    expect(await Promise.all([s.person.id, target.id].map(async (id) => (await credentialRow(id))!.password_hash))).toEqual(hashes);
    expect(await sessionFacts(s.token)).toBe(facts);
    expect((await resolveSession(s.token, 'BACK_OFFICE', false)).status).toBe('ACTIVE');
  });
});

// ---- 12: the same value ------------------------------------------------------------------

describe('a credential set to the value it already had', () => {
  it('12. a PIN reset, a password reset, an own PIN and an own password to the current values each succeed, increment by one and write one entry; the own ones re-stamp', async () => {
    const cashier = await people.cashier();
    const target = await people.manager();
    const s = await signedIn();
    const steps: [string, string, () => Promise<Res>][] = [
      ['user.pin.reset', cashier.id, () => api.setPin(cashier.id, cashier.pin)],
      ['user.password.reset', target.id, () => api.setPassword(target.id, target.password!)],
      ['user.own_pin.change', s.person.id, () => s.api.ownPin(s.person.password, s.person.pin)],
      ['user.own_password.change', s.person.id, () => s.api.ownPassword(s.person.password, s.person.password!)],
    ];
    for (const [action, subjectId, run] of steps) {
      const version = await versionOf(subjectId);
      const entries = (await auditRows()).length;
      const res = await run();
      expect(res.statusCode, action).toBe(200);
      expect(await versionOf(subjectId), action).toBe(version + 1);
      const written = (await auditRows()).slice(entries);
      expect(written.map((r) => r.action), action).toEqual([action]);
    }
    expect((await resolveSession(s.token, 'BACK_OFFICE', false)).status).toBe('ACTIVE');
    expect(await findUserByPin(s.person.pin)).toMatchObject({ id: s.person.id });
  });
});

// ---- 14: the schema runs before the verification ----------------------------------------

describe('a malformed new secret', () => {
  it('14. is VALIDATION_FAILED with the account\'s count unchanged and no PASSWORD_FAILURE written, even beside a wrong current password', async () => {
    const s = await signedIn();
    const events = (await securityEvents()).length;
    const failures = await failuresOf(s.person.id);
    const audits = (await auditRows()).length;
    for (const [label, res] of [
      ['a short password', await s.api.ownPassword('not the password', 'short')],
      ['a short password, right current', await s.api.ownPassword(s.person.password, 'short')],
      ['a five-digit PIN', await s.api.ownPin('not the password', '12345')],
      ['a numeric PIN', await s.api.ownPin(s.person.password, 123456)],
      ['an empty current password', await s.api.ownPin('', nextPin())],
      ['an extra key', await s.api.post('own-pin', { currentPassword: 'x', pin: nextPin(), extra: 1 })],
      ['a missing current password', await s.api.post('own-password', { password: NEW_PASSWORD })],
    ] as const) {
      expect([res.statusCode, res.body], label).toEqual([400, BODY.VALIDATION]);
    }
    expect(await failuresOf(s.person.id)).toBe(failures);
    expect((await securityEvents()).length).toBe(events);
    expect((await auditRows()).length).toBe(audits);
  });
});

// ---- 15: the session is as it was, on every refusal --------------------------------------

describe('the session on every outcome of an own change', () => {
  it('15. success, VALIDATION_FAILED, INVALID_CREDENTIALS, DUPLICATE and THROTTLED carry no Set-Cookie and no csrfToken, and leave the token, issued_at and released_at as they were', async () => {
    const s = await signedIn();
    const holder = await people.cashier();
    const facts = await sessionFacts(s.token);
    const csrf = s.office.csrfFor('/api/back-office');
    const outcomes: [string, number, Res][] = [
      ['success', 200, await s.api.ownPin(s.person.password, nextPin())],
      ['VALIDATION_FAILED', 400, await s.api.ownPin(s.person.password, '1')],
      ['DUPLICATE', 409, await s.api.ownPin(s.person.password, holder.pin)],
      ['INVALID_CREDENTIALS', 401, await s.api.ownPassword('wrong', NEW_PASSWORD)],
    ];
    for (let i = 0; i < 4; i += 1) await s.api.ownPassword('wrong', NEW_PASSWORD);
    outcomes.push(['THROTTLED', 429, await s.api.ownPassword('wrong', NEW_PASSWORD)]);
    for (const [label, status, res] of outcomes) {
      expect(res.statusCode, label).toBe(status);
      noSetCookie(res);
      noCsrfToken(res);
      expect(await sessionFacts(s.token), label).toBe(facts);
      expect(s.office.csrfFor('/api/back-office'), label).toBe(csrf);
    }
  });

  it('15 and 16. UNAUTHENTICATED from the change\'s own lock (another manager moved this one\'s version after the verification) carries no Set-Cookie and writes nothing', async () => {
    const s = await signedIn();
    const facts = await sessionFacts(s.token);
    const before = (await credentialRow(s.person.id))!;
    const audits = (await auditRows()).length;
    const holder = await ownerClient();
    let pending: Promise<Res> | undefined;
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT 1 FROM staff_user WHERE id = $1 FOR UPDATE', [s.person.id]);
      pending = s.api.ownPassword(s.person.password, NEW_PASSWORD);
      await waitForLockWaits(1);
      // A reset by another manager, committed between the verification and the transaction.
      await holder.query('UPDATE staff_user SET credential_version = credential_version + 1 WHERE id = $1', [s.person.id]);
      await holder.query('COMMIT');
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined);
      await holder.end();
    }
    const res = await pending!;
    expect([res.statusCode, res.body]).toEqual([401, BODY.UNAUTHENTICATED]);
    noSetCookie(res);
    expect(await sessionFacts(s.token)).toBe(facts);
    expect((await credentialRow(s.person.id))!.password_hash).toBe(before.password_hash);
    expect((await auditRows()).length).toBe(audits);
  });

  it('16. a password reset of the acting manager by another manager, committed between the verification and the transaction, answers UNAUTHENTICATED and writes nothing (domain level)', async () => {
    const person = await people.manager();
    const s = await signedIn(person);
    const [sessionId] = await sessionIdOfUser(person.id, 'BACK_OFFICE');
    const actor = { staffUserId: person.id, sessionId: sessionId! };
    const verified = await verifyPasswordThrottled({ staffUserId: person.id }, person.password!);
    expect(verified.outcome).toBe('VERIFIED');
    const version = verified.outcome === 'VERIFIED' ? verified.user.credentialVersion : -1;

    expect((await api.setPassword(person.id, NEW_PASSWORD)).statusCode).toBe(200);
    const reset = (await credentialRow(person.id))!;
    const audits = (await auditRows()).length;
    expect(await changeOwnPassword(actor, version, 'a third password 3')).toEqual({ kind: 'UNAUTHENTICATED' });
    expect(await changeOwnPin(actor, version, nextPin())).toEqual({ kind: 'UNAUTHENTICATED' });
    expect((await credentialRow(person.id))!.password_hash).toBe(reset.password_hash);
    expect(await versionOf(person.id)).toBe(version + 1);
    expect((await auditRows()).length).toBe(audits);
    void s;
  });

  it('16. a verification that is not for the version the lock finds is refused too, with the session untouched', async () => {
    const person = await people.manager();
    await signedIn(person);
    const [sessionId] = await sessionIdOfUser(person.id, 'BACK_OFFICE');
    const actor = { staffUserId: person.id, sessionId: sessionId! };
    const hash = (await credentialRow(person.id))!.password_hash;
    expect(await changeOwnPassword(actor, 0, NEW_PASSWORD)).toEqual({ kind: 'UNAUTHENTICATED' });
    expect((await credentialRow(person.id))!.password_hash).toBe(hash);
    expect(await versionOf(person.id)).toBe(1);
  });
});
