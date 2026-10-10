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
export const PosLoginRequest = z.strictObject({ pin: z.string().regex(/^[0-9]{6}$/) });

export const BackOfficeLoginRequest = z.strictObject({
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(1024),
});

export const ReauthenticateRequest = z.strictObject({ password: z.string().min(1).max(1024) });
