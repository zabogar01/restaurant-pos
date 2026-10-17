import type { Page } from '@playwright/test';
import { E2E_ORIGIN } from '../support/env.js';
import { expect, signInAtBackOffice, signInAtPos, test, violationsOn } from '../support/fixtures.js';

// The premises: before any later test is trusted, these prove that the harness
// exercises the real thing, in the state the MVP is used in (a certificate the
// owner clicked through). Every request here is made by the page.

const rootState = (page: Page) => page.locator('#root');

/** A request the page makes by itself, with its own origin, cookies and token. */
async function probe(page: Page, path: string): Promise<number> {
  return page.evaluate(async (p) => (await fetch(p)).status, path);
}

test('A1. one origin: both shells and the API are served from the harness origin', async ({ oneProfile }) => {
  const { pos, office, requests } = oneProfile;
  await pos.goto('/pos/');
  await office.goto('/back-office/');
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-out');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-out');

  // Each shell's own first read of its session went out, to this origin. A shell
  // aimed at another origin would have it refused by the policy and sent nowhere,
  // which would leave every request that was sent on the right origin and prove
  // nothing without this.
  const sent = requests.map((request) => new URL(request.url));
  for (const path of ['/api/pos/auth/me', '/api/back-office/auth/me']) {
    expect(sent.filter((url) => url.origin === E2E_ORIGIN && url.pathname === path)).not.toHaveLength(0);
  }

  expect(await probe(pos, '/api/health')).toBe(200);
  expect(await probe(office, '/api/health')).toBe(200);

  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    expect(new URL(request.url).origin).toBe(E2E_ORIGIN);
  }
});

test('A2. the client-instance cookie is stored and resent under a certificate exception', async ({
  oneProfile,
}) => {
  const { pos, context } = oneProfile;
  await pos.goto('/pos/');
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-out');
  // The first request to a route that issues the cookie, wherever it came from.
  expect(await probe(pos, '/api/pos/auth/me')).toBe(401);

  const cookies = (await context.cookies()).filter((c) => c.name === 'rpos_cid');
  expect(cookies).toHaveLength(1);
  expect(cookies[0]).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Strict', path: '/' });

  // Resent: a server that was shown the cookie issues no new one.
  const next = pos.waitForResponse((r) => r.url().endsWith('/api/pos/auth/me'));
  await pos.evaluate(() => fetch('/api/pos/auth/me').then((r) => r.status));
  const headers = await (await next).headersArray();
  expect(headers.filter((h) => h.name.toLowerCase() === 'set-cookie' && h.value.startsWith('rpos_cid='))).toEqual([]);

  expect(await pos.evaluate(() => window.isSecureContext)).toBe(true);
});

test('A3. no content-security violation on either shell, signed out or signed in', async ({
  world,
  oneProfile,
}) => {
  const cashier = await world.people.cashier();
  const manager = await world.people.manager();
  const { pos, office } = oneProfile;

  await pos.goto('/pos/');
  await office.goto('/back-office/');
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-out');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-out');
  expect(await violationsOn(pos)).toEqual([]);
  expect(await violationsOn(office)).toEqual([]);

  await signInAtPos(pos, cashier);
  await signInAtBackOffice(office, manager);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  expect(await violationsOn(pos)).toEqual([]);
  expect(await violationsOn(office)).toEqual([]);
});

test('A4. a bodiless POST carries no Content-Type and is answered 204', async ({ world, oneProfile }) => {
  const cashier = await world.people.cashier();
  const manager = await world.people.manager();
  const { pos, office } = oneProfile;

  await pos.goto('/pos/');
  await signInAtPos(pos, cashier);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');

  async function expectBodiless(page: Page, path: string, act: () => Promise<void>): Promise<void> {
    const sent = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(path));
    await act();
    const request = await sent;
    expect(request.postData()).toBeNull();
    expect(Object.keys(await request.allHeaders())).not.toContain('content-type');
    expect((await request.response())?.status()).toBe(204);
  }

  // An input after sign-in is the leading edge of the activity window.
  await expectBodiless(pos, '/api/pos/auth/activity', () => pos.getByText(cashier.name).click());
  await expectBodiless(pos, '/api/pos/auth/release', () => pos.getByRole('button', { name: 'Release' }).click());

  await office.goto('/back-office/');
  await signInAtBackOffice(office, manager);
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-in');
  await expectBodiless(office, '/api/back-office/auth/logout', () =>
    office.getByRole('button', { name: 'Log out' }).click()
  );
});

test('A5. a cashier signs in at the real pad', async ({ world, oneProfile }) => {
  const cashier = await world.people.cashier();
  const { pos } = oneProfile;
  await pos.goto('/pos/');
  await signInAtPos(pos, cashier);
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-in');
  await expect(pos.getByText(cashier.name)).toBeVisible();
});

test('A6. two visibly different applications', async ({ oneProfile }, testInfo) => {
  const { pos, office } = oneProfile;
  const assets = (page: Page) => page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .filter((p) => p.includes('/assets/'))
  );

  await pos.goto('/pos/');
  await office.goto('/back-office/');
  await expect(rootState(pos)).toHaveAttribute('data-session', 'signed-out');
  await expect(rootState(office)).toHaveAttribute('data-session', 'signed-out');

  // The POS: a pad of digit buttons and no field to type into.
  for (const digit of '1234567890') {
    await expect(pos.getByRole('button', { name: digit, exact: true })).toBeVisible();
  }
  await expect(pos.getByRole('textbox')).toHaveCount(0);

  // The back office: named fields and no digit button.
  await expect(office.getByLabel('Username')).toBeVisible();
  await expect(office.getByLabel('Password')).toBeVisible();
  await expect(office.getByRole('button', { name: /^[0-9]$/ })).toHaveCount(0);

  // Two bundles that share no asset.
  const posAssets = await assets(pos);
  const officeAssets = await assets(office);
  expect(posAssets.length).toBeGreaterThan(0);
  expect(officeAssets.length).toBeGreaterThan(0);
  expect(posAssets.filter((p) => officeAssets.includes(p))).toEqual([]);

  // For the owner's eye, taken before anything is typed.
  await pos.screenshot({ path: testInfo.outputPath('pos-signed-out.png') });
  await office.screenshot({ path: testInfo.outputPath('back-office-signed-out.png') });
});
