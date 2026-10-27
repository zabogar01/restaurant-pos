import type { ApiResult } from '@pos/api-client';
import { ErrorCode } from '@pos/contracts';

// What a command's answer means to a configuration screen (consult C2 section 6), shared by the
// models of BO-03 and BO-04 (extracted at the second copy). Never the text of an error: the
// meaning is read from the answer's kind and, for a refusal, its code.

export type Failure = Exclude<ApiResult<never>, { kind: 'ok' }>;
export type Answered<A> = { kind: 'ok'; applied: A } | Failure;
export type Meaning = 'saved' | 'unchanged' | 'stale' | 'duplicate' | 'gone' | 'session' | 'general' | 'unknown';

/**
 * An edit's `ok` is read against the version it carried: equal is *unchanged*, one ahead or more
 * is *saved*, anything behind is not an answer to this command. The commands that carry no
 * version are *saved* when ok.
 */
export function meaningOf(answer: Answered<{ version: number }>, expected: number | null): Meaning {
  switch (answer.kind) {
    case 'ok': {
      if (expected === null) return 'saved';
      const { version } = answer.applied;
      if (version === expected) return 'unchanged';
      return version > expected ? 'saved' : 'unknown';
    }
    case 'failed':
    case 'unavailable':
      return 'unknown';
    case 'session-gone':
      return 'session';
    case 'invalid-request':
      return 'general';
    case 'refused':
      switch (answer.body.error.code) {
        case ErrorCode.CATALOG_CHANGED:
          return 'stale';
        case ErrorCode.DUPLICATE:
          return 'duplicate';
        // Unreachable today: these clients name only records they have read and send what their
        // own checks accept. Each is the definite failure of the command, with the list reread once.
        case ErrorCode.NOT_FOUND:
        case ErrorCode.VALIDATION_FAILED:
          return 'gone';
        case ErrorCode.SESSION_IDLE:
        case ErrorCode.UNAUTHENTICATED:
        case ErrorCode.FORBIDDEN:
          return 'session';
        default:
          return 'general';
      }
  }
}

/** Sends a request and carries what its `ok` answer applies to the screen's list. */
export function call<T, A>(request: Promise<ApiResult<T>>, applied: (value: T) => A): Promise<Answered<A>> {
  return request.then((answer) => (answer.kind === 'ok' ? { kind: 'ok' as const, applied: applied(answer.value) } : answer));
}
