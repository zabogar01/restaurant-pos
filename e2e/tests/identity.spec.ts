import type { Page } from '@playwright/test';
import { expect, signInAtPos, test } from '../support/fixtures.js';

// B-13 and ARCH-014 finding 1: a tab never silently becomes another person. Two POS
// tabs of one browser share one cookie, so when the second tab signs in as someone
// else, the first tab's session is no longer the one its cookie names. This proves
// only that the first tab never shows or acts as the other person; it does not
// promise more than the owner asked for (DECISIONS 2026-10-14, ADR-010's accepted risk).

const rootState = (page: Page) => page.locator('#root');
const ACTIVITY = '/api/pos/auth/activity';
const ME = '/api/pos/auth/me';

test('B11. a POS tab whose cookie was taken by another person ends and never becomes them', async ({
  world,
  oneProfile,
}) => {
  const a = await world.people.cashier();
  const b = await world.people.cashier();
  const tab1 = oneProfile.pos;
  const tab2 = await oneProfile.context.newPage();

  // B's name must never appear on tab 1: watched from before the page's own scripts
  // run, so a flash of it between two assertions would still be caught.
  await tab1.addInitScript((name) => {
    const win = window as unknown as Record<string, boolean>;
    win.sawOther = false;
    new MutationObserver(() => {
      if (document.body?.textContent?.includes(name)) win.sawOther = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  }, b.name);

  // Both tabs are open and signed out before anyone signs in; a tab opened after A's
  // sign-in would simply read A's session.
  await tab1.goto('/pos/');
  await tab2.goto('/pos/');
  await expect(rootState(tab1)).toHaveAttribute('data-session', 'signed-out');
  await expect(rootState(tab2)).toHaveAttribute('data-session', 'signed-out');

  await signInAtPos(tab1, a);
  await expect(rootState(tab1)).toHaveAttribute('data-session', 'signed-in');
  await signInAtPos(tab2, b);
  await expect(rootState(tab2)).toHaveAttribute('data-session', 'signed-in');

  // Tab 1's next input is a request under A's token, and the cookie now names B.
  const refused = tab1.waitForResponse((r) => new URL(r.url()).pathname === ACTIVITY);
  await tab1.getByText(a.name).click();
  await refused;

  // Tab 1 goes to POS-01. The refusal makes the core read the session; that read names
  // someone else, so the core ends this tab's session as ACTOR_CHANGED
  // (packages/api-client/src/client.ts, `run`), and the store draws that end as
  // `invalidated` (apps/pos/src/session/realSession.ts, `onCoreEvent`: every end that
  // is not SESSION_IDLE or SIGNED_OUT).
  await expect(rootState(tab1)).toHaveAttribute('data-session', 'signed-out');
  await expect(tab1.locator('[data-lock-state]')).toHaveAttribute('data-lock-state', 'invalidated');

  await oneProfile.settled();
  const mine = <T extends { page: Page | null }>(list: T[]) => list.filter((item) => item.page === tab1);
  // One refused tap, never retried as B...
  const taps = mine(oneProfile.replies).filter((reply) => reply.method === 'POST' && reply.path === ACTIVITY);
  expect(taps.map((reply) => reply.code)).toEqual(['CSRF_REFUSED']);
  // ...after one read of the session, which named someone else.
  const readsAfterSignIn = mine(oneProfile.replies).filter((reply) => reply.method === 'GET' && reply.path === ME);
  expect(readsAfterSignIn.map((reply) => reply.status)).toEqual([401, 200]);
  expect(mine(oneProfile.requests).filter((r) => new URL(r.url).pathname === ACTIVITY)).toHaveLength(1);

  expect(await tab1.evaluate(() => (window as unknown as Record<string, boolean>).sawOther)).toBe(false);
  await expect(tab1.getByText(b.name)).toHaveCount(0);
  // The tab that did sign in as B is B's, undisturbed.
  await expect(rootState(tab2)).toHaveAttribute('data-session', 'signed-in');
  await expect(tab2.getByText(b.name)).toBeVisible();
});

test('B-scan. the scan finds each PIN in its own sign-in body', async ({ world, oneProfile }) => {
  const a = await world.people.cashier();
  const b = await world.people.cashier();
  const tab1 = oneProfile.pos;
  const tab2 = await oneProfile.context.newPage();
  await tab1.goto('/pos/');
  await tab2.goto('/pos/');
  await signInAtPos(tab1, a);
  await expect(rootState(tab1)).toHaveAttribute('data-session', 'signed-in');
  await signInAtPos(tab2, b);
  await expect(rootState(tab2)).toHaveAttribute('data-session', 'signed-in');
  expect(world.credentialBodies('PIN', a)).toBe(1);
  expect(world.credentialBodies('PIN', b)).toBe(1);
});
