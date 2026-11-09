// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { pressEscape } from './dialog-shim.js';
import { mount, text } from './session-harness.js';
import { dialogNamed } from './tables-support.js';
import {
  ANA, AYU, HALIM, IQBAL, MARKER_PASSWORD, MARKER_PIN, MARKER_USERNAME, PEOPLE, PUTRA, READ, SARI, U_CREATE,
  U_DEACTIVATE, U_REACTIVATE, WIBOWO, aria, bodyOf, byId, cashierDraft, choose, classificationField, duplicate, facts,
  formNotice, general, harness, managerDraft, nameField, named, notFound, openStaff, openStaffHeld, ownAccount, pageStatus,
  panel, panelName, passwordField, person, pinField, rail, reachPartial, rowNames, rowOf, rowText, staffAnswer, staffCalls,
  staffList, tap, typeInto, unknown, userChanged, usernameField,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-06 Staff, part 1 (PHASE1-S8c1): the rail and the route, the list and its order, the read
// states, the form's checks, create in all three classifications, `DUPLICATE`, deactivation and
// reactivation, the refusals and unknown outcomes, one form and one command, and the partial
// state. The credentials are in staff-credentials.test.tsx, the departure and the session in
// staff-departure.test.tsx. jsdom has no top layer and no inertness; what only a browser shows is
// e2e/tests/staff.spec.ts.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const focused = () => document.activeElement;

const open = async (first?: Parameters<typeof openStaff>[1], path?: string) => {
  h = harness(path);
  view = await openStaff(h, first);
  return view.host;
};

const confirmation = (name: string) => dialogNamed(`Deactivate ${name}?`);
const saveButton = (host: HTMLElement) => named(host, 'Save');

describe('AC 1. the rail and the route', () => {
  it('lists Menu, Tables, Staff, Discount presets, Settings, with their paths, and Staff is current at its address', async () => {
    const host = await open();
    expect(text(rail(host))).toBe('ConfigurationMenuTablesStaffDiscount presetsSettings');
    expect([...rail(host).querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/back-office/menu',
      '/back-office/tables',
      '/back-office/staff',
      '/back-office/presets',
      '/back-office/settings',
    ]);
    expect(named(rail(host), 'Staff').getAttribute('aria-current')).toBe('page');
    expect(host.querySelector('h1')!.textContent).toBe('Staff');
  });

  it('a press on Staff from another screen opens BO-06, marks it current and sends one read', async () => {
    const host = await open(undefined, '/back-office/tables');
    expect(host.querySelector('h1')!.textContent).toBe('Tables');
    expect(h.count(READ)).toBe(0);
    tap(named(rail(host), 'Staff'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/staff');
    expect(host.querySelector('h1')!.textContent).toBe('Staff');
    expect(named(rail(host), 'Staff').getAttribute('aria-current')).toBe('page');
    expect(h.count(READ)).toBe(1);
  });
});

describe('AC 2. order, grouping and rows', () => {
  it('draws the active people first and the inactive second, each in creation order, with the counts', async () => {
    const host = await open();
    expect(rowNames(host)).toEqual(['M. Iqbal', 'Ana R.', 'S. Halim', 'Ratna Ayu', 'D. Putra', 'R. Sari', 'B. Wibowo']);
    expect(text(facts(host))).toBe('5 active · 2 inactive');
    expect(text(host.querySelector('#staff-list caption'))).toBe('Active first · Oldest created first within each status');
    expect([...host.querySelectorAll('#staff-list th')].map((th) => th.textContent)).toEqual([
      'Person',
      'Classification',
      'Status',
      'Actions',
    ]);
  });

  // PHASE1-S8c2 changes this test by design: the own row now offers the two own changes, and every
  // other row its part-2 actions (staff-moves.test.tsx lists their names and order).
  it('the own row says You · Signed in and offers the two own changes; every other row offers its actions', async () => {
    const host = await open();
    const own = rowOf(host, IQBAL.staffUserId);
    expect(rowText(own)).toContain('You · Signed in');
    expect(own.querySelectorAll('button')).toHaveLength(2);
    const counts = new Map([[ANA, 3], [HALIM, 2], [AYU, 4], [PUTRA, 3], [SARI, 1], [WIBOWO, 1]]);
    for (const [other, buttons] of counts) {
      expect(rowOf(host, other.staffUserId).querySelectorAll('button')).toHaveLength(buttons);
    }
    expect(host.querySelector('[aria-label="Deactivate — M. Iqbal"]')).toBeNull();
  });

  it('a manager shows its username, a former manager its retained one, and a kitchen person Kitchen and No sign-in', async () => {
    const host = await open();
    expect(rowText(rowOf(host, AYU.staffUserId))).toContain('Username: r.ayu');
    expect(rowText(rowOf(host, IQBAL.staffUserId))).toContain('Username: m.iqbal');
    expect(rowText(rowOf(host, PUTRA.staffUserId))).toContain('Retained username: d.putra · No back-office access');
    expect(rowText(rowOf(host, PUTRA.staffUserId))).toContain('Cashier');
    const kitchen = rowText(rowOf(host, HALIM.staffUserId));
    expect(kitchen).toContain('Kitchen');
    expect(kitchen).toContain('No sign-in');
    expect(kitchen).not.toMatch(/PIN|Username/);
    expect(rowText(rowOf(host, ANA.staffUserId))).not.toMatch(/Username|Retained/);
  });

  it('deactivating a person moves them to the inactive group at the place their creation gives them', async () => {
    const host = await open();
    h.reply(U_DEACTIVATE, staffAnswer({ ...ANA, isActive: false }));
    tap(named(host, 'Deactivate — Ana R.'));
    tap(named(confirmation('Ana R.')!, 'Deactivate Ana R.'));
    await h.settle();
    expect(rowNames(host)).toEqual(['M. Iqbal', 'S. Halim', 'Ratna Ayu', 'D. Putra', 'Ana R.', 'R. Sari', 'B. Wibowo']);
    expect(text(facts(host))).toBe('4 active · 3 inactive');
  });

  it('the client never sorts by name', async () => {
    const host = await open(staffList([IQBAL, person(2, 'Zebra', 'CASHIER'), person(3, 'Apple', 'KITCHEN')]));
    expect(rowNames(host)).toEqual(['M. Iqbal', 'Zebra', 'Apple']);
  });
});

describe('AC 3. the read states', () => {
  it('Loading withholds the rows, the counts and the caption, and Add person is off', async () => {
    h = harness();
    const { view: v, held } = await openStaffHeld(h);
    view = v;
    const host = v.host;
    expect(text(host.querySelector('#read-state'))).toBe('Loading staff…');
    expect(host.querySelector('#staff-list')).toBeNull();
    expect(facts(host)).toBeNull();
    expect(aria(named(host, 'Add person'))).toBe(true);
    held.deliver(staffList());
    await h.settle();
    expect(facts(host)).not.toBeNull();
    expect(aria(named(host, 'Add person'))).toBe(false);
  });

  it('a failed read shows the alert and withholds the counts and the caption; Try again sends one read and nothing else', async () => {
    const host = await open(unknown);
    expect(text(host.querySelector('#read-state [role="alert"]'))).toBe(
      'Staff could not be loadedTry again to read the staff list.Try again'
    );
    expect(facts(host)).toBeNull();
    expect(host.querySelector('#staff-list')).toBeNull();
    expect(aria(named(host, 'Add person'))).toBe(true);
    h.reply(READ, staffList());
    tap(named(host, 'Try again'));
    await h.settle();
    expect(staffCalls(h)).toEqual([READ, READ]);
    expect(host.querySelector('#read-state')).toBeNull();
    expect(rowNames(host)).toHaveLength(7);
    expect(text(facts(host))).toBe('5 active · 2 inactive');
  });

  it('a read of the manager alone draws that one row and Add person', async () => {
    const host = await open(staffList([IQBAL]));
    expect(rowNames(host)).toEqual(['M. Iqbal']);
    expect(text(facts(host))).toBe('1 active · 0 inactive');
    expect(aria(named(host, 'Add person'))).toBe(false);
  });

  it('a read that answers no rows draws no row and a live Add person (unreachable: the actor is always listed)', async () => {
    const host = await open(staffList([]));
    expect(host.querySelector('#staff-list')).toBeNull();
    expect(text(facts(host))).toBe('0 active · 0 inactive');
    expect(aria(named(host, 'Add person'))).toBe(false);
  });
});

describe('AC 4. the form’s checks', () => {
  it('a new person opens on Kitchen · no sign-in with focus on Name and nothing but a name to give', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    expect(panelName(host)).toBe('Add person');
    expect(focused()).toBe(nameField(host));
    expect(classificationField(host)!.value).toBe('KITCHEN');
    expect([...classificationField(host)!.options].map((o) => o.textContent)).toEqual(['Kitchen · no sign-in', 'Cashier', 'Manager']);
    expect(pinField(host)).toBeNull();
    expect(usernameField(host)).toBeNull();
    expect(passwordField(host)).toBeNull();
  });

  it('refuses an empty name with its sentence, marks the field, describes it, focuses it, and sends nothing', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    tap(saveButton(host));
    await h.settle();
    expect(text(byId(host, '#staff-name-error'))).toBe('Enter a name.');
    expect(nameField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(nameField(host)!.getAttribute('aria-describedby')).toContain('staff-name-error');
    expect(focused()).toBe(nameField(host));
    expect(h.count(U_CREATE)).toBe(0);
  });

  it.each([
    ['a'.repeat(65), 'Use 64 characters or fewer.'],
    ['Na\tme', 'Remove control characters from the name.'],
    ['Name\u0007', 'Remove control characters from the name.'],
  ])('the name %j says %j', async (typed, sentence) => {
    const host = await open();
    tap(named(host, 'Add person'));
    typeInto(nameField(host)!, typed);
    tap(saveButton(host));
    await h.settle();
    expect(text(byId(host, '#staff-name-error'))).toBe(sentence);
    expect(h.count(U_CREATE)).toBe(0);
  });

  it('a name of 64 emoji is long enough and no more: it counts code points', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    typeInto(nameField(host)!, '😀'.repeat(64));
    h.reply(U_CREATE, staffAnswer(person(8, '😀'.repeat(64), 'KITCHEN')));
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_CREATE)).toBe(1);
    expect(bodyOf(h, U_CREATE)).toEqual({ classification: 'KITCHEN', name: '😀'.repeat(64) });
  });

  it('refuses every invalid field of a manager at once, in displayed order, and focuses the first', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'MANAGER');
    typeInto(nameField(host)!, 'Nadia');
    typeInto(pinField(host)!, '12345');
    typeInto(usernameField(host)!, '.bad');
    typeInto(passwordField(host)!, 'short');
    tap(saveButton(host));
    await h.settle();
    expect(text(byId(host, '#staff-pin-error'))).toBe('Enter exactly six digits, 0–9.');
    expect(text(byId(host, '#staff-username-error'))).toBe(
      'Use 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit.'
    );
    expect(text(byId(host, '#staff-password-error'))).toBe('Use 8–128 characters. Spaces count.');
    for (const field of [pinField(host)!, usernameField(host)!, passwordField(host)!]) {
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field.getAttribute('aria-describedby')).toContain(`${field.id}-error`);
    }
    expect(focused()).toBe(pinField(host));
    expect(h.count(U_CREATE)).toBe(0);
  });

  it('a local refusal is not a response: the native inputs keep their text for correction', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'MANAGER');
    typeInto(nameField(host)!, 'Nadia');
    typeInto(pinField(host)!, '12345');
    typeInto(usernameField(host)!, 'ok.name');
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    tap(saveButton(host));
    await h.settle();
    expect(pinField(host)!.value).toBe('12345');
    expect(usernameField(host)!.value).toBe('ok.name');
    expect(passwordField(host)!.value).toBe(MARKER_PASSWORD);
  });

  it('editing a field removes its obsolete error and its aria-describedby reference', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    tap(saveButton(host));
    typeInto(nameField(host)!, 'Nadia');
    expect(byId(host, '#staff-name-error')).toBeNull();
    expect(nameField(host)!.getAttribute('aria-describedby')).toBe('staff-name-help');
    expect(nameField(host)!.hasAttribute('aria-invalid')).toBe(false);
  });

  it('sends the trimmed name and the stored username, and the field shows the stored form', async () => {
    const host = await open();
    h.reply(U_CREATE, staffAnswer(person(8, 'Nadia Pratiwi', 'MANAGER', true, 'abc.def')));
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'MANAGER');
    typeInto(nameField(host)!, '  Nadia Pratiwi  ');
    typeInto(pinField(host)!, MARKER_PIN);
    typeInto(usernameField(host)!, '  ABC.def ');
    typeInto(passwordField(host)!, '  spaced password  ');
    tap(saveButton(host));
    expect(usernameField(host)!.value).toBe('abc.def');
    await h.settle();
    expect(bodyOf(h, U_CREATE)).toEqual({
      classification: 'MANAGER',
      name: 'Nadia Pratiwi',
      pin: MARKER_PIN,
      username: 'abc.def',
      password: '  spaced password  ',
    });
  });

  it('the username shows the stored form on blur, set through the property and never an attribute', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'MANAGER');
    typeInto(usernameField(host)!, ' Ana.R ');
    usernameField(host)!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    usernameField(host)!.dispatchEvent(new FocusEvent('blur'));
    expect(usernameField(host)!.value).toBe('ana.r');
    expect(usernameField(host)!.hasAttribute('value')).toBe(false);
  });
});

describe('AC 6. create', () => {
  it('a kitchen person sends exactly { classification, name }, appends to the active group, announces and focuses Change role', async () => {
    const host = await open();
    const made = person(8, 'Nadia Pratiwi', 'KITCHEN');
    h.reply(U_CREATE, staffAnswer(made));
    tap(named(host, 'Add person'));
    typeInto(nameField(host)!, '  Nadia Pratiwi ');
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_CREATE)).toBe(1);
    expect(bodyOf(h, U_CREATE)).toEqual({ classification: 'KITCHEN', name: 'Nadia Pratiwi' });
    // Appended to the end of the active group, ahead of the inactive people.
    expect(rowNames(host)).toEqual(['M. Iqbal', 'Ana R.', 'S. Halim', 'Ratna Ayu', 'D. Putra', 'Nadia Pratiwi', 'R. Sari', 'B. Wibowo']);
    expect(text(pageStatus(host))).toBe('Nadia Pratiwi added.');
    expect(pageStatus(host)!.getAttribute('role')).toBe('status');
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Change role — Nadia Pratiwi'));
    expect(h.count(READ)).toBe(1);
  });

  it('a cashier sends { classification, name, pin }', async () => {
    const host = await open();
    h.reply(U_CREATE, staffAnswer(person(8, 'Dewi Lestari', 'CASHIER')));
    cashierDraft(host);
    tap(saveButton(host));
    await h.settle();
    expect(bodyOf(h, U_CREATE)).toEqual({ classification: 'CASHIER', name: 'Dewi Lestari', pin: MARKER_PIN });
    expect(text(pageStatus(host))).toBe('Dewi Lestari added.');
  });

  it('a manager sends { classification, name, pin, username, password } and its row shows the username', async () => {
    const host = await open();
    h.reply(U_CREATE, staffAnswer(person(8, 'Nadia Pratiwi', 'MANAGER', true, MARKER_USERNAME)));
    managerDraft(host);
    tap(saveButton(host));
    await h.settle();
    expect(bodyOf(h, U_CREATE)).toEqual({
      classification: 'MANAGER',
      name: 'Nadia Pratiwi',
      pin: MARKER_PIN,
      username: MARKER_USERNAME,
      password: MARKER_PASSWORD,
    });
    expect(rowText(rowOf(host, person(8, '', 'MANAGER').staffUserId))).toContain(`Username: ${MARKER_USERNAME}`);
  });

  it('a classification switch keeps the name, empties the credentials, shows the notice and focuses the first credential', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    typeInto(nameField(host)!, 'Nadia');
    expect(byId(host, '#credentials-cleared')).toBeNull();
    choose(classificationField(host)!, 'CASHIER');
    expect(focused()).toBe(pinField(host));
    // A previous choice (Kitchen) was replaced: the notice says what was kept.
    expect(byId(host, '#credentials-cleared')).not.toBeNull();
    typeInto(pinField(host)!, MARKER_PIN);
    expect(byId(host, '#credentials-cleared')).toBeNull();
    choose(classificationField(host)!, 'MANAGER');
    expect(nameField(host)!.value).toBe('Nadia');
    expect(pinField(host)!.value).toBe('');
    expect(text(byId(host, '#credentials-cleared'))).toBe(
      'Enter the credentials again. The name and classification choices are kept.'
    );
    expect(focused()).toBe(pinField(host));
    choose(classificationField(host)!, 'KITCHEN');
    expect(focused()).toBe(classificationField(host));
    choose(classificationField(host)!, 'CASHIER');
    expect(pinField(host)!.value).toBe('');
    expect(nameField(host)!.value).toBe('Nadia');
  });

  it('a classification switch clears the errors of the credentials and keeps the name’s', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'CASHIER');
    tap(saveButton(host));
    expect(byId(host, '#staff-name-error')).not.toBeNull();
    expect(byId(host, '#staff-pin-error')).not.toBeNull();
    choose(classificationField(host)!, 'MANAGER');
    expect(byId(host, '#staff-name-error')).not.toBeNull();
    expect(byId(host, '#staff-pin-error')).toBeNull();
  });
});

describe('AC 7. DUPLICATE is placed by details.field and nothing else', () => {
  it('{ field: pin } marks New PIN only, with its sentence and focus, one request, no reread, and the field empty', async () => {
    const host = await open();
    h.reply(U_CREATE, duplicate('pin'));
    managerDraft(host);
    tap(saveButton(host));
    await h.settle();
    expect(text(byId(host, '#staff-pin-error'))).toBe('That PIN is already in use. Choose a different PIN.');
    expect(pinField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(usernameField(host)!.hasAttribute('aria-invalid')).toBe(false);
    expect(byId(host, '#staff-username-error')).toBeNull();
    expect(focused()).toBe(pinField(host));
    expect(pinField(host)!.value).toBe('');
    expect(usernameField(host)!.value).toBe('');
    expect(h.count(U_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(1);
    // No holder is named anywhere on the screen.
    expect(text(host)).not.toMatch(/already used by|held by|belongs to/i);
  });

  it('{ field: username } marks Username only, with its sentence and focus', async () => {
    const host = await open();
    h.reply(U_CREATE, duplicate('username'));
    managerDraft(host);
    tap(saveButton(host));
    await h.settle();
    expect(text(byId(host, '#staff-username-error'))).toBe('That username is already in use. Choose another username.');
    expect(usernameField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(pinField(host)!.hasAttribute('aria-invalid')).toBe(false);
    expect(byId(host, '#staff-pin-error')).toBeNull();
    expect(focused()).toBe(usernameField(host));
    expect(h.count(U_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(1);
  });

  it('a DUPLICATE without details is the general definite failure, placed on no field', async () => {
    const host = await open();
    h.reply(U_CREATE, duplicate());
    cashierDraft(host);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'Something went wrongNothing was saved. Your draft is kept. Enter credentials again, then press Save to try again.'
    );
    expect(byId(host, '#staff-pin-error')).toBeNull();
  });
});

describe('AC 8. deactivation', () => {
  it.each([
    [ANA, 'Ana R.’s POS sessions will end on their next action. They cannot sign in while inactive. You can reactivate this person later.'],
    [AYU, 'Ratna Ayu’s POS and back-office sessions will end on their next action. They cannot sign in while inactive. You can reactivate this person later.'],
    [PUTRA, 'D. Putra’s POS sessions will end on their next action. They cannot sign in while inactive. You can reactivate this person later.'],
    [HALIM, 'S. Halim will be inactive. Kitchen staff have no PIN or sign-in sessions. You can reactivate this person later.'],
  ])('the confirmation for %j says, in that person’s terms: %j', async (who, warning) => {
    const host = await open();
    tap(named(host, `Deactivate — ${who.name}`));
    const dialog = confirmation(who.name)!;
    expect(dialog).not.toBeNull();
    expect(text(dialog.querySelector('#deactivate-copy'))).toBe(warning);
    expect(focused()).toBe(dialog.querySelector('#keep-active'));
    expect(h.count(U_DEACTIVATE)).toBe(0);
  });

  it('Escape and Keep active send nothing and return focus to that row’s Deactivate', async () => {
    const host = await open();
    tap(named(host, 'Deactivate — Ana R.'));
    pressEscape(document.activeElement!);
    expect(confirmation('Ana R.')).toBeNull();
    expect(focused()).toBe(named(host, 'Deactivate — Ana R.'));
    tap(named(host, 'Deactivate — Ratna Ayu'));
    tap(named(confirmation('Ratna Ayu')!, 'Keep active — Ratna Ayu'));
    expect(focused()).toBe(named(host, 'Deactivate — Ratna Ayu'));
    expect(h.count(U_DEACTIVATE)).toBe(0);
  });

  it('Deactivate sends one { staffUserId }, moves the row, announces it and focuses its Reactivate', async () => {
    const host = await open();
    h.reply(U_DEACTIVATE, staffAnswer({ ...ANA, isActive: false }));
    tap(named(host, 'Deactivate — Ana R.'));
    tap(named(confirmation('Ana R.')!, 'Deactivate Ana R.'));
    expect(text(pageStatus(host))).toBe('Deactivating Ana R.…');
    await h.settle();
    expect(h.count(U_DEACTIVATE)).toBe(1);
    expect(bodyOf(h, U_DEACTIVATE)).toEqual({ staffUserId: ANA.staffUserId });
    expect(text(pageStatus(host))).toBe('Ana R. deactivated.');
    expect(focused()).toBe(named(host, 'Reactivate — Ana R.'));
    expect(h.count(READ)).toBe(1);
  });
});

describe('AC 9. reactivation', () => {
  it('a plain reactivation sends one { staffUserId } with no dialog, moves the row and focuses its Change role', async () => {
    const host = await open();
    h.reply(U_REACTIVATE, staffAnswer({ ...SARI, isActive: true }));
    tap(named(host, 'Reactivate — R. Sari'));
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(text(pageStatus(host))).toBe('Reactivating R. Sari…');
    await h.settle();
    expect(h.count(U_REACTIVATE)).toBe(1);
    expect(bodyOf(h, U_REACTIVATE)).toEqual({ staffUserId: SARI.staffUserId });
    expect(text(pageStatus(host))).toBe('R. Sari reactivated.');
    expect(rowNames(host)).toEqual(['M. Iqbal', 'Ana R.', 'S. Halim', 'Ratna Ayu', 'D. Putra', 'R. Sari', 'B. Wibowo']);
    expect(text(facts(host))).toBe('6 active · 1 inactive');
    expect(focused()).toBe(named(host, 'Change role — R. Sari'));
  });

  async function conflict() {
    const host = await open();
    h.reply(U_REACTIVATE, duplicate('pin'));
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    return host;
  }

  it('a DUPLICATE { field: pin } opens the named form with an empty, focused New PIN and its sentence', async () => {
    const host = await conflict();
    expect(panelName(host)).toBe('Reactivate — R. Sari');
    expect(text(byId(host, '#form-context'))).toBe('Set a new PIN to reactivate R. Sari.');
    expect(text(byId(host, '#staff-pin-error'))).toBe('That PIN is already in use. Enter a new PIN to reactivate this person.');
    expect(pinField(host)!.value).toBe('');
    expect(focused()).toBe(pinField(host));
    expect(named(host, 'Reactivate with new PIN')).not.toBeNull();
    expect(nameField(host)).toBeNull();
    expect(h.count(U_REACTIVATE)).toBe(1);
    expect(pageStatus(host)).toBeNull();
  });

  it('its commit sends { staffUserId, pin } once, and success moves the row, announces it and focuses its Change role', async () => {
    const host = await conflict();
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_REACTIVATE, staffAnswer({ ...SARI, isActive: true }));
    tap(named(host, 'Reactivate with new PIN'));
    await h.settle();
    expect(h.count(U_REACTIVATE)).toBe(2);
    expect(bodyOf(h, U_REACTIVATE, 1)).toEqual({ staffUserId: SARI.staffUserId, pin: MARKER_PIN });
    expect(text(pageStatus(host))).toBe('R. Sari reactivated.');
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Change role — R. Sari'));
  });

  it('a second DUPLICATE shows the same error on the empty field', async () => {
    const host = await conflict();
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_REACTIVATE, duplicate('pin'));
    tap(named(host, 'Reactivate with new PIN'));
    await h.settle();
    expect(text(byId(host, '#staff-pin-error'))).toBe('That PIN is already in use. Enter a new PIN to reactivate this person.');
    expect(pinField(host)!.value).toBe('');
    expect(focused()).toBe(pinField(host));
    expect(h.count(U_REACTIVATE)).toBe(2);
  });

  it('nothing is ever resent automatically after the conflict', async () => {
    await conflict();
    await h.advance(60_000);
    expect(h.count(U_REACTIVATE)).toBe(1);
  });

  it('a kitchen person never reaches the form: a DUPLICATE on them is the status failure', async () => {
    const host = await open();
    h.reply(U_REACTIVATE, duplicate('pin'));
    tap(named(host, 'Reactivate — B. Wibowo'));
    await h.settle();
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Something went wrong. B. Wibowo was not changed. Use its row action to try again.');
  });

  it('the reactivation form’s PIN is checked locally first and sends nothing while invalid', async () => {
    const host = await conflict();
    typeInto(pinField(host)!, '123');
    tap(named(host, 'Reactivate with new PIN'));
    expect(text(byId(host, '#staff-pin-error'))).toBe('Enter exactly six digits, 0–9.');
    expect(h.count(U_REACTIVATE)).toBe(1);
  });
});

describe('AC 10. refusals and unknown outcomes', () => {
  async function conflictForm() {
    const host = await open();
    h.reply(U_REACTIVATE, duplicate('pin'));
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    typeInto(pinField(host)!, MARKER_PIN);
    return host;
  }

  it('OWN_ACCOUNT on the reactivation form is a focused alert with Save off and Return to staff list, and no reread', async () => {
    const host = await conflictForm();
    h.reply(U_REACTIVATE, ownAccount);
    tap(named(host, 'Reactivate with new PIN'));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'This action cannot change your own accountUse Change my password or Change my PIN on your own row. You cannot deactivate yourself or change your own role.'
    );
    expect(formNotice(host)!.getAttribute('role')).toBe('alert');
    expect(focused()).toBe(formNotice(host));
    expect(aria(named(host, 'Reactivate with new PIN'))).toBe(true);
    expect(text(byId(host, '#save-hint'))).toBe('Return to the staff list and choose an action on the current person.');
    expect(h.count(READ)).toBe(1);
    tap(named(host, 'Return to staff list'));
    expect(panel(host)).toBeNull();
  });

  it.each([
    ['USER_CHANGED', userChanged, 'R. Sari changed while you were editing', 'Nothing was saved. The staff list has been refreshed. Your choices are kept and credentials are empty. Return to the staff list and choose an action on the current person.'],
    ['NOT_FOUND', notFound, 'R. Sari could not be found', 'Nothing was saved. The staff list has been refreshed. Return to the staff list to choose another person.'],
  ] as const)('%s on the reactivation form rereads once and blocks it, read succeeded', async (_code, refusal, title, body) => {
    const host = await conflictForm();
    h.reply(U_REACTIVATE, refusal);
    tap(named(host, 'Reactivate with new PIN'));
    await h.settle();
    expect(text(formNotice(host))).toBe(`${title}${body}`);
    expect(focused()).toBe(formNotice(host));
    expect(aria(named(host, 'Reactivate with new PIN'))).toBe(true);
    expect(pinField(host)!.value).toBe('');
    expect(h.count(READ)).toBe(2);
    expect(h.count(U_REACTIVATE)).toBe(2);
    // Save off sends nothing.
    tap(named(host, 'Reactivate with new PIN'));
    expect(h.count(U_REACTIVATE)).toBe(2);
  });

  it.each([
    ['USER_CHANGED', userChanged, 'R. Sari changed while you were editing', 'Nothing was saved. The staff list could not be refreshed. Try again reads the list only. Your choices are kept and credentials are empty. Return to the staff list and choose an action on the current person.'],
    ['NOT_FOUND', notFound, 'R. Sari could not be found', 'Nothing was saved. The staff list could not be refreshed. Return to the staff list to choose another person.'],
  ] as const)('%s on the reactivation form, read failed, says so, and Try again reads only', async (_code, refusal, title, body) => {
    const host = await conflictForm();
    h.reply(U_REACTIVATE, refusal);
    h.reply(READ, unknown);
    tap(named(host, 'Reactivate with new PIN'));
    await h.settle();
    expect(text(formNotice(host))).toBe(`${title}${body}`);
    h.reply(READ, staffList());
    tap(named(host, 'Try again'));
    await h.settle();
    expect(text(formNotice(host))).toContain('The staff list has been refreshed.');
    expect(focused()).toBe(formNotice(host));
    expect(h.count(U_REACTIVATE)).toBe(2);
  });

  it.each([
    ['OWN_ACCOUNT', ownAccount],
    ['USER_CHANGED', userChanged],
    ['NOT_FOUND', notFound],
  ] as const)('%s on a row command is the status command’s definite failure, with one reread', async (_code, refusal) => {
    const host = await open();
    h.reply(U_REACTIVATE, refusal);
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Something went wrong. R. Sari was not changed. Use its row action to try again.');
    expect(pageStatus(host)!.getAttribute('role')).toBe('alert');
    expect(h.count(READ)).toBe(2);
    expect(h.count(U_REACTIVATE)).toBe(1);
  });

  it('a definite failure on a create keeps the draft, empties the credentials and focuses the first field', async () => {
    const host = await open();
    h.reply(U_CREATE, general);
    managerDraft(host);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'Something went wrongNothing was saved. Your draft is kept. Enter credentials again, then press Save to try again.'
    );
    expect(nameField(host)!.value).toBe('Nadia Pratiwi');
    expect(classificationField(host)!.value).toBe('MANAGER');
    for (const field of [pinField(host), usernameField(host), passwordField(host)]) expect(field!.value).toBe('');
    expect(focused()).toBe(nameField(host));
    expect(h.count(U_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(1);
  });

  it('a create answered failed rereads once, keeps the draft, empties the credentials, and never resends', async () => {
    const host = await open();
    h.reply(U_CREATE, unknown);
    cashierDraft(host);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedDewi Lestari: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again. Your draft is kept; enter credentials again.'
    );
    expect(formNotice(host)!.getAttribute('role')).toBe('status');
    expect(nameField(host)!.value).toBe('Dewi Lestari');
    expect(pinField(host)!.value).toBe('');
    expect(focused()).toBe(nameField(host));
    expect(h.count(U_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    await h.advance(60_000);
    expect(h.count(U_CREATE)).toBe(1);
  });

  it('a create answered unavailable with the reread failing says the list could not be refreshed, and Try again reads only', async () => {
    const host = await open();
    h.reply(U_CREATE, 'reject');
    h.reply(READ, unknown);
    cashierDraft(host);
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toContain('The list could not be refreshed.');
    h.reply(READ, staffList());
    tap(named(host, 'Try again'));
    await h.settle();
    expect(text(formNotice(host))).toContain('The list has been refreshed.');
    expect(h.count(U_CREATE)).toBe(1);
  });

  it.each([
    ['Deactivate', 'Ana R.', U_DEACTIVATE],
    ['Reactivate', 'R. Sari', U_REACTIVATE],
  ] as const)('a %s answered failed rereads once, says so on the page, and never resends', async (action, name, key) => {
    const host = await open();
    h.reply(key, unknown);
    tap(named(host, `${action} — ${name}`));
    if (action === 'Deactivate') tap(named(confirmation(name)!, `Deactivate ${name}`));
    await h.settle();
    expect(text(pageStatus(host))).toBe(`${name}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.`);
    expect(focused()).toBe(pageStatus(host));
    expect(h.count(key)).toBe(1);
    expect(h.count(READ)).toBe(2);
    await h.advance(60_000);
    expect(h.count(key)).toBe(1);
  });

  it('an unknown state command with the reread failing says the list could not be refreshed', async () => {
    const host = await open();
    h.reply(U_REACTIVATE, unknown);
    h.reply(READ, unknown);
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('R. Sari: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.');
  });

  it('a general failure of a state command is the status failure and rereads nothing', async () => {
    const host = await open();
    h.reply(U_REACTIVATE, general);
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Something went wrong. R. Sari was not changed. Use its row action to try again.');
    expect(h.count(READ)).toBe(1);
  });
});

describe('AC 11. one form, one command', () => {
  it('with a dirty draft, Add person, Deactivate and Reactivate each meet the departure decision; with a clean form they hand over', async () => {
    const host = await open();
    tap(named(host, 'Add person'));
    // Clean: Deactivate hands over (the form closes, the confirmation opens).
    tap(named(host, 'Deactivate — Ana R.'));
    expect(panel(host)).toBeNull();
    expect(confirmation('Ana R.')).not.toBeNull();
    tap(named(confirmation('Ana R.')!, 'Keep active — Ana R.'));

    tap(named(host, 'Add person'));
    typeInto(nameField(host)!, 'Nadia');
    for (const opener of ['Add person', 'Deactivate — Ana R.', 'Reactivate — R. Sari']) {
      tap(named(host, opener));
      expect(dialogNamed('Discard unsaved changes?')).not.toBeNull();
      expect(nameField(host)!.value).toBe('Nadia');
      tap(named(dialogNamed('Discard unsaved changes?')!, 'Stay'));
    }
    expect(h.count(U_REACTIVATE)).toBe(0);
    expect(confirmation('Ana R.')).toBeNull();
  });

  it('while a command is pending every opener is inert and a press sends nothing', async () => {
    const host = await open();
    const held = h.hold(U_REACTIVATE);
    h.reply(U_REACTIVATE, staffAnswer({ ...SARI, isActive: true }));
    tap(named(host, 'Reactivate — R. Sari'));
    for (const opener of ['Add person', 'Deactivate — Ana R.', 'Reactivate — B. Wibowo']) {
      expect(aria(named(host, opener))).toBe(true);
      tap(named(host, opener));
    }
    expect(h.count(U_REACTIVATE)).toBe(1);
    expect(panel(host)).toBeNull();
    expect(document.querySelector('dialog[open]')).toBeNull();
    held.deliver(staffAnswer({ ...SARI, isActive: true }));
    await h.settle();
    expect(aria(named(host, 'Add person'))).toBe(false);
  });

  it('a discarded pending create shows its status and its late answer appends the row silently', async () => {
    const host = await open();
    const held = h.hold(U_CREATE);
    cashierDraft(host);
    tap(saveButton(host));
    tap(named(host, 'Cancel'));
    tap(named(dialogNamed('Discard unsaved changes?')!, 'Discard'));
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Waiting for an earlier save to finish. Nothing will be sent again.');
    expect(aria(named(host, 'Add person'))).toBe(true);
    const before = focused();
    held.deliver(staffAnswer(person(8, 'Dewi Lestari', 'CASHIER')));
    await h.settle();
    expect(rowNames(host)).toContain('Dewi Lestari');
    expect(pageStatus(host)).toBeNull();
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(before);
    expect(h.count(U_CREATE)).toBe(1);
  });
});

describe('AC 12. the partial state', () => {
  it('a command that succeeds while the list read stands failed draws the known rows with the partial alert and withholds the counts', async () => {
    const host = await open();
    await reachPartial(h, host);
    expect(text(host.querySelector('#read-state [role="alert"]'))).toBe(
      'The staff list may be out of dateThe rows below are the ones this page knows, including your latest change. Try again to read the full list.Try again'
    );
    expect(facts(host)).toBeNull();
    expect(host.querySelector('#staff-list caption')).toBeNull();
    expect(rowNames(host)).toContain('R. Sari');
    expect(rowText(rowOf(host, SARI.staffUserId))).toContain('Active');
    expect(text(pageStatus(host))).toBe('R. Sari reactivated.');
    expect(text(host)).not.toContain('Staff could not be loaded');
  });

  it('Try again reads only, and restores the counts', async () => {
    const host = await open();
    await reachPartial(h, host);
    const before = h.calls.length;
    h.reply(READ, staffList(PEOPLE.map((p) => (p.staffUserId === SARI.staffUserId ? { ...p, isActive: true } : p))));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(h.calls.slice(before).map((c) => `${c.method} ${c.url}`)).toEqual([READ]);
    expect(text(facts(host))).toBe('6 active · 1 inactive');
  });

  it('a read that began before a command was answered never undoes the answered record', async () => {
    const host = await open();
    const read = h.hold(READ);
    h.reply(U_REACTIVATE, staffAnswer({ ...SARI, isActive: true }));
    tap(named(rail(host), 'Tables'));
    await h.settle();
    tap(named(rail(host), 'Staff'));
    await h.settle();
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    // The read sent before the answer shows the old state; it arrives after the answer.
    read.deliver(staffList());
    await h.settle();
    expect(rowText(rowOf(host, SARI.staffUserId))).toContain('Active');
    expect(rowText(rowOf(host, SARI.staffUserId))).not.toContain('Inactive');
  });
});

describe('AC 14. no invented control', () => {
  const banned = /\b(rename|show|reveal|view pin|confirm (new )?(pin|password)|waiter|permission|last manager|role:)\b/i;
  const check = (host: HTMLElement) => {
    expect(text(host)).not.toMatch(banned);
    expect(host.querySelector('[data-reveal], input[name="confirm"], input[name="confirmPassword"], input[type="text"][name="pin"]')).toBeNull();
    for (const el of host.querySelectorAll('button, a')) {
      // S8c2 builds Change role, the resets and the own changes, so those names are no longer invented.
      expect(el.getAttribute('aria-label') ?? el.textContent).not.toMatch(/^(show|reveal|view|rename)/i);
    }
    // The own row offers no Deactivate.
    expect(host.querySelector('[aria-label="Deactivate — M. Iqbal"]')).toBeNull();
    expect(host.querySelectorAll('input[type="date"], input[type="time"], select[name="role"]')).toHaveLength(0);
  };

  it('holds on the list, every create form, the reactivation form, the confirmation and the refusals', async () => {
    const host = await open();
    check(host);
    tap(named(host, 'Add person'));
    check(host);
    choose(classificationField(host)!, 'CASHIER');
    check(host);
    choose(classificationField(host)!, 'MANAGER');
    check(host);
    expect(host.querySelectorAll('input[type="password"]')).toHaveLength(2);
    // The classification was changed, so the form is dirty: Cancel asks first.
    tap(named(host, 'Cancel'));
    tap(named(dialogNamed('Discard unsaved changes?')!, 'Discard'));
    tap(named(host, 'Deactivate — Ratna Ayu'));
    check(host);
    check(document.body);
    tap(named(confirmation('Ratna Ayu')!, 'Keep active — Ratna Ayu'));
    h.reply(U_REACTIVATE, duplicate('pin'));
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    check(host);
    h.reply(U_REACTIVATE, ownAccount);
    typeInto(pinField(host)!, MARKER_PIN);
    tap(named(host, 'Reactivate with new PIN'));
    await h.settle();
    check(host);
  });

  it('holds in fixture mode, where the list read fails and nothing is offered but Try again', async () => {
    const host = await open(unknown);
    check(host);
    expect(host.querySelectorAll('#staff-rows button')).toHaveLength(0);
  });
});
