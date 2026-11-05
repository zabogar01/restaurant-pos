import { z } from 'zod';
import { ManagerPin } from './auth.js';

// Users (FR-A1, FR-A4, FR-B3; consult C3 sections 1, 2, 6 and 8). Every request is a strict
// object with no transform and no custom message: the wording a person reads is the client's
// copy, and the server stores exactly what the schema validated.
//
// A credential field has one of four names, always at the top level of its request and
// never nested (ADR-010 rule 2: the log redaction is a backstop over listed names only):
// `pin`, `password`, `username` and, in the slice that adds the own changes,
// `currentPassword`. A confirmation field, if a form has one, is compared in the client and
// never sent.

/** What a person is: the row's null role read as `KITCHEN`. */
export const StaffClassification = z.enum(['CASHIER', 'MANAGER', 'KITCHEN']);
export type StaffClassification = z.infer<typeof StaffClassification>;

/**
 * A staff name (C3 section 1): 1 to 64 characters, no leading or trailing whitespace and no
 * control character, refused rather than trimmed, as a table's label is. The length is in
 * UTF-16 units, as `max` counts, which is never looser than the database's code points.
 */
export const StaffName = z
  .string()
  .min(1)
  .max(64)
  .refine((name) => name === name.trim())
  .refine((name) => !/\p{Cc}/u.test(name));

/** A PIN being set: exactly six ASCII digits, the sign-in rule. */
export const NewPin = ManagerPin;

/**
 * A username being set, in exactly the stored form (ADR-009 section 3). The form trims and
 * lower-cases ASCII letters before checking, so the server stores what it validated.
 */
export const NewUsername = z.string().regex(/^[a-z0-9][a-z0-9._-]{2,31}$/);

/**
 * A password being set: 8 to 128 code points, counted as the domain counts them, never
 * trimmed. This differs deliberately from the sign-in schemas, which check type and size
 * only so that a malformed credential counts as a failed match (ADR-011 rule 9): a
 * credential being set must meet the rule before it is sent, so a form can say which field
 * is wrong. The UTF-16 `max` is generous (128 code points can be 256 units).
 */
export const NewPassword = z
  .string()
  .max(256)
  .refine((password) => {
    const length = [...password].length;
    return length >= 8 && length <= 128;
  });

/**
 * One person as every users route answers. Nothing else: never a hash, a lookup, the
 * credential version, the throttle columns or whether a PIN is set. `username` is the stored
 * username, non-null exactly when a credential row exists, a former manager's included.
 */
export const UserView = z.strictObject({
  staffUserId: z.uuid(),
  name: z.string(),
  classification: StaffClassification,
  isActive: z.boolean(),
  username: z.string().nullable(),
});
export type UserView = z.infer<typeof UserView>;

// ---- create: one variant per classification ------------------------------------------

export const CreateKitchenUserRequest = z.strictObject({
  classification: z.literal('KITCHEN'),
  name: StaffName,
});
export const CreateCashierUserRequest = z.strictObject({
  classification: z.literal('CASHIER'),
  name: StaffName,
  pin: NewPin,
});
export const CreateManagerUserRequest = z.strictObject({
  classification: z.literal('MANAGER'),
  name: StaffName,
  pin: NewPin,
  username: NewUsername,
  password: NewPassword,
});
export const CreateUserRequest = z.discriminatedUnion('classification', [
  CreateKitchenUserRequest,
  CreateCashierUserRequest,
  CreateManagerUserRequest,
]);

// ---- change-role: one variant per move (C3 section 2) --------------------------------
//
// Keyed by the move, each variant carries exactly the fields the move needs, so "a PIN is
// set in the same command" is a schema property. `username` is required exactly when the
// person has no credential row and must be absent when they have one; the schema cannot
// know which, so it is optional here and the server decides under its lock.

export const KitchenToCashierRequest = z.strictObject({
  change: z.literal('KITCHEN_TO_CASHIER'),
  staffUserId: z.uuid(),
  pin: NewPin,
});
export const KitchenToManagerRequest = z.strictObject({
  change: z.literal('KITCHEN_TO_MANAGER'),
  staffUserId: z.uuid(),
  pin: NewPin,
  password: NewPassword,
  username: NewUsername.optional(),
});
export const CashierToManagerRequest = z.strictObject({
  change: z.literal('CASHIER_TO_MANAGER'),
  staffUserId: z.uuid(),
  password: NewPassword,
  username: NewUsername.optional(),
});
export const ManagerToCashierRequest = z.strictObject({
  change: z.literal('MANAGER_TO_CASHIER'),
  staffUserId: z.uuid(),
});
export const CashierToKitchenRequest = z.strictObject({
  change: z.literal('CASHIER_TO_KITCHEN'),
  staffUserId: z.uuid(),
});
export const ManagerToKitchenRequest = z.strictObject({
  change: z.literal('MANAGER_TO_KITCHEN'),
  staffUserId: z.uuid(),
});
export const ChangeRoleRequest = z.discriminatedUnion('change', [
  KitchenToCashierRequest,
  KitchenToManagerRequest,
  CashierToManagerRequest,
  ManagerToCashierRequest,
  CashierToKitchenRequest,
  ManagerToKitchenRequest,
]);

// ---- status ---------------------------------------------------------------------------

export const DeactivateUserRequest = z.strictObject({ staffUserId: z.uuid() });
/** `pin` replaces the person's PIN as they come back (C3 section 6). */
export const ReactivateUserRequest = z.strictObject({ staffUserId: z.uuid(), pin: NewPin.optional() });

/** What the four commands answer: the row as committed. */
export const UserResponse = z.strictObject({ user: UserView });
export type UserResponse = z.infer<typeof UserResponse>;

/** What the list read answers: every user, active and inactive, in creation order. */
export const UsersResponse = z.strictObject({ users: z.array(UserView) });
export type UsersResponse = z.infer<typeof UsersResponse>;
