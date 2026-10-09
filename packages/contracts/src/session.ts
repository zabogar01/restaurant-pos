/**
 * What a session read or a sign-in returns on the POS. `csrfToken` is the only
 * place the anti-CSRF token is issued; the client holds it in memory and sends it
 * back in `X-RPOS-CSRF` on every mutating request. `name` is who is signed in.
 */
export interface SessionView {
  staffUserId: string;
  name: string;
  role: 'CASHIER' | 'MANAGER';
  csrfToken: string;
}

/**
 * The back-office shape: the POS shape plus the manager's own stored, normalised
 * username, which M-6 shows. It appears only on the signed-in manager's own
 * successful response, never in an error.
 */
export interface BackOfficeSessionView extends SessionView {
  username: string;
}
