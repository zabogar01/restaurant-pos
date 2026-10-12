import { z } from 'zod';

/**
 * The three request bodies that carry a credential (ARCH-012 section 9). Strict:
 * an extra key is a failure. No custom messages: the wording a person reads is the
 * client's copy.
 *
 * A PIN is exactly six ASCII digits, as a string; it can never be anything else,
 * so a malformed one is refused before it is counted. A username and a password
 * are checked for type and size only: the domain is the one authority on what a
 * valid credential is, and 256 and 1024 UTF-16 units are no tighter than its rule
 * (a password of 128 code points can be 256 units long).
 */
const SixAsciiDigits = z.string().regex(/^[0-9]{6}$/);

export const PosLoginRequest = z.strictObject({ pin: SixAsciiDigits });

/**
 * The `managerPin` field of a gated command's body (ARCH-013 section 6): the same
 * rule as a sign-in PIN, so a malformed one is a 400 and is never counted. It is a
 * field, not a request: each command composes it into its own strict object, and
 * the PIN travels in that command's body, never in a session (B-14).
 */
export const ManagerPin = SixAsciiDigits;

export const BackOfficeLoginRequest = z.strictObject({
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(1024),
});

export const ReauthenticateRequest = z.strictObject({ password: z.string().min(1).max(1024) });
