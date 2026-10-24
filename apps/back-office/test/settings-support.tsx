import { act } from 'react';
import type { SettingsVersionView } from '@pos/contracts';
import { Screens } from '../src/Screens.js';
import { ME, VIEW, mount, ok } from './session-harness.js';
import { harness } from './tables-support.js';

// Shared by the BO-08 client tests: the two settings routes, a few versions of the settings,
// and the few ways a test reaches a field (a label, then an input or a textarea).

export const READ = 'GET /api/back-office/config/settings';
export const SAVE = 'POST /api/back-office/config/settings/save';
export const SETTINGS_PATH = '/back-office/settings';

// BO-08's payment-methods part (PHASE1-S3b): the five tender-methods routes and a few methods.
export const METHODS = 'GET /api/back-office/config/tender-methods';
export const M_CREATE = 'POST /api/back-office/config/tender-methods/create';
export const M_UPDATE = 'POST /api/back-office/config/tender-methods/update';
export const M_DEACTIVATE = 'POST /api/back-office/config/tender-methods/deactivate';
export const M_REACTIVATE = 'POST /api/back-office/config/tender-methods/reactivate';

export const makeMethod = (n: number, name: string, isActive: boolean) => ({
  tenderMethodId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`,
  name,
  isActive,
});
export const QRIS = makeMethod(1, 'qris', false);
export const BANK = makeMethod(2, 'Bank transfer', true);
export const GOPAY2 = makeMethod(3, 'GoPay 2', true);
export const GOPAY10 = makeMethod(4, 'GoPay 10', true);
export type MethodRow = typeof QRIS;

export const methodsView = (...rows: MethodRow[]) => ok({ tenderMethods: rows });
export const methodAnswer = (row: MethodRow) => ok({ tenderMethod: row });

export const INSTALLATION = { currency: 'IDR', minorUnitPrecision: 0 };

/** A clock reading in the browser's own zone, so the facts line reads the same wherever the tests run. */
const at = (day: number, hour: number, minute: number): string => new Date(2026, 9, day, hour, minute).toISOString();

export const V4: SettingsVersionView = {
  version: 4,
  createdAt: at(12, 14, 5),
  createdByName: 'M. Iqbal',
  taxRatePpm: '100000',
  serviceChargeRatePpm: '50000',
  outletName: 'Warung Sederhana',
  address: 'Jl. Melati No. 12\nKebayoran Baru\nJakarta Selatan 12160',
  phone: '021 555 0134',
  npwpd: 'P.2.0012345.07.001',
  footer: 'Terima kasih atas kunjungan Anda',
};

/** The version after V4, saved by another manager with a different service charge and phone. */
export const V5: SettingsVersionView = {
  ...V4,
  version: 5,
  createdAt: at(21, 14, 32),
  createdByName: 'Ratna Ayu',
  serviceChargeRatePpm: '55000',
  phone: '021 555 0199',
};

export const withVersion = (base: SettingsVersionView, patch: Partial<SettingsVersionView>): SettingsVersionView => ({
  ...base,
  ...patch,
});

export const settingsView = (current: SettingsVersionView | null) => ok({ installation: INSTALLATION, current });

/** A harness at BO-08's path, signed in, with the first settings read answered. */
export async function openSettings(
  h: ReturnType<typeof harness>,
  first: ReturnType<typeof settingsView> = settingsView(V4),
  methods: ReturnType<typeof methodsView> = methodsView()
) {
  h.reply(ME, ok(VIEW));
  h.reply(READ, first);
  h.reply(METHODS, methods);
  const view = mount(h.store, <Screens />);
  await h.settle();
  return view;
}

export const settingsHarness = (path = SETTINGS_PATH) => harness(path);

type Box = HTMLInputElement | HTMLTextAreaElement;

/** The input or textarea a label names. */
export function box(root: ParentNode, label: string): Box {
  const found = [...root.querySelectorAll<Box>('input, textarea')].find(
    (el) => root.querySelector(`label[for="${el.id}"]`)?.textContent === label
  );
  if (!found) throw new Error(`no field labelled ${label}`);
  return found;
}

/** A controlled input or textarea takes its value through the prototype's setter, or React sees no change. */
export function typeIn(el: Box, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export const fill = (root: ParentNode, label: string, value: string) => typeIn(box(root, label), value);

export const methodNameField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#method-name');
export const methodsStatus = (host: HTMLElement) => host.querySelector<HTMLElement>('#methods-status');
export const methodNotice = (host: HTMLElement) => host.querySelector<HTMLElement>('#method-notice');
export const methodPanel = (host: HTMLElement) => host.querySelector<HTMLElement>('#method-editor');
/** The names in the methods table, in the order they are drawn: the two fixed rows, then the custom ones. */
export const methodRowNames = (host: HTMLElement) =>
  [...host.querySelectorAll('#methods-list tbody tr')].map((tr) => tr.querySelector('td')!.firstChild!.textContent);
export const methodRow = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll<HTMLElement>('#methods-list tbody tr')].find((tr) => tr.querySelector('td')!.firstChild!.textContent === name)!;
/** The requests of the methods routes, in order. */
export const methodCalls = (h: ReturnType<typeof harness>) =>
  h.calls.filter((c) => c.url.startsWith('/api/back-office/config/tender-methods')).map((c) => `${c.method} ${c.url}`);
export const methodBody = (h: ReturnType<typeof harness>, key: string, n = 0) =>
  JSON.parse(h.keyed(key)[n]!.body!) as Record<string, unknown>;

export const facts = (host: HTMLElement) => host.querySelector('#version-facts');
export const notice = (host: HTMLElement) => host.querySelector<HTMLElement>('#settings-notice');
export const status = (host: HTMLElement) => host.querySelector<HTMLElement>('#settings-status');
export const form = (host: HTMLElement) => host.querySelector<HTMLFormElement>('#settings-form');
export const errorOf = (host: HTMLElement, id: string) => host.querySelector(`#${id}-error`)?.textContent ?? null;

/** The requests of the settings routes, in order, without the session's own. */
export const settingsCalls = (h: ReturnType<typeof harness>) =>
  h.calls.filter((c) => c.url.startsWith('/api/back-office/config/settings')).map((c) => `${c.method} ${c.url}`);

/** The body of the nth save the page sent. */
export const saveBody = (h: ReturnType<typeof harness>, n = 0) => JSON.parse(h.keyed(SAVE)[n]!.body!) as Record<string, unknown>;

/** The version the answer to a save carries: the full view, with `current` replaced. */
export const answer = (current: SettingsVersionView) => settingsView(current);
