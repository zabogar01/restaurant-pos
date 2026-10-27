// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { refusal, mount, text } from './session-harness.js';
import { DRINKS, MAINS, MENU_ITEMS, SEASONAL, aria, catalog, harness, item as makeItem, type Opt } from './menu-support.js';
import {
  ITEM_CREATE, ITEM_UPDATE, READ, body, editFrom, hint, itemAnswer, named, newIn, notice, noticeText, openMenuWith,
  q, save, tap,
} from './item-support.js';
import { typeInto } from './tables-support.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// BO-04's Variants and Modifiers (PHASE1-S4c2b): the two lists drawn from the read, Add, Remove,
// Undo and Move, the option name and change checks, the per-variant price, the one save (a create
// carries both lists, an edit an explicit change list), the validation order, the stale comparison
// with its two lists, and Keep my changes and Use current item over child rows.

let h: ReturnType<typeof harness>;
let view: ReturnType<typeof mount> | undefined;

afterEach(() => {
  view?.unmount();
  view = undefined;
});

const changed = refusal('CATALOG_CHANGED', undefined, 409);
const CATS = [MAINS, SEASONAL, DRINKS];
const focused = () => document.activeElement;

const oid = (n: number) => `00000000-0000-4000-8000-${String(800 + n).padStart(12, '0')}`;
const variant = (n: number, name: string, priceDelta: string, displayOrder: number, isActive = true): Opt => ({
  variantId: oid(n), name, priceDelta, displayOrder, isActive,
});
const modifier = (n: number, name: string, priceDelta: string, displayOrder: number, isActive = true): Opt => ({
  modifierId: oid(n), name, priceDelta, displayOrder, isActive,
});

// Stored out of order on purpose, with an inactive variant that must never be drawn.
const REGULAR = variant(1, 'Regular', '0', 0);
const LARGE = variant(2, 'Large', '5000', 1);
const SMALL = variant(3, 'Small', '-2000', 2);
const OLD = variant(4, 'Old', '0', 3, false);
const CHEESE = modifier(11, 'Cheese', '3000', 0);
const EGG = modifier(12, 'Egg', '4000', 1);
const PIZZA = makeItem(20, MAINS.categoryId, 'Pizza', 2, {
  basePrice: '100000',
  variants: [SMALL, OLD, REGULAR, LARGE],
  modifiers: [EGG, CHEESE],
});
/** The options in this order: another manager's reorder is a change of stored display order. */
const ordered = (...options: Opt[]): Opt[] => options.map((o, displayOrder) => ({ ...o, displayOrder }));
const withPizza = (more: Partial<typeof PIZZA>) => [...MENU_ITEMS, { ...PIZZA, ...more }];
const read = (version: number, more: Partial<typeof PIZZA> = {}) => catalog(version, CATS, withPizza(more));

const open = async () => {
  h = harness();
  view = await openMenuWith(h, read(5));
  return view.host;
};
const edit = async (host: HTMLElement = view!.host) => {
  await editFrom(h, host, 'Pizza');
  return host;
};

const kinds = (host: HTMLElement, kind: 'variant' | 'modifier') =>
  [...host.querySelectorAll<HTMLElement>(`[data-kind="${kind}"][data-option]`)];
/** A text field found by its label, as a person finds it. */
const field = (host: HTMLElement, label: string): HTMLInputElement => {
  const l = [...host.querySelectorAll('label')].find((x) => x.textContent === label);
  if (!l) throw new Error(`no field labelled ${label}`);
  return host.querySelector<HTMLInputElement>(`[id="${l.htmlFor}"]`)!;
};
const type = (host: HTMLElement, label: string, value: string) => typeInto(field(host, label), value);
const rows = (host: HTMLElement, kind: 'variant' | 'modifier') =>
  kinds(host, kind).map((row) =>
    row.dataset.removed === 'true'
      ? `(${row.querySelector('strong')!.textContent})`
      : `${row.querySelector<HTMLInputElement>('input')!.value}=${row.querySelectorAll<HTMLInputElement>('input')[1]!.value}`
  );
const errorOf = (host: HTMLElement, label: string): string | null => {
  const input = field(host, label);
  return input.getAttribute('aria-invalid') === 'true' ? (host.querySelector(`[id="${input.id}-error"]`)?.textContent ?? null) : null;
};
const preview = (host: HTMLElement, n: number) => kinds(host, 'variant')[n - 1]!.querySelector('.item-option-note')?.textContent ?? null;
const press = async (host: HTMLElement, name: string) => {
  tap(named(host, name));
  await h.settle();
};
const send = async (host: HTMLElement, answer = itemAnswer(6, PIZZA)) => {
  h.reply(ITEM_UPDATE, answer);
  await press(host, 'Save');
};
const update = (n = 0) => body(h, ITEM_UPDATE, n) as { itemId: string; expectedVersion: number; changes: Record<string, any> };
const blur = (input: HTMLInputElement) =>
  act(() => {
    input.focus();
    input.blur();
  });

describe('AC 1. the two lists draw from the read', () => {
  it('shows the active variants and modifiers in stored order, and no inactive option', async () => {
    const host = await edit(await open());
    expect(rows(host, 'variant')).toEqual(['Regular=0', 'Large=5.000', 'Small=-2.000']);
    expect(rows(host, 'modifier')).toEqual(['Cheese=3.000', 'Egg=4.000']);
    expect(host.textContent).not.toContain('Old');
    expect(field(host, 'Variant 3 name').value).toBe('Small');
    expect(field(host, 'Modifier 2 price change').value).toBe('4.000');
  });

  it('draws each section’s heading, note and help, the floor help, and the removal note', async () => {
    const host = await edit(await open());
    expect([...host.querySelectorAll('#item-form h2')].map((x) => x.textContent)).toEqual(['Item details', 'Variants', 'Modifiers']);
    const t = host.textContent!;
    for (const sentence of [
      'Single-select · one choice, with a positive or negative price change.',
      'Names: 1–32 characters. Type a minus sign for a reduction, such as -10.000.',
      'The final unit price includes selected modifiers, then floors at zero.',
      'Multi-select · any number of choices, each adding zero or more.',
      'Names: 1–32 characters. Price changes: 0–99.999.999; whole rupiah.',
      'Removed variants and modifiers stay on existing orders. After saving, they cannot be restored; adding the name again creates a new one.',
    ]) {
      expect(t).toContain(sentence);
    }
  });

  it('an empty list shows its empty body', async () => {
    const host = await open();
    await newIn(h, host, 'Mains');
    expect(host.textContent).toContain('No variants yet. Use Add variant to add the first one.');
    expect(host.textContent).toContain('No modifiers yet. Use Add modifier to add the first one.');
  });
});

describe('overflow. eighteen options of each kind at the longest and the largest', () => {
  const many = (kind: 'variant' | 'modifier') =>
    Array.from({ length: 18 }, (_, i) => {
      const tag = `${kind[0]!.toUpperCase()}${String(i).padStart(2, '0')}`;
      const name = tag + '🍔'.repeat(32 - tag.length);
      const delta = kind === 'variant' && i === 0 ? '-99999999' : '99999999';
      return kind === 'variant' ? variant(100 + i, name, delta, i) : modifier(200 + i, name, delta, i);
    });

  it('draws every row, keeps every option control reachable, and saves', async () => {
    h = harness();
    view = await openMenuWith(h, read(5, { variants: many('variant'), modifiers: many('modifier') }));
    const host = view.host;
    await edit(host);
    expect(kinds(host, 'variant')).toHaveLength(18);
    expect(kinds(host, 'modifier')).toHaveLength(18);
    expect([...field(host, 'Variant 18 name').value]).toHaveLength(32);
    expect(field(host, 'Variant 1 price change').value).toBe('-99.999.999');
    expect(field(host, 'Modifier 18 price change').value).toBe('99.999.999');
    // Every control is a real, focusable button (an end is aria-disabled, never `disabled`).
    const controls = [...host.querySelectorAll<HTMLButtonElement>('[data-option] button, #add-variant, #add-modifier, #save-item')];
    expect(controls.length).toBe(18 * 3 * 2 + 3);
    expect(controls.some((b) => b.disabled)).toBe(false);
    expect(preview(host, 1)).toBe('Without modifiers: 0 · Base price plus this change is below zero, so the price floors at 0.');
    await send(host);
    expect(update().changes).toEqual({});
  });
});

describe('AC 2. add, remove, undo, move', () => {
  it('Add appends a new row last, marked New · not saved yet, with a change of 0 and focus on its name', async () => {
    const host = await edit(await open());
    await press(host, 'Add variant');
    expect(rows(host, 'variant')).toEqual(['Regular=0', 'Large=5.000', 'Small=-2.000', '=0']);
    expect(kinds(host, 'variant')[3]!.textContent).toContain('New · not saved yet');
    expect(kinds(host, 'variant')[0]!.textContent).not.toContain('New · not saved yet');
    expect(focused()).toBe(field(host, 'Variant 4 name'));
    await press(host, 'Add modifier');
    expect(focused()).toBe(field(host, 'Modifier 3 name'));
  });

  it('Remove on a saved row marks it pending, collapses it, and focuses its Undo; numbering skips it', async () => {
    const host = await edit(await open());
    await press(host, 'Remove variant 2');
    expect(rows(host, 'variant')).toEqual(['Regular=0', '(Large)', 'Small=-2.000']);
    expect(kinds(host, 'variant')[1]!.textContent).toContain('Will be removed when you save.');
    expect(focused()).toBe(named(host, 'Undo removal of variant Large'));
    // Numbered by position among the active rows: Small is now variant 2, not variant 3.
    expect(field(host, 'Variant 2 name').value).toBe('Small');
    expect(() => field(host, 'Variant 3 name')).toThrow();
    expect(named(host, 'Move down variant 1')).toBeTruthy();
    expect(aria(named(host, 'Move down variant 2'))).toBe(true);
  });

  it('Remove on a new row deletes it and focuses that list’s Add', async () => {
    const host = await edit(await open());
    await press(host, 'Add modifier');
    await press(host, 'Remove modifier 3');
    expect(rows(host, 'modifier')).toEqual(['Cheese=3.000', 'Egg=4.000']);
    expect(focused()).toBe(named(host, 'Add modifier'));
  });

  it('Undo returns the row in place with its draft values and focuses its name', async () => {
    const host = await edit(await open());
    type(host, 'Variant 2 price change', '6.000');
    await press(host, 'Remove variant 2');
    await press(host, 'Undo removal of variant Large');
    expect(rows(host, 'variant')).toEqual(['Regular=0', 'Large=6.000', 'Small=-2.000']);
    expect(focused()).toBe(field(host, 'Variant 2 name'));
  });

  it('Move up and Move down change the order, keep focus on the pressed control, and the ends are off', async () => {
    const host = await edit(await open());
    expect(aria(named(host, 'Move up variant 1'))).toBe(true);
    expect(named(host, 'Move up variant 1').getAttribute('tabindex')).toBe('-1');
    expect(named(host, 'Move up variant 1').hasAttribute('disabled')).toBe(false);
    expect(aria(named(host, 'Move down variant 3'))).toBe(true);
    await press(host, 'Move down variant 1');
    expect(rows(host, 'variant')).toEqual(['Large=5.000', 'Regular=0', 'Small=-2.000']);
    // The same control, now variant 2's Move down.
    expect(focused()).toBe(named(host, 'Move down variant 2'));
    await press(host, 'Move down variant 2');
    expect(rows(host, 'variant')).toEqual(['Large=5.000', 'Small=-2.000', 'Regular=0']);
    // At the end, focus goes to the row's other move control.
    expect(focused()).toBe(named(host, 'Move up variant 3'));
    // A press on an inert control changes nothing.
    tap(named(host, 'Move down variant 3'));
    expect(rows(host, 'variant')).toEqual(['Large=5.000', 'Small=-2.000', 'Regular=0']);
  });

  it('a row pending removal keeps its place while its neighbours move around it', async () => {
    const host = await edit(await open());
    await press(host, 'Remove variant 2');
    await press(host, 'Move down variant 1');
    expect(rows(host, 'variant')).toEqual(['Small=-2.000', '(Large)', 'Regular=0']);
  });

  it('while a save is pending every field and control is inert and sends nothing', async () => {
    const host = await edit(await open());
    h.reply(ITEM_UPDATE, 'hang');
    type(host, 'Variant 1 name', 'Plain');
    tap(named(host, 'Save'));
    await h.settle();
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(field(host, 'Variant 1 name').disabled).toBe(true);
    for (const name of ['Add variant', 'Add modifier', 'Remove variant 1', 'Move down variant 1']) {
      expect(aria(named(host, name))).toBe(true);
      tap(named(host, name));
    }
    expect(rows(host, 'variant')).toEqual(['Plain=0', 'Large=5.000', 'Small=-2.000']);
    expect(h.count(ITEM_UPDATE)).toBe(1);
  });
});

describe('AC 3. the option name check', () => {
  it('refuses empty, long and control in order, with each kind’s copy', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 name', '   ');
    type(host, 'Modifier 1 name', 'x'.repeat(33));
    type(host, 'Modifier 2 name', 'Extra\tcheese');
    await press(host, 'Save');
    expect(h.count(ITEM_UPDATE)).toBe(0);
    expect(errorOf(host, 'Variant 1 name')).toBe('Enter a variant name.');
    expect(errorOf(host, 'Modifier 1 name')).toBe('Use 32 characters or fewer.');
    expect(errorOf(host, 'Modifier 2 name')).toBe('Remove control characters from the modifier name.');
    expect(aria(save(host))).toBe(true);
    expect(hint(host)).toBe('Correct the marked fields before saving.');
  });

  it('puts a duplicate on the later row; Large and large are the same, Café and Cafe are not', async () => {
    const host = await edit(await open());
    type(host, 'Variant 3 name', 'large');
    type(host, 'Modifier 1 name', 'Café');
    type(host, 'Modifier 2 name', 'Cafe');
    await press(host, 'Save');
    expect(errorOf(host, 'Variant 2 name')).toBeNull();
    expect(errorOf(host, 'Variant 3 name')).toBe('Another variant uses this name. Choose another name.');
    expect(errorOf(host, 'Modifier 2 name')).toBeNull();
    expect(h.count(ITEM_UPDATE)).toBe(0);
  });

  it('a variant and a modifier may share a name', async () => {
    const host = await edit(await open());
    type(host, 'Modifier 1 name', 'Large');
    await send(host);
    expect(h.count(ITEM_UPDATE)).toBe(1);
  });

  it('a row pending removal frees its name for another row in the same save', async () => {
    const host = await edit(await open());
    await press(host, 'Remove variant 2');
    type(host, 'Variant 2 name', 'Large');
    await send(host);
    expect(update().changes.variants).toEqual({
      edited: [{ id: SMALL.variantId, name: 'Large' }],
      removed: [LARGE.variantId],
      order: [{ id: REGULAR.variantId }, { id: SMALL.variantId }],
    });
  });

  describe('a duplicate refusal belongs to its list (F4)', () => {
    const duplicated = async () => {
      const host = await edit(await open());
      type(host, 'Variant 3 name', 'Large');
      await press(host, 'Save');
      expect(errorOf(host, 'Variant 3 name')).toBe('Another variant uses this name. Choose another name.');
      expect(aria(save(host))).toBe(true);
      return host;
    };

    it('renaming the holder clears it', async () => {
      const host = await duplicated();
      type(host, 'Variant 2 name', 'Grande');
      expect(errorOf(host, 'Variant 3 name')).toBeNull();
      expect(aria(save(host))).toBe(false);
    });

    it('removing the holder clears it, and Save sends once', async () => {
      const host = await duplicated();
      await press(host, 'Remove variant 2');
      expect(errorOf(host, 'Variant 2 name')).toBeNull();
      await send(host);
      expect(h.count(ITEM_UPDATE)).toBe(1);
    });

    it('Undo of a removed holder adds no refusal before Save', async () => {
      const host = await edit(await open());
      await press(host, 'Remove variant 2');
      type(host, 'Variant 2 name', 'Large');
      await press(host, 'Undo removal of variant Large');
      expect(errorOf(host, 'Variant 2 name')).toBeNull();
      expect(errorOf(host, 'Variant 3 name')).toBeNull();
      expect(aria(save(host))).toBe(false);
    });

    it('an edit that creates a duplicate adds no refusal before Save', async () => {
      const host = await edit(await open());
      type(host, 'Variant 3 name', 'Large');
      expect(errorOf(host, 'Variant 3 name')).toBeNull();
      expect(aria(save(host))).toBe(false);
    });

    it('the refusal is the list’s only: the other list’s rows are untouched', async () => {
      const host = await duplicated();
      type(host, 'Modifier 1 name', 'Egg');
      expect(errorOf(host, 'Variant 3 name')).toBe('Another variant uses this name. Choose another name.');
    });
  });
});

describe('AC 4. the change fields', () => {
  it('refuse each way for both kinds, with the table’s copy, on the row’s field', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 price change', '');
    type(host, 'Variant 2 price change', '10,5');
    type(host, 'Variant 3 price change', '100.000.000');
    type(host, 'Modifier 1 price change', '-1');
    type(host, 'Modifier 2 price change', '1000.5');
    await press(host, 'Save');
    expect(errorOf(host, 'Variant 1 price change')).toBe('Enter a price change.');
    expect(errorOf(host, 'Variant 2 price change')).toBe('Enter whole rupiah, such as 10.000 or -10.000.');
    expect(errorOf(host, 'Variant 3 price change')).toBe('Use a price change from -99.999.999 to 99.999.999.');
    expect(errorOf(host, 'Modifier 1 price change')).toBe('Use 0 or more.');
    expect(errorOf(host, 'Modifier 2 price change')).toBe('Enter whole rupiah, such as 10.000.');
    expect(h.count(ITEM_UPDATE)).toBe(0);
  });

  it('refuses an empty and an out-of-bounds modifier change, and editing a field clears its own refusal', async () => {
    const host = await edit(await open());
    type(host, 'Modifier 1 price change', '');
    type(host, 'Modifier 2 price change', '100.000.000');
    await press(host, 'Save');
    expect(errorOf(host, 'Modifier 1 price change')).toBe('Enter a price change.');
    expect(errorOf(host, 'Modifier 2 price change')).toBe('Use 99.999.999 or less.');
    type(host, 'Modifier 1 price change', '1.000');
    expect(errorOf(host, 'Modifier 1 price change')).toBeNull();
    expect(errorOf(host, 'Modifier 2 price change')).toBe('Use 99.999.999 or less.');
  });

  it('a variant takes -10.000 and sends "-10000"; the field is regrouped on blur and as typed while typing', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 price change', '-10000');
    expect(field(host, 'Variant 1 price change').value).toBe('-10000');
    blur(field(host, 'Variant 1 price change'));
    expect(field(host, 'Variant 1 price change').value).toBe('-10.000');
    type(host, 'Variant 2 price change', '+7.500');
    await send(host);
    expect(update().changes.variants.edited).toEqual([
      { id: REGULAR.variantId, priceDelta: '-10000' },
      { id: LARGE.variantId, priceDelta: '7500' },
    ]);
  });

  it('a refused value stays exactly as typed on blur', async () => {
    const host = await edit(await open());
    type(host, 'Modifier 1 price change', '1000.5');
    blur(field(host, 'Modifier 1 price change'));
    expect(field(host, 'Modifier 1 price change').value).toBe('1000.5');
  });
});

describe('AC 5. the per-variant price without modifiers', () => {
  it('shows base plus change under each variant, as BigInt on the canonical strings', async () => {
    const host = await edit(await open());
    expect(preview(host, 1)).toBe('Without modifiers: 100.000');
    expect(preview(host, 2)).toBe('Without modifiers: 105.000');
    expect(preview(host, 3)).toBe('Without modifiers: 98.000');
    expect(kinds(host, 'modifier')[0]!.querySelector('.item-option-note')).toBeNull();
  });

  it('floors at 0 with the floor sentence', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 price change', '-99.999.999');
    expect(preview(host, 1)).toBe('Without modifiers: 0 · Base price plus this change is below zero, so the price floors at 0.');
  });

  it('notes a price above the largest line total, and still saves it', async () => {
    const host = await edit(await open());
    typeInto(q<HTMLInputElement>(host, '#item-price')!, '99.999.999');
    type(host, 'Variant 1 price change', '+1');
    expect(preview(host, 1)).toBe('Without modifiers: 100.000.000 · More than the largest line total, 99.999.999.');
    await send(host);
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(update().changes.variants.edited).toEqual([{ id: REGULAR.variantId, priceDelta: '1' }]);
  });

  it('says it cannot be computed when either value is not accepted', async () => {
    const host = await edit(await open());
    type(host, 'Variant 2 price change', 'abc');
    expect(preview(host, 2)).toBe('Enter a valid base price and price change to see this variant’s price.');
    type(host, 'Variant 2 price change', '5.000');
    typeInto(q<HTMLInputElement>(host, '#item-price')!, '');
    expect(preview(host, 1)).toBe('Enter a valid base price and price change to see this variant’s price.');
  });
});

describe('AC 6. the create body', () => {
  it('sends exactly one create with both lists in the order they stand, trimmed and canonical', async () => {
    h = harness();
    view = await openMenuWith(h, read(5));
    const host = view.host;
    await newIn(h, host, 'Mains');
    typeInto(q<HTMLInputElement>(host, '#item-name')!, 'Burger Deluxe');
    typeInto(q<HTMLInputElement>(host, '#item-price')!, '40.000');
    await press(host, 'Add variant');
    type(host, 'Variant 1 name', '  Large ');
    type(host, 'Variant 1 price change', '5.000');
    await press(host, 'Add variant');
    type(host, 'Variant 2 name', 'Small');
    type(host, 'Variant 2 price change', '-2.000');
    await press(host, 'Move up variant 2');
    await press(host, 'Add modifier');
    type(host, 'Modifier 1 name', ' Cheese');
    type(host, 'Modifier 1 price change', '3.000');
    h.reply(ITEM_CREATE, itemAnswer(6, makeItem(30, MAINS.categoryId, 'Burger Deluxe', 3)));
    await press(host, 'Save');
    expect(h.count(ITEM_CREATE)).toBe(1);
    expect(body(h, ITEM_CREATE)).toEqual({
      categoryId: MAINS.categoryId,
      name: 'Burger Deluxe',
      basePrice: '40000',
      variants: [
        { name: 'Small', priceDelta: '-2000' },
        { name: 'Large', priceDelta: '5000' },
      ],
      modifiers: [{ name: 'Cheese', priceDelta: '3000' }],
    });
  });

  it('a new item with no options still sends two empty lists', async () => {
    h = harness();
    view = await openMenuWith(h, read(5));
    await newIn(h, view.host, 'Mains');
    typeInto(q<HTMLInputElement>(view.host, '#item-name')!, 'Tea');
    typeInto(q<HTMLInputElement>(view.host, '#item-price')!, '5.000');
    h.reply(ITEM_CREATE, itemAnswer(6, makeItem(31, MAINS.categoryId, 'Tea', 3)));
    await press(view.host, 'Save');
    expect(body(h, ITEM_CREATE)).toMatchObject({ variants: [], modifiers: [] });
  });
});

describe('AC 7. the edit body', () => {
  it('one name edit sends edited with the name only, and no order', async () => {
    const host = await edit(await open());
    type(host, 'Variant 2 name', '  Grande ');
    await send(host);
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(update().changes).toEqual({ variants: { edited: [{ id: LARGE.variantId, name: 'Grande' }] } });
    expect(update().expectedVersion).toBe(5);
  });

  it('one removal sends removed and order', async () => {
    const host = await edit(await open());
    await press(host, 'Remove modifier 1');
    await send(host);
    expect(update().changes).toEqual({ modifiers: { removed: [CHEESE.modifierId], order: [{ id: EGG.modifierId }] } });
  });

  it('one add sends added and order', async () => {
    const host = await edit(await open());
    await press(host, 'Add modifier');
    type(host, 'Modifier 3 name', 'Bacon');
    type(host, 'Modifier 3 price change', '6.000');
    await send(host);
    const { modifiers } = update().changes;
    expect(modifiers.added).toEqual([{ key: expect.stringMatching(/^new-/), name: 'Bacon', priceDelta: '6000' }]);
    expect(modifiers.order).toEqual([{ id: CHEESE.modifierId }, { id: EGG.modifierId }, { key: modifiers.added[0].key }]);
    expect(modifiers.edited).toBeUndefined();
  });

  it('a move sends order only', async () => {
    const host = await edit(await open());
    await press(host, 'Move up variant 3');
    await send(host);
    expect(update().changes).toEqual({
      variants: { order: [{ id: REGULAR.variantId }, { id: SMALL.variantId }, { id: LARGE.variantId }] },
    });
  });

  it('a move down and back up sends no list key at all, only a clean save', async () => {
    const host = await edit(await open());
    await press(host, 'Move down variant 1');
    await press(host, 'Move up variant 2');
    await send(host);
    expect(update().changes).toEqual({});
  });

  it('changes to both lists give both keys, beside the item’s fields', async () => {
    const host = await edit(await open());
    typeInto(q<HTMLInputElement>(host, '#item-name')!, 'Pizza 2');
    type(host, 'Variant 1 name', 'Plain');
    type(host, 'Modifier 2 price change', '4.500');
    await send(host);
    expect(update().changes).toEqual({
      fields: { name: 'Pizza 2' },
      variants: { edited: [{ id: REGULAR.variantId, name: 'Plain' }] },
      modifiers: { edited: [{ id: EGG.modifierId, priceDelta: '4500' }] },
    });
  });

  it('a clean Save still sends, as changes: {}', async () => {
    const host = await edit(await open());
    await send(host);
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(update().changes).toEqual({});
  });

  it('swapping the names of two variants is one update with two edits', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 name', 'Large');
    type(host, 'Variant 2 name', 'Regular');
    await send(host);
    expect(h.count(ITEM_UPDATE)).toBe(1);
    expect(update().changes.variants.edited).toEqual([
      { id: REGULAR.variantId, name: 'Large' },
      { id: LARGE.variantId, name: 'Regular' },
    ]);
  });
});

describe('AC 8. validation order, and Save held', () => {
  it('invalid rows in both lists: focus goes to the first in reading order, and nothing is sent', async () => {
    const host = await edit(await open());
    type(host, 'Modifier 1 name', '');
    type(host, 'Variant 3 name', '');
    type(host, 'Variant 2 price change', 'abc');
    await press(host, 'Save');
    expect(focused()).toBe(field(host, 'Variant 2 price change'));
    expect(h.count(ITEM_UPDATE)).toBe(0);
    // Every refusal shows at once; only focus is the first's.
    expect(errorOf(host, 'Variant 3 name')).toBe('Enter a variant name.');
    expect(errorOf(host, 'Modifier 1 name')).toBe('Enter a modifier name.');
  });

  it('variants come before modifiers: a refused modifier row does not draw focus from a later variant row', async () => {
    const host = await edit(await open());
    type(host, 'Modifier 1 name', '');
    type(host, 'Variant 3 name', '');
    await press(host, 'Save');
    expect(focused()).toBe(field(host, 'Variant 3 name'));
  });

  it('the item’s fields come before the lists', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 name', '');
    typeInto(q<HTMLInputElement>(host, '#item-price')!, '');
    await press(host, 'Save');
    expect(focused()).toBe(q(host, '#item-price'));
  });

  it('a row’s name comes before its change', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 price change', '');
    type(host, 'Variant 1 name', '');
    await press(host, 'Save');
    expect(focused()).toBe(field(host, 'Variant 1 name'));
  });

  it('Save is held while any option error shows, and a second press sends nothing', async () => {
    const host = await edit(await open());
    type(host, 'Modifier 2 name', '');
    await press(host, 'Save');
    expect(aria(save(host))).toBe(true);
    await press(host, 'Save');
    expect(h.count(ITEM_UPDATE)).toBe(0);
  });
});

/** A save refused as CATALOG_CHANGED, with the current item the reread shows. */
async function stale(host: HTMLElement, current: Partial<typeof PIZZA>, version = 7) {
  h.reply(ITEM_UPDATE, changed);
  h.reply(READ, read(version, current));
  await press(host, 'Save');
  expect(notice(host)!.getAttribute('role')).toBe('alert');
}

describe('AC 9. the comparison and the sentence for a changed row removed meanwhile', () => {
  it('lists the current item’s options in current order, and each of the draft’s that is gone', async () => {
    const host = await edit(await open());
    type(host, 'Variant 2 name', 'Grande');
    const JUMBO = variant(5, 'Jumbo', '9000', 3);
    await stale(host, { variants: [JUMBO, REGULAR, SMALL, OLD], modifiers: [CHEESE] });
    const values = text(q(host, '#current-values'));
    expect(values).toContain('Variants · current orderRegular · 0Small · -2.000Jumbo · 9.000');
    expect(values).toContain('Large · Removed from the current item.');
    expect(values).toContain('Modifiers · current orderCheese · 3.000');
    expect(values).not.toContain('Old');
  });

  it('says No variants. and No modifiers. when the current item has none', async () => {
    const host = await edit(await open());
    await stale(host, { variants: [], modifiers: [] });
    const values = text(q(host, '#current-values'));
    expect(values).toContain('Variants · current orderNo variants.');
    expect(values).toContain('Modifiers · current orderNo modifiers.');
  });

  it('adds the sentence for a changed row removed meanwhile, singular with "named"', async () => {
    const host = await edit(await open());
    type(host, 'Variant 2 name', 'Grande');
    await stale(host, { variants: [REGULAR, SMALL] });
    expect(noticeText(host)).toContain(
      'Your draft is kept. The current item no longer has variant Large, which your draft changes. Keep my changes adds it back as a new variant named Grande; Use current item leaves it out. Choose which to keep.'
    );
  });

  it('omits "named" when the name is unchanged, and takes the plural form for several rows', async () => {
    const host = await edit(await open());
    type(host, 'Variant 2 price change', '6.000');
    await stale(host, { variants: [REGULAR, SMALL] });
    expect(noticeText(host)).toContain('adds it back as a new variant; Use current item leaves it out.');
    await press(host, 'Use current item');
    type(host, 'Variant 2 price change', '1.000');
    type(host, 'Modifier 2 price change', '4.500');
    h.reply(ITEM_UPDATE, changed);
    h.reply(READ, read(9, { variants: [REGULAR], modifiers: [CHEESE] }));
    await press(host, 'Save');
    expect(noticeText(host)).toContain(
      'The current item no longer has variant Small and modifier Egg, which your draft changes. Keep my changes adds them back as new variants and modifiers; Use current item leaves them out.'
    );
  });

  it('F1: says nothing for an untouched row removed meanwhile', async () => {
    const host = await edit(await open());
    await press(host, 'Remove variant 1');
    await stale(host, { variants: [REGULAR, LARGE] });
    expect(noticeText(host)).not.toContain('no longer has');
    expect(noticeText(host)).toBe(
      'The menu changed while you were editingNothing was saved. The menu has been read again at version 7. Your draft is kept. Choose which to keep.'
    );
  });
});

describe('AC 10. Keep my changes over child rows', () => {
  it('F1: remove variant 1 while variant 3 is removed meanwhile', async () => {
    const host = await edit(await open());
    await press(host, 'Remove variant 1');
    await stale(host, { variants: [REGULAR, LARGE] });
    const sent = h.count(ITEM_UPDATE);
    await press(host, 'Keep my changes');
    expect(h.count(ITEM_UPDATE)).toBe(sent);
    expect(rows(host, 'variant')).toEqual(['(Regular)', 'Large=5.000']);
    expect(noticeText(host)).toContain('Your changes are kept');
    await send(host);
    expect(update(1).expectedVersion).toBe(7);
    expect(update(1).changes).toEqual({ variants: { removed: [REGULAR.variantId], order: [{ id: LARGE.variantId }] } });
  });

  it('F2: the draft adds Kids while another manager reorders; the current order stands, Kids last', async () => {
    const host = await edit(await open());
    await press(host, 'Add variant');
    type(host, 'Variant 4 name', 'Kids');
    await stale(host, { variants: ordered(SMALL, REGULAR, LARGE) });
    await press(host, 'Keep my changes');
    expect(rows(host, 'variant')).toEqual(['Small=-2.000', 'Regular=0', 'Large=5.000', 'Kids=0']);
    await send(host);
    const { variants } = update(1).changes;
    expect(variants.added).toEqual([{ key: expect.stringMatching(/^new-/), name: 'Kids', priceDelta: '0' }]);
    expect(variants.order).toEqual([
      { id: SMALL.variantId }, { id: REGULAR.variantId }, { id: LARGE.variantId }, { key: variants.added[0].key },
    ]);
  });

  it('F2: a draft that moved a row keeps its order; the current item’s new row goes last', async () => {
    const host = await edit(await open());
    await press(host, 'Move down variant 1');
    const JUMBO = variant(5, 'Jumbo', '9000', 3);
    await stale(host, { variants: [REGULAR, LARGE, SMALL, JUMBO] });
    await press(host, 'Keep my changes');
    expect(rows(host, 'variant')).toEqual(['Large=5.000', 'Regular=0', 'Small=-2.000', 'Jumbo=9.000']);
    await send(host);
    expect(update(1).changes).toEqual({
      variants: {
        order: [{ id: LARGE.variantId }, { id: REGULAR.variantId }, { id: SMALL.variantId }, { id: JUMBO.variantId }],
      },
    });
  });

  it('F3: the draft changes Large’s price while it is renamed Grande; the row reads Large with the draft’s price', async () => {
    const host = await edit(await open());
    type(host, 'Variant 2 price change', '25.000');
    await stale(host, { variants: [REGULAR, { ...LARGE, name: 'Grande' }, SMALL] });
    await press(host, 'Keep my changes');
    expect(rows(host, 'variant')).toEqual(['Regular=0', 'Large=25.000', 'Small=-2.000']);
    await send(host);
    expect(update(1).changes).toEqual({
      variants: { edited: [{ id: LARGE.variantId, name: 'Large', priceDelta: '25000' }] },
    });
  });

  it('F3: an untouched row follows the current item', async () => {
    const host = await edit(await open());
    type(host, 'Variant 2 price change', '25.000');
    await stale(host, { variants: [{ ...REGULAR, name: 'Plain' }, LARGE, SMALL] });
    await press(host, 'Keep my changes');
    expect(rows(host, 'variant')).toEqual(['Plain=0', 'Large=25.000', 'Small=-2.000']);
  });

  it('4(b): a changed row removed meanwhile comes back as added with a new key', async () => {
    const host = await edit(await open());
    type(host, 'Variant 2 name', 'Grande');
    await stale(host, { variants: [REGULAR, SMALL] });
    await press(host, 'Keep my changes');
    expect(rows(host, 'variant')).toEqual(['Regular=0', 'Small=-2.000', 'Grande=5.000']);
    expect(kinds(host, 'variant')[2]!.textContent).toContain('New · not saved yet');
    await send(host);
    const { variants } = update(1).changes;
    expect(variants.added).toEqual([{ key: expect.stringMatching(/^new-/), name: 'Grande', priceDelta: '5000' }]);
    expect(variants.edited).toBeUndefined();
    expect(variants.removed).toBeUndefined();
    expect(variants.order).toEqual([{ id: REGULAR.variantId }, { id: SMALL.variantId }, { key: variants.added[0].key }]);
  });

  it('stale-duplicate: a kept name now held by a current row is refused, with focus there', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 name', 'House size');
    const HOUSE = variant(6, 'House size', '0', 3);
    await stale(host, { variants: [LARGE, SMALL, HOUSE] });
    await press(host, 'Keep my changes');
    expect(rows(host, 'variant')).toEqual(['Large=5.000', 'Small=-2.000', 'House size=0', 'House size=0']);
    expect(errorOf(host, 'Variant 4 name')).toBe('Another variant uses this name. Choose another name.');
    expect(focused()).toBe(field(host, 'Variant 4 name'));
    expect(noticeText(host)).toContain('Correct the marked fields, then press Save.');
    expect(aria(save(host))).toBe(true);
    // Removing the current item’s holder clears the refusal (F4), and Save sends once.
    await press(host, 'Remove variant 3');
    expect(errorOf(host, 'Variant 3 name')).toBeNull();
    const before = h.count(ITEM_UPDATE);
    await send(host);
    expect(h.count(ITEM_UPDATE)).toBe(before + 1);
  });

  it('Keep sends nothing, and the next Save carries the version the Keep chose', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 name', 'Plain');
    await stale(host, { variants: [REGULAR, LARGE, SMALL] }, 9);
    const sent = h.count(ITEM_UPDATE);
    await press(host, 'Keep my changes');
    expect(h.count(ITEM_UPDATE)).toBe(sent);
    await send(host);
    expect(update(1).expectedVersion).toBe(9);
  });
});

describe('AC 11. Use current item', () => {
  it('replaces both lists and leaves the form clean; nothing is sent', async () => {
    const host = await edit(await open());
    type(host, 'Variant 1 name', 'Plain');
    await press(host, 'Add modifier');
    type(host, 'Modifier 3 name', 'Bacon');
    await press(host, 'Remove variant 2');
    const JUMBO = variant(5, 'Jumbo', '9000', 3);
    await stale(host, { variants: [REGULAR, SMALL, JUMBO], modifiers: [CHEESE] });
    const sent = h.count(ITEM_UPDATE);
    await press(host, 'Use current item');
    expect(h.count(ITEM_UPDATE)).toBe(sent);
    expect(rows(host, 'variant')).toEqual(['Regular=0', 'Small=-2.000', 'Jumbo=9.000']);
    expect(rows(host, 'modifier')).toEqual(['Cheese=3.000']);
    expect(noticeText(host)).toContain('Current item loaded');
    // Clean against the current item: leaving asks nothing.
    await press(host, 'Cancel');
    expect(window.location.pathname).toBe('/back-office/menu');
  });
});

describe('AC 12. dirty compares values only', () => {
  it('a row moved down and back up is clean, so leaving does not ask', async () => {
    const host = await edit(await open());
    await press(host, 'Move down variant 1');
    await press(host, 'Move up variant 2');
    expect(rows(host, 'variant')).toEqual(['Regular=0', 'Large=5.000', 'Small=-2.000']);
    await press(host, 'Cancel');
    expect(window.location.pathname).toBe('/back-office/menu');
    expect(host.querySelector('dialog[open]')).toBeNull();
  });

  it('a move is dirty, and a removal then Undo is clean', async () => {
    const host = await edit(await open());
    await press(host, 'Remove variant 2');
    await press(host, 'Undo removal of variant Large');
    await press(host, 'Move down variant 1');
    await press(host, 'Cancel');
    expect(window.location.pathname).toBe('/back-office/menu/item');
    expect(host.querySelector('dialog[open]')).not.toBeNull();
  });

  it('a row moved down and back up is still touched for Keep: the draft’s order stands', async () => {
    const host = await edit(await open());
    await press(host, 'Move down variant 1');
    await press(host, 'Move up variant 2');
    type(host, 'Modifier 1 name', 'Cheddar');
    const JUMBO = variant(5, 'Jumbo', '9000', 3);
    await stale(host, { variants: ordered(LARGE, REGULAR, SMALL, JUMBO) });
    await press(host, 'Keep my changes');
    // Moved is set, so the draft’s order (Regular first) wins over the current order (Large first).
    expect(rows(host, 'variant')).toEqual(['Regular=0', 'Large=5.000', 'Small=-2.000', 'Jumbo=9.000']);
  });
});
