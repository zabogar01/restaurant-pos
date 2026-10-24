import type { ApiResult } from '@pos/api-client';
import { ErrorCode, type TenderMethodResponse, type TenderMethodView } from '@pos/contracts';

// BO-08's payment-methods part, the pure half (DESIGN-018, consult C2 section 8): the name
// check, the list's order, and what an answer means. The state and the commands are in
// `model.ts`, because DESIGN-018 allows one form open and one command in flight per screen.

export type NameError = 'empty' | 'long' | 'control';

export const NAME_LIMIT = 32;

/**
 * The method form's own check of the name (DESIGN-018, "Method name (S3)"): the value is
 * trimmed, then refused if empty, over 32 code points, or holding a control character
 * (Unicode Cc), in that order. Lengths count code points, as the contract's `max` does and
 * PostgreSQL's `char_length` does. Nothing is truncated. A test holds this and
 * `TenderMethodName` in agreement. Uniqueness is the server's.
 */
export function checkMethodName(typed: string): { name: string; error: NameError | null } {
  const name = typed.trim();
  const length = [...name].length;
  if (length === 0) return { name, error: 'empty' };
  if (length > NAME_LIMIT) return { name, error: 'long' };
  if (/\p{Cc}/u.test(name)) return { name, error: 'control' };
  return { name, error: null };
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Active first, then inactive; names in natural, case-insensitive order; ties keep the server's order. */
export function orderedMethods(rows: readonly TenderMethodView[]): TenderMethodView[] {
  const rank = (row: TenderMethodView): number => (row.isActive ? 0 : 1);
  return [...rows].sort((a, b) => rank(a) - rank(b) || collator.compare(a.name, b.name));
}

/** Whether two names are the same name to the server's unique index: case-insensitively. */
export const sameName = (a: string, b: string): boolean => collator.compare(a, b) === 0;

export const upsertMethod = (rows: readonly TenderMethodView[], method: TenderMethodView): TenderMethodView[] =>
  rows.some((row) => row.tenderMethodId === method.tenderMethodId)
    ? rows.map((row) => (row.tenderMethodId === method.tenderMethodId ? method : row))
    : [...rows, method];

export type MethodAnswer = ApiResult<TenderMethodResponse>;
export type MethodMeaning = 'ok' | 'duplicate' | 'not-found' | 'session' | 'general' | 'unknown';

/** What an answer means for the form (consult C2 section 6). Never the text of an error. */
export function methodMeaning(answer: MethodAnswer): MethodMeaning {
  switch (answer.kind) {
    case 'ok':
      return 'ok';
    case 'failed':
    case 'unavailable':
      return 'unknown';
    case 'session-gone':
      return 'session';
    case 'invalid-request':
      return 'general';
    case 'refused':
      switch (answer.body.error.code) {
        case ErrorCode.DUPLICATE:
          return 'duplicate';
        case ErrorCode.NOT_FOUND:
          return 'not-found';
        case ErrorCode.SESSION_IDLE:
        case ErrorCode.UNAUTHENTICATED:
        case ErrorCode.FORBIDDEN:
          return 'session';
        default:
          return 'general';
      }
  }
}
