// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, text } from './session-harness.js';
import {
  MARKER_CURRENT, MARKER_PASSWORD, U_OWN_PASSWORD, aria, currentField, endSession, errorOf, formNotice, goIdle, harness,
  hintOf, named, openStaff, passwordField, resume, signInAgain, staffList, tap, typeInto, wrongPassword,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// PHASE1-S8c2 round 2, R1: the account's cooldown deadline is the moment the answer ARRIVES plus
// the server's `retryAfterSeconds`, however long a decision, M-6 or BO-01 holds its presentation.
// Presenting later shows what remains, and never starts a new wait.

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

const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const saveButton = (host: HTMLElement) => named(host, 'Save');
const TITLE = 'Password verification is cooling down';
const notice = (duration: string) => `${TITLE}Wait ${duration}. This is the same cooldown used at sign-in.`;

/** An own-password save is sent and its answer held; returns the way to deliver it. */
async function sendHeld() {
  h = harness();
  view = await openStaff(h);
  const host = view.host;
  tap(named(host, 'Change my password — M. Iqbal'));
  typeInto(currentField(host)!, MARKER_CURRENT);
  typeInto(passwordField(host)!, MARKER_PASSWORD);
  const held = h.hold(U_OWN_PASSWORD);
  tap(saveButton(host));
  return { host, held };
}

const live = (host: HTMLElement) => {
  expect(formNotice(host)).toBeNull();
  expect(errorOf(host, 'current-password')).toBeNull();
  expect(currentField(host)!.disabled).toBe(false);
  expect(aria(saveButton(host))).toBe(false);
  expect(text(hintOf(host))).toBe('Nothing is sent until you save.');
};

describe('R1. behind the departure decision', () => {
  async function behindDecision() {
    const { host, held } = await sendHeld();
    tap(named(host, 'Cancel'));
    expect(document.querySelector('dialog[open]')).not.toBeNull();
    held.deliver(wrongPassword(300));
    await h.settle();
    return host;
  }
  const stay = async (host: HTMLElement) => {
    tap(named(document.body, 'Stay'));
    await h.settle();
    expect(host.isConnected).toBe(true);
  };

  it('(a) a decision left open past the deadline: Stay shows no cooldown, and the field and Save are live', async () => {
    const host = await behindDecision();
    await wait(301_000);
    await stay(host);
    live(host);
  });

  it('(b) a decision left open for part of the wait: Stay shows the wait remaining to the deadline', async () => {
    const host = await behindDecision();
    await wait(100_000);
    await stay(host);
    expect(text(formNotice(host))).toBe(notice('3 min 20 s'));
    expect(currentField(host)!.disabled).toBe(true);
    expect(aria(saveButton(host))).toBe(true);
    await wait(200_000);
    live(host);
  });
});

describe('R1. behind M-6 and BO-01, with same-manager recovery', () => {
  it('M-6, deadline passed while away: recovery shows no cooldown', async () => {
    const { host, held } = await sendHeld();
    await goIdle(h, host);
    held.deliver(wrongPassword(300));
    await h.settle();
    await wait(301_000);
    await resume(h, host);
    live(host);
  });

  it('M-6, part of the wait elapsed: recovery shows what remains', async () => {
    const { host, held } = await sendHeld();
    await goIdle(h, host);
    held.deliver(wrongPassword(300));
    await h.settle();
    await wait(100_000);
    await resume(h, host);
    expect(text(formNotice(host))).toBe(notice('3 min 20 s'));
    expect(currentField(host)!.disabled).toBe(true);
  });

  it('BO-01, deadline passed while away: recovery shows no cooldown', async () => {
    const { host, held } = await sendHeld();
    await endSession(h, host);
    held.deliver(wrongPassword(300));
    await h.settle();
    await wait(301_000);
    h.reply('GET /api/back-office/config/users', staffList());
    await signInAgain(h, host);
    live(host);
  });

  it('BO-01, part of the wait elapsed: recovery shows what remains', async () => {
    const { host, held } = await sendHeld();
    await endSession(h, host);
    held.deliver(wrongPassword(300));
    await h.settle();
    await wait(100_000);
    h.reply('GET /api/back-office/config/users', staffList());
    await signInAgain(h, host);
    expect(text(formNotice(host))).toBe(notice('3 min 20 s'));
  });
});
