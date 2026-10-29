import type { FastifyPluginAsync } from 'fastify';
import {
  CreatePresetRequest,
  DeactivatePresetRequest,
  ErrorCode,
  ReactivatePresetRequest,
  UpdatePresetRequest,
} from '@pos/contracts';
import type { PresetResponse, PresetValue as PresetValueWire, PresetView, PresetsResponse } from '@pos/contracts';
import { decodeMoney, decodeRate, encodeMoney, encodeRate } from '@pos/money';
import type { CatalogOutcome } from '../../domain/catalog.js';
import {
  createPreset,
  deactivatePreset,
  editPreset,
  listPresets,
  reactivatePreset,
} from '../../domain/discount-preset.js';
import type { DiscountPreset, PresetValue } from '../../domain/discount-preset.js';
import { AppError } from '../errors.js';
import { parseBody } from '../validate.js';

// A refusal is raised here, from the domain's answer; the domain never names a code.
// `DUPLICATE` is bare, as on every catalog route (S4b ruling 1). The answer does not say
// whether the command wrote: a client reads "unchanged" from a version equal to the one
// it stood at. A preset command has no shape the stored state could refuse as `INVALID`.
function answered(outcome: CatalogOutcome<DiscountPreset>): PresetResponse {
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
      return { version: outcome.version, preset: presetView(outcome.record) };
  }
}

// The domain holds a rate and an amount as bigints; the wire carries canonical strings.
const valueView = (value: PresetValue): PresetValueWire =>
  value.kind === 'PERCENTAGE'
    ? { kind: 'PERCENTAGE', ratePpm: encodeRate(value.ratePpm) }
    : { kind: 'FIXED', amount: encodeMoney(value.amount) };

const valueOf = (wire: PresetValueWire): PresetValue =>
  wire.kind === 'PERCENTAGE'
    ? { kind: 'PERCENTAGE', ratePpm: decodeRate(wire.ratePpm) }
    : { kind: 'FIXED', amount: decodeMoney(wire.amount) };

const presetView = (preset: DiscountPreset): PresetView => ({
  presetId: preset.presetId,
  name: preset.name,
  value: valueView(preset.value),
  isActive: preset.isActive,
});

/**
 * Discount preset configuration (FR-B5; ADR-012 rule 10). The guard has already required
 * an active back-office session, a manager and, on a POST, the anti-CSRF token by the
 * time a handler runs. The read is not interactive; every command is, because a command
 * is a person pressing a control.
 */
export const backOfficePresetRoutes: FastifyPluginAsync = async (api) => {
  const BASE = '/back-office/config/catalog/presets';
  const command = { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } } as const;

  api.get(
    BASE,
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: false } } },
    async (): Promise<PresetsResponse> => {
      const snapshot = await listPresets();
      return { version: snapshot.version, presets: snapshot.presets.map(presetView) };
    }
  );

  api.post(`${BASE}/create`, command, async (request): Promise<PresetResponse> => {
    const { name, value } = parseBody(CreatePresetRequest, request.body);
    return answered(await createPreset(name, valueOf(value)));
  });

  api.post(`${BASE}/update`, command, async (request): Promise<PresetResponse> => {
    const { presetId, expectedVersion, name, value } = parseBody(UpdatePresetRequest, request.body);
    return answered(await editPreset(presetId, expectedVersion, { name, value: valueOf(value) }));
  });

  api.post(`${BASE}/deactivate`, command, async (request): Promise<PresetResponse> => {
    const { presetId } = parseBody(DeactivatePresetRequest, request.body);
    return answered(await deactivatePreset(presetId));
  });

  api.post(`${BASE}/reactivate`, command, async (request): Promise<PresetResponse> => {
    const { presetId } = parseBody(ReactivatePresetRequest, request.body);
    return answered(await reactivatePreset(presetId));
  });
};
