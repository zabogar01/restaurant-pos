// The AC-18 scan: after every test, no PIN, username or password it used may be found
// anywhere but in the request bodies of its own credential route, and in exactly as
// many of those as the test submitted it. A hit is reported by place and by kind
// ("a PIN in the server log"), never by value: the report is itself an artefact
// (B-12), so nothing here may print what it looks for. Every diagnostic is built from
// fixed strings and the credential's kind: nothing taken from a request, a log line or
// a row (a path, a URL, a body) is ever put into one, because that is where a
// credential that leaked would be.

import { E2E_ORIGIN } from './env.js';

export type Kind = 'PIN' | 'username' | 'password';

/** The only routes whose request bodies may carry each kind. */
const OWN_ROUTES: Record<Kind, readonly string[]> = {
  PIN: ['/api/pos/auth/login'],
  username: ['/api/back-office/auth/login'],
  password: ['/api/back-office/auth/login', '/api/back-office/auth/reauthenticate'],
};

export interface Sent {
  method: string;
  url: string;
  body: string | null;
}

/** Everything the scan looks through, gathered by the fixture while the pages are still open. */
export interface Evidence {
  /** Named places, searched whole: the server log, the database rows, the console, the URLs, storage, cookies. */
  places: { place: string; text: string }[];
  requests: Sent[];
}

/**
 * The test's credentials, owned here: what it was given, and how many times it
 * submitted each. The helpers record a submission as they make it, and the fixture
 * records every person and every wrong credential it hands out.
 */
export class Ledger {
  private readonly kinds = new Map<string, Kind>();
  private readonly submissions = new Map<string, number>();

  know(kind: Kind, value: string): void {
    this.kinds.set(value, kind);
  }

  submitted(kind: Kind, value: string): void {
    this.know(kind, value);
    this.submissions.set(value, (this.submissions.get(value) ?? 0) + 1);
  }

  isKnown(value: string): boolean {
    return this.kinds.has(value);
  }

  all(): { kind: Kind; value: string; submissions: number }[] {
    return [...this.kinds].map(([value, kind]) => ({ kind, value, submissions: this.submissions.get(value) ?? 0 }));
  }
}

let active: Ledger | null = null;

export function useLedger(next: Ledger | null): void {
  active = next;
}

export function ledger(): Ledger {
  if (active === null) throw new Error('no credential ledger: the world fixture was not set up');
  return active;
}

/** A PIN is six digits among other digits in a log; it counts only as a whole run of them. */
export function holds(text: string, kind: Kind, value: string): boolean {
  if (kind === 'PIN') return new RegExp(`(?<![0-9])${value}(?![0-9])`).test(text);
  return text.includes(value);
}

/**
 * A credential route is origin, method and path together: a POST to the harness origin
 * whose pathname is the route. Anything else carrying the credential is not a
 * submission, whatever its path says.
 */
function isOwnRoute(kind: Kind, request: Sent): boolean {
  if (request.method !== 'POST') return false;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  return url.origin === E2E_ORIGIN && OWN_ROUTES[kind].includes(url.pathname);
}

/** How many request bodies hold this credential in an accepted submission. */
export function bodiesHolding(requests: Sent[], kind: Kind, value: string): number {
  return requests.filter(
    (request) => request.body !== null && holds(request.body, kind, value) && isOwnRoute(kind, request)
  ).length;
}

/** The problems found, each naming a kind and a place and no value. Empty means clean. */
export function scan(book: Ledger, evidence: Evidence): string[] {
  const problems: string[] = [];
  for (const { kind, value, submissions } of book.all()) {
    for (const { place, text } of evidence.places) {
      if (holds(text, kind, value)) problems.push(`a ${kind} in ${place}`);
    }
    let own = 0;
    for (const request of evidence.requests) {
      if (request.body === null || !holds(request.body, kind, value)) continue;
      if (isOwnRoute(kind, request)) own += 1;
      else problems.push(`a ${kind} in a request body outside its credential route`);
    }
    if (own !== submissions) {
      problems.push(`a ${kind} in ${own} request bodies of its own route, but ${submissions} were submitted`);
    }
  }
  return problems;
}
