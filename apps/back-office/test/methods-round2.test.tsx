// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { refusal, text } from './session-harness.js';
import {
  BANK, GOPAY2, METHODS, M_CREATE, M_DEACTIVATE, QRIS, errorOf, makeMethod, methodNameField, methodRow, methodsStatus,
  methodsView, openSettings, settingsHarness, typeIn,
} from './settings-support.js';
import { named, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Round 2 of PHASE1-S3b: the review's F1 (a superseded reread must not claim the list was
// refreshed) and F2/L1 (the holder marker compares as the server's lower(name) index does).

let h: ReturnType<typeof settingsHarness>;
let view: Awaited<ReturnType<typeof openSettings>> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const DUPLICATE = refusal('DUPLICATE', undefined, 409);
const rail = (host: HTMLElement) => host.querySelector<HTMLElement>('.bonav')!;
const back = () =>
  act(() => {
    window.history.pushState(null, '', '/back-office/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

describe('F1. the sentence matches the list on screen when a newer read supersedes the reread', () => {
  /** An unknown deactivate whose reread is out, then a newer visit read. Returns both holds. */
  async function superseded() {
    h = settingsHarness();
    view = await openSettings(h, undefined, methodsView(QRIS, BANK, GOPAY2));
    const host = view.host;
    h.reply(M_DEACTIVATE, failure);
    const older = h.hold(METHODS);
    tap(named(host, 'Deactivate GoPay 2'));
    await h.settle();
    back();
    const newer = h.hold(METHODS);
    tap(named(rail(host), 'Settings'));
    await h.settle();
    expect(h.count(METHODS)).toBe(3);
    return { host, older, newer };
  }

  it('the older reread succeeds after the newer visit read fails: “could not be refreshed”', async () => {
    const { host, older, newer } = await superseded();
    newer.deliver(failure);
    await h.settle();
    older.deliver(methodsView(QRIS, BANK, GOPAY2));
    await h.settle();
    expect(text(methodsStatus(host))).toBe(
      'GoPay 2: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.'
    );
    expect(host.querySelector('#methods-list')).toBeNull();
    expect(h.count(M_DEACTIVATE)).toBe(1);
    expect(h.count(METHODS)).toBe(3);
  });

  it('the newer visit read succeeds after the older reread fails: “has been refreshed”', async () => {
    const { host, older, newer } = await superseded();
    newer.deliver(methodsView(QRIS, BANK, GOPAY2));
    await h.settle();
    older.deliver(failure);
    await h.settle();
    expect(text(methodsStatus(host))).toBe(
      'GoPay 2: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.'
    );
    expect(host.querySelector('#methods-list')).not.toBeNull();
    expect(h.count(M_DEACTIVATE)).toBe(1);
    expect(h.count(METHODS)).toBe(3);
  });
});

describe('F2 and L1. the holder marker', () => {
  it('with active Cafe and Café, a DUPLICATE for cafe marks only Cafe', async () => {
    h = settingsHarness();
    const cafe = makeMethod(7, 'Cafe', true);
    const accent = makeMethod(8, 'Café', true);
    view = await openSettings(h, undefined, methodsView(cafe, accent));
    const host = view.host;
    tap(named(host, 'New payment method'));
    typeIn(methodNameField(host)!, 'cafe');
    h.reply(M_CREATE, DUPLICATE);
    tap(host.querySelector<HTMLElement>('#save-method')!);
    await h.settle();
    expect(errorOf(host, 'method')).not.toBeNull();
    expect(host.querySelectorAll('.table-holder')).toHaveLength(1);
    expect(text(methodRow(host, 'Cafe').querySelector('td'))).toBe('CafeName in use');
    expect(text(methodRow(host, 'Café').querySelector('td'))).toBe('Café');
  });
});
