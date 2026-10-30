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
  ANNIVERSARY, BIRTHDAY, P_CREATE, P_DEACTIVATE, P_REACTIVATE, P_UPDATE, READ, REGULAR, STAFF,
  amountField, aria, bodyOf, byId, formNotice, harness, nameField, named, newPercentDraft, openPresets,
  pageStatus, panel, percent, percentField, preset, presetAnswer, presetList, rail, rowNames, tap, typeInto,
} from './presets-support.js';
import { OTHER, dialogNamed, openDialogs } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-07's one form open and one command in flight per screen (DESIGN-022 *One form and one
// command*, PHASE1-S6b criterion 12), and the form and the confirmation against the session
// (criterion 14): the stay-or-discard decision from every way out, M-6 and BO-01, a command that
// crosses them. jsdom has no top layer and no inertness, so what only a browser shows is
// e2e/tests/presets.spec.ts.

let h: ReturnType<typeof harness>;
let view: Awaited<ReturnType<typeof openPresets>> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const PASSWORD = 'correct horse';
const MADE = preset(9, 'Happy hour', percent('100000'));
const focused = () => document.activeElement;

const open = async (first = presetList(12), path?: string) => {
  h = harness(path);
  view = await openPresets(h, first);
  return view.host;
};

const decision = () => dialogNamed('Discard unsaved changes?');
const m6 = () => dialogNamed('Your session timed out')!;
const confirmation = (name = 'Staff meal') => dialogNamed(`Deactivate “${name}”?`);
const cancel = () => tap(document.querySelector<HTMLElement>('#cancel-preset')!);

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

/** A new preset typed and not saved. */
const dirtyNew = (host: HTMLElement) => newPercentDraft(host);

describe('the decision before a preset draft is left', () => {
  it('Cancel with a dirty form shows the decision; Stay returns focus to Preset name with the draft', async () => {
    const host = await open();
    dirtyNew(host);
    cancel();
    expect(text(decision()!.querySelector('#departure-copy'))).toBe(
      'Your edits have not been saved. Stay to keep editing, or discard them before leaving.'
    );
    expect(focused()).toBe(document.querySelector('#departure-stay'));
    tap(named(decision()!, 'Stay'));
    expect(decision()).toBeNull();
    expect(nameField(host)!.value).toBe('Happy hour');
    expect(focused()).toBe(nameField(host));
  });

  it('Discard closes the form and returns focus to New preset, or to the preset’s Edit', async () => {
    const host = await open();
    dirtyNew(host);
    cancel();
    tap(named(decision()!, 'Discard'));
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'New preset'));
    expect(h.count(P_CREATE)).toBe(0);

    tap(named(host, 'Edit Birthday — active'));
    typeInto(nameField(host)!, 'Birthday treat');
    cancel();
    tap(named(decision()!, 'Discard'));
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Edit Birthday — active'));
    expect(rowNames(host)).toContain('Birthday');
  });

  it('a clean form closes on Cancel and on Escape with no decision', async () => {
    const host = await open();
    tap(named(host, 'New preset'));
    cancel();
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'New preset'));

    tap(named(host, 'Edit Regular customer — inactive'));
    pressEscape(nameField(host)!);
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Edit Regular customer — inactive'));
  });

  it('Escape with a dirty form shows the decision', async () => {
    const host = await open();
    dirtyNew(host);
    const escape = pressEscape(nameField(host)!);
    expect(escape.keydown.defaultPrevented).toBe(true);
    expect(decision()).not.toBeNull();
    expect(nameField(host)!.value).toBe('Happy hour');
  });

  it('the rail entry shows the decision; Stay keeps the draft; Discard follows to Tables', async () => {
    const host = await open();
    dirtyNew(host);
    tap(named(rail(host), 'Tables'));
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(window.location.pathname).toBe('/back-office/presets');
    expect(nameField(host)!.value).toBe('Happy hour');

    tap(named(rail(host), 'Tables'));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/tables');
  });

  it('browser Back with a dirty form restores the path and shows the decision', async () => {
    const host = await open(presetList(12), '/back-office/');
    tap(named(rail(host), 'Discount presets'));
    await h.settle();
    dirtyNew(host);
    window.history.pushState(null, '', '/back-office/');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(window.location.pathname).toBe('/back-office/presets');
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(nameField(host)!.value).toBe('Happy hour');
  });

  it('a pending save requires the decision even with an unchanged draft, and Stay focuses the Saving notice', async () => {
    const host = await open();
    tap(named(host, 'Edit Birthday — active'));
    h.hold(P_UPDATE);
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
    tap(named(host, 'Edit Birthday — active'));
    h.reply(P_UPDATE, failure);
    tap(named(host, 'Save'));
    await h.settle();
    cancel();
    expect(text(decision()!.querySelector('#departure-copy'))).toContain('The save may or may not have succeeded.');
  });

  it('Discard during a pending save keeps its answer: the waiting sentence, then the record, silently', async () => {
    const host = await open();
    dirtyNew(host);
    const held = h.hold(P_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    cancel();
    tap(named(decision()!, 'Discard'));
    expect(text(pageStatus(host))).toBe('Waiting for an earlier save to finish. Nothing will be sent again.');
    const spot = focused();
    held.deliver(presetAnswer(13, MADE));
    await h.settle();
    expect(pageStatus(host)).toBeNull();
    expect(rowNames(host)).toContain('Happy hour');
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(spot);
    expect(h.count(P_CREATE)).toBe(1);
  });

  it('the top bar’s Log out with a dirty form opens the built confirmation; Keep this draft returns to Preset name', async () => {
    const host = await open();
    dirtyNew(host);
    tap(named(host, 'Log out'));
    await h.settle();
    expect(dialogNamed(DISCARD_TITLE)).not.toBeNull();
    tap(named(dialogNamed(DISCARD_TITLE)!, 'Keep this draft'));
    expect(nameField(host)!.value).toBe('Happy hour');
    expect(focused()).toBe(nameField(host));
  });
});

describe('AC 12. one form open and one command in flight per screen', () => {
  it('with a dirty draft, New preset, another Edit, Deactivate and Reactivate each meet the decision first', async () => {
    const host = await open();
    dirtyNew(host);
    for (const opener of ['New preset', 'Edit Birthday — active', 'Deactivate Staff meal', 'Reactivate Regular customer']) {
      tap(named(host, opener));
      expect(decision(), opener).not.toBeNull();
      expect(h.calls.filter((c) => c.method === 'POST' && c.url.includes('/presets/')), opener).toHaveLength(0);
      tap(named(decision()!, 'Stay'));
      expect(nameField(host)!.value, opener).toBe('Happy hour');
    }
    expect(confirmation()).toBeNull();
  });

  it('Discard hands over: Edit opens that preset’s form, Deactivate opens the confirmation, Reactivate sends', async () => {
    const host = await open();
    dirtyNew(host);
    tap(named(host, 'Edit Birthday — active'));
    tap(named(decision()!, 'Discard'));
    expect(text(host.querySelector('#editor-title'))).toBe('Edit Birthday');
    expect(focused()).toBe(nameField(host));
    typeInto(nameField(host)!, 'Birthday treat');

    tap(named(host, 'Deactivate Staff meal'));
    tap(named(decision()!, 'Discard'));
    expect(panel(host)).toBeNull();
    expect(confirmation()).not.toBeNull();
    expect(h.count(P_DEACTIVATE)).toBe(0);
    tap(named(confirmation()!, 'Keep active — Staff meal'));

    tap(named(host, 'New preset'));
    typeInto(nameField(host)!, 'Another');
    h.reply(P_REACTIVATE, presetAnswer(13, { ...REGULAR, isActive: true }));
    tap(named(host, 'Reactivate Regular customer'));
    tap(named(decision()!, 'Discard'));
    await h.settle();
    expect(panel(host)).toBeNull();
    expect(h.count(P_REACTIVATE)).toBe(1);
  });

  it('with a clean form open, any opener simply hands over: no decision', async () => {
    const host = await open();
    tap(named(host, 'Edit Birthday — active'));
    tap(named(host, 'New preset'));
    expect(decision()).toBeNull();
    expect(text(host.querySelector('#editor-title'))).toBe('New preset');
    tap(named(host, 'Edit Staff meal — active'));
    expect(decision()).toBeNull();
    expect(text(host.querySelector('#editor-title'))).toBe('Edit Staff meal');
    tap(named(host, 'Deactivate Birthday'));
    expect(decision()).toBeNull();
    expect(panel(host)).toBeNull();
    expect(confirmation('Birthday')).not.toBeNull();
  });

  it('while a save is pending every opener is inert and a press sends nothing', async () => {
    const host = await open();
    dirtyNew(host);
    const held = h.hold(P_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    for (const name of ['New preset', 'Edit Birthday — active', 'Deactivate Staff meal', 'Reactivate Regular customer']) {
      expect(aria(named(host, name)), name).toBe(true);
      tap(named(host, name));
    }
    await h.settle();
    expect(decision()).toBeNull();
    expect(confirmation()).toBeNull();
    expect(h.count(P_CREATE)).toBe(1);
    expect(h.count(P_DEACTIVATE)).toBe(0);
    expect(h.count(P_REACTIVATE)).toBe(0);
    // The form's controls are held too.
    expect(nameField(host)!.disabled).toBe(true);
    expect(aria(named(host, 'Save'))).toBe(true);
    held.deliver(presetAnswer(13, MADE));
    await h.settle();
    expect(named(host, 'Deactivate Staff meal').hasAttribute('aria-disabled')).toBe(false);
  });

  it('while a state command is pending every opener is inert; a second press sends nothing', async () => {
    const host = await open();
    h.reply(P_REACTIVATE, presetAnswer(13, { ...REGULAR, isActive: true }));
    const held = h.hold(P_REACTIVATE);
    tap(named(host, 'Reactivate Regular customer'));
    tap(named(host, 'Reactivate Regular customer'));
    await h.settle();
    for (const name of ['New preset', 'Edit Birthday — active', 'Deactivate Staff meal', 'Reactivate Regular customer']) {
      expect(aria(named(host, name)), name).toBe(true);
      tap(named(host, name));
    }
    expect(h.count(P_REACTIVATE)).toBe(1);
    expect(h.count(P_DEACTIVATE)).toBe(0);
    expect(panel(host)).toBeNull();
    expect(confirmation()).toBeNull();
    held.deliver(presetAnswer(13, { ...REGULAR, isActive: true }));
    await h.settle();
    expect(named(host, 'New preset').hasAttribute('aria-disabled')).toBe(false);
  });

  it('a discarded save still outstanding keeps every opener inert, until it answers', async () => {
    const host = await open();
    dirtyNew(host);
    const held = h.hold(P_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    cancel();
    tap(named(decision()!, 'Discard'));
    expect(aria(named(host, 'New preset'))).toBe(true);
    expect(aria(named(host, 'Reactivate Regular customer'))).toBe(true);
    tap(named(host, 'Reactivate Regular customer'));
    expect(h.count(P_REACTIVATE)).toBe(0);
    held.deliver(presetAnswer(13, MADE));
    await h.settle();
    expect(named(host, 'New preset').hasAttribute('aria-disabled')).toBe(false);
  });

  it('after an unknown outcome the openers are live again', async () => {
    const host = await open();
    h.reply(P_REACTIVATE, failure);
    tap(named(host, 'Reactivate Regular customer'));
    await h.settle();
    expect(text(pageStatus(host))).toContain('the outcome could not be confirmed');
    tap(named(host, 'New preset'));
    expect(panel(host)).not.toBeNull();
  });
});

describe('AC 14. the form and the confirmation against the session', () => {
  it('under M-6 the panel stays visible and inert; resuming gives Preset name back, holding the draft, and sends nothing', async () => {
    const host = await open();
    dirtyNew(host);
    await goIdle(host);
    expect(panel(host)).not.toBeNull();
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(true);
    expect(m6()).not.toBeNull();

    await resume(host);
    expect(host.querySelector('.bocontent')!.hasAttribute('inert')).toBe(false);
    expect(nameField(host)!.value).toBe('Happy hour');
    expect(focused()).toBe(nameField(host));
    expect(h.count(P_CREATE)).toBe(0);
  });

  it('SESSION_IDLE on a save opens M-6 with the draft kept, and nothing is resent', async () => {
    const host = await open();
    dirtyNew(host);
    h.reply(P_CREATE, refusal('SESSION_IDLE'));
    tap(named(host, 'Save'));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    expect(h.count(P_CREATE)).toBe(1);
    await resume(host);
    expect(h.count(P_CREATE)).toBe(1);
    expect(formNotice(host)).toBeNull();
    expect(nameField(host)!.value).toBe('Happy hour');
    expect(focused()).toBe(nameField(host));
  });

  it('a session refusal of a state command says it was not changed once the same manager resumes', async () => {
    const host = await open();
    h.reply(P_REACTIVATE, refusal('SESSION_IDLE'));
    tap(named(host, 'Reactivate Regular customer'));
    await h.settle();
    expect(sessionState(host)).toBe('idle');
    await resume(host);
    expect(text(pageStatus(host))).toBe('Regular customer was not changed. Use its row action to try again.');
    expect(h.count(P_REACTIVATE)).toBe(1);
    expect(named(host, 'Reactivate Regular customer').hasAttribute('aria-disabled')).toBe(false);
  });

  it('a command answered while M-6 is up is held and presented once, with its focus, when the same manager returns', async () => {
    const host = await open();
    dirtyNew(host);
    const held = h.hold(P_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);

    held.deliver(presetAnswer(13, MADE));
    await h.settle();
    // Behind M-6 nothing is announced or changed.
    expect(pageStatus(host)).toBeNull();
    expect(panel(host)).not.toBeNull();
    expect(rowNames(host)).not.toContain('Happy hour');

    await resume(host);
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Happy hour saved.');
    expect(rowNames(host)).toContain('Happy hour');
    expect(focused()).toBe(named(host, 'Edit Happy hour — active'));
    expect(h.count(P_CREATE)).toBe(1);
  });

  it('an unknown outcome whose reread is out when M-6 opens is not presented until the same manager returns, then once; nothing is read or sent again', async () => {
    const host = await open();
    dirtyNew(host);
    h.reply(P_CREATE, failure);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    reread.deliver(presetList(12));
    await h.settle();
    expect(text(formNotice(host))).toContain('Saving…');

    await resume(host);
    expect(text(formNotice(host))).toContain('Outcome not confirmed');
    expect(text(formNotice(host))).toContain('The list has been refreshed.');
    expect(focused()).toBe(nameField(host));
    expect(h.count(P_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });

  it('a name refused as held, with the reread out when M-6 opens, is presented once on return', async () => {
    const host = await open();
    dirtyNew(host);
    h.reply(P_CREATE, refusal('DUPLICATE', undefined, 409));
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    reread.deliver(presetList(12, [preset(5, 'happy HOUR', percent('1')), STAFF]));
    await h.settle();
    expect(byId(host, '#preset-name-error')).toBeNull();

    await resume(host);
    expect(byId(host, '#preset-name-error')).not.toBeNull();
    expect(focused()).toBe(nameField(host));
    expect(h.count(P_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });

  it('a stale refusal with the reread out when M-6 opens is presented once on return with the comparison', async () => {
    const host = await open();
    tap(named(host, 'Edit Staff meal — active'));
    typeInto(nameField(host)!, 'Staff lunch');
    h.reply(P_UPDATE, refusal('CATALOG_CHANGED', undefined, 409));
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    reread.deliver(presetList(13, [{ ...STAFF, value: percent('125000') }, REGULAR, BIRTHDAY, ANNIVERSARY]));
    await h.settle();
    expect(byId(host, '#stale-choices')).toBeNull();

    await resume(host);
    expect(byId(host, '#stale-choices')).not.toBeNull();
    expect(focused()).toBe(formNotice(host));
    expect(h.count(P_UPDATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });

  it('a state command’s unknown outcome whose reread is out when M-6 opens is presented once on return', async () => {
    const host = await open();
    h.reply(P_REACTIVATE, failure);
    const reread = h.hold(READ);
    tap(named(host, 'Reactivate Regular customer'));
    await h.settle();
    await goIdle(host);
    reread.deliver(failure);
    await h.settle();
    expect(text(pageStatus(host))).toBe('Reactivating Regular customer…');

    await resume(host);
    expect(text(pageStatus(host))).toBe(
      'Regular customer: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.'
    );
    expect(h.count(P_REACTIVATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });

  it('an explicit Try again whose read is outstanding when M-6 opens presents once on return and reads nothing again', async () => {
    const host = await open(failure as never);
    h.reply(READ, presetList(12));
    const reread = h.hold(READ);
    tap(named(host, 'Try again'));
    await h.settle();
    await goIdle(host);
    reread.deliver(presetList(12));
    await h.settle();
    expect(h.count(READ)).toBe(2);
    await resume(host);
    expect(rowNames(host)).toHaveLength(4);
    expect(focused()).toBe(named(host, 'New preset'));
    expect(h.count(READ)).toBe(2);
  });

  it('the departure decision opening during the reread holds the result; Stay presents it once', async () => {
    const host = await open();
    dirtyNew(host);
    h.reply(P_CREATE, failure);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    cancel();
    expect(decision()).not.toBeNull();
    reread.deliver(presetList(12));
    await h.settle();
    expect(text(formNotice(host))).toContain('Saving…');
    tap(named(decision()!, 'Stay'));
    await h.settle();
    expect(text(formNotice(host))).toContain('Outcome not confirmed');
    expect(h.count(P_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });

  it('the confirmation stays open behind M-6 and Keep active is focused again once the same manager returns', async () => {
    const host = await open();
    tap(named(host, 'Deactivate Staff meal'));
    expect(confirmation()).not.toBeNull();
    await goIdle(host);
    expect(confirmation()).not.toBeNull();
    expect(m6()).not.toBeNull();

    await resume(host);
    expect(confirmation()).not.toBeNull();
    expect(h.count(P_DEACTIVATE)).toBe(0);
    tap(named(confirmation()!, 'Deactivate Staff meal'));
    h.reply(P_DEACTIVATE, presetAnswer(13, { ...STAFF, isActive: false }));
    await h.settle();
    expect(h.count(P_DEACTIVATE)).toBe(1);
  });

  it('the decision stays open behind M-6, and the same manager gets Stay focused again on return', async () => {
    const host = await open();
    dirtyNew(host);
    cancel();
    expect(decision()).not.toBeNull();
    await goIdle(host);
    expect(decision()).not.toBeNull();
    expect(m6()).not.toBeNull();

    await resume(host);
    expect(decision()).not.toBeNull();
    tap(named(decision()!, 'Stay'));
    expect(nameField(host)!.value).toBe('Happy hour');
    expect(focused()).toBe(nameField(host));
    expect(h.count(P_CREATE)).toBe(0);
  });

  it('at BO-01 the confirmation closes with its state kept, and the same manager gets it back with Keep active focused', async () => {
    const host = await open();
    tap(named(host, 'Deactivate Staff meal'));
    const dialog = confirmation()!;
    expect(dialog.open).toBe(true);
    await endSession(host);
    expect(dialog.open).toBe(false);
    expect(openDialogs()).toHaveLength(0);
    await signInAgain(host);
    expect(dialog.open).toBe(true);
    expect(focused()).toBe(named(dialog, 'Keep active — Staff meal'));
    expect(h.count(P_DEACTIVATE)).toBe(0);
  });

  it('a different manager’s sign-in destroys the confirmation', async () => {
    const host = await open();
    tap(named(host, 'Deactivate Staff meal'));
    await endSession(host);
    h.reply(ME, ok(OTHER));
    await signInAgain(host, ok(OTHER), 'r.ayu');
    expect(openDialogs()).toHaveLength(0);
    expect(confirmation()).toBeNull();
    expect(h.count(P_DEACTIVATE)).toBe(0);
  });

  it('through M-6 as a different manager the area starts with no form, and the old answer is never announced', async () => {
    const host = await open();
    dirtyNew(host);
    const held = h.hold(P_CREATE);
    tap(named(host, 'Save'));
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
    expect(panel(host)).toBeNull();
    expect(pageStatus(host)).toBeNull();
    expect([...host.querySelectorAll('input')].some((i) => i.value === 'Happy hour')).toBe(false);
    const spot = focused();

    held.deliver(presetAnswer(13, MADE));
    await h.settle();
    expect(pageStatus(host)).toBeNull();
    expect(rowNames(host)).not.toContain('Happy hour');
    expect(focused()).toBe(spot);
    expect(h.count(P_CREATE)).toBe(1);
  });

  it('at BO-01 the panel is hidden with the draft held; the same manager gets it back with both kind buffers and Preset name focused', async () => {
    const host = await open();
    tap(named(host, 'New preset'));
    typeInto(nameField(host)!, 'Gift');
    typeInto(percentField(host)!, '12,5');
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    typeInto(amountField(host)!, '5.000');
    await endSession(host);
    expect(host.querySelector<HTMLElement>('main.bocontent')!.hidden).toBe(true);
    expect(nameField(host)!.value).toBe('Gift');
    type(field(host, 'Username'), 'm.iqbal');
    expect(field(host, 'Username').value).toBe('m.iqbal');

    await signInAgain(host);
    expect(sessionState(host)).toBe('signed-in');
    expect(nameField(host)!.value).toBe('Gift');
    expect(amountField(host)!.value).toBe('5.000');
    expect(focused()).toBe(nameField(host));
    tap(host.querySelector<HTMLElement>('#kind-percent')!);
    expect(percentField(host)!.value).toBe('12,5');
    expect(h.count(P_CREATE)).toBe(0);
  });

  it('at BO-01 with the decision open: closed, its state kept, and reopened on Stay for the same manager', async () => {
    const host = await open();
    dirtyNew(host);
    cancel();
    const departure = document.querySelector<HTMLDialogElement>('dialog:has(#departure-stay)')!;
    expect(departure.open).toBe(true);
    await endSession(host);
    expect(departure.open).toBe(false);
    expect(openDialogs()).toHaveLength(0);
    await signInAgain(host);
    expect(departure.open).toBe(true);
    expect(focused()).toBe(document.querySelector('#departure-stay'));
    tap(named(departure, 'Stay'));
    expect(focused()).toBe(nameField(host));
    expect(nameField(host)!.value).toBe('Happy hour');
  });

  it('a different manager’s sign-in at BO-01 destroys the draft and the decision', async () => {
    const host = await open();
    dirtyNew(host);
    cancel();
    await endSession(host);
    h.reply(ME, ok(OTHER));
    await signInAgain(host, ok(OTHER), 'r.ayu');
    expect(openDialogs()).toHaveLength(0);
    expect(panel(host)).toBeNull();
    expect(decision()).toBeNull();
    expect([...document.querySelectorAll('input')].some((i) => i.value === 'Happy hour')).toBe(false);
    expect(h.count(READ)).toBe(2);
  });

  it('an answer that arrives at BO-01 is held for the same manager, who sees it once after signing in', async () => {
    const host = await open();
    dirtyNew(host);
    const held = h.hold(P_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    await endSession(host);
    held.deliver(presetAnswer(13, MADE));
    await h.settle();
    expect(rowNames(host)).not.toContain('Happy hour');
    await signInAgain(host);
    expect(text(pageStatus(host))).toBe('Happy hour saved.');
    expect(rowNames(host)).toContain('Happy hour');
    expect(bodyOf(h, P_CREATE)).toEqual({ name: 'Happy hour', value: { kind: 'PERCENTAGE', ratePpm: '100000' } });
    expect(h.count(P_CREATE)).toBe(1);
  });
});
