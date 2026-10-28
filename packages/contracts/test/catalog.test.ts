import { describe, expect, it } from 'vitest';
import {
  ArchiveCategoryRequest,
  ArchiveItemRequest,
  BasePrice,
  CatalogResponse,
  CatalogVersion,
  CategoriesResponse,
  CategoryName,
  CategoryResponse,
  CategoryView,
  CreateCategoryRequest,
  CreateItemRequest,
  ItemName,
  ItemResponse,
  ItemView,
  ItemsResponse,
  ModifierPriceChange,
  ModifierView,
  OptionName,
  ReorderCategoriesRequest,
  MarkItemAvailableRequest,
  MarkItemUnavailableRequest,
  ReorderItemsRequest,
  RestoreCategoryRequest,
  RestoreItemRequest,
  UpdateCategoryRequest,
  UpdateItemRequest,
  VariantPriceChange,
  VariantView,
} from '../src/catalog.js';

const ID = '0b1f3a52-6d0e-4c53-9d5b-2f0f7f6b9a11';
const ID2 = '1c2e4b63-7e1f-4d64-8e6c-3a1a8a7cab22';

const accepts = (schema: { safeParse(input: unknown): { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('the names', () => {
  const cases = [
    ['CategoryName', CategoryName, 32],
    ['ItemName', ItemName, 64],
    ['OptionName', OptionName, 32],
  ] as const;

  for (const [label, schema, max] of cases) {
    it(`${label} accepts 1 to ${max} code points and refuses the rest`, () => {
      for (const name of ['Mains', 'a', 'x'.repeat(max), '😀'.repeat(max), 'Two  spaces']) {
        expect(accepts(schema, name), name).toBe(true);
      }
      for (const name of [
        '',
        'x'.repeat(max + 1),
        '😀'.repeat(max + 1),
        ' Mains',
        'Mains ',
        'Mains\n',
        'Ma\nins',
        'Ma\u001bins',
        'Ma\u007fins',
      ]) {
        expect(accepts(schema, name), JSON.stringify(name)).toBe(false);
      }
    });
  }
});

describe('the prices', () => {
  const NOT_CANONICAL = ['01', '-0', '+5', '1e3', '1.5', ' 5', '5 ', '', '0x10', '--1', '٣'];

  it('a base price and a modifier change are 0 to 99999999', () => {
    for (const schema of [BasePrice, ModifierPriceChange]) {
      for (const price of ['0', '1', '10000', '99999999']) expect(accepts(schema, price), price).toBe(true);
      for (const price of [...NOT_CANONICAL, '-1', '100000000', '999999999']) {
        expect(accepts(schema, price), JSON.stringify(price)).toBe(false);
      }
    }
  });

  it('a variant change is -99999999 to 99999999', () => {
    for (const price of ['0', '1', '-1', '99999999', '-99999999']) {
      expect(accepts(VariantPriceChange, price), price).toBe(true);
    }
    for (const price of [...NOT_CANONICAL, '-100000000', '100000000']) {
      expect(accepts(VariantPriceChange, price), JSON.stringify(price)).toBe(false);
    }
  });

  it('5. a JSON number is refused by every price schema', () => {
    for (const schema of [BasePrice, ModifierPriceChange, VariantPriceChange]) {
      for (const price of [10000, 0, -1, 1.5, 10000n]) expect(accepts(schema, price), String(price)).toBe(false);
    }
  });
});

describe('the version', () => {
  it('is a non-negative integer that fits the database, and 0 is valid', () => {
    for (const version of [0, 1, 2_147_483_647]) expect(accepts(CatalogVersion, version), String(version)).toBe(true);
    for (const version of [-1, 1.5, '1', null, undefined, 2_147_483_648]) {
      expect(accepts(CatalogVersion, version), String(version)).toBe(false);
    }
  });
});

describe('the requests', () => {
  const variantEntry = { name: 'Large', priceDelta: '-5000' };
  const modifierEntry = { name: 'Extra shot', priceDelta: '3000' };
  const create = {
    categoryId: ID,
    name: 'Latte',
    basePrice: '30000',
    variants: [variantEntry],
    modifiers: [modifierEntry],
  };

  it('accepts a well-formed body for each command', () => {
    expect(accepts(CreateCategoryRequest, { name: 'Mains' })).toBe(true);
    expect(accepts(UpdateCategoryRequest, { categoryId: ID, expectedVersion: 0, name: 'Mains' })).toBe(true);
    expect(accepts(ReorderCategoriesRequest, { expectedVersion: 3, categoryIds: [ID, ID2] })).toBe(true);
    expect(accepts(ReorderCategoriesRequest, { expectedVersion: 3, categoryIds: [] })).toBe(true);
    expect(accepts(ArchiveCategoryRequest, { categoryId: ID })).toBe(true);
    expect(accepts(RestoreCategoryRequest, { categoryId: ID })).toBe(true);
    expect(accepts(CreateItemRequest, create)).toBe(true);
    expect(accepts(CreateItemRequest, { ...create, variants: [], modifiers: [] })).toBe(true);
    expect(accepts(ReorderItemsRequest, { categoryId: ID, expectedVersion: 1, itemIds: [ID2] })).toBe(true);
    expect(accepts(ArchiveItemRequest, { itemId: ID })).toBe(true);
    expect(accepts(RestoreItemRequest, { itemId: ID })).toBe(true);
    expect(accepts(MarkItemUnavailableRequest, { itemId: ID })).toBe(true);
    expect(accepts(MarkItemAvailableRequest, { itemId: ID })).toBe(true);
  });

  it('7. an extra key at the top level of each request is refused', () => {
    const bodies: Array<[{ safeParse(input: unknown): { success: boolean } }, object]> = [
      [CreateCategoryRequest, { name: 'Mains' }],
      [UpdateCategoryRequest, { categoryId: ID, expectedVersion: 0, name: 'Mains' }],
      [ReorderCategoriesRequest, { expectedVersion: 3, categoryIds: [ID] }],
      [ArchiveCategoryRequest, { categoryId: ID }],
      [RestoreCategoryRequest, { categoryId: ID }],
      [CreateItemRequest, create],
      [UpdateItemRequest, { itemId: ID, expectedVersion: 0, changes: {} }],
      [ReorderItemsRequest, { categoryId: ID, expectedVersion: 1, itemIds: [ID2] }],
      [ArchiveItemRequest, { itemId: ID }],
      [RestoreItemRequest, { itemId: ID }],
      [MarkItemUnavailableRequest, { itemId: ID }],
      [MarkItemAvailableRequest, { itemId: ID }],
    ];
    for (const [schema, body] of bodies) {
      expect(accepts(schema, body)).toBe(true);
      expect(accepts(schema, { ...body, extra: 1 })).toBe(false);
    }
  });

  it('7. a malformed uuid, and a version that is negative, fractional, a string or missing, are refused', () => {
    expect(accepts(ArchiveItemRequest, { itemId: 'not-a-uuid' })).toBe(false);
    for (const schema of [MarkItemUnavailableRequest, MarkItemAvailableRequest]) {
      expect(accepts(schema, { itemId: 'not-a-uuid' })).toBe(false);
      expect(accepts(schema, {})).toBe(false);
      expect(accepts(schema, { itemId: ID, expectedVersion: 1 })).toBe(false);
    }
    expect(accepts(ReorderCategoriesRequest, { expectedVersion: 1, categoryIds: ['nope'] })).toBe(false);
    for (const expectedVersion of [-1, 1.5, '1']) {
      expect(accepts(UpdateCategoryRequest, { categoryId: ID, expectedVersion, name: 'x' })).toBe(false);
    }
    expect(accepts(UpdateCategoryRequest, { categoryId: ID, name: 'x' })).toBe(false);
    expect(accepts(UpdateItemRequest, { itemId: ID, changes: {} })).toBe(false);
    expect(accepts(ReorderItemsRequest, { categoryId: ID, itemIds: [] })).toBe(false);
  });

  it('5. a create refuses a numeric price and a non-canonical one, in the base and in an option', () => {
    expect(accepts(CreateItemRequest, { ...create, basePrice: 10000 })).toBe(false);
    expect(accepts(CreateItemRequest, { ...create, basePrice: '01' })).toBe(false);
    expect(accepts(CreateItemRequest, { ...create, variants: [{ ...variantEntry, priceDelta: -5000 }] })).toBe(false);
    expect(accepts(CreateItemRequest, { ...create, variants: [{ ...variantEntry, priceDelta: '-0' }] })).toBe(false);
    expect(accepts(CreateItemRequest, { ...create, modifiers: [{ ...modifierEntry, priceDelta: 3000 }] })).toBe(false);
    // A modifier's change is never negative.
    expect(accepts(CreateItemRequest, { ...create, modifiers: [{ ...modifierEntry, priceDelta: '-1' }] })).toBe(false);
    expect(accepts(CreateItemRequest, { ...create, variants: [{ ...variantEntry, extra: 1 }] })).toBe(false);
  });

  describe('an item save', () => {
    const save = (changes: unknown) => ({ itemId: ID, expectedVersion: 2, changes });

    it('accepts every part of a change list', () => {
      expect(accepts(UpdateItemRequest, save({}))).toBe(true);
      expect(
        accepts(
          UpdateItemRequest,
          save({
            fields: { name: 'Flat white', basePrice: '32000', categoryId: ID2 },
            variants: {
              added: [{ key: 'k1', name: 'Small', priceDelta: '-1000' }],
              edited: [{ id: ID, name: 'Large', priceDelta: '2000' }, { id: ID2 }],
              removed: [ID2],
              order: [{ id: ID }, { key: 'k1' }],
            },
            modifiers: { added: [{ key: 'm1', name: 'Oat', priceDelta: '0' }], order: [{ key: 'm1' }] },
          })
        )
      ).toBe(true);
    });

    it('7. an extra key is refused inside changes, fields, a list, and an added or edited entry', () => {
      expect(accepts(UpdateItemRequest, save({ extra: 1 }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ fields: { extra: 1 } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { extra: [] } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ modifiers: { extra: [] } }))).toBe(false);
      expect(
        accepts(UpdateItemRequest, save({ variants: { added: [{ key: 'k', name: 'S', priceDelta: '0', extra: 1 }] } }))
      ).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { edited: [{ id: ID, extra: 1 }] } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ modifiers: { edited: [{ id: ID, extra: 1 }] } }))).toBe(false);
    });

    it('7. an order entry carrying both id and key, an empty key and a control character in a key are refused', () => {
      expect(accepts(UpdateItemRequest, save({ variants: { order: [{ id: ID, key: 'k' }] } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { order: [{}] } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { order: [{ key: '' }] } }))).toBe(false);
      expect(
        accepts(UpdateItemRequest, save({ variants: { added: [{ key: '', name: 'S', priceDelta: '0' }] } }))
      ).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { order: [{ key: 'k\u001b' }] } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { order: [{ key: 'k'.repeat(65) }] } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { order: [{ key: 'k'.repeat(64) }] } }))).toBe(true);
    });

    it('5. a price in a change is a canonical string with its list\'s bounds', () => {
      expect(accepts(UpdateItemRequest, save({ fields: { basePrice: 100 } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ fields: { basePrice: '-1' } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { edited: [{ id: ID, priceDelta: 5 }] } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { edited: [{ id: ID, priceDelta: '-0' }] } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { edited: [{ id: ID, priceDelta: '-5' }] } }))).toBe(true);
      expect(accepts(UpdateItemRequest, save({ modifiers: { edited: [{ id: ID, priceDelta: '-5' }] } }))).toBe(false);
      expect(
        accepts(UpdateItemRequest, save({ modifiers: { added: [{ key: 'k', name: 'S', priceDelta: 5 }] } }))
      ).toBe(false);
    });

    it('6. a name in a change follows its kind\'s rule', () => {
      expect(accepts(UpdateItemRequest, save({ fields: { name: ' Latte' } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ fields: { name: 'x'.repeat(65) } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ variants: { edited: [{ id: ID, name: 'x'.repeat(33) }] } }))).toBe(false);
      expect(accepts(UpdateItemRequest, save({ modifiers: { edited: [{ id: ID, name: 'a\nb' }] } }))).toBe(false);
    });
  });
});

describe('the views and responses', () => {
  const category = { categoryId: ID, name: 'Mains', displayOrder: 0, isActive: true };
  const variant = { variantId: ID, name: 'Large', priceDelta: '-5000', displayOrder: 0, isActive: true };
  const modifier = { modifierId: ID2, name: 'Oat', priceDelta: '3000', displayOrder: 1, isActive: false };
  const item = {
    itemId: ID,
    categoryId: ID2,
    name: 'Latte',
    basePrice: '30000',
    displayOrder: 2,
    isAvailable: true,
    isActive: true,
    variants: [variant],
    modifiers: [modifier],
  };

  it('accepts what the server answers', () => {
    expect(accepts(CategoryView, category)).toBe(true);
    expect(accepts(VariantView, variant)).toBe(true);
    expect(accepts(ModifierView, modifier)).toBe(true);
    expect(accepts(ItemView, item)).toBe(true);
    expect(accepts(CatalogResponse, { version: 0, categories: [category], items: [item] })).toBe(true);
    expect(accepts(CatalogResponse, { version: 0, categories: [], items: [] })).toBe(true);
    expect(accepts(CategoryResponse, { version: 4, category })).toBe(true);
    expect(accepts(CategoriesResponse, { version: 4, categories: [category] })).toBe(true);
    expect(accepts(ItemResponse, { version: 4, item })).toBe(true);
    expect(accepts(ItemsResponse, { version: 4, items: [item] })).toBe(true);
  });

  it('refuses an extra key in each view, nested ones included', () => {
    expect(accepts(CategoryView, { ...category, extra: 1 })).toBe(false);
    expect(accepts(VariantView, { ...variant, extra: 1 })).toBe(false);
    expect(accepts(ModifierView, { ...modifier, extra: 1 })).toBe(false);
    expect(accepts(ItemView, { ...item, extra: 1 })).toBe(false);
    expect(accepts(ItemView, { ...item, variants: [{ ...variant, extra: 1 }] })).toBe(false);
    expect(accepts(ItemView, { ...item, modifiers: [{ ...modifier, extra: 1 }] })).toBe(false);
    expect(accepts(CatalogResponse, { version: 0, categories: [], items: [], extra: 1 })).toBe(false);
    expect(accepts(ItemResponse, { version: 4, item, extra: 1 })).toBe(false);
  });

  it('refuses a numeric price in a view, and a missing field', () => {
    expect(accepts(ItemView, { ...item, basePrice: 30000 })).toBe(false);
    expect(accepts(VariantView, { ...variant, priceDelta: -5000 })).toBe(false);
    expect(accepts(ModifierView, { ...modifier, priceDelta: 3000 })).toBe(false);
    const { displayOrder: _omitted, ...withoutOrder } = category;
    expect(accepts(CategoryView, withoutOrder)).toBe(false);
    const { isAvailable: _unavailable, ...withoutAvailable } = item;
    expect(accepts(ItemView, withoutAvailable)).toBe(false);
  });
});
