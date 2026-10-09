/**
 * What a session read or a sign-in returns. `csrfToken` is the only place the
 * anti-CSRF token is issued; the client holds it in memory and sends it back in
 * `X-RPOS-CSRF` on every mutating request.
 */
export interface SessionView {
  staffUserId: string;
  role: 'CASHIER' | 'MANAGER';
  csrfToken: string;
}
