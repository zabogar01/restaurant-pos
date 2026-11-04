// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { POLL_MS } from '../src/catalog/catalogStore.js';
import { OrderScreen } from '../src/OrderPanel.js';
import {
  MEALS,
  NASI,
  SATE,
  TEA,
  makeCatalogHarness,
  menuOf,
  mountServed,
  ok,
  type CatalogHarness,
  type ServedItem,
} from './served-harness.js';

// PHASE1-S7b2 round 2 (the lead's rulings R1 to R3): the served line editor, the fire notice's one recovery
// control, and the removed-options notice.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SIZES = [
  { id: 'small', name: 'Small', delta: '-10000' },
  { id: 'large', name: 'Large', delta: '20000' },
];
const EXTRAS = [
  { id: 'egg', name: 'Fried egg', delta: '5000' },
  { id: 'chili', name: 'Extra chili', delta: '0' },
];
const FULL: ServedItem = { ...NASI, variants: SIZES, modifiers: EXTRAS };
const W64 = 'W'.repeat(64);

let h: CatalogHarness;
let screen: ReturnType<typeof mountServed> | undefined;
let version = 1;

afterEach(() => {
  screen?.unmount();
  screen = undefined;
  window.history.replaceState(null, '', '/pos/order');
});

async function open(items: ServedItem[], view?: Parameters<typeof mountServed>[1]) {
  h = makeCatalogHarness(menuOf(1, MEALS, items));
  version = 1;
  screen = mountServed(h, view);
  await h.settle();
}

async function change(items: ServedItem[]) {
  version += 1;
  h.revision(ok({ version }));
  h.menu(ok(menuOf(version, MEALS, items)));
  await h.advance(POLL_MS);
}

const q = (selector: string) => screen!.host.querySelector<HTMLElement>(selector);
const all = (selector: string) => [...screen!.host.querySelectorAll<HTMLElement>(selector)];
const press = (el: Element | null) => act(() => (el as HTMLElement).click());
const option = (id: string) => q(`.sheet [data-option="${id}"]`)!;
const buttonText = (text: string) => all('.sheet button').find((b) => b.textContent === text)!;
const addFromSheet = (itemId: string) => {
  press(q(`.menu-tile[data-item="${itemId}"]`));
  press(buttonText('Add to order'));
};
const tab = (from: Element, shift = false) =>
  act(() => void from.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true })));

describe('R1. a pending line of a served order opens its editor in the served frame', () => {
  async function editor() {
    await open([{ ...NASI, name: W64 }, SATE, TEA], { state: 'empty' });
    addFromSheet('nasi');
    press(q('.order-line[data-line-id^="nasi-"] .order-line__target'));
  }

  it('carries the served class, the full heading, and opens with focus on the heading', async () => {
    await editor();
    expect(q('.sheet')!.classList.contains('sheet--served')).toBe(true);
    expect(q('#sheet-title')!.textContent).toBe(`${W64} — pending`);
    expect(document.activeElement).toBe(q('#sheet-title'));
  });

  it('wraps Tab from Update to n to Back, and Shift-Tab from Back to Update', async () => {
    await editor();
    const keys = all('.sheet button');
    const last = keys[keys.length - 1]!;
    const first = keys[0]!;
    expect(first.textContent).toBe('Back');
    expect(last.textContent).toMatch(/^Update to/);
    act(() => last.focus());
    tab(last);
    expect(document.activeElement).toBe(first);
    tab(first, true);
    expect(document.activeElement).toBe(last);
  });

  it('reserves the one reason row, as the served item sheet does', async () => {
    await editor();
    expect(q('.sheet #served-add-reason')).not.toBeNull();
  });

  it('a fixture line editor keeps its reviewed layout: no served class, no reason row, focus on the dialog', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    window.history.replaceState(null, '', '/pos/order?state=sheet-line');
    act(() => root.render(<OrderScreen view={{ state: 'sheet-line' }} />));
    const sheet = host.querySelector('.sheet')!;
    expect(sheet.classList.contains('sheet--served')).toBe(false);
    expect(host.querySelector('.sheet #served-add-reason')).toBeNull();
    expect(host.querySelector('.sheet__reason')).toBeNull();
    expect(document.activeElement).toBe(sheet);
    act(() => root.unmount());
    host.remove();
  });
});

describe('R2. the served fire refusal draws one recovery control', () => {
  const shows = () => all('#fire-refusal button');

  it('two lines for one item: one control, which focuses the first blocking line', async () => {
    await open([NASI, SATE, TEA], { state: 'empty' });
    addFromSheet('nasi');
    addFromSheet('nasi');
    await change([{ ...NASI, available: false }, SATE, TEA]);
    expect(shows().map((b) => b.textContent)).toEqual(['Show unavailable lines']);
    expect(shows()[0]!.getAttribute('data-action')).toBe('served-show-blocked');
    press(shows()[0]!);
    const first = q('.order-line[data-line-id^="nasi-"]')!;
    expect(document.activeElement).toBe(first.querySelector('.order-line__target'));
  });

  it('two distinct items: one control, which focuses the first line in order', async () => {
    await open([NASI, SATE, TEA], { state: 'empty' });
    addFromSheet('sate');
    addFromSheet('nasi');
    await change([{ ...NASI, available: false }, { ...SATE, available: false }, TEA]);
    expect(shows().map((b) => b.textContent)).toEqual(['Show unavailable lines']);
    press(shows()[0]!);
    expect(document.activeElement).toBe(q('.order-line[data-line-id^="sate-"] .order-line__target'));
  });
});

describe('R3. removed choices: one is named, more than one is the reviewed generic sentence', () => {
  const GENERIC = 'This item changed while you were choosing. Check the updated choices and prices before adding.';
  const notice = () => q('#served-sheet-notice')!.textContent;

  async function chosen() {
    await open([FULL, SATE, TEA]);
    press(q('.menu-tile[data-item="nasi"]'));
    press(option('small'));
    press(option('egg'));
    press(option('chili'));
  }

  it('one removal still names the option', async () => {
    await chosen();
    await change([{ ...FULL, modifiers: [EXTRAS[1]!] }, SATE, TEA]);
    expect(notice()).toBe('This item changed while you were choosing. Fried egg was removed and deselected.');
  });

  it('two removed at once show the generic sentence; they still leave the choices and the total', async () => {
    await chosen();
    await change([{ ...FULL, modifiers: [] }, SATE, TEA]);
    expect(notice()).toBe(GENERIC);
    expect(q('#served-unit')!.textContent).toBe('35.000');
  });

  it('two removed across successive polls show the generic sentence', async () => {
    await chosen();
    await change([{ ...FULL, modifiers: [EXTRAS[1]!] }, SATE, TEA]);
    expect(notice()).toContain('Fried egg was removed');
    await change([{ ...FULL, modifiers: [] }, SATE, TEA]);
    expect(notice()).toBe(GENERIC);
  });

  it('a variant and a modifier count alike, and the removed variant still turns Add off', async () => {
    await chosen();
    await change([{ ...FULL, variants: [SIZES[1]!], modifiers: [EXTRAS[1]!] }, SATE, TEA]);
    expect(notice()).toBe(GENERIC);
    expect(buttonText('Add to order').getAttribute('aria-disabled')).toBe('true');
    expect(q('#served-add-reason')!.textContent).toBe('Choose a variant before adding this item.');
  });
});
