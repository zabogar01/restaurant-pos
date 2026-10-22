// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { mount, refusal, text } from './session-harness.js';
import {
  LIST, T1, T2, T3, UPDATE,
  harness, labelField, named, openScreens, pageStatus, rowLabels, table, tables, tap, typeInto,
} from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Round 4 of PHASE1-S1b: the re-review's N1 and N2, each the review's own scenario.

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

describe('N1. a failed visit read keeps a success that answered after it began', () => {
  it('Window 1 stays drawn with its Edit, the alert is present, no counts, New table live, focus not moved', async () => {
    h = harness('/back-office/');
    view = await openScreens(h);
    const host = view.host;
    tap(named(rail(host), 'Tables'));
    await h.settle();
    back();

    const visit = h.hold(LIST);
    tap(named(rail(host), 'Tables'));
    await h.settle();
    expect(rowLabels(host)).toEqual(['Table 1', 'Table 2', 'Terrace 1']);

    tap(named(host, 'Edit Table 1 — active'));
    typeInto(labelField(host)!, 'Window 1');
    h.reply(UPDATE, table({ ...T1, label: 'Window 1' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Window 1 saved.');
    const focused = document.activeElement;

    visit.deliver(failure);
    await h.settle();

    expect(rowLabels(host)).toContain('Window 1');
    expect(named(host, 'Edit Window 1 — active')).toBeTruthy();
    expect(text(host.querySelector('[role="alert"]'))).toBe(
      'The list may be out of dateTables could not be read again. The rows below are the ones this page knows, including your latest change. Try again to read the full list.Try again'
    );
    expect(host.querySelector('#table-count')).toBeNull();
    expect(named(host, 'New table').hasAttribute('aria-disabled')).toBe(false);
    expect(document.activeElement).toBe(focused);
  });

  it('with no answer after the read began, a failure behaves as before: the list is withheld', async () => {
    h = harness('/back-office/');
    view = await openScreens(h);
    const host = view.host;
    tap(named(rail(host), 'Tables'));
    await h.settle();
    back();
    h.reply(LIST, failure);
    tap(named(rail(host), 'Tables'));
    await h.settle();
    expect(host.querySelector('table')).toBeNull();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe('N2. every visit sends its own read, and the newest decides', () => {
  it.each([
    ['the newest settles first', ['third', 'second']],
    ['the older settles first', ['second', 'third']],
  ] as const)('two returns with the earlier read still out: three reads, Window 5 once the newest settles (%s)', async (_name, order) => {
    h = harness('/back-office/');
    view = await openScreens(h);
    const host = view.host;
    tap(named(rail(host), 'Tables'));
    await h.settle();
    expect(h.count(LIST)).toBe(1);

    back();
    const second = h.hold(LIST);
    tap(named(rail(host), 'Tables'));
    await h.settle();
    back();
    const third = h.hold(LIST);
    tap(named(rail(host), 'Tables'));
    await h.settle();
    expect(h.count(LIST)).toBe(3);

    const extra = { tableId: '55555555-5555-4555-8555-555555555555', label: 'Window 5', isActive: true };
    const answers = { second: tables(T1, T2, T3), third: tables(T1, T2, T3, extra) };
    const held = { second, third };
    for (const which of order) {
      held[which].deliver(answers[which]);
      await h.settle();
    }
    expect(rowLabels(host)).toContain('Window 5');
    expect(h.count(LIST)).toBe(3);
  });
});
