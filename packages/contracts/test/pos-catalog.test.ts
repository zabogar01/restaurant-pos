import { describe, expect, it } from 'vitest';
import { PosMenuResponse, PosRevisionResponse } from '../src/pos-catalog.js';

// PHASE1-S7a: the POS's catalog on the wire. The projection holds only what the POS may
// show, so a strict object refuses a field a client could branch on (consult C4).

const ID = '00000000-0000-4000-8000-000000000001';

const variant = { variantId: ID, name: 'Large', priceDelta: '-2000' };
const modifier = { modifierId: ID, name: 'Oat milk', priceDelta: '3000' };
const item = {
  itemId: ID,
  categoryId: ID,
  name: 'Latte',
  basePrice: '25000',
  isAvailable: false,
  variants: [variant],
  modifiers: [modifier],
};
const category = { categoryId: ID, name: 'Drinks' };
const percentage = { presetId: ID, name: 'Staff', value: { kind: 'PERCENTAGE', ratePpm: '100000' } };
const fixed = { presetId: ID, name: 'Voucher', value: { kind: 'FIXED', amount: '5000' } };
const menu = { version: 0, categories: [category], items: [item], presets: [percentage, fixed] };

describe('PosMenuResponse', () => {
  it('accepts a menu, version 0 and empty lists included', () => {
    expect(PosMenuResponse.safeParse(menu).success).toBe(true);
    expect(PosMenuResponse.safeParse({ version: 0, categories: [], items: [], presets: [] }).success).toBe(true);
  });

  it.each([
    ['a category', { ...menu, categories: [{ ...category, isActive: true }] }],
    ['a category with displayOrder', { ...menu, categories: [{ ...category, displayOrder: 0 }] }],
    ['an item', { ...menu, items: [{ ...item, isActive: true }] }],
    ['an item with displayOrder', { ...menu, items: [{ ...item, displayOrder: 0 }] }],
    ['a variant', { ...menu, items: [{ ...item, variants: [{ ...variant, isActive: true }] }] }],
    ['a variant with displayOrder', { ...menu, items: [{ ...item, variants: [{ ...variant, displayOrder: 0 }] }] }],
    ['a modifier', { ...menu, items: [{ ...item, modifiers: [{ ...modifier, isActive: true }] }] }],
    ['a modifier with displayOrder', { ...menu, items: [{ ...item, modifiers: [{ ...modifier, displayOrder: 0 }] }] }],
    ['a preset', { ...menu, presets: [{ ...percentage, isActive: true }] }],
  ])('4. refuses isActive or displayOrder on %s', (_name, body) => {
    expect(PosMenuResponse.safeParse(body).success).toBe(false);
  });

  it('refuses a field the response does not hold', () => {
    expect(PosMenuResponse.safeParse({ ...menu, extra: 1 }).success).toBe(false);
  });

  it.each([
    ['a base price as a number', { ...item, basePrice: 25000 }],
    ['a base price with a fraction', { ...item, basePrice: '250.5' }],
    ['a negative base price', { ...item, basePrice: '-1' }],
    ['a variant change as a number', { ...item, variants: [{ ...variant, priceDelta: -2000 }] }],
    ['a negative modifier change', { ...item, modifiers: [{ ...modifier, priceDelta: '-1' }] }],
    ['a missing isAvailable', { ...item, isAvailable: undefined }],
  ])('8. refuses %s', (_name, bad) => {
    expect(PosMenuResponse.safeParse({ ...menu, items: [bad] }).success).toBe(false);
  });

  it('8. refuses a rate or an amount as a number, and a preset value with both fields', () => {
    const withValue = (value: unknown) => ({ ...menu, presets: [{ presetId: ID, name: 'P', value }] });
    expect(PosMenuResponse.safeParse(withValue({ kind: 'PERCENTAGE', ratePpm: 100000 })).success).toBe(false);
    expect(PosMenuResponse.safeParse(withValue({ kind: 'FIXED', amount: 5000 })).success).toBe(false);
    expect(PosMenuResponse.safeParse(withValue({ kind: 'FIXED', amount: '5000', ratePpm: '1' })).success).toBe(false);
  });

  it('refuses a version that is negative, fractional or too large', () => {
    for (const version of [-1, 1.5, 2_147_483_648, '1']) {
      expect(PosMenuResponse.safeParse({ ...menu, version }).success, String(version)).toBe(false);
    }
  });
});

describe('PosRevisionResponse', () => {
  it('holds the version alone', () => {
    expect(PosRevisionResponse.safeParse({ version: 7 }).success).toBe(true);
    expect(PosRevisionResponse.safeParse({ version: 7, categories: [] }).success).toBe(false);
    expect(PosRevisionResponse.safeParse({ version: '7' }).success).toBe(false);
    expect(PosRevisionResponse.safeParse({}).success).toBe(false);
  });
});
