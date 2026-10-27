import { CreateItemRequest, UpdateItemRequest } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { fieldsInError } from '../src/forms/fieldsInError.js';
import { createLists, editChanges, listChanges } from '../src/item/changes.js';
import { plainRows, rowsOf, touched, type Row } from '../src/item/options.js';
import { previewOf } from '../src/item/preview.js';

// What one BO-04 save carries (PHASE1-S4c2b ruling 7; DESIGN-020, "What one save carries"): a
// create sends both lists in order; an edit sends an explicit change list, a key per list only
// when that list changed, and never an empty array. Every body passes the contract's schema.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const saved = (n: number, name: string, change = '0'): Row => ({
  id: id(n), key: id(n), name, change, removed: false, moved: false,
});
const fresh = (key: string, name: string, change = '0'): Row => ({
  id: null, key, name, change, removed: false, moved: false,
});

const A = saved(1, 'Regular');
const B = saved(2, 'Large', '5000');
const C = saved(3, 'Jumbo', '9000');
const original = [A, B, C];

const ITEM = id(100);
const CATEGORY = id(101);
const accepted = (changes: object) =>
  fieldsInError(UpdateItemRequest, { itemId: ITEM, expectedVersion: 3, changes });

describe('a create carries the active rows in order, trimmed and canonical', () => {
  it('two variants (one negative) and one modifier', () => {
    const lists = createLists({
      variants: [fresh('new-1', '  Large  ', '5.000'), fresh('new-2', 'Small', '-2.000')],
      modifiers: [fresh('new-3', 'Cheese', '3.000')],
    });
    expect(lists).toEqual({
      variants: [
        { name: 'Large', priceDelta: '5000' },
        { name: 'Small', priceDelta: '-2000' },
      ],
      modifiers: [{ name: 'Cheese', priceDelta: '3000' }],
    });
    expect(
      fieldsInError(CreateItemRequest, { categoryId: CATEGORY, name: 'Burger', basePrice: '40000', ...lists })
    ).toEqual([]);
  });

  it('rows in the order they stand, not the order they were made', () => {
    const lists = createLists({ variants: [fresh('new-2', 'Second'), fresh('new-1', 'First')], modifiers: [] });
    expect(lists.variants.map((v) => v.name)).toEqual(['Second', 'First']);
    expect(lists.modifiers).toEqual([]);
  });
});

describe('an edit sends a key per list only when that list changed', () => {
  it('a clean list has no change at all', () => {
    expect(listChanges(original, original.map((r) => ({ ...r })), 'variant')).toBeNull();
  });

  it('one name edit is `edited` with the name only, and no order', () => {
    const draft = [A, { ...B, name: '  Grande ' }, C];
    const changes = listChanges(original, draft, 'variant');
    expect(changes).toEqual({ edited: [{ id: B.id, name: 'Grande' }] });
    expect(accepted({ variants: changes })).toEqual([]);
  });

  it('one change edit is `edited` with the canonical change only', () => {
    const changes = listChanges(original, [A, { ...B, change: '-1.500' }, C], 'variant');
    expect(changes).toEqual({ edited: [{ id: B.id, priceDelta: '-1500' }] });
  });

  it('a name and a change on one row, and an edit on a second row', () => {
    const changes = listChanges(original, [{ ...A, name: 'Small', change: '-2.000' }, B, { ...C, change: '9.500' }], 'variant');
    expect(changes).toEqual({
      edited: [{ id: A.id, name: 'Small', priceDelta: '-2000' }, { id: C.id, priceDelta: '9500' }],
    });
  });

  it('a value typed differently but equal is no edit', () => {
    expect(listChanges(original, [A, { ...B, change: '5.000' }, { ...C, change: '09000' }], 'variant')).toBeNull();
  });

  it('one removal is `removed` and the order of what is left', () => {
    const changes = listChanges(original, [A, { ...B, removed: true }, C], 'variant');
    expect(changes).toEqual({ removed: [B.id], order: [{ id: A.id }, { id: C.id }] });
    expect(accepted({ modifiers: changes })).toEqual([]);
  });

  it('removing every row sends `removed` and no empty order', () => {
    const changes = listChanges(original, original.map((r) => ({ ...r, removed: true })), 'variant');
    expect(changes).toEqual({ removed: [A.id, B.id, C.id] });
  });

  it('one add is `added` and the order with the key', () => {
    const changes = listChanges(original, [...original, fresh('new-1', 'Kids', '1.000')], 'variant');
    expect(changes).toEqual({
      added: [{ key: 'new-1', name: 'Kids', priceDelta: '1000' }],
      order: [{ id: A.id }, { id: B.id }, { id: C.id }, { key: 'new-1' }],
    });
    expect(accepted({ variants: changes })).toEqual([]);
  });

  it('a move is the order only', () => {
    const changes = listChanges(original, [B, A, C], 'variant');
    expect(changes).toEqual({ order: [{ id: B.id }, { id: A.id }, { id: C.id }] });
  });

  it('a move down and back up is no list key at all', () => {
    const there = [B, A, C];
    const back = [A, B, C].map((r) => ({ ...r, moved: r === B }));
    expect(listChanges(original, there, 'variant')).not.toBeNull();
    expect(listChanges(original, back, 'variant')).toBeNull();
  });

  it('a row pending removal keeps its place but is left out of the order', () => {
    const changes = listChanges(original, [A, { ...B, removed: true }, C], 'variant');
    expect(changes?.order).toEqual([{ id: A.id }, { id: C.id }]);
  });

  it('an add, an edit and a removal together', () => {
    const changes = listChanges(
      original,
      [{ ...A, name: 'Small' }, { ...B, removed: true }, C, fresh('new-4', 'Egg', '4.000')],
      'modifier'
    );
    expect(changes).toEqual({
      added: [{ key: 'new-4', name: 'Egg', priceDelta: '4000' }],
      edited: [{ id: A.id, name: 'Small' }],
      removed: [B.id],
      order: [{ id: A.id }, { id: C.id }, { key: 'new-4' }],
    });
  });
});

describe('the whole change list', () => {
  const none = { variants: original, modifiers: [] as Row[] };
  const same = { variants: original.map((r) => ({ ...r })), modifiers: [] as Row[] };

  it('a clean save is `changes: {}`', () => {
    expect(editChanges({}, none, same)).toEqual({});
    expect(accepted(editChanges({}, none, same))).toEqual([]);
  });

  it('carries the item’s fields beside the lists, each key only when it changed', () => {
    const changes = editChanges(
      { name: 'Burger 2' },
      none,
      { variants: [B, A, C], modifiers: [fresh('new-9', 'Egg')] }
    );
    expect(Object.keys(changes)).toEqual(['fields', 'variants', 'modifiers']);
    expect(accepted(changes)).toEqual([]);
  });

  it('changes to both lists give both keys, and to one list give one key', () => {
    const both = editChanges({}, { variants: original, modifiers: [A] }, { variants: [B, A, C], modifiers: [{ ...A, name: 'X' }] });
    expect(Object.keys(both)).toEqual(['variants', 'modifiers']);
    const one = editChanges({}, { variants: original, modifiers: [A] }, { variants: [B, A, C], modifiers: [A] });
    expect(Object.keys(one)).toEqual(['variants']);
  });
});

describe('touched: a row is touched only by the manager’s own act', () => {
  it('new, pending removal, edited by name or by change, or moved', () => {
    expect(touched(fresh('new-1', 'Kids'), original, 'variant')).toBe(true);
    expect(touched({ ...A, removed: true }, original, 'variant')).toBe(true);
    expect(touched({ ...A, name: 'Small' }, original, 'variant')).toBe(true);
    expect(touched({ ...B, change: '6.000' }, original, 'variant')).toBe(true);
    expect(touched({ ...C, moved: true }, original, 'variant')).toBe(true);
  });

  it('an untouched row stays untouched however its position shifted, and equal values are no edit', () => {
    expect(touched(C, [A, C], 'variant')).toBe(false);
    expect(touched({ ...B, change: '5.000', name: ' Large ' }, original, 'variant')).toBe(false);
  });
});

describe('plainRows compares values, not flags', () => {
  it('a moved flag and an undone removal are no difference', () => {
    expect(plainRows([{ ...A, moved: true }, B], 'variant')).toEqual(plainRows([A, B], 'variant'));
    expect(plainRows([{ ...A, removed: true }, B], 'variant')).not.toEqual(plainRows([A, B], 'variant'));
  });
});

describe('rowsOf draws the active options in stored order and no others', () => {
  const view = (rows: Array<[number, string, string, number, boolean]>) => ({
    itemId: ITEM,
    categoryId: CATEGORY,
    name: 'Burger',
    basePrice: '40000',
    displayOrder: 0,
    isAvailable: true,
    isActive: true,
    variants: rows.map(([n, name, priceDelta, displayOrder, isActive]) => ({ variantId: id(n), name, priceDelta, displayOrder, isActive })),
    modifiers: [],
  });

  it('sorts by display order and leaves an inactive option out', () => {
    const rows = rowsOf(view([[2, 'Large', '5000', 1, true], [1, 'Regular', '0', 0, true], [3, 'Old', '0', 2, false]]), 'variant', false);
    expect(rows.map((r) => [r.name, r.change])).toEqual([['Regular', '0'], ['Large', '5000']]);
    expect(rows.every((r) => !r.removed && !r.moved && r.id === r.key)).toBe(true);
  });

  it('groups a change for a draft and keeps a negative one signed', () => {
    const rows = rowsOf(view([[1, 'Small', '-10000', 0, true]]), 'variant', true);
    expect(rows[0]!.change).toBe('-10.000');
  });
});

describe('the per-variant preview is exact, on strings, and floors at zero', () => {
  it('the sum, the floor, the over-maximum note and the not-computable case', () => {
    expect(previewOf('40.000', '5.000')).toEqual({ kind: 'sum', price: '45000' });
    expect(previewOf('100.000', '-99.999.999')).toEqual({ kind: 'floor' });
    expect(previewOf('100.000', '-100.000')).toEqual({ kind: 'sum', price: '0' });
    expect(previewOf('99.999.999', '+1')).toEqual({ kind: 'over', price: '100000000' });
    expect(previewOf('99.999.999', '0')).toEqual({ kind: 'sum', price: '99999999' });
    expect(previewOf('abc', '1')).toEqual({ kind: 'unknown' });
    expect(previewOf('40.000', '')).toEqual({ kind: 'unknown' });
    expect(previewOf('', '0')).toEqual({ kind: 'unknown' });
  });
});
