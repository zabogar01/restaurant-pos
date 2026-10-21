import { z } from 'zod';

// The installation's settings (ADR-012 Part 1; consult C1 section 1; PHASE1-S2a).
// Every text is trimmed by the client before it is sent: a schema here refuses an
// untrimmed or blank value rather than transforming it, so the server stores exactly
// what it validated and the schemas' input and output types are the same. Lengths are
// in UTF-16 units, as `max` counts. No custom messages: the wording is the client's.

const trimmed = (text: string) => text === text.trim();
const noControl = (text: string) => !/\p{Cc}/u.test(text);

/** The settings version number: a positive integer that fits the database's `integer`. */
const VersionNumber = z.number().int().min(1).max(2_147_483_647);

/**
 * A rate on the wire: canonical base-10 integer parts per million, '0' to '1000000'
 * (0 to 100 percent, owner 2026-10-20). A JSON number, a sign, a leading zero, an
 * exponent and a fraction are refused. The contracts depend on zod alone, so the shape
 * and the bound are checked here; `decodeRate` in `@pos/money` reads the string after.
 */
const CANONICAL_PPM = /^(0|[1-9][0-9]*)$/;

// zod runs every check even after one has failed, so the bound re-tests the shape
// before it reads the string as a bigint, which throws on '1e5' or '1.5'.
export const RatePpm = z
  .string()
  .regex(CANONICAL_PPM)
  .max(7)
  .refine((ppm) => CANONICAL_PPM.test(ppm) && ppm.length <= 7 && BigInt(ppm) <= 1_000_000n);

export const OutletName = z.string().min(1).max(64).refine(trimmed).refine(noControl);

/** Up to three lines: the only control character allowed is a line feed, at most two. */
export const OutletAddress = z
  .string()
  .min(1)
  .max(200)
  .refine(trimmed)
  .refine((address) => noControl(address.replaceAll('\n', '')))
  .refine((address) => address.split('\n').length <= 3);

/** Digits, spaces and + - . ( ) only (owner, 2026-10-21). */
export const OutletPhone = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[0-9 +\-.()]+$/)
  .refine(trimmed);

/** Optional; `null` is none. The NPWPD has no charset beyond the control-character rule. */
export const OutletNpwpd = z.string().min(1).max(32).refine(trimmed).refine(noControl).nullable();

/** Required (lead and owner, 2026-10-21). */
export const ReceiptFooter = z.string().min(1).max(120).refine(trimmed).refine(noControl);

/** One saved settings version, as the read and the save answer it. */
export const SettingsVersionView = z.strictObject({
  version: VersionNumber,
  /** ISO 8601 with an offset. */
  createdAt: z.iso.datetime({ offset: true }),
  /** The saving manager's name (B-13). */
  createdByName: z.string(),
  taxRatePpm: RatePpm,
  serviceChargeRatePpm: RatePpm,
  outletName: z.string(),
  address: z.string(),
  phone: z.string(),
  npwpd: z.string().nullable(),
  footer: z.string(),
});
export type SettingsVersionView = z.infer<typeof SettingsVersionView>;

/**
 * What the read and the save both answer. `current` is null until the first save. The
 * currency and the precision are the installation's constants, reported and never
 * stored (ADR-012 rule 5).
 */
export const SettingsReadView = z.strictObject({
  installation: z.strictObject({
    currency: z.string().regex(/^[A-Z]{3}$/),
    minorUnitPrecision: z.number().int().min(0),
  }),
  current: SettingsVersionView.nullable(),
});
export type SettingsReadView = z.infer<typeof SettingsReadView>;

/**
 * A save. `expectedVersion` is the version the form was built on, or null for the very
 * first save. No currency, precision, calculation policy, version or author field: a
 * strict object refuses any of them.
 */
export const SaveSettingsRequest = z.strictObject({
  expectedVersion: VersionNumber.nullable(),
  taxRatePpm: RatePpm,
  serviceChargeRatePpm: RatePpm,
  outletName: OutletName,
  address: OutletAddress,
  phone: OutletPhone,
  npwpd: OutletNpwpd,
  footer: ReceiptFooter,
});
export type SaveSettingsRequest = z.infer<typeof SaveSettingsRequest>;
