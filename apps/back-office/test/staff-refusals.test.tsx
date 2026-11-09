// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, text } from './session-harness.js';
import {
  ANA, MARKER_PASSWORD, MARKER_PIN, MARKER_USERNAME, READ, U_CHANGE_ROLE, U_SET_PASSWORD, U_SET_PIN, aria, choose,
  classificationField, contextOf, formNotice, harness, hintOf, named, notFound, openStaff, ownAccount, panel, passwordField,
  pinField, staffList, tap, typeInto, unknown, userChanged, usernameField, PEOPLE,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-06 Staff, part 2 (PHASE1-S8c2 rulings 9 to 11): the form-level refusals and the unknown
// outcomes of a move and of the two resets. A refusal that names a person names the subject; a
// reread never commits anything, and an unknown outcome is never presented as this save's.

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

/** Ana R. to Kitchen: a move that needs no credential, ready to save. */
function moveAna(host: HTMLElement) {
  tap(named(host, 'Change role — Ana R.'));
  choose(classificationField(host)!, 'KITCHEN');
}
function resetPinOfAna(host: HTMLElement) {
  tap(named(host, 'Reset PIN — Ana R.'));
  typeInto(pinField(host)!, MARKER_PIN);
}
function resetPasswordOfAyu(host: HTMLElement) {
  tap(named(host, 'Reset password — Ratna Ayu'));
  typeInto(passwordField(host)!, MARKER_PASSWORD);
}

const forms = [
  ['a move', moveAna, U_CHANGE_ROLE, 'Ana R.'],
  ['a PIN reset', resetPinOfAna, U_SET_PIN, 'Ana R.'],
  ['a password reset', resetPasswordOfAyu, U_SET_PASSWORD, 'Ratna Ayu'],
] as const;

const CHANGED_READ =
  'Nothing was saved. The staff list has been refreshed. Your choices are kept and credentials are empty. Return to the staff list and choose an action on the current person.';
const CHANGED_UNREAD =
  'Nothing was saved. The staff list could not be refreshed. Try again reads the list only. Your choices are kept and credentials are empty. Return to the staff list and choose an action on the current person.';
const GONE_READ = 'Nothing was saved. The staff list has been refreshed. Return to the staff list to choose another person.';
const GONE_UNREAD = 'Nothing was saved. The staff list could not be refreshed. Return to the staff list to choose another person.';

describe('AC 7. USER_CHANGED and NOT_FOUND on a move and on each reset', () => {
  it.each(forms)('USER_CHANGED on %s rereads once and blocks the form, naming the person; read succeeded', async (_form, fill, route, name) => {
    const host = await open();
    fill(host);
    h.reply(route, userChanged);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(`${name} changed while you were editing${CHANGED_READ}`);
    expect(formNotice(host)!.getAttribute('role')).toBe('alert');
    expect(focused()).toBe(formNotice(host));
    expect(aria(saveButton(host))).toBe(true);
    expect(text(hintOf(host))).toBe('Return to the staff list and choose an action on the current person.');
    expect(h.count(READ)).toBe(2);
    expect(h.count(route)).toBe(1);
    for (const field of [pinField(host), passwordField(host), usernameField(host)]) if (field !== null) expect(field.value).toBe('');
    // Save off sends nothing; Return to staff list closes the form.
    tap(saveButton(host));
    expect(h.count(route)).toBe(1);
    tap(named(host, 'Return to staff list'));
    expect(panel(host)).toBeNull();
  });

  it.each(forms)('NOT_FOUND on %s rereads once and blocks the form; read succeeded', async (_form, fill, route, name) => {
    const host = await open();
    fill(host);
    h.reply(route, notFound);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(`${name} could not be found${GONE_READ}`);
    expect(focused()).toBe(formNotice(host));
    expect(aria(saveButton(host))).toBe(true);
    expect(h.count(READ)).toBe(2);
  });

  it.each(forms)('USER_CHANGED on %s, read failed, says so, and Try again reads only', async (_form, fill, route, name) => {
    const host = await open();
    fill(host);
    h.reply(route, userChanged);
    h.reply(READ, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(`${name} changed while you were editing${CHANGED_UNREAD}`);
    h.reply(READ, staffList());
    tap(named(host, 'Try again'));
    await h.settle();
    expect(text(formNotice(host))).toBe(`${name} changed while you were editing${CHANGED_READ}`);
    expect(focused()).toBe(formNotice(host));
    expect(h.count(route)).toBe(1);
  });

  it.each(forms)('NOT_FOUND on %s, read failed, says so', async (_form, fill, route, name) => {
    const host = await open();
    fill(host);
    h.reply(route, notFound);
    h.reply(READ, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(`${name} could not be found${GONE_UNREAD}`);
    expect(aria(saveButton(host))).toBe(true);
  });
});

describe('AC 7. OWN_ACCOUNT, reachable only by a crafted request', () => {
  it.each(forms)('on %s: a focused alert, Save off, Return to staff list, and no reread', async (_form, fill, route) => {
    const host = await open();
    fill(host);
    h.reply(route, ownAccount);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'This action cannot change your own accountUse Change my password or Change my PIN on your own row. You cannot deactivate yourself or change your own role.'
    );
    expect(formNotice(host)!.getAttribute('role')).toBe('alert');
    expect(focused()).toBe(formNotice(host));
    expect(aria(saveButton(host))).toBe(true);
    expect(text(hintOf(host))).toBe('Return to the staff list and choose an action on the current person.');
    expect(h.count(READ)).toBe(1);
    tap(named(host, 'Return to staff list'));
    expect(panel(host)).toBeNull();
  });
});

describe('AC 7. an unknown move', () => {
  const UNKNOWN_READ =
    'Outcome not confirmedAna R.: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again. Your draft is kept; enter credentials again.';
  const UNKNOWN_UNREAD =
    'Outcome not confirmedAna R.: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again. Your draft is kept; enter credentials again.';
  const BLOCKED_BODY =
    'Outcome not confirmedAna R.: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again. Return to the staff list and choose an action on the current person.';
  const asManager = { ...ANA, classification: 'MANAGER' as const, username: MARKER_USERNAME };
  const withAna = (replacement: typeof ANA | typeof asManager) => PEOPLE.map((p) => (p.staffUserId === ANA.staffUserId ? replacement : p));

  it('whose reread shows no change keeps the ordinary unknown form, nothing resent, the choice kept', async () => {
    const host = await open();
    moveAna(host);
    h.reply(U_CHANGE_ROLE, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(formNotice(host))).toBe(UNKNOWN_READ);
    expect(text(contextOf(host))).toBe('Current classification: Cashier. The PIN is removed.');
    expect(classificationField(host)!.value).toBe('KITCHEN');
    expect(focused()).toBe(classificationField(host));
    expect(aria(saveButton(host))).toBe(false);
    // Leaving still asks: the outcome is not known.
    tap(named(host, 'Cancel'));
    expect(document.querySelector('dialog[open]')).not.toBeNull();
  });

  it('on a promotion keeps the draft, empties the username and the password, and never resends', async () => {
    const host = await open();
    tap(named(host, 'Change role — Ana R.'));
    choose(classificationField(host)!, 'MANAGER');
    typeInto(usernameField(host)!, MARKER_USERNAME);
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    h.reply(U_CHANGE_ROLE, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
    expect(text(formNotice(host))).toBe(UNKNOWN_READ);
    expect(classificationField(host)!.value).toBe('MANAGER');
    expect(usernameField(host)!.value).toBe('');
    expect(passwordField(host)!.value).toBe('');
    expect(aria(saveButton(host))).toBe(false);
  });

  it('whose reread shows a change names the opening and the current classification and blocks the form (unknown-move-applied)', async () => {
    const host = await open();
    moveAna(host);
    h.reply(U_CHANGE_ROLE, unknown);
    h.reply(READ, staffList(withAna(asManager)));
    tap(saveButton(host));
    await h.settle();
    expect(text(contextOf(host))).toBe(
      'When you opened this form, Ana R.’s classification was Cashier. The staff list now shows Manager. This may be your change; it is not confirmed.'
    );
    expect(text(formNotice(host))).toBe(BLOCKED_BODY);
    expect(text(host)).not.toMatch(/changed to|was applied|has been applied|saved\./);
    expect(focused()).toBe(formNotice(host));
    expect(aria(saveButton(host))).toBe(true);
    expect(text(hintOf(host))).toBe('Return to the staff list and choose an action on the current person.');
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
    tap(saveButton(host));
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
    expect(classificationField(host)!.value).toBe('KITCHEN');
    tap(named(host, 'Return to staff list'));
    // The outcome is unknown, so leaving asks.
    expect(document.querySelector('dialog[open]')).not.toBeNull();
  });

  it('says ", inactive" when the reread shows the person inactive', async () => {
    const host = await open();
    moveAna(host);
    h.reply(U_CHANGE_ROLE, unknown);
    h.reply(READ, staffList(withAna({ ...ANA, isActive: false })));
    tap(saveButton(host));
    await h.settle();
    expect(text(contextOf(host))).toBe(
      'When you opened this form, Ana R.’s classification was Cashier. The staff list now shows Cashier, inactive. This may be your change; it is not confirmed.'
    );
    expect(aria(saveButton(host))).toBe(true);
  });

  it('a reread that failed keeps the unknown form with its own body, and Try again that shows no change keeps it', async () => {
    const host = await open();
    moveAna(host);
    h.reply(U_CHANGE_ROLE, unknown);
    h.reply(READ, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(UNKNOWN_UNREAD);
    h.reply(READ, staffList());
    tap(named(host, 'Try again'));
    await h.settle();
    expect(text(formNotice(host))).toBe(UNKNOWN_READ);
    expect(aria(saveButton(host))).toBe(false);
    expect(focused()).toBe(classificationField(host));
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
  });

  it('a later successful Try again that shows a change applies the same comparison', async () => {
    const host = await open();
    moveAna(host);
    h.reply(U_CHANGE_ROLE, unknown);
    h.reply(READ, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(UNKNOWN_UNREAD);
    h.reply(READ, staffList(withAna(asManager)));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(text(contextOf(host))).toBe(
      'When you opened this form, Ana R.’s classification was Cashier. The staff list now shows Manager. This may be your change; it is not confirmed.'
    );
    expect(text(formNotice(host))).toBe(BLOCKED_BODY);
    expect(aria(saveButton(host))).toBe(true);
    expect(focused()).toBe(formNotice(host));
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
  });
});

describe('AC 7. an unknown reset never claims that sessions ended', () => {
  const END = 'The list cannot confirm the reset or whether this person’s sessions ended.';

  it.each([
    ['a PIN reset', resetPinOfAna, U_SET_PIN, 'Ana R.'],
    ['a password reset', resetPasswordOfAyu, U_SET_PASSWORD, 'Ratna Ayu'],
  ] as const)('%s: rereads once, resends nothing, empties the credential and says what the list cannot confirm', async (_form, fill, route, name) => {
    const host = await open();
    fill(host);
    h.reply(route, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(h.count(route)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(formNotice(host))).toBe(
      `Outcome not confirmed${name}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again. Your draft is kept; enter credentials again. ${END}`
    );
    expect(text(formNotice(host))).not.toMatch(/ended on|have ended|were ended/);
    for (const field of [pinField(host), passwordField(host)]) if (field !== null) expect(field.value).toBe('');
    expect(aria(saveButton(host))).toBe(false);
  });

  it('with the reread failed it says that too, and the form stays open', async () => {
    const host = await open();
    resetPinOfAna(host);
    h.reply(U_SET_PIN, unknown);
    h.reply(READ, unknown);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      `Outcome not confirmedAna R.: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again. Your draft is kept; enter credentials again. ${END}`
    );
    expect(panel(host)).not.toBeNull();
  });
});

describe('AC 9. a definite general failure of a move or a reset', () => {
  it.each(forms)('on %s keeps the form, empties the credentials and focuses the first field', async (_form, fill, route) => {
    const host = await open();
    fill(host);
    h.reply(route, { status: 400, body: { error: { code: 'VALIDATION_FAILED' } } });
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'Something went wrongNothing was saved. Your draft is kept. Enter credentials again, then press Save to try again.'
    );
    expect(h.count(READ)).toBe(1);
    expect(panel(host)).not.toBeNull();
    for (const field of [pinField(host), passwordField(host)]) if (field !== null) expect(field.value).toBe('');
  });
});
