import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool } from '../src/db/pool.js';
import { pinLookup } from '../src/domain/pin.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerQuery, resetDatabase } from './support/database.js';
import { makePeople } from './support/people.js';
import { TEST_ORIGIN } from './support/request.js';
import { auditRows, staffRow, userOf, usersApi, wholeUsers } from './support/users.js';
import type { Res } from './support/users.js';

// PHASE1-S8a criterion 10 (and 16, 19): the audit entries. One entry per successful command
// that changes something, naming the acting manager and the user; none for a no-op, a
// refusal or the creation of kitchen staff; and nothing secret in any column.

const people = makePeople(750000);

let app: FastifyInstance;
let api: ReturnType<typeof usersApi>;
let manager: Awaited<ReturnType<typeof people.manager>>;

beforeAll(async () => {
  await resetDatabase();
  app = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent' });
  await app.ready();
  manager = await people.manager();
  const client = new JarClient(app);
  api = usersApi(client);
  expect((await client.signInBackOffice(manager.username, manager.password)).statusCode).toBe(200);
});

afterAll(async () => {
  await app.close();
  await closePool();
});

// Distinct markers: six digits for each PIN, text for each password and username.
const MARK = {
  pins: ['918273', '364859', '572194', '482916', '703815', '261840', '639485', '815726'],
  passwords: [
    'MARKER-password-one-xyz',
    'MARKER-password-two-xyz',
    'MARKER-password-three-xyz',
    'MARKER-password-reset-xyz',
    'MARKER-password-own-xyz',
  ],
  usernames: ['marker.user.one', 'marker.user.two', 'marker.user.three'],
};

interface Step {
  label: string;
  /** The audit action expected, or null where no entry is. */
  action: string | null;
  run: () => Promise<{ res: Res; subjectId?: string }>;
}

async function kitchenRow(): Promise<string> {
  const rows = await ownerQuery<{ id: string }>("INSERT INTO staff_user (name) VALUES ('Marker Kitchen') RETURNING id");
  return rows[0]!.id;
}

describe('the audit entries', () => {
  const bodies: string[] = [];

  it('10 and 16. each successful command writes exactly one entry with its action, the actor and the subject; kitchen staff none', async () => {
    const moved = await people.cashier();
    const toManager = await people.cashier();
    const demote = await people.manager();
    const toKitchenCashier = await people.cashier();
    const toKitchenManager = await people.manager();
    const lifecycle = await people.cashier();
    const newPinCashier = await people.cashier();
    const cookToCashier = await kitchenRow();
    const cookToManager = await kitchenRow();
    const cookBack = await kitchenRow();
    const resetPinCashier = await people.cashier();
    const resetPasswordManager = await people.manager();

    const steps: Step[] = [
      {
        label: 'create a cashier',
        action: 'user.create.cashier',
        run: async () => {
          const res = await api.create({ classification: 'CASHIER', name: 'Marker Cashier', pin: MARK.pins[0] });
          return { res, subjectId: userOf(res).staffUserId };
        },
      },
      {
        label: 'create a manager',
        action: 'user.create.manager',
        run: async () => {
          const res = await api.create({
            classification: 'MANAGER',
            name: 'Marker Manager',
            pin: MARK.pins[1],
            username: MARK.usernames[0],
            password: MARK.passwords[0],
          });
          return { res, subjectId: userOf(res).staffUserId };
        },
      },
      {
        label: 'create kitchen staff',
        action: null,
        run: async () => ({ res: await api.create({ classification: 'KITCHEN', name: 'Marker Cook' }) }),
      },
      {
        label: 'kitchen to cashier',
        action: 'user.role.kitchen_to_cashier',
        run: async () => ({
          res: await api.changeRole({ change: 'KITCHEN_TO_CASHIER', staffUserId: cookToCashier, pin: MARK.pins[2] }),
          subjectId: cookToCashier,
        }),
      },
      {
        label: 'kitchen to manager',
        action: 'user.role.kitchen_to_manager',
        run: async () => ({
          res: await api.changeRole({
            change: 'KITCHEN_TO_MANAGER',
            staffUserId: cookToManager,
            pin: MARK.pins[3],
            password: MARK.passwords[1],
            username: MARK.usernames[1],
          }),
          subjectId: cookToManager,
        }),
      },
      {
        label: 'cashier to manager',
        action: 'user.role.cashier_to_manager',
        run: async () => ({
          res: await api.changeRole({
            change: 'CASHIER_TO_MANAGER',
            staffUserId: toManager.id,
            password: MARK.passwords[2],
            username: MARK.usernames[2],
          }),
          subjectId: toManager.id,
        }),
      },
      {
        label: 'manager to cashier',
        action: 'user.role.manager_to_cashier',
        run: async () => ({
          res: await api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: demote.id }),
          subjectId: demote.id,
        }),
      },
      {
        label: 'cashier to kitchen',
        action: 'user.role.cashier_to_kitchen',
        run: async () => ({
          res: await api.changeRole({ change: 'CASHIER_TO_KITCHEN', staffUserId: toKitchenCashier.id }),
          subjectId: toKitchenCashier.id,
        }),
      },
      {
        label: 'manager to kitchen',
        action: 'user.role.manager_to_kitchen',
        run: async () => ({
          res: await api.changeRole({ change: 'MANAGER_TO_KITCHEN', staffUserId: toKitchenManager.id }),
          subjectId: toKitchenManager.id,
        }),
      },
      {
        label: 'deactivate',
        action: 'user.deactivate',
        run: async () => ({ res: await api.deactivate(lifecycle.id), subjectId: lifecycle.id }),
      },
      {
        label: 'reactivate, keeping the PIN',
        action: 'user.reactivate',
        run: async () => ({ res: await api.reactivate(lifecycle.id), subjectId: lifecycle.id }),
      },
      {
        label: 'deactivate (for the new-PIN reactivation)',
        action: 'user.deactivate',
        run: async () => ({ res: await api.deactivate(newPinCashier.id), subjectId: newPinCashier.id }),
      },
      {
        label: 'reactivate with a new PIN',
        action: 'user.reactivate.new_pin',
        run: async () => ({ res: await api.reactivate(newPinCashier.id, MARK.pins[4]), subjectId: newPinCashier.id }),
      },
      {
        label: 'deactivate a kitchen row',
        action: 'user.deactivate',
        run: async () => ({ res: await api.deactivate(cookBack), subjectId: cookBack }),
      },
      {
        label: 'reactivate a kitchen row',
        action: 'user.reactivate',
        run: async () => ({ res: await api.reactivate(cookBack), subjectId: cookBack }),
      },
      // PHASE1-S8b: the four credential commands, each with marker credentials. The own
      // changes are the acting manager's, and the session carries on through both.
      {
        label: 'set another user\'s PIN',
        action: 'user.pin.reset',
        run: async () => ({
          res: await api.setPin(resetPinCashier.id, MARK.pins[6]),
          subjectId: resetPinCashier.id,
        }),
      },
      {
        label: 'set another manager\'s password',
        action: 'user.password.reset',
        run: async () => ({
          res: await api.setPassword(resetPasswordManager.id, MARK.passwords[3]),
          subjectId: resetPasswordManager.id,
        }),
      },
      {
        label: 'own password',
        action: 'user.own_password.change',
        run: async () => ({
          res: await api.ownPassword(manager.password, MARK.passwords[4]),
          subjectId: manager.id,
        }),
      },
      {
        label: 'own PIN',
        action: 'user.own_pin.change',
        run: async () => ({
          res: await api.ownPin(MARK.passwords[4], MARK.pins[7]),
          subjectId: manager.id,
        }),
      },
    ];

    for (const step of steps) {
      const before = (await auditRows()).length;
      const { res, subjectId } = await step.run();
      bodies.push(res.body);
      expect(res.statusCode, step.label).toBe(200);
      const written = (await auditRows()).slice(before);
      if (step.action === null) {
        expect(written, step.label).toEqual([]);
        continue;
      }
      expect(written, step.label).toEqual([
        {
          actor_id: manager.id,
          approver_id: null,
          action: step.action,
          outcome: 'SUCCESS',
          subject_type: 'staff_user',
          subject_id: subjectId,
          reason: null,
        },
      ]);
    }
  });

  it('10. no entry for a no-op, a refusal or a validation failure', async () => {
    const cashier = await people.cashier();
    const holder = await people.cashier();
    const inactive = await people.cashier();
    expect((await api.deactivate(inactive.id)).statusCode).toBe(200);
    const before = (await auditRows()).length;
    const rows = await wholeUsers();

    const refusals: [string, Res][] = [
      ['deactivating the inactive', await api.deactivate(inactive.id)],
      ['reactivating the active', await api.reactivate(cashier.id)],
      ['reactivating the active with a PIN', await api.reactivate(cashier.id, MARK.pins[5])],
      ['an own deactivation', await api.deactivate(manager.id)],
      ['an own demotion', await api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: manager.id })],
      ['a taken PIN', await api.create({ classification: 'CASHIER', name: 'Dup', pin: holder.pin })],
      ['a stale origin', await api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: cashier.id })],
      ['an unknown id', await api.deactivate('00000000-0000-4000-8000-000000000000')],
      ['a malformed body', await api.create({ classification: 'CASHIER', name: 'No PIN' })],
    ];
    expect(refusals.map(([, res]) => res.statusCode)).toEqual([200, 200, 200, 409, 409, 409, 409, 404, 400]);
    expect(await wholeUsers()).toEqual(rows);
    expect((await auditRows()).length).toBe(before);
  });

  it('10 and 12. no PIN, password, username, lookup or hash is in any audit row, and no PIN, password, lookup or hash in any response', async () => {
    const audit = await ownerQuery<{ r: string }>('SELECT row_to_json(a)::text AS r FROM audit_entry a ORDER BY id');
    expect(audit.length).toBeGreaterThanOrEqual(17);
    const everyRow = audit.map((row) => row.r).join('\n');
    const lookups = MARK.pins.map((pin) => pinLookup(pin));
    const secrets = [...MARK.pins, ...MARK.passwords, ...MARK.usernames, ...lookups, '$argon2id$'];
    for (const secret of secrets) expect(everyRow, secret).not.toContain(secret);

    // A response may carry the username (the view says so); never a PIN, a password, a
    // lookup or a hash.
    const everyBody = bodies.join('\n');
    for (const secret of [...MARK.pins, ...MARK.passwords, ...lookups, '$argon2id$']) {
      expect(everyBody, secret).not.toContain(secret);
    }
  });
});

describe('the audit entry and the change are one transaction', () => {
  const COLUMN = 'action';

  it('19. when the audit insert fails, every command leaves staff_user and back_office_credential unchanged', async () => {
    const cashier = await people.cashier();
    const manager2 = await people.manager();
    const cook = await kitchenRow();
    await ownerQuery('UPDATE staff_user SET is_active = false WHERE id = $1', [cook]);
    const free = MARK.pins[5];
    const before = await wholeUsers();

    // Made to fail through the database's privileges, not through a branch in production.
    await ownerQuery(`REVOKE INSERT (${COLUMN}) ON audit_entry FROM pos_app`);
    try {
      const attempts: [string, Res][] = [
        ['deactivate', await api.deactivate(cashier.id)],
        ['create a cashier', await api.create({ classification: 'CASHIER', name: 'Rolled back', pin: free })],
        [
          'create a manager',
          await api.create({
            classification: 'MANAGER',
            name: 'Rolled back',
            pin: '846201',
            username: 'rolled.back',
            password: 'a password long enough',
          }),
        ],
        [
          'promote',
          await api.changeRole({
            change: 'CASHIER_TO_MANAGER',
            staffUserId: cashier.id,
            password: 'a password long enough',
            username: 'rolled.promo',
          }),
        ],
        ['demote', await api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: manager2.id })],
        ['reactivate a cook', await api.reactivate(cook)],
      ];
      for (const [label, res] of attempts) {
        expect([res.statusCode, res.body], label).toEqual([500, '{"error":{"code":"INTERNAL"}}']);
      }
      expect(await wholeUsers()).toEqual(before);
    } finally {
      await ownerQuery(`GRANT INSERT (${COLUMN}) ON audit_entry TO pos_app`);
    }

    // The same command works once the privilege is back: the failure was the audit write.
    expect((await api.deactivate(cashier.id)).statusCode).toBe(200);
    expect((await staffRow(cashier.id)).is_active).toBe(false);
  });
});
