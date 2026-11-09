// @vitest-environment jsdom
import { ChangeRoleRequest } from '@pos/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { mount, text } from './session-harness.js';
import {
  ANA, AYU, HALIM, IQBAL, MARKER_PASSWORD, MARKER_PIN, MARKER_USERNAME, PUTRA, SARI, U_CHANGE_ROLE, WIBOWO, aria,
  actionsOf, bodyOf, choose, classificationField, clearedNote, contextOf, currentField, duplicate, errorOf, facts,
  formNotice, harness, hintOf, nameField, named, openStaff, pageStatus, panel, panelName, passwordField, person, pinField,
  rowOf, rowText, staffAnswer, staffCalls, storedFact, tap, typeInto, usernameField, warningOf,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-06 Staff, part 2 (PHASE1-S8c2): the row actions, and the role change in its six moves (C3
// section 2, DESIGN-023 "Rules for S8c": the move form opens with no destination chosen).

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const focused = () => document.activeElement;
const open = async (first?: Parameters<typeof openStaff>[1]) => {
  h = harness();
  view = await openStaff(h, first);
  return view.host;
};
const saveButton = (host: HTMLElement) => named(host, 'Save');
const opener = (host: HTMLElement, who: { name: string }) => tap(named(host, `Change role — ${who.name}`));
const optionsOf = (select: HTMLSelectElement) => [...select.options].map((o) => `${o.value}|${o.textContent}|${o.disabled}`);

/** A former manager now in the kitchen: a retained username and no PIN. */
const KITCHEN_WITH_LOGIN = person(8, 'T. Kusuma', 'KITCHEN', true, 't.kusuma');

describe('AC 1. the row actions', () => {
  it('offers each row its actions, in DESIGN-023’s order and names', async () => {
    const host = await open();
    expect(actionsOf(host, ANA)).toEqual(['Change role — Ana R.', 'Reset PIN — Ana R.', 'Deactivate — Ana R.']);
    expect(actionsOf(host, AYU)).toEqual([
      'Change role — Ratna Ayu',
      'Reset PIN — Ratna Ayu',
      'Reset password — Ratna Ayu',
      'Deactivate — Ratna Ayu',
    ]);
    expect(actionsOf(host, HALIM)).toEqual(['Change role — S. Halim', 'Deactivate — S. Halim']);
    // A former manager is a cashier now: a PIN reset, and no password reset.
    expect(actionsOf(host, PUTRA)).toEqual(['Change role — D. Putra', 'Reset PIN — D. Putra', 'Deactivate — D. Putra']);
    expect(actionsOf(host, IQBAL)).toEqual(['Change my password — M. Iqbal', 'Change my PIN — M. Iqbal']);
    expect(actionsOf(host, SARI)).toEqual(['Reactivate — R. Sari']);
    expect(actionsOf(host, WIBOWO)).toEqual(['Reactivate — B. Wibowo']);
  });

  it('draws each action’s visible text as its name without the person', async () => {
    const host = await open();
    const visible = (who: { staffUserId: string }) =>
      [...rowOf(host, who.staffUserId).querySelectorAll('button')].map((b) => b.textContent);
    expect(visible(AYU)).toEqual(['Change role', 'Reset PIN', 'Reset password', 'Deactivate']);
    expect(visible(IQBAL)).toEqual(['Change my password', 'Change my PIN']);
  });
});

describe('AC 2. the move form opens with no destination chosen', () => {
  it.each([
    [AYU, 'Manager', ['Kitchen · no sign-in', 'Cashier']],
    [ANA, 'Cashier', ['Kitchen · no sign-in', 'Manager']],
    [HALIM, 'Kitchen', ['Cashier', 'Manager']],
  ] as const)('%j: focus on the select, no field, no warning, Save off, and a submission sends nothing', async (who, current, choices) => {
    const host = await open();
    opener(host, who);
    expect(panel(host)).not.toBeNull();
    expect(panelName(host)).toBe(`Change role — ${who.name}`);
    expect(panel(host)!.getAttribute('aria-modal')).toBe('false');
    expect(text(contextOf(host))).toBe(`Current classification: ${current}.`);
    const select = classificationField(host)!;
    expect(focused()).toBe(select);
    expect(select.value).toBe('');
    // The first option is the disabled placeholder; the person's current classification is not offered.
    const options = [...select.options];
    expect(options[0]!.textContent).toBe('Choose a new classification');
    expect(options[0]!.disabled).toBe(true);
    expect(options.slice(1).map((o) => o.textContent)).toEqual(choices);
    for (const find of [nameField, pinField, usernameField, passwordField, currentField]) expect(find(host)).toBeNull();
    expect(warningOf(host)).toBeNull();
    expect(storedFact(host)).toBeNull();
    expect(aria(saveButton(host))).toBe(true);
    expect(text(hintOf(host))).toBe('Choose a new classification before saving.');
    // A press on the off Save, and a form submission by any other means, send nothing.
    tap(saveButton(host));
    panel(host)!.querySelector('form')!.requestSubmit();
    expect(h.count(U_CHANGE_ROLE)).toBe(0);
    expect(staffCalls(h)).toEqual(['GET /api/back-office/config/users']);
  });

  it('the select has a label and its help', async () => {
    const host = await open();
    opener(host, ANA);
    expect(host.querySelector('label[for="staff-classification"]')!.textContent).toBe('Classification');
    expect(text(host.querySelector('#staff-classification-help'))).toBe(
      'Choose the new classification. Changing this choice clears every credential field.'
    );
  });
});

describe('AC 2. each of the six moves shows exactly its fields and sends exactly its variant', () => {
  const sendMove = async (host: HTMLElement, answer: ReturnType<typeof staffAnswer>) => {
    h.reply(U_CHANGE_ROLE, answer);
    tap(saveButton(host));
    await h.settle();
  };

  it('kitchen to cashier: a PIN', async () => {
    const host = await open();
    opener(host, HALIM);
    choose(classificationField(host)!, 'CASHIER');
    expect(text(contextOf(host))).toBe('Current classification: Kitchen. The POS PIN is set.');
    expect(focused()).toBe(pinField(host));
    for (const find of [nameField, usernameField, passwordField, currentField]) expect(find(host)).toBeNull();
    expect(storedFact(host)).toBeNull();
    typeInto(pinField(host)!, MARKER_PIN);
    await sendMove(host, staffAnswer({ ...HALIM, classification: 'CASHIER' }));
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
    const body = bodyOf(h, U_CHANGE_ROLE);
    expect(body).toEqual({ staffUserId: HALIM.staffUserId, change: 'KITCHEN_TO_CASHIER', pin: MARKER_PIN });
    expect(ChangeRoleRequest.safeParse(body).success).toBe(true);
  });

  it('kitchen to manager, no login yet: a PIN, a username and a password', async () => {
    const host = await open();
    opener(host, HALIM);
    choose(classificationField(host)!, 'MANAGER');
    expect(text(contextOf(host))).toBe('Current classification: Kitchen. Promotion always sets a new password.');
    expect(focused()).toBe(pinField(host));
    expect(nameField(host)).toBeNull();
    expect(storedFact(host)).toBeNull();
    typeInto(pinField(host)!, MARKER_PIN);
    typeInto(usernameField(host)!, `  ${MARKER_USERNAME.toUpperCase()} `);
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    await sendMove(host, staffAnswer({ ...HALIM, classification: 'MANAGER', username: MARKER_USERNAME }));
    const body = bodyOf(h, U_CHANGE_ROLE);
    expect(body).toEqual({
      staffUserId: HALIM.staffUserId,
      change: 'KITCHEN_TO_MANAGER',
      pin: MARKER_PIN,
      username: MARKER_USERNAME,
      password: MARKER_PASSWORD,
    });
    expect(ChangeRoleRequest.safeParse(body).success).toBe(true);
  });

  it('kitchen to manager, a login retained: a PIN and a password, no username, the fact shown', async () => {
    const host = await open({ status: 200, body: { users: [IQBAL, KITCHEN_WITH_LOGIN] } });
    opener(host, KITCHEN_WITH_LOGIN);
    choose(classificationField(host)!, 'MANAGER');
    expect(usernameField(host)).toBeNull();
    expect(text(storedFact(host))).toBe('Retained username: t.kusuma · This username cannot change.');
    typeInto(pinField(host)!, MARKER_PIN);
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    await sendMove(host, staffAnswer({ ...KITCHEN_WITH_LOGIN, classification: 'MANAGER' }));
    expect(bodyOf(h, U_CHANGE_ROLE)).toEqual({
      staffUserId: KITCHEN_WITH_LOGIN.staffUserId,
      change: 'KITCHEN_TO_MANAGER',
      pin: MARKER_PIN,
      password: MARKER_PASSWORD,
    });
  });

  it('cashier to manager, no login yet: a username and a password, the PIN kept', async () => {
    const host = await open();
    opener(host, ANA);
    choose(classificationField(host)!, 'MANAGER');
    expect(text(contextOf(host))).toBe('Current classification: Cashier. Promotion always sets a new password.');
    expect(focused()).toBe(usernameField(host));
    expect(pinField(host)).toBeNull();
    typeInto(usernameField(host)!, MARKER_USERNAME);
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    await sendMove(host, staffAnswer({ ...ANA, classification: 'MANAGER', username: MARKER_USERNAME }));
    const body = bodyOf(h, U_CHANGE_ROLE);
    expect(body).toEqual({
      staffUserId: ANA.staffUserId,
      change: 'CASHIER_TO_MANAGER',
      username: MARKER_USERNAME,
      password: MARKER_PASSWORD,
    });
    expect(ChangeRoleRequest.safeParse(body).success).toBe(true);
  });

  it('a former manager’s promotion asks for no username, shows the retained one, and sends none', async () => {
    const host = await open();
    opener(host, PUTRA);
    choose(classificationField(host)!, 'MANAGER');
    expect(usernameField(host)).toBeNull();
    expect(text(storedFact(host))).toBe('Retained username: d.putra · This username cannot change.');
    expect(focused()).toBe(passwordField(host));
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    await sendMove(host, staffAnswer({ ...PUTRA, classification: 'MANAGER' }));
    const body = bodyOf(h, U_CHANGE_ROLE);
    expect(body).toEqual({ staffUserId: PUTRA.staffUserId, change: 'CASHIER_TO_MANAGER', password: MARKER_PASSWORD });
    expect('username' in body).toBe(false);
  });

  it.each([
    [AYU, 'Manager', 'CASHIER', 'MANAGER_TO_CASHIER', 'The POS PIN is kept.'],
    [ANA, 'Cashier', 'KITCHEN', 'CASHIER_TO_KITCHEN', 'The PIN is removed.'],
    [AYU, 'Manager', 'KITCHEN', 'MANAGER_TO_KITCHEN', 'The PIN is removed.'],
  ] as const)('%j (%s) to %s sends %s and asks for nothing', async (who, from, to, change, suffix) => {
    const host = await open();
    opener(host, who);
    choose(classificationField(host)!, to);
    expect(text(contextOf(host))).toBe(`Current classification: ${from}. ${suffix}`);
    for (const find of [nameField, pinField, usernameField, passwordField, currentField]) expect(find(host)).toBeNull();
    expect(focused()).toBe(classificationField(host));
    expect(warningOf(host)).not.toBeNull();
    await sendMove(host, staffAnswer({ ...who, classification: to }));
    const body = bodyOf(h, U_CHANGE_ROLE);
    expect(body).toEqual({ staffUserId: who.staffUserId, change });
    expect(ChangeRoleRequest.safeParse(body).success).toBe(true);
  });

  it('success announces the change, closes the form, updates the row and focuses that row’s Change role', async () => {
    const host = await open();
    opener(host, ANA);
    choose(classificationField(host)!, 'KITCHEN');
    await sendMove(host, staffAnswer({ ...ANA, classification: 'KITCHEN' }));
    expect(text(pageStatus(host))).toBe('Ana R. changed to Kitchen.');
    expect(pageStatus(host)!.getAttribute('role')).toBe('status');
    expect(panel(host)).toBeNull();
    expect(rowText(rowOf(host, ANA.staffUserId))).toContain('Kitchen');
    expect(focused()).toBe(named(host, 'Change role — Ana R.'));
    expect(text(facts(host))).toBe('5 active · 2 inactive');
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
  });

  it('a manager made from a cashier shows its username on the row and offers Reset password', async () => {
    const host = await open();
    opener(host, ANA);
    choose(classificationField(host)!, 'MANAGER');
    typeInto(usernameField(host)!, MARKER_USERNAME);
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    await sendMove(host, staffAnswer({ ...ANA, classification: 'MANAGER', username: MARKER_USERNAME }));
    expect(text(pageStatus(host))).toBe('Ana R. changed to Manager.');
    expect(rowText(rowOf(host, ANA.staffUserId))).toContain(`Username: ${MARKER_USERNAME}`);
    expect(actionsOf(host, ANA)).toContain('Reset password — Ana R.');
  });
});

describe('AC 2. changing the chosen move', () => {
  it('empties every credential, shows the retained-choice notice and focuses the first credential the new move needs', async () => {
    const host = await open();
    opener(host, HALIM);
    choose(classificationField(host)!, 'MANAGER');
    expect(clearedNote(host)).toBeNull();
    typeInto(pinField(host)!, MARKER_PIN);
    typeInto(usernameField(host)!, MARKER_USERNAME);
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    choose(classificationField(host)!, 'CASHIER');
    expect(text(clearedNote(host))).toBe('Enter the credentials again. The name and classification choices are kept.');
    expect(pinField(host)!.value).toBe('');
    expect(usernameField(host)).toBeNull();
    expect(passwordField(host)).toBeNull();
    expect(focused()).toBe(pinField(host));
    choose(classificationField(host)!, 'MANAGER');
    expect(pinField(host)!.value).toBe('');
    expect(usernameField(host)!.value).toBe('');
    expect(passwordField(host)!.value).toBe('');
    expect(text(warningOf(host))).toBe(
      'S. Halim currently has no sign-in sessions. After this change, they must sign in to use the POS or back office.'
    );
  });

  it('shows the warning of the chosen move only, and none before one is chosen', async () => {
    const host = await open();
    opener(host, AYU);
    expect(warningOf(host)).toBeNull();
    choose(classificationField(host)!, 'CASHIER');
    expect(text(warningOf(host))).toBe(
      'Ratna Ayu’s POS and back-office sessions will end on their next action. Their back-office login will no longer work. They can sign in at the POS.'
    );
    choose(classificationField(host)!, 'KITCHEN');
    expect(text(warningOf(host))).toBe(
      'Ratna Ayu’s POS and back-office sessions will end on their next action. Their PIN will be removed. They will no longer sign in.'
    );
  });
});

describe('AC 3. the warning of each move, by the subject’s current classification, beside Save', () => {
  it.each([
    [HALIM, 'CASHIER', 'S. Halim currently has no sign-in sessions. After this change, they must sign in to use the POS.'],
    [HALIM, 'MANAGER', 'S. Halim currently has no sign-in sessions. After this change, they must sign in to use the POS or back office.'],
    [ANA, 'MANAGER', 'Ana R.’s POS sessions will end on their next action. They must sign in again.'],
    [ANA, 'KITCHEN', 'Ana R.’s POS sessions will end on their next action. Their PIN will be removed. They will no longer sign in.'],
    [AYU, 'CASHIER', 'Ratna Ayu’s POS and back-office sessions will end on their next action. Their back-office login will no longer work. They can sign in at the POS.'],
    [AYU, 'KITCHEN', 'Ratna Ayu’s POS and back-office sessions will end on their next action. Their PIN will be removed. They will no longer sign in.'],
    // A former manager is a cashier: no back-office session to name.
    [PUTRA, 'MANAGER', 'D. Putra’s POS sessions will end on their next action. They must sign in again.'],
    [PUTRA, 'KITCHEN', 'D. Putra’s POS sessions will end on their next action. Their PIN will be removed. They will no longer sign in.'],
  ] as const)('%j to %s', async (who, to, sentence) => {
    const host = await open();
    opener(host, who);
    choose(classificationField(host)!, to);
    const warning = warningOf(host)!;
    expect(text(warning)).toBe(sentence);
    // Beside Save, in the footer, and Save is described by it.
    expect(warning.closest('footer')).toBe(saveButton(host).closest('footer'));
    expect(saveButton(host).getAttribute('aria-describedby')).toContain('session-warning');
  });
});

describe('AC 2 and 9. the form’s checks and focus', () => {
  it('refuses every empty field of a kitchen to manager at once, focuses the first, and sends nothing', async () => {
    const host = await open();
    opener(host, HALIM);
    choose(classificationField(host)!, 'MANAGER');
    tap(saveButton(host));
    expect(h.count(U_CHANGE_ROLE)).toBe(0);
    expect(text(errorOf(host, 'pin'))).toBe('Enter exactly six digits, 0–9.');
    expect(text(errorOf(host, 'username'))).toBe(
      'Use 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit.'
    );
    expect(text(errorOf(host, 'password'))).toBe('Use 8–128 characters. Spaces count.');
    expect(focused()).toBe(pinField(host));
  });

  it('a former manager’s promotion checks only the password and focuses it', async () => {
    const host = await open();
    opener(host, PUTRA);
    choose(classificationField(host)!, 'MANAGER');
    tap(saveButton(host));
    expect(text(errorOf(host, 'password'))).toBe('Use 8–128 characters. Spaces count.');
    expect(focused()).toBe(passwordField(host));
    expect(h.count(U_CHANGE_ROLE)).toBe(0);
  });

  it('DUPLICATE { pin } on a promotion from kitchen marks New PIN only, focused and empty, with no holder named', async () => {
    const host = await open();
    opener(host, HALIM);
    choose(classificationField(host)!, 'MANAGER');
    typeInto(pinField(host)!, MARKER_PIN);
    typeInto(usernameField(host)!, MARKER_USERNAME);
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    h.reply(U_CHANGE_ROLE, duplicate('pin'));
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
    expect(text(errorOf(host, 'pin'))).toBe('That PIN is already in use. Choose a different PIN.');
    expect(errorOf(host, 'username')).toBeNull();
    expect(pinField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(usernameField(host)!.getAttribute('aria-invalid')).toBeNull();
    expect(focused()).toBe(pinField(host));
    expect(pinField(host)!.value).toBe('');
    expect(usernameField(host)!.value).toBe('');
    expect(passwordField(host)!.value).toBe('');
    expect(h.count('GET /api/back-office/config/users')).toBe(1);
  });

  it('DUPLICATE { pin } on kitchen to cashier marks New PIN, focused and empty', async () => {
    const host = await open();
    opener(host, HALIM);
    choose(classificationField(host)!, 'CASHIER');
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_CHANGE_ROLE, duplicate('pin'));
    tap(saveButton(host));
    await h.settle();
    expect(text(errorOf(host, 'pin'))).toBe('That PIN is already in use. Choose a different PIN.');
    expect(focused()).toBe(pinField(host));
    expect(pinField(host)!.value).toBe('');
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
  });

  it.each([
    ['cashier', ANA],
    ['kitchen', HALIM],
  ] as const)('DUPLICATE { username } on a promotion from %s marks Username only, focused and empty', async (_from, who) => {
    const host = await open();
    opener(host, who);
    choose(classificationField(host)!, 'MANAGER');
    if (pinField(host) !== null) typeInto(pinField(host)!, MARKER_PIN);
    typeInto(usernameField(host)!, MARKER_USERNAME);
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    h.reply(U_CHANGE_ROLE, duplicate('username'));
    tap(saveButton(host));
    await h.settle();
    expect(text(errorOf(host, 'username'))).toBe('That username is already in use. Choose another username.');
    expect(errorOf(host, 'pin')).toBeNull();
    expect(focused()).toBe(usernameField(host));
    expect(usernameField(host)!.value).toBe('');
    expect(passwordField(host)!.value).toBe('');
  });

  it('Cancel closes a clean form and returns focus to that row’s Change role', async () => {
    const host = await open();
    opener(host, ANA);
    tap(named(host, 'Cancel'));
    expect(panel(host)).toBeNull();
    expect(focused()).toBe(named(host, 'Change role — Ana R.'));
  });

  it('a move form is a draft once a destination is chosen: leaving asks', async () => {
    const host = await open();
    opener(host, ANA);
    choose(classificationField(host)!, 'KITCHEN');
    tap(named(host, 'Cancel'));
    expect(document.querySelector('dialog[open]')).not.toBeNull();
  });

  it('a pending command holds the controls, one request is sent, and the form shows Saving', async () => {
    const host = await open();
    opener(host, AYU);
    choose(classificationField(host)!, 'CASHIER');
    const held = h.hold(U_CHANGE_ROLE);
    tap(saveButton(host));
    expect(text(formNotice(host))).toBe('Saving…Wait for the result. Your draft is kept.');
    expect(text(hintOf(host))).toBe('Wait for the save result.');
    expect(aria(saveButton(host))).toBe(true);
    expect(classificationField(host)!.disabled).toBe(true);
    for (const row of ['Change role — Ana R.', 'Reset PIN — Ana R.', 'Deactivate — Ana R.']) {
      expect(aria(named(host, row))).toBe(true);
    }
    tap(saveButton(host));
    expect(h.count(U_CHANGE_ROLE)).toBe(1);
    held.deliver(staffAnswer({ ...AYU, classification: 'CASHIER' }));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Ratna Ayu changed to Cashier.');
  });
});

describe('AC 10. no invented control in the move form', () => {
  it('a manager’s select never offers Manager, and no role other than the three classifications is offered', async () => {
    const host = await open();
    opener(host, AYU);
    expect(optionsOf(classificationField(host)!)).toEqual([
      '|Choose a new classification|true',
      'KITCHEN|Kitchen · no sign-in|false',
      'CASHIER|Cashier|false',
    ]);
    tap(named(host, 'Cancel'));
    opener(host, ANA);
    expect(optionsOf(classificationField(host)!).map((o) => o.split('|')[1])).toEqual([
      'Choose a new classification',
      'Kitchen · no sign-in',
      'Manager',
    ]);
  });

  it('the own row offers no move, no reset and no Deactivate', async () => {
    const host = await open();
    for (const row of ['Change role', 'Reset PIN', 'Reset password', 'Deactivate']) {
      expect(host.querySelector(`[aria-label="${row} — M. Iqbal"]`)).toBeNull();
    }
  });
});
