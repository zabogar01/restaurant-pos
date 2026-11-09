import { randomBytes, randomInt } from 'node:crypto';
import type { Page } from '@playwright/test';
import { ledger } from './scan.js';

// BO-06 Staff in a real browser (PHASE1-S8c1). The credentials a spec types into the screen are
// drawn here the way `people.ts` draws a person's: random, independent of the name and of one
// another, and never derived. Each is recorded in the credential ledger as it is submitted, so
// that the AC-18 scan counts it: the number of request bodies of its own routes that hold it must
// equal the number of times the spec submitted it.

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const STEP_MS = 10_000;

function letters(length: number, alphabet: string): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** A name unlike any credential: an upper-case letter, then seven lower-case ones. */
export const drawName = (): string => letters(1, LOWER.toUpperCase()) + letters(7, LOWER);

/** A six-digit PIN the ledger has not met. */
export function drawPin(): string {
  for (;;) {
    const value = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!ledger().isKnown(value)) {
      ledger().know('PIN', value);
      return value;
    }
  }
}

/** A username in its stored form (lower case, 12 letters). */
export function drawUsername(): string {
  const value = letters(12, LOWER);
  ledger().know('username', value);
  return value;
}

export function drawPassword(): string {
  const value = randomBytes(18).toString('base64url');
  ledger().know('password', value);
  return value;
}

export interface NewPerson {
  classification: 'KITCHEN' | 'CASHIER' | 'MANAGER';
  name: string;
  pin?: string;
  /** What is typed into the field, which may differ from the stored form (case and spaces). */
  typedUsername?: string;
  /** The stored form of the username, which the request carries. */
  username?: string;
  password?: string;
}

/**
 * Fills Add person with the fields of one classification and records each credential as
 * submitted. Call it only when the next press is Save on a form that will pass its own check:
 * the scan holds the server to this count. Failures are replaced by a fixed message, like the
 * sign-in helpers, so no diagnostic can spell a credential.
 */
export async function fillNewPerson(page: Page, person: NewPerson): Promise<void> {
  try {
    await page.getByLabel('Name', { exact: true }).fill(person.name, { timeout: STEP_MS });
    await page.getByLabel('Classification', { exact: true }).selectOption(person.classification, { timeout: STEP_MS });
    if (person.pin !== undefined) {
      await page.getByLabel('New PIN', { exact: true }).fill(person.pin, { timeout: STEP_MS });
      ledger().submitted('PIN', person.pin);
    }
    if (person.typedUsername !== undefined) {
      await page.getByLabel('Username', { exact: true }).fill(person.typedUsername, { timeout: STEP_MS });
      ledger().submitted('username', person.username!);
    }
    if (person.password !== undefined) {
      await page.getByLabel('New password', { exact: true }).fill(person.password, { timeout: STEP_MS });
      ledger().submitted('password', person.password);
    }
  } catch {
    throw new Error('filling Add person at the back office failed');
  }
}

/** Types the new PIN of a reactivation and records it as submitted; the next press is its commit. */
export async function fillReactivationPin(page: Page, pin: string): Promise<void> {
  try {
    await page.getByLabel('New PIN', { exact: true }).fill(pin, { timeout: STEP_MS });
    ledger().submitted('PIN', pin);
  } catch {
    throw new Error('entering the new PIN of a reactivation at the back office failed');
  }
}

// PHASE1-S8c2: the role change, the resets, and the own changes. Each helper types what its form
// asks for and records every credential as submitted; the next press is the form's Save.

/** Types the new PIN of a reset of another person's PIN. */
export async function fillResetPin(page: Page, pin: string): Promise<void> {
  try {
    await page.getByLabel('New PIN', { exact: true }).fill(pin, { timeout: STEP_MS });
    ledger().submitted('PIN', pin);
  } catch {
    throw new Error('entering the new PIN of a reset at the back office failed');
  }
}

/** Types the new password of a reset of another manager's password. */
export async function fillResetPassword(page: Page, password: string): Promise<void> {
  try {
    await page.getByLabel('New password', { exact: true }).fill(password, { timeout: STEP_MS });
    ledger().submitted('password', password);
  } catch {
    throw new Error('entering the new password of a reset at the back office failed');
  }
}

export interface OwnChange {
  /** The manager's own current password. */
  current: string;
  password?: string;
  pin?: string;
}

/** Types the current password and the new password or PIN of an own change. */
export async function fillOwnChange(page: Page, change: OwnChange): Promise<void> {
  try {
    await page.getByLabel('Current password', { exact: true }).fill(change.current, { timeout: STEP_MS });
    ledger().submitted('password', change.current);
    if (change.password !== undefined) {
      await page.getByLabel('New password', { exact: true }).fill(change.password, { timeout: STEP_MS });
      ledger().submitted('password', change.password);
    }
    if (change.pin !== undefined) {
      await page.getByLabel('New PIN', { exact: true }).fill(change.pin, { timeout: STEP_MS });
      ledger().submitted('PIN', change.pin);
    }
  } catch {
    throw new Error('filling an own change at the back office failed');
  }
}

export interface Promotion {
  /** What is typed into Username, which may differ from the stored form; omitted for a person who has one. */
  typedUsername?: string;
  username?: string;
  password: string;
  pin?: string;
}

/** Chooses Manager in an open Change role form and types what the promotion asks for. */
export async function fillPromotion(page: Page, promotion: Promotion): Promise<void> {
  try {
    await page.getByLabel('Classification', { exact: true }).selectOption('MANAGER', { timeout: STEP_MS });
    if (promotion.pin !== undefined) {
      await page.getByLabel('New PIN', { exact: true }).fill(promotion.pin, { timeout: STEP_MS });
      ledger().submitted('PIN', promotion.pin);
    }
    if (promotion.typedUsername !== undefined) {
      await page.getByLabel('Username', { exact: true }).fill(promotion.typedUsername, { timeout: STEP_MS });
      ledger().submitted('username', promotion.username!);
    }
    await page.getByLabel('New password', { exact: true }).fill(promotion.password, { timeout: STEP_MS });
    ledger().submitted('password', promotion.password);
  } catch {
    throw new Error('filling a promotion at the back office failed');
  }
}
