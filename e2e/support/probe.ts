import type { Page } from '@playwright/test';
import { ledger } from './scan.js';

// A request with no screen to make it, made by the page itself with its own origin,
// cookies and relative URL (rule 7: nothing is requested from outside the page).

export interface Probed {
  status: number;
  /** The envelope's `error.code`, or null when the answer carried none. */
  code: string | null;
}

/** A GET the page makes by itself. */
export async function probe(page: Page, path: string): Promise<Probed> {
  return page.evaluate(async (p) => {
    const response = await fetch(p);
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    return { status: response.status, code: body?.error?.code ?? null };
  }, path);
}

/**
 * A PIN submitted to the sign-in route by the page, for the case the pad cannot send:
 * while a cooldown runs the pad is disabled, and AC-19 is about what the server does
 * with a correct PIN anyway. The scan counts it as a submission.
 */
export async function submitPin(page: Page, pin: string): Promise<Probed> {
  ledger().submitted('PIN', pin);
  return page.evaluate(async (value) => {
    const response = await fetch('/api/pos/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: value }),
    });
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    return { status: response.status, code: body?.error?.code ?? null };
  }, pin);
}
