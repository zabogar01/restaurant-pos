import type { FastifyPluginAsync } from 'fastify';
import {
  ArchiveCategoryRequest,
  ArchiveItemRequest,
  CreateCategoryRequest,
  CreateItemRequest,
  ErrorCode,
  ReorderCategoriesRequest,
  ReorderItemsRequest,
  RestoreCategoryRequest,
  RestoreItemRequest,
  UpdateCategoryRequest,
  UpdateItemRequest,
} from '@pos/contracts';
import type {
  CatalogResponse,
  CategoriesResponse,
  CategoryResponse,
  CategoryView,
  ItemChanges as ItemChangesWire,
  ItemResponse,
  ItemsResponse,
  ItemView,
  ModifierView,
  VariantView,
} from '@pos/contracts';
import { decodeMoney, encodeMoney } from '@pos/money';
import {
  archiveCategory,
  archiveItem,
  createCategory,
  createItem,
  editCategory,
  editItem,
  readCatalog,
  reorderCategories,
  reorderItems,
  restoreCategory,
  restoreItem,
} from '../../domain/catalog.js';
import type {
  CatalogCategory,
  CatalogItem,
  CatalogOption,
  CatalogOutcome,
  ItemChanges,
  OptionListChanges,
} from '../../domain/catalog.js';
import { AppError } from '../errors.js';
import { parseBody } from '../validate.js';

// A refusal is raised here, from the domain's answer; the domain never names a code.
// `DUPLICATE` is bare on every catalog route: the domain's `of` is not sent (S4b ruling 1).
// The answer does not say whether the command wrote: a client reads "unchanged" from a
// version equal to the one it stood at.
function answered<R, T>(outcome: CatalogOutcome<R>, respond: (version: number, record: R) => T): T {
  switch (outcome.kind) {
    case 'STALE':
      throw new AppError(ErrorCode.CATALOG_CHANGED, 409);
    case 'NOT_FOUND':
      throw new AppError(ErrorCode.NOT_FOUND, 404);
    case 'DUPLICATE':
      throw new AppError(ErrorCode.DUPLICATE, 409);
    case 'INVALID':
      throw new AppError(ErrorCode.VALIDATION_FAILED, 400);
    case 'OK':
    case 'UNCHANGED':
      return respond(outcome.version, outcome.record);
  }
}

// ---- views, built from the domain's records -----------------------------------------

const categoryView = (category: CatalogCategory): CategoryView => ({ ...category });

const variantView = (option: CatalogOption): VariantView => ({
  variantId: option.optionId,
  name: option.name,
  priceDelta: encodeMoney(option.priceDelta),
  displayOrder: option.displayOrder,
  isActive: option.isActive,
});

const modifierView = (option: CatalogOption): ModifierView => ({
  modifierId: option.optionId,
  name: option.name,
  priceDelta: encodeMoney(option.priceDelta),
  displayOrder: option.displayOrder,
  isActive: option.isActive,
});

const itemView = (item: CatalogItem): ItemView => ({
  itemId: item.itemId,
  categoryId: item.categoryId,
  name: item.name,
  basePrice: encodeMoney(item.basePrice),
  displayOrder: item.displayOrder,
  isAvailable: item.isAvailable,
  isActive: item.isActive,
  variants: item.variants.map(variantView),
  modifiers: item.modifiers.map(modifierView),
});

// ---- the wire's prices, read once -----------------------------------------------------

type OptionListWire = NonNullable<ItemChangesWire['variants']>;

/** Prices decoded and absent fields left absent, so the domain sees only what changes. */
function listChanges(wire: OptionListWire): OptionListChanges {
  return {
    ...(wire.added && {
      added: wire.added.map((add) => ({ key: add.key, name: add.name, priceDelta: decodeMoney(add.priceDelta) })),
    }),
    ...(wire.edited && {
      edited: wire.edited.map((edit) => ({
        id: edit.id,
        ...(edit.name !== undefined && { name: edit.name }),
        ...(edit.priceDelta !== undefined && { priceDelta: decodeMoney(edit.priceDelta) }),
      })),
    }),
    ...(wire.removed && { removed: wire.removed }),
    ...(wire.order && { order: wire.order }),
  };
}

function itemChanges(wire: ItemChangesWire): ItemChanges {
  const { fields } = wire;
  return {
    ...(fields && {
      fields: {
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.basePrice !== undefined && { basePrice: decodeMoney(fields.basePrice) }),
        ...(fields.categoryId !== undefined && { categoryId: fields.categoryId }),
      },
    }),
    ...(wire.variants && { variants: listChanges(wire.variants) }),
    ...(wire.modifiers && { modifiers: listChanges(wire.modifiers) }),
  };
}

/**
 * Menu catalog configuration (BO-03, BO-04; ADR-012 Part 2). The guard has already
 * required an active back-office session, a manager and, on a POST, the anti-CSRF token
 * by the time a handler runs. The read is not interactive; every command is, because a
 * command is a person pressing a control.
 */
export const backOfficeCatalogRoutes: FastifyPluginAsync = async (api) => {
  const BASE = '/back-office/config/catalog';
  const command = { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } } as const;

  api.get(
    BASE,
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: false } } },
    async (): Promise<CatalogResponse> => {
      const snapshot = await readCatalog();
      return {
        version: snapshot.version,
        categories: snapshot.categories.map(categoryView),
        items: snapshot.items.map(itemView),
      };
    }
  );

  api.post(`${BASE}/categories/create`, command, async (request): Promise<CategoryResponse> => {
    const { name } = parseBody(CreateCategoryRequest, request.body);
    return answered(await createCategory(name), (version, category) => ({
      version,
      category: categoryView(category),
    }));
  });

  api.post(`${BASE}/categories/update`, command, async (request): Promise<CategoryResponse> => {
    const { categoryId, expectedVersion, name } = parseBody(UpdateCategoryRequest, request.body);
    return answered(await editCategory(categoryId, expectedVersion, { name }), (version, category) => ({
      version,
      category: categoryView(category),
    }));
  });

  api.post(`${BASE}/categories/reorder`, command, async (request): Promise<CategoriesResponse> => {
    const { expectedVersion, categoryIds } = parseBody(ReorderCategoriesRequest, request.body);
    return answered(await reorderCategories(expectedVersion, categoryIds), (version, categories) => ({
      version,
      categories: categories.map(categoryView),
    }));
  });

  api.post(`${BASE}/categories/archive`, command, async (request): Promise<CategoryResponse> => {
    const { categoryId } = parseBody(ArchiveCategoryRequest, request.body);
    return answered(await archiveCategory(categoryId), (version, category) => ({
      version,
      category: categoryView(category),
    }));
  });

  api.post(`${BASE}/categories/restore`, command, async (request): Promise<CategoryResponse> => {
    const { categoryId } = parseBody(RestoreCategoryRequest, request.body);
    return answered(await restoreCategory(categoryId), (version, category) => ({
      version,
      category: categoryView(category),
    }));
  });

  api.post(`${BASE}/items/create`, command, async (request): Promise<ItemResponse> => {
    const body = parseBody(CreateItemRequest, request.body);
    const outcome = await createItem({
      categoryId: body.categoryId,
      name: body.name,
      basePrice: decodeMoney(body.basePrice),
      variants: body.variants.map((v) => ({ name: v.name, priceDelta: decodeMoney(v.priceDelta) })),
      modifiers: body.modifiers.map((m) => ({ name: m.name, priceDelta: decodeMoney(m.priceDelta) })),
    });
    return answered(outcome, (version, item) => ({ version, item: itemView(item) }));
  });

  api.post(`${BASE}/items/update`, command, async (request): Promise<ItemResponse> => {
    const { itemId, expectedVersion, changes } = parseBody(UpdateItemRequest, request.body);
    return answered(await editItem(itemId, expectedVersion, itemChanges(changes)), (version, item) => ({
      version,
      item: itemView(item),
    }));
  });

  api.post(`${BASE}/items/reorder`, command, async (request): Promise<ItemsResponse> => {
    const { categoryId, expectedVersion, itemIds } = parseBody(ReorderItemsRequest, request.body);
    return answered(await reorderItems(categoryId, expectedVersion, itemIds), (version, items) => ({
      version,
      items: items.map(itemView),
    }));
  });

  api.post(`${BASE}/items/archive`, command, async (request): Promise<ItemResponse> => {
    const { itemId } = parseBody(ArchiveItemRequest, request.body);
    return answered(await archiveItem(itemId), (version, item) => ({ version, item: itemView(item) }));
  });

  api.post(`${BASE}/items/restore`, command, async (request): Promise<ItemResponse> => {
    const { itemId } = parseBody(RestoreItemRequest, request.body);
    return answered(await restoreItem(itemId), (version, item) => ({ version, item: itemView(item) }));
  });
};
