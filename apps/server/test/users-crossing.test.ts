import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { closePool } from '../src/db/pool.js';
import { buildServer } from '../src/http/server.js';
import { JarClient } from './support/client.js';
import { ownerClient, resetDatabase } from './support/database.js';
import { makePeople } from './support/people.js';
import { TEST_ORIGIN } from './support/request.js';
import { BODY, staffRow, usersApi, waitForLockWaits } from './support/users.js';
import type { Res } from './support/users.js';

// PHASE1-S8a criterion 9: two managers who deactivate (and, separately, demote) each other
// at the same moment. The guard reads each actor's role without a lock, so each passes it;
// only the actor lock of consult C3 section 5 makes the commands serialise, and the second
// finds its actor gone. Both requests are held at the database by a third connection's lock
// on both rows and released together.

const people = makePeople(740000);

let app: FastifyInstance;

beforeAll(async () => {
  await resetDatabase();
  app = buildServer({ origin: TEST_ORIGIN, logLevel: 'silent' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

async function signedInManager() {
  const person = await people.manager();
  const client = new JarClient(app);
  expect((await client.signInBackOffice(person.username, person.password)).statusCode).toBe(200);
  return { person, api: usersApi(client) };
}

/** Sends both commands, holds them at the lock, then lets them go together. */
async function crossing(
  a: { person: { id: string }; api: ReturnType<typeof usersApi> },
  b: { person: { id: string }; api: ReturnType<typeof usersApi> },
  against: (api: ReturnType<typeof usersApi>, targetId: string) => Promise<Res>
): Promise<[Res, Res]> {
  const holder = await ownerClient();
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT 1 FROM staff_user WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [
      [a.person.id, b.person.id],
    ]);
    const first = against(a.api, b.person.id);
    const second = against(b.api, a.person.id);
    await waitForLockWaits(2);
    await holder.query('COMMIT');
    return await Promise.all([first, second]);
  } catch (err) {
    await holder.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await holder.end();
  }
}

describe('two managers acting on each other at once', () => {
  it('9. deactivating each other ends with one success, one UNAUTHENTICATED and one active manager', async () => {
    const a = await signedInManager();
    const b = await signedInManager();
    const results = await crossing(a, b, (api, target) => api.deactivate(target));
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 401]);
    const refused = results.find((r) => r.statusCode === 401)!;
    expect(refused.body).toBe(BODY.UNAUTHENTICATED);
    const active = [(await staffRow(a.person.id)).is_active, (await staffRow(b.person.id)).is_active];
    expect(active.filter(Boolean)).toHaveLength(1);
  });

  it('9. demoting each other ends with one success, one UNAUTHENTICATED and one manager', async () => {
    const a = await signedInManager();
    const b = await signedInManager();
    const results = await crossing(a, b, (api, target) =>
      api.changeRole({ change: 'MANAGER_TO_CASHIER', staffUserId: target })
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 401]);
    expect(results.find((r) => r.statusCode === 401)!.body).toBe(BODY.UNAUTHENTICATED);
    const roles = [(await staffRow(a.person.id)).role, (await staffRow(b.person.id)).role];
    expect(roles.filter((role) => role === 'MANAGER')).toHaveLength(1);
  });
});
