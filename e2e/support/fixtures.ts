import { readFileSync, statSync } from 'node:fs';
import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { closePool } from '../../apps/server/src/db/pool.js';
import type { Person } from '../../apps/server/test/support/people.js';
import { resetE2eDatabase } from './database.js';
import { makeHarnessPeople } from './people.js';

export { expect };
export type { Person };

export interface People {
  cashier(): Promise<Person>;
  /** A manager, with a back-office username and password. */
  manager(): Promise<Person>;
}

/**
 * What a context saw, kept in memory for the test and dropped with it. It exists so
 * the AC-18 scan (012b) can ask what a credential reached; 012a asserts on none of
 * it except the origins and the policy violations.
 */
export interface Seen {
  console: string[];
  requests: { method: string; url: string; body: string | null }[];
}

export interface Profile extends Seen {
  context: BrowserContext;
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

async function openProfile(browser: Browser, opened: BrowserContext[]): Promise<Profile> {
  const context = await browser.newContext();
  opened.push(context);
  const seen: Seen = { console: [], requests: [] };
  context.on('console', (message) => seen.console.push(`${message.type()}: ${message.text()}`));
  context.on('request', (request) =>
    seen.requests.push({ method: request.method(), url: request.url(), body: request.postData() })
  );
  await context.addInitScript((key) => {
    const found: string[] = [];
    (window as unknown as Record<string, string[]>)[key] = found;
    document.addEventListener('securitypolicyviolation', (event) => {
      found.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  }, VIOLATIONS);
  return { context, console: seen.console, requests: seen.requests };
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
      await use({
        people: { cashier: () => make.cashier(), manager: () => make.manager() },
        serverLog: () => readFileSync(logPath).subarray(start).toString('utf8'),
      });
    },
    { auto: true },
  ],

  oneProfile: async ({ browser, world }, use) => {
    void world;
    const opened: BrowserContext[] = [];
    try {
      const profile = await openProfile(browser, opened);
      const pos = await profile.context.newPage();
      const office = await profile.context.newPage();
      await use({ ...profile, pos, office });
    } finally {
      await Promise.all(opened.map((context) => context.close()));
    }
  },

  twoProfiles: async ({ browser, world }, use) => {
    void world;
    const opened: BrowserContext[] = [];
    try {
      const a = await openProfile(browser, opened);
      const b = await openProfile(browser, opened);
      await use({
        a: { ...a, page: await a.context.newPage() },
        b: { ...b, page: await b.context.newPage() },
      });
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
    await page.getByRole('button', { name: 'Sign in' }).click({ timeout: STEP_MS });
  } catch {
    throw new Error(`signing in at the back office failed for ${person.name}`);
  }
}
