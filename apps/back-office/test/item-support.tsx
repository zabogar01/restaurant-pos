import { act } from 'react';
import { ME, VIEW, mount, ok } from './session-harness.js';
import {
  BURGER, DRINKS, MAINS, READ, SEASONAL, catalog, harness, itemAnswer, named, tap,
  type Cat, type Item,
} from './menu-support.js';
import { Screens } from '../src/Screens.js';

// Shared by the BO-04 client tests: the two item routes, a way to open the editor from BO-03 the
// way a manager does (Edit on a row, New item on a category), and the few ways a test reaches a
// field, a notice and a request body.

export const ITEM_CREATE = 'POST /api/back-office/config/catalog/items/create';
export const ITEM_UPDATE = 'POST /api/back-office/config/catalog/items/update';

export { READ, catalog, harness, itemAnswer, named, tap, BURGER, MAINS, DRINKS, SEASONAL };

/** Mounts the real screens at Menu; the answers queued for the catalog read are, in order, Menu's, BO-04's, and so on. */
export async function openMenuWith(h: ReturnType<typeof harness>, ...reads: ReturnType<typeof catalog>[]) {
  h.reply(ME, ok(VIEW));
  h.reply(READ, ...(reads.length === 0 ? [catalog(5)] : reads));
  const view = mount(h.store, <Screens />);
  await h.settle();
  return view;
}

export async function press(h: ReturnType<typeof harness>, host: HTMLElement, name: string) {
  tap(named(host, name));
  await h.settle();
}

/** Edit on an item's row, with BO-04's read settled. */
export const editFrom = (h: ReturnType<typeof harness>, host: HTMLElement, item: string) => press(h, host, `Edit ${item}`);
/** New item on a category's header, with BO-04's read settled. */
export const newIn = (h: ReturnType<typeof harness>, host: HTMLElement, category: string) =>
  press(h, host, `New item in ${category}`);

export const q = <T extends HTMLElement = HTMLElement>(host: HTMLElement, selector: string) => host.querySelector<T>(selector);
export const nameInput = (host: HTMLElement) => q<HTMLInputElement>(host, '#item-name')!;
export const priceInput = (host: HTMLElement) => q<HTMLInputElement>(host, '#item-price')!;
export const categorySelect = (host: HTMLElement) => q<HTMLSelectElement>(host, '#item-category')!;
export const title = (host: HTMLElement) => q(host, '#item-title')?.textContent ?? null;
export const statusLine = (host: HTMLElement) => q(host, '#item-status')?.textContent ?? null;
export const context = (host: HTMLElement) => q(host, '#item-context')?.textContent ?? null;
export const facts = (host: HTMLElement) => q(host, '#version-facts')?.textContent ?? null;
export const notice = (host: HTMLElement) => q(host, '#form-notice');
export const noticeText = (host: HTMLElement) => notice(host)?.textContent ?? null;
export const save = (host: HTMLElement) => q<HTMLButtonElement>(host, '#save-item')!;
export const hint = (host: HTMLElement) => q(host, '#save-hint')?.textContent ?? null;
export const nameErrorText = (host: HTMLElement) => q(host, '#item-name-error')?.textContent ?? null;
export const categoryErrorText = (host: HTMLElement) => q(host, '#item-category-error')?.textContent ?? null;
export const priceErrorText = (host: HTMLElement) => q(host, '#item-price-error')?.textContent ?? null;
export const compare = (host: HTMLElement) => q(host, '#comparison');
export const currentValues = (host: HTMLElement) => q(host, '#current-values');
export const readState = (host: HTMLElement) => q(host, '#read-state');
export const holderLine = (host: HTMLElement) => q(host, '#duplicate-holder');

/** A controlled select takes its value through the prototype's setter, or React sees no change. */
export function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

export const optionLabels = (select: HTMLSelectElement) =>
  [...select.options].map((o) => `${o.textContent}${o.disabled ? ' [disabled]' : ''}`);

export const submit = (host: HTMLElement) =>
  act(() => {
    q(host, '#item-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

/** The body of one request sent to `key`, parsed. */
export const body = (h: ReturnType<typeof harness>, key: string, n = 0): Record<string, unknown> =>
  JSON.parse(h.keyed(key)[n]!.body!) as Record<string, unknown>;

/** A save whose answer carries the item as the server would return it. */
export const savedItem = (record: Item, more: Partial<Item> = {}): Item => ({ ...record, ...more });

export type { Cat, Item };
