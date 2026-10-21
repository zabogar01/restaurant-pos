import { z } from 'zod';

/**
 * The codes an API response can carry. A code enters this list in the task that
 * first emits it and tests it; a code with no emitter is an untested promise.
 */
export const ErrorCode = {
  INTERNAL: 'INTERNAL',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  ORIGIN_REFUSED: 'ORIGIN_REFUSED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_IDLE: 'SESSION_IDLE',
  FORBIDDEN: 'FORBIDDEN',
  CSRF_REFUSED: 'CSRF_REFUSED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  THROTTLED: 'THROTTLED',
  APPROVAL_FAILED: 'APPROVAL_FAILED',
  APPROVAL_THROTTLED: 'APPROVAL_THROTTLED',
  DUPLICATE: 'DUPLICATE',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * The details a code carries, by code. Only the four below declare any; for the other
 * twelve a details argument does not compile. A code that carries details declares
 * its fields here, as numbers, enums or ids the server chose: never a string taken
 * from an exception. `retryAfterSeconds` is a number PostgreSQL computed.
 */
export interface ErrorDetailsByCode {
  INVALID_CREDENTIALS: { retryAfterSeconds: number };
  THROTTLED: { retryAfterSeconds: number };
  APPROVAL_FAILED: { retryAfterSeconds: number };
  APPROVAL_THROTTLED: { retryAfterSeconds: number };
}

/** The details type of one code, or `never` when the code declares none. */
export type ErrorDetailsOf<C extends ErrorCode> = C extends keyof ErrorDetailsByCode
  ? ErrorDetailsByCode[C]
  : never;

/**
 * Every non-2xx API response is exactly this. There is no `message` field: the
 * wording a person reads is the client's copy, chosen by code, and a free-text
 * field is where a leak would go. `details` is typed by the code beside it.
 */
export type ErrorBody = {
  [C in ErrorCode]: {
    error: { code: C } & ([ErrorDetailsOf<C>] extends [never]
      ? { details?: never }
      : { details?: ErrorDetailsOf<C> });
  };
}[ErrorCode];

// A client validates what it receives at its boundary, and what it gets back is an
// ErrorBody: each envelope keeps its own code literal and its own details shape, so
// narrowing on a code exposes that code's details and no other code has any. One
// envelope per code, written out, so no code's literal is widened to the whole union.
const RetryAfter = z.strictObject({ retryAfterSeconds: z.number().int().nonnegative() });

const bare = <C extends ErrorCode>(code: C) =>
  z.strictObject({ error: z.strictObject({ code: z.literal(code) }) });

const withRetry = <C extends keyof ErrorDetailsByCode>(code: C) =>
  z.strictObject({
    error: z.strictObject({ code: z.literal(code), details: RetryAfter.optional() }),
  });

// The four codes that declare details; `satisfies` holds this list to ErrorDetailsByCode.
const WITH_DETAILS = {
  INVALID_CREDENTIALS: withRetry('INVALID_CREDENTIALS'),
  THROTTLED: withRetry('THROTTLED'),
  APPROVAL_FAILED: withRetry('APPROVAL_FAILED'),
  APPROVAL_THROTTLED: withRetry('APPROVAL_THROTTLED'),
} as const satisfies Record<keyof ErrorDetailsByCode, z.ZodType>;

export const ErrorBody = z.union([
  bare(ErrorCode.INTERNAL),
  bare(ErrorCode.UNAVAILABLE),
  bare(ErrorCode.NOT_FOUND),
  bare(ErrorCode.VALIDATION_FAILED),
  bare(ErrorCode.PAYLOAD_TOO_LARGE),
  bare(ErrorCode.UNSUPPORTED_MEDIA_TYPE),
  bare(ErrorCode.ORIGIN_REFUSED),
  bare(ErrorCode.UNAUTHENTICATED),
  bare(ErrorCode.SESSION_IDLE),
  bare(ErrorCode.FORBIDDEN),
  bare(ErrorCode.CSRF_REFUSED),
  WITH_DETAILS.INVALID_CREDENTIALS,
  WITH_DETAILS.THROTTLED,
  WITH_DETAILS.APPROVAL_FAILED,
  WITH_DETAILS.APPROVAL_THROTTLED,
  bare(ErrorCode.DUPLICATE),
  bare(ErrorCode.SETTINGS_CHANGED),
]);

// Both directions at compile time: a code added to ErrorCode and not above, or a
// shape that drifts from the ErrorBody type, stops this compiling.
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type MustBeTrue<T extends true> = T;
export type ErrorBodySchemaMatchesType = MustBeTrue<Mutual<z.infer<typeof ErrorBody>, ErrorBody>>;
