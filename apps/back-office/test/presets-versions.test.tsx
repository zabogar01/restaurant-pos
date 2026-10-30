// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, refusal, text } from './session-harness.js';
import { dialogNamed } from './tables-support.js';
import {
  ANNIVERSARY, BIRTHDAY, P_CREATE, P_DEACTIVATE, P_REACTIVATE, P_UPDATE, READ, REGULAR, STAFF,
  amountField, aria, bodyOf, byId, facts, fixed, formNotice, harness, nameField, named, newPercentDraft, openPresets,
  pageStatus, panel, panelName, percent, percentField, preset, presetAnswer, presetCalls, presetList, reachPartial,
  rowNames, rowOf, tap, typeInto,
} from './presets-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-07's version rules and refusals (PHASE1-S6b rulings 9 to 13; criteria 8 to 11): the version
// the list stands at, `CATALOG_CHANGED` on an edit, a held name, and the unknown outcomes. Create,
// deactivate and reactivate carry no version and are never refused as stale.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const changed = refusal('CATALOG_CHANGED', undefined, 409);
const duplicate = refusal('DUPLICATE', undefined, 409);
const notFound = refusal('NOT_FOUND', undefined, 404);
const focused = () => document.activeElement;

const open = async (first?: Parameters<typeof openPresets>[1]) => {
  h = harness();
  view = await openPresets(h, first);
  return view.host;
};

/** Deactivate through the confirmation. */
const deactivate = async (host: HTMLElement, name: string) => {
  tap(named(host, `Deactivate ${name}`));
  tap(named(dialogNamed(`Deactivate “${name}”?`)!, `Deactivate ${name}`));
  await h.settle();
};

/** Edit Regular customer (inactive) and rename it only. */
const renamingRegular = (host: HTMLElement, to = 'Regular guest') => {
  tap(named(host, 'Edit Regular customer — inactive'));
  typeInto(nameField(host)!, to);
};

/** Edit Staff meal and rename it only. */
const renamingStaff = (host: HTMLElement, to = 'Staff lunch') => {
  tap(named(host, 'Edit Staff meal — active'));
  typeInto(nameField(host)!, to);
};

describe('AC 8. the standing version', () => {
  it('(a) an answer that skips a version leaves it: the edit carries the old version, is refused, and is stale beside the other tab’s change', async () => {
    const host = await open(presetList(12));
    // Another tab changed Regular customer (13); this tab deactivates Staff meal, answered at 14.
    h.reply(P_DEACTIVATE, presetAnswer(14, { ...STAFF, isActive: false }));
    await deactivate(host, 'Staff meal');
    expect(text(facts(host))).toBe('2 active · 2 inactive · Catalog version 14');

    h.reply(P_UPDATE, changed);
    h.reply(
      READ,
      presetList(14, [{ ...STAFF, isActive: false }, { ...REGULAR, value: fixed('20000') }, BIRTHDAY, ANNIVERSARY])
    );
    renamingRegular(host);
    tap(named(host, 'Save'));
    await h.settle();

    expect(bodyOf(h, P_UPDATE).expectedVersion).toBe(12);
    expect(h.count(P_UPDATE)).toBe(1);
    expect(text(formNotice(host)!.querySelector('p'))).toBe(
      'Nothing was saved. The catalog has been read again at version 14. Your draft is kept. Choose which values to keep.'
    );
    expect(text(byId(host, '#current-value'))).toBe('Current value: 20.000 · IDR · Differs from your draft');
  });

  it('(b) an answer one step ahead advances it: the edit carries it and saves', async () => {
    const host = await open(presetList(12));
    h.reply(P_DEACTIVATE, presetAnswer(13, { ...STAFF, isActive: false }));
    await deactivate(host, 'Staff meal');

    h.reply(P_UPDATE, presetAnswer(14, { ...REGULAR, name: 'Regular guest' }));
    renamingRegular(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_UPDATE).expectedVersion).toBe(13);
    expect(text(pageStatus(host))).toBe('Regular guest saved.');
  });

  it('(c) while the read stands failed an answer does not move it: the edit is refused and rereads', async () => {
    const host = await open(presetList(12));
    await reachPartial(h, host);
    h.reply(P_UPDATE, changed);
    h.reply(READ, presetList(13, [STAFF, { ...REGULAR, isActive: true }, BIRTHDAY, ANNIVERSARY]));
    renamingStaff(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_UPDATE).expectedVersion).toBe(12);
    expect(h.count(P_UPDATE)).toBe(1);
    // The full reread arrived: the facts are back and the notice compares at version 13.
    expect(formNotice(host)!.textContent).toContain('read again at version 13');
  });

  it('(c) a create answered while the read stands failed does not move it either', async () => {
    const host = await open(presetList(12));
    h.reply(P_CREATE, presetAnswer(13, preset(9, 'Happy hour', percent('100000'))));
    // The create is in flight when the manager discards its form and leaves; a revisit's read fails.
    const held = h.hold(P_CREATE);
    newPercentDraft(host);
    tap(named(host, 'Save'));
    h.reply(READ, failure);
    tap(named(host.querySelector<HTMLElement>('.bonav')!, 'Tables'));
    tap(named(dialogNamed('Discard unsaved changes?')!, 'Discard'));
    await h.settle();
    tap(named(host.querySelector<HTMLElement>('.bonav')!, 'Discount presets'));
    await h.settle();
    held.deliver(presetAnswer(13, preset(9, 'Happy hour', percent('100000'))));
    await h.settle();

    h.reply(P_UPDATE, changed);
    h.reply(READ, presetList(13, [STAFF, REGULAR, BIRTHDAY, ANNIVERSARY, preset(9, 'Happy hour', percent('100000'))]));
    renamingStaff(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_UPDATE).expectedVersion).toBe(12);
  });

  it('the facts line names the version most recently read or answered, never the standing one', async () => {
    const host = await open(presetList(12));
    h.reply(P_DEACTIVATE, presetAnswer(14, { ...STAFF, isActive: false }));
    await deactivate(host, 'Staff meal');
    expect(text(facts(host))).toContain('Catalog version 14');
    tap(named(host, 'Edit Birthday — active'));
    // The form's version line names the same latest version, while its base stays at 12.
    expect(text(byId(host, '#form-version'))).toBe('Catalog version 14');
    h.reply(P_UPDATE, changed);
    typeInto(nameField(host)!, 'Birthday treat');
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_UPDATE).expectedVersion).toBe(12);
  });

  it('Edit is inert while no read has ever succeeded, and the create after a partial answer still carries no version', async () => {
    const host = await open(failure);
    expect(host.querySelector('[data-edit]')).toBeNull();
    expect(aria(named(host, 'New preset'))).toBe(true);
  });

  it('a state command and a create are never refused as stale: they carry no version', async () => {
    const host = await open(presetList(12));
    h.reply(P_DEACTIVATE, presetAnswer(20, { ...STAFF, isActive: false }));
    await deactivate(host, 'Staff meal');
    h.reply(P_CREATE, presetAnswer(21, preset(9, 'Happy hour', percent('100000'))));
    newPercentDraft(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_DEACTIVATE)).toEqual({ presetId: STAFF.presetId });
    expect(bodyOf(h, P_CREATE)).not.toHaveProperty('expectedVersion');
  });
});

describe('AC 9. CATALOG_CHANGED on an edit', () => {
  const changedPreset = { ...STAFF, name: 'Staff dining', value: percent('125000') };

  const stale = async (
    reread = presetList(13, [changedPreset, REGULAR, BIRTHDAY, ANNIVERSARY]),
    edit: (host: HTMLElement) => void = renamingStaff
  ) => {
    const host = await open(presetList(12));
    h.reply(P_UPDATE, changed);
    h.reply(READ, reread);
    edit(host);
    tap(named(host, 'Save'));
    await h.settle();
    return host;
  };

  it('stale: keeps the draft, rereads once, marks the differing fields with the current values, focuses the notice, and holds Save', async () => {
    const host = await stale();
    expect(h.count(P_UPDATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(nameField(host)!.value).toBe('Staff lunch');
    expect(text(formNotice(host))).toBe(
      'The catalog changed while you were editingNothing was saved. The catalog has been read again at version 13. Your draft is kept. Choose which values to keep.'
    );
    expect(formNotice(host)!.getAttribute('role')).toBe('alert');
    expect(focused()).toBe(formNotice(host));
    expect(text(byId(host, '#current-name'))).toBe('Current name: Staff dining · Differs from your draft');
    expect(text(byId(host, '#current-value'))).toBe('Current value: 12,5% · Differs from your draft');
    expect(byId(host, '#current-kind')).toBeNull();
    expect(byId(host, '#current-same')).toBeNull();
    expect(text(byId(host, '#current-status'))).toBe('Current status: Active.');
    expect(aria(named(host, 'Save'))).toBe(true);
    expect(text(byId(host, '#save-hint'))).toBe('Choose Keep my changes or Use current preset before saving.');
    // Save sends nothing until a choice is made.
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(P_UPDATE)).toBe(1);
  });

  it('stale: a kind difference is marked, and a fixed current value names its currency', async () => {
    const host = await stale(
      presetList(13, [{ ...STAFF, value: fixed('25000') }, REGULAR, BIRTHDAY, ANNIVERSARY])
    );
    expect(text(byId(host, '#current-kind'))).toBe('Current kind: Fixed amount · Differs from your draft');
    expect(text(byId(host, '#current-value'))).toBe('Current value: 25.000 · IDR · Differs from your draft');
  });

  it('stale-menu: only the menu changed, so a draft equal to the current preset gets the same-values sentence and no field is marked', async () => {
    const host = await stale(presetList(13), (opened) => tap(named(opened, 'Edit Staff meal — active')));
    expect(text(formNotice(host)!.querySelector('strong'))).toBe('The catalog changed while you were editing');
    expect(text(byId(host, '#current-same'))).toBe('The current preset has the same values as your draft.');
    expect(byId(host, '#current-name')).toBeNull();
    expect(byId(host, '#current-kind')).toBeNull();
    expect(byId(host, '#current-value')).toBeNull();
    expect(aria(named(host, 'Save'))).toBe(true);
    expect(text(byId(host, '#current-status'))).toBe('Current status: Active.');
  });

  it('only the menu changed but the draft is renamed: the current name is marked, not the same-values sentence', async () => {
    const host = await stale(presetList(13));
    expect(text(byId(host, '#current-name'))).toBe('Current name: Staff meal · Differs from your draft');
    expect(byId(host, '#current-same')).toBeNull();
    expect(byId(host, '#current-value')).toBeNull();
  });

  it('stale-read-failed: no comparison and no choices, Save held, and the list’s Try again reads only', async () => {
    const host = await open(presetList(12));
    h.reply(P_UPDATE, changed);
    h.reply(READ, failure);
    renamingStaff(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'The catalog changed while you were editingThe current preset could not be read. Your draft is kept. Try again reads the list; nothing is sent again.'
    );
    expect(byId(host, '#keep-draft')).toBeNull();
    expect(byId(host, '#use-current')).toBeNull();
    expect(aria(named(host, 'Save'))).toBe(true);
    expect(text(byId(host, '#save-hint'))).toBe('Read the current preset before choosing which values to keep.');
    expect(nameField(host)!.value).toBe('Staff lunch');

    h.reply(READ, presetList(13, [changedPreset, REGULAR, BIRTHDAY, ANNIVERSARY]));
    const before = presetCalls(h).length;
    tap(host.querySelector<HTMLElement>('#read-state button')!);
    await h.settle();
    expect(presetCalls(h).slice(before)).toEqual([READ]);
    expect(byId(host, '#keep-draft')).not.toBeNull();
    expect(h.count(P_UPDATE)).toBe(1);
  });

  it('Keep my changes moves the base to the reread version, focuses Save, sends nothing, and the next Save carries that version', async () => {
    const host = await stale();
    tap(named(host, 'Keep my changes'));
    expect(h.count(P_UPDATE)).toBe(1);
    expect(byId(host, '#stale-choices')).toBeNull();
    expect(aria(named(host, 'Save'))).toBe(false);
    expect(focused()).toBe(named(host, 'Save'));
    expect(nameField(host)!.value).toBe('Staff lunch');

    h.reply(P_UPDATE, presetAnswer(14, { ...changedPreset, name: 'Staff lunch' }));
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_UPDATE, 1).expectedVersion).toBe(13);
    expect(h.count(P_UPDATE)).toBe(2);
    expect(text(pageStatus(host))).toBe('Staff lunch saved.');
  });

  it('Use current preset shows the reread preset, clean, focuses Preset name, and sends nothing', async () => {
    const host = await stale();
    tap(named(host, 'Use current preset'));
    expect(h.count(P_UPDATE)).toBe(1);
    expect(nameField(host)!.value).toBe('Staff dining');
    expect(percentField(host)!.value).toBe('12,5');
    expect(focused()).toBe(nameField(host));
    expect(byId(host, '#stale-choices')).toBeNull();
    // Clean: Cancel closes it with no decision.
    tap(named(host, 'Cancel'));
    expect(dialogNamed('Discard unsaved changes?')).toBeNull();
    expect(panel(host)).toBeNull();
  });

  it('Use current preset into the other kind clears the unused buffer', async () => {
    const host = await stale(presetList(13, [{ ...STAFF, value: fixed('25000') }, REGULAR, BIRTHDAY, ANNIVERSARY]));
    tap(named(host, 'Use current preset'));
    expect(amountField(host)!.value).toBe('25.000');
    tap(host.querySelector<HTMLElement>('#kind-percent')!);
    expect(percentField(host)!.value).toBe('');
  });

  it('a stale refusal whose reread shows no newer version is the definite failure, draft kept', async () => {
    const host = await stale(presetList(12));
    expect(text(formNotice(host))).toBe('Something went wrongNothing was saved. Your draft is kept. Press Save to try again.');
    expect(aria(named(host, 'Save'))).toBe(false);
  });

  it('a reread alone never moves an open draft’s base', async () => {
    const host = await open(presetList(12));
    renamingStaff(host, 'regular customer');
    h.reply(P_UPDATE, duplicate);
    h.reply(READ, presetList(13, [STAFF, REGULAR, BIRTHDAY, ANNIVERSARY]));
    tap(named(host, 'Save'));
    await h.settle();
    h.reply(P_UPDATE, presetAnswer(14, { ...STAFF, name: 'Staff lunch' }));
    typeInto(nameField(host)!, 'Staff lunch');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.keyed(P_UPDATE).map((c) => JSON.parse(c.body!).expectedVersion)).toEqual([12, 12]);
  });
});

describe('AC 10. a name an active preset already holds', () => {
  it('a refused create keeps the draft, puts the refusal on Preset name with focus, rereads once, marks the holder, and sends nothing again', async () => {
    const host = await open(presetList(12));
    h.reply(P_CREATE, duplicate);
    h.reply(READ, presetList(13));
    newPercentDraft(host, 'staff MEAL', '10');
    tap(named(host, 'Save'));
    await h.settle();
    expect(presetCalls(h)).toEqual([READ, P_CREATE, READ]);
    expect(text(byId(host, '#preset-name-error'))).toBe('An active preset already uses this name. Choose another name.');
    expect(nameField(host)!.value).toBe('staff MEAL');
    expect(percentField(host)!.value).toBe('10');
    expect(nameField(host)!.getAttribute('aria-invalid')).toBe('true');
    expect(focused()).toBe(nameField(host));
    expect(text(rowOf(host, STAFF.presetId))).toContain('Name in use');
    expect(text(rowOf(host, BIRTHDAY.presetId))).not.toContain('Name in use');
    // Editing clears the error and the marker.
    typeInto(nameField(host)!, 'staff MEA');
    expect(byId(host, '#preset-name-error')).toBeNull();
    expect(text(rowOf(host, STAFF.presetId))).not.toContain('Name in use');
  });

  it('a refused edit marks the holder, not the preset being edited, and keeps the base', async () => {
    const host = await open(presetList(12));
    h.reply(P_UPDATE, duplicate);
    h.reply(READ, presetList(13));
    tap(named(host, 'Edit Birthday — active'));
    typeInto(nameField(host)!, 'STAFF MEAL');
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(byId(host, '#preset-name-error'))).toBe('An active preset already uses this name. Choose another name.');
    expect(text(rowOf(host, STAFF.presetId))).toContain('Name in use');
    expect(text(rowOf(host, BIRTHDAY.presetId))).not.toContain('Name in use');
    expect(h.count(P_UPDATE)).toBe(1);
  });

  it('marks nobody when the reread shows no active preset with that name', async () => {
    const host = await open(presetList(12));
    h.reply(P_CREATE, duplicate);
    h.reply(READ, presetList(13, [REGULAR]));
    newPercentDraft(host, 'Staff meal', '10');
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(byId(host, '#preset-name-error'))).toBe('An active preset already uses this name. Choose another name.');
    expect(host.querySelector('.table-holder')).toBeNull();
  });

  it('an inactive preset with the name is not a holder', async () => {
    const host = await open(presetList(12));
    h.reply(P_CREATE, duplicate);
    h.reply(READ, presetList(13));
    newPercentDraft(host, 'regular CUSTOMER', '10');
    tap(named(host, 'Save'));
    await h.settle();
    expect(host.querySelector('.table-holder')).toBeNull();
  });

  it('a refused reactivation opens that inactive preset’s editor with its own sentence, rereads once, marks the holder; saving a new name leaves it inactive', async () => {
    const host = await open(presetList(12));
    const holding = preset(5, 'regular customer', percent('1'));
    h.reply(P_REACTIVATE, duplicate);
    h.reply(READ, presetList(13, [STAFF, REGULAR, BIRTHDAY, ANNIVERSARY, holding]));
    tap(named(host, 'Reactivate Regular customer'));
    await h.settle();
    expect(presetCalls(h)).toEqual([READ, P_REACTIVATE, READ]);
    expect(panelName(host)).toBe('Edit Regular customer');
    expect(text(byId(host, '#preset-name-error'))).toBe(
      'An active preset already uses this name. Rename this inactive preset, save, then reactivate it.'
    );
    expect(focused()).toBe(nameField(host));
    expect(text(rowOf(host, holding.presetId))).toContain('Name in use');
    expect(text(byId(host, '#form-context'))).toContain('Inactive preset. Saving does not reactivate it.');

    h.reply(P_UPDATE, presetAnswer(14, { ...REGULAR, name: 'Regular guest' }));
    typeInto(nameField(host)!, 'Regular guest');
    tap(named(host, 'Save'));
    await h.settle();
    expect(bodyOf(h, P_UPDATE)).toMatchObject({ presetId: REGULAR.presetId, expectedVersion: 13, name: 'Regular guest' });
    expect(rowOf(host, REGULAR.presetId).getAttribute('data-active')).toBe('false');
    expect(h.count(P_REACTIVATE)).toBe(1);
    expect(named(host, 'Reactivate Regular guest')).toBeTruthy();
  });
});

describe('AC 11. unknown outcomes and failures', () => {
  it.each([
    ['a 500', failure],
    ['a network failure', 'reject' as const],
  ])('a save answered by %s gets one reread and is never resent', async (_what, reply) => {
    const host = await open(presetList(12));
    renamingStaff(host);
    h.reply(P_UPDATE, reply);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(P_UPDATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedThe outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again.'
    );
    expect(nameField(host)!.value).toBe('Staff lunch');
    expect(focused()).toBe(nameField(host));
    // Success is never inferred from the reread, and the explicit Save stays available.
    expect(pageStatus(host)).toBeNull();
    expect(aria(named(host, 'Save'))).toBe(false);
  });

  it('a save whose reread failed says the list could not be refreshed; the list’s Try again rereads only', async () => {
    const host = await open(presetList(12));
    renamingStaff(host);
    h.reply(P_UPDATE, failure);
    h.reply(READ, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedThe outcome could not be confirmed. The list could not be refreshed. Your draft is kept; nothing was sent again.'
    );
    expect(byId(host, '#form-version')).toBeNull();
    h.reply(READ, presetList(12));
    tap(host.querySelector<HTMLElement>('#read-state button')!);
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedThe outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again.'
    );
    expect(h.count(P_UPDATE)).toBe(1);
  });

  it('a save whose reread shows a newer version gets the comparison and the “may include this save” body; after a choice the earlier-save body', async () => {
    const host = await open(presetList(12));
    renamingStaff(host);
    h.reply(P_UPDATE, failure);
    h.reply(READ, presetList(13, [{ ...STAFF, name: 'Staff lunch' }, REGULAR, BIRTHDAY, ANNIVERSARY]));
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedThe catalog has been read again at version 13. It may include this save. Your draft is kept; nothing was sent again. Choose which values to keep.'
    );
    expect(byId(host, '#current-same')).not.toBeNull();
    expect(aria(named(host, 'Save'))).toBe(true);
    expect(pageStatus(host)).toBeNull();
    expect(h.count(P_UPDATE)).toBe(1);

    tap(named(host, 'Keep my changes'));
    expect(text(formNotice(host))).toBe(
      'Outcome not confirmedYour draft now builds on catalog version 13. The earlier save is still unconfirmed. Nothing was sent again.'
    );
    expect(h.count(P_UPDATE)).toBe(1);
    // Leaving still asks: the earlier save is unconfirmed.
    tap(named(host, 'Cancel'));
    expect(dialogNamed('Discard unsaved changes?')).not.toBeNull();
  });

  it('a create answered unknown rereads once, keeps the draft, and sends nothing again', async () => {
    const host = await open(presetList(12));
    h.reply(P_CREATE, failure);
    newPercentDraft(host);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(P_CREATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(formNotice(host)!.querySelector('strong'))).toBe('Outcome not confirmed');
    expect(nameField(host)!.value).toBe('Happy hour');
  });

  it('a state command answered unknown gets one reread and the page sentence, and never a resend', async () => {
    const host = await open(presetList(12));
    h.reply(P_DEACTIVATE, failure);
    await deactivate(host, 'Staff meal');
    expect(h.count(P_DEACTIVATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(pageStatus(host))).toBe(
      'Staff meal: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.'
    );
    expect(focused()).toBe(pageStatus(host));
    // Not inferred from the reread: the row still offers Deactivate.
    expect(named(host, 'Deactivate Staff meal')).toBeTruthy();
  });

  it('a state command whose reread failed says the list could not be refreshed; Try again rereads only', async () => {
    const host = await open(presetList(12));
    h.reply(P_REACTIVATE, failure);
    h.reply(READ, failure);
    tap(named(host, 'Reactivate Regular customer'));
    await h.settle();
    expect(text(pageStatus(host))).toBe(
      'Regular customer: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.'
    );
    h.reply(READ, presetList(12));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(text(pageStatus(host))).toBe(
      'Regular customer: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.'
    );
    expect(h.count(P_REACTIVATE)).toBe(1);
  });

  it('a definite failure of a save keeps the draft and says Press Save to try again', async () => {
    const host = await open(presetList(12));
    renamingStaff(host);
    h.reply(P_UPDATE, refusal('PAYLOAD_TOO_LARGE', undefined, 413));
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(formNotice(host))).toBe('Something went wrongNothing was saved. Your draft is kept. Press Save to try again.');
    expect(formNotice(host)!.getAttribute('role')).toBe('alert');
    expect(nameField(host)!.value).toBe('Staff lunch');
    expect(focused()).toBe(nameField(host));
  });

  it('NOT_FOUND on a save is the definite failure with one reread', async () => {
    const host = await open(presetList(12));
    renamingStaff(host);
    h.reply(P_UPDATE, notFound);
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(P_UPDATE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(formNotice(host))).toBe('Something went wrongNothing was saved. Your draft is kept. Press Save to try again.');
  });

  it('NOT_FOUND on a state command is the definite failure with one reread', async () => {
    const host = await open(presetList(12));
    h.reply(P_REACTIVATE, notFound);
    tap(named(host, 'Reactivate Regular customer'));
    await h.settle();
    expect(h.count(READ)).toBe(2);
    expect(text(pageStatus(host))).toBe('Something went wrong. Regular customer was not changed. Use its row action to try again.');
    expect(pageStatus(host)!.getAttribute('role')).toBe('alert');
    expect(focused()).toBe(pageStatus(host));
  });

  it('a definite failure of a state command names the row action', async () => {
    const host = await open(presetList(12));
    h.reply(P_REACTIVATE, refusal('PAYLOAD_TOO_LARGE', undefined, 413));
    tap(named(host, 'Reactivate Regular customer'));
    await h.settle();
    expect(text(pageStatus(host))).toBe('Something went wrong. Regular customer was not changed. Use its row action to try again.');
    expect(h.count(P_REACTIVATE)).toBe(1);
    expect(rowNames(host)).toContain('Regular customer');
  });
});
