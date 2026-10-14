/**
 * The request header that carries the anti-CSRF token (ARCH-012 section 3). The
 * server compares it against the token it derives from the session cookie; a client
 * sends the `csrfToken` of its last session view in it on every mutating request.
 * HTTP header names are case-insensitive; Node lower-cases them on arrival.
 */
export const CSRF_HEADER = 'X-RPOS-CSRF';
