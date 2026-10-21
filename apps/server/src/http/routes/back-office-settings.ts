import type { FastifyPluginAsync } from 'fastify';
import { ErrorCode, SaveSettingsRequest } from '@pos/contracts';
import type { SettingsReadView, SettingsVersionView } from '@pos/contracts';
import {
  INSTALLATION_CURRENCY,
  INSTALLATION_MINOR_UNIT_PRECISION,
  decodeRate,
  encodeRate,
} from '@pos/money';
import { readCurrentSettings, saveSettings } from '../../domain/settings.js';
import type { SettingsVersion } from '../../domain/settings.js';
import { AppError } from '../errors.js';
import { actorOf } from '../session-guard.js';
import { parseBody } from '../validate.js';

const versionView = (v: SettingsVersion): SettingsVersionView => ({
  version: v.version,
  createdAt: v.createdAt.toISOString(),
  createdByName: v.createdByName,
  taxRatePpm: encodeRate(v.taxRate),
  serviceChargeRatePpm: encodeRate(v.serviceChargeRate),
  outletName: v.outletName,
  address: v.address,
  phone: v.phone,
  npwpd: v.npwpd,
  footer: v.footer,
});

// The currency and the precision come from the installation's constants and are never
// stored (ADR-012 rule 5).
const readView = (current: SettingsVersion | null): SettingsReadView => ({
  installation: {
    currency: INSTALLATION_CURRENCY,
    minorUnitPrecision: INSTALLATION_MINOR_UNIT_PRECISION,
  },
  current: current === null ? null : versionView(current),
});

/**
 * The installation's settings (BO-08; ADR-012 Part 1). The guard has already required an
 * active back-office session, a manager and, on the POST, the anti-CSRF token by the time
 * a handler runs. The read is not interactive; the save is, because it is a person
 * pressing a control.
 */
export const backOfficeSettingsRoutes: FastifyPluginAsync = async (api) => {
  api.get(
    '/back-office/config/settings',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: false } } },
    async (): Promise<SettingsReadView> => readView(await readCurrentSettings())
  );

  api.post(
    '/back-office/config/settings/save',
    { config: { access: { session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true } } },
    async (request): Promise<SettingsReadView> => {
      const body = parseBody(SaveSettingsRequest, request.body);
      // The author is the signed-in manager, never a field of the request.
      const outcome = await saveSettings({
        actorId: actorOf(request).staffUserId,
        expectedVersion: body.expectedVersion,
        values: {
          taxRate: decodeRate(body.taxRatePpm),
          serviceChargeRate: decodeRate(body.serviceChargeRatePpm),
          outletName: body.outletName,
          address: body.address,
          phone: body.phone,
          npwpd: body.npwpd,
          footer: body.footer,
        },
      });
      if (outcome.kind === 'STALE') throw new AppError(ErrorCode.SETTINGS_CHANGED, 409);
      return readView(outcome.current);
    }
  );
};
