import type { Page } from '@playwright/test';
import { expect, signInAtBackOffice, signInAtPos, test } from '../support/fixtures.js';
import { probe } from '../support/probe.js';

// AC-27: one browser profile holds a POS session and a back-office session at once,
// each independent of the other, and each surface refuses the other's session. The
// person is a manager, so that role can never be the reason for a refusal.

const rootState = (page: Page) => page.locator('#root');

test('B3. a manager holds a POS session and a back-office session in one profile', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { pos, office, context } = oneProfile;
  await pos.goto('/pos/');
  await office.goto('/back-office/');

  await signInAtPos(pos, manager);
  await signInAtBackOffice(office, manager);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');

  // Each reads its own cookie again and stays as it was.
  await pos.reload();
  await office.reload();
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');

  // Two cookies of two names, each confined to its own surface's paths: a name the
  // other surface could repeat would make the POS read the back office's.
  const sessions = (await context.cookies()).filter((c) => c.name === 'rpos_pos_sid' || c.name === 'rpos_bo_sid');
  expect(sessions.map((cookie) => cookie.name).sort()).toEqual(['rpos_bo_sid', 'rpos_pos_sid']);
  const named = (name: string) => sessions.find((cookie) => cookie.name === name);
  expect(named('rpos_pos_sid')).toMatchObject({ path: '/api/pos', httpOnly: true, secure: true });
  expect(named('rpos_bo_sid')).toMatchObject({ path: '/api/back-office', httpOnly: true, secure: true });
});

test('B4. ending one session leaves the other', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { pos, office } = oneProfile;
  await pos.goto('/pos/');
  await office.goto('/back-office/');
  await signInAtPos(pos, manager);
  await signInAtBackOffice(office, manager);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');

  // Release at the POS: the back office is still signed in after it reads its cookie again.
  // The POS goes to POS-01 at once, whatever the answer, so the test waits for the
  // server's own answer before it looks at anything else.
  const released = pos.waitForResponse((r) => r.url().endsWith('/api/pos/auth/release'));
  await pos.getByRole('button', { name: 'Release' }).click();
  await released;
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-out');
  await office.reload();
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');

  // A fresh POS sign-in, then a back-office logout: the POS session is untouched.
  await signInAtPos(pos, manager);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
  const loggedOut = office.waitForResponse((r) => r.url().endsWith('/api/back-office/auth/logout'));
  await office.getByRole('button', { name: 'Log out' }).click();
  await loggedOut;
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-out');
  await pos.reload();
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
});

test('B5. a POS session is not a back-office session', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { pos, office } = oneProfile;
  await pos.goto('/pos/');
  await signInAtPos(pos, manager);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');

  // The back office, in the same browser, finds no session of its own: BO-01.
  await office.goto('/back-office/');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-out');
  await expect(office.getByLabel('Username')).toBeVisible();
  expect((await probe(office, '/api/back-office/auth/me')).code).toBe('UNAUTHENTICATED');
});

test('B5. and a back-office session is not a POS session', async ({ world, oneProfile }) => {
  const manager = await world.people.manager();
  const { pos, office } = oneProfile;
  await office.goto('/back-office/');
  await signInAtBackOffice(office, manager);
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');

  await pos.goto('/pos/');
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-out');
  await expect(pos.locator('[data-lock-state]')).toHaveAttribute('data-lock-state', 'resting');
  expect((await probe(pos, '/api/pos/auth/me')).code).toBe('UNAUTHENTICATED');
});

test('B-scan. the scan finds a manager’s PIN, username and password in their own bodies', async ({
  world,
  oneProfile,
}) => {
  const manager = await world.people.manager();
  const { pos, office } = oneProfile;
  await pos.goto('/pos/');
  await office.goto('/back-office/');
  await signInAtPos(pos, manager);
  await signInAtBackOffice(office, manager);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  expect(world.credentialBodies('PIN', manager)).toBe(1);
  expect(world.credentialBodies('username', manager)).toBe(1);
  expect(world.credentialBodies('password', manager)).toBe(1);
});
