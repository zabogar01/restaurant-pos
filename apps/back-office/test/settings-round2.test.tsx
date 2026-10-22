// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIVITY, REAUTH, VIEW, button, field, ok, press, refusal, sessionState, text, type,
} from './session-harness.js';
import {
  READ, SAVE, V4, V5, box, facts, fill, form, notice, openSettings, settingsHarness, settingsView, status, withVersion,
} from './settings-support.js';
import { dialogNamed, named, tap } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Round 2: the review's six findings (PHASE1-S2b). Each test here fails against round 1.

let h: ReturnType<typeof settingsHarness>;
let view: Awaited<ReturnType<typeof openSettings>> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const failure = refusal('INTERNAL', undefined, 500);
const stale = refusal('SETTINGS_CHANGED', undefined, 409);

const open = async (first?: Parameters<typeof openSettings>[1]) => {
  h = settingsHarness();
  view = await openSettings(h, first);
  return view.host;
};

const decision = () => dialogNamed('Discard unsaved changes?');

function dirtyPhone(host: HTMLElement) {
  tap(named(host, 'Change phone'));
  fill(host, 'Phone', '021 555 0000');
}

async function goIdle(host: HTMLElement) {
  h.reply(ACTIVITY, refusal('SESSION_IDLE'));
  press();
  await h.settle();
  expect(sessionState(host)).toBe('idle');
}

async function resume(host: HTMLElement) {
  h.reply(REAUTH, ok(VIEW));
  type(field(document.body, 'Password'), 'correct horse');
  tap(button(document.body, 'Continue'));
  await h.settle();
  expect(sessionState(host)).toBe('signed-in');
}

describe('F1. the facts stay withheld after a failed reread, whether or not the form is still there', () => {
  it('Discard while the save is pending, then the save fails and the reread fails', async () => {
    const host = await open();
    dirtyPhone(host);
    const held = h.hold(SAVE);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    h.reply(READ, failure);
    held.deliver(failure);
    await h.settle();
    expect(form(host)).toBeNull();
    expect(status(host)).toBeNull();
    expect(facts(host)).toBeNull();
    expect(named(host, 'Change phone').getAttribute('aria-disabled')).toBeNull();
    expect(h.count(SAVE)).toBe(1);

    // A later successful read brings the facts back.
    h.reply(READ, settingsView(V4));
    tap(named(host.querySelector<HTMLElement>('.bonav')!, 'Tables'));
    await h.settle();
    tap(named(host.querySelector<HTMLElement>('.bonav')!, 'Settings'));
    await h.settle();
    expect(text(facts(host))).toContain('Version 4');
  });

  it('Discard during the reread', async () => {
    const host = await open();
    dirtyPhone(host);
    h.reply(SAVE, failure);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    tap(named(decision()!, 'Discard'));
    reread.deliver(failure);
    await h.settle();
    expect(form(host)).toBeNull();
    expect(facts(host)).toBeNull();
    expect(h.count(SAVE)).toBe(1);
  });
});

describe('F2. a gate that closes during the result’s reread', () => {
  it('M-6 opens during the unknown outcome’s reread: nothing is presented until the same manager returns, then once, with focus', async () => {
    const host = await open();
    dirtyPhone(host);
    h.reply(SAVE, failure);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    reread.deliver(settingsView(V4));
    await h.settle();
    expect(text(notice(host))).toContain('Saving…');

    await resume(host);
    expect(text(notice(host))).toContain('Outcome not confirmed');
    expect(document.activeElement).toBe(box(host, 'Tax rate'));
    expect(h.count(SAVE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });

  it('the departure decision opens during the reread: the result waits for it, and Stay presents it once', async () => {
    const host = await open();
    dirtyPhone(host);
    h.reply(SAVE, failure);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    tap(named(host, 'Cancel'));
    expect(decision()).not.toBeNull();
    reread.deliver(settingsView(V5));
    await h.settle();
    expect(decision()).not.toBeNull();
    expect(text(notice(host))).toContain('Saving…');

    tap(named(decision()!, 'Stay'));
    await h.settle();
    expect(text(notice(host))).toContain('version 5');
    expect(h.count(SAVE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });

  it('the same for a stale refusal’s reread under M-6', async () => {
    const host = await open();
    dirtyPhone(host);
    h.reply(SAVE, stale);
    const reread = h.hold(READ);
    tap(named(host, 'Save'));
    await h.settle();
    await goIdle(host);
    reread.deliver(settingsView(V5));
    await h.settle();
    expect(text(notice(host))).toContain('Saving…');

    await resume(host);
    expect(notice(host)!.querySelector('strong')!.textContent).toBe('Settings changed while you were editing');
    expect(document.activeElement).toBe(notice(host));
    expect(h.count(SAVE)).toBe(1);
    expect(h.count(READ)).toBe(2);
  });
});

describe('F3. the stale comparison follows the draft', () => {
  async function staleHost() {
    const host = await open();
    dirtyPhone(host);
    h.reply(SAVE, stale);
    h.reply(READ, settingsView(V5));
    tap(named(host, 'Save'));
    await h.settle();
    return host;
  }

  it('a field becoming equal loses its annotation, a field becoming different gains one, and the sentence follows', async () => {
    const host = await staleHost();
    expect(text(host.querySelector('#phone-current'))).toBe('Now in force: 021 555 0199');
    expect(text(host.querySelector('#service-rate-current'))).toBe('Now in force: 5,5%');

    fill(host, 'Phone', '021 555 0199');
    expect(host.querySelector('#phone-current')).toBeNull();
    expect(box(host, 'Phone').getAttribute('aria-describedby')).toBe('phone-help');
    expect(notice(host)!.querySelector('p')!.textContent).toContain('Fields where it differs');

    fill(host, 'Service charge rate', ' 5,50 % ');
    expect(host.querySelector('#service-rate-current')).toBeNull();
    expect(notice(host)!.querySelector('p')!.textContent).toContain('It has the same values as your draft.');

    fill(host, 'Tax rate', '12');
    expect(text(host.querySelector('#tax-rate-current'))).toBe('Now in force: 10%');
    expect(notice(host)!.querySelector('p')!.textContent).toContain('Fields where it differs');
    expect(h.count(SAVE)).toBe(1);
  });

  it('the annotations stay after Keep my changes and keep following the draft', async () => {
    const host = await staleHost();
    tap(named(host, 'Keep my changes'));
    fill(host, 'Phone', '021 555 0199');
    expect(host.querySelector('#phone-current')).toBeNull();
    expect(text(host.querySelector('#service-rate-current'))).toBe('Now in force: 5,5%');
  });

  it('Try again after a failed reread compares against the draft as it is now', async () => {
    const host = await open();
    dirtyPhone(host);
    h.reply(SAVE, failure);
    h.reply(READ, failure);
    tap(named(host, 'Save'));
    await h.settle();
    fill(host, 'Phone', '021 555 0199');
    h.reply(READ, settingsView(V5));
    tap(named(host, 'Try again'));
    await h.settle();
    expect(notice(host)!.querySelector('p')!.textContent).toContain('It may be this save.');
    expect(host.querySelector('#phone-current')).toBeNull();
    expect(text(host.querySelector('#service-rate-current'))).toBe('Now in force: 5,5%');
  });
});

describe('F4. the first-run context after a version exists', () => {
  async function firstRunDraft() {
    const host = await open(settingsView(null));
    tap(named(host, 'Enter settings'));
    fill(host, 'Tax rate', '10');
    fill(host, 'Service charge rate', '5');
    fill(host, 'Outlet name', 'Warung');
    fill(host, 'Address', 'Jl. Melati');
    fill(host, 'Phone', '021 555');
    fill(host, 'Footer line', 'Terima kasih');
    return host;
  }
  const FIRST = 'Nothing is saved yet. Enter every rate and detail; saving creates version 1.';
  const EDIT = 'Changes apply to orders opened after you save. Orders already open keep the settings they opened with.';

  it('after a stale refusal that shows version 1, the form is the edit form', async () => {
    const host = await firstRunDraft();
    expect(host.querySelector('#settings-form-title')!.textContent).toBe('Enter settings');
    h.reply(SAVE, stale);
    h.reply(READ, settingsView(withVersion(V4, { version: 1 })));
    tap(named(host, 'Save'));
    await h.settle();
    expect(host.querySelector('#settings-form-title')!.textContent).toBe('Edit settings');
    expect(text(host.querySelector('#settings-context'))).toBe(EDIT);
  });

  it('after an unknown outcome whose reread shows version 1, the form is the edit form', async () => {
    const host = await firstRunDraft();
    h.reply(SAVE, failure);
    h.reply(READ, settingsView(V4));
    tap(named(host, 'Save'));
    await h.settle();
    expect(host.querySelector('#settings-form-title')!.textContent).toBe('Edit settings');
    expect(text(host.querySelector('#settings-context'))).toBe(EDIT);
  });

  it('while the reread failed, nothing claims that nothing is saved', async () => {
    const host = await firstRunDraft();
    h.reply(SAVE, failure);
    h.reply(READ, failure);
    tap(named(host, 'Save'));
    await h.settle();
    expect(text(host.querySelector('#settings-context'))).not.toContain('Nothing is saved yet');
    expect(host.querySelector('#settings-form-title')!.textContent).toBe('Edit settings');
  });

  it('while the read shows none, the first-run form stays', async () => {
    const host = await firstRunDraft();
    h.reply(SAVE, failure);
    h.reply(READ, settingsView(null));
    tap(named(host, 'Save'));
    await h.settle();
    expect(host.querySelector('#settings-form-title')!.textContent).toBe('Enter settings');
    expect(text(host.querySelector('#settings-context'))).toBe(FIRST);
  });
});

describe('F5. the money facts in the closed first-run state', () => {
  it('shows currency, decimal places and the fixed note before Enter settings and after a clean Cancel, with no rate and no input', async () => {
    const host = await open(settingsView(null));
    const check = () => {
      const t = host.textContent!;
      expect(t).toContain('CurrencyIDR · Indonesian rupiah');
      expect(t).toContain('Decimal places0 · amounts are whole rupiah');
      expect(t).toContain('Fixed for this installation.');
      expect(host.querySelectorAll('input, select, textarea')).toHaveLength(0);
      expect(t).not.toContain('%');
      expect(named(host, 'Enter settings')).toBeTruthy();
    };
    check();
    tap(named(host, 'Enter settings'));
    tap(named(host, 'Cancel'));
    check();
  });

  it('shows none of it while the read has not succeeded', async () => {
    h = settingsHarness();
    view = await openSettings(h, failure);
    expect(view.host.textContent).not.toContain('IDR');
  });
});

describe('F6. the dependency is declared', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

  it('apps/back-office/package.json and the lockfile list @pos/money after @pos/contracts', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'apps/back-office/package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).slice(0, 4)).toEqual(['@pos/api-client', '@pos/contracts', '@pos/money', '@pos/tokens']);
    expect(pkg.dependencies['@pos/money']).toBe('*');
    const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8')) as {
      packages: Record<string, { dependencies?: Record<string, string> }>;
    };
    expect(lock.packages['apps/back-office']!.dependencies!['@pos/money']).toBe('*');
  });
});

void withVersion;
