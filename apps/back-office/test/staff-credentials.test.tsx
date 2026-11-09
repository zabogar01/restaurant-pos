// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, text } from './session-harness.js';
import {
  MARKER_PASSWORD, MARKER_PIN, MARKER_USERNAME, SARI, U_CREATE, U_REACTIVATE, bodyOf, byId, cashierDraft, choose,
  classificationField, duplicate, endSession, general, goIdle, harness, managerDraft, nameField, named, openStaff,
  passwordField, pinField, resume, signInAgain, staffAnswer, tap, typeInto, unknown, usernameField, person,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-06's credential fields (PHASE1-S8c1 ruling 5, DESIGN-023 "Rules for S8c", ADR-011 rule 25,
// B-11 and B-12): every one is a native, uncontrolled input with no `value` attribute in any
// state, read once at submit, emptied after every response and whenever the session leaves the
// frame, and a typed marker is in exactly one request body and nowhere else. jsdom has no
// browser storage prompt; the console, the storage areas and the DOM are what can be read here.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;
const spies: Array<ReturnType<typeof vi.spyOn>> = [];
const writes: string[] = [];

beforeEach(() => {
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) spies.push(vi.spyOn(console, method));
  // Either storage area is watched at its only way in: a write is recorded, never read back.
  writes.length = 0;
  spies.push(
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      writes.push(`${key}=${value}`);
    })
  );
});

afterEach(() => {
  view?.unmount();
  view = undefined;
  for (const spy of spies.splice(0)) spy.mockRestore();
});

const focused = () => document.activeElement;
const markers = [MARKER_PIN, MARKER_USERNAME, MARKER_PASSWORD];

const open = async () => {
  h = harness();
  view = await openStaff(h);
  return view.host;
};

const inputs = (host: HTMLElement) =>
  [pinField(host), usernameField(host), passwordField(host)].filter((i): i is HTMLInputElement => i !== null);

/**
 * Nothing typed is in an attribute, a text node, either storage area or the console. The one
 * exception is a saved manager's username, which is public identity (`UserView.username`) and is
 * drawn on that person's row once the server has answered it (`published`); even then it is in no
 * attribute, in no storage and in no log line.
 */
function nowhere(published: string[] = []) {
  const html = document.documentElement.outerHTML;
  const logged = spies.flatMap((spy) => spy.mock.calls.map((args: unknown[]) => JSON.stringify(args))).join('\n');
  const stored = writes.join('\n');
  const attributes = [...document.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.value)).join('\n');
  for (const marker of markers) {
    expect(logged, 'the console').not.toContain(marker);
    expect(stored, 'storage').not.toContain(marker);
    expect(attributes, 'an attribute').not.toContain(marker);
    if (published.includes(marker)) continue;
    expect(html, 'the DOM').not.toContain(marker);
    expect(document.documentElement.textContent ?? '', 'the text').not.toContain(marker);
  }
}

describe('AC 5. the credential fields are native and uncontrolled', () => {
  it('declares the types and hints of DESIGN-023: password inputs for a PIN and a password, a text input for a username', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'MANAGER');
    const pin = pinField(host)!;
    const username = usernameField(host)!;
    const password = passwordField(host)!;
    expect(pin.type).toBe('password');
    expect(pin.getAttribute('autocomplete')).toBe('new-password');
    expect(pin.getAttribute('inputmode')).toBe('numeric');
    expect(password.type).toBe('password');
    expect(password.getAttribute('autocomplete')).toBe('new-password');
    expect(username.type).toBe('text');
    expect(username.getAttribute('autocomplete')).toBe('username');
    expect(username.getAttribute('autocapitalize')).toBe('none');
    expect(username.getAttribute('spellcheck')).toBe('false');
    for (const input of [pin, username, password]) {
      expect(input.hasAttribute('maxlength')).toBe(false);
    }
    // Every form declares POST and prevents native submission.
    const form = host.querySelector('form')!;
    expect(form.getAttribute('method')).toBe('post');
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it('has no value attribute in any state: resting, typed, refused locally, answered, and after a switch', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'MANAGER');
    // Every credential input; the name is the one controlled field of the form, and not a secret.
    const noValue = () => {
      for (const input of inputs(host)) expect(input.hasAttribute('value'), input.id).toBe(false);
    };
    noValue();
    typeInto(nameField(host)!, 'Nadia');
    typeInto(pinField(host)!, MARKER_PIN);
    typeInto(usernameField(host)!, ' Nadia.P ');
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    noValue();
    usernameField(host)!.dispatchEvent(new FocusEvent('blur'));
    // A local refusal keeps what was typed.
    typeInto(pinField(host)!, '12');
    tap(named(host, 'Save'));
    noValue();
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_CREATE, duplicate('pin'));
    tap(named(host, 'Save'));
    await h.settle();
    noValue();
    choose(classificationField(host)!, 'CASHIER');
    noValue();
  });

  it('is emptied after a success', async () => {
    const host = await open();
    h.reply(U_CREATE, staffAnswer(person(8, 'Dewi Lestari', 'CASHIER')));
    cashierDraft(host);
    tap(named(host, 'Save'));
    await h.settle();
    // The form closed; the next one opens empty.
    expect(host.querySelector('#staff-pin')).toBeNull();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'CASHIER');
    expect(pinField(host)!.value).toBe('');
  });

  it.each([
    ['DUPLICATE', duplicate('pin')],
    ['a general failure', general],
    ['an unknown outcome', unknown],
  ] as const)('is emptied after %s, the name and the classification are kept, and the notice says so', async (_name, reply) => {
    const host = await open();
    h.reply(U_CREATE, reply);
    managerDraft(host);
    tap(named(host, 'Save'));
    await h.settle();
    for (const input of inputs(host)) expect(input.value, input.id).toBe('');
    expect(nameField(host)!.value).toBe('Nadia Pratiwi');
    expect(classificationField(host)!.value).toBe('MANAGER');
    expect(text(byId(host, '#credentials-cleared'))).toBe(
      'Enter the credentials again. The name and classification choices are kept.'
    );
    nowhere();
  });

  it('is emptied by a classification switch, even for a field the new choice also needs', async () => {
    const host = await open();
    managerDraft(host);
    choose(classificationField(host)!, 'CASHIER');
    expect(pinField(host)!.value).toBe('');
    choose(classificationField(host)!, 'MANAGER');
    for (const input of inputs(host)) expect(input.value, input.id).toBe('');
  });

  it('is emptied by Cancel with a discard: the next form opens empty', async () => {
    const host = await open();
    cashierDraft(host);
    tap(named(host, 'Cancel'));
    tap(named(document.querySelector<HTMLElement>('dialog[open]')!, 'Discard'));
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'CASHIER');
    expect(pinField(host)!.value).toBe('');
    expect(nameField(host)!.value).toBe('');
  });

  it('is emptied when the session goes to M-6, and again before the same manager’s draft is restored', async () => {
    const host = await open();
    managerDraft(host);
    await goIdle(h, host);
    for (const input of inputs(host)) expect(input.value, input.id).toBe('');
    await resume(h, host);
    for (const input of inputs(host)) expect(input.value, input.id).toBe('');
    expect(nameField(host)!.value).toBe('Nadia Pratiwi');
    expect(classificationField(host)!.value).toBe('MANAGER');
    expect(text(byId(host, '#credentials-cleared'))).toContain('Enter the credentials again.');
    expect(focused()).toBe(nameField(host));
    expect(h.count(U_CREATE)).toBe(0);
  });

  it('is emptied at BO-01, and the same manager’s draft returns with its name and classification and a notice', async () => {
    const host = await open();
    managerDraft(host);
    await endSession(h, host);
    for (const input of inputs(host)) expect(input.value, input.id).toBe('');
    await signInAgain(h, host);
    for (const input of inputs(host)) expect(input.value, input.id).toBe('');
    expect(nameField(host)!.value).toBe('Nadia Pratiwi');
    expect(classificationField(host)!.value).toBe('MANAGER');
    expect(text(byId(host, '#credentials-cleared'))).toContain('Enter the credentials again.');
    expect(focused()).toBe(nameField(host));
    expect(h.count(U_CREATE)).toBe(0);
  });

  it('a typed marker PIN, username and password are in exactly one request body, and nowhere else', async () => {
    const host = await open();
    h.reply(U_CREATE, staffAnswer(person(8, 'Nadia Pratiwi', 'MANAGER', true, MARKER_USERNAME)));
    managerDraft(host);
    nowhere();
    tap(named(host, 'Save'));
    await h.settle();
    const bodies = h.calls.filter((c) => c.body !== undefined);
    for (const marker of markers) {
      expect(bodies.filter((c) => c.body!.includes(marker)).map((c) => `${c.method} ${c.url}`)).toEqual([`POST ${'/api/back-office/config/users/create'}`]);
    }
    expect(bodyOf(h, U_CREATE)).toMatchObject({ pin: MARKER_PIN, username: MARKER_USERNAME, password: MARKER_PASSWORD });
    // The username is public identity and is shown on the saved row, once; the PIN and the
    // password are in no text node and no attribute.
    nowhere([MARKER_USERNAME]);
    expect(document.documentElement.textContent!.split(MARKER_USERNAME)).toHaveLength(2);
  });

  it('a reactivation’s new PIN is in exactly one body, and the field is empty after a refusal', async () => {
    const host = await open();
    h.reply(U_REACTIVATE, duplicate('pin'));
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_REACTIVATE, duplicate('pin'));
    tap(named(host, 'Reactivate with new PIN'));
    await h.settle();
    expect(pinField(host)!.value).toBe('');
    expect(h.keyed(U_REACTIVATE).filter((c) => c.body!.includes(MARKER_PIN))).toHaveLength(1);
    expect(bodyOf(h, U_REACTIVATE, 1)).toEqual({ staffUserId: SARI.staffUserId, pin: MARKER_PIN });
    nowhere();
  });

  it('a refusal of the form’s own check is not a response: the typed text stays for correction', async () => {
    const host = await open();
    managerDraft(host);
    typeInto(pinField(host)!, '12345');
    tap(named(host, 'Save'));
    expect(pinField(host)!.value).toBe('12345');
    expect(usernameField(host)!.value).toBe(MARKER_USERNAME);
    expect(passwordField(host)!.value).toBe(MARKER_PASSWORD);
  });
});
