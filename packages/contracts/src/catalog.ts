import { z } from 'zod';

// The menu catalog on the wire (ADR-012 Part 2; consult C1 sections 0 and 2.4; PHASE1-S4b).
// Names are validated, never transformed: a schema here refuses an untrimmed name rather
// than trimming it, so the server stores exactly what it validated. Lengths are in code
// points, as zod's `max` counts and `char_length` does. Money crosses the wire as a
// canonical integer string of minor units, never as a JSON number (B-1, ADR-004). No
// custom messages: the wording is the client's.

const trimmed = (text: string) => text === text.trim();
const noControl = (text: string) => !/\p{Cc}/u.test(text);

const name = (max: number) => z.string().min(1).max(max).refine(trimmed).refine(noControl);

export const CategoryName = name(32);
export const ItemName = name(64);
/** A variant's or a modifier's name. */
export const OptionName = name(32);

// A price in minor units: '0' alone or a digit string with no leading zero, at most
// eight digits, so 0 to 99999999. A variant's change may be negative. The contracts
// depend on zod alone, so the shape and the bound are checked here; `decodeMoney` in
// `@pos/money` reads the string after. A JSON number, `-0`, `+5`, an exponent, a
// fraction, a space and an empty string do not match.
export const BasePrice = z.string().regex(/^(0|[1-9][0-9]{0,7})$/);
export const ModifierPriceChange = z.string().regex(/^(0|[1-9][0-9]{0,7})$/);
export const VariantPriceChange = z.string().regex(/^(0|-?[1-9][0-9]{0,7})$/);

/**
 * The catalog version: a non-negative integer that fits the database's `integer`.
 * Version 0 is the empty catalog, unlike the settings version, which starts at 1.
 */
export const CatalogVersion = z.number().int().min(0).max(2_147_483_647);

const DisplayOrder = z.number().int().min(0);

// ---- views ---------------------------------------------------------------------------

export const CategoryView = z.strictObject({
  categoryId: z.uuid(),
  name: z.string(),
  displayOrder: DisplayOrder,
  /** false = archived. */
  isActive: z.boolean(),
});
export type CategoryView = z.infer<typeof CategoryView>;

// Variants and modifiers are two structures, never one "option" view (DESIGN-020).
export const VariantView = z.strictObject({
  variantId: z.uuid(),
  name: z.string(),
  priceDelta: VariantPriceChange,
  displayOrder: DisplayOrder,
  /** false = removed. */
  isActive: z.boolean(),
});
export type VariantView = z.infer<typeof VariantView>;

export const ModifierView = z.strictObject({
  modifierId: z.uuid(),
  name: z.string(),
  priceDelta: ModifierPriceChange,
  displayOrder: DisplayOrder,
  /** false = removed. */
  isActive: z.boolean(),
});
export type ModifierView = z.infer<typeof ModifierView>;

export const ItemView = z.strictObject({
  itemId: z.uuid(),
  categoryId: z.uuid(),
  name: z.string(),
  basePrice: BasePrice,
  displayOrder: DisplayOrder,
  /** false = 86'd. */
  isAvailable: z.boolean(),
  /** false = archived. */
  isActive: z.boolean(),
  variants: z.array(VariantView),
  modifiers: z.array(ModifierView),
});
export type ItemView = z.infer<typeof ItemView>;

// ---- responses -----------------------------------------------------------------------

/** The read: the version and every category and item, archived and removed ones marked. */
export const CatalogResponse = z.strictObject({
  version: CatalogVersion,
  categories: z.array(CategoryView),
  items: z.array(ItemView),
});
export type CatalogResponse = z.infer<typeof CatalogResponse>;

export const CategoryResponse = z.strictObject({ version: CatalogVersion, category: CategoryView });
export type CategoryResponse = z.infer<typeof CategoryResponse>;

export const CategoriesResponse = z.strictObject({ version: CatalogVersion, categories: z.array(CategoryView) });
export type CategoriesResponse = z.infer<typeof CategoriesResponse>;

export const ItemResponse = z.strictObject({ version: CatalogVersion, item: ItemView });
export type ItemResponse = z.infer<typeof ItemResponse>;

export const ItemsResponse = z.strictObject({ version: CatalogVersion, items: z.array(ItemView) });
export type ItemsResponse = z.infer<typeof ItemsResponse>;

// ---- category requests ---------------------------------------------------------------

export const CreateCategoryRequest = z.strictObject({ name: CategoryName });
export const UpdateCategoryRequest = z.strictObject({
  categoryId: z.uuid(),
  expectedVersion: CatalogVersion,
  name: CategoryName,
});
export const ReorderCategoriesRequest = z.strictObject({
  expectedVersion: CatalogVersion,
  categoryIds: z.array(z.uuid()),
});
export const ArchiveCategoryRequest = z.strictObject({ categoryId: z.uuid() });
export const RestoreCategoryRequest = z.strictObject({ categoryId: z.uuid() });

// ---- item requests -------------------------------------------------------------------

const optionInput = <P extends z.ZodType>(priceDelta: P) => z.strictObject({ name: OptionName, priceDelta });

export const CreateItemRequest = z.strictObject({
  categoryId: z.uuid(),
  name: ItemName,
  basePrice: BasePrice,
  variants: z.array(optionInput(VariantPriceChange)),
  modifiers: z.array(optionInput(ModifierPriceChange)),
});
export type CreateItemRequest = z.infer<typeof CreateItemRequest>;

/** Names an added option in `order`; chosen by the client, unique within the list. */
const OptionKey = z
  .string()
  .min(1)
  .max(64)
  .refine((key) => !/\p{Cc}/u.test(key));

/** An option in `order`: an existing one by id, or an added one by its key, never both. */
const OptionRef = z.union([z.strictObject({ id: z.uuid() }), z.strictObject({ key: OptionKey })]);

const optionListChanges = <P extends z.ZodType>(priceDelta: P) =>
  z.strictObject({
    added: z.array(z.strictObject({ key: OptionKey, name: OptionName, priceDelta })).optional(),
    edited: z
      .array(z.strictObject({ id: z.uuid(), name: OptionName.optional(), priceDelta: priceDelta.optional() }))
      .optional(),
    removed: z.array(z.uuid()).optional(),
    order: z.array(OptionRef).optional(),
  });

export const VariantChanges = optionListChanges(VariantPriceChange);
export const ModifierChanges = optionListChanges(ModifierPriceChange);

/** What an item save changes, and only that: nothing here replaces a list. */
export const ItemChanges = z.strictObject({
  fields: z
    .strictObject({
      name: ItemName.optional(),
      basePrice: BasePrice.optional(),
      categoryId: z.uuid().optional(),
    })
    .optional(),
  variants: VariantChanges.optional(),
  modifiers: ModifierChanges.optional(),
});
export type ItemChanges = z.infer<typeof ItemChanges>;

export const UpdateItemRequest = z.strictObject({
  itemId: z.uuid(),
  expectedVersion: CatalogVersion,
  changes: ItemChanges,
});
export type UpdateItemRequest = z.infer<typeof UpdateItemRequest>;

export const ReorderItemsRequest = z.strictObject({
  categoryId: z.uuid(),
  expectedVersion: CatalogVersion,
  itemIds: z.array(z.uuid()),
});
export const ArchiveItemRequest = z.strictObject({ itemId: z.uuid() });
export const RestoreItemRequest = z.strictObject({ itemId: z.uuid() });
// The 86 and its reversal are state commands (ADR-012 rule 13): no version, so never CATALOG_CHANGED.
export const MarkItemUnavailableRequest = z.strictObject({ itemId: z.uuid() });
export const MarkItemAvailableRequest = z.strictObject({ itemId: z.uuid() });
