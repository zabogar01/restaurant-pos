// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dialogNamed } from './tables-support.js';
import { mount } from './session-harness.js';
import {
  MARKER_PASSWORD, MARKER_PIN, MARKER_USERNAME, READ, SARI, U_CREATE, U_REACTIVATE, cashierDraft, choose,
  classificationField, duplicate, goIdle, harness, managerDraft, nameField, named, openStaff, passwordField, pinField,
  reachPartial, resume, staffList, tap, typeInto, unknown, userChanged, usernameField,
} from './staff-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// PHASE1-S8c1 round 2 (R1 to R3 of the review).

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.restoreAllMocks();
});

const focused = () => document.activeElement;
const open = async () => {
  h = harness();
  view = await openStaff(h);
  return view.host;
};

describe('R1. credentials are emptied when the command answers, not when its result is presented', () => {
  it('(a) a DUPLICATE that arrives while the departure decision is open empties New PIN before Stay', async () => {
    const host = await open();
    cashierDraft(host);
    const held = h.hold(U_CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(document.querySelector<HTMLElement>('#cancel-staff')!);
    expect(dialogNamed('Discard unsaved changes?')).not.toBeNull();
    held.deliver(duplicate('pin'));
    await h.settle();
    // Still held behind the decision: nothing is presented, yet the PIN is gone.
    expect(dialogNamed('Discard unsaved changes?')).not.toBeNull();
    expect(pinField(host)!.value).toBe('');
  });

  it('(b) an unknown outcome empties every credential while its reread is still held', async () => {
    const host = await open();
    managerDraft(host);
    h.reply(U_CREATE, unknown);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    expect(pinField(host)!.value).toBe('');
    expect(usernameField(host)!.value).toBe('');
    expect(passwordField(host)!.value).toBe('');
    reread.deliver(staffList());
    await h.settle();
  });

  it('(c) the same for a reactivation-PIN form', async () => {
    const host = await open();
    h.reply(U_REACTIVATE, duplicate('pin'));
    tap(named(host, 'Reactivate — R. Sari'));
    await h.settle();
    typeInto(pinField(host)!, MARKER_PIN);
    h.reply(U_REACTIVATE, userChanged);
    const reread = h.hold(READ);
    tap(named(host, 'Reactivate with new PIN'));
    await h.settle();
    expect(pinField(host)!.value).toBe('');
    reread.deliver(staffList());
    await h.settle();
    expect(MARKER_USERNAME + MARKER_PASSWORD + SARI.name).not.toBe('');
  });
});

describe('R2. the panel refits whenever a render can move its top', () => {
  let top = 240;
  beforeEach(() => {
    top = 240;
    const rect = (t: number, b: number) => ({ top: t, bottom: b, height: b - t, left: 0, right: 0, width: 0, x: 0, y: t }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('bocontent')) return rect(0, 900);
      if (this.id === 'staff-editor') return rect(top, top + 100);
      return rect(0, 0);
    });
  });
  const pane = (host: HTMLElement) => host.querySelector<HTMLElement>('.bocontent')!;
  const maxHeight = () => document.querySelector<HTMLElement>('#staff-editor')!.style.maxHeight;

  it('after a same-manager recovery from M-6', async () => {
    const host = await open();
    pane(host).style.paddingBottom = '24px';
    tap(named(host, 'Add person'));
    expect(maxHeight()).toBe('636px');
    await goIdle(h, host);
    top = 340;
    await resume(h, host);
    expect(maxHeight()).toBe('536px');
  });

  it('after a partial list’s successful Try again', async () => {
    const host = await open();
    pane(host).style.paddingBottom = '24px';
    await reachPartial(h, host);
    tap(named(host, 'Add person'));
    expect(maxHeight()).toBe('636px');
    top = 340;
    h.reply(READ, staffList());
    tap(named(host, 'Try again'));
    await h.settle();
    expect(maxHeight()).toBe('536px');
  });
});

describe('R3. recovery from M-6 focuses the first field of an ordinary open form', () => {
  it.each([
    ['Classification', (host: HTMLElement) => classificationField(host)!],
    ['Name', (host: HTMLElement) => nameField(host)!],
    ['New PIN', (host: HTMLElement) => pinField(host)!],
  ])('with the prior focus on %s', async (_label, prior) => {
    const host = await open();
    tap(named(host, 'Add person'));
    choose(classificationField(host)!, 'CASHIER');
    prior(host).focus();
    await goIdle(h, host);
    await resume(h, host);
    expect(focused()).toBe(nameField(host));
  });
});
