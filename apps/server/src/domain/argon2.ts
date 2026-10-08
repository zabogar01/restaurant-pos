import { Algorithm } from '@node-rs/argon2';

// OWASP's minimum for Argon2id, stated here so a library upgrade cannot weaken
// it silently (FR-A3, B-11). One definition for PINs and passwords.
export const ARGON2 = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
