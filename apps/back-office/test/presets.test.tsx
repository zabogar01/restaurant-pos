// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { pressEscape } from './dialog-shim.js';
import { mount, refusal, text } from './session-harness.js';
import { openDialogs, dialogNamed } from './tables-support.js';
import {
  ANNIVERSARY, BIRTHDAY, P_CREATE, P_DEACTIVATE, P_REACTIVATE, P_UPDATE, PRESETS, READ, REGULAR, STAFF,
  amountField, aria, bodyOf, byId, facts, fixed, formNotice, harness, nameField, named, newPercentDraft, openPresets,
  openPresetsHeld, pageStatus, panel, panelName, percent, percentField, preset, presetAnswer, presetCalls, presetList,
  discountOf, rail, reachPartial, rowNames, rowOf, tap, typeInto,
} from './presets-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-07 Discount presets (PHASE1-S6b): the rail and the route, the list and its order, the read
// states, the form's checks, the kind switch, and the four commands with their results. The
// version rules are in presets-versions.test.tsx, the departure and the session in
// presets-departure.test.tsx. jsdom has no top layer and no inertness; what only a browser shows
// is e2e/tests/presets.spec.ts.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const focused = () => document.activeElement;

const open = async (first?: Parameters<typeof openPresets>[1], path?: string) => {
  h = harness(path);
  view = await openPresets(h, first);
  return view.host;
};

describe('AC 1. the rail and the route', () => {
  it('lists Menu, Tables, Discount presets, Settings, with their paths', async () => {
    const host = await open();
    expect(text(rail(host))).toBe('ConfigurationMenuTablesDiscount presetsSettings');
    expect([...rail(host).querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/back-office/menu',
      '/back-office/tables',
      '/back-office/presets',
      '/back-office/settings',
    ]);
    expect(named(rail(host), 'Discount presets').getAttribute('aria-current')).toBe('page');
    expect(host.querySelector('h1')!.textContent).toBe('Discount presets');
  });

  it('a press on Discount presets from another screen opens BO-07, marks it current and sends one read', async () => {
    const host = await open(undefined, '/back-office/tables');
    expect(host.querySelector('h1')!.textContent).toBe('Tables');
    expect(h.count(READ)).toBe(0);
    tap(named(rail(host), 'Discount presets'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/presets');
    expect(host.querySelector('h1')!.textContent).toBe('Discount presets');
    expect(named(rail(host), 'Discount presets').getAttribute('aria-current')).toBe('page');
    expect(h.count(READ)).toBe(1);
  });
});

describe('AC 2. order and counts', () => {
  it('draws the active presets first and the inactive second, each in creation order, with the facts line', async () => {
    const host = await open(presetList(12));
    expect(rowNames(host)).toEqual(['Staff meal', 'Birthday', 'Anniversary', 'Regular customer']);
    expect(text(facts(host))).toBe('3 active · 1 inactive · Catalog version 12');
    // Each value sits above its kind.
    expect(discountOf(host, STAFF.presetId)).toEqual(['50%', 'Percentage']);
    expect(discountOf(host, BIRTHDAY.presetId)).toEqual(['12,3456%', 'Percentage']);
    expect(discountOf(host, ANNIVERSARY.presetId)).toEqual(['99.999.999', 'Fixed amount']);
    expect(discountOf(host, REGULAR.presetId)).toEqual(['10.000', 'Fixed amount']);
    expect(text(host.querySelector('#presets-list caption'))).toBe(
      'Active first · Oldest created first within each status · Fixed amounts in IDR'
    );
  });

  it('deactivating a preset moves it to the inactive group at the place its creation gives it', async () => {
    const host = await open(presetList(12));
    h.reply(P_DEACTIVATE, presetAnswer(13, { ...STAFF, isActive: false }));
    tap(named(host, 'Deactivate Staff meal'));
    tap(named(dialogNamed('Deactivate “Staff meal”?')!, 'Deactivate Staff meal'));
    await h.settle();
    expect(rowNames(host)).toEqual(['Birthday', 'Anniversary', 'Staff meal', 'Regular customer']);
  });

  it('a rename keeps the preset’s place and the client never sorts by name', async () => {
    const host = await open(presetList(12, [preset(1, 'Zebra', percent('1')), preset(2, 'Apple', percent('2'))]));
    expect(rowNames(host)).toEqual(['Zebra', 'Apple']);
    tap(named(host, 'Edit Apple — active'));
    h.reply(P_UPDATE, presetAnswer(13, preset(2, 'Aardvark', percent('2'))));
    typeInto(nameField(host)!, 'Aardvark');
    tap(named(host, 'Save'));
    await h.settle();
    expect(rowNames(host)).toEqual(['Zebra', 'Aardvark']);
  });
});

describe('AC 3. the read states', () => {
  it('Loading withholds the rows and the facts, and New preset is off', async () => {
    h = harness();
    const { view: v, held } = await openPresetsHeld(h);
    view = v;
    const host = v.host;
    expect(text(host.querySelector('#read-state'))).toBe('Loading discount presets…');
    expect(host.querySelector('#presets-list')).toBeNull();
    expect(facts(host)).toBeNull();
    expect(aria(named(host, 'New preset'))).toBe(true);
    held.deliver(presetList(12));
    await h.settle();
    expect(facts(host)).not.toBeNull();
    expect(aria(named(host, 'New preset'))).toBe(false);
  });

  it('a failed read shows the alert and withholds the facts; Try again sends one read and nothing else', async () => {
    const host = await open(failure);
    expect(text(host.querySelector('#read-state [role="alert"]'))).toBe(
      'Discount presets could not be loadedTry again to read the discount presets.Try again'
    );
    expect(facts(host)).toBeNull();
    expect(host.querySelector('#presets-list')).toBeNull();
    h.reply(READ, presetList(12));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(presetCalls(h)).toEqual([`${READ}`, `${READ}`]);
    expect(host.querySelector('#read-state')).toBeNull();
    expect(rowNames(host)).toHaveLength(4);
    expect(text(facts(host))).toBe('3 active · 1 inactive · Catalog version 12');
  });

  it('an empty read shows the empty state and New preset is live', async () => {
    const host = await open(presetList(0, []));
    expect(text(host.querySelector('#empty-state'))).toBe(
      'No presets yetUse New preset to create the first discount staff can choose.'
    );
    expect(text(facts(host))).toBe('0 active · 0 inactive · Catalog version 0');
    expect(aria(named(host, 'New preset'))).toBe(false);
  });
});

describe('AC 4. the form’s checks', () => {
  it('refuses an empty name with its sentence, marks the field, describes it, focuses it, and sends nothing', async () => {
    const host = await open();
    tap(named(host, 'New preset'));
    expect(panelName(host)).toBe('New preset');
    expect(focused()).toBe(nameField(host));
    typeInto(percentField(host)!, '10');
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(byId(host, '#preset-name-error'))).toBe('Enter a preset name.');
    expect(nameField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(nameField(host)!.getAttribute('aria-describedby')).toContain('preset-name-error');
    expect(focused()).toBe(nameField(host));
    expect(h.count(P_CREATE)).toBe(0);
  });

  it.each([
    ['', 'Enter a percentage.'],
    ['-1', 'Use 0 or more.'],
    ['1.000,5', 'Enter a number, such as 10 or 10,5.'],
    ['10,50000', 'Use at most four decimal places.'],
    ['100,0001', 'Use 100 or less.'],
  ])('a percentage of %j says %j, focuses the value and sends nothing', async (typed, sentence) => {
    const host = await open();
    newPercentDraft(host, 'Happy hour', typed);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(byId(host, '#preset-percent-error'))).toBe(sentence);
    expect(percentField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(percentField(host)!.getAttribute('aria-describedby')).toContain('preset-percent-error');
    expect(focused()).toBe(percentField(host));
    expect(h.count(P_CREATE)).toBe(0);
  });

  it.each([
    ['', 'Enter a fixed amount.'],
    ['-1', 'Use 0 or more.'],
    ['1000.5', 'Enter whole rupiah, such as 10.000.'],
    ['100.000.000', 'Use 99.999.999 or less.'],
  ])('a fixed amount of %j says %j, focuses the value and sends nothing', async (typed, sentence) => {
    const host = await open();
    tap(named(host, 'New preset'));
    typeInto(nameField(host)!, 'Gift');
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    typeInto(amountField(host)!, typed);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(byId(host, '#preset-amount-error'))).toBe(sentence);
    expect(amountField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(focused()).toBe(amountField(host));
    expect(h.count(P_CREATE)).toBe(0);
  });

  it('with the name and the value both wrong, both are marked and the name is focused', async () => {
    const host = await open();
    newPercentDraft(host, '   ', 'abc');
    tap(named(host, 'Save'));
    expect(text(byId(host, '#preset-name-error'))).toBe('Enter a preset name.');
    expect(text(byId(host, '#preset-percent-error'))).toBe('Enter a number, such as 10 or 10,5.');
    expect(focused()).toBe(nameField(host));
  });

  it('sends the trimmed name and the canonical value', async () => {
    const host = await open();
    h.reply(P_CREATE, presetAnswer(13, preset(9, 'Happy hour', percent('123456'))));
    newPercentDraft(host, '  Happy hour  ', '12,3456');
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_CREATE)).toEqual({ name: 'Happy hour', value: { kind: 'PERCENTAGE', ratePpm: '123456' } });
  });

  it('counts the name in code points: 32 emoji are accepted and 33 are refused', async () => {
    const host = await open();
    h.reply(P_CREATE, presetAnswer(13, preset(9, '🍽'.repeat(32), percent('1'))));
    newPercentDraft(host, '🍽'.repeat(33), '1');
    tap(named(host, 'Save'));
    expect(text(byId(host, '#preset-name-error'))).toBe('Use 32 characters or fewer.');
    expect(h.count(P_CREATE)).toBe(0);
    typeInto(nameField(host)!, '🍽'.repeat(32));
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(P_CREATE)).toBe(1);
  });

  it('a control character in the name is refused with its sentence', async () => {
    const host = await open();
    newPercentDraft(host, 'Staff\u0007 meal', '10');
    tap(named(host, 'Save'));
    expect(text(byId(host, '#preset-name-error'))).toBe('Remove control characters from the name.');
  });
});

describe('zero is accepted silently for both kinds (ruling 6)', () => {
  it('a create of 0% sends one request', async () => {
    const host = await open();
    h.reply(P_CREATE, presetAnswer(13, preset(9, 'Free', percent('0'))));
    newPercentDraft(host, 'Free', '0');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(P_CREATE)).toBe(1);
    expect(bodyOf(h, P_CREATE)).toEqual({ name: 'Free', value: { kind: 'PERCENTAGE', ratePpm: '0' } });
    expect(byId(host, '#preset-percent-error')).toBeNull();
  });

  it('a create of a fixed 0 sends one request', async () => {
    const host = await open();
    h.reply(P_CREATE, presetAnswer(13, preset(9, 'Zero', fixed('0'))));
    tap(named(host, 'New preset'));
    typeInto(nameField(host)!, 'Zero');
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    typeInto(amountField(host)!, '0');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(P_CREATE)).toBe(1);
    expect(bodyOf(h, P_CREATE)).toEqual({ name: 'Zero', value: { kind: 'FIXED', amount: '0' } });
  });
});

describe('AC 5. the kind switch', () => {
  it('keeps one buffer per kind, starts the other empty, focuses the new input, and sends the selected kind only', async () => {
    const host = await open();
    h.reply(P_CREATE, presetAnswer(13, preset(9, 'Gift', fixed('5000'))));
    tap(named(host, 'New preset'));
    typeInto(nameField(host)!, 'Gift');
    typeInto(percentField(host)!, '10');

    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    expect(percentField(host)).toBeNull();
    expect(amountField(host)!.value).toBe('');
    expect(focused()).toBe(amountField(host));
    typeInto(amountField(host)!, '5.000');

    tap(host.querySelector<HTMLElement>('#kind-percent')!);
    expect(percentField(host)!.value).toBe('10');
    expect(focused()).toBe(percentField(host));
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    expect(amountField(host)!.value).toBe('5.000');

    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_CREATE)).toEqual({ name: 'Gift', value: { kind: 'FIXED', amount: '5000' } });
  });

  it('the unused buffer is never validated: a bad percentage text does not block a fixed save', async () => {
    const host = await open();
    h.reply(P_CREATE, presetAnswer(13, preset(9, 'Gift', fixed('5000'))));
    tap(named(host, 'New preset'));
    typeInto(nameField(host)!, 'Gift');
    typeInto(percentField(host)!, 'not a number');
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    typeInto(amountField(host)!, '5000');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(P_CREATE)).toBe(1);
  });

  it('switching clears the value errors', async () => {
    const host = await open();
    newPercentDraft(host, 'Gift', 'abc');
    tap(named(host, 'Save'));
    expect(percentField(host)!.getAttribute('aria-invalid')).toBe('true');
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    tap(host.querySelector<HTMLElement>('#kind-percent')!);
    expect(percentField(host)!.hasAttribute('aria-invalid')).toBe(false);
    expect(byId(host, '#preset-percent-error')).toBeNull();
  });

  it('an edit of a percentage preset into a fixed amount sends the whole preset with the new kind', async () => {
    const host = await open();
    h.reply(P_UPDATE, presetAnswer(13, { ...STAFF, value: fixed('5000') }));
    tap(named(host, 'Edit Staff meal — active'));
    expect(percentField(host)!.value).toBe('50');
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    expect(amountField(host)!.value).toBe('');
    typeInto(amountField(host)!, '5.000');
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_UPDATE)).toEqual({
      presetId: STAFF.presetId,
      expectedVersion: 12,
      name: 'Staff meal',
      value: { kind: 'FIXED', amount: '5000' },
    });
    expect(discountOf(host, STAFF.presetId)).toEqual(['5.000', 'Fixed amount']);
  });

  it('Cancel on a dirty form meets the decision; Discard then reopening shows the saved record with the other buffer empty', async () => {
    const host = await open();
    tap(named(host, 'Edit Staff meal — active'));
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    typeInto(amountField(host)!, '5.000');
    tap(named(host, 'Cancel'));
    const decision = dialogNamed('Discard unsaved changes?')!;
    expect(decision).not.toBeNull();
    tap(named(decision, 'Discard'));
    expect(panel(host)).toBeNull();
    tap(named(host, 'Edit Staff meal — active'));
    expect(percentField(host)!.value).toBe('50');
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    expect(amountField(host)!.value).toBe('');
  });

  it('the kind switch alone makes the form dirty, and switching back to the opening kind and value makes it clean', async () => {
    const host = await open();
    tap(named(host, 'Edit Staff meal — active'));
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    tap(named(host, 'Cancel'));
    expect(dialogNamed('Discard unsaved changes?')).not.toBeNull();
    tap(named(dialogNamed('Discard unsaved changes?')!, 'Stay'));
    tap(host.querySelector<HTMLElement>('#kind-percent')!);
    tap(named(host, 'Cancel'));
    expect(dialogNamed('Discard unsaved changes?')).toBeNull();
    expect(panel(host)).toBeNull();
  });
});

describe('AC 6. create, edit, deactivate, reactivate', () => {
  it('a create sends { name, value }, applies the answered record, announces it, and focuses its Edit', async () => {
    const host = await open();
    const made = preset(9, 'Happy hour', percent('100000'));
    h.reply(P_CREATE, presetAnswer(13, made));
    newPercentDraft(host);
    tap(named(host, 'Save'));
    expect(text(formNotice(host))).toBe('Saving…Wait for the result. Your draft is kept.');
    expect(focused()).toBe(formNotice(host));
    await h.settle();
    expect(h.count(P_CREATE)).toBe(1);
    expect(presetCalls(h)).toEqual([READ, P_CREATE]);
    expect(panel(host)).toBeNull();
    expect(rowNames(host)).toEqual(['Staff meal', 'Birthday', 'Anniversary', 'Happy hour', 'Regular customer']);
    expect(text(pageStatus(host))).toBe('Happy hour saved.');
    expect(focused()).toBe(named(host, 'Edit Happy hour — active'));
    expect(text(facts(host))).toBe('4 active · 1 inactive · Catalog version 13');
  });

  it('an edit sends the whole preset under the version, applies the record in place, and focuses its Edit', async () => {
    const host = await open();
    h.reply(P_UPDATE, presetAnswer(13, { ...BIRTHDAY, name: 'Birthday treat', value: percent('150000') }));
    tap(named(host, 'Edit Birthday — active'));
    expect(panelName(host)).toBe('Edit Birthday');
    expect(nameField(host)!.value).toBe('Birthday');
    expect(percentField(host)!.value).toBe('12,3456');
    typeInto(nameField(host)!, 'Birthday treat');
    typeInto(percentField(host)!, '15');
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_UPDATE)).toEqual({
      presetId: BIRTHDAY.presetId,
      expectedVersion: 12,
      name: 'Birthday treat',
      value: { kind: 'PERCENTAGE', ratePpm: '150000' },
    });
    expect(h.count(P_UPDATE)).toBe(1);
    expect(text(pageStatus(host))).toBe('Birthday treat saved.');
    expect(focused()).toBe(named(host, 'Edit Birthday treat — active'));
    expect(panel(host)).toBeNull();
  });

  it('an edit of an inactive preset leaves it inactive and shows the Inactive preset sentence', async () => {
    const host = await open();
    h.reply(P_UPDATE, presetAnswer(13, { ...REGULAR, name: 'Regular guest' }));
    tap(named(host, 'Edit Regular customer — inactive'));
    expect(text(byId(host, '#form-context'))).toBe(
      'Inactive preset. Saving does not reactivate it. Changes apply only to discounts chosen afterwards. Orders already carrying this preset keep their saved name and value.'
    );
    typeInto(nameField(host)!, 'Regular guest');
    tap(named(host, 'Save'));
    await h.settle();
    expect(rowNames(host)).toEqual(['Staff meal', 'Birthday', 'Anniversary', 'Regular guest']);
    expect(rowOf(host, REGULAR.presetId).getAttribute('data-active')).toBe('false');
    expect(named(host, 'Reactivate Regular guest')).toBeTruthy();
  });

  it('an unchanged edit announces the unchanged sentence and writes no row change', async () => {
    const host = await open();
    h.reply(P_UPDATE, presetAnswer(12, STAFF));
    tap(named(host, 'Edit Staff meal — active'));
    typeInto(percentField(host)!, '50,0');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(P_UPDATE)).toBe(1);
    expect(text(pageStatus(host))).toBe('Staff meal: nothing changed. Catalog version 12 is still current.');
    expect(rowNames(host)).toEqual(['Staff meal', 'Birthday', 'Anniversary', 'Regular customer']);
    expect(text(facts(host))).toBe('3 active · 1 inactive · Catalog version 12');
    expect(focused()).toBe(named(host, 'Edit Staff meal — active'));
  });

  it('Deactivate sends { presetId } after the confirmation and announces it; Reactivate sends at once', async () => {
    const host = await open();
    h.reply(P_DEACTIVATE, presetAnswer(13, { ...BIRTHDAY, isActive: false }));
    tap(named(host, 'Deactivate Birthday'));
    tap(named(dialogNamed('Deactivate “Birthday”?')!, 'Deactivate Birthday'));
    expect(text(pageStatus(host))).toBe('Deactivating Birthday…');
    expect(focused()).toBe(pageStatus(host));
    await h.settle();
    expect(bodyOf(h, P_DEACTIVATE)).toEqual({ presetId: BIRTHDAY.presetId });
    expect(text(pageStatus(host))).toBe('Birthday deactivated. It is hidden from the POS picker; existing orders keep it.');
    // The row moved to the inactive group; its Edit still takes the focus.
    expect(focused()).toBe(named(host, 'Edit Birthday — inactive'));

    h.reply(P_REACTIVATE, presetAnswer(14, BIRTHDAY));
    tap(named(host, 'Reactivate Birthday'));
    expect(openDialogs()).toHaveLength(0);
    expect(text(pageStatus(host))).toBe('Reactivating Birthday…');
    await h.settle();
    expect(bodyOf(h, P_REACTIVATE)).toEqual({ presetId: BIRTHDAY.presetId });
    expect(text(pageStatus(host))).toBe('Birthday reactivated. Staff can choose it at the POS.');
    expect(focused()).toBe(named(host, 'Edit Birthday — active'));
    expect(rowNames(host)).toEqual(['Staff meal', 'Birthday', 'Anniversary', 'Regular customer']);
  });
});

describe('AC 7. the deactivation confirmation', () => {
  it('names the preset, focuses Keep active, and Escape and Keep active each send nothing and return to the row’s Deactivate', async () => {
    const host = await open();
    tap(named(host, 'Deactivate Staff meal'));
    const dialog = dialogNamed('Deactivate “Staff meal”?')!;
    expect(dialog).not.toBeNull();
    expect(text(dialog.querySelector('#deactivate-copy'))).toBe(
      'It will disappear from the POS picker. Orders that already carry it keep its name and value as applied. You can reactivate it later.'
    );
    expect(focused()).toBe(named(dialog, 'Keep active — Staff meal'));
    expect(h.count(P_DEACTIVATE)).toBe(0);

    pressEscape(focused()!);
    expect(dialogNamed('Deactivate “Staff meal”?')).toBeNull();
    expect(focused()).toBe(named(host, 'Deactivate Staff meal'));
    expect(h.count(P_DEACTIVATE)).toBe(0);

    tap(named(host, 'Deactivate Staff meal'));
    tap(named(dialogNamed('Deactivate “Staff meal”?')!, 'Keep active — Staff meal'));
    expect(dialogNamed('Deactivate “Staff meal”?')).toBeNull();
    expect(focused()).toBe(named(host, 'Deactivate Staff meal'));
    expect(h.count(P_DEACTIVATE)).toBe(0);
  });

  it('Deactivate sends one request', async () => {
    const host = await open();
    h.reply(P_DEACTIVATE, presetAnswer(13, { ...STAFF, isActive: false }));
    tap(named(host, 'Deactivate Staff meal'));
    tap(named(dialogNamed('Deactivate “Staff meal”?')!, 'Deactivate Staff meal'));
    await h.settle();
    expect(h.count(P_DEACTIVATE)).toBe(1);
  });
});

describe('AC 13. a command that succeeds while the list read stands failed', () => {
  it('draws the known rows with the answered record, announces it, focuses its Edit, withholds the facts and shows the partial alert', async () => {
    const host = await open();
    await reachPartial(h, host);
    expect(rowNames(host)).toEqual(['Staff meal', 'Regular customer', 'Birthday', 'Anniversary']);
    expect(rowOf(host, REGULAR.presetId).getAttribute('data-active')).toBe('true');
    expect(text(pageStatus(host))).toBe('Regular customer reactivated. Staff can choose it at the POS.');
    expect(focused()).toBe(named(host, 'Edit Regular customer — active'));
    expect(facts(host)).toBeNull();
    expect(text(host.querySelector('#read-state [role="alert"]'))).toBe(
      'The preset list may be out of dateThe rows below are the ones this page knows, including your latest change. Try again to read the full list.Try again'
    );
  });

  it('Try again reads only, and the facts return', async () => {
    const host = await open();
    await reachPartial(h, host);
    const before = presetCalls(h).length;
    h.reply(READ, presetList(13, [STAFF, { ...REGULAR, isActive: true }, BIRTHDAY, ANNIVERSARY]));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(presetCalls(h).slice(before)).toEqual([READ]);
    expect(host.querySelector('#read-state')).toBeNull();
    expect(text(facts(host))).toBe('4 active · 0 inactive · Catalog version 13');
  });
});

describe('AC 16. no invented control', () => {
  const banned = /schedule|valid from|valid to|automatic|approval|minimum/i;

  const check = (host: HTMLElement) => {
    expect(host.querySelectorAll('input[type="date"], input[type="time"], input[type="datetime-local"], input[type="week"], input[type="month"]')).toHaveLength(0);
    expect(host.querySelector('[data-move], [data-reorder], .menu-reorder')).toBeNull();
    expect(text(host)).not.toMatch(banned);
  };

  it('holds on the list, the percentage form, the fixed form and the confirmation', async () => {
    const host = await open();
    check(host);
    tap(named(host, 'New preset'));
    check(host);
    tap(host.querySelector<HTMLElement>('#kind-fixed')!);
    check(host);
    tap(named(host, 'Cancel'));
    tap(named(host, 'Deactivate Staff meal'));
    check(host);
    check(document.body);
  });

  it('holds on the stale form, with its comparison and choices, and on the unknown-outcome form', async () => {
    const host = await open();
    tap(named(host, 'Edit Staff meal — active'));
    typeInto(nameField(host)!, 'Staff lunch');
    h.reply(P_UPDATE, refusal('CATALOG_CHANGED', undefined, 409));
    h.reply(READ, presetList(13, [{ ...STAFF, name: 'Staff dining', value: percent('125000') }, REGULAR, BIRTHDAY, ANNIVERSARY]));
    tap(named(host, 'Save'));
    await h.settle();
    expect(host.querySelector('#stale-choices')).not.toBeNull();
    check(host);
    tap(named(host, 'Keep my changes'));
    h.reply(P_UPDATE, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toContain('Outcome not confirmed');
    check(host);
  });
});
