// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { POLL_MS } from '../src/catalog/catalogStore.js';
import {
  FAILED,
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

// PHASE1-S7b2: M-2 for a served item (consult C4 items 1 to 3, 7 and 8; DESIGN-021 rules 7 to 11). The
// screen is the very one the fixture tests draw over the real catalog store with its two reads stubbed
// (served-harness.tsx). Layout is not measurable in jsdom: the pixel claims (the fixed band, the long
// name) are the browser spec's, and what is asserted here is structure, names, state and focus.

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

let h: CatalogHarness;
let screen: ReturnType<typeof mountServed> | undefined;

afterEach(() => {
  screen?.unmount();
  screen = undefined;
  window.history.replaceState(null, '', '/pos/order');
});

async function open(items: ServedItem[] = [FULL, SATE, TEA], view?: Parameters<typeof mountServed>[1]) {
  h = makeCatalogHarness(menuOf(1, MEALS, items));
  screen = mountServed(h, view);
  await h.settle();
  return screen.host;
}

let version = 1;
/** A change the poll brings: the revision moves and the menu read answers the new body. */
async function change(items: ServedItem[]) {
  version += 1;
  const body = menuOf(version, MEALS, items);
  h.revision(ok({ version }));
  h.menu(ok(body));
  await h.advance(POLL_MS);
}

const host = () => screen!.host;
const q = (selector: string) => host().querySelector<HTMLElement>(selector);
const all = (selector: string) => [...host().querySelectorAll<HTMLElement>(selector)];
const press = (el: Element | null) => act(() => (el as HTMLElement).click());
const tile = (id: string) => q(`.menu-tile[data-item="${id}"]`)!;
const dialog = () => q('[role="dialog"]');
const option = (id: string) => q(`.sheet [data-option="${id}"]`)!;
const add = () => [...host().querySelectorAll<HTMLButtonElement>('.sheet button')].find((b) => b.textContent === 'Add to order')!;
const cancel = () => [...host().querySelectorAll<HTMLButtonElement>('.sheet button')].find((b) => b.textContent === 'Cancel')!;
const plus = () => q('.sheet [aria-label="Increase quantity"]')!;
const reason = () => q('#served-add-reason')!;
const notice = () => q('#served-sheet-notice')!;
const unit = () => q('#served-unit')!.textContent;
const lineTotal = () => q('[data-line-total]')!.textContent;
const off = (el: Element) => el.getAttribute('aria-disabled') === 'true';
const pressed = (id: string) => option(id).getAttribute('aria-pressed') === 'true';
const lines = () => all('.order-line');
const escape = () => act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

const CHANGED = 'This item changed while you were choosing. Check the updated choices and prices before adding.';

describe('1. any served item opens M-2 by component state, with nothing chosen', () => {
  it('opens at the same address, as a dialog named by the full item name', async () => {
    await open();
    const before = window.location.href;
    press(tile('nasi'));
    expect(dialog()).not.toBeNull();
    expect(window.location.href).toBe(before);
    expect(q('#sheet-title')!.textContent).toBe('Nasi Goreng');
    expect(dialog()!.getAttribute('aria-labelledby')).toBe('sheet-title');
  });

  it('draws the two fixed groups, and nothing in either is chosen', async () => {
    await open();
    press(tile('nasi'));
    const labels = all('.sheet .sheet__label').map((l) => l.textContent);
    expect(labels).toEqual(['Variant — choose one', 'Modifiers — choose any']);
    expect(all('.sheet [aria-pressed="true"]')).toEqual([]);
    expect(all('.sheet [data-option]').map((o) => o.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'false']);
    expect(option('small').textContent).toBe('Small −10.000');
    expect(option('egg').textContent).toBe('Fried egg +5.000');
    expect(option('chili').textContent).toBe('Extra chili +0');
  });

  it('draws no group for an empty list, and every tile opens a sheet, a no-option item included', async () => {
    await open();
    press(tile('sate'));
    expect(dialog()).not.toBeNull();
    expect(all('.sheet .sheet-group')).toEqual([]);
    expect(unit()).toBe('38.000');
    expect(off(add())).toBe(false);
  });

  it('a modifiers-only item draws one group, and the variants-only item the other', async () => {
    await open([{ ...NASI, modifiers: EXTRAS }, { ...SATE, variants: SIZES }, TEA]);
    press(tile('nasi'));
    expect(all('.sheet .sheet__label').map((l) => l.textContent)).toEqual(['Modifiers — choose any']);
    press(cancel());
    press(tile('sate'));
    expect(all('.sheet .sheet__label').map((l) => l.textContent)).toEqual(['Variant — choose one']);
  });
});

describe('2. an item with variants needs exactly one chosen before Add', () => {
  it('Add is off, with the reason, until a variant is chosen; choosing another replaces the first', async () => {
    await open();
    press(tile('nasi'));
    expect(off(add())).toBe(true);
    expect(add().hasAttribute('disabled')).toBe(false);
    expect(reason().textContent).toBe('Choose a variant before adding this item.');
    expect(add().getAttribute('aria-describedby')).toBe('served-add-reason');
    press(option('small'));
    expect(off(add())).toBe(false);
    expect(reason().textContent).toBe('');
    press(option('large'));
    expect([pressed('small'), pressed('large')]).toEqual([false, true]);
  });

  it('a modifiers-only item needs none, and until a variant is chosen the figures are the base plus the modifiers', async () => {
    await open();
    press(tile('nasi'));
    press(option('egg'));
    expect(unit()).toBe('50.000');
    press(option('small'));
    expect(unit()).toBe('40.000');
    press(option('small'));
  });

  it('pressing the off Add changes nothing: no line, the sheet stays', async () => {
    await open();
    press(tile('nasi'));
    press(add());
    expect(dialog()).not.toBeNull();
    expect(lines().some((l) => l.getAttribute('data-line-id')?.startsWith('nasi'))).toBe(false);
  });
});

describe('3. Add snapshots the names, the deltas and the floored unit (AC-26)', () => {
  it('puts a line into the order carrying the chosen names and deltas, at the resolved unit × quantity', async () => {
    await open();
    press(tile('nasi'));
    press(option('small'));
    press(option('egg'));
    press(plus());
    expect(unit()).toBe('40.000');
    expect(lineTotal()).toBe('80.000');
    press(add());
    expect(dialog()).toBeNull();
    const line = lines().find((l) => l.getAttribute('data-line-id')?.startsWith('nasi-'))!;
    expect(line.querySelector('.order-line__quantity')!.textContent).toBe('2');
    expect(line.querySelector('.order-line__name')!.textContent).toBe('Nasi Goreng');
    expect(line.querySelector('.order-line__detail')!.textContent).toBe('Small (−10.000) · Fried egg (+5.000)');
    expect(line.querySelector('.order-line__amount')!.textContent).toBe('80.000');
  });

  it('a zero delta is written as the bare name', async () => {
    await open();
    press(tile('nasi'));
    press(option('large'));
    press(option('chili'));
    press(add());
    const line = lines().find((l) => l.getAttribute('data-line-id')?.startsWith('nasi-'))!;
    expect(line.querySelector('.order-line__detail')!.textContent).toBe('Large (+20.000) · Extra chili');
  });

  it('floors the UNIT at zero: base 10.000 with a variant of −20.000 is a unit of 0, and stays 0 when the quantity is edited', async () => {
    await open([{ ...NASI, price: '10000', variants: [{ id: 'deal', name: 'Deal', delta: '-20000' }] }, SATE, TEA]);
    press(tile('nasi'));
    press(option('deal'));
    expect(unit()).toBe('0');
    expect(lineTotal()).toBe('0');
    press(plus());
    press(add());
    const line = () => lines().find((l) => l.getAttribute('data-line-id')?.startsWith('nasi-'))!;
    expect(line().querySelector('.order-line__amount')!.textContent).toBe('0');
    // Edited later, the line reprices from its own unit: a negative unit would give −20.000 here.
    press(line().querySelector('.order-line__target'));
    press(plus());
    press(q('[data-action="update-quantity"]'));
    expect(line().querySelector('.order-line__quantity')!.textContent).toBe('3');
    expect(line().querySelector('.order-line__amount')!.textContent).toBe('0');
  });
});

describe('7. the open sheet follows the item between polls', () => {
  /** Opens Nasi, chooses Small and Fried egg. */
  async function chosen(items?: ServedItem[]) {
    await open(items);
    press(tile('nasi'));
    press(option('small'));
    press(option('egg'));
  }

  it('an 86 keeps the choices, marks the item unavailable and turns Add off; the stepper stays', async () => {
    await chosen();
    await change([{ ...FULL, available: false }, SATE, TEA]);
    expect(dialog()).not.toBeNull();
    expect([pressed('small'), pressed('egg')]).toEqual([true, true]);
    expect(notice().textContent).toBe('Nasi Goreng is no longer available. A manager marked it 86. Your choices are kept, but it cannot be added.');
    expect(off(add())).toBe(true);
    expect(reason().textContent).toBe('This item is unavailable.');
    expect(add().getAttribute('aria-describedby')).toBe('served-add-reason');
    // The stepper stays (DESIGN-021 rule 10): quantity can still be drafted, Add alone is blocked.
    press(plus());
    expect(q('.sheet-stepper__value')!.textContent).toBe('2');
    expect(off(plus())).toBe(false);
  });

  it('restoring the item takes the notice away, keeps the choices, and Add is on again', async () => {
    await chosen();
    await change([{ ...FULL, available: false }, SATE, TEA]);
    press(plus());
    await change([FULL, SATE, TEA]);
    expect(notice().textContent).toBe('');
    expect([pressed('small'), pressed('egg')]).toEqual([true, true]);
    expect(q('.sheet-stepper__value')!.textContent).toBe('2');
    expect(off(add())).toBe(false);
  });

  it('an archived item (it left the projection) keeps its last-known name, options and choices, and Add is off', async () => {
    await chosen();
    await change([SATE, TEA]);
    expect(dialog()).not.toBeNull();
    expect(q('#sheet-title')!.textContent).toBe('Nasi Goreng');
    expect([pressed('small'), pressed('egg')]).toEqual([true, true]);
    expect(option('large').textContent).toBe('Large +20.000');
    expect(notice().textContent).toBe('Nasi Goreng is no longer on the menu. Your choices are kept, but it cannot be added.');
    expect(notice().textContent).not.toContain('86');
    expect(off(add())).toBe(true);
    expect(reason().textContent).toBe('This item is no longer on the menu.');
  });

  it('Cancel on an archived item returns to a grid without that tile, with focus on the selected category', async () => {
    await chosen();
    await change([SATE, TEA]);
    press(cancel());
    expect(dialog()).toBeNull();
    expect(q('.menu-tile[data-item="nasi"]')).toBeNull();
    expect(document.activeElement).toBe(q('.menu-category[aria-pressed="true"]'));
  });

  it('a restored (reappeared) item is as the row for available', async () => {
    await chosen();
    await change([SATE, TEA]);
    await change([FULL, SATE, TEA]);
    expect(notice().textContent).toBe('');
    expect([pressed('small'), pressed('egg')]).toEqual([true, true]);
    expect(off(add())).toBe(false);
  });

  it('a price change updates the figures at once, raises one notice that stays, and Add stays on', async () => {
    await chosen();
    expect(unit()).toBe('40.000');
    await change([{ ...FULL, price: '50000' }, SATE, TEA]);
    expect(unit()).toBe('45.000');
    expect(lineTotal()).toBe('45.000');
    expect(notice().textContent).toBe(CHANGED);
    expect(off(add())).toBe(false);
    // Add adds what is displayed (FR-C7): no acknowledgement.
    await change([{ ...FULL, price: '50000' }, SATE, TEA]);
    expect(notice().textContent).toBe(CHANGED);
    press(add());
    const line = lines().find((l) => l.getAttribute('data-line-id')?.startsWith('nasi-'))!;
    expect(line.querySelector('.order-line__amount')!.textContent).toBe('45.000');
  });

  it('a changed name and a changed option delta update the sheet; the notice is one, whatever changed', async () => {
    await chosen();
    const renamed: ServedItem = {
      ...FULL,
      name: 'Nasi Goreng Spesial',
      modifiers: [{ id: 'egg', name: 'Fried egg', delta: '7000' }, EXTRAS[1]!],
    };
    await change([renamed, SATE, TEA]);
    expect(q('#sheet-title')!.textContent).toBe('Nasi Goreng Spesial');
    expect(option('egg').textContent).toBe('Fried egg +7.000');
    expect(unit()).toBe('42.000');
    expect(notice().textContent).toBe(CHANGED);
    expect(all('#served-sheet-notice')).toHaveLength(1);
  });

  it('a chosen modifier that is removed leaves the choices and the total, and the notice names it; Add stays on', async () => {
    await chosen();
    await change([{ ...FULL, modifiers: [EXTRAS[1]!] }, SATE, TEA]);
    expect(q('.sheet [data-option="egg"]')).toBeNull();
    expect(unit()).toBe('35.000');
    expect(notice().textContent).toBe('This item changed while you were choosing. Fried egg was removed and deselected.');
    expect(off(add())).toBe(false);
    // It does not come back selected if it comes back.
    await change([FULL, SATE, TEA]);
    expect(pressed('egg')).toBe(false);
  });

  it('the chosen variant, removed, leaves no variant chosen: the notice names it and Add is off until one is chosen', async () => {
    await chosen();
    await change([{ ...FULL, variants: [SIZES[1]!] }, SATE, TEA]);
    expect(q('.sheet [data-option="small"]')).toBeNull();
    expect(notice().textContent).toBe('This item changed while you were choosing. Small was removed and deselected.');
    expect(off(add())).toBe(true);
    expect(reason().textContent).toBe('Choose a variant before adding this item.');
    press(option('large'));
    expect(off(add())).toBe(false);
  });

  it('a new option is drawn unselected in place, and a reorder keeps the choices: no notice either way', async () => {
    await chosen();
    await change([{ ...FULL, modifiers: [...EXTRAS, { id: 'shallot', name: 'Crispy shallots', delta: '3000' }] }, SATE, TEA]);
    expect(pressed('shallot')).toBe(false);
    expect(notice().textContent).toBe('');
    await change([{ ...FULL, variants: [...SIZES].reverse(), modifiers: [EXTRAS[1]!, EXTRAS[0]!, { id: 'shallot', name: 'Crispy shallots', delta: '3000' }] }, SATE, TEA]);
    expect(all('.sheet [data-option]').map((o) => o.getAttribute('data-option'))).toEqual(['large', 'small', 'chili', 'egg', 'shallot']);
    expect([pressed('small'), pressed('egg'), pressed('large')]).toEqual([true, true, false]);
    expect(notice().textContent).toBe('');
    expect(off(add())).toBe(false);
  });

  it('checks failing show nothing in the sheet and change nothing in it', async () => {
    await chosen();
    h.revision(FAILED);
    await h.advance(POLL_MS * 2);
    expect(q('.menu-status')!.textContent).toContain('may be out of date');
    expect(notice().textContent).toBe('');
    expect(sheetText()).not.toContain('may be out of date');
    expect(off(add())).toBe(false);
  });

  it('an 86 and a price change arriving together make one notice: the availability sentence, then the change', async () => {
    await chosen();
    await change([{ ...FULL, price: '50000', available: false }, SATE, TEA]);
    expect(notice().textContent).toBe(
      `Nasi Goreng is no longer available. A manager marked it 86. Your choices are kept, but it cannot be added. ${CHANGED}`
    );
    await change([{ ...FULL, price: '50000' }, SATE, TEA]);
    expect(notice().textContent).toBe(CHANGED);
  });

  const sheetText = () => q('.sheet')!.textContent ?? '';
});

describe('11. the notice and the reason sit in fixed places, so a poll moves neither Add nor the options', () => {
  it('the band is between the body and the footer, never inside the scrolling body, and always in the tree', async () => {
    await open();
    press(tile('nasi'));
    const body = q('.sheet__body')!;
    const band = q('.sheet__band')!;
    const foot = q('.sheet__foot')!;
    expect(band.previousElementSibling).toBe(body);
    expect(band.nextElementSibling).toBe(foot);
    expect(body.contains(notice())).toBe(false);
    expect(band.contains(notice())).toBe(true);
    expect(band.contains(q('#served-unit'))).toBe(true);
    expect(band.contains(q('[data-line-total]'))).toBe(true);
    expect(notice().getAttribute('role')).toBe('status');
    expect(notice().getAttribute('aria-live')).toBe('polite');
    // The reason line is the footer's, present before it has any text.
    expect(foot.contains(reason())).toBe(true);
    expect(reason().textContent).not.toBeNull();
  });

  it('a notice arriving and a reason clearing keep the very same Add and option nodes, and the body’s scrollTop', async () => {
    await open();
    press(tile('nasi'));
    const addNode = add();
    const small = option('small');
    const body = q('.sheet__body')!;
    body.scrollTop = 40;
    const top = body.scrollTop;
    press(small);
    expect(reason().textContent).toBe('');
    await change([{ ...FULL, price: '50000' }, SATE, TEA]);
    expect(notice().textContent).toBe(CHANGED);
    expect(add()).toBe(addNode);
    expect(option('small')).toBe(small);
    expect(q('.sheet__body')).toBe(body);
    expect(body.scrollTop).toBe(top);
  });
});

describe('12. a poll that turns Add off while it has focus leaves focus there', () => {
  it('keeps focus on Add, whose press then does nothing, and Escape still closes', async () => {
    await open();
    press(tile('nasi'));
    press(option('small'));
    const addNode = add();
    act(() => addNode.focus());
    expect(document.activeElement).toBe(addNode);
    await change([{ ...FULL, available: false }, SATE, TEA]);
    expect(add()).toBe(addNode);
    expect(off(addNode)).toBe(true);
    expect(addNode.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(addNode);
    press(addNode);
    expect(dialog()).not.toBeNull();
    expect(lines().some((l) => l.getAttribute('data-line-id')?.startsWith('nasi-'))).toBe(false);
    escape();
    expect(dialog()).toBeNull();
  });
});

describe('14. focus after Cancel and after Add', () => {
  it('Cancel returns focus to the tile', async () => {
    await open();
    press(rail()[1]!);
    press(tile('tea'));
    press(cancel());
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(tile('tea'));
  });

  it('Escape does as Cancel does, and Add returns focus to the tile too', async () => {
    await open();
    press(tile('sate'));
    escape();
    expect(document.activeElement).toBe(tile('sate'));
    press(tile('sate'));
    press(add());
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(tile('sate'));
  });

  it('with the tile gone it is the SELECTED category’s button, not the first', async () => {
    await open();
    press(rail()[1]!);
    press(tile('tea'));
    await change([FULL, SATE]);
    press(cancel());
    expect(q('.menu-tile[data-item="tea"]')).toBeNull();
    // The selected category fell to the first only because Drinks has no tile now; it is still on the menu.
    expect(document.activeElement).toBe(q('.menu-category[aria-pressed="true"]'));
    expect(document.activeElement!.textContent).toBe('Drinks');
  });
});

describe('D1. the ceilings turn Add and plus off, with the reason', () => {
  it('a line past 99.999.999 at quantity 2: plus is off and says why, and minus stays live', async () => {
    await open([{ ...NASI, price: '60000000' }, SATE, TEA], { state: 'empty' });
    press(tile('nasi'));
    expect(off(plus())).toBe(true);
    expect(plus().getAttribute('aria-describedby')).toBe('sheet-bound');
    expect(q('#sheet-bound')!.textContent).toBe('Cannot increase quantity. Line total cannot exceed 99.999.999.');
    expect(plus().hasAttribute('disabled')).toBe(false);
  });

  it('a choice can pass the bound at quantity 1: Add is off with the reason and the option stays selectable', async () => {
    await open(
      [{ ...NASI, price: '99999999', variants: [{ id: 'up', name: 'Up', delta: '1' }, { id: 'down', name: 'Down', delta: '-1' }] }, SATE, TEA],
      // Under a 100% discount only the line's own ceiling speaks; elsewhere the service charge speaks first.
      { state: 'zero' }
    );
    press(tile('nasi'));
    press(option('up'));
    expect(off(add())).toBe(true);
    expect(reason().textContent).toBe('Line total cannot exceed 99.999.999.');
    expect(option('up').hasAttribute('aria-disabled')).toBe(false);
    press(option('down'));
    expect(off(add())).toBe(false);
    expect(reason().textContent).toBe('');
  });

  it('the order total counts: an item that fits alone is refused beside what the order already holds', async () => {
    await open([{ ...NASI, price: '96000000' }, SATE, TEA], { state: 'quick' });
    press(tile('nasi'));
    expect(off(add())).toBe(true);
    expect(reason().textContent).toBe('Order total cannot exceed 99.999.999.');
    press(add());
    expect(dialog()).not.toBeNull();
    expect(lines().some((l) => l.getAttribute('data-line-id')?.startsWith('nasi-'))).toBe(false);
  });

  it('the line editor’s Update is off past the ceiling, with the reason, and plus is off', async () => {
    await open([{ ...NASI, price: '60000000' }, SATE, TEA], { state: 'empty' });
    press(tile('nasi'));
    press(add());
    const row = lines().find((l) => l.getAttribute('data-line-id')?.startsWith('nasi-'))!;
    press(row.querySelector('.order-line__target'));
    expect(off(plus())).toBe(true);
    expect(q('#sheet-bound')!.textContent).toBe('Cannot increase quantity. Line total cannot exceed 99.999.999.');
    press(plus());
    expect(q('.sheet-stepper__value')!.textContent).toBe('1');
  });
});

describe('15. the 86 tile still opens nothing', () => {
  it('an 86’d tile opens no sheet', async () => {
    await open([{ ...FULL, available: false }, SATE, TEA]);
    press(tile('nasi'));
    expect(dialog()).toBeNull();
  });
});

const rail = () => all('.menu-categories > .menu-category');

const tab = (from: Element, shift = false) =>
  act(() => void from.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true })));

describe('focus inside the sheet (DESIGN-021)', () => {
  it('opens on the heading, not the dialog', async () => {
    await open();
    press(tile('nasi'));
    expect(document.activeElement).toBe(q('#sheet-title'));
  });

  it('Tab on the last control wraps to the first, and Shift-Tab from the heading to the last', async () => {
    await open();
    press(tile('nasi'));
    const keys = [...host().querySelectorAll<HTMLElement>('.sheet button')];
    const first = keys[0]!;
    const last = keys[keys.length - 1]!;
    act(() => last.focus());
    tab(last);
    expect(document.activeElement).toBe(first);
    act(() => q('#sheet-title')!.focus());
    tab(q('#sheet-title')!, true);
    expect(document.activeElement).toBe(last);
  });

  it('a focused option that a poll removes sends focus to its group’s heading', async () => {
    await open();
    press(tile('nasi'));
    act(() => option('egg').focus());
    await change([{ ...FULL, modifiers: [EXTRAS[1]!] }, SATE, TEA]);
    expect(q('.sheet [data-option="egg"]')).toBeNull();
    expect(document.activeElement).toBe(q('#sheet-group-modifiers'));
  });

  it('and to the sheet’s heading when the whole group is gone', async () => {
    await open();
    press(tile('nasi'));
    act(() => option('egg').focus());
    await change([{ ...FULL, modifiers: [] }, SATE, TEA]);
    expect(document.activeElement).toBe(q('#sheet-title'));
  });

  it('a cashier who has moved on keeps the control they are on', async () => {
    await open();
    press(tile('nasi'));
    act(() => option('egg').focus());
    act(() => option('small').focus());
    await change([{ ...FULL, modifiers: [EXTRAS[1]!] }, SATE, TEA]);
    expect(document.activeElement).toBe(option('small'));
  });
});
