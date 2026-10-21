// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { HEALTH, ME, VIEW, mount, ok, refusal, sessionState, text } from './session-harness.js';
import {
  CREATE, DEACTIVATE, LIST, REACTIVATE, T1, T2, T3, UPDATE,
  configCalls, formNotice, harness, labelField, named, openScreens, pageStatus, panel, panelName,
  rowLabels, table, tables, tap, typeInto,
} from './tables-support.js';
import { Screens } from '../src/Screens.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-05 against stubbed responses (PHASE1-S1b): the states of the list, the form, the four
// commands, the placement of errors on the field, the result table of consult C2 section 6,
// and one command at a time. The departure decision, the dialog rule and the identity cases
// are in tables-departure.test.tsx; the same cases in a browser are e2e/tests/tables.spec.ts.
// Every sentence is a row of DESIGN-017's copy table.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const open = async (first?: Parameters<typeof openScreens>[1]) => {
  h = harness();
  view = await openScreens(h, first);
  return view.host;
};

/** Opens the form for a new table and types the label. */
async function startCreate(host: HTMLElement, typed: string) {
  tap(named(host, 'New table'));
  typeInto(labelField(host)!, typed);
}

const failure = refusal('INTERNAL', undefined, 500);
const DUPLICATE = refusal('DUPLICATE', undefined, 409);

describe('AC 1. the rail and the route', () => {
  it('shows Tables under Configuration, and pressing it shows BO-05 at its manifest path', async () => {
    h = harness('/back-office/');
    view = await openScreens(h);
    const { host } = view;
    expect(sessionState(host)).toBe('signed-in');
    const rail = host.querySelector('.bonav')!;
    expect(rail.querySelector('[role="group"] .bonav__sec')!.textContent).toBe('Configuration');
    expect(host.querySelector('h1')).toBeNull();
    expect(configCalls(h)).toEqual([]);

    tap(named(rail as HTMLElement, 'Tables'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/tables');
    expect(host.querySelector('h1')!.textContent).toBe('Tables');
    expect(named(rail as HTMLElement, 'Tables').getAttribute('aria-current')).toBe('page');
    expect(configCalls(h)).toEqual([LIST]);
  });

  it('replaces a path that names no screen with the landing, dropping the query', async () => {
    h = harness('/back-office/nowhere?draft=1');
    view = await openScreens(h);
    expect(window.location.pathname).toBe('/back-office/');
    expect(window.location.search).toBe('');
    expect(view.host.querySelector('h1')).toBeNull();
  });

  it('a reload at the Tables path signs in to BO-05', async () => {
    const host = await open();
    expect(host.querySelector('h1')!.textContent).toBe('Tables');
    expect(text(host.querySelector('#table-count'))).toBe('2 active · 1 inactive');
  });
});

describe('AC 3. the states of the list', () => {
  it('says "Loading tables…" while the read is out', async () => {
    h = harness();
    h.reply(ME, ok(VIEW));
    const held = h.hold(LIST);
    view = mount(h.store, <Screens />);
    await h.settle();
    expect(text(view.host.querySelector('[role="status"]'))).toBe('Loading tables…');
    expect(view.host.querySelector('table')).toBeNull();
    held.deliver(tables(T1));
    await h.settle();
    expect(view.host.querySelector('table')).not.toBeNull();
    expect(view.host.textContent).not.toContain('Loading tables…');
  });

  it('is the empty first-run state when the list is empty, with one New table action', async () => {
    const host = await open(tables());
    expect(text(host.querySelector('.office-empty-title'))).toBe('No tables yet');
    expect(host.textContent).toContain('Create your first table to set up the floor.');
    expect(host.querySelector('table')).toBeNull();
    expect([...host.querySelectorAll('button')].filter((b) => b.textContent === 'New table')).toHaveLength(1);
  });

  it('shows the failed state, and Try again repeats the read and only the read', async () => {
    h = harness();
    h.reply(ME, ok(VIEW));
    h.reply(LIST, failure, tables(T1));
    view = mount(h.store, <Screens />);
    await h.settle();
    const host = view.host;
    const alert = host.querySelector('[role="alert"]')!;
    expect(text(alert)).toBe('Tables could not be loadedTry again to read the table list.Try again');
    expect(host.querySelector('table')).toBeNull();

    tap(named(host, 'Try again'));
    await h.settle();
    expect(configCalls(h)).toEqual([LIST, LIST]);
    expect(rowLabels(host)).toEqual(['Table 1']);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('lists active tables first, then inactive, each in natural case-insensitive order, with counts', async () => {
    const rows = [
      { ...T1, tableId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', label: 'T10' },
      { ...T1, tableId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', label: 'T2' },
      { ...T1, tableId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', label: 'bar' },
      { ...T3, tableId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', label: 'Annex' },
      { ...T3, tableId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', label: 'Annex' },
      { ...T1, tableId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', label: 'Bar' },
    ];
    const host = await open(tables(...rows));
    // Ties (Bar and bar; the two Annex) fall back to the id.
    expect(rowLabels(host)).toEqual(['bar', 'Bar', 'T2', 'T10', 'Annex', 'Annex']);
    expect(text(host.querySelector('#table-count'))).toBe('4 active · 2 inactive');
    expect(text(host.querySelector('caption'))).toBe('Active tables first · Labels in order');
    expect([...host.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Label', 'Status', 'Actions']);
  });

  it('names each row action by its row, and says active or inactive in the name', async () => {
    const host = await open();
    for (const name of [
      'Edit Table 1 — active', 'Deactivate Table 1', 'Edit Table 2 — active', 'Edit Terrace 1 — inactive', 'Reactivate Terrace 1',
    ]) {
      expect(named(host, name)).toBeTruthy();
    }
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(host.querySelector('tbody tr:last-child')!.textContent).toContain('Inactive');
  });

  it('creates a table: the form names itself, the record answered is inserted, and nothing is reread', async () => {
    const host = await open();
    tap(named(host, 'New table'));
    const form = panel(host)!;
    expect(panelName(host)).toBe('New table');
    expect(form.getAttribute('role')).toBe('dialog');
    expect(form.getAttribute('aria-modal')).toBe('false');
    expect(form.textContent).toContain('Choose the label staff will see on the floor.');
    expect(form.textContent).toContain('1–32 characters. Active tables must have different labels.');
    expect(document.activeElement).toBe(labelField(host));
    expect(host.querySelector('label[for="table-label"]')!.textContent).toBe('Table label');

    typeInto(labelField(host)!, '  Window 2 ');
    const created = { tableId: '44444444-4444-4444-8444-444444444444', label: 'Window 2', isActive: true };
    h.reply(CREATE, table(created));
    tap(named(host, 'Save'));
    await h.settle();

    expect(h.keyed(CREATE)).toHaveLength(1);
    expect(h.keyed(CREATE)[0]!.body).toBe('{"label":"Window 2"}');
    expect(panel(host)).toBeNull();
    expect(rowLabels(host)).toEqual(['Table 1', 'Table 2', 'Window 2', 'Terrace 1']);
    expect(text(pageStatus(host))).toBe('Window 2 saved.');
    expect(document.activeElement).toBe(named(host, 'Edit Window 2 — active'));
    expect(configCalls(h)).toEqual([LIST, CREATE]);
  });

  it('renames an active table: the form is named for it, and the record answered replaces its row', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 2 — active'));
    expect(panelName(host)).toBe('Edit Table 2');
    expect(panel(host)!.textContent).toContain('Active table. Changes keep this table’s history.');
    expect(labelField(host)!.value).toBe('Table 2');
    typeInto(labelField(host)!, 'Window 2');
    h.reply(UPDATE, table({ ...T2, label: 'Window 2' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.keyed(UPDATE)[0]!.body).toBe(JSON.stringify({ tableId: T2.tableId, label: 'Window 2' }));
    expect(rowLabels(host)).toEqual(['Table 1', 'Window 2', 'Terrace 1']);
    expect(text(pageStatus(host))).toBe('Window 2 saved.');
    expect(document.activeElement).toBe(named(host, 'Edit Window 2 — active'));
  });

  it('renames an inactive table without reactivating it', async () => {
    const host = await open();
    tap(named(host, 'Edit Terrace 1 — inactive'));
    expect(panel(host)!.textContent).toContain('Inactive table. Saving its label does not reactivate it.');
    typeInto(labelField(host)!, 'Terrace 9');
    h.reply(UPDATE, table({ ...T3, label: 'Terrace 9' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(rowLabels(host)).toEqual(['Table 1', 'Table 2', 'Terrace 9']);
    expect(h.count(REACTIVATE)).toBe(0);
    expect(named(host, 'Reactivate Terrace 9')).toBeTruthy();
  });

  it('deactivates with no form: pending in the page status, then the record answered', async () => {
    const host = await open();
    const held = h.hold(DEACTIVATE);
    tap(named(host, 'Deactivate Table 1'));
    await h.settle();
    expect(panel(host)).toBeNull();
    expect(text(pageStatus(host))).toBe('Deactivating Table 1…');
    expect(document.activeElement).toBe(pageStatus(host));
    expect(h.keyed(DEACTIVATE)[0]!.body).toBe(JSON.stringify({ tableId: T1.tableId }));

    held.deliver(table({ ...T1, isActive: false }));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Table 1 deactivated. It is kept for history.');
    expect(rowLabels(host)).toEqual(['Table 2', 'Table 1', 'Terrace 1']);
    expect(text(host.querySelector('#table-count'))).toBe('1 active · 2 inactive');
    expect(document.activeElement).toBe(named(host, 'Edit Table 1 — inactive'));
    expect(configCalls(h)).toEqual([LIST, DEACTIVATE]);
  });

  it('reactivates with no form, and the row becomes active', async () => {
    const host = await open();
    const held = h.hold(REACTIVATE);
    tap(named(host, 'Reactivate Terrace 1'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Reactivating Terrace 1…');
    held.deliver(table({ ...T3, isActive: true }));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Terrace 1 reactivated.');
    expect(rowLabels(host)).toEqual(['Table 1', 'Table 2', 'Terrace 1']);
    expect(text(host.querySelector('#table-count'))).toBe('3 active · 0 inactive');
    expect(document.activeElement).toBe(named(host, 'Edit Terrace 1 — active'));
  });

  it('clears the page result when a form opens or a command is sent', async () => {
    const host = await open();
    h.reply(DEACTIVATE, table({ ...T1, isActive: false }));
    tap(named(host, 'Deactivate Table 1'));
    await h.settle();
    expect(pageStatus(host)).not.toBeNull();
    tap(named(host, 'Edit Table 2 — active'));
    expect(pageStatus(host)).toBeNull();
  });
});

describe('AC 4. validation is placed on the field, before anything is sent', () => {
  it.each([
    ['empty', '', 'Enter a table label.'],
    ['blank', '    ', 'Enter a table label.'],
    ['over-long (33 units)', 'x'.repeat(33), 'Use 32 characters or fewer.'],
    ['holding a control character (U+0007)', 'Table\u0007 2', 'Remove control characters from the label.'],
  ])('a %s label sends nothing, marks the field invalid with its sentence, and focuses it', async (_name, typed, sentence) => {
    const host = await open();
    await startCreate(host, typed);
    tap(named(host, 'Save'));
    await h.settle();

    expect(h.count(CREATE)).toBe(0);
    expect(configCalls(h)).toEqual([LIST]);
    const field = labelField(host)!;
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(text(host.querySelector('#label-error'))).toBe(sentence);
    expect(field.getAttribute('aria-describedby')).toBe('label-error label-help');
    expect(document.activeElement).toBe(field);
    // Nothing from zod, no value, no key: the sentence is the design's alone.
    expect(host.querySelector('#label-error')!.textContent).not.toContain(typed.trim() || '\u0000');
    expect(host.textContent).not.toMatch(/too (small|big)|invalid (input|string)|expected|unrecognized/i);

    // Editing the field clears its error and its reference.
    typeInto(field, 'ok');
    expect(host.querySelector('#label-error')).toBeNull();
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    expect(field.getAttribute('aria-describedby')).toBe('label-help');
  });

  it('checks the trimmed value: 32 units pass, the draft is trimmed in the field, nothing is truncated', async () => {
    const host = await open();
    const exact = 'Terrace ABCDEFGHIJKLMNOPQRSTUVWX';
    expect(exact).toHaveLength(32);
    await startCreate(host, `  ${exact}  `);
    h.reply(CREATE, table({ tableId: '55555555-5555-4555-8555-555555555555', label: exact, isActive: true }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(JSON.parse(h.keyed(CREATE)[0]!.body!)).toEqual({ label: exact });
  });

  it('rename validates the same way and sends no tableId on its own', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 2 — active'));
    typeInto(labelField(host)!, '');
    tap(named(host, 'Save'));
    expect(h.count(UPDATE)).toBe(0);
    expect(text(host.querySelector('#label-error'))).toBe('Enter a table label.');
  });
});

describe('AC 5. DUPLICATE keeps the draft, places the refusal on the label and rereads the list', () => {
  it('on a create: the sentence is under the label, the draft is kept, the list is read again, and the holder is marked', async () => {
    const host = await open(tables(T1, T3));
    await startCreate(host, 'table 1');
    h.reply(CREATE, DUPLICATE);
    tap(named(host, 'Save'));
    await h.settle();

    expect(text(host.querySelector('#label-error'))).toBe('An active table already uses this label. Choose another label.');
    expect(labelField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(labelField(host)!.value).toBe('table 1');
    expect(document.activeElement).toBe(labelField(host));
    expect(panelName(host)).toBe('New table');
    expect(configCalls(h)).toEqual([LIST, CREATE, LIST]);
    // The holder carries visible text in its label cell, and it is not a link.
    const holder = [...host.querySelectorAll('tbody tr')].find((tr) => tr.textContent!.includes('Label in use'))!;
    expect(holder.querySelector('td')!.textContent).toBe('Table 1Label in use');
    expect(holder.querySelector('a')).toBeNull();
    expect(host.textContent).not.toContain('DUPLICATE');

    // Editing the label lifts the error and the marker; sending again is the manager's own press.
    typeInto(labelField(host)!, 'table 11');
    expect(host.textContent).not.toContain('Label in use');
  });

  it('on a rename: the same, on the label of the table being edited', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 2 — active'));
    typeInto(labelField(host)!, 'Table 1');
    h.reply(UPDATE, DUPLICATE);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(host.querySelector('#label-error'))).toBe('An active table already uses this label. Choose another label.');
    expect(panelName(host)).toBe('Edit Table 2');
    expect(h.count(LIST)).toBe(2);
    expect(host.querySelectorAll('tbody tr')[0]!.textContent).toContain('Label in use');
  });

  it('on a refused reactivation: opens that inactive table’s own label with the recovery sentence', async () => {
    const host = await open(tables(T1, { ...T3, label: 'Table 1' }));
    h.reply(REACTIVATE, DUPLICATE);
    tap(named(host, 'Reactivate Table 1'));
    await h.settle();

    expect(panelName(host)).toBe('Edit Table 1');
    expect(panel(host)!.textContent).toContain('Inactive table. Saving its label does not reactivate it.');
    expect(text(host.querySelector('#label-error'))).toBe(
      'An active table already uses this label. Rename this inactive table, save, then reactivate it.'
    );
    expect(document.activeElement).toBe(labelField(host));
    expect(labelField(host)!.value).toBe('Table 1');
    expect(h.count(LIST)).toBe(2);
    // Save renames only; the manager separately presses Reactivate on the row.
    typeInto(labelField(host)!, 'Terrace 1');
    h.reply(UPDATE, table({ ...T3, label: 'Terrace 1' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(REACTIVATE)).toBe(1);
    expect(rowLabels(host)).toEqual(['Table 1', 'Terrace 1']);
  });

  it.each([
    ['NOT_FOUND', refusal('NOT_FOUND', undefined, 404), 2],
    ['VALIDATION_FAILED', refusal('VALIDATION_FAILED', undefined, 400), 1],
    ['CSRF_REFUSED after its retry', refusal('ORIGIN_REFUSED', undefined, 403), 1],
  ])('%s is the general failure with the draft kept (%i list reads)', async (_name, answer, reads) => {
    const host = await open();
    await startCreate(host, 'Window 2');
    h.reply(CREATE, answer);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toBe('Something went wrongNothing was saved. Your draft is kept. Press Save to try again.');
    expect(formNotice(host)!.getAttribute('role')).toBe('alert');
    expect(labelField(host)!.value).toBe('Window 2');
    expect(document.activeElement).toBe(labelField(host));
    expect(h.count(LIST)).toBe(reads);
    expect(h.count(CREATE)).toBe(1);
    expect([...panel(host)!.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Cancel', 'Save']);
  });

  it('a status command refused NOT_FOUND or answered with a general failure says so in the page status', async () => {
    const host = await open();
    h.reply(DEACTIVATE, refusal('NOT_FOUND', undefined, 404));
    tap(named(host, 'Deactivate Table 1'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Something went wrong. Table 1 was not changed. Use its row action to try again.');
    expect(panel(host)).toBeNull();
    expect(h.count(LIST)).toBe(2);
    expect(document.activeElement).toBe(pageStatus(host));
  });
});

describe('AC 6. an outcome that could not be confirmed', () => {
  it.each([
    ['answered 500 while health answers 200', failure, { status: 200, body: { status: 'ok' } }],
    ['with no response while health is unreachable', 'reject' as const, { status: 503 }],
  ])('a create %s keeps the draft, rereads once, sends no second command and offers no resend', async (_name, answer, health) => {
    const host = await open();
    await startCreate(host, 'Window 2');
    h.reply(CREATE, answer);
    h.reply(HEALTH, health);
    tap(named(host, 'Save'));
    await h.settle();

    expect(h.count(CREATE)).toBe(1);
    expect(configCalls(h)).toEqual([LIST, CREATE, LIST]);
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedThe outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again.'
    );
    expect(formNotice(host)!.getAttribute('role')).toBe('status');
    expect(labelField(host)!.value).toBe('Window 2');
    expect(document.activeElement).toBe(labelField(host));
    expect([...panel(host)!.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Cancel', 'Save']);
    // No timer, no event and no time passing sends it again.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await h.advance(60_000);
    expect(h.count(CREATE)).toBe(1);
  });

  it('never infers success from the reread, even when the list now holds the label', async () => {
    const host = await open();
    await startCreate(host, 'Window 2');
    h.reply(CREATE, failure);
    h.reply(LIST, tables(T1, T2, T3, { tableId: '44444444-4444-4444-8444-444444444444', label: 'Window 2', isActive: true }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(rowLabels(host)).toContain('Window 2');
    expect(text(formNotice(host))).toContain('Outcome not confirmed');
    expect(panel(host)).not.toBeNull();
    expect(pageStatus(host)).toBeNull();
    expect(host.textContent).not.toContain('Window 2 saved.');
  });

  it('when the reread fails too, says the list could not be refreshed, and Try again repeats the read only', async () => {
    const host = await open();
    await startCreate(host, 'Window 2');
    h.reply(CREATE, failure);
    // The first read has been answered; the reread fails, and the read after it succeeds.
    h.reply(LIST, failure, tables(T1, T2, T3));
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedThe outcome could not be confirmed. The list could not be refreshed. Your draft is kept; nothing was sent again.'
    );
    expect(host.querySelector('table')).toBeNull();
    expect(text(host.querySelector('[role="alert"]'))).toContain('Tables could not be loaded');

    tap(named(host, 'Try again'));
    await h.settle();
    expect(h.count(CREATE)).toBe(1);
    expect(h.count(LIST)).toBe(3);
    expect(host.querySelector('table')).not.toBeNull();
    expect(text(formNotice(host))).toContain('The list has been refreshed.');
    expect(labelField(host)!.value).toBe('Window 2');
    expect(document.activeElement).toBe(labelField(host));
  });

  it('a status command with no confirmation is a page status, with nothing sent again', async () => {
    const host = await open();
    h.reply(DEACTIVATE, failure);
    h.reply(LIST, tables({ ...T1, isActive: false }, T2, T3));
    tap(named(host, 'Deactivate Table 1'));
    await h.settle();
    expect(h.count(DEACTIVATE)).toBe(1);
    expect(configCalls(h)).toEqual([LIST, DEACTIVATE, LIST]);
    expect(text(pageStatus(host))).toBe(
      'Table 1: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.'
    );
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(pageStatus(host));
    // The row action reflects the reread record and is the one explicit path.
    expect(named(host, 'Reactivate Table 1')).toBeTruthy();
    expect(host.textContent).not.toMatch(/\bsave\b|draft/i);
  });

  it('a status command whose reread also fails says the list could not be refreshed; Try again reads only', async () => {
    const host = await open();
    h.reply(DEACTIVATE, failure);
    h.reply(LIST, failure, tables(T1, T2, T3));
    tap(named(host, 'Deactivate Table 1'));
    await h.settle();
    expect(text(pageStatus(host))).toBe(
      'Table 1: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.'
    );
    tap(named(host, 'Try again'));
    await h.settle();
    expect(h.count(DEACTIVATE)).toBe(1);
    expect(text(pageStatus(host))).toContain('The list has been refreshed.');
  });
});

describe('AC 7. one command at a time', () => {
  it('a second Save press while a command is pending sends nothing', async () => {
    const host = await open();
    await startCreate(host, 'Window 2');
    const held = h.hold(CREATE);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toBe('Saving…Wait for the result. Your draft is kept.');
    expect(document.activeElement).toBe(formNotice(host));
    expect(named(host, 'Save').getAttribute('aria-disabled')).toBe('true');
    expect(named(host, 'Save').hasAttribute('disabled')).toBe(false);
    expect(labelField(host)!.disabled).toBe(true);

    tap(named(host, 'Save'));
    act(() => {
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await h.settle();
    expect(h.count(CREATE)).toBe(1);

    held.deliver(table({ tableId: '44444444-4444-4444-8444-444444444444', label: 'Window 2', isActive: true }));
    await h.settle();
    expect(h.count(CREATE)).toBe(1);
    expect(panel(host)).toBeNull();
  });

  it('while any command is pending, New table and every row action are inert', async () => {
    const host = await open();
    const held = h.hold(DEACTIVATE);
    tap(named(host, 'Deactivate Table 1'));
    await h.settle();
    for (const name of ['New table', 'Edit Table 2 — active', 'Deactivate Table 2', 'Reactivate Terrace 1', 'Deactivate Table 1']) {
      const el = named(host, name);
      expect(el.getAttribute('aria-disabled'), name).toBe('true');
      expect(el.hasAttribute('disabled'), name).toBe(false);
      tap(el);
    }
    await h.settle();
    expect(panel(host)).toBeNull();
    expect(configCalls(h)).toEqual([LIST, DEACTIVATE]);

    held.deliver(table({ ...T1, isActive: false }));
    await h.settle();
    expect(named(host, 'New table').hasAttribute('aria-disabled')).toBe(false);
  });

  it('after an unknown outcome they are live again, and another record goes through the decision', async () => {
    const host = await open();
    tap(named(host, 'Edit Table 1 — active'));
    typeInto(labelField(host)!, 'Window 1');
    h.reply(UPDATE, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toContain('Outcome not confirmed');
    expect(named(host, 'Edit Table 2 — active').hasAttribute('aria-disabled')).toBe(false);

    tap(named(host, 'Edit Table 2 — active'));
    const decision = document.querySelector<HTMLDialogElement>('dialog[open]')!;
    expect(text(decision.querySelector('h2'))).toBe('Discard unsaved changes?');
    expect(text(decision.querySelector('#departure-copy'))).toBe(
      'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.'
    );
    tap(named(decision, 'Discard'));
    await h.settle();
    expect(panelName(host)).toBe('Edit Table 2');
    expect(labelField(host)!.value).toBe('Table 2');
    expect(document.activeElement).toBe(labelField(host));
    expect(h.count(UPDATE)).toBe(1);
  });
});
