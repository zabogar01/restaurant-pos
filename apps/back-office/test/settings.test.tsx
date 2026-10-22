// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { Screens } from '../src/Screens.js';
import { requestClose } from './dialog-shim.js';
import { ME, VIEW, mount, ok, refusal, text, type Reply } from './session-harness.js';
import {
  READ, SAVE, V4, V5, answer, box, errorOf, facts, fill, form, notice, openSettings, saveBody, settingsCalls,
  settingsHarness, settingsView, status, withVersion,
} from './settings-support.js';
import { dialogNamed, named, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-08's settings part (PHASE1-S2b), in jsdom: the read view, the first run, the form and its
// refusals, the rate confirmation, the four answers, the stale-draft refusal, the unknown
// outcome, and one command at a time. jsdom has no top layer and no inertness, so what only a
// browser shows is e2e/tests/settings.spec.ts.

let h: ReturnType<typeof settingsHarness>;
let view: Awaited<ReturnType<typeof openSettings>> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const stale = refusal('SETTINGS_CHANGED', undefined, 409);
const invalid = refusal('VALIDATION_FAILED', undefined, 400);

const open = async (first?: Parameters<typeof openSettings>[1], path?: string) => {
  h = settingsHarness(path);
  view = await openSettings(h, first);
  return view.host;
};

const confirmation = () => dialogNamed('Save new rates?');
const save = (host: HTMLElement) => tap(named(host, 'Save'));

/** Opens the form from the tax rate's Change. */
function change(host: HTMLElement, what = 'Change tax rate') {
  tap(named(host, what));
}

const THEIR_ADDRESS = 'Jl. Melati No. 12\nKebayoran Baru\nJakarta Selatan 12160';

describe('AC 1. navigation', () => {
  it('the rail shows Settings after Tables in Configuration, and a press opens BO-08 and reads', async () => {
    const host = await open(undefined, '/back-office/');
    const rail = host.querySelector<HTMLElement>('.bonav')!;
    expect(text(rail)).toBe('ConfigurationTablesSettings');
    expect(host.querySelector('h1')).toBeNull();
    expect(h.count(READ)).toBe(0);

    tap(named(rail, 'Settings'));
    await h.settle();
    expect(window.location.pathname).toBe('/back-office/settings');
    expect(host.querySelector('h1')!.textContent).toBe('Settings');
    expect(rail.querySelector('[aria-current="page"]')!.textContent).toBe('Settings');
    expect(h.count(READ)).toBe(1);
  });

  it('a reload at /back-office/settings lands on BO-08', async () => {
    const host = await open();
    expect(window.location.pathname).toBe('/back-office/settings');
    expect(host.querySelector('h1')!.textContent).toBe('Settings');
    expect(host.querySelector('h2')!.textContent).toBe('Rates and receipt details');
    expect(h.count(READ)).toBe(1);
  });

  it('every visit reads again', async () => {
    const host = await open();
    const rail = host.querySelector<HTMLElement>('.bonav')!;
    tap(named(rail, 'Tables'));
    await h.settle();
    h.reply(READ, settingsView(withVersion(V4, { version: 5, taxRatePpm: '110000' })));
    tap(named(rail, 'Settings'));
    await h.settle();
    expect(h.count(READ)).toBe(2);
    expect(text(facts(host))).toContain('Version 5');
  });
});

describe('AC 2. the read view and the first run', () => {
  it('shows the facts line, the constants as text, both rates with a comma, and the five details', async () => {
    const host = await open();
    expect(text(facts(host))).toBe('Version 4 · In force since 12 Oct 2026, 14:05 · Saved by M. Iqbal');
    const part = text(host.querySelector('#settings-view'));
    expect(part).toContain('CurrencyIDR · Indonesian rupiah');
    expect(part).toContain('Decimal places0 · amounts are whole rupiah');
    expect(part).toContain('Fixed for this installation.');
    expect(part).toContain('Tax rateIncluded in menu prices10%');
    expect(part).toContain('Service chargeAdded to the bill · not taxed5%');
    expect(part).toContain('These details are printed on receipts.');
    for (const value of ['Warung Sederhana', 'Jl. Melati No. 12', 'Jakarta Selatan 12160', '021 555 0134', 'P.2.0012345.07.001', 'Terima kasih atas kunjungan Anda']) {
      expect(part).toContain(value);
    }
    expect(host.querySelectorAll('[data-change]')).toHaveLength(7);
    for (const name of [
      'Change tax rate', 'Change service charge rate', 'Change outlet name', 'Change address', 'Change phone',
      'Change NPWPD', 'Change footer line',
    ]) {
      expect(named(host, name).textContent).toBe('Change');
    }
  });

  it('shows rates as the stored value says, with no trailing zeros', async () => {
    const host = await open(settingsView(withVersion(V4, { taxRatePpm: '105000', serviceChargeRatePpm: '1' })));
    const part = text(host.querySelector('#settings-view'));
    expect(part).toContain('10,5%');
    expect(part).toContain('0,0001%');
  });

  it('reads an absent NPWPD as Not set', async () => {
    const host = await open(settingsView(withVersion(V4, { npwpd: null })));
    expect(text(host.querySelector('#settings-view'))).toContain('NPWPDOptionalNot set');
  });

  it('names no input for the currency or the decimal places, in the read view or in the form', async () => {
    const host = await open();
    expect(host.querySelectorAll('input, select, textarea')).toHaveLength(0);
    change(host);
    const controls = [...host.querySelectorAll<HTMLElement>('input, select, textarea')];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const label = host.querySelector(`label[for="${control.id}"]`)?.textContent ?? '';
      const named = [control.id, control.getAttribute('name'), control.getAttribute('aria-label'), label].join(' ');
      expect(named).not.toMatch(/currency|decimal|precision|IDR/i);
    }
    expect(text(form(host))).toContain('CurrencyIDR · Indonesian rupiah');
    expect(host.querySelectorAll('[readonly], [disabled]')).toHaveLength(0);
  });

  it.each([
    ['Change tax rate', 'Tax rate'],
    ['Change service charge rate', 'Service charge rate'],
    ['Change outlet name', 'Outlet name'],
    ['Change address', 'Address'],
    ['Change phone', 'Phone'],
    ['Change NPWPD', 'NPWPD'],
    ['Change footer line', 'Footer line'],
  ])('%s opens the form with focus in %s', async (button, label) => {
    const host = await open();
    change(host, button);
    expect(form(host)).not.toBeNull();
    expect(host.querySelector('#settings-view')).toBeNull();
    expect(document.activeElement).toBe(box(host, label));
    expect(form(host)!.getAttribute('aria-labelledby')).toBe('settings-form-title');
    expect(host.querySelector('#settings-form-title')!.textContent).toBe('Edit settings');
    expect(text(host.querySelector('#settings-context'))).toBe(
      'Changes apply to orders opened after you save. Orders already open keep the settings they opened with.'
    );
  });

  it('opens the form holding the current values: rates with a comma, the address on three lines', async () => {
    const host = await open(settingsView(withVersion(V4, { taxRatePpm: '105000' })));
    change(host);
    expect(box(host, 'Tax rate').value).toBe('10,5');
    expect(box(host, 'Service charge rate').value).toBe('5');
    expect(box(host, 'Address').value).toBe(THEIR_ADDRESS);
    expect(box(host, 'NPWPD').value).toBe('P.2.0012345.07.001');
    expect(host.querySelector('#tax-rate-help')!.textContent).toBe('Included in menu prices. 0 to 100, up to four decimal places.');
    expect(host.querySelector('#phone-help')!.textContent).toBe('Up to 32 characters: digits, spaces and + - . ( )');
    // The % beside a rate is not read out.
    expect(host.querySelector('.settings-rate span')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('with no version: the first-run state, nothing pre-filled, and Enter settings opens the form', async () => {
    const host = await open(settingsView(null));
    expect(text(facts(host))).toBe('Not saved yet. Saving creates version 1.');
    expect(text(host.querySelector('.office-empty'))).toBe(
      'No settings saved yet' + 'Enter the rates and receipt details. Saving creates version 1.' + 'Enter settings'
    );
    expect(host.querySelector('#settings-view')).toBeNull();

    tap(named(host, 'Enter settings'));
    expect(host.querySelector('#settings-form-title')!.textContent).toBe('Enter settings');
    expect(text(host.querySelector('#settings-context'))).toBe(
      'Nothing is saved yet. Enter every rate and detail; saving creates version 1.'
    );
    for (const label of ['Tax rate', 'Service charge rate', 'Outlet name', 'Address', 'Phone', 'NPWPD', 'Footer line']) {
      expect(box(host, label).value, label).toBe('');
    }
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
    expect(text(host.querySelector('#settings-form'))).toContain('CurrencyIDR · Indonesian rupiah');
  });

  it('Cancel on a clean first-run form returns to Enter settings, with focus there', async () => {
    const host = await open(settingsView(null));
    tap(named(host, 'Enter settings'));
    tap(named(host, 'Cancel'));
    expect(form(host)).toBeNull();
    expect(document.activeElement).toBe(named(host, 'Enter settings'));
  });

  it('withholds the facts line, the constants and the view while loading and after a failed read, and Try again repeats the read only', async () => {
    h = settingsHarness();
    h.reply(READ, failure, settingsView(V4));
    view = await openSettings(h, failure);
    const host = view.host;
    expect(facts(host)).toBeNull();
    expect(text(host.querySelector('[role="alert"]'))).toBe('Settings could not be loadedTry again to read the settings.Try again');
    expect(host.querySelector('#settings-view')).toBeNull();
    expect(host.textContent).not.toContain('IDR');

    h.reply(READ, settingsView(V4));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(h.count(READ)).toBe(2);
    expect(settingsCalls(h)).toEqual([READ, READ]);
    expect(text(facts(host))).toContain('Version 4');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows Loading settings… while the first read is out', async () => {
    h = settingsHarness();
    const held = h.hold(READ);
    h.reply(ME, ok(VIEW));
    view = mount(h.store, <Screens />);
    await h.settle();
    expect(text(view.host.querySelector('[role="status"]'))).toBe('Loading settings…');
    expect(facts(view.host)).toBeNull();
    held.deliver(settingsView(V4));
    await h.settle();
    expect(text(facts(view.host))).toContain('Version 4');
  });
});

describe('AC 3. the rate field reaches the request as parts per million', () => {
  it('a save carries both rates as canonical strings, and the version it was built on', async () => {
    const host = await open();
    change(host);
    fill(host, 'Tax rate', '10,5');
    fill(host, 'Service charge rate', '5 %');
    save(host);
    // A rate changes, so the manager is asked first.
    expect(confirmation()).not.toBeNull();
    tap(named(confirmation()!, 'Save new rates'));
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    expect(saveBody(h)).toEqual({
      expectedVersion: 4,
      taxRatePpm: '105000',
      serviceChargeRatePpm: '50000',
      outletName: 'Warung Sederhana',
      address: THEIR_ADDRESS,
      phone: '021 555 0134',
      npwpd: 'P.2.0012345.07.001',
      footer: 'Terima kasih atas kunjungan Anda',
    });
  });

  it.each([
    ['', 'Enter the tax rate.'],
    ['%', 'Enter the tax rate.'],
    ['-5', 'Use 0 or more.'],
    ['lima', 'Enter a number, such as 10 or 10,5.'],
    ['5,12345', 'Use at most four decimal places.'],
    ['101', 'Use 100 or less.'],
  ])('tax rate %j is refused with its own sentence and nothing is sent', async (typed, sentence) => {
    const host = await open();
    change(host);
    fill(host, 'Tax rate', typed);
    save(host);
    expect(errorOf(host, 'tax-rate')).toBe(sentence);
    expect(box(host, 'Tax rate').getAttribute('aria-invalid')).toBe('true');
    expect(box(host, 'Tax rate').getAttribute('aria-describedby')!.split(' ')[0]).toBe('tax-rate-error');
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
    expect(h.count(SAVE)).toBe(0);
    expect(confirmation()).toBeNull();
  });

  it('the service charge has its own empty sentence', async () => {
    const host = await open();
    change(host, 'Change service charge rate');
    fill(host, 'Service charge rate', '');
    save(host);
    expect(errorOf(host, 'service-rate')).toBe('Enter the service charge rate.');
    expect(document.activeElement).toBe(box(host, 'Service charge rate'));
  });

  it('zero is a rate: a 0% service charge is sent', async () => {
    const host = await open();
    change(host, 'Change service charge rate');
    fill(host, 'Service charge rate', '0');
    save(host);
    tap(named(confirmation()!, 'Save new rates'));
    await h.settle();
    expect(saveBody(h).serviceChargeRatePpm).toBe('0');
  });
});

describe('AC 4. the text fields', () => {
  it('refuses each field in the table’s order, with its sentence, and focuses the first invalid field', async () => {
    const host = await open();
    change(host, 'Change outlet name');
    fill(host, 'Outlet name', '   ');
    fill(host, 'Address', 'a\nb\nc\nd');
    fill(host, 'Phone', '021/555');
    fill(host, 'NPWPD', 'x'.repeat(33));
    fill(host, 'Footer line', 'a\u0007');
    save(host);
    expect(errorOf(host, 'outlet-name')).toBe('Enter the outlet name.');
    expect(errorOf(host, 'address')).toBe('Use three lines or fewer.');
    expect(errorOf(host, 'phone')).toBe('Use only digits, spaces and + - . ( ).');
    expect(errorOf(host, 'npwpd')).toBe('Use 32 characters or fewer.');
    expect(errorOf(host, 'footer')).toBe('Remove control characters from the footer line.');
    expect(document.activeElement).toBe(box(host, 'Outlet name'));
    expect(h.count(SAVE)).toBe(0);
  });

  it('puts focus on the first invalid field in the form’s order, rates before details', async () => {
    const host = await open();
    change(host, 'Change footer line');
    fill(host, 'Footer line', '');
    fill(host, 'Service charge rate', 'x');
    save(host);
    expect(document.activeElement).toBe(box(host, 'Service charge rate'));
    expect(errorOf(host, 'footer')).toBe('Enter the footer line.');
  });

  it.each([
    ['outlet-name', 'Outlet name', 'x'.repeat(65), 'Use 64 characters or fewer.'],
    ['outlet-name', 'Outlet name', 'a\u001b', 'Remove control characters from the outlet name.'],
    ['address', 'Address', '', 'Enter the address.'],
    ['address', 'Address', 'x'.repeat(201), 'Use 200 characters or fewer.'],
    ['address', 'Address', 'a\tb', 'Remove control characters from the address. Line breaks are allowed.'],
    ['phone', 'Phone', '', 'Enter the phone number.'],
    ['phone', 'Phone', '1'.repeat(33), 'Use 32 characters or fewer.'],
    ['phone', 'Phone', 'WA 0812', 'Use only digits, spaces and + - . ( ).'],
    ['phone', 'Phone', '021 / 555', 'Use only digits, spaces and + - . ( ).'],
    ['npwpd', 'NPWPD', 'x\u0007y', 'Remove control characters from the NPWPD.'],
    ['footer', 'Footer line', 'x'.repeat(121), 'Use 120 characters or fewer.'],
  ])('%s: %j is refused as %j', async (id, label, typed, sentence) => {
    const host = await open();
    change(host);
    fill(host, label, typed);
    save(host);
    expect(errorOf(host, id)).toBe(sentence);
    expect(document.activeElement).toBe(box(host, label));
    expect(h.count(SAVE)).toBe(0);
  });

  it('accepts a value at each boundary and sends it trimmed; a blank NPWPD goes as null', async () => {
    const host = await open();
    change(host, 'Change outlet name');
    fill(host, 'Outlet name', `  ${'x'.repeat(64)}  `);
    fill(host, 'Address', 'a\nb\nc');
    fill(host, 'Phone', '+62 (021) 5550-1340 0812-3456-78');
    fill(host, 'NPWPD', '   ');
    fill(host, 'Footer line', 'f'.repeat(120));
    save(host);
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    const body = saveBody(h);
    expect(body.outletName).toBe('x'.repeat(64));
    expect(body.address).toBe('a\nb\nc');
    expect(body.phone).toBe('+62 (021) 5550-1340 0812-3456-78');
    expect(body.npwpd).toBeNull();
    expect(body.footer).toBe('f'.repeat(120));
    // Nothing about a rate changed, so no confirmation stood in the way.
    expect(confirmation()).toBeNull();
  });

  it('editing a field clears its refusal', async () => {
    const host = await open();
    change(host, 'Change phone');
    fill(host, 'Phone', '021/555');
    save(host);
    expect(errorOf(host, 'phone')).not.toBeNull();
    fill(host, 'Phone', '021 555');
    expect(errorOf(host, 'phone')).toBeNull();
    expect(box(host, 'Phone').hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('AC 5. the rate confirmation', () => {
  it('names each changed rate from and to, opens on Back to editing, and sends nothing until Save new rates', async () => {
    const host = await open();
    change(host);
    fill(host, 'Tax rate', '11');
    fill(host, 'Service charge rate', '5,5');
    save(host);
    const d = confirmation()!;
    expect(d).not.toBeNull();
    expect(d.getAttribute('closedby')).toBe('none');
    expect([...d.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Tax rate from 10% to 11%',
      'Service charge from 5% to 5,5%',
    ]);
    expect(text(d.querySelector('#confirm-rule'))).toBe(
      'Orders opened after you save use the new rates. Orders already open keep the rates they were opened with. Closed orders and day reports never change.'
    );
    expect(d.querySelector('#confirm-also')).toBeNull();
    expect(document.activeElement).toBe(named(d, 'Back to editing'));
    expect(h.count(SAVE)).toBe(0);

    tap(named(d, 'Back to editing'));
    expect(confirmation()).toBeNull();
    expect(h.count(SAVE)).toBe(0);
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
    expect(box(host, 'Tax rate').value).toBe('11');
  });

  it('Back to editing returns focus to the first changed rate, which may be the second', async () => {
    const host = await open();
    change(host);
    fill(host, 'Service charge rate', '6');
    save(host);
    tap(named(confirmation()!, 'Back to editing'));
    expect(document.activeElement).toBe(box(host, 'Service charge rate'));
  });

  it('Escape means Back to editing', async () => {
    const host = await open();
    change(host);
    fill(host, 'Tax rate', '11');
    save(host);
    const cancel = requestClose(confirmation()!);
    expect(cancel.defaultPrevented).toBe(true);
    expect(confirmation()).toBeNull();
    expect(h.count(SAVE)).toBe(0);
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
  });

  it('Save new rates sends exactly once', async () => {
    const host = await open();
    change(host);
    fill(host, 'Tax rate', '11');
    h.reply(SAVE, answer(withVersion(V4, { version: 5, taxRatePpm: '110000' })));
    save(host);
    const press = named(confirmation()!, 'Save new rates');
    tap(press);
    // The confirmation is gone the moment it is answered: a second press has nothing to land on.
    tap(press);
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    expect(confirmation()).toBeNull();
  });

  it('adds the sentence about other changes when details change too', async () => {
    const host = await open();
    change(host);
    fill(host, 'Tax rate', '11');
    fill(host, 'Phone', '021 555 0000');
    save(host);
    expect(text(confirmation()!.querySelector('#confirm-also'))).toBe('Your other changes are saved in the same version.');
  });

  it('no confirmation for a save that changes only details', async () => {
    const host = await open();
    change(host, 'Change phone');
    fill(host, 'Phone', '021 555 0000');
    save(host);
    await h.settle();
    expect(confirmation()).toBeNull();
    expect(h.count(SAVE)).toBe(1);
  });

  it('no confirmation at the first run, there being no earlier rate', async () => {
    const host = await open(settingsView(null));
    tap(named(host, 'Enter settings'));
    fill(host, 'Tax rate', '10');
    fill(host, 'Service charge rate', '5');
    fill(host, 'Outlet name', 'Warung');
    fill(host, 'Address', 'Jl. Melati');
    fill(host, 'Phone', '021 555');
    fill(host, 'Footer line', 'Terima kasih');
    save(host);
    await h.settle();
    expect(confirmation()).toBeNull();
    expect(h.count(SAVE)).toBe(1);
    expect(saveBody(h)).toMatchObject({ expectedVersion: null, taxRatePpm: '100000', serviceChargeRatePpm: '50000', npwpd: null });
  });

  it('a rate typed differently but equal to the saved one is not a change', async () => {
    const host = await open();
    change(host);
    fill(host, 'Tax rate', '10,0 %');
    save(host);
    await h.settle();
    expect(confirmation()).toBeNull();
    expect(h.count(SAVE)).toBe(1);
  });
});

describe('AC 6. what the answers do', () => {
  it('saved: the facts line names the new version, the read view shows the answered values, focus returns to the Change that opened the form', async () => {
    const host = await open();
    change(host, 'Change service charge rate');
    fill(host, 'Service charge rate', '6');
    const v5 = withVersion(V4, { version: 5, serviceChargeRatePpm: '60000', createdAt: new Date(2026, 9, 22, 9, 3).toISOString() });
    h.reply(SAVE, answer(v5));
    save(host);
    tap(named(confirmation()!, 'Save new rates'));
    await h.settle();
    expect(form(host)).toBeNull();
    expect(text(facts(host))).toBe('Version 5 · In force since 22 Oct 2026, 09:03 · Saved by M. Iqbal');
    expect(text(host.querySelector('#settings-view'))).toContain('Service chargeAdded to the bill · not taxed6%');
    expect(text(status(host))).toBe('Settings saved as version 5. Orders opened from now on use them.');
    expect(document.activeElement).toBe(named(host, 'Change service charge rate'));
    // Nothing was reread after the success.
    expect(h.count(READ)).toBe(1);
  });

  it('the first save: version 1, and focus on the first Change', async () => {
    const host = await open(settingsView(null));
    tap(named(host, 'Enter settings'));
    fill(host, 'Tax rate', '10');
    fill(host, 'Service charge rate', '5');
    fill(host, 'Outlet name', 'Warung');
    fill(host, 'Address', 'Jl. Melati');
    fill(host, 'Phone', '021 555');
    fill(host, 'Footer line', 'Terima kasih');
    h.reply(SAVE, answer(withVersion(V4, { version: 1, outletName: 'Warung', address: 'Jl. Melati', phone: '021 555', npwpd: null, footer: 'Terima kasih' })));
    save(host);
    await h.settle();
    expect(text(status(host))).toBe('Settings saved as version 1. Orders opened from now on use them.');
    expect(text(facts(host))).toContain('Version 1');
    expect(document.activeElement).toBe(named(host, 'Change tax rate'));
  });

  it('unchanged: an answered version equal to the one carried is not a save', async () => {
    const host = await open();
    change(host, 'Change phone');
    h.reply(SAVE, answer(V4));
    save(host);
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    expect(saveBody(h).expectedVersion).toBe(4);
    expect(text(status(host))).toBe('Nothing changed. Version 4 is still in force.');
    expect(text(facts(host))).toContain('Version 4');
    expect(document.activeElement).toBe(named(host, 'Change phone'));
  });

  it.each([
    ['VALIDATION_FAILED', invalid],
    ['NOT_FOUND', refusal('NOT_FOUND', undefined, 404)],
  ])('a general failure (%s): draft kept, nothing resent, no Try again', async (_name, reply) => {
    const host = await open();
    change(host, 'Change phone');
    fill(host, 'Phone', '021 555 0000');
    h.reply(SAVE, reply);
    save(host);
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    // Nothing was reread for a definite refusal that is not a stale draft.
    expect(h.count(READ)).toBe(1);
    expect(notice(host)!.getAttribute('role')).toBe('alert');
    expect(text(notice(host))).toBe('Something went wrongNothing was saved. Your draft is kept. Press Save to try again.');
    expect(notice(host)!.querySelector('button')).toBeNull();
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    expect(box(host, 'Phone').disabled).toBe(false);
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
    // Save carries the same version again, the manager’s own act.
    h.reply(SAVE, answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    save(host);
    await h.settle();
    expect(h.count(SAVE)).toBe(2);
    expect(saveBody(h, 1).expectedVersion).toBe(4);
    expect(text(status(host))).toContain('version 5');
  });

  it('shows Saving… with the status focused while the save is out, and locks the fields', async () => {
    const host = await open();
    change(host, 'Change phone');
    fill(host, 'Phone', '021 555 0000');
    h.hold(SAVE);
    save(host);
    await h.settle();
    expect(text(notice(host))).toBe('Saving…Wait for the result. Your draft is kept.');
    expect(document.activeElement).toBe(notice(host));
    expect(box(host, 'Phone').disabled).toBe(true);
    expect(named(host, 'Save').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('AC 7. the stale-draft refusal', () => {
  async function staleAfterEditing(reread = settingsView(V5)) {
    const host = await open();
    change(host, 'Change service charge rate');
    fill(host, 'Service charge rate', '6');
    fill(host, 'Phone', '021 555 0000');
    h.reply(SAVE, stale);
    h.reply(READ, reread);
    save(host);
    tap(named(confirmation()!, 'Save new rates'));
    await h.settle();
    return host;
  }

  it('keeps the draft, rereads once, shows what is in force beside each differing field, and names the newer version', async () => {
    const host = await staleAfterEditing();
    expect(h.count(SAVE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(box(host, 'Service charge rate').value).toBe('6');
    expect(box(host, 'Phone').value).toBe('021 555 0000');

    const n = notice(host)!;
    expect(n.getAttribute('role')).toBe('alert');
    expect(n.querySelector('strong')!.textContent).toBe('Settings changed while you were editing');
    expect(n.querySelector('p')!.textContent).toBe(
      'Nothing was saved. Version 5 was saved by Ratna Ayu on 21 Oct 2026, 14:32, after you started. Fields where it differs from your draft show its value. Choose which to keep.'
    );
    expect(document.activeElement).toBe(n);
    expect(text(host.querySelector('#service-rate-current'))).toBe('Now in force: 5,5%');
    expect(text(host.querySelector('#phone-current'))).toBe('Now in force: 021 555 0199');
    expect(host.querySelector('#tax-rate-current')).toBeNull();
    expect(box(host, 'Service charge rate').getAttribute('aria-describedby')).toBe('service-rate-current service-rate-help');
    // The facts line names the version in force, not the one the draft builds on.
    expect(text(facts(host))).toBe('Version 5 · In force since 21 Oct 2026, 14:32 · Saved by Ratna Ayu');
  });

  it('disables Save with its visible reason until a choice is made', async () => {
    const host = await staleAfterEditing();
    const button = named(host, 'Save');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-describedby')).toBe('save-hint');
    expect(text(host.querySelector('#save-hint'))).toBe('Choose Keep my changes or Use current settings first.');
    tap(button);
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(confirmation()).toBeNull();
  });

  it('Keep my changes sends nothing; the draft builds on the newer version; the next Save carries it', async () => {
    const host = await staleAfterEditing();
    tap(named(host, 'Keep my changes'));
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(text(notice(host))).toBe('Your changes now build on version 5Nothing has been saved yet. Press Save to save them.');
    expect(document.activeElement).toBe(named(host, 'Save'));
    expect(named(host, 'Save').getAttribute('aria-disabled')).toBeNull();
    expect(host.querySelector('#save-hint')).toBeNull();
    expect(box(host, 'Service charge rate').value).toBe('6');

    // The confirmation compares the draft with the version it now builds on.
    h.reply(SAVE, answer(withVersion(V5, { version: 6, serviceChargeRatePpm: '60000', phone: '021 555 0000' })));
    save(host);
    expect([...confirmation()!.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Service charge from 5,5% to 6%']);
    tap(named(confirmation()!, 'Save new rates'));
    await h.settle();
    expect(h.count(SAVE)).toBe(2);
    expect(saveBody(h, 1).expectedVersion).toBe(5);
    expect(text(status(host))).toContain('version 6');
  });

  it('Keep my changes sends nothing even when the next Save would need no confirmation', async () => {
    const host = await open();
    change(host, 'Change footer line');
    fill(host, 'Footer line', 'Sampai jumpa');
    h.reply(SAVE, stale);
    h.reply(READ, settingsView(withVersion(V4, { version: 5, createdByName: 'Ratna Ayu', phone: '021 555 0199' })));
    save(host);
    await h.settle();
    expect(h.count(SAVE)).toBe(1);

    tap(named(host, 'Keep my changes'));
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    expect(confirmation()).toBeNull();
    expect(text(notice(host))).toContain('Your changes now build on version 5');

    h.reply(SAVE, answer(withVersion(V4, { version: 6, footer: 'Sampai jumpa', phone: '021 555 0199' })));
    save(host);
    await h.settle();
    expect(h.count(SAVE)).toBe(2);
    expect(saveBody(h, 1).expectedVersion).toBe(5);
  });

  it('Use current settings sends nothing; the fields take the current values and the form is clean', async () => {
    const host = await staleAfterEditing();
    tap(named(host, 'Use current settings'));
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    expect(text(notice(host))).toBe('The form now shows version 5Nothing was saved. Edit it and save, or Cancel to close.');
    expect(box(host, 'Service charge rate').value).toBe('5,5');
    expect(box(host, 'Phone').value).toBe('021 555 0199');
    expect(host.querySelector('#service-rate-current')).toBeNull();
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
    // Clean against the version it now shows: Cancel closes with no decision.
    tap(named(host, 'Cancel'));
    expect(dialogNamed('Discard unsaved changes?')).toBeNull();
    expect(form(host)).toBeNull();
  });

  it('says so when the newer version has the same values as the draft', async () => {
    const host = await open();
    change(host, 'Change phone');
    fill(host, 'Phone', '021 555 0199');
    h.reply(SAVE, stale);
    h.reply(READ, settingsView(withVersion(V4, { version: 5, createdByName: 'Ratna Ayu', phone: '021 555 0199' })));
    save(host);
    await h.settle();
    expect(notice(host)!.querySelector('p')!.textContent).toContain('It has the same values as your draft. Choose which to keep.');
    expect(host.querySelector('.settings-current')).toBeNull();
  });

  it('a first-run save refused because another manager saved version 1 first is the same refusal', async () => {
    const host = await open(settingsView(null));
    tap(named(host, 'Enter settings'));
    fill(host, 'Tax rate', '10');
    fill(host, 'Service charge rate', '5');
    fill(host, 'Outlet name', 'Warung');
    fill(host, 'Address', 'Jl. Melati');
    fill(host, 'Phone', '021 555');
    fill(host, 'Footer line', 'Terima kasih');
    h.reply(SAVE, stale);
    h.reply(READ, settingsView(withVersion(V4, { version: 1 })));
    save(host);
    await h.settle();
    expect(notice(host)!.querySelector('strong')!.textContent).toBe('Settings changed while you were editing');
    expect(text(facts(host))).toContain('Version 1');
    expect(host.querySelector('#tax-rate-current')).toBeNull();
    expect(text(host.querySelector('#outlet-name-current'))).toBe('Now in force: Warung Sederhana');
    expect(text(host.querySelector('#npwpd-current'))).toBe('Now in force: P.2.0012345.07.001');
  });

  it('shows not set beside an NPWPD the newer version lacks', async () => {
    const host = await open();
    change(host, 'Change NPWPD');
    fill(host, 'NPWPD', 'N-1');
    h.reply(SAVE, stale);
    h.reply(READ, settingsView(withVersion(V5, { npwpd: null })));
    save(host);
    await h.settle();
    expect(text(host.querySelector('#npwpd-current'))).toBe('Now in force: not set');
  });

  it('when the reread fails too, the refusal stands as the general failure: draft kept, nothing resent', async () => {
    const host = await open();
    change(host, 'Change phone');
    fill(host, 'Phone', '021 555 0000');
    h.reply(SAVE, stale);
    h.reply(READ, failure);
    save(host);
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    expect(text(notice(host))).toBe('Something went wrongNothing was saved. Your draft is kept. Press Save to try again.');
    expect(box(host, 'Phone').value).toBe('021 555 0000');
  });
});

describe('AC 8. an unknown outcome', () => {
  async function unknown(first: Reply, reread: Reply) {
    const host = await open();
    change(host, 'Change phone');
    fill(host, 'Phone', '021 555 0000');
    h.reply(SAVE, first);
    h.reply(READ, reread);
    save(host);
    await h.settle();
    return host;
  }

  it.each([
    ['a failed answer', failure],
    ['an unavailable system', 'reject'],
  ] as Array<[string, Reply]>)('%s: one reread, never a resend; the same version read gives the plain uncertainty', async (_name, first) => {
    const host = await unknown(first, settingsView(V4));
    expect(h.count(SAVE)).toBe(1);
    expect(h.count(READ)).toBe(2);
    expect(notice(host)!.querySelector('strong')!.textContent).toBe('Outcome not confirmed');
    expect(notice(host)!.querySelector('p')!.textContent).toBe(
      'The outcome could not be confirmed. The settings have been read again; version 4 is in force. Your draft is kept; nothing was sent again.'
    );
    expect(notice(host)!.querySelector('button')).toBeNull();
    expect(box(host, 'Phone').value).toBe('021 555 0000');
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
    expect(text(facts(host))).toContain('Version 4');
  });

  it('a newer version read gives the uncertainty with the stale comparison, its two choices, and “It may be this save.”', async () => {
    const host = await unknown(failure, settingsView(V5));
    expect(h.count(SAVE)).toBe(1);
    expect(notice(host)!.querySelector('p')!.textContent).toBe(
      'The outcome could not be confirmed. The settings have been read again: version 5, saved by Ratna Ayu on 21 Oct 2026, 14:32, is now in force. It may be this save. Fields where it differs from your draft show its value. Your draft is kept; nothing was sent again. Choose which to keep.'
    );
    expect(text(host.querySelector('#phone-current'))).toBe('Now in force: 021 555 0199');
    expect(document.activeElement).toBe(notice(host));
    expect(text(facts(host))).toContain('Version 5');
    expect(named(host, 'Save').getAttribute('aria-disabled')).toBe('true');

    // The explicit resend after Keep carries version 5, and nothing was inferred from the reread.
    tap(named(host, 'Keep my changes'));
    expect(h.count(SAVE)).toBe(1);
    h.reply(SAVE, answer(V5));
    save(host);
    // The draft keeps the service charge V5 changed, so the confirmation shows it being undone.
    expect([...confirmation()!.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Service charge from 5,5% to 5%']);
    tap(named(confirmation()!, 'Save new rates'));
    await h.settle();
    expect(saveBody(h, 1).expectedVersion).toBe(5);
  });

  it('a lost response to one’s own save reads “It has the same values as your draft”', async () => {
    const mine = withVersion(V4, { version: 5, phone: '021 555 0000' });
    const host = await unknown(failure, settingsView(mine));
    expect(notice(host)!.querySelector('p')!.textContent).toContain('It has the same values as your draft.');
  });

  it('a failed reread withholds the facts line, and Try again repeats the read only', async () => {
    const host = await unknown(failure, failure);
    expect(h.count(SAVE)).toBe(1);
    expect(facts(host)).toBeNull();
    expect(text(notice(host))).toBe(
      'Outcome not confirmedThe outcome could not be confirmed. The settings could not be read again. Your draft is kept; nothing was sent again.Try again'
    );
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
    expect(box(host, 'Phone').value).toBe('021 555 0000');

    h.reply(READ, settingsView(V4));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
    expect(h.count(READ)).toBe(3);
    expect(text(facts(host))).toContain('Version 4');
    expect(notice(host)!.querySelector('p')!.textContent).toContain('version 4 is in force');
    expect(box(host, 'Phone').value).toBe('021 555 0000');
  });

  it('Try again after a failed reread that now shows a newer version offers the two choices', async () => {
    const host = await unknown(failure, failure);
    h.reply(READ, settingsView(V5));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(notice(host)!.querySelector('p')!.textContent).toContain('It may be this save.');
    expect(text(host.querySelector('#phone-current'))).toBe('Now in force: 021 555 0199');
    expect(h.count(SAVE)).toBe(1);
  });

  it('at the first run, an unknown outcome whose reread shows nothing saved names no version', async () => {
    const host = await open(settingsView(null));
    tap(named(host, 'Enter settings'));
    fill(host, 'Tax rate', '10');
    fill(host, 'Service charge rate', '5');
    fill(host, 'Outlet name', 'Warung');
    fill(host, 'Address', 'Jl. Melati');
    fill(host, 'Phone', '021 555');
    fill(host, 'Footer line', 'Terima kasih');
    h.reply(SAVE, failure);
    h.reply(READ, settingsView(null));
    save(host);
    await h.settle();
    expect(notice(host)!.querySelector('strong')!.textContent).toBe('Outcome not confirmed');
    expect(notice(host)!.querySelector('p')!.textContent).not.toMatch(/version \d/);
    expect(h.count(SAVE)).toBe(1);
  });
});

describe('AC 9. one command at a time', () => {
  it('a second press of Save while one is pending sends nothing', async () => {
    const host = await open();
    change(host, 'Change phone');
    fill(host, 'Phone', '021 555 0000');
    h.hold(SAVE);
    save(host);
    await h.settle();
    save(host);
    save(host);
    await h.settle();
    expect(h.count(SAVE)).toBe(1);
  });

  it('after Discard the discarded save keeps every Change inert, and the waiting sentence stands until its answer, which lands silently', async () => {
    const host = await open();
    change(host, 'Change phone');
    fill(host, 'Phone', '021 555 0000');
    const held = h.hold(SAVE);
    save(host);
    await h.settle();
    tap(named(host, 'Cancel'));
    tap(named(dialogNamed('Discard unsaved changes?')!, 'Discard'));
    expect(form(host)).toBeNull();
    expect(text(status(host))).toBe('Waiting for an earlier save to finish. Nothing will be sent again.');
    for (const button of host.querySelectorAll<HTMLElement>('[data-change]')) {
      expect(button.getAttribute('aria-disabled')).toBe('true');
      tap(button);
    }
    expect(form(host)).toBeNull();
    expect(h.count(SAVE)).toBe(1);

    held.deliver(answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    await h.settle();
    // Silent: no announcement and no move of focus; the page now shows the answered version.
    expect(status(host)).toBeNull();
    expect(text(facts(host))).toContain('Version 5');
    expect(text(host.querySelector('#settings-view'))).toContain('021 555 0000');
    expect(named(host, 'Change phone').getAttribute('aria-disabled')).toBeNull();
    expect(h.count(SAVE)).toBe(1);
  });
});

describe('a read that began before an answer never undoes it', () => {
  it('an older version arriving late does not replace a newer one', async () => {
    const host = await open();
    const rail = host.querySelector<HTMLElement>('.bonav')!;
    tap(named(rail, 'Tables'));
    await h.settle();
    const late = h.hold(READ);
    tap(named(rail, 'Settings'));
    await h.settle();
    change(host, 'Change phone');
    fill(host, 'Phone', '021 555 0000');
    h.reply(SAVE, answer(withVersion(V4, { version: 5, phone: '021 555 0000' })));
    save(host);
    await h.settle();
    expect(text(facts(host))).toContain('Version 5');

    late.deliver(settingsView(V4));
    await h.settle();
    expect(text(facts(host))).toContain('Version 5');
    expect(text(host.querySelector('#settings-view'))).toContain('021 555 0000');
  });
});
