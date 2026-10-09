import { ErrorCode } from '@pos/contracts';
import type { ThrottledVerification } from '../domain/throttle.js';
import { AppError } from './errors.js';

type Verified = Extract<ThrottledVerification, { outcome: 'VERIFIED' }>['user'];

/**
 * The one mapping from a throttled verification to the HTTP answer (ARCH-012
 * section 5). `FAILED` is `INVALID_CREDENTIALS`, with `retryAfterSeconds` only
 * when the domain supplied one; `THROTTLED` is `THROTTLED`. Which part of a
 * credential was wrong is not told, and no count of attempts is reported.
 */
export function verifiedUser(result: ThrottledVerification): Verified {
  switch (result.outcome) {
    case 'VERIFIED':
      return result.user;
    case 'THROTTLED':
      throw new AppError(ErrorCode.THROTTLED, 429, { retryAfterSeconds: result.retryAfterSeconds });
    case 'FAILED':
      if (result.retryAfterSeconds === null) throw new AppError(ErrorCode.INVALID_CREDENTIALS, 401);
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 401, {
        retryAfterSeconds: result.retryAfterSeconds,
      });
  }
}
