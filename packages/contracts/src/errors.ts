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
 * Typed `details` per code. No code carries one yet; a code that does adds its
 * shape here. Details never hold text taken from an exception.
 */
export interface ErrorDetails {}

/**
 * Every non-2xx API response is exactly this. There is no `message` field: the
 * wording a person reads is the client's copy, chosen by code, and a free-text
 * field is where a leak would go.
 */
export interface ErrorBody {
  error: {
    code: ErrorCode;
    details?: ErrorDetails;
  };
}
