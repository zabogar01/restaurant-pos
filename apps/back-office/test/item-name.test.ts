import { CreateItemRequest, ItemName, UpdateItemRequest } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { fieldsInError } from '../src/forms/fieldsInError.js';
import { checkItemName } from '../src/item/name.js';

// BO-04's item name (DESIGN-020, "Names"; PHASE1-S4c2a ruling 6): trimmed, then refused if empty,
// over 64 code points, or holding a control character, in that order. The form's own check and the
// contract's `ItemName` agree on every boundary, and the check counts code points.

const NAMES: Array<[string, string]> = [
  ['empty', ''],
  ['spaces only', '   '],
  ['one character', 'B'],
  ['64 characters', 'x'.repeat(64)],
  ['65 characters', 'x'.repeat(65)],
  ['64 emoji', '🍔'.repeat(64)],
  ['65 emoji', '🍔'.repeat(65)],
  ['an inner tab', 'Beef\tburger'],
  ['ESC', 'Beef\u001bburger'],
  ['U+0007', 'Beef\u0007burger'],
  ['an inner space', 'Beef burger'],
  ['leading and trailing spaces', '  Burger  '],
  ['leading and trailing tabs', '\tBurger\t'],
  ['accents', 'Crème brûlée'],
  ['63 characters and a trailing space', `${'x'.repeat(63)} `],
  ['64 characters and a trailing space', `${'x'.repeat(64)} `],
];

const ID = '11111111-1111-4111-8111-111111111111';

describe('the form’s own check and ItemName agree', () => {
  it.each(NAMES)('%s: accepted by the check exactly when the schema accepts the trimmed name', (_what, typed) => {
    const checked = checkItemName(typed);
    expect(checked.error === null, JSON.stringify(typed)).toBe(ItemName.safeParse(checked.name).success);
    const refusedCreate = fieldsInError(CreateItemRequest, {
      categoryId: ID,
      name: checked.name,
      basePrice: '0',
      variants: [],
      modifiers: [],
    }).includes('name');
    const refusedUpdate = fieldsInError(UpdateItemRequest, {
      itemId: ID,
      expectedVersion: 1,
      changes: { fields: { name: checked.name } },
    }).includes('changes');
    expect(checked.error === null).toBe(!refusedCreate);
    expect(checked.error === null).toBe(!refusedUpdate);
  });

  it('sends the trimmed name, which the schema accepts once trimmed and refuses untrimmed', () => {
    const checked = checkItemName('  Burger  ');
    expect(checked).toEqual({ name: 'Burger', error: null });
    expect(ItemName.safeParse('Burger').success).toBe(true);
    expect(ItemName.safeParse('  Burger  ').success).toBe(false);
  });

  it('trims, then checks empty, length and control characters in that order', () => {
    expect(checkItemName('   ')).toEqual({ name: '', error: 'empty' });
    expect(checkItemName('x'.repeat(65)).error).toBe('long');
    expect(checkItemName('Beef\tburger').error).toBe('control');
    expect(checkItemName('\u0007' + 'x'.repeat(70)).error).toBe('long');
  });

  it('counts code points, not UTF-16 units: 64 emoji are accepted and 65 are refused', () => {
    expect(checkItemName('🍔'.repeat(64)).error).toBeNull();
    expect(checkItemName('🍔'.repeat(65)).error).toBe('long');
    expect(checkItemName('x'.repeat(64)).error).toBeNull();
    expect(checkItemName('x'.repeat(65)).error).toBe('long');
  });

  it('BO-03’s 80-unit stress name is not a valid name', () => {
    expect(checkItemName('Menu item 01 '.padEnd(80, 'W')).error).toBe('long');
  });
});
