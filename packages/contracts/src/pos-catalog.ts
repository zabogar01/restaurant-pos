import { z } from 'zod';
import { BasePrice, CatalogVersion, ModifierPriceChange, VariantPriceChange } from './catalog.js';
import { PresetValue } from './discount-presets.js';

// What the POS may read of the catalog (ADR-012 rules 10 to 12; consult C4; PHASE1-S7a).
// The projection holds only what the POS may show: an archived category and its items, an
// archived item, a removed option and a deactivated preset are absent, so no entry carries
// `isActive`, and `displayOrder` is absent because the array is the order. An 86'd item is
// present with `isAvailable: false`. Money and rates cross the wire as canonical strings
// (B-1, ADR-004), through the same schemas the back office uses.

export const PosCategory = z.strictObject({
  categoryId: z.uuid(),
  name: z.string(),
});
export type PosCategory = z.infer<typeof PosCategory>;

export const PosVariant = z.strictObject({
  variantId: z.uuid(),
  name: z.string(),
  priceDelta: VariantPriceChange,
});
export type PosVariant = z.infer<typeof PosVariant>;

export const PosModifier = z.strictObject({
  modifierId: z.uuid(),
  name: z.string(),
  priceDelta: ModifierPriceChange,
});
export type PosModifier = z.infer<typeof PosModifier>;

export const PosItem = z.strictObject({
  itemId: z.uuid(),
  categoryId: z.uuid(),
  name: z.string(),
  basePrice: BasePrice,
  /** false = 86'd: still shown, and not orderable. */
  isAvailable: z.boolean(),
  variants: z.array(PosVariant),
  modifiers: z.array(PosModifier),
});
export type PosItem = z.infer<typeof PosItem>;

export const PosPreset = z.strictObject({
  presetId: z.uuid(),
  name: z.string(),
  value: PresetValue,
});
export type PosPreset = z.infer<typeof PosPreset>;

/** One snapshot: the version and everything it describes were read together (ADR-012 rule 11). */
export const PosMenuResponse = z.strictObject({
  version: CatalogVersion,
  categories: z.array(PosCategory),
  items: z.array(PosItem),
  presets: z.array(PosPreset),
});
export type PosMenuResponse = z.infer<typeof PosMenuResponse>;

/** The poll: the catalog version alone. */
export const PosRevisionResponse = z.strictObject({ version: CatalogVersion });
export type PosRevisionResponse = z.infer<typeof PosRevisionResponse>;
