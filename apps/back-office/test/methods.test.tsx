// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { refusal, text, type Reply } from './session-harness.js';
import {
  BANK, GOPAY10, GOPAY2, METHODS, M_CREATE, M_DEACTIVATE, M_REACTIVATE, M_UPDATE, QRIS, READ, V4,
  errorOf, facts, makeMethod, methodAnswer, methodBody, methodCalls, methodNameField, methodNotice, methodPanel,
  methodRow, methodRowNames, methodsStatus, methodsView, openSettings, settingsHarness, settingsView, typeIn,
  type MethodRow,
} from './settings-support.js';
import { named, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-08's payment-methods part (PHASE1-S3b), in jsdom: the order and the two fixed rows, the
// empty and failed reads, the name check, the four commands, `DUPLICATE`, the unknown outcome,
// and the F4 partial state. The departure, the session and the one-command-per-screen rule are
// in methods-departure.test.tsx; what only a browser shows is e2e/tests/payment-methods.spec.ts.

let h: ReturnType<typeof settingsHarness>;
let view: Awaited<ReturnType<typeof openSettings>> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const DUPLICATE = refusal('DUPLICATE', undefined, 409);
const NOT_FOUND = refusal('NOT_FOUND', undefined, 404);
const INVALID = refusal('VALIDATION_FAILED', undefined, 400);

const open = async (
  methods: Parameters<typeof openSettings>[2] = methodsView(QRIS, BANK, GOPAY2, GOPAY10),
  first?: Parameters<typeof openSettings>[1],
  path?: string
) => {
  h = settingsHarness(path);
  view = await openSettings(h, first, methods);
  return view.host;
};

const rail = (host: HTMLElement) => host.querySelector<HTMLElement>('.bonav')!;
const back = () =>
  act(() => {
    window.history.pushState(null, '', '/back-office/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
const saveMethod = (host: HTMLElement) => tap(host.querySelector<HTMLElement>('#save-method')!);
const count = (host: HTMLElement) => text(host.querySelector('#method-count'));
const NEW: MethodRow = makeMethod(9, 'Voucher', true);

describe('AC 1. the order and the two fixed rows', () => {
  it('lists Cash and Card first, then active methods by name in natural order, then inactive ones', async () => {
    const host = await open();
    expect(methodRowNames(host)).toEqual(['Cash', 'Card', 'Bank transfer', 'GoPay 2', 'GoPay 10', 'qris']);
    expect(text(host.querySelector('#methods-title'))).toBe('Payment methods');
    expect(count(host)).toBe('3 active · 1 inactive custom methods');
    expect(text(host.querySelector('#methods-list caption'))).toBe(
      'Cash and card are always offered · Custom methods: active first, names in order'
    );
    expect([...host.querySelectorAll('#methods-list th')].map((th) => th.textContent)).toEqual(['Name', 'Status', 'Actions']);
  });

  it('gives Cash and Card the status “Always offered” and no control at all', async () => {
    const host = await open();
    for (const name of ['Cash', 'Card']) {
      const row = methodRow(host, name);
      expect(text(row.querySelectorAll('td')[1]!)).toBe('Always offered');
      expect(row.querySelectorAll('button, a, input, select, textarea, [tabindex]')).toHaveLength(0);
      expect(text(row.querySelectorAll('td')[2]!)).toBe('');
    }
  });

  it('says Active or Inactive for a custom method and names its actions', async () => {
    const host = await open();
    expect(text(methodRow(host, 'qris').querySelectorAll('td')[1]!)).toBe('Inactive');
    expect(text(methodRow(host, 'GoPay 2').querySelectorAll('td')[1]!)).toBe('Active');
    expect(named(host, 'Edit qris — inactive').textContent).toBe('Edit');
    expect(named(host, 'Edit GoPay 2 — active').textContent).toBe('Edit');
    expect(named(host, 'Reactivate qris').textContent).toBe('Reactivate');
    expect(named(host, 'Deactivate GoPay 2').textContent).toBe('Deactivate');
  });

  it('sorts the answered record: a deactivated method moves below the active ones', async () => {
    const host = await open();
    h.reply(M_DEACTIVATE, methodAnswer({ ...BANK, isActive: false }));
    tap(named(host, 'Deactivate Bank transfer'));
    await h.settle();
    expect(methodRowNames(host)).toEqual(['Cash', 'Card', 'GoPay 2', 'GoPay 10', 'Bank transfer', 'qris']);
    expect(count(host)).toBe('2 active · 2 inactive custom methods');
  });
});

describe('AC 2. empty and failed reads', () => {
  it('a read with no custom method shows the two fixed rows and the empty note', async () => {
    const host = await open(methodsView());
    expect(methodRowNames(host)).toEqual(['Cash', 'Card']);
    expect(text(host.querySelector('.methods-empty'))).toBe(
      'No custom payment methods yet. Use New payment method for any way of paying other than cash or card.'
    );
    expect(count(host)).toBe('0 active · 0 inactive custom methods');
    expect(named(host, 'New payment method').hasAttribute('aria-disabled')).toBe(false);
  });

  it('a failed read shows the alert with Try again, withholds the count and the table, and leaves the settings part alone', async () => {
    const host = await open(failure);
    expect(text(host.querySelector('#methods-read [role="alert"]'))).toBe(
      'Payment methods could not be loadedTry again to read the payment methods.Try again'
    );
    expect(host.querySelector('#method-count')).toBeNull();
    expect(host.querySelector('#methods-list')).toBeNull();
    expect(named(host, 'New payment method').getAttribute('aria-disabled')).toBe('true');
    // The settings part is whole.
    expect(text(facts(host))).toContain('Version 4');
    expect(named(host, 'Change tax rate')).toBeTruthy();
    expect(host.querySelector('#settings-read')).toBeNull();
  });

  it('a failed settings read does not touch the methods part', async () => {
    const host = await open(undefined, failure);
    expect(text(host.querySelector('#settings-read [role="alert"]'))).toContain('Settings could not be loaded');
    expect(methodRowNames(host)).toEqual(['Cash', 'Card', 'Bank transfer', 'GoPay 2', 'GoPay 10', 'qris']);
    expect(count(host)).toBe('3 active · 1 inactive custom methods');
    expect(host.querySelector('#methods-read')).toBeNull();
  });

  it('Try again repeats the methods read only', async () => {
    const host = await open(failure);
    expect(h.count(METHODS)).toBe(1);
    expect(h.count(READ)).toBe(1);
    h.reply(METHODS, methodsView(BANK));
    tap(named(host.querySelector<HTMLElement>('#methods-part')!, 'Try again'));
    await h.settle();
    expect(h.count(METHODS)).toBe(2);
    expect(h.count(READ)).toBe(1);
    expect(methodRowNames(host)).toEqual(['Cash', 'Card', 'Bank transfer']);
    expect(document.activeElement).toBe(named(host, 'New payment method'));
  });

  it('shows “Loading payment methods…” while the first read is out, and the settings part is not held up by it', async () => {
    h = settingsHarness();
    let deliver!: (reply: Reply) => void;
    const held = new Promise<Reply>((resolve) => {
      deliver = resolve;
    });
    view = await openSettings(h, undefined, { held });
    const host = view.host;
    expect(text(host.querySelector('#methods-read'))).toBe('Loading payment methods…');
    expect(text(facts(host))).toContain('Version 4');
    deliver(methodsView(BANK));
    await h.settle();
    expect(host.querySelector('#methods-read')).toBeNull();
    expect(methodRowNames(host)).toEqual(['Cash', 'Card', 'Bank transfer']);
  });

  it('every visit reads both: two GETs, neither waiting for the other', async () => {
    const host = await open(undefined, undefined, '/back-office/');
    expect(h.count(METHODS)).toBe(0);
    tap(named(rail(host), 'Settings'));
    await h.settle();
    expect(h.count(READ)).toBe(1);
    expect(h.count(METHODS)).toBe(1);
    back();
    tap(named(rail(host), 'Settings'));
    await h.settle();
    expect(h.count(READ)).toBe(2);
    expect(h.count(METHODS)).toBe(2);
  });
});

describe('AC 3. the name check in the form', () => {
  const openCreate = async () => {
    const host = await open(methodsView(BANK));
    tap(named(host, 'New payment method'));
    return host;
  };

  it('opens a named, non-modal panel with Method name focused, the context sentence and the help', async () => {
    const host = await openCreate();
    const panel = methodPanel(host)!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('false');
    expect(text(panel.querySelector('#method-editor-title'))).toBe('New payment method');
    expect(text(panel.querySelector('#method-context'))).toBe('Choose the name cashiers will see when they take payment.');
    expect(text(panel.querySelector('#method-help'))).toBe('1–32 characters. Active methods must have different names.');
    expect(document.activeElement).toBe(methodNameField(host));
    expect(panel.querySelector('label[for="method-name"]')!.textContent).toBe('Method name');
  });

  it.each([
    ['empty', '', 'Enter a method name.'],
    ['only spaces', '    ', 'Enter a method name.'],
    ['33 characters', 'x'.repeat(33), 'Use 32 characters or fewer.'],
    ['33 emoji', '🍽'.repeat(33), 'Use 32 characters or fewer.'],
    ['a control character', 'Bank\u0007transfer', 'Remove control characters from the name.'],
    ['ESC', 'Bank\u001btransfer', 'Remove control characters from the name.'],
  ])('refuses %s with its copy, focus on Method name, and sends nothing', async (_what, typed, copy) => {
    const host = await openCreate();
    typeIn(methodNameField(host)!, typed);
    saveMethod(host);
    await h.settle();
    expect(errorOf(host, 'method')).toBe(copy);
    expect(methodNameField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(methodNameField(host)!.getAttribute('aria-describedby')).toBe('method-error method-help');
    expect(document.activeElement).toBe(methodNameField(host));
    expect(h.count(M_CREATE)).toBe(0);
    expect(methodNotice(host)).toBeNull();
  });

  it('editing clears the refusal', async () => {
    const host = await openCreate();
    saveMethod(host);
    expect(errorOf(host, 'method')).toBe('Enter a method name.');
    typeIn(methodNameField(host)!, 'Q');
    expect(errorOf(host, 'method')).toBeNull();
  });

  it('accepts 32 emoji locally (code points, not UTF-16 units) and sends them', async () => {
    const host = await openCreate();
    const name = '🍽'.repeat(32);
    h.reply(M_CREATE, methodAnswer(makeMethod(9, name, true)));
    typeIn(methodNameField(host)!, name);
    saveMethod(host);
    await h.settle();
    expect(errorOf(host, 'method')).toBeNull();
    expect(methodBody(h, M_CREATE)).toEqual({ name });
  });

  it('sends the trimmed name', async () => {
    const host = await openCreate();
    h.reply(M_CREATE, methodAnswer(NEW));
    typeIn(methodNameField(host)!, '  Voucher  ');
    saveMethod(host);
    await h.settle();
    expect(methodBody(h, M_CREATE)).toEqual({ name: 'Voucher' });
  });

  it('puts the checks in order: too long wins over a control character', async () => {
    const host = await openCreate();
    typeIn(methodNameField(host)!, '\u0007' + 'x'.repeat(40));
    saveMethod(host);
    expect(errorOf(host, 'method')).toBe('Use 32 characters or fewer.');
  });

  it('a custom name equal to Cash or Card is neither refused nor warned about', async () => {
    const host = await openCreate();
    h.reply(M_CREATE, methodAnswer(makeMethod(9, 'Cash', true)));
    typeIn(methodNameField(host)!, 'Cash');
    expect(errorOf(host, 'method')).toBeNull();
    saveMethod(host);
    await h.settle();
    expect(h.count(M_CREATE)).toBe(1);
    expect(text(methodsStatus(host))).toBe('Cash saved.');
  });
});

describe('AC 4. create, rename, deactivate, reactivate', () => {
  it('create sends { name } once, lists the record, announces it and focuses its Edit', async () => {
    const host = await open(methodsView(BANK));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'Voucher');
    h.reply(M_CREATE, methodAnswer(NEW));
    saveMethod(host);
    await h.settle();
    expect(methodBody(h, M_CREATE)).toEqual({ name: 'Voucher' });
    expect(h.count(M_CREATE)).toBe(1);
    expect(methodPanel(host)).toBeNull();
    expect(methodRowNames(host)).toEqual(['Cash', 'Card', 'Bank transfer', 'Voucher']);
    expect(text(methodsStatus(host))).toBe('Voucher saved.');
    expect(document.activeElement).toBe(named(host, 'Edit Voucher — active'));
    expect(count(host)).toBe('2 active · 0 inactive custom methods');
    // Nothing is reread after a success.
    expect(h.count(METHODS)).toBe(1);
  });

  it('shows the saving notice, locks the field and Save, and focuses the notice, while a create is pending', async () => {
    const host = await open(methodsView(BANK));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'Voucher');
    const held = h.hold(M_CREATE);
    saveMethod(host);
    await h.settle();
    expect(text(methodNotice(host))).toBe('Saving…Wait for the result. Your draft is kept.');
    expect(methodNotice(host)!.getAttribute('role')).toBe('status');
    expect(document.activeElement).toBe(methodNotice(host));
    expect(methodNameField(host)!.disabled).toBe(true);
    expect(host.querySelector('#save-method')!.getAttribute('aria-disabled')).toBe('true');
    // A second press sends nothing.
    saveMethod(host);
    expect(h.count(M_CREATE)).toBe(1);
    held.deliver(methodAnswer(NEW));
    await h.settle();
    expect(h.count(M_CREATE)).toBe(1);
  });

  it('rename an active method sends { tenderMethodId, name } to update', async () => {
    const host = await open();
    tap(named(host, 'Edit Bank transfer — active'));
    expect(text(methodPanel(host)!.querySelector('#method-editor-title'))).toBe('Edit Bank transfer');
    expect(text(host.querySelector('#method-context'))).toBe('Active method. Changes keep this method’s history.');
    expect(methodNameField(host)!.value).toBe('Bank transfer');
    typeIn(methodNameField(host)!, 'Bank');
    h.reply(M_UPDATE, methodAnswer({ ...BANK, name: 'Bank' }));
    saveMethod(host);
    await h.settle();
    expect(methodBody(h, M_UPDATE)).toEqual({ tenderMethodId: BANK.tenderMethodId, name: 'Bank' });
    expect(methodRowNames(host)).toContain('Bank');
    expect(text(methodsStatus(host))).toBe('Bank saved.');
    expect(document.activeElement).toBe(named(host, 'Edit Bank — active'));
  });

  it('renaming an inactive method leaves it inactive and never reactivates it', async () => {
    const host = await open();
    tap(named(host, 'Edit qris — inactive'));
    expect(text(host.querySelector('#method-context'))).toBe('Inactive method. Saving its name does not reactivate it.');
    typeIn(methodNameField(host)!, 'QRIS');
    h.reply(M_UPDATE, methodAnswer({ ...QRIS, name: 'QRIS' }));
    saveMethod(host);
    await h.settle();
    expect(methodBody(h, M_UPDATE)).toEqual({ tenderMethodId: QRIS.tenderMethodId, name: 'QRIS' });
    expect(h.count(M_REACTIVATE)).toBe(0);
    expect(text(methodRow(host, 'QRIS').querySelectorAll('td')[1]!)).toBe('Inactive');
    expect(named(host, 'Reactivate QRIS')).toBeTruthy();
    expect(count(host)).toBe('3 active · 1 inactive custom methods');
  });

  it('deactivate sends { tenderMethodId } at once, with no confirmation, and says “Deactivating…” while it is out', async () => {
    const host = await open();
    const held = h.hold(M_DEACTIVATE);
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    expect(methodBody(h, M_DEACTIVATE)).toEqual({ tenderMethodId: GOPAY2.tenderMethodId });
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(0);
    expect(text(methodsStatus(host))).toBe('Deactivating GoPay 2…');
    expect(document.activeElement).toBe(methodsStatus(host));

    held.deliver(methodAnswer({ ...GOPAY2, isActive: false }));
    await h.settle();
    expect(text(methodsStatus(host))).toBe('GoPay 2 deactivated. It is kept for history.');
    expect(document.activeElement).toBe(named(host, 'Edit GoPay 2 — inactive'));
    expect(named(host, 'Reactivate GoPay 2')).toBeTruthy();
    expect(h.count(M_DEACTIVATE)).toBe(1);
  });

  it('reactivate sends { tenderMethodId } and says “Reactivating…” while it is out', async () => {
    const host = await open();
    const held = h.hold(M_REACTIVATE);
    tap(named(host, 'Reactivate qris'));
    await h.settle();
    expect(methodBody(h, M_REACTIVATE)).toEqual({ tenderMethodId: QRIS.tenderMethodId });
    expect(text(methodsStatus(host))).toBe('Reactivating qris…');
    held.deliver(methodAnswer({ ...QRIS, isActive: true }));
    await h.settle();
    expect(text(methodsStatus(host))).toBe('qris reactivated.');
    expect(document.activeElement).toBe(named(host, 'Edit qris — active'));
    expect(count(host)).toBe('4 active · 0 inactive custom methods');
  });

  it('a no-op answer (the record unchanged) is treated as the success it is', async () => {
    const host = await open();
    h.reply(M_DEACTIVATE, methodAnswer(QRIS));
    h.reply(M_REACTIVATE, methodAnswer({ ...QRIS, isActive: true }));
    tap(named(host, 'Reactivate qris'));
    await h.settle();
    expect(text(methodsStatus(host))).toBe('qris reactivated.');
  });

  it('every row action is inert while one is pending, and a press sends nothing', async () => {
    const host = await open();
    const held = h.hold(M_DEACTIVATE);
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    for (const name of ['Edit Bank transfer — active', 'Deactivate Bank transfer', 'Reactivate qris', 'New payment method']) {
      expect(named(host, name).getAttribute('aria-disabled'), name).toBe('true');
      expect(named(host, name).hasAttribute('disabled'), name).toBe(false);
      tap(named(host, name));
    }
    await h.settle();
    expect(methodPanel(host)).toBeNull();
    expect(methodCalls(h).filter((c) => c.startsWith('POST'))).toEqual(['POST /api/back-office/config/tender-methods/deactivate']);
    held.deliver(methodAnswer({ ...GOPAY2, isActive: false }));
    await h.settle();
    expect(named(host, 'Deactivate Bank transfer').hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('AC 5. DUPLICATE', () => {
  const GOPAY = makeMethod(5, 'GoPay', true);

  it('on create: the draft is kept, the refusal is on Method name with focus, the list is reread once, and the holder is marked', async () => {
    const host = await open(methodsView(BANK, GOPAY));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'gopay');
    h.reply(M_CREATE, DUPLICATE);
    saveMethod(host);
    await h.settle();
    expect(methodNameField(host)!.value).toBe('gopay');
    expect(errorOf(host, 'method')).toBe('An active payment method already uses this name. Choose another name.');
    expect(document.activeElement).toBe(methodNameField(host));
    expect(methodNotice(host)).toBeNull();
    expect(h.count(M_CREATE)).toBe(1);
    expect(h.count(METHODS)).toBe(2);
    const holder = methodRow(host, 'GoPay').querySelector('td')!;
    expect(text(holder)).toBe('GoPayName in use');
    expect(holder.querySelectorAll('a, button')).toHaveLength(0);
    expect(text(methodRow(host, 'Bank transfer').querySelector('td'))).toBe('Bank transfer');

    // Editing the name takes the refusal and the marker away.
    typeIn(methodNameField(host)!, 'gopay 3');
    expect(text(methodRow(host, 'GoPay').querySelector('td'))).toBe('GoPay');
  });

  it('shows no marker when the reread shows no active method with that name', async () => {
    const host = await open(methodsView(BANK));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'gopay');
    h.reply(M_CREATE, DUPLICATE);
    h.reply(METHODS, methodsView(BANK));
    saveMethod(host);
    await h.settle();
    expect(errorOf(host, 'method')).not.toBeNull();
    expect(host.querySelectorAll('.table-holder')).toHaveLength(0);
  });

  it('never marks an inactive method as the holder', async () => {
    const host = await open(methodsView(BANK, { ...GOPAY, isActive: false }));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'gopay');
    h.reply(M_CREATE, DUPLICATE);
    saveMethod(host);
    await h.settle();
    expect(host.querySelectorAll('.table-holder')).toHaveLength(0);
  });

  it('on rename: the same, and the method being renamed is not its own holder', async () => {
    const host = await open(methodsView(BANK, GOPAY));
    tap(named(host, 'Edit Bank transfer — active'));
    typeIn(methodNameField(host)!, 'GOPAY');
    h.reply(M_UPDATE, DUPLICATE);
    saveMethod(host);
    await h.settle();
    expect(methodNameField(host)!.value).toBe('GOPAY');
    expect(errorOf(host, 'method')).toBe('An active payment method already uses this name. Choose another name.');
    expect(h.count(M_UPDATE)).toBe(1);
    expect(h.count(METHODS)).toBe(2);
    expect(text(methodRow(host, 'GoPay').querySelector('td'))).toBe('GoPayName in use');
    expect(text(methodRow(host, 'Bank transfer').querySelector('td'))).toBe('Bank transfer');
  });

  it('on reactivation: that method’s form opens with its own copy, the list is reread once, and the holder is marked', async () => {
    const holder = makeMethod(6, 'QRIS', true);
    const host = await open(methodsView(QRIS, holder));
    h.reply(M_REACTIVATE, DUPLICATE);
    tap(named(host, 'Reactivate qris'));
    await h.settle();
    expect(text(methodPanel(host)!.querySelector('#method-editor-title'))).toBe('Edit qris');
    expect(text(host.querySelector('#method-context'))).toBe('Inactive method. Saving its name does not reactivate it.');
    expect(methodNameField(host)!.value).toBe('qris');
    expect(errorOf(host, 'method')).toBe(
      'An active payment method already uses this name. Rename this inactive method, save, then reactivate it.'
    );
    expect(document.activeElement).toBe(methodNameField(host));
    expect(h.count(M_REACTIVATE)).toBe(1);
    expect(h.count(METHODS)).toBe(2);
    expect(text(methodRow(host, 'QRIS').querySelector('td'))).toBe('QRISName in use');
    expect(text(methodsStatus(host))).toBe('');
  });

  it('a corrected save after a DUPLICATE sends again, once, and an older reread does not undo it', async () => {
    const host = await open(methodsView(BANK, GOPAY));
    tap(named(host, 'Edit Bank transfer — active'));
    typeIn(methodNameField(host)!, 'gopay');
    h.reply(M_UPDATE, DUPLICATE);
    const reread = h.hold(METHODS);
    saveMethod(host);
    await h.settle();
    typeIn(methodNameField(host)!, 'Bank');
    h.reply(M_UPDATE, methodAnswer({ ...BANK, name: 'Bank' }));
    saveMethod(host);
    await h.settle();
    reread.deliver(methodsView(BANK, GOPAY));
    await h.settle();
    expect(methodRowNames(host)).toEqual(['Cash', 'Card', 'Bank', 'GoPay']);
    expect(h.count(M_UPDATE)).toBe(2);
  });
});

describe('AC 6. unknown outcomes: one reread, never a resend', () => {
  it.each([
    ['failed', failure],
    ['unavailable', 'reject' as const],
  ])('a create answered %s: the form keeps the draft with the refreshed-list notice, and the command count stays 1', async (_kind, reply) => {
    const host = await open(methodsView(BANK));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'Voucher');
    h.reply(M_CREATE, reply);
    saveMethod(host);
    await h.settle();
    expect(text(methodNotice(host))).toBe(
      'Outcome not confirmedThe outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again.'
    );
    expect(methodNotice(host)!.getAttribute('role')).toBe('status');
    expect(methodNameField(host)!.value).toBe('Voucher');
    expect(document.activeElement).toBe(methodNameField(host));
    expect(h.count(M_CREATE)).toBe(1);
    expect(h.count(METHODS)).toBe(2);
    expect(methodNameField(host)!.disabled).toBe(false);
  });

  it('with the reread failed too: the “could not be refreshed” notice, and Try again repeats the read only', async () => {
    const host = await open(methodsView(BANK));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'Voucher');
    h.reply(M_CREATE, failure);
    h.reply(METHODS, failure, methodsView(BANK));
    saveMethod(host);
    await h.settle();
    expect(text(methodNotice(host))).toBe(
      'Outcome not confirmedThe outcome could not be confirmed. The list could not be refreshed. Your draft is kept; nothing was sent again.'
    );
    expect(h.count(M_CREATE)).toBe(1);

    tap(named(host.querySelector<HTMLElement>('#methods-part')!, 'Try again'));
    await h.settle();
    expect(text(methodNotice(host))).toContain('The list has been refreshed.');
    expect(h.count(M_CREATE)).toBe(1);
    expect(h.count(METHODS)).toBe(3);
    expect(document.activeElement).toBe(methodNameField(host));
  });

  it('pressing Save after an unknown outcome is the manager’s own resend: it sends again', async () => {
    const host = await open(methodsView(BANK));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'Voucher');
    h.reply(M_CREATE, failure);
    saveMethod(host);
    await h.settle();
    h.reply(M_CREATE, methodAnswer(NEW));
    saveMethod(host);
    await h.settle();
    expect(h.count(M_CREATE)).toBe(2);
    expect(text(methodsStatus(host))).toBe('Voucher saved.');
  });

  it('a status command answered failed: the status says so, the list is reread once, and the row action reflects the reread', async () => {
    const host = await open();
    h.reply(M_DEACTIVATE, failure);
    h.reply(METHODS, methodsView(QRIS, BANK, { ...GOPAY2, isActive: false }, GOPAY10));
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    expect(text(methodsStatus(host))).toBe(
      'GoPay 2: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.'
    );
    expect(document.activeElement).toBe(methodsStatus(host));
    expect(h.count(M_DEACTIVATE)).toBe(1);
    expect(h.count(METHODS)).toBe(2);
    // The reread shows it inactive: the row offers Reactivate. Nothing was inferred from it.
    expect(named(host, 'Reactivate GoPay 2')).toBeTruthy();
    expect(named(host, 'New payment method').hasAttribute('aria-disabled')).toBe(false);
  });

  it('and with the reread failed too: “The list could not be refreshed.”', async () => {
    const host = await open();
    h.reply(M_REACTIVATE, 'reject');
    h.reply(METHODS, failure);
    tap(named(host, 'Reactivate qris'));
    await h.settle();
    expect(text(methodsStatus(host))).toBe(
      'qris: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.'
    );
    expect(h.count(M_REACTIVATE)).toBe(1);
  });

  it('the definite general failure of a save keeps the draft and sends nothing again', async () => {
    const host = await open(methodsView(BANK));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'Voucher');
    h.reply(M_CREATE, INVALID);
    saveMethod(host);
    await h.settle();
    expect(text(methodNotice(host))).toBe('Something went wrongNothing was saved. Your draft is kept. Press Save to try again.');
    expect(methodNotice(host)!.getAttribute('role')).toBe('alert');
    expect(methodNameField(host)!.value).toBe('Voucher');
    expect(document.activeElement).toBe(methodNameField(host));
    expect(h.count(M_CREATE)).toBe(1);
    expect(h.count(METHODS)).toBe(1);
  });

  it('the definite general failure of a status command says it was not changed', async () => {
    const host = await open();
    h.reply(M_DEACTIVATE, INVALID);
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    expect(text(methodsStatus(host))).toBe('Something went wrong. GoPay 2 was not changed. Use its row action to try again.');
    expect(document.activeElement).toBe(methodsStatus(host));
    expect(named(host, 'Deactivate GoPay 2')).toBeTruthy();
  });

  it.each([
    ['update', M_UPDATE],
    ['deactivate', M_DEACTIVATE],
    ['reactivate', M_REACTIVATE],
  ])('NOT_FOUND on %s is the general failure, with the list reread once (unreachable in Phase 1)', async (op, route) => {
    const host = await open();
    h.reply(route, NOT_FOUND);
    if (op === 'update') {
      tap(named(host, 'Edit Bank transfer — active'));
      typeIn(methodNameField(host)!, 'Bank');
      saveMethod(host);
    } else {
      tap(named(host, op === 'deactivate' ? 'Deactivate GoPay 2' : 'Reactivate qris'));
    }
    await h.settle();
    const shown = op === 'update' ? methodNotice(host) : methodsStatus(host);
    expect(text(shown)).toContain('Something went wrong');
    expect(h.count(route)).toBe(1);
    expect(h.count(METHODS)).toBe(2);
  });
});

describe('AC 8. a success while the list read stands failed (F4)', () => {
  /** A revisit whose read is out, and a deactivate that answers meanwhile. */
  async function partialState() {
    const host = await open(undefined, undefined, '/back-office/');
    tap(named(rail(host), 'Settings'));
    await h.settle();
    back();
    const visit = h.hold(METHODS);
    tap(named(rail(host), 'Settings'));
    await h.settle();
    h.reply(M_DEACTIVATE, methodAnswer({ ...GOPAY2, isActive: false }));
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    expect(text(methodsStatus(host))).toBe('GoPay 2 deactivated. It is kept for history.');
    const focused = document.activeElement;
    visit.deliver(failure);
    await h.settle();
    return { host, focused };
  }

  it('keeps the known rows with the answered record, announces it, focuses its Edit, keeps New live, and withholds the count', async () => {
    const { host, focused } = await partialState();
    expect(methodRowNames(host)).toEqual(['Cash', 'Card', 'Bank transfer', 'GoPay 10', 'GoPay 2', 'qris']);
    expect(named(host, 'Edit GoPay 2 — inactive')).toBeTruthy();
    expect(text(methodsStatus(host))).toBe('GoPay 2 deactivated. It is kept for history.');
    expect(document.activeElement).toBe(focused);
    expect(document.activeElement).toBe(named(host, 'Edit GoPay 2 — inactive'));
    expect(text(host.querySelector('#methods-read [role="alert"]'))).toBe(
      'The list may be out of datePayment methods could not be read again. The rows below are the ones this page knows, including your latest change. Try again to read the full list.Try again'
    );
    expect(host.querySelector('#method-count')).toBeNull();
    expect(named(host, 'New payment method').hasAttribute('aria-disabled')).toBe(false);
  });

  it('Try again reads only, replaces the rows and brings the count back', async () => {
    const { host } = await partialState();
    h.reply(METHODS, methodsView(QRIS, BANK, { ...GOPAY2, isActive: false }, GOPAY10));
    tap(named(host.querySelector<HTMLElement>('#methods-part')!, 'Try again'));
    await h.settle();
    expect(host.querySelector('#methods-read')).toBeNull();
    expect(count(host)).toBe('2 active · 2 inactive custom methods');
    expect(h.count(M_DEACTIVATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });

  it('a failed read with no answered record is the plain read failure, not the partial state', async () => {
    const host = await open(undefined, undefined, '/back-office/');
    tap(named(rail(host), 'Settings'));
    await h.settle();
    back();
    h.reply(METHODS, failure);
    tap(named(rail(host), 'Settings'));
    await h.settle();
    expect(text(host.querySelector('#methods-read [role="alert"]'))).toBe(
      'Payment methods could not be loadedTry again to read the payment methods.Try again'
    );
    expect(host.querySelector('#methods-list')).toBeNull();
  });

  it('a save that succeeds after an unknown outcome whose reread failed is shown the same way', async () => {
    const host = await open(methodsView(BANK));
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'Voucher');
    h.reply(M_CREATE, failure, methodAnswer(NEW));
    h.reply(METHODS, failure);
    saveMethod(host);
    await h.settle();
    expect(host.querySelector('#methods-list')).toBeNull();
    saveMethod(host);
    await h.settle();
    expect(methodRowNames(host)).toEqual(['Cash', 'Card', 'Bank transfer', 'Voucher']);
    expect(document.activeElement).toBe(named(host, 'Edit Voucher — active'));
    expect(text(host.querySelector('#methods-read [role="alert"]'))).toContain('The list may be out of date');
    expect(named(host, 'New payment method').hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('AC 4 and 9. a read that began before an answer never undoes it', () => {
  it('a held visit read arriving after a create keeps the created record', async () => {
    const host = await open(undefined, undefined, '/back-office/');
    tap(named(rail(host), 'Settings'));
    await h.settle();
    back();
    const visit = h.hold(METHODS);
    tap(named(rail(host), 'Settings'));
    await h.settle();
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'Voucher');
    h.reply(M_CREATE, methodAnswer(NEW));
    saveMethod(host);
    await h.settle();
    visit.deliver(methodsView(QRIS, BANK, GOPAY2, GOPAY10));
    await h.settle();
    expect(methodRowNames(host)).toContain('Voucher');
  });
});

describe('the settings part is untouched by the methods part', () => {
  it('shows the settings read view and its seven Change actions beside the methods', async () => {
    const host = await open();
    expect(host.querySelectorAll('[data-change]')).toHaveLength(7);
    expect(text(host.querySelector('#settings-title'))).toBe('Rates and receipt details');
    expect(text(host.querySelector('#methods-title'))).toBe('Payment methods');
    // The methods part is a second section below the settings part, under the one page heading.
    const sections = [...host.querySelectorAll('h1, #settings-title, #methods-title')].map((el) => el.textContent);
    expect(sections).toEqual(['Settings', 'Rates and receipt details', 'Payment methods']);
    expect(settingsView(V4)).toBeTruthy();
  });
});
