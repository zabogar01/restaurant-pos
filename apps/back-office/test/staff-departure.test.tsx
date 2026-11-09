// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DISCARD_TITLE } from '../src/copy.js';
import { pressEscape } from './dialog-shim.js';
import { mount, ok, sessionState, text } from './session-harness.js';
import { dialogNamed } from './tables-support.js';
import {
  ANA, MARKER_PIN, OTHER_MANAGER, READ, SARI, U_CREATE, U_DEACTIVATE, U_REACTIVATE, byId, cashierDraft, choose,
  classificationField, duplicate, endSession, formNotice, goIdle, harness, nameField, named, openStaff, pageStatus, panel,
  person, pinField, rail, resume, rowNames, signInAgain, staffAnswer, staffList, tap, typeInto, unknown,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-06 against the departure decision, M-6 and BO-01 (PHASE1-S8c1 ruling 14): the stay-or-discard
// decision from every way out, the modal over the panel and the confirmation, a draft held at
// BO-01 and returned to the same manager only, and a result that arrives while the session is
// away. jsdom has no top layer and no inertness, so what only a browser shows is
// e2e/tests/staff.spec.ts.

let h: ReturnType<typeof harness>;
let view: Awaited<ReturnType<typeof openStaff>> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const focused = () => document.activeElement;
const open = async (path?: string) => {
  h = harness(path);
  view = await openStaff(h);
  return view.host;
};

const decision = () => dialogNamed('Discard unsaved changes?');
const m6 = () => dialogNamed('Your session timed out');
const confirmation = (name = 'Ana R.') => dialogNamed(`Deactivate ${name}?`);
const cancel = () => tap(document.querySelector<HTMLElement>('#cancel-staff')!);
const MADE = person(8, 'Dewi Lestari', 'CASHIER');

describe('AC 13. the decision before a draft is left', () => {
  it('Cancel with a dirty form shows the decision; Stay returns focus to Name with the draft', async () => {
    const host = await open();
    cashierDraft(host);
    cancel();
    expect(text(decision()!.querySelector('#departure-copy'))).toBe(
      'Your edits have not been saved. Stay to keep editing, or discard them before leaving.'
    );
    expect(focused()).toBe(document.querySelector('#departure-stay'));
    tap(named(decision()!, 'Stay'));
    expect(decision()).toBeNull();
    expect(nameField(host)!.value).toBe('Dewi Lestari');
    expect(focused()).toBe(nameField(host));
  });

  it('a form is dirty by its classification alone, or by a credential typed with no name', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'CASHIER');
    cancel();
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Discard'));
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'KITCHEN');
    cancel();
    expect(decision()).toBeNull();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'CASHIER');
    choose(classificationField(host)!, 'KITCHEN');
    cancel();
    // Back at the choice it opened with, with nothing typed: clean.
    expect(decision()).toBeNull();
  });

  it('Discard closes the form and returns focus to Add person', async () => {
    const host = await open();
    cashierDraft(host);
    cancel();
    tap(named(decision()!, 'Discard'));
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Add person'));
    expect(h.count(U_CREATE)).toBe(0);
  });

  it('a clean form closes on Cancel and on Escape with no decision', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    cancel();
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Add person'));
    tap(named(host, 'Add person'));
    pressEscape(nameField(host)!);
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
  });

  it('Escape with a dirty form shows the decision', async () => {
    const host = await open();
    cashierDraft(host);
    const escape = pressEscape(nameField(host)!);
    expect(escape.keydown.defaultPrevented).toBe(true);
    expect(decision()).not.toBeNull();
    expect(nameField(host)!.value).toBe('Dewi Lestari');
  });

  it('the rail entry shows the decision; Stay keeps the draft; Discard follows to Tables', async () => {
    const host = await open();
    cashierDraft(host);
    tap(named(rail(host), 'Tables'));
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(window.location.pathname).toBe('/back-office/staff');
    expect(nameField(host)!.value).toBe('Dewi Lestari');
    tap(named(rail(host), 'Tables'));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/tables');
  });

  it('browser Back with a dirty form restores the path and shows the decision', async () => {
    const host = await open('/back-office/');
    tap(named(rail(host), 'Staff'));
    await h.settle();
    cashierDraft(host);
    window.history.pushState(null, '', '/back-office/');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(window.location.pathname).toBe('/back-office/staff');
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(nameField(host)!.value).toBe('Dewi Lestari');
  });

  it('the top bar’s Log out with a dirty form opens the built confirmation; Keep this draft returns to Name', async () => {
    const host = await open();
    cashierDraft(host);
    tap(named(host, 'Log out'));
    await h.settle();
    expect(dialogNamed(DISCARD_TITLE)).not.toBeNull();
    tap(named(dialogNamed(DISCARD_TITLE)!, 'Keep this draft'));
    expect(nameField(host)!.value).toBe('Dewi Lestari');
    expect(focused()).toBe(nameField(host));
  });

  it('a pending save requires the decision even with a clean-looking draft, with the pending sentence, and Stay focuses the Saving notice', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    typeInto(nameField(host)!, 'Nadia');
    h.hold(U_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    cancel();
    expect(text(decision()!.querySelector('#departure-copy'))).toBe(
      'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.'
    );
    tap(named(decision()!, 'Stay'));
    expect(focused()).toBe(formNotice(host));
  });

  it('an unknown outcome requires the decision with the same sentence, whatever the draft holds', async () => {
    const host = await open();
    h.reply(U_CREATE, unknown);
    tap(named(host, 'Add person'));
    typeInto(nameField(host)!, 'Nadia');
    tap(named(host, 'Save'));
    await h.settle();
    typeInto(nameField(host)!, '');
    cancel();
    expect(text(decision()!.querySelector('#departure-copy'))).toContain('The save may or may not have succeeded.');
  });

  it('a form blocked by a form-level refusal leaves by Return to staff list with no decision', async () => {
    const host = await open();
    h.reply(U_REACTIVATE, duplicate('pin'));
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_REACTIVATE, { status: 403, body: { error: { code: 'OWN_ACCOUNT' } } });
    tap(named(host, 'Reactivate with new PIN'));
    await h.settle();
    tap(named(host, 'Return to staff list'));
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Reactivate — R. Sari'));
  });
});

describe('AC 13. M-6 over the panel and the confirmation', () => {
  it('under M-6 the panel stays visible and inert; resuming gives the first field back, holding the name and the choice, and sends nothing', async () => {
    const host = await open();
    cashierDraft(host);
    await goIdle(h, host);
    expect(panel(host)).not.toBeNull();
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(true);
    expect(m6()).not.toBeNull();
    await resume(h, host);
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(false);
    expect(nameField(host)!.value).toBe('Dewi Lestari');
    expect(classificationField(host)!.value).toBe('CASHIER');
    expect(pinField(host)!.value).toBe('');
    expect(focused()).toBe(nameField(host));
    expect(h.count(U_CREATE)).toBe(0);
  });

  it('M-6 over the deactivation confirmation leaves it open and inert; resuming reopens it on Keep active, and nothing is sent', async () => {
    const host = await open();
    tap(named(host, 'Deactivate — Ana R.'));
    expect(confirmation()).not.toBeNull();
    await goIdle(h, host);
    expect(confirmation()).not.toBeNull();
    await resume(h, host);
    expect(confirmation()).not.toBeNull();
    expect(h.count(U_DEACTIVATE)).toBe(0);
  });

  it('SESSION_IDLE on a save opens M-6 with the draft kept, and nothing is resent', async () => {
    const host = await open();
    cashierDraft(host);
    h.reply(U_CREATE, { status: 401, body: { error: { code: 'SESSION_IDLE' } } });
    tap(named(host, 'Save'));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    expect(h.count(U_CREATE)).toBe(1);
    await resume(h, host);
    expect(h.count(U_CREATE)).toBe(1);
    expect(text(formNotice(host))).toBe('Nothing was savedEnter credentials again, then press Save.');
    expect(nameField(host)!.value).toBe('Dewi Lestari');
    expect(pinField(host)!.value).toBe('');
    expect(focused()).toBe(nameField(host));
  });

  it('a session refusal of a state command says it was not changed once the same manager resumes', async () => {
    const host = await open();
    h.reply(U_REACTIVATE, { status: 401, body: { error: { code: 'SESSION_IDLE' } } });
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    await resume(h, host);
    expect(text(pageStatus(host))).toBe('R. Sari was not changed. Use its row action to try again.');
    expect(h.count(U_REACTIVATE)).toBe(1);
    expect(named(host, 'Reactivate — R. Sari').hasAttribute('aria-disabled')).toBe(false);
  });

  it('a command answered while M-6 is up is held and presented once, with its focus, when the same manager returns', async () => {
    const host = await open();
    cashierDraft(host);
    const held = h.hold(U_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(h, host);
    held.deliver(staffAnswer(MADE));
    await h.settle();
    // Behind M-6 nothing is announced or changed.
    expect(pageStatus(host)).toBeNull();
    expect(panel(host)).not.toBeNull();
    expect(rowNames(host)).not.toContain('Dewi Lestari');
    await resume(h, host);
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Dewi Lestari added.');
    expect(rowNames(host)).toContain('Dewi Lestari');
    expect(focused()).toBe(named(host, 'Deactivate — Dewi Lestari'));
    expect(h.count(U_CREATE)).toBe(1);
  });

  it('an unknown outcome whose reread is out when M-6 opens is presented once on return; nothing is read or sent again', async () => {
    const host = await open();
    cashierDraft(host);
    h.reply(U_CREATE, unknown);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(h, host);
    reread.deliver(staffList());
    await h.settle();
    expect(text(formNotice(host))).toContain('Saving…');
    await resume(h, host);
    expect(text(formNotice(host))).toContain('Outcome not confirmed');
    expect(text(formNotice(host))).toContain('The list has been refreshed.');
    expect(h.count(U_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });

  it('a result is not presented while signed out: the M-6 test’s twin at BO-01 holds it until the same manager is back', async () => {
    const host = await open();
    cashierDraft(host);
    const held = h.hold(U_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    await endSession(h, host);
    held.deliver(staffAnswer(MADE));
    await h.settle();
    expect(pageStatus(host)).toBeNull();
    await signInAgain(h, host);
    expect(text(pageStatus(host))).toBe('Dewi Lestari added.');
    expect(h.count(U_CREATE)).toBe(1);
  });

  it('the departure decision opening during the reread holds the result; Stay presents it once', async () => {
    const host = await open();
    cashierDraft(host);
    h.reply(U_CREATE, unknown);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    cancel();
    expect(decision()).not.toBeNull();
    reread.deliver(staffList());
    await h.settle();
    expect(text(formNotice(host))).toContain('Saving…');
    tap(named(decision()!, 'Stay'));
    expect(text(formNotice(host))).toContain('Outcome not confirmed');
    expect(h.count(READ)).toBe(2);
  });
});

describe('AC 13. BO-01', () => {
  it('hides the working area with the draft held, and the same manager gets name and classification back, with empty credentials and a notice', async () => {
    const host = await open();
    cashierDraft(host);
    await endSession(h, host);
    expect(host.querySelector('.bocontent')!.hasAttribute('hidden')).toBe(true);
    await signInAgain(h, host);
    expect(nameField(host)!.value).toBe('Dewi Lestari');
    expect(classificationField(host)!.value).toBe('CASHIER');
    expect(pinField(host)!.value).toBe('');
    expect(text(byId(host, '#credentials-cleared'))).toContain('Enter the credentials again.');
    expect(focused()).toBe(nameField(host));
  });

  it('a held deactivation confirmation is closed at BO-01 and reopens on Keep active for the same manager', async () => {
    const host = await open();
    tap(named(host, 'Deactivate — Ana R.'));
    await endSession(h, host);
    expect(confirmation()).toBeNull();
    await signInAgain(h, host);
    expect(confirmation()).not.toBeNull();
    expect(focused()).toBe(document.querySelector('#keep-active'));
    expect(h.count(U_DEACTIVATE)).toBe(0);
  });

  it('a different manager’s sign-in destroys it: a clean screen, no draft, no notice and no held result', async () => {
    const host = await open();
    cashierDraft(host);
    const held = h.hold(U_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    await endSession(h, host);
    held.deliver(staffAnswer(MADE));
    await h.settle();
    h.reply(READ, staffList([person(4, 'Ratna Ayu', 'MANAGER', true, 'r.ayu'), ANA, SARI]));
    await signInAgain(h, host, ok(OTHER_MANAGER), 'r.ayu');
    expect(panel(host)).toBeNull();
    expect(pageStatus(host)).toBeNull();
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(rowNames(host)).toEqual(['Ratna Ayu', 'Ana R.', 'R. Sari']);
    expect(rowNames(host)).not.toContain('Dewi Lestari');
    expect(h.count(U_CREATE)).toBe(1);
  });
});
