import { z } from 'zod';
import { CatalogVersion } from './catalog.js';
import { RatePpm } from './settings.js';

// Discount presets on the wire (FR-B5, ADR-012 rule 10, consult C1 sections 0 and 4;
// PHASE1-S6a). Names are validated, never transformed: a schema here refuses an untrimmed
// name rather than trimming it, so the server stores exactly what it validated. Lengths are
// in code points, as zod's `max` counts and `char_length` does. A rate and an amount cross
// the wire as canonical integer strings, never as JSON numbers (B-1, ADR-004). No custom
// messages: the wording is the client's.

/** 1 to 32 code points, as every name that prints on a receipt line. */
export const PresetName = z
  .string()
  .min(1)
  .max(32)
  .refine((name) => name === name.trim())
  .refine((name) => !/\p{Cc}/u.test(name));

// A fixed discount in minor units: '0' alone or a digit string with no leading zero, at
// most eight digits, so 0 to 99999999 (FR-M5's order-total maximum). Zero is accepted.
// A JSON number, a sign, an exponent, a fraction, a space and an empty string do not match.
export const DiscountAmount = z.string().regex(/^(0|[1-9][0-9]{0,7})$/);

/** What a preset takes off: a percentage as parts per million, or a fixed amount. One field each, never both. */
export const PresetValue = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('PERCENTAGE'), ratePpm: RatePpm }),
  z.strictObject({ kind: z.literal('FIXED'), amount: DiscountAmount }),
]);
export type PresetValue = z.infer<typeof PresetValue>;

/** A preset as every route answers it. Nothing else: no date, trigger, order or stacking field (B-21, B-22). */
export const PresetView = z.strictObject({
  presetId: z.uuid(),
  name: z.string(),
  value: PresetValue,
  /** false = deactivated; the preset stays readable (FR-F5). */
  isActive: z.boolean(),
});
export type PresetView = z.infer<typeof PresetView>;

export const CreatePresetRequest = z.strictObject({ name: PresetName, value: PresetValue });
/** An edit sends the whole preset, under the version it was built on (ADR-012 rule 13). */
export const UpdatePresetRequest = z.strictObject({
  presetId: z.uuid(),
  expectedVersion: CatalogVersion,
  name: PresetName,
  value: PresetValue,
});
// State commands (ADR-012 rule 13): no version, so never CATALOG_CHANGED.
export const DeactivatePresetRequest = z.strictObject({ presetId: z.uuid() });
export const ReactivatePresetRequest = z.strictObject({ presetId: z.uuid() });

/** What the four commands answer: the preset as committed, and the catalog version now current. */
export const PresetResponse = z.strictObject({ version: CatalogVersion, preset: PresetView });
export type PresetResponse = z.infer<typeof PresetResponse>;

/** What the list read answers: every preset, active and deactivated, in creation order. */
export const PresetsResponse = z.strictObject({ version: CatalogVersion, presets: z.array(PresetView) });
export type PresetsResponse = z.infer<typeof PresetsResponse>;
