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
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * The details a code carries, by code. None of the six codes that exist declares
 * any, so a details argument for one does not compile. A code that carries
 * details declares its fields here, as numbers, enums or ids the server chose:
 * never a string taken from an exception.
 */
export interface ErrorDetailsByCode {}

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
