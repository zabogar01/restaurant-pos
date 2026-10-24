// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DISCARD_TITLE } from '../src/copy.js';
import { pressEscape } from './dialog-shim.js';
import {
  ACTIVITY, LOGIN, ME, REAUTH, VIEW,
  button, field, ok, press, refusal, sessionState, text, type,
} from './session-harness.js';
import {
  BANK, GOPAY2, METHODS, M_CREATE, M_DEACTIVATE, M_UPDATE, QRIS, READ, SAVE, V4,
  answer, box, fill, form, makeMethod, methodAnswer, methodBody, methodNameField, methodNotice, methodPanel, methodRowNames,
  methodsStatus, methodsView, openSettings, settingsHarness, typeIn, withVersion,
} from './settings-support.js';
import { OTHER, dialogNamed, named, openDialogs, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-08's one form open and one command in flight per screen (DESIGN-018, PHASE1-S3b criterion
// 7), and the method form against the session (criterion 9): the stay-or-discard decision from
// every way out, M-6 and BO-01, a command that crosses them. jsdom has no top layer and no
// inertness, so what only a browser shows is e2e/tests/payment-methods.spec.ts.

let h: ReturnType<typeof settingsHarness>;
let view: Awaited<ReturnType<typeof openSettings>> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const PASSWORD = 'correct horse';
const NEW = makeMethod(9, 'Voucher', true);

const open = async (methods: Parameters<typeof openSettings>[2] = methodsView(QRIS, BANK, GOPAY2), path?: string) => {
  h = settingsHarness(path);
  view = await openSettings(h, undefined, methods);
  return view.host;
};

const decision = () => dialogNamed('Discard unsaved changes?');
const m6 = () => dialogNamed('Your session timed out')!;
const rail = (host: HTMLElement) => host.querySelector<HTMLElement>('.bonav')!;
const byId = (host: HTMLElement, id: string) => host.querySelector<HTMLElement>(`#${id}`)!;
const saveMethod = (host: HTMLElement) => tap(byId(host, 'save-method'));
const cancelMethod = (host: HTMLElement) => tap(byId(host, 'cancel-method'));

/** A method name typed and not saved, in a new payment method's form. */
function dirtyMethod(host: HTMLElement, value = 'Voucher') {
  tap(named(host, 'New payment method'));
  typeIn(methodNameField(host)!, value);
}

/** A phone change typed and not saved. */
function dirtyPhone(host: HTMLElement) {
  tap(named(host, 'Change phone'));
  fill(host, 'Phone', '021 555 0000');
}

async function goIdle(host: HTMLElement) {
  h.reply(ACTIVITY, refusal('SESSION_IDLE'));
  press();
  await h.settle();
  expect(sessionState(host)).toBe('idle');
}

async function resume(host: HTMLElement) {
  h.reply(REAUTH, ok(VIEW));
  type(field(document.body, 'Password'), PASSWORD);
  tap(button(document.body, 'Continue'));
  await h.settle();
  expect(sessionState(host)).toBe('signed-in');
}

async function endSession(host: HTMLElement) {
  h.reply(ACTIVITY, refusal('UNAUTHENTICATED'));
  press();
  await h.settle();
  expect(sessionState(host)).toBe('signed-out');
}

async function signInAgain(host: HTMLElement, reply = ok(VIEW), username = 'm.iqbal') {
  h.reply(LOGIN, reply);
  type(field(host, 'Username'), username);
  type(field(host, 'Password'), PASSWORD);
  tap(button(host, 'Sign in'));
  await h.settle();
}

describe('the decision before a method draft is left', () => {
  it('Cancel with a dirty form shows the decision; Stay returns focus to Method name with the draft', async () => {
    const host = await open();
    dirtyMethod(host);
    cancelMethod(host);
    const d = decision()!;
    expect(text(d.querySelector('#departure-copy'))).toBe(
      'Your edits have not been saved. Stay to keep editing, or discard them before leaving.'
    );
    tap(named(d, 'Stay'));
    expect(decision()).toBeNull();
    expect(methodNameField(host)!.value).toBe('Voucher');
    expect(document.activeElement).toBe(methodNameField(host));
  });

  it('Discard closes the form and returns focus to New payment method, or to the method’s Edit', async () => {
    const host = await open();
    dirtyMethod(host);
    cancelMethod(host);
    tap(named(decision()!, 'Discard'));
    expect(methodPanel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'New payment method'));
    expect(h.count(M_CREATE)).toBe(0);

    tap(named(host, 'Edit Bank transfer — active'));
    typeIn(methodNameField(host)!, 'Bank');
    cancelMethod(host);
    tap(named(decision()!, 'Discard'));
    expect(methodPanel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Edit Bank transfer — active'));
    expect(methodRowNames(host)).toContain('Bank transfer');
  });

  it('a clean form closes on Cancel and on Escape with no decision', async () => {
    const host = await open();
    tap(named(host, 'New payment method'));
    cancelMethod(host);
    expect(decision()).toBeNull();
    expect(methodPanel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'New payment method'));

    tap(named(host, 'Edit qris — inactive'));
    pressEscape(methodNameField(host)!);
    expect(decision()).toBeNull();
    expect(methodPanel(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Edit qris — inactive'));
  });

  it('Escape with a dirty form shows the decision', async () => {
    const host = await open();
    dirtyMethod(host);
    const escape = pressEscape(methodNameField(host)!);
    expect(escape.keydown.defaultPrevented).toBe(true);
    expect(decision()).not.toBeNull();
    expect(methodNameField(host)!.value).toBe('Voucher');
  });

  it('the rail entry shows the decision; Stay keeps the draft; Discard follows to Tables', async () => {
    const host = await open();
    dirtyMethod(host);
    tap(named(rail(host), 'Tables'));
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(window.location.pathname).toBe('/back-office/settings');
    expect(methodNameField(host)!.value).toBe('Voucher');

    tap(named(rail(host), 'Tables'));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/tables');
  });

  it('browser Back with a dirty method form restores the path and shows the decision', async () => {
    const host = await open(undefined, '/back-office/');
    tap(named(rail(host), 'Settings'));
    await h.settle();
    dirtyMethod(host);
    window.history.pushState(null, '', '/back-office/');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(window.location.pathname).toBe('/back-office/settings');
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(methodNameField(host)!.value).toBe('Voucher');
  });

  it('a pending method save requires the decision even with an unchanged draft, and Stay focuses the notice', async () => {
    const host = await open();
    tap(named(host, 'Edit Bank transfer — active'));
    h.hold(M_UPDATE);
    saveMethod(host);
    await h.settle();
    cancelMethod(host);
    expect(text(decision()!.querySelector('#departure-copy'))).toBe(
      'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.'
    );
    tap(named(decision()!, 'Stay'));
    expect(document.activeElement).toBe(methodNotice(host));
  });

  it('an unknown outcome requires the decision with the same sentence, whatever the draft holds', async () => {
    const host = await open();
    tap(named(host, 'Edit Bank transfer — active'));
    h.reply(M_UPDATE, failure);
    saveMethod(host);
    await h.settle();
    cancelMethod(host);
    expect(text(decision()!.querySelector('#departure-copy'))).toContain('The save may or may not have succeeded.');
  });

  it('Discard during a pending save keeps its answer: the waiting sentence in the methods status, then the record, silently', async () => {
    const host = await open();
    dirtyMethod(host);
    const held = h.hold(M_CREATE);
    saveMethod(host);
    await h.settle();
    cancelMethod(host);
    tap(named(decision()!, 'Discard'));
    expect(text(methodsStatus(host))).toBe('Waiting for an earlier save to finish. Nothing will be sent again.');
    expect(host.querySelector('#settings-status')).toBeNull();
    held.deliver(methodAnswer(NEW));
    await h.settle();
    expect(methodsStatus(host)).toBeNull();
    expect(methodRowNames(host)).toContain('Voucher');
    expect(methodPanel(host)).toBeNull();
    expect(h.count(M_CREATE)).toBe(1);
  });

  it('Discard during a pending settings save puts the waiting sentence in the settings status, not the methods one', async () => {
    const host = await open();
    dirtyPhone(host);
    const held = h.hold(SAVE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    expect(text(host.querySelector('#settings-status'))).toBe('Waiting for an earlier save to finish. Nothing will be sent again.');
    expect(methodsStatus(host)).toBeNull();
    held.deliver(answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    await h.settle();
    expect(host.querySelector('#settings-status')).toBeNull();
  });

  it('the top bar’s Log out with a dirty method form opens the built confirmation', async () => {
    const host = await open();
    dirtyMethod(host);
    tap(named(host, 'Log out'));
    await h.settle();
    expect(dialogNamed(DISCARD_TITLE)).not.toBeNull();
    tap(named(dialogNamed(DISCARD_TITLE)!, 'Keep this draft'));
    expect(methodNameField(host)!.value).toBe('Voucher');
    expect(document.activeElement).toBe(methodNameField(host));
  });
});

describe('AC 7. one form open and one command in flight per screen', () => {
  it('with the settings form dirty, New payment method meets the decision; Stay keeps the settings draft', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'New payment method'));
    expect(decision()).not.toBeNull();
    expect(methodPanel(host)).toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    expect(document.activeElement).toBe(box(host, 'Phone'));
    expect(methodPanel(host)).toBeNull();
  });

  it('Discard hands over: the settings form closes and the method form opens, one form at a time', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'New payment method'));
    tap(named(decision()!, 'Discard'));
    expect(form(host)).toBeNull();
    expect(methodPanel(host)).not.toBeNull();
    expect(document.activeElement).toBe(methodNameField(host));
    expect(h.count(SAVE)).toBe(0);
  });

  it('with the settings form dirty, a method’s Deactivate meets the decision first and sends only on Discard', async () => {
    const host = await open();
    dirtyPhone(host);
    tap(named(host, 'Deactivate GoPay 2'));
    expect(decision()).not.toBeNull();
    expect(h.count(M_DEACTIVATE)).toBe(0);
    h.reply(M_DEACTIVATE, methodAnswer({ ...GOPAY2, isActive: false }));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(form(host)).toBeNull();
    expect(h.count(M_DEACTIVATE)).toBe(1);
    expect(text(methodsStatus(host))).toBe('GoPay 2 deactivated. It is kept for history.');
  });

  it('with a method draft dirty, a settings Change does the same; Edit on another method too', async () => {
    const host = await open();
    dirtyMethod(host);
    tap(named(host, 'Change phone'));
    expect(decision()).not.toBeNull();
    expect(form(host)).toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(methodNameField(host)!.value).toBe('Voucher');

    tap(named(host, 'Change phone'));
    tap(named(decision()!, 'Discard'));
    expect(methodPanel(host)).toBeNull();
    expect(form(host)).not.toBeNull();
    expect(document.activeElement).toBe(box(host, 'Phone'));

    // And back: the settings form is clean, so a method opener simply hands over.
    tap(named(host, 'Edit Bank transfer — active'));
    expect(decision()).toBeNull();
    expect(form(host)).toBeNull();
    expect(text(methodPanel(host)!.querySelector('#method-editor-title'))).toBe('Edit Bank transfer');
  });

  it('with a clean form open, any opener simply hands over: no decision', async () => {
    const host = await open();
    tap(named(host, 'Change phone'));
    tap(named(host, 'New payment method'));
    expect(decision()).toBeNull();
    expect(form(host)).toBeNull();
    expect(methodPanel(host)).not.toBeNull();
    tap(named(host, 'Change tax rate'));
    expect(decision()).toBeNull();
    expect(methodPanel(host)).toBeNull();
    expect(form(host)).not.toBeNull();
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
  });

  it('while a settings save is pending, every method opener is inert and a press sends nothing', async () => {
    const host = await open();
    dirtyPhone(host);
    const held = h.hold(SAVE);
    tap(named(host, 'Save'));
    await h.settle();
    for (const name of ['New payment method', 'Edit Bank transfer — active', 'Deactivate Bank transfer', 'Reactivate qris']) {
      expect(named(host, name).getAttribute('aria-disabled'), name).toBe('true');
      tap(named(host, name));
    }
    await h.settle();
    expect(decision()).toBeNull();
    expect(methodPanel(host)).toBeNull();
    expect(host.querySelectorAll('[role="dialog"][aria-modal="false"]')).toHaveLength(0);
    expect(h.calls.filter((c) => c.url.includes('tender-methods') && c.method === 'POST')).toHaveLength(0);
    expect(h.count(SAVE)).toBe(1);
    held.deliver(answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    await h.settle();
    expect(named(host, 'Deactivate Bank transfer').hasAttribute('aria-disabled')).toBe(false);
  });

  it('while a method command is pending, every settings Change is inert and a press opens nothing', async () => {
    const host = await open();
    const held = h.hold(M_DEACTIVATE);
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    for (const el of host.querySelectorAll<HTMLElement>('[data-change]')) {
      expect(el.getAttribute('aria-disabled')).toBe('true');
      tap(el);
    }
    expect(form(host)).toBeNull();
    expect(decision()).toBeNull();
    held.deliver(methodAnswer({ ...GOPAY2, isActive: false }));
    await h.settle();
    for (const el of host.querySelectorAll<HTMLElement>('[data-change]')) expect(el.hasAttribute('aria-disabled')).toBe(false);
    tap(named(host, 'Change phone'));
    expect(form(host)).not.toBeNull();
  });

  it('a discarded method save still outstanding keeps every opener on the screen inert, until it answers', async () => {
    const host = await open();
    dirtyMethod(host);
    const held = h.hold(M_CREATE);
    saveMethod(host);
    await h.settle();
    cancelMethod(host);
    tap(named(decision()!, 'Discard'));
    expect(named(host, 'Change phone').getAttribute('aria-disabled')).toBe('true');
    expect(named(host, 'New payment method').getAttribute('aria-disabled')).toBe('true');
    tap(named(host, 'Change phone'));
    expect(form(host)).toBeNull();
    held.deliver(methodAnswer(NEW));
    await h.settle();
    expect(named(host, 'Change phone').hasAttribute('aria-disabled')).toBe(false);
  });

  it('after an unknown outcome the openers are live again', async () => {
    const host = await open();
    const reread = failure;
    h.reply(M_DEACTIVATE, failure);
    h.reply(METHODS, reread);
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    expect(text(methodsStatus(host))).toContain('the outcome could not be confirmed');
    tap(named(host, 'Change phone'));
    expect(form(host)).not.toBeNull();
  });
});

describe('AC 9. the method form against the session', () => {
  it('under M-6 the panel stays visible and inert; resuming gives Method name back, holding the draft, and sends nothing', async () => {
    const host = await open();
    dirtyMethod(host);
    await goIdle(host);
    expect(methodPanel(host)).not.toBeNull();
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(true);
    expect(m6()).not.toBeNull();

    await resume(host);
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(false);
    expect(methodNameField(host)!.value).toBe('Voucher');
    expect(document.activeElement).toBe(methodNameField(host));
    expect(h.count(M_CREATE)).toBe(0);
  });

  it('SESSION_IDLE on a method save opens M-6 with the draft kept, and nothing is resent', async () => {
    const host = await open();
    dirtyMethod(host);
    h.reply(M_CREATE, refusal('SESSION_IDLE'));
    saveMethod(host);
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    expect(h.count(M_CREATE)).toBe(1);
    await resume(host);
    expect(h.count(M_CREATE)).toBe(1);
    expect(methodNotice(host)).toBeNull();
    expect(methodNameField(host)!.value).toBe('Voucher');
    expect(document.activeElement).toBe(methodNameField(host));
  });

  it('a session refusal of a status command says it was not changed once the same manager resumes', async () => {
    const host = await open();
    h.reply(M_DEACTIVATE, refusal('SESSION_IDLE'));
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    await resume(host);
    expect(text(methodsStatus(host))).toBe('GoPay 2 was not changed. Use its row action to try again.');
    expect(h.count(M_DEACTIVATE)).toBe(1);
    expect(named(host, 'Deactivate GoPay 2').hasAttribute('aria-disabled')).toBe(false);
  });

  it('a command answered while M-6 is up is held and presented once, with its focus, when the same manager returns', async () => {
    const host = await open();
    dirtyMethod(host);
    const held = h.hold(M_CREATE);
    saveMethod(host);
    await h.settle();
    await goIdle(host);

    held.deliver(methodAnswer(NEW));
    await h.settle();
    // Behind M-6 nothing is announced or changed.
    expect(methodsStatus(host)).toBeNull();
    expect(methodPanel(host)).not.toBeNull();
    expect(methodRowNames(host)).not.toContain('Voucher');

    await resume(host);
    expect(methodPanel(host)).toBeNull();
    expect(text(methodsStatus(host))).toBe('Voucher saved.');
    expect(methodRowNames(host)).toContain('Voucher');
    expect(document.activeElement).toBe(named(host, 'Edit Voucher — active'));
    expect(h.count(M_CREATE)).toBe(1);
  });

  it('an unknown outcome whose reread is out when M-6 opens is not presented until the same manager returns, then once; nothing is read or sent again', async () => {
    const host = await open();
    dirtyMethod(host);
    h.reply(M_CREATE, failure);
    const reread = h.hold(METHODS);
    saveMethod(host);
    await h.settle();
    await goIdle(host);
    reread.deliver(methodsView(QRIS, BANK, GOPAY2));
    await h.settle();
    expect(text(methodNotice(host))).toContain('Saving…');

    await resume(host);
    expect(text(methodNotice(host))).toContain('Outcome not confirmed');
    expect(text(methodNotice(host))).toContain('The list has been refreshed.');
    expect(document.activeElement).toBe(methodNameField(host));
    expect(h.count(M_CREATE)).toBe(1);
    expect(h.count(METHODS)).toBe(2);
  });

  it('a status command’s unknown outcome whose reread is out when M-6 opens is presented once on return', async () => {
    const host = await open();
    h.reply(M_DEACTIVATE, failure);
    const reread = h.hold(METHODS);
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    await goIdle(host);
    reread.deliver(failure);
    await h.settle();
    expect(text(methodsStatus(host))).toBe('Deactivating GoPay 2…');

    await resume(host);
    expect(text(methodsStatus(host))).toBe(
      'GoPay 2: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.'
    );
    expect(h.count(M_DEACTIVATE)).toBe(1);
    expect(h.count(METHODS)).toBe(2);
  });

  it('the departure decision opening during the reread holds the result; Stay presents it once', async () => {
    const host = await open();
    dirtyMethod(host);
    h.reply(M_CREATE, failure);
    const reread = h.hold(METHODS);
    saveMethod(host);
    await h.settle();
    cancelMethod(host);
    expect(decision()).not.toBeNull();
    reread.deliver(methodsView(QRIS, BANK, GOPAY2));
    await h.settle();
    expect(text(methodNotice(host))).toContain('Saving…');
    tap(named(decision()!, 'Stay'));
    await h.settle();
    expect(text(methodNotice(host))).toContain('Outcome not confirmed');
    expect(h.count(M_CREATE)).toBe(1);
    expect(h.count(METHODS)).toBe(2);
  });

  it('through M-6 as a different manager the area starts with no form, and the old answer is never announced', async () => {
    const host = await open();
    dirtyMethod(host);
    const held = h.hold(M_CREATE);
    saveMethod(host);
    await h.settle();
    await goIdle(host);

    h.reply(ME, ok(OTHER));
    h.reply(LOGIN, ok(OTHER));
    tap(button(document.body, 'Sign in as a different manager'));
    tap(button(document.body, 'Continue to sign-in'));
    type(field(document.body, 'Username'), 'r.ayu');
    type(field(document.body, 'Password'), PASSWORD);
    tap(button(document.body, 'Sign in'));
    await h.settle();
    expect(sessionState(host)).toBe('signed-in');
    expect(host.querySelector('.office-actor')!.textContent).toBe('R. Ayu');
    expect(methodPanel(host)).toBeNull();
    expect(methodsStatus(host)).toBeNull();
    expect(named(host, 'New payment method').hasAttribute('aria-disabled')).toBe(false);
    expect([...host.querySelectorAll('input')].some((i) => i.value === 'Voucher')).toBe(false);
    const focused = document.activeElement;

    held.deliver(methodAnswer(NEW));
    await h.settle();
    expect(methodsStatus(host)).toBeNull();
    expect(methodRowNames(host)).not.toContain('Voucher');
    expect(document.activeElement).toBe(focused);
    expect(h.count(M_CREATE)).toBe(1);
  });

  it('at BO-01 the panel is hidden with the draft held; the same manager gets it back with Method name focused and the value', async () => {
    const host = await open();
    dirtyMethod(host);
    await endSession(host);
    expect(host.querySelector<HTMLElement>('main.bocontent')!.hidden).toBe(true);
    expect(methodNameField(host)!.value).toBe('Voucher');
    type(field(host, 'Username'), 'm.iqbal');
    expect(field(host, 'Username').value).toBe('m.iqbal');

    await signInAgain(host);
    expect(sessionState(host)).toBe('signed-in');
    expect(methodNameField(host)!.value).toBe('Voucher');
    expect(document.activeElement).toBe(methodNameField(host));
    expect(h.count(M_CREATE)).toBe(0);
  });

  it('at BO-01 with the decision open: closed, its state kept, and reopened on Stay for the same manager', async () => {
    const host = await open();
    dirtyMethod(host);
    cancelMethod(host);
    const departure = document.querySelector<HTMLDialogElement>('dialog:has(#departure-stay)')!;
    expect(departure.open).toBe(true);
    await endSession(host);
    expect(departure.open).toBe(false);
    expect(openDialogs()).toHaveLength(0);
    await signInAgain(host);
    expect(departure.open).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('#departure-stay'));
    tap(named(departure, 'Stay'));
    expect(document.activeElement).toBe(methodNameField(host));
    expect(methodNameField(host)!.value).toBe('Voucher');
  });

  it('a different manager’s sign-in at BO-01 destroys the method draft and the decision', async () => {
    const host = await open();
    dirtyMethod(host);
    cancelMethod(host);
    await endSession(host);
    h.reply(ME, ok(OTHER));
    await signInAgain(host, ok(OTHER), 'r.ayu');
    expect(openDialogs()).toHaveLength(0);
    expect(methodPanel(host)).toBeNull();
    expect(decision()).toBeNull();
    expect([...document.querySelectorAll('input')].some((i) => i.value === 'Voucher')).toBe(false);
    expect(h.count(READ)).toBe(2);
    expect(h.count(METHODS)).toBe(2);
  });

  it('an answer that arrives at BO-01 is held for the same manager, who sees it once after signing in', async () => {
    const host = await open();
    dirtyMethod(host);
    const held = h.hold(M_CREATE);
    saveMethod(host);
    await h.settle();
    await endSession(host);
    held.deliver(methodAnswer(NEW));
    await h.settle();
    expect(methodRowNames(host)).not.toContain('Voucher');
    await signInAgain(host);
    expect(text(methodsStatus(host))).toBe('Voucher saved.');
    expect(methodRowNames(host)).toContain('Voucher');
    expect(methodBody(h, M_CREATE)).toEqual({ name: 'Voucher' });
    expect(h.count(M_CREATE)).toBe(1);
  });
});
