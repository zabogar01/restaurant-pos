import { createHash, randomBytes } from 'node:crypto';
import { query } from '../db/pool.js';
import type { StaffRole } from './pin.js';

export type Audience = 'POS' | 'BACK_OFFICE';

// FR-A2, FR-A2b. These numbers exist nowhere else and reach SQL as parameters.
export const SESSION_POLICY: Readonly<
  Record<Audience, { idleSeconds: number; absoluteSeconds: number | null }>
> = {
  POS: { idleSeconds: 90, absoluteSeconds: null },
  BACK_OFFICE: { idleSeconds: 1800, absoluteSeconds: 28800 },
};

/** What a verification returned. verifyPinThrottled's `user` satisfies it as it is. */
export interface VerifiedUser {
  id: string;
  credentialVersion: number;
}

export interface IssuedSession {
  /** The cookie value. Returned here and nowhere else. */
  token: string;
  sessionId: string;
}

export type SessionResolution =
  | { status: 'ACTIVE'; sessionId: string; staffUserId: string; role: StaffRole }
  // Valid in every respect except idle time. Grants nothing.
  | { status: 'IDLE'; sessionId: string; staffUserId: string }
  | { status: 'NONE' };

// A database error can carry the failing statement's values, so it is replaced,
// never wrapped, and keeps no cause: the token must not leave this module.
const DATABASE_FAILURE = 'The session store failed';

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

function newToken(): { token: string; digest: Buffer } {
  const raw = randomBytes(32);
  return { token: raw.toString('base64url'), digest: createHash('sha256').update(raw).digest() };
}

// The digest of a well-formed token, or null. The type guard comes first so a
// number or an object never reaches a string method. Re-encoding rejects
// non-canonical spellings of the same 32 bytes.
function digestOf(token: unknown): Buffer | null {
  if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) return null;
  const raw = Buffer.from(token, 'base64url');
  if (raw.length !== 32 || raw.toString('base64url') !== token) return null;
  return createHash('sha256').update(raw).digest();
}

async function run<T>(sql: string, params: unknown[]): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}

// The one predicate every statement that judges a session shares. $1 token
// digest, $2 audience. The idle clause is separate so IDLE can be told from NONE.
const VALID = `s.token_hash = $1
   AND s.audience = $2
   AND u.id = s.staff_user_id
   AND s.released_at IS NULL
   AND u.is_active
   AND u.credential_version = s.credential_version
   AND (s.absolute_expires_at IS NULL OR s.absolute_expires_at > clock_timestamp())`;
const NOT_IDLE = `AND s.last_interactive_at > clock_timestamp() - make_interval(secs => $3::int)`;

export async function createSession(input: {
  audience: Audience;
  user: VerifiedUser;
  clientInstanceId?: string;
}): Promise<IssuedSession> {
  const { token, digest } = newToken();
  // The transaction's start time is right here: no lock wait precedes this
  // decision. Every other statement reads clock_timestamp().
  const rows = await run<{ id: string }>(
    `INSERT INTO actor_session
       (token_hash, audience, staff_user_id, credential_version, client_instance_id,
        absolute_expires_at)
     VALUES ($1, $2, $3, $4, $6,
             CASE WHEN $5::int IS NULL THEN NULL
                  ELSE now() + make_interval(secs => $5::int) END)
     RETURNING id`,
    [
      digest,
      input.audience,
      input.user.id,
      input.user.credentialVersion,
      SESSION_POLICY[input.audience].absoluteSeconds,
      input.clientInstanceId ?? null,
    ]
  );
  const row = rows[0];
  if (!row) throw new Error(DATABASE_FAILURE);
  return { token, sessionId: row.id };
}

export async function resolveSession(
  token: string,
  audience: Audience,
  interactive: boolean
): Promise<SessionResolution> {
  const digest = digestOf(token);
  if (!digest) return { status: 'NONE' };
  const idleSeconds = SESSION_POLICY[audience].idleSeconds;

  // GREATEST so a last_interactive_at ahead of the clock is never moved back.
  const active = interactive
    ? await run<{ id: string; staff_user_id: string; role: StaffRole }>(
        `UPDATE actor_session s
            SET last_interactive_at = GREATEST(s.last_interactive_at, clock_timestamp())
           FROM staff_user u
          WHERE ${VALID}
            ${NOT_IDLE}
      RETURNING s.id, s.staff_user_id, u.role`,
        [digest, audience, idleSeconds]
      )
    : await run<{ id: string; staff_user_id: string; role: StaffRole }>(
        `SELECT s.id, s.staff_user_id, u.role
           FROM actor_session s
           JOIN staff_user u ON u.id = s.staff_user_id
          WHERE ${VALID}
            ${NOT_IDLE}`,
        [digest, audience, idleSeconds]
      );
  const hit = active[0];
  if (hit) {
    return { status: 'ACTIVE', sessionId: hit.id, staffUserId: hit.staff_user_id, role: hit.role };
  }

  const idle = await run<{ id: string; staff_user_id: string }>(
    `SELECT s.id, s.staff_user_id
       FROM actor_session s
       JOIN staff_user u ON u.id = s.staff_user_id
      WHERE ${VALID}`,
    [digest, audience]
  );
  const row = idle[0];
  if (row) return { status: 'IDLE', sessionId: row.id, staffUserId: row.staff_user_id };
  return { status: 'NONE' };
}

// M-6: the idled manager proves the credential again. The old token stops
// working and a new one is issued for the same session; issued_at and the
// absolute limit stay.
export async function reauthenticateSession(
  token: string,
  audience: 'BACK_OFFICE',
  user: VerifiedUser
): Promise<IssuedSession | null> {
  const digest = digestOf(token);
  if (!digest) return null;
  const next = newToken();
  const rows = await run<{ id: string }>(
    `UPDATE actor_session s
        SET last_interactive_at = GREATEST(s.last_interactive_at, clock_timestamp()),
            token_hash = $3
       FROM staff_user u
      WHERE ${VALID}
        AND s.staff_user_id = $4
        AND s.credential_version = $5
  RETURNING s.id`,
    [digest, audience, next.digest, user.id, user.credentialVersion]
  );
  const row = rows[0];
  return row ? { token: next.token, sessionId: row.id } : null;
}

export async function releaseSession(token: string, audience: Audience): Promise<void> {
  const digest = digestOf(token);
  if (!digest) return;
  await run(
    `UPDATE actor_session
        SET released_at = clock_timestamp()
      WHERE token_hash = $1 AND audience = $2 AND released_at IS NULL`,
    [digest, audience]
  );
}
