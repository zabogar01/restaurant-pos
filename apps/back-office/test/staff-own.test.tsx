// @vitest-environment jsdom
import { CSRF_HEADER, OwnPasswordRequest, OwnPinRequest } from '@pos/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOGIN, ME, REAUTH, mount, text } from './session-harness.js';
import {
  goIdle, IQBAL, MARKER_CURRENT, MARKER_PASSWORD, MARKER_PIN, U_CREATE, U_OWN_PASSWORD, U_OWN_PIN, aria, bodyOf, clearedNote,
  classificationField, contextOf, currentField, duplicate, errorOf, facts, formNotice, harness, hintOf, nameField, named,
  openStaff, pageStatus, panel, panelName, passwordField, person, pinField, staffAnswer, staffCalls, tap, typeInto,
  unknown, usernameField, warningOf, wrongPassword, ANA, READ,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-06 Staff, part 2 (PHASE1-S8c2): the manager's own password and own PIN (C3 sections 3 and 4,
// as S8b built them, and PRD FR-B3). The current password is the manager's, it is checked and never
// trimmed, and the session this tab holds is not touched by the client: the answer is the user
// view and nothing else. The cooldown a fifth wrong password starts is in staff-cooldown.test.tsx.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.restoreAllMocks();
});

const focused = () => document.activeElement;
const open = async () => {
  h = harness();
  view = await openStaff(h);
  return view.host;
};
const saveButton = (host: HTMLElement) => named(host, 'Save');
const ownPassword = (host: HTMLElement) => tap(named(host, 'Change my password — M. Iqbal'));
const ownPin = (host: HTMLElement) => tap(named(host, 'Change my PIN — M. Iqbal'));
const OWN_WARNING = 'Your other POS and back-office sessions will end on their next action. This back-office session will continue.';

/** Types a current and a new password into the open own-password form. */
function fillPassword(host: HTMLElement, current = MARKER_CURRENT, next = MARKER_PASSWORD) {
  typeInto(currentField(host)!, current);
  typeInto(passwordField(host)!, next);
}
function fillPin(host: HTMLElement, current = MARKER_CURRENT, pin = MARKER_PIN) {
  typeInto(currentField(host)!, current);
  typeInto(pinField(host)!, pin);
}

describe('AC 6. the own forms open with exactly their fields', () => {
  it('Change my password: Current password, then New password, focused on the first, with the own warning', async () => {
    const host = await open();
    ownPassword(host);
    expect(panelName(host)).toBe('Change my password — M. Iqbal');
    expect(panel(host)!.getAttribute('aria-modal')).toBe('false');
    expect(text(contextOf(host))).toBe('M. Iqbal · Manager');
    expect(focused()).toBe(currentField(host));
    for (const find of [nameField, classificationField, usernameField, pinField]) expect(find(host)).toBeNull();
    const fields = [...host.querySelectorAll<HTMLInputElement>('#staff-form input')].map((i) => i.id);
    expect(fields).toEqual(['staff-current-password', 'staff-password']);
    expect(host.querySelector('label[for="staff-current-password"]')!.textContent).toBe('Current password');
    expect(host.querySelector('label[for="staff-password"]')!.textContent).toBe('New password');
    expect(text(host.querySelector('#staff-current-password-help'))).toBe('Enter your current back-office password.');
    expect(currentField(host)!.type).toBe('password');
    expect(currentField(host)!.getAttribute('autocomplete')).toBe('current-password');
    expect(passwordField(host)!.getAttribute('autocomplete')).toBe('new-password');
    expect(text(warningOf(host))).toBe(OWN_WARNING);
    expect(warningOf(host)!.closest('footer')).toBe(saveButton(host).closest('footer'));
    expect(aria(saveButton(host))).toBe(false);
  });

  it('Change my PIN: Current password, then New PIN, with the same warning (PRD FR-B3)', async () => {
    const host = await open();
    ownPin(host);
    expect(panelName(host)).toBe('Change my PIN — M. Iqbal');
    expect(focused()).toBe(currentField(host));
    const fields = [...host.querySelectorAll<HTMLInputElement>('#staff-form input')].map((i) => i.id);
    expect(fields).toEqual(['staff-current-password', 'staff-pin']);
    expect(text(warningOf(host))).toBe(OWN_WARNING);
    expect(pinField(host)!.getAttribute('autocomplete')).toBe('new-password');
  });

  it('offers nothing but these two on the own row, and nothing of another person’s forms', async () => {
    const host = await open();
    ownPassword(host);
    expect(host.querySelector('#staff-classification')).toBeNull();
    expect(host.querySelector('#staff-username')).toBeNull();
    expect(host.querySelector('input[name="confirm"], input[name="confirmPassword"], [data-reveal]')).toBeNull();
  });
});

describe('AC 5. the current password is checked, never trimmed', () => {
  it('refuses an empty one with its sentence, in displayed order, focusing it, and sends nothing', async () => {
    const host = await open();
    ownPassword(host);
    typeInto(passwordField(host)!, 'short');
    tap(saveButton(host));
    expect(h.count(U_OWN_PASSWORD)).toBe(0);
    expect(text(errorOf(host, 'current-password'))).toBe('Enter your current password.');
    expect(currentField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(currentField(host)!.getAttribute('aria-describedby')).toContain('staff-current-password-error');
    expect(text(errorOf(host, 'password'))).toBe('Use 8–128 characters. Spaces count.');
    expect(focused()).toBe(currentField(host));
  });

  it('refuses one over 1024 code points with its sentence, and accepts 1024, astral characters included', async () => {
    const host = await open();
    ownPin(host);
    fillPin(host, '𝒜'.repeat(1025));
    tap(saveButton(host));
    expect(h.count(U_OWN_PIN)).toBe(0);
    expect(text(errorOf(host, 'current-password'))).toBe('Use 1024 characters or fewer.');
    typeInto(currentField(host)!, '𝒜'.repeat(1024));
    h.reply(U_OWN_PIN, staffAnswer(IQBAL));
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_OWN_PIN)).toBe(1);
    expect(bodyOf(h, U_OWN_PIN).currentPassword).toBe('𝒜'.repeat(1024));
  });

  it('sends the current password exactly as typed: leading and trailing spaces are kept', async () => {
    const host = await open();
    ownPassword(host);
    const spaced = `  ${MARKER_CURRENT}  `;
    fillPassword(host, spaced);
    h.reply(U_OWN_PASSWORD, staffAnswer(IQBAL));
    tap(saveButton(host));
    await h.settle();
    expect(bodyOf(h, U_OWN_PASSWORD).currentPassword).toBe(spaced);
  });

  it('a local refusal is not a response: nothing the manager typed is emptied', async () => {
    const host = await open();
    ownPassword(host);
    typeInto(currentField(host)!, MARKER_CURRENT);
    typeInto(passwordField(host)!, 'short');
    tap(saveButton(host));
    expect(currentField(host)!.value).toBe(MARKER_CURRENT);
    expect(passwordField(host)!.value).toBe('short');
  });
});

describe('AC 6. the own changes, the answers', () => {
  it('own password: success sends one { currentPassword, password }, announces that the session continues, closes, focuses Change my password', async () => {
    const host = await open();
    ownPassword(host);
    fillPassword(host);
    h.reply(U_OWN_PASSWORD, staffAnswer(IQBAL));
    tap(saveButton(host));
    expect(text(formNotice(host))).toBe('Saving…Wait for the result. Your draft is kept.');
    await h.settle();
    expect(h.count(U_OWN_PASSWORD)).toBe(1);
    const body = bodyOf(h, U_OWN_PASSWORD);
    expect(body).toEqual({ currentPassword: MARKER_CURRENT, password: MARKER_PASSWORD });
    expect(OwnPasswordRequest.safeParse(body).success).toBe(true);
    expect(text(pageStatus(host))).toBe('M. Iqbal’s password changed. This back-office session continues.');
    expect(pageStatus(host)!.getAttribute('role')).toBe('status');
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Change my password — M. Iqbal'));
    expect(text(facts(host))).toBe('5 active · 2 inactive');
  });

  it('own PIN: success sends one { currentPassword, pin } to own-pin and focuses Change my password', async () => {
    const host = await open();
    ownPin(host);
    fillPin(host);
    h.reply(U_OWN_PIN, staffAnswer(IQBAL));
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_OWN_PIN)).toBe(1);
    expect(h.count(U_OWN_PASSWORD)).toBe(0);
    const body = bodyOf(h, U_OWN_PIN);
    expect(body).toEqual({ currentPassword: MARKER_CURRENT, pin: MARKER_PIN });
    expect(OwnPinRequest.safeParse(body).success).toBe(true);
    expect(text(pageStatus(host))).toBe('M. Iqbal’s PIN changed. This back-office session continues.');
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Change my password — M. Iqbal'));
  });

  it('the session is not touched: no sign-in, no re-authentication, no session read, the same token, and the next command is sent and answered', async () => {
    const host = await open();
    const meBefore = h.count(ME);
    ownPassword(host);
    fillPassword(host);
    h.reply(U_OWN_PASSWORD, staffAnswer(IQBAL));
    tap(saveButton(host));
    await h.settle();
    expect(text(pageStatus(host))).toContain('This back-office session continues.');
    expect(h.count(LOGIN)).toBe(0);
    expect(h.count(REAUTH)).toBe(0);
    expect(h.count(ME)).toBe(meBefore);
    // The next command from this tab simply works, on the token it had.
    const made = person(8, 'Nadia Pratiwi', 'KITCHEN');
    h.reply(U_CREATE, staffAnswer(made));
    tap(named(host, 'Add person'));
    typeInto(nameField(host)!, 'Nadia Pratiwi');
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_CREATE)).toBe(1);
    expect(text(pageStatus(host))).toBe('Nadia Pratiwi added.');
    expect(h.count(LOGIN)).toBe(0);
    expect(h.count(REAUTH)).toBe(0);
    expect(h.keyed(U_CREATE)[0]!.headers[CSRF_HEADER]).toBe(h.keyed(U_OWN_PASSWORD)[0]!.headers[CSRF_HEADER]);
    expect(host.closest('#root')!.getAttribute('data-session')).toBe('signed-in');
  });

  it('INVALID_CREDENTIALS without details is the plain wrong password: on Current password, focused, every credential empty', async () => {
    const host = await open();
    ownPassword(host);
    fillPassword(host);
    h.reply(U_OWN_PASSWORD, wrongPassword());
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_OWN_PASSWORD)).toBe(1);
    expect(text(errorOf(host, 'current-password'))).toBe('Incorrect current password. Try again.');
    expect(currentField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(focused()).toBe(currentField(host));
    expect(currentField(host)!.value).toBe('');
    expect(passwordField(host)!.value).toBe('');
    expect(currentField(host)!.disabled).toBe(false);
    expect(aria(saveButton(host))).toBe(false);
    expect(formNotice(host)).toBeNull();
    expect(host.textContent).not.toContain('cooling down');
    // The manager types again and the form sends one more.
    fillPassword(host);
    h.reply(U_OWN_PASSWORD, staffAnswer(IQBAL));
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_OWN_PASSWORD)).toBe(2);
    expect(text(pageStatus(host))).toBe('M. Iqbal’s password changed. This back-office session continues.');
  });

  it('INVALID_CREDENTIALS without details on own PIN is the plain wrong password too', async () => {
    const host = await open();
    ownPin(host);
    fillPin(host);
    h.reply(U_OWN_PIN, wrongPassword());
    tap(saveButton(host));
    await h.settle();
    expect(text(errorOf(host, 'current-password'))).toBe('Incorrect current password. Try again.');
    expect(focused()).toBe(currentField(host));
    expect(currentField(host)!.value).toBe('');
    expect(pinField(host)!.value).toBe('');
    expect(currentField(host)!.disabled).toBe(false);
    expect(aria(saveButton(host))).toBe(false);
    expect(formNotice(host)).toBeNull();
  });

  it('editing the current password removes its obsolete error', async () => {
    const host = await open();
    ownPassword(host);
    fillPassword(host);
    h.reply(U_OWN_PASSWORD, wrongPassword());
    tap(saveButton(host));
    await h.settle();
    typeInto(currentField(host)!, 'x');
    expect(errorOf(host, 'current-password')).toBeNull();
    expect(currentField(host)!.getAttribute('aria-describedby')).not.toContain('error');
  });

  it('DUPLICATE { pin } on own PIN is on New PIN with its sentence, focused, naming no one', async () => {
    const host = await open();
    ownPin(host);
    fillPin(host);
    h.reply(U_OWN_PIN, duplicate('pin'));
    tap(saveButton(host));
    await h.settle();
    expect(text(errorOf(host, 'pin'))).toBe('That PIN is already in use. Choose a different PIN.');
    expect(errorOf(host, 'current-password')).toBeNull();
    expect(focused()).toBe(pinField(host));
    expect(pinField(host)!.value).toBe('');
    expect(currentField(host)!.value).toBe('');
    expect(text(panel(host))).not.toMatch(/Ana R\.|Ratna Ayu/);
  });

  it('Cancel from Change my PIN returns focus to Change my PIN', async () => {
    const host = await open();
    ownPin(host);
    tap(named(host, 'Cancel'));
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Change my PIN — M. Iqbal'));
  });

  it('a response empties every credential, success included, and the form that stays says so', async () => {
    const host = await open();
    ownPassword(host);
    fillPassword(host);
    h.reply(U_OWN_PASSWORD, wrongPassword());
    tap(saveButton(host));
    await h.settle();
    expect(text(clearedNote(host))).toBe('Enter the credentials again. The name and classification choices are kept.');
  });
});

describe('AC 7. an unknown own change', () => {
  it('own password: rereads once, resends nothing, empties both fields, and says the list cannot resolve it', async () => {
    const host = await open();
    ownPassword(host);
    fillPassword(host);
    h.reply(U_OWN_PASSWORD, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_OWN_PASSWORD)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedM. Iqbal: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again. Your draft is kept; enter credentials again. The list cannot show whether your password changed. For your next change, try the new password you chose as Current password first. If it is refused, try your previous password. Each wrong attempt counts towards your sign-in cooldown.'
    );
    expect(currentField(host)!.value).toBe('');
    expect(passwordField(host)!.value).toBe('');
    expect(panel(host)).not.toBeNull();
    expect(staffCalls(h).filter((c) => c.includes('own-'))).toEqual(['POST /api/back-office/config/users/own-password']);
  });

  it('own PIN: the ordinary unknown body, with no own-password continuation', async () => {
    const host = await open();
    ownPin(host);
    fillPin(host);
    h.reply(U_OWN_PIN, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_OWN_PIN)).toBe(1);
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedM. Iqbal: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again. Your draft is kept; enter credentials again.'
    );
    expect(currentField(host)!.value).toBe('');
    expect(pinField(host)!.value).toBe('');
  });

  it('a later press of Save is the only way to send again', async () => {
    const host = await open();
    ownPassword(host);
    fillPassword(host);
    h.reply(U_OWN_PASSWORD, unknown);
    tap(saveButton(host));
    await h.settle();
    fillPassword(host, MARKER_PASSWORD, MARKER_CURRENT);
    h.reply(U_OWN_PASSWORD, staffAnswer(IQBAL));
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_OWN_PASSWORD)).toBe(2);
    expect(text(pageStatus(host))).toBe('M. Iqbal’s password changed. This back-office session continues.');
  });
});

describe('AC 8. the current password is a credential like the rest', () => {
  const logs = () => [
    vi.spyOn(console, 'log'),
    vi.spyOn(console, 'info'),
    vi.spyOn(console, 'warn'),
    vi.spyOn(console, 'error'),
    vi.spyOn(console, 'debug'),
  ];

  it('is uncontrolled, has no value attribute in any state, and appears in exactly one request body and nowhere else', async () => {
    const spies = logs();
    const host = await open();
    ownPassword(host);
    const attributeFree = () => {
      for (const input of host.querySelectorAll('#staff-form input')) {
        expect(input.hasAttribute('value')).toBe(false);
        expect(input.hasAttribute('defaultvalue')).toBe(false);
      }
    };
    attributeFree();
    fillPassword(host);
    attributeFree();
    expect(host.innerHTML).not.toContain(MARKER_CURRENT);
    h.reply(U_OWN_PASSWORD, wrongPassword());
    tap(saveButton(host));
    await h.settle();
    attributeFree();
    expect(currentField(host)!.value).toBe('');
    expect(host.innerHTML).not.toContain(MARKER_CURRENT);
    expect(host.innerHTML).not.toContain(MARKER_PASSWORD);
    expect(h.calls.filter((c) => (c.body ?? '').includes(MARKER_CURRENT))).toHaveLength(1);
    expect(JSON.stringify({ ...localStorage })).not.toContain(MARKER_CURRENT);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(MARKER_CURRENT);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(MARKER_CURRENT);
    // And after a success the form is gone with its inputs.
    fillPassword(host);
    h.reply(U_OWN_PASSWORD, staffAnswer(IQBAL));
    tap(saveButton(host));
    await h.settle();
    expect(document.body.innerHTML).not.toContain(MARKER_CURRENT);
    expect(h.calls.filter((c) => (c.body ?? '').includes(MARKER_CURRENT))).toHaveLength(2);
  });

  it('is emptied when the command answers, even behind an open departure decision', async () => {
    const host = await open();
    ownPin(host);
    fillPin(host);
    const held = h.hold(U_OWN_PIN);
    tap(saveButton(host));
    // Leaving a save that is still out opens the decision; the answer arrives behind it.
    tap(named(host, 'Cancel'));
    expect(document.querySelector('dialog[open]')).not.toBeNull();
    held.deliver(unknown);
    await h.settle();
    expect(currentField(host)!.value).toBe('');
    expect(pinField(host)!.value).toBe('');
  });

  it('is emptied when the session leaves the frame, and the form that stays says so', async () => {
    const host = await open();
    ownPassword(host);
    fillPassword(host);
    expect(currentField(host)!.value).toBe(MARKER_CURRENT);
    await goIdle(h, host);
    expect(currentField(host)!.value).toBe('');
    expect(passwordField(host)!.value).toBe('');
    expect(clearedNote(host)).not.toBeNull();
  });
});

describe('AC 10. no invented control on the own row', () => {
  it('the own row offers the two own changes and nothing else, in any state of the form', async () => {
    const host = await open();
    ownPassword(host);
    const own = host.querySelector(`tr[data-user="${IQBAL.staffUserId}"]`)!;
    expect([...own.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Change my password — M. Iqbal',
      'Change my PIN — M. Iqbal',
    ]);
    expect(host.querySelector(`[aria-label="Deactivate — ${ANA.name}"]`)).not.toBeNull();
  });
});
