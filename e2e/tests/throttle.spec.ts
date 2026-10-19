import type { Page } from '@playwright/test';
import { COOLDOWN_MINUTES, MAX_FAILURES } from '../../apps/server/src/domain/throttle.js';
import { ownerQuery } from '../support/database.js';
import { expect, signInAtPos, test, type Person } from '../support/fixtures.js';
import { probe, submitPin } from '../support/probe.js';

// AC-19 at the real pad: a cooldown that the server keeps, whoever the browser says it is.

const LOGIN = '/api/pos/auth/login';

const rootState = (page: Page) => page.locator('#root');
const lockState = (page: Page) => page.locator('[data-lock-state]');

/** One wrong PIN at the pad, waiting for the server's answer to it. */
async function typeWrongPin(page: Page, who: Person, pin: string): Promise<void> {
  const answered = page.waitForResponse((r) => r.url().endsWith(LOGIN));
  await signInAtPos(page, { name: who.name, pin });
  await answered;
}

/** Five wrong PINs, the last of which starts the cooldown; returns when POS-01 says it is throttled. */
async function exhaustThePad(page: Page, world: { wrongPin(): string }, who: Person): Promise<void> {
  await page.goto('/pos/');
  await expect(rootState(page)).toHaveAttribute('data-session', 'signed-out');
  for (let attempt = 1; attempt <= MAX_FAILURES; attempt += 1) {
    await typeWrongPin(page, who, world.wrongPin());
    await expect(lockState(page)).toHaveAttribute('data-lock-state', attempt < MAX_FAILURES ? 'error' : 'throttled');
  }
}

async function countsOf(table: 'security_event' | 'audit_entry'): Promise<Record<string, number>> {
  const column = table === 'security_event' ? 'event_type' : 'action';
  const rows = await ownerQuery<{ kind: string; n: string }>(
    `SELECT ${column} AS kind, count(*) AS n FROM ${table} GROUP BY ${column}`
  );
  return Object.fromEntries(rows.map((row) => [row.kind, Number(row.n)]));
}

test('B1. five wrong PINs start a cooldown, and then the correct PIN is refused', async ({ world, oneProfile }) => {
  const cashier = await world.people.cashier();
  const { pos } = oneProfile;
  await exhaustThePad(pos, world, cashier);

  await oneProfile.settled();
  const answers = oneProfile.replies.filter((reply) => reply.method === 'POST' && reply.path === LOGIN);
  expect(answers.map((reply) => reply.code)).toEqual(Array(MAX_FAILURES).fill('INVALID_CREDENTIALS'));
  // Only the answer that starts the cooldown says how long it lasts.
  expect(answers.slice(0, -1).map((reply) => reply.retryAfterSeconds)).toEqual(Array(MAX_FAILURES - 1).fill(null));
  const wait = answers[MAX_FAILURES - 1]!.retryAfterSeconds;
  expect(wait).not.toBeNull();
  expect(wait!).toBeGreaterThan(0);
  expect(wait!).toBeLessThanOrEqual(COOLDOWN_MINUTES * 60);

  // The pad is disabled while the cooldown runs, so the correct PIN reaches the server
  // as the page's own request.
  expect(await submitPin(pos, cashier.pin)).toEqual({ status: expect.any(Number), code: 'THROTTLED' });

  // Operational evidence, not an audit trail: no actor, no entry (B-13).
  expect(await countsOf('security_event')).toEqual({ PIN_FAILURE: MAX_FAILURES, COOLDOWN_STARTED: 1 });
  expect(await countsOf('audit_entry')).toEqual({});
  // Nothing signed in.
  expect((await probe(pos, '/api/pos/auth/me')).code).toBe('UNAUTHENTICATED');
});

test('B2. clearing the client-instance cookie does not clear the cooldown', async ({ world, oneProfile }) => {
  const cashier = await world.people.cashier();
  const { pos, context } = oneProfile;
  await exhaustThePad(pos, world, cashier);

  const instance = async () => (await context.cookies()).filter((cookie) => cookie.name === 'rpos_cid');
  const before = await instance();
  expect(before).toHaveLength(1);

  await context.clearCookies({ name: 'rpos_cid' });
  expect(await instance()).toHaveLength(0);

  // The server cannot tell this browser from the one that failed, and must not need to.
  expect((await submitPin(pos, cashier.pin)).code).toBe('THROTTLED');

  const after = await instance();
  expect(after).toHaveLength(1);
  // A different instance was issued, so the cooldown held by the shared bucket and not by a cookie.
  expect(after[0]!.value === before[0]!.value).toBe(false);
  expect((await probe(pos, '/api/pos/auth/me')).code).toBe('UNAUTHENTICATED');
});

test('B-scan. the scan finds a PIN in its own sign-in body, once per submission', async ({ world, oneProfile }) => {
  const cashier = await world.people.cashier();
  const { pos } = oneProfile;
  await pos.goto('/pos/');
  await signInAtPos(pos, cashier);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
  // A scan that looks at nothing would find zero and pass every other test.
  expect(world.credentialBodies('PIN', cashier)).toBe(1);
});
