import type { FastifyPluginAsync } from 'fastify';
import type { PosMenuResponse, PosRevisionResponse } from '@pos/contracts';
import { encodeMoney, encodeRate } from '@pos/money';
import type { PresetValue } from '../../domain/discount-preset.js';
import { readCatalogVersion, readPosMenu } from '../../domain/pos-menu.js';
import type { PosMenuOption } from '../../domain/pos-menu.js';

type PresetValueWire = PosMenuResponse['presets'][number]['value'];

const valueView = (value: PresetValue): PresetValueWire =>
  value.kind === 'PERCENTAGE'
    ? { kind: 'PERCENTAGE', ratePpm: encodeRate(value.ratePpm) }
    : { kind: 'FIXED', amount: encodeMoney(value.amount) };

/**
 * The POS's catalog reads (ARCHITECTURE 4.3, ADR-012 rules 10 to 12). Both are for an
 * active POS session and neither is interactive: the revision is polled every two seconds
 * and the menu is reread on a change, so a read of either must never extend the 90-second
 * idle (FR-A2b, AC-28). Nothing here writes.
 */
export const posCatalogRoutes: FastifyPluginAsync = async (api) => {
  const access = { session: 'ACTIVE', audience: 'POS', interactive: false } as const;

  // The poll. It opts out of the client-instance hook, as health does: otherwise every
  // poll would be an UPDATE client_instance, a write every two seconds per tab, for a
  // telemetry stamp the poll has no need to move. The first API request is still `me`.
  // Its request and reply lines are written at `warn`, so a poll leaves no line at the
  // default `info`; a 500 is logged at `error` and still appears.
  api.get(
    '/pos/catalog/revision',
    { logLevel: 'warn', config: { access, clientInstance: false } },
    async (): Promise<PosRevisionResponse> => ({ version: await readCatalogVersion() })
  );

  api.get('/pos/catalog/menu', { config: { access } }, async (): Promise<PosMenuResponse> => {
    const snapshot = await readPosMenu();
    const variant = (option: PosMenuOption) => ({
      variantId: option.optionId,
      name: option.name,
      priceDelta: encodeMoney(option.priceDelta),
    });
    const modifier = (option: PosMenuOption) => ({
      modifierId: option.optionId,
      name: option.name,
      priceDelta: encodeMoney(option.priceDelta),
    });
    return {
      version: snapshot.version,
      categories: snapshot.categories,
      items: snapshot.items.map((item) => ({
        itemId: item.itemId,
        categoryId: item.categoryId,
        name: item.name,
        basePrice: encodeMoney(item.basePrice),
        isAvailable: item.isAvailable,
        variants: item.variants.map(variant),
        modifiers: item.modifiers.map(modifier),
      })),
      presets: snapshot.presets.map((preset) => ({
        presetId: preset.presetId,
        name: preset.name,
        value: valueView(preset.value),
      })),
    };
  });
};
