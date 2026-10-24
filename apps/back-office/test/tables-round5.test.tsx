// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { mount, refusal, text } from './session-harness.js';
import { DEACTIVATE, LIST, T1, T2, T3, harness, named, openScreens, pageStatus, tables, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Round 2 of PHASE1-S3b, F1 applied to BO-05's `load`: a reread that a newer visit read has
// superseded must not claim the list was refreshed when the list on screen is not.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const rail = (host: HTMLElement) => host.querySelector<HTMLElement>('.bonav')!;
const back = () =>
  act(() => {
    window.history.pushState(null, '', '/back-office/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

async function superseded() {
  h = harness();
  view = await openScreens(h);
  const host = view.host;
  h.reply(DEACTIVATE, failure);
  const older = h.hold(LIST);
  tap(named(host, 'Deactivate Table 1'));
  await h.settle();
  back();
  const newer = h.hold(LIST);
  tap(named(rail(host), 'Tables'));
  await h.settle();
  expect(h.count(LIST)).toBe(3);
  return { host, older, newer };
}

describe('F1. the sentence matches the list on screen when a newer read supersedes the reread', () => {
  it('the older reread succeeds after the newer visit read fails: “could not be refreshed”', async () => {
    const { host, older, newer } = await superseded();
    newer.deliver(failure);
    await h.settle();
    older.deliver(tables(T1, T2, T3));
    await h.settle();
    expect(text(pageStatus(host))).toBe(
      'Table 1: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.'
    );
    expect(host.querySelector('table')).toBeNull();
    expect(h.count(DEACTIVATE)).toBe(1);
    expect(h.count(LIST)).toBe(3);
  });

  it('the newer visit read succeeds after the older reread fails: “has been refreshed”', async () => {
    const { host, older, newer } = await superseded();
    newer.deliver(tables(T1, T2, T3));
    await h.settle();
    older.deliver(failure);
    await h.settle();
    expect(text(pageStatus(host))).toBe(
      'Table 1: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.'
    );
    expect(host.querySelector('table')).not.toBeNull();
    expect(h.count(DEACTIVATE)).toBe(1);
    expect(h.count(LIST)).toBe(3);
  });
});
