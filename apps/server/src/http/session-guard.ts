import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode } from '@pos/contracts';
import type { StaffRole } from '../domain/pin.js';
import {
  createSession,
  reauthenticateSession,
  releaseSession,
  resolveSession,
} from '../domain/session.js';
import type { Audience, VerifiedUser } from '../domain/session.js';
import { AppError } from './errors.js';

/**
 * The one module that names the two session cookies, reads them, clears them and
 * derives the anti-CSRF token (ARCH-012 sections 2 and 3). The cookie is picked
 * from the route's declared audience and from nothing in the request: no header,
 * no body and no other cookie selects it (FR-A2c).
 */

export interface Actor {
  staffUserId: string;
  /** The role at this request, never the role at sign-in. */
  role: StaffRole;
  sessionId: string;
  audience: Audience;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Null unless the session guard set it. Read it through `actorOf`. */
    actor: Actor | null;
  }
}

const COOKIE: Record<Audience, { name: string; path: string }> = {
  POS: { name: 'rpos_pos_sid', path: '/api/pos' },
  BACK_OFFICE: { name: 'rpos_bo_sid', path: '/api/back-office' },
};

const CSRF_HEADER = 'x-rpos-csrf';
const CSRF_MESSAGE = 'rpos-csrf-v1';
const CSRF_LENGTH = 43; // 32 bytes, base64url without padding

/** Decorates the request with a null actor. Call once on the root instance. */
export function decorateActor(app: FastifyInstance): void {
  app.decorateRequest('actor', null);
}

type Presented = { kind: 'NONE' } | { kind: 'REPEATED' } | { kind: 'ONE'; token: string };

// The raw header, not the parsed jar: a parser returns one copy of a repeated name,
// and which copy is a detail of the parser. A repeated name means something else
// has written into the jar, and refusing is the only answer that does not depend
// on that.
function presentedToken(request: FastifyRequest, audience: Audience): Presented {
  const header = request.headers.cookie;
  if (typeof header !== 'string') return { kind: 'NONE' };
  const wanted = COOKIE[audience].name;
  const values: string[] = [];
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === wanted) values.push(pair.slice(eq + 1).trim());
  }
  if (values.length === 0) return { kind: 'NONE' };
  const [only] = values;
  return values.length === 1 && only !== undefined ? { kind: 'ONE', token: only } : { kind: 'REPEATED' };
}

// Cleared with the path and attributes it was set with, so the browser matches it.
// An empty value and Max-Age=0 and nothing else: no Expires, no Domain.
function clearSessionCookie(reply: FastifyReply, audience: Audience): void {
  reply.setCookie(COOKIE[audience].name, '', {
    path: COOKIE[audience].path,
    maxAge: 0,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
}

function csrfOf(token: string): string {
  return createHmac('sha256', token).update(CSRF_MESSAGE).digest('base64url');
}

// Exactly one header, equal to the token derived from the presented cookie. A
// repeated header arrives joined or as an array and is never 43 characters.
function checkCsrf(request: FastifyRequest, token: string): void {
  const sent = request.headers[CSRF_HEADER];
  const expected = Buffer.from(csrfOf(token));
  if (typeof sent === 'string' && sent.length === CSRF_LENGTH) {
    const given = Buffer.from(sent);
    if (given.length === expected.length && timingSafeEqual(given, expected)) return;
  }
  throw new AppError(ErrorCode.CSRF_REFUSED, 403);
}

function isMutating(request: FastifyRequest): boolean {
  return request.method !== 'GET' && request.method !== 'HEAD';
}

/**
 * The `onRequest` hook for a route declared ACTIVE, after the client-instance
 * hook. The order is the consult's: cookie, anti-CSRF token, resolution, role,
 * actor. Anything that throws refuses the request and the handler does not run;
 * a failure to resolve is never treated as a session.
 */
export async function sessionGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const access = request.routeOptions.config.access;
  // Startup refuses an API route with no declaration, so this is not reachable
  // from a request; if it were, nothing may pass.
  if (access === undefined) throw new Error('A route reached the guard without a declaration');
  if (access.session !== 'ACTIVE') return;
  const { audience, interactive } = access;

  const presented = presentedToken(request, audience);
  if (presented.kind !== 'ONE') {
    // The planted copy is on a path the server cannot know; its own is attempted.
    if (presented.kind === 'REPEATED') clearSessionCookie(reply, audience);
    throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }
  const { token } = presented;

  // Before the resolution: an interactive resolution moves last_interactive_at, and
  // a request that fails this check must not keep a session alive.
  if (isMutating(request)) checkCsrf(request, token);

  const resolved = await resolveSession(token, audience, interactive);
  if (resolved.status === 'NONE') {
    clearSessionCookie(reply, audience);
    throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }
  if (resolved.status === 'IDLE') {
    // The POS has no renewal, so an idle POS token is dead. An idle back-office
    // token is kept: M-6 renews it.
    if (audience === 'POS') clearSessionCookie(reply, audience);
    throw new AppError(ErrorCode.SESSION_IDLE, 401);
  }
  if (audience === 'BACK_OFFICE' && resolved.role !== 'MANAGER') {
    throw new AppError(ErrorCode.FORBIDDEN, 403);
  }
  request.actor = {
    staffUserId: resolved.staffUserId,
    role: resolved.role,
    sessionId: resolved.sessionId,
    audience,
  };
}

/** The actor of a route declared ACTIVE. Throws where the guard did not set one. */
export function actorOf(request: FastifyRequest): Actor {
  if (request.actor === null) throw new Error('No actor: the route is not guarded');
  return request.actor;
}

/** The anti-CSRF token of the session the guard accepted, for `me`. */
export function csrfTokenOf(request: FastifyRequest): string {
  const presented = presentedToken(request, actorOf(request).audience);
  if (presented.kind !== 'ONE') throw new Error('No session cookie to derive a token from');
  return csrfOf(presented.token);
}

// The audience of a route declared OPTIONAL, from its declaration alone.
function optionalAudience(request: FastifyRequest, who: string): Audience {
  const access = request.routeOptions.config.access;
  if (access === undefined || access.session !== 'OPTIONAL') {
    throw new Error(`${who} is for a route declared OPTIONAL`);
  }
  return access.audience;
}

// Always a token the server generated in this request, never one that was
// presented. No Max-Age or Expires: the cookie ends with the browser session and
// the server's clock decides the rest.
function setSessionCookie(reply: FastifyReply, audience: Audience, token: string): void {
  reply.setCookie(COOKIE[audience].name, token, {
    path: COOKIE[audience].path,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
}

/**
 * A sign-in that verified, for a route declared OPTIONAL. Whatever session the
 * surface's cookie presents is released first (idle included; no resolution is
 * needed), then a session is created for the verified user and its cookie is set.
 * Call it only after `VERIFIED`: a failed or throttled sign-in changes no session
 * and no cookie. If the release fails no session is created; if the creation
 * fails the old one is already gone.
 */
export async function signIn(
  request: FastifyRequest,
  reply: FastifyReply,
  user: VerifiedUser
): Promise<{ csrfToken: string }> {
  const audience = optionalAudience(request, 'signIn');
  const presented = presentedToken(request, audience);
  if (presented.kind === 'ONE') await releaseSession(presented.token, audience);
  const issued = await createSession({
    audience,
    user,
    clientInstanceId: request.clientInstanceId,
  });
  setSessionCookie(reply, audience, issued.token);
  return { csrfToken: csrfOf(issued.token) };
}

/**
 * Steps 2 and 3 of M-6, for a route declared OPTIONAL on the back office: the one
 * session cookie, and the anti-CSRF token derived from it. Returns the presented
 * token. Nothing has been verified or counted when this throws.
 */
export function presentedForRenewal(request: FastifyRequest, reply: FastifyReply): string {
  const audience = optionalAudience(request, 'presentedForRenewal');
  const presented = presentedToken(request, audience);
  if (presented.kind !== 'ONE') {
    if (presented.kind === 'REPEATED') clearSessionCookie(reply, audience);
    throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }
  checkCsrf(request, presented.token);
  return presented.token;
}

/**
 * Step 5 of M-6: the account the presented session names, if it can still be
 * renewed. An idle session and an active one both can; anything else clears the
 * cookie and is UNAUTHENTICATED, with no password verified and nothing counted.
 * This resolution does not count as activity.
 */
export async function renewableAccount(
  reply: FastifyReply,
  token: string,
  audience: 'BACK_OFFICE'
): Promise<string> {
  const resolved = await resolveSession(token, audience, false);
  if (resolved.status === 'NONE') {
    clearSessionCookie(reply, audience);
    throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }
  return resolved.staffUserId;
}

/**
 * Step 7 of M-6: the same session under a new token. If the row was released,
 * expired or re-versioned since step 5 there is nothing to renew, and the answer
 * is UNAUTHENTICATED: this never falls through to a fresh session.
 */
export async function renewSession(
  reply: FastifyReply,
  token: string,
  audience: 'BACK_OFFICE',
  user: VerifiedUser
): Promise<{ csrfToken: string }> {
  const issued = await reauthenticateSession(token, audience, user);
  if (issued === null) {
    clearSessionCookie(reply, audience);
    throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }
  setSessionCookie(reply, audience, issued.token);
  return { csrfToken: csrfOf(issued.token) };
}

/**
 * Release (POS) and logout (back office), for a route declared OPTIONAL. The
 * session is released whatever its state, idle included, and the cookie is
 * cleared. With no cookie nothing is written. With a cookie and no valid token
 * the session is left alone: a hostile page must not sign anyone out.
 */
export async function signOut(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const access = request.routeOptions.config.access;
  if (access === undefined || access.session !== 'OPTIONAL') {
    throw new Error('signOut is for a route declared OPTIONAL');
  }
  const { audience } = access;
  const presented = presentedToken(request, audience);
  if (presented.kind === 'NONE') return;
  if (presented.kind === 'REPEATED') {
    clearSessionCookie(reply, audience);
    return;
  }
  if (isMutating(request)) checkCsrf(request, presented.token);
  await releaseSession(presented.token, audience);
  clearSessionCookie(reply, audience);
}
