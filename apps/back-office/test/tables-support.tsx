import { act } from 'react';
import { Screens } from '../src/Screens.js';
import { HEALTH, ME, VIEW, makeHarness, mount, ok } from './session-harness.js';

// Shared by the BO-05 client tests: the five routes, three tables, and the few ways a test
// reaches a table, a button by its accessible name, and a controlled input's value.

export const LIST = 'GET /api/back-office/config/tables';
export const CREATE = 'POST /api/back-office/config/tables/create';
export const UPDATE = 'POST /api/back-office/config/tables/update';
export const DEACTIVATE = 'POST /api/back-office/config/tables/deactivate';
export const REACTIVATE = 'POST /api/back-office/config/tables/reactivate';

export const T1 = { tableId: '11111111-1111-4111-8111-111111111111', label: 'Table 1', isActive: true };
export const T2 = { tableId: '22222222-2222-4222-8222-222222222222', label: 'Table 2', isActive: true };
export const T3 = { tableId: '33333333-3333-4333-8333-333333333333', label: 'Terrace 1', isActive: false };
export type Row = typeof T1;

export const tables = (...rows: Row[]) => ok({ tables: rows });
export const table = (row: Row) => ok({ table: row });

export const OTHER = { ...VIEW, staffUserId: 'm-2', name: 'R. Ayu', username: 'r.ayu', csrfToken: 'tok-2' };

/** A harness whose health read answers, at the address BO-05 lives at. */
export function harness(path = '/back-office/tables') {
  const h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
  window.history.pushState(null, '', path);
  return h;
}

/** Mounts the real screens for a signed-in manager; `first` is the answer to the first list read. */
export async function openScreens(h: ReturnType<typeof harness>, first = tables(T1, T2, T3)) {
  h.reply(ME, ok(VIEW));
  h.reply(LIST, first);
  const view = mount(h.store, <Screens />);
  await h.settle();
  return view;
}

export function named(root: ParentNode, name: string): HTMLElement {
  const found = [...root.querySelectorAll<HTMLElement>('button, a')].find(
    (el) => (el.getAttribute('aria-label') ?? el.textContent) === name
  );
  if (!found) throw new Error(`nothing named ${name}`);
  return found;
}

export const tap = (el: HTMLElement) => act(() => el.click());

/** A controlled input takes its value through the prototype's setter, or React sees no change. */
export function typeInto(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export const labelField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#table-label');
export const panel = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="dialog"][aria-modal="false"]');
export const panelName = (host: HTMLElement) => {
  const p = panel(host);
  return p ? (p.querySelector(`#${p.getAttribute('aria-labelledby')}`)?.textContent ?? null) : null;
};
export const pageStatus = (host: HTMLElement) => host.querySelector('#table-status');
export const formNotice = (host: HTMLElement) => host.querySelector('#form-notice');
export const openDialogs = () => [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')];
export const dialogNamed = (title: string) =>
  openDialogs().find((d) => d.querySelector(`#${d.getAttribute('aria-labelledby')}`)?.textContent === title) ?? null;

/** The labels in the list, in the order they are drawn. */
export const rowLabels = (host: HTMLElement) =>
  [...host.querySelectorAll('#tables-list tbody tr')].map((tr) => tr.querySelector('td')!.firstChild!.textContent);

/** The requests of the commands and the list, in order, without the session's own. */
export const configCalls = (h: ReturnType<typeof harness>) =>
  h.calls.filter((c) => c.url.startsWith('/api/back-office/config/')).map((c) => `${c.method} ${c.url}`);
