import { randomBytes, randomInt } from 'node:crypto';
import { test as plain, expect as plainExpect } from '@playwright/test';
import { E2E_ORIGIN } from '../support/env.js';
import { expect, test } from '../support/fixtures.js';
import { Ledger, bodiesHolding, scan, type Sent } from '../support/scan.js';

// The scan is itself under test. The first group needs no browser page: it feeds the
// scanner evidence it was built to reject and checks what it says. The last is the
// proof that every same-document URL change reaches the scan's evidence in both engines.

const LOGIN = `${E2E_ORIGIN}/api/back-office/auth/login`;
const secretPassword = () => randomBytes(18).toString('base64url');
const evidence = (requests: Sent[]) => ({ places: [], requests });
const body = (password: string) => JSON.stringify({ password });

/** The scan must fail, and nothing it says may contain what it found. */
function expectFailureWithoutSecret(problems: string[], secret: string): void {
  plainExpect(problems.length).toBeGreaterThan(0);
  plainExpect(problems.some((problem) => problem.includes(secret))).toBe(false);
}

plain('F1. a credential in a request path and body is reported without being repeated', () => {
  const password = secretPassword();
  const book = new Ledger();
  book.submitted('password', password);
  const problems = scan(
    book,
    evidence([
      { method: 'POST', url: LOGIN, body: body(password) },
      { method: 'POST', url: `${E2E_ORIGIN}/api/elsewhere/${password}`, body: body(password) },
    ])
  );
  expectFailureWithoutSecret(problems, password);
});

plain('F1. and a PIN in a path or a place is reported without being repeated', () => {
  const pin = String(randomInt(100_000, 1_000_000));
  const book = new Ledger();
  book.submitted('PIN', pin);
  const problems = scan(book, {
    places: [{ place: 'a URL', text: `${E2E_ORIGIN}/pos/?x=${pin}` }],
    requests: [{ method: 'POST', url: `${E2E_ORIGIN}/api/pos/auth/login/${pin}`, body: JSON.stringify({ pin }) }],
  });
  expectFailureWithoutSecret(problems, pin);
});

plain('F2. only a POST to the harness origin on the credential’s own path is a submission', () => {
  const password = secretPassword();
  const allowed: Sent = { method: 'POST', url: LOGIN, body: body(password) };
  const wrongMethod: Sent = { method: 'PUT', url: LOGIN, body: body(password) };
  const wrongOrigin: Sent = { method: 'POST', url: 'https://localhost:1/api/back-office/auth/login', body: body(password) };

  const book = new Ledger();
  book.submitted('password', password);
  plainExpect(scan(book, evidence([allowed]))).toEqual([]);
  plainExpect(bodiesHolding([allowed], 'password', password)).toBe(1);

  for (const refused of [wrongMethod, wrongOrigin]) {
    // The submission is one the test made, so it is missing from the accepted ones too.
    const problems = scan(book, evidence([allowed, refused]));
    expectFailureWithoutSecret(problems, password);
    plainExpect(bodiesHolding([allowed, refused], 'password', password)).toBe(1);
    plainExpect(bodiesHolding([refused], 'password', password)).toBe(0);
  }
});

// F3: a client that puts a credential in a URL without a request, and restores the URL
// at once, leaves nothing on the network and a clean URL at the end. The scan reads the
// URLs the page reported as it changed. Two channels are relied on, so each is shown to
// fire for every kind of same-document change, in whichever engine this runs in.
test('F3. every same-document URL change is on record, from the page and from the navigation events', async ({
  oneProfile,
}) => {
  const { pos, context, visited } = oneProfile;
  const mark = () => randomBytes(6).toString('hex');
  const [pushed, replaced, hashed, closed] = [mark(), mark(), mark(), mark()];
  const has = (list: string[], marker: string) => list.some((url) => url.includes(marker));

  await pos.goto('/pos/');
  await pos.evaluate((m) => history.pushState(null, '', `/pos/?push=${m}`), pushed);
  await pos.evaluate((m) => history.replaceState(null, '', `/pos/?replace=${m}`), replaced);
  await pos.evaluate((m) => (location.hash = m), hashed);
  // Back out of the hash change: a popstate and a hashchange, the URL clean again.
  await pos.evaluate(() => history.back());
  await expect.poll(() => pos.url()).not.toContain(hashed);

  // A page that is closed keeps its history in the record.
  const other = await context.newPage();
  await other.goto(`/pos/?real=${closed}`);
  await other.close();

  for (const channel of [visited.fromPage, visited.fromNavigation]) {
    for (const marker of [pushed, replaced, hashed, closed]) {
      expect(has(channel, marker)).toBe(true);
    }
  }
  // The way back (popstate / hashchange) was reported too: a clean URL follows the marked one.
  const lastMarked = visited.fromPage.map((url) => url.includes(hashed)).lastIndexOf(true);
  expect(lastMarked).toBeLessThan(visited.fromPage.length - 1);
});
