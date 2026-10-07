import { withTransaction } from '../db/pool.js';
import { writeSecurityEvent } from './audit.js';
import { findUserByPin, type StaffRole } from './pin.js';

export type ThrottleClass = 'LOGIN' | 'MANAGER_APPROVAL';

export const MAX_FAILURES = 5;
export const COOLDOWN_MINUTES = 5;

export type ThrottledVerification =
  | { outcome: 'VERIFIED'; user: { id: string; role: StaffRole; credentialVersion: number } }
  // retryAfterSeconds is a number when this failure started a cooldown, otherwise null.
  | { outcome: 'FAILED'; retryAfterSeconds: number | null }
  | { outcome: 'THROTTLED'; retryAfterSeconds: number };

// One attempt is one transaction: the class's row is locked, the PIN is checked
// and the outcome is counted before the lock is released, so concurrent guesses
// queue behind each other and cannot each see "four failures" (FR-A5, AC-19).
// All time is PostgreSQL's. The PIN goes to findUserByPin and nowhere else (B-12).
export async function verifyPinThrottled(
  throttleClass: ThrottleClass,
  pin: string,
  options?: { clientInstanceId?: string }
): Promise<ThrottledVerification> {
  const attempt = await withTransaction<
    | { kind: 'VERIFIED'; user: { id: string; role: StaffRole; credentialVersion: number } }
    | { kind: 'THROTTLED'; retryAfterSeconds: number }
    | { kind: 'FAILED'; retryAfterSeconds: number | null; cooldownStarted: boolean }
  >(async (client) => {
    const locked = await client.query<{ blocked: boolean; retry_after_seconds: number | null }>(
      `SELECT blocked_until IS NOT NULL AND blocked_until > now() AS blocked,
              ceil(extract(epoch FROM blocked_until - now()))::int AS retry_after_seconds
         FROM pin_throttle_bucket
        WHERE throttle_class = $1
          FOR UPDATE`,
      [throttleClass]
    );
    const bucket = locked.rows[0];
    if (!bucket) throw new Error(`PIN throttle bucket ${throttleClass} is missing`);
    if (bucket.blocked) {
      return { kind: 'THROTTLED', retryAfterSeconds: Number(bucket.retry_after_seconds) };
    }

    const user = await findUserByPin(pin, client);
    if (user && (throttleClass === 'LOGIN' || user.role === 'MANAGER')) {
      await client.query(
        `UPDATE pin_throttle_bucket
            SET consecutive_failures = 0, blocked_until = NULL
          WHERE throttle_class = $1`,
        [throttleClass]
      );
      return { kind: 'VERIFIED', user };
    }

    const failed = await client.query<{
      cooldown_started: boolean;
      retry_after_seconds: number | null;
    }>(
      `UPDATE pin_throttle_bucket
          SET consecutive_failures =
                CASE WHEN blocked_until IS NULL THEN consecutive_failures + 1 ELSE 1 END,
              blocked_until =
                CASE WHEN (CASE WHEN blocked_until IS NULL THEN consecutive_failures + 1 ELSE 1 END) >= $2::int
                     THEN now() + make_interval(mins => $3::int) END
        WHERE throttle_class = $1
    RETURNING blocked_until IS NOT NULL AS cooldown_started,
              ceil(extract(epoch FROM blocked_until - now()))::int AS retry_after_seconds`,
      [throttleClass, MAX_FAILURES, COOLDOWN_MINUTES]
    );
    const row = failed.rows[0];
    if (!row) throw new Error(`PIN throttle bucket ${throttleClass} is missing`);
    return {
      kind: 'FAILED',
      cooldownStarted: row.cooldown_started,
      retryAfterSeconds: row.cooldown_started ? Number(row.retry_after_seconds) : null,
    };
  });

  if (attempt.kind === 'VERIFIED') return { outcome: 'VERIFIED', user: attempt.user };
  if (attempt.kind === 'THROTTLED') {
    return { outcome: 'THROTTLED', retryAfterSeconds: attempt.retryAfterSeconds };
  }

  // After the commit, so a failed evidence write cannot undo the count.
  const clientInstanceId = options?.clientInstanceId;
  if (throttleClass === 'LOGIN') {
    await writeSecurityEvent({ eventType: 'PIN_FAILURE', throttleClass, clientInstanceId });
  }
  if (attempt.cooldownStarted) {
    await writeSecurityEvent({ eventType: 'COOLDOWN_STARTED', throttleClass, clientInstanceId });
  }
  return { outcome: 'FAILED', retryAfterSeconds: attempt.retryAfterSeconds };
}
