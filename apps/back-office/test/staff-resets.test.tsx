// @vitest-environment jsdom
import { SetPasswordRequest, SetPinRequest } from '@pos/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { mount, text } from './session-harness.js';
import {
  ANA, AYU, HALIM, IQBAL, MARKER_PASSWORD, MARKER_PIN, PUTRA, SARI, WIBOWO, U_OWN_PASSWORD, U_SET_PASSWORD, U_SET_PIN, aria, bodyOf, classificationField,
  contextOf, currentField, duplicate, errorOf, facts, formNotice, harness, hintOf, nameField, named, openStaff, pageStatus,
  panel, panelName, passwordField, pinField, rowOf, staffAnswer, staffCalls, tap, typeInto, usernameField, warningOf,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-06 Staff, part 2 (PHASE1-S8c2): the reset of another person's PIN, and of another manager's
// password (ruling 6). Each form asks for exactly one new secret, names the person, and carries its
// warning beside Save. No confirmation step, and no current password.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const focused = () => document.activeElement;
const open = async () => {
  h = harness();
  view = await openStaff(h);
  return view.host;
};
const saveButton = (host: HTMLElement) => named(host, 'Save');

describe('AC 3. the warning of each reset, by the subject’s current classification', () => {
  it.each([
    ['Reset PIN', ANA, 'Ana R.’s POS sessions will end on their next action. They must sign in again.'],
    ['Reset PIN', PUTRA, 'D. Putra’s POS sessions will end on their next action. They must sign in again.'],
    ['Reset PIN', AYU, 'Ratna Ayu’s POS and back-office sessions will end on their next action. They must sign in again.'],
    ['Reset password', AYU, 'Ratna Ayu’s POS and back-office sessions will end on their next action. They must sign in again.'],
  ] as const)('%s — %j', async (action, who, sentence) => {
    const host = await open();
    tap(named(host, `${action} — ${who.name}`));
    const warning = warningOf(host)!;
    expect(text(warning)).toBe(sentence);
    expect(warning.closest('footer')).toBe(saveButton(host).closest('footer'));
    expect(saveButton(host).getAttribute('aria-describedby')).toContain('session-warning');
    // In view while the form is open, and not a second step: no dialog is raised.
    expect(document.querySelector('dialog[open]')).toBeNull();
  });
});

describe('AC 4. Reset PIN', () => {
  it('opens named for the person with New PIN only, focused, and the rest of the form as DESIGN-023 draws it', async () => {
    const host = await open();
    tap(named(host, 'Reset PIN — Ana R.'));
    expect(panelName(host)).toBe('Reset PIN — Ana R.');
    expect(panel(host)!.getAttribute('aria-modal')).toBe('false');
    expect(text(contextOf(host))).toBe('Ana R. · Cashier');
    expect(focused()).toBe(pinField(host));
    for (const find of [nameField, classificationField, usernameField, passwordField, currentField]) expect(find(host)).toBeNull();
    expect(host.querySelector('label[for="staff-pin"]')!.textContent).toBe('New PIN');
    expect(pinField(host)!.type).toBe('password');
    expect(pinField(host)!.getAttribute('autocomplete')).toBe('new-password');
    expect(text(hintOf(host))).toBe('Nothing is sent until you save.');
    expect(aria(saveButton(host))).toBe(false);
  });

  it('a manager’s PIN reset is headed and described in the manager’s terms', async () => {
    const host = await open();
    tap(named(host, 'Reset PIN — Ratna Ayu'));
    expect(text(contextOf(host))).toBe('Ratna Ayu · Manager');
  });

  it('sends one { staffUserId, pin }, announces, closes, updates nothing else and focuses that row’s Change role', async () => {
    const host = await open();
    tap(named(host, 'Reset PIN — Ana R.'));
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_SET_PIN, staffAnswer(ANA));
    tap(saveButton(host));
    expect(text(formNotice(host))).toBe('Saving…Wait for the result. Your draft is kept.');
    await h.settle();
    expect(h.count(U_SET_PIN)).toBe(1);
    const body = bodyOf(h, U_SET_PIN);
    expect(body).toEqual({ staffUserId: ANA.staffUserId, pin: MARKER_PIN });
    expect(SetPinRequest.safeParse(body).success).toBe(true);
    expect(text(pageStatus(host))).toBe('Ana R.’s PIN changed.');
    expect(pageStatus(host)!.getAttribute('role')).toBe('status');
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Change role — Ana R.'));
    expect(text(facts(host))).toBe('5 active · 2 inactive');
    // Nothing is sent to the other commands.
    expect(staffCalls(h)).toEqual(['GET /api/back-office/config/users', 'POST /api/back-office/config/users/set-pin']);
  });

  it('refuses a short PIN with its sentence, focuses it, and sends nothing', async () => {
    const host = await open();
    tap(named(host, 'Reset PIN — Ana R.'));
    typeInto(pinField(host)!, '12345');
    tap(saveButton(host));
    expect(h.count(U_SET_PIN)).toBe(0);
    expect(text(errorOf(host, 'pin'))).toBe('Enter exactly six digits, 0–9.');
    expect(pinField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(focused()).toBe(pinField(host));
  });

  it.each([ANA, AYU])('DUPLICATE { pin } is on New PIN, with its sentence, naming no one, the field empty and focused: %j', async (who) => {
    const host = await open();
    tap(named(host, `Reset PIN — ${who.name}`));
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_SET_PIN, duplicate('pin'));
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_SET_PIN)).toBe(1);
    expect(text(errorOf(host, 'pin'))).toBe('That PIN is already in use. Choose a different PIN.');
    // The form names its own subject and no one else: no holder of the PIN is named.
    for (const other of [ANA, AYU, HALIM, PUTRA, SARI, WIBOWO, IQBAL].filter((p) => p !== who)) {
      expect(text(panel(host))).not.toContain(other.name);
    }
    expect(pinField(host)!.value).toBe('');
    expect(focused()).toBe(pinField(host));
    expect(h.count('GET /api/back-office/config/users')).toBe(1);
  });

  it('Cancel returns focus to that row’s Reset PIN', async () => {
    const host = await open();
    tap(named(host, 'Reset PIN — Ana R.'));
    tap(named(host, 'Cancel'));
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Reset PIN — Ana R.'));
  });

  it('a late failure of the contract check never happens for a valid PIN: the body is the variant’s exactly', async () => {
    const host = await open();
    tap(named(host, 'Reset PIN — Ana R.'));
    typeInto(pinField(host)!, '000000');
    h.reply(U_SET_PIN, staffAnswer(ANA));
    tap(saveButton(host));
    await h.settle();
    expect(Object.keys(bodyOf(h, U_SET_PIN)).sort()).toEqual(['pin', 'staffUserId']);
  });
});

describe('AC 4. Reset password', () => {
  it('opens named for the manager with New password only, focused', async () => {
    const host = await open();
    tap(named(host, 'Reset password — Ratna Ayu'));
    expect(panelName(host)).toBe('Reset password — Ratna Ayu');
    expect(text(contextOf(host))).toBe('Ratna Ayu · Manager');
    expect(focused()).toBe(passwordField(host));
    for (const find of [nameField, classificationField, usernameField, pinField, currentField]) expect(find(host)).toBeNull();
    expect(host.querySelector('label[for="staff-password"]')!.textContent).toBe('New password');
    expect(passwordField(host)!.type).toBe('password');
    expect(passwordField(host)!.getAttribute('autocomplete')).toBe('new-password');
  });

  it('sends one { staffUserId, password } to set-password, and never to own-password', async () => {
    const host = await open();
    tap(named(host, 'Reset password — Ratna Ayu'));
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    h.reply(U_SET_PASSWORD, staffAnswer(AYU));
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_SET_PASSWORD)).toBe(1);
    expect(h.count(U_OWN_PASSWORD)).toBe(0);
    const body = bodyOf(h, U_SET_PASSWORD);
    expect(body).toEqual({ staffUserId: AYU.staffUserId, password: MARKER_PASSWORD });
    expect(SetPasswordRequest.safeParse(body).success).toBe(true);
    expect(text(pageStatus(host))).toBe('Ratna Ayu’s password changed.');
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Change role — Ratna Ayu'));
  });

  it('refuses a seven-character password with its sentence and sends nothing', async () => {
    const host = await open();
    tap(named(host, 'Reset password — Ratna Ayu'));
    typeInto(passwordField(host)!, '1234567');
    tap(saveButton(host));
    expect(h.count(U_SET_PASSWORD)).toBe(0);
    expect(text(errorOf(host, 'password'))).toBe('Use 8–128 characters. Spaces count.');
    expect(focused()).toBe(passwordField(host));
  });

  it('a former manager’s row offers no password reset, and a kitchen row offers neither reset', async () => {
    const host = await open();
    expect(host.querySelector('[aria-label="Reset password — D. Putra"]')).toBeNull();
    expect(host.querySelector('[aria-label="Reset PIN — S. Halim"]')).toBeNull();
    expect(host.querySelector('[aria-label="Reset password — S. Halim"]')).toBeNull();
    expect(host.querySelector('[aria-label="Reset password — Ana R."]')).toBeNull();
    expect(rowOf(host, AYU.staffUserId)).not.toBeNull();
  });
});
