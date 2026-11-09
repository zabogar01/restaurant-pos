import { act } from 'react';
import { Screens } from '../src/Screens.js';
import { expect } from 'vitest';
import {
  ACTIVITY, HEALTH, LOGIN, ME, REAUTH, VIEW, button, field, makeHarness, mount, ok, press, refusal, sessionState, type,
} from './session-harness.js';
import { named, tap, typeInto } from './tables-support.js';

// Shared by the BO-06 client tests: the four users routes the first slice uses, seven people in
// creation order, and the few ways a test reaches a row, the panel, a credential and a request body.

export const READ = 'GET /api/back-office/config/users';
export const U_CREATE = 'POST /api/back-office/config/users/create';
export const U_DEACTIVATE = 'POST /api/back-office/config/users/deactivate';
export const U_REACTIVATE = 'POST /api/back-office/config/users/reactivate';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export type Classification = 'KITCHEN' | 'CASHIER' | 'MANAGER';
export interface Person {
  staffUserId: string;
  name: string;
  classification: Classification;
  isActive: boolean;
  username: string | null;
}

export const person = (
  n: number,
  name: string,
  classification: Classification,
  isActive = true,
  username: string | null = null
): Person => ({ staffUserId: id(n), name, classification, isActive, username });

// Created in this order (the actor first): M. Iqbal, Ana R., S. Halim, Ratna Ayu, D. Putra (a
// former manager), R. Sari (inactive), B. Wibowo (inactive).
export const IQBAL = person(1, 'M. Iqbal', 'MANAGER', true, 'm.iqbal');
export const ANA = person(2, 'Ana R.', 'CASHIER');
export const HALIM = person(3, 'S. Halim', 'KITCHEN');
export const AYU = person(4, 'Ratna Ayu', 'MANAGER', true, 'r.ayu');
export const PUTRA = person(5, 'D. Putra', 'CASHIER', true, 'd.putra');
export const SARI = person(6, 'R. Sari', 'CASHIER', false);
export const WIBOWO = person(7, 'B. Wibowo', 'KITCHEN', false);
export const PEOPLE = [IQBAL, ANA, HALIM, AYU, PUTRA, SARI, WIBOWO];

/** The signed-in manager, whose id is the first person's: the own row is the one that matches it. */
export const SELF = { ...VIEW, staffUserId: IQBAL.staffUserId };
export const OTHER_MANAGER = { ...VIEW, staffUserId: AYU.staffUserId, name: 'Ratna Ayu', username: 'r.ayu', csrfToken: 'tok-2' };

export const staffList = (rows: Person[] = PEOPLE) => ok({ users: rows });
export const staffAnswer = (user: Person) => ok({ user });

/** The refusals of the users routes; `DUPLICATE` carries the field it names, or none. */
export const duplicate = (field?: 'pin' | 'username') =>
  ({ status: 409, body: { error: field === undefined ? { code: 'DUPLICATE' } : { code: 'DUPLICATE', details: { field } } } }) as const;
export const ownAccount = refusal('OWN_ACCOUNT', undefined, 403);
export const userChanged = refusal('USER_CHANGED', undefined, 409);
export const notFound = refusal('NOT_FOUND', undefined, 404);
/** A definite refusal with nothing to place: the general failure. */
export const general = refusal('VALIDATION_FAILED', undefined, 400);
/** A server error: its outcome is not known. */
export const unknown = refusal('INTERNAL', undefined, 500);

/** Typed markers: distinctive, and never derived from one another. */
export const MARKER_PIN = '482913';
export const MARKER_USERNAME = 'marker.user77';
export const MARKER_PASSWORD = 'Zx9-marker-pass';

/** A harness whose health read answers, at the address BO-06 lives at. */
export function harness(path = '/back-office/staff') {
  const h = makeHarness();
  h.reply(HEALTH, ok({ status: 'ok' }));
  window.history.pushState(null, '', path);
  return h;
}

/** Mounts the real screens for a signed-in manager; `first` is the answer to the first users read. */
export async function openStaff(h: ReturnType<typeof harness>, first = staffList()) {
  h.reply(ME, ok(SELF));
  h.reply(READ, first);
  const view = mount(h.store, <Screens />);
  await h.settle();
  return view;
}

/** Like `openStaff`, with the first read held until the test delivers it. */
export async function openStaffHeld(h: ReturnType<typeof harness>) {
  h.reply(ME, ok(SELF));
  h.reply(READ, staffList());
  const held = h.hold(READ);
  const view = mount(h.store, <Screens />);
  await h.settle();
  return { view, held };
}

export { named, tap, typeInto, refusal };

/** The body of the nth request sent to `key`, parsed. */
export const bodyOf = (h: ReturnType<typeof harness>, key: string, n = 0): Record<string, unknown> =>
  JSON.parse(h.keyed(key)[n]!.body!) as Record<string, unknown>;

export const byId = (host: ParentNode, selector: string) => host.querySelector<HTMLElement>(selector);
export const nameField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#staff-name');
export const pinField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#staff-pin');
export const usernameField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#staff-username');
export const passwordField = (host: HTMLElement) => host.querySelector<HTMLInputElement>('#staff-password');
export const classificationField = (host: HTMLElement) => host.querySelector<HTMLSelectElement>('#staff-classification');
export const panel = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="dialog"][aria-modal="false"]');
export const panelName = (host: HTMLElement) => host.querySelector('#editor-title')?.textContent ?? null;
export const pageStatus = (host: HTMLElement) => host.querySelector('#page-status');
export const formNotice = (host: HTMLElement) => host.querySelector('#form-notice');
export const aria = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';
export const rail = (host: HTMLElement) => host.querySelector<HTMLElement>('.bonav')!;
export const facts = (host: HTMLElement) => host.querySelector('#list-facts');
export const rowText = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The names in the order the table draws them (the name only, without its detail lines). */
export const rowNames = (host: HTMLElement) =>
  [...host.querySelectorAll('#staff-rows tr')].map((tr) => tr.querySelector('td')!.firstChild!.textContent);

export const rowOf = (host: HTMLElement, staffUserId: string) =>
  host.querySelector<HTMLElement>(`tr[data-user="${staffUserId}"]`)!;

/** The choice is made on a native select the way a browser reports it. */
export function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/** Opens Add person and takes a cashier's name and PIN, unsaved. */
export function cashierDraft(host: HTMLElement, name = 'Dewi Lestari', pin = MARKER_PIN) {
  tap(named(host, 'Add person'));
  typeInto(nameField(host)!, name);
  choose(classificationField(host)!, 'CASHIER');
  typeInto(pinField(host)!, pin);
}

/** Opens Add person and takes every manager field, unsaved. */
export function managerDraft(host: HTMLElement, name = 'Nadia Pratiwi') {
  tap(named(host, 'Add person'));
  typeInto(nameField(host)!, name);
  choose(classificationField(host)!, 'MANAGER');
  typeInto(pinField(host)!, MARKER_PIN);
  typeInto(usernameField(host)!, MARKER_USERNAME);
  typeInto(passwordField(host)!, MARKER_PASSWORD);
}

/** Every request to the users routes, in order, without the session's own. */
export const staffCalls = (h: ReturnType<typeof harness>) =>
  h.calls.filter((c) => c.url.startsWith('/api/back-office/config/users')).map((c) => `${c.method} ${c.url}`);

/**
 * The partial state: a reactivation of R. Sari is in flight, a revisit of BO-06 reads the list and
 * the read fails, and then the command answers. The answered record is applied to the rows the
 * client knew, and the read still stands failed.
 */
export async function reachPartial(
  h: ReturnType<typeof harness>,
  host: HTMLElement,
  answer = staffAnswer({ ...SARI, isActive: true })
) {
  h.reply(U_REACTIVATE, answer);
  const held = h.hold(U_REACTIVATE);
  tap(named(host, 'Reactivate — R. Sari'));
  h.reply(READ, refusal('INTERNAL', undefined, 500));
  tap(named(rail(host), 'Tables'));
  await h.settle();
  tap(named(rail(host), 'Staff'));
  await h.settle();
  held.deliver(answer);
  await h.settle();
}

// ---- The session around the screen ---------------------------------------------------------

export const PASSWORD = 'correct horse';

/** The session goes idle: M-6 over the inert frame. */
export async function goIdle(h: ReturnType<typeof harness>, host: HTMLElement) {
  h.reply(ACTIVITY, refusal('SESSION_IDLE'));
  press();
  await h.settle();
  expect(sessionState(host)).toBe('idle');
}

/** The same manager continues through M-6. */
export async function resume(h: ReturnType<typeof harness>, host: HTMLElement) {
  h.reply(REAUTH, ok(SELF));
  type(field(document.body, 'Password'), PASSWORD);
  tap(button(document.body, 'Continue'));
  await h.settle();
  expect(sessionState(host)).toBe('signed-in');
}

/** The session ends: BO-01 over the hidden working area. */
export async function endSession(h: ReturnType<typeof harness>, host: HTMLElement) {
  h.reply(ACTIVITY, refusal('UNAUTHENTICATED'));
  press();
  await h.settle();
  expect(sessionState(host)).toBe('signed-out');
}

/** A sign-in at BO-01. */
export async function signInAgain(h: ReturnType<typeof harness>, host: HTMLElement, reply = ok(SELF), username = 'm.iqbal') {
  h.reply(LOGIN, reply);
  type(field(host, 'Username'), username);
  type(field(host, 'Password'), PASSWORD);
  tap(button(host, 'Sign in'));
  await h.settle();
}
