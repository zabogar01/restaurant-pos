// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, mount, text } from './session-harness.js';
import {
  AYU, IQBAL, MARKER_CURRENT, MARKER_PASSWORD, MARKER_PIN, OTHER_MANAGER, PEOPLE, READ, U_OWN_PASSWORD, U_OWN_PIN, aria,
  currentField, endSession, errorOf, formNotice, goIdle, harness, hintOf, named, openStaff, panel, passwordField, pinField,
  resume, signInAgain, staffAnswer, staffList, tap, throttled, typeInto, wrongPassword,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-06 Staff, part 2 (PHASE1-S8c2 ruling 8): the cooldown a fifth wrong current password starts,
// or a THROTTLED answer reports. It is the same cooldown as at sign-in, in the shared duration
// format, counted down locally from the server's `retryAfterSeconds`. It belongs to the signed-in
// manager's account, not to a form: closing and reopening keeps the wait, M-6 and BO-01 recovery
// by the same manager keeps it, and a different manager's sign-in discards it.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
});

afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.useRealTimers();
});

const focused = () => document.activeElement;
const open = async () => {
  h = harness();
  view = await openStaff(h);
  return view.host;
};
const saveButton = (host: HTMLElement) => named(host, 'Save');
const ownPassword = (host: HTMLElement, name = 'M. Iqbal') => tap(named(host, `Change my password — ${name}`));
const ownPin = (host: HTMLElement) => tap(named(host, 'Change my PIN — M. Iqbal'));
const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const TITLE = 'Password verification is cooling down';
const notice = (duration: string) => `${TITLE}Wait ${duration}. This is the same cooldown used at sign-in.`;
const fieldError = (duration: string) => `Wait ${duration} before trying your current password again.`;

async function startCooldown(host: HTMLElement, answer = wrongPassword(300), route = U_OWN_PASSWORD) {
  ownPassword(host);
  typeInto(currentField(host)!, MARKER_CURRENT);
  typeInto(passwordField(host)!, MARKER_PASSWORD);
  h.reply(route, answer);
  tap(saveButton(host));
  await h.settle();
}

describe('AC 6. the cooldown state', () => {
  it.each([
    ['INVALID_CREDENTIALS with retryAfterSeconds', () => wrongPassword(300)],
    ['THROTTLED', () => throttled(300)],
  ])('%s: the focusable notice, the field error, Current password and Save off, the commit help, focus on the notice', async (_name, answer) => {
    const host = await open();
    await startCooldown(host, answer());
    expect(h.count(U_OWN_PASSWORD)).toBe(1);
    expect(text(formNotice(host))).toBe(notice('5 min'));
    expect(formNotice(host)!.getAttribute('tabindex')).toBe('-1');
    expect(text(errorOf(host, 'current-password'))).toBe(fieldError('5 min'));
    expect(currentField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(currentField(host)!.disabled).toBe(true);
    expect(aria(saveButton(host))).toBe(true);
    expect(text(hintOf(host))).toBe('Wait for the cooldown before saving.');
    expect(focused()).toBe(formNotice(host));
    // It is not the plain wrong-password sentence.
    expect(host.textContent).not.toContain('Incorrect current password');
    // The fields the manager typed are empty after the response.
    expect(passwordField(host)!.value).toBe('');
    expect(currentField(host)!.value).toBe('');
  });

  it('a press on the off Save, and a submission by any other means, send nothing', async () => {
    const host = await open();
    await startCooldown(host);
    tap(saveButton(host));
    document.querySelector('form')!.requestSubmit();
    await h.settle();
    expect(h.count(U_OWN_PASSWORD)).toBe(1);
  });

  it('INVALID_CREDENTIALS with retryAfterSeconds on own PIN is the same state', async () => {
    const host = await open();
    ownPin(host);
    typeInto(currentField(host)!, MARKER_CURRENT);
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_OWN_PIN, wrongPassword(300));
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(notice('5 min'));
    expect(currentField(host)!.disabled).toBe(true);
    expect(aria(saveButton(host))).toBe(true);
    expect(focused()).toBe(formNotice(host));
  });

  it('THROTTLED on own PIN is the same state', async () => {
    const host = await open();
    ownPin(host);
    typeInto(currentField(host)!, MARKER_CURRENT);
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_OWN_PIN, throttled(300));
    tap(saveButton(host));
    await h.settle();
    expect(text(formNotice(host))).toBe(notice('5 min'));
    expect(text(errorOf(host, 'current-password'))).toBe(fieldError('5 min'));
    expect(currentField(host)!.disabled).toBe(true);
    expect(aria(saveButton(host))).toBe(true);
    expect(focused()).toBe(formNotice(host));
  });

  it('is counted down locally in the shared format, and the field and Save come back at zero', async () => {
    const host = await open();
    await startCooldown(host);
    expect(h.count(READ)).toBe(1);
    await wait(1000);
    expect(text(formNotice(host))).toBe(notice('4 min 59 s'));
    expect(text(errorOf(host, 'current-password'))).toBe(fieldError('4 min 59 s'));
    await wait(240_000);
    expect(text(formNotice(host))).toBe(notice('59 s'));
    expect(text(errorOf(host, 'current-password'))).toBe(fieldError('59 s'));
    expect(currentField(host)!.disabled).toBe(true);
    await wait(58_000);
    expect(text(formNotice(host))).toBe(notice('1 s'));
    await wait(1000);
    expect(formNotice(host)).toBeNull();
    expect(errorOf(host, 'current-password')).toBeNull();
    expect(currentField(host)!.disabled).toBe(false);
    expect(aria(saveButton(host))).toBe(false);
    expect(text(hintOf(host))).toBe('Nothing is sent until you save.');
    // No request was made by the countdown.
    expect(h.count(U_OWN_PASSWORD)).toBe(1);
    expect(h.count(READ)).toBe(1);
  });

  it('after the wait the manager can try again, and a right password goes through', async () => {
    const host = await open();
    await startCooldown(host);
    await wait(300_000);
    typeInto(currentField(host)!, MARKER_CURRENT);
    typeInto(passwordField(host)!, MARKER_PASSWORD);
    h.reply(U_OWN_PASSWORD, staffAnswer(IQBAL));
    tap(saveButton(host));
    await h.settle();
    expect(h.count(U_OWN_PASSWORD)).toBe(2);
    expect(text(host.querySelector('#page-status'))).toBe('M. Iqbal’s password changed. This back-office session continues.');
  });

  it('the wait keeps counting while no form is open', async () => {
    const host = await open();
    await startCooldown(host, wrongPassword(300));
    await wait(100_000);
    tap(named(host, 'Cancel'));
    ownPassword(host);
    expect(text(formNotice(host))).toBe(notice('3 min 20 s'));
  });
});

describe('AC 6. the cooldown belongs to the manager’s account', () => {
  it('closing and reopening either own form keeps the remaining wait, focused on the notice', async () => {
    const host = await open();
    await startCooldown(host);
    tap(named(host, 'Cancel'));
    expect(panel(host)).toBeNull();
    await wait(10_000);
    ownPassword(host);
    expect(text(formNotice(host))).toBe(notice('4 min 50 s'));
    expect(text(errorOf(host, 'current-password'))).toBe(fieldError('4 min 50 s'));
    expect(currentField(host)!.disabled).toBe(true);
    expect(aria(saveButton(host))).toBe(true);
    expect(focused()).toBe(formNotice(host));
    tap(named(host, 'Cancel'));
    await wait(5000);
    ownPin(host);
    expect(text(formNotice(host))).toBe(notice('4 min 45 s'));
    expect(currentField(host)!.disabled).toBe(true);
  });

  it('a form opened after the wait has ended is the plain form, focused on Current password', async () => {
    const host = await open();
    await startCooldown(host);
    tap(named(host, 'Cancel'));
    await wait(301_000);
    ownPassword(host);
    expect(formNotice(host)).toBeNull();
    expect(currentField(host)!.disabled).toBe(false);
    expect(focused()).toBe(currentField(host));
  });

  it('M-6 recovery by the same manager keeps it', async () => {
    const host = await open();
    await startCooldown(host);
    await goIdle(h, host);
    await wait(20_000);
    await resume(h, host);
    expect(text(formNotice(host))).toBe(notice('4 min 40 s'));
    expect(currentField(host)!.disabled).toBe(true);
    expect(aria(saveButton(host))).toBe(true);
  });

  it('BO-01 recovery by the same manager keeps it', async () => {
    const host = await open();
    await startCooldown(host);
    await endSession(h, host);
    await wait(30_000);
    h.reply(READ, staffList());
    await signInAgain(h, host);
    expect(text(formNotice(host))).toBe(notice('4 min 30 s'));
    expect(currentField(host)!.disabled).toBe(true);
  });

  it('a different manager’s sign-in discards it: their own form is the plain one', async () => {
    const host = await open();
    await startCooldown(host);
    await endSession(h, host);
    h.reply(READ, staffList(PEOPLE));
    await signInAgain(h, host, ok(OTHER_MANAGER), 'r.ayu');
    expect(panel(host)).toBeNull();
    ownPassword(host, AYU.name);
    expect(formNotice(host)).toBeNull();
    expect(currentField(host)!.disabled).toBe(false);
    expect(aria(saveButton(host))).toBe(false);
    expect(focused()).toBe(currentField(host));
    expect(host.textContent).not.toContain('cooling down');
  });
});
