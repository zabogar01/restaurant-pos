import { z } from 'zod';

/**
 * What a session read or a sign-in returns on the POS. `csrfToken` is the only
 * place the anti-CSRF token is issued; the client holds it in memory and sends it
 * back in `X-RPOS-CSRF` on every mutating request. `name` is who is signed in.
 *
 * `idleSeconds` is this audience's idle limit, from the server's session policy.
 * `idleRemainingSeconds` is how much of it is left, whole seconds rounded down,
 * computed by PostgreSQL in the statement that judged the session: never more than
 * `idleSeconds`, never less than 0. Both are durations; the client's wall clock is
 * never compared with the server's. A sign-in and a re-authentication return the
 * two equal.
 */
export const SessionView = z.strictObject({
  staffUserId: z.string(),
  name: z.string(),
  role: z.enum(['CASHIER', 'MANAGER']),
  csrfToken: z.string(),
  idleSeconds: z.number().int().nonnegative(),
  idleRemainingSeconds: z.number().int().nonnegative(),
});
export type SessionView = z.infer<typeof SessionView>;

/**
 * The back-office shape: the POS shape plus the manager's own stored, normalised
 * username, which M-6 shows. It appears only on the signed-in manager's own
 * successful response, never in an error.
 */
export const BackOfficeSessionView = SessionView.extend({ username: z.string() });
export type BackOfficeSessionView = z.infer<typeof BackOfficeSessionView>;
