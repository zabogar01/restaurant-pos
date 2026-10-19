import { randomBytes, randomInt } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { test as base, expect, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';
import { closePool } from '../../apps/server/src/db/pool.js';
import type { Person } from '../../apps/server/test/support/people.js';
import { ownerQuery, resetE2eDatabase } from './database.js';
import { makeHarnessPeople } from './people.js';
import { Ledger, bodiesHolding, ledger, scan, useLedger, type Evidence, type Kind } from './scan.js';

export { expect };
export type { Person };

export interface People {
  cashier(): Promise<Person>;
  /** A manager, with a back-office username and password. */
  manager(): Promise<Person>;
}

/** What the server answered a page's API request with: the envelope's code, never a status alone. */
export interface Reply {
  page: Page | null;
  method: string;
  path: string;
  status: number;
  code: string | null;
  retryAfterSeconds: number | null;
}

/**
 * What a context saw, kept in memory for the test and dropped with it. The AC-18 scan
 * asks it what a credential reached, and the cases ask it which codes the server sent.
 */
export interface Seen {
  console: string[];
  requests: { page: Page | null; method: string; url: string; body: string | null }[];
  replies: Reply[];
}

export interface Profile extends Seen {
  context: BrowserContext;
  /** Resolves when every response seen so far has had its envelope read into `replies`. */
  settled(): Promise<void>;
}

export interface OneProfile extends Profile {
  /** The POS and the back office, two tabs of one browser: one cookie jar. */
  pos: Page;
  office: Page;
}

export interface TwoProfiles {
  /** Two people on two browsers, each with a jar of its own. */
  a: Profile & { page: Page };
  b: Profile & { page: Page };
}

export interface World {
  people: People;
  /** The server's log lines written since this test began. */
  serverLog(): string;
  /** A six-digit PIN no person of this test has, to be typed on purpose; the scan looks for it too. */
  wrongPin(): string;
  /** A password no manager of this test has, to be typed on purpose; the scan looks for it too. */
  wrongPassword(): string;
  /** How many request bodies, across every profile of this test, hold this person's credential. */
  credentialBodies(kind: Kind, person: Person): number;
  /**
   * The AC-18 scan, run by the profile fixtures after the test body and before their
   * pages are closed, because storage and cookies can be read only from a live page.
   */
  scan(): Promise<void>;
  /** Used by the profile fixtures: the scan and `credentialBodies` look through what these saw. */
  watch(profile: Profile): void;
}

interface TestFixtures {
  world: World;
  oneProfile: OneProfile;
  twoProfiles: TwoProfiles;
}

interface WorkerFixtures {
  pool: void;
}

// A violation is recorded by a listener installed before any page script runs, so
// nothing the page does can happen first.
const VIOLATIONS = '__rposViolations';
const UNREAD_MS = 1_500;

async function openProfile(browser: Browser, opened: BrowserContext[]): Promise<Profile> {
  const context = await browser.newContext();
  opened.push(context);
  const seen: Seen = { console: [], requests: [], replies: [] };
  const pending: Promise<void>[] = [];
  const pageOf = (request: Request): Page | null => {
    try {
      return request.frame().page();
    } catch {
      return null;
    }
  };
  context.on('console', (message) => seen.console.push(`${message.type()}: ${message.text()}`));
  context.on('request', (request) =>
    seen.requests.push({ page: pageOf(request), method: request.method(), url: request.url(), body: request.postData() })
  );
  // A reply is listed the moment its headers arrive, so the list is in the order the
  // server answered; the envelope is read after, and `settled` waits for those reads.
  // Only an error's body is read: a successful sign-in's body holds the anti-CSRF token.
  context.on('response', (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/api/')) return;
    const reply: Reply = {
      page: pageOf(response.request()),
      method: response.request().method(),
      path: url.pathname,
      status: response.status(),
      code: null,
      retryAfterSeconds: null,
    };
    seen.replies.push(reply);
    if (reply.status < 400) return;
    pending.push(
      response.json().then(
        (body: { error?: { code?: string; details?: { retryAfterSeconds?: number } } }) => {
          reply.code = body.error?.code ?? null;
          reply.retryAfterSeconds = body.error?.details?.retryAfterSeconds ?? null;
        },
        () => undefined
      )
    );
  });
  await context.addInitScript((key) => {
    const found: string[] = [];
    (window as unknown as Record<string, string[]>)[key] = found;
    document.addEventListener('securitypolicyviolation', (event) => {
      found.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  }, VIOLATIONS);
  return {
    context,
    console: seen.console,
    requests: seen.requests,
    replies: seen.replies,
    settled: async () => {
      // A body the page never reads (a probe that looks only at the status) is not
      // finished until the page goes, and its envelope can then not be read at all.
      // Bounded, so such a reply stays with no code instead of holding the test.
      let timer: NodeJS.Timeout | undefined;
      const gaveUp = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, UNREAD_MS);
      });
      await Promise.race([Promise.all(pending), gaveUp]);
      clearTimeout(timer);
    },
  };
}

/** Every secret place the scan reads, gathered while the pages are still open. */
async function gather(watched: Profile[], serverLog: string): Promise<Evidence> {
  const places: Evidence['places'] = [{ place: 'the server log', text: serverLog }];
  for (const table of ['audit_entry', 'security_event']) {
    const rows = await ownerQuery<{ row: string }>(`SELECT to_jsonb(t)::text AS row FROM ${table} t`);
    places.push({ place: `${table}`, text: rows.map((r) => r.row).join('\n') });
  }
  const requests = watched.flatMap((profile) => profile.requests);
  places.push({ place: 'the console', text: watched.flatMap((p) => p.console).join('\n') });
  const urls = requests.map((request) => request.url);
  const storage: string[] = [];
  const cookies: string[] = [];
  for (const profile of watched) {
    for (const page of profile.context.pages()) {
      urls.push(page.url());
      // A page that cannot be read (closed, or a blank one with no storage) holds nothing to scan.
      storage.push(
        await page
          .evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))
          .catch(() => '')
      );
    }
    for (const cookie of await profile.context.cookies()) cookies.push(cookie.value);
  }
  places.push({ place: 'a URL', text: urls.join('\n') });
  places.push({ place: 'browser storage', text: storage.join('\n') });
  places.push({ place: 'a cookie', text: cookies.join('\n') });
  return { places, requests };
}

/** The content-security violations a page has recorded since it was created. */
export async function violationsOn(page: Page): Promise<string[]> {
  return page.evaluate((key) => (window as unknown as Record<string, string[]>)[key] ?? [], VIOLATIONS);
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // The application pool is the worker's; it is closed once, at the end.
  pool: [
    async ({}, use) => {
      await use();
      await closePool();
    },
    { scope: 'worker', auto: true },
  ],

  // Before every test the schema is dropped and migrated, so AC-19's cooldown, a
  // password counter, a released session and every security event vanish with it.
  // Nothing is deleted and no cooldown is aged out to make room.
  world: [
    async ({}, use) => {
      await resetE2eDatabase();
      const logPath = process.env.E2E_SERVER_LOG;
      if (!logPath) throw new Error('E2E_SERVER_LOG is not set; the harness server was not started by globalSetup');
      const start = statSync(logPath).size;
      // People whose name, PIN, username and password are independent random values,
      // so that no failure diagnostic that names one can spell another.
      const make = makeHarnessPeople();
      const book = new Ledger();
      useLedger(book);
      const watched: Profile[] = [];
      const serverLog = () => readFileSync(logPath).subarray(start).toString('utf8');
      const unused = (draw: () => string): string => {
        for (;;) {
          const value = draw();
          if (!book.isKnown(value)) {
            return value;
          }
        }
      };
      try {
        await use({
          people: {
            cashier: async () => {
              const person = await make.cashier();
              book.know('PIN', person.pin);
              return person;
            },
            manager: async () => {
              const person = await make.manager();
              book.know('PIN', person.pin);
              book.know('username', person.username!);
              book.know('password', person.password!);
              return person;
            },
          },
          serverLog,
          wrongPin: () => {
            const value = unused(() => String(randomInt(0, 1_000_000)).padStart(6, '0'));
            book.know('PIN', value);
            return value;
          },
          wrongPassword: () => {
            const value = unused(() => randomBytes(18).toString('base64url'));
            book.know('password', value);
            return value;
          },
          credentialBodies: (kind, person) => {
            const value = kind === 'PIN' ? person.pin : kind === 'username' ? person.username! : person.password!;
            return bodiesHolding(
              watched.flatMap((profile) => profile.requests),
              kind,
              value
            );
          },
          scan: async () => {
            await Promise.all(watched.map((profile) => profile.settled()));
            const problems = scan(book, await gather(watched, serverLog()));
            if (problems.length > 0) {
              throw new Error(`the AC-18 scan found credentials where they do not belong:\n${problems.join('\n')}`);
            }
          },
          watch: (profile) => {
            watched.push(profile);
          },
        });
      } finally {
        useLedger(null);
      }
    },
    { auto: true },
  ],

  oneProfile: async ({ browser, world }, use) => {
    const opened: BrowserContext[] = [];
    try {
      const profile = await openProfile(browser, opened);
      world.watch(profile);
      const pos = await profile.context.newPage();
      const office = await profile.context.newPage();
      await use({ ...profile, pos, office });
      await world.scan();
    } finally {
      await Promise.all(opened.map((context) => context.close()));
    }
  },

  twoProfiles: async ({ browser, world }, use) => {
    const opened: BrowserContext[] = [];
    try {
      const a = await openProfile(browser, opened);
      const b = await openProfile(browser, opened);
      world.watch(a);
      world.watch(b);
      await use({
        a: { ...a, page: await a.context.newPage() },
        b: { ...b, page: await b.context.newPage() },
      });
      await world.scan();
    } finally {
      await Promise.all(opened.map((context) => context.close()));
    }
  },
});

// A step that cannot finish fails here, inside the catch below, rather than at the
// test's own timeout, which would end the test before the fixed message is thrown.
const STEP_MS = 10_000;

/**
 * Types a person's PIN on the POS pad with its digit buttons, then presses Continue.
 * Playwright's own errors name the locator it was driving, and a digit button's name
 * is the digit, so any failure here is replaced by a fixed message: no original
 * message, stack or cause survives into a report, an `error-context.md` or a log.
 */
export async function signInAtPos(page: Page, person: Pick<Person, 'name' | 'pin'>): Promise<void> {
  try {
    for (const digit of person.pin) {
      await page.getByRole('button', { name: digit, exact: true }).click({ timeout: STEP_MS });
    }
    // The AC-18 scan holds the server to this count: a submission the page never sent, or
    // sent twice, shows as a body count that differs from it.
    ledger().submitted('PIN', person.pin);
    await page.getByRole('button', { name: 'Continue' }).click({ timeout: STEP_MS });
  } catch {
    throw new Error(`entering the PIN at the POS pad failed for ${person.name}`);
  }
}

/** Fills BO-01 and presses Sign in, with the same fixed failure message. */
export async function signInAtBackOffice(
  page: Page,
  person: Pick<Person, 'name' | 'username' | 'password'>
): Promise<void> {
  try {
    await page.getByLabel('Username').fill(person.username!, { timeout: STEP_MS });
    await page.getByLabel('Password').fill(person.password!, { timeout: STEP_MS });
    ledger().submitted('username', person.username!);
    ledger().submitted('password', person.password!);
    await page.getByRole('button', { name: 'Sign in' }).click({ timeout: STEP_MS });
  } catch {
    throw new Error(`signing in at the back office failed for ${person.name}`);
  }
}

/**
 * M-6's same-manager form: the Username is the idled manager's and read-only, so only
 * the Password is typed. The failure message is fixed, like the others.
 */
export async function reauthenticateAtOffice(page: Page, person: Pick<Person, 'name' | 'password'>): Promise<void> {
  try {
    await page.getByLabel('Password').fill(person.password!, { timeout: STEP_MS });
    ledger().submitted('password', person.password!);
    await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: STEP_MS });
  } catch {
    throw new Error(`re-authenticating at the back office failed for ${person.name}`);
  }
}
