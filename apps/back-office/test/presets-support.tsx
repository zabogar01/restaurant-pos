import { Screens } from '../src/Screens.js';
import { PRESETS, REGULAR, type Preset } from './presets-data.js';
import { HEALTH, ME, VIEW, makeHarness, mount, ok, refusal } from './session-harness.js';
import { named, tap, typeInto } from './tables-support.js';

// Shared by the BO-07 client tests: the five preset routes, four presets in creation order, and
// the few ways a test reaches a row, the panel and a request body.

export const READ = 'GET /api/back-office/config/catalog/presets';
export const P_CREATE = 'POST /api/back-office/config/catalog/presets/create';
export const P_UPDATE = 'POST /api/back-office/config/catalog/presets/update';
export const P_DEACTIVATE = 'POST /api/back-office/config/catalog/presets/deactivate';
export const P_REACTIVATE = 'POST /api/back-office/config/catalog/presets/reactivate';

export * from './presets-data.js';

export const presetList = (version: number, rows: Preset[] = PRESETS) => ok({ version, presets: rows });
export const presetAnswer = (version: number, record: Preset) => ok({ version, preset: record });

/** A harness whose health read answers, at the address BO-07 lives at. */
export function harness(path = '/back-office/presets') {
  const h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
  window.history.pushState(null, '', path);
  return h;
}

/** Mounts the real screens for a signed-in manager; `first` is the answer to the first presets read. */
export async function openPresets(h: ReturnType<typeof harness>, first = presetList(12)) {
  h.reply(ME, ok(VIEW));
  h.reply(READ, first);
  const view = mount(h.store, <Screens />);
  await h.settle();
  return view;
}

/** Like `openPresets`, with the first read held until the test delivers it. */
export async function openPresetsHeld(h: ReturnType<typeof harness>) {
  h.reply(ME, ok(VIEW));
  h.reply(READ, presetList(12));
  const held = h.hold(READ);
  const view = mount(h.store, <Screens />);
  await h.settle();
  return { view, held };
}

export { named, tap, typeInto };

/** The body of the nth request sent to `key`, parsed. */
export const bodyOf = (h: ReturnType<typeof harness>, key: string, n = 0): Record<string, unknown> =>
  JSON.parse(h.keyed(key)[n]!.body!) as Record<string, unknown>;

export const byId = (host: ParentNode, selector: string) => host.querySelector<HTMLElement>(selector);
export const nameField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#preset-name');
export const percentField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#preset-percent');
export const amountField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#preset-amount');
export const panel = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="dialog"][aria-modal="false"]');
export const panelName = (host: HTMLElement) => host.querySelector('#editor-title')?.textContent ?? null;
export const pageStatus = (host: HTMLElement) => host.querySelector('#page-status');
export const formNotice = (host: HTMLElement) => host.querySelector('#form-notice');
export const aria = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';
export const rail = (host: HTMLElement) => host.querySelector<HTMLElement>('.bonav')!;
export const facts = (host: HTMLElement) => host.querySelector('#list-facts');
export const rowText = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The preset names in the order the table draws them (the name only, without a marker). */
export const rowNames = (host: HTMLElement) =>
  [...host.querySelectorAll('#preset-rows tr')].map((tr) => tr.querySelector('td')!.firstChild!.textContent);

export const rowOf = (host: HTMLElement, presetId: string) =>
  host.querySelector<HTMLElement>(`tr[data-preset="${presetId}"]`)!;

/** A row's discount cell as [value, kind]: the value above its kind. */
export const discountOf = (host: HTMLElement, presetId: string): [string, string] => {
  const cell = rowOf(host, presetId).querySelector('.num')!;
  return [cell.querySelector('.preset-value')!.textContent!, cell.querySelector('.preset-kind')!.textContent!];
};

/**
 * The partial state: a reactivation of Regular customer is in flight, a revisit of BO-07 reads the
 * list and the read fails, and then the command answers. The answered record is applied to the
 * rows the client knew, and the read still stands failed.
 */
export async function reachPartial(
  h: ReturnType<typeof harness>,
  host: HTMLElement,
  answer = presetAnswer(13, { ...REGULAR, isActive: true })
) {
  h.reply(P_REACTIVATE, answer);
  const held = h.hold(P_REACTIVATE);
  tap(named(host, 'Reactivate Regular customer'));
  h.reply(READ, refusal('INTERNAL', undefined, 500));
  tap(named(rail(host), 'Tables'));
  await h.settle();
  tap(named(rail(host), 'Discount presets'));
  await h.settle();
  held.deliver(answer);
  await h.settle();
}

/** Opens New preset and types a name and a percentage, unsaved. */
export function newPercentDraft(host: HTMLElement, name = 'Happy hour', rate = '10') {
  tap(named(host, 'New preset'));
  typeInto(nameField(host)!, name);
  typeInto(percentField(host)!, rate);
}

/** Every request to the preset routes, in order, without the session's own. */
export const presetCalls = (h: ReturnType<typeof harness>) =>
  h.calls.filter((c) => c.url.startsWith('/api/back-office/config/catalog/presets')).map((c) => `${c.method} ${c.url}`);
