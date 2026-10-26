import { CreateCategoryRequest, UpdateCategoryRequest } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { fieldsInError } from '../src/forms/fieldsInError.js';
import { checkCategoryName } from '../src/menu/name.js';

// BO-03's category name (DESIGN-019, "Category names"; PHASE1-S4c1 ruling 8, criterion 5): the
// form's own check and the contract's `CategoryName` agree on every boundary, the check counts
// code points, and the order of the refusals is empty, long, control.

const NAMES: Array<[string, string]> = [
  ['empty', ''],
  ['spaces only', '   '],
  ['one character', 'M'],
  ['32 characters', 'x'.repeat(32)],
  ['33 characters', 'x'.repeat(33)],
  ['32 emoji', '🍽'.repeat(32)],
  ['33 emoji', '🍽'.repeat(33)],
  ['an inner tab', 'Main\tplates'],
  ['ESC', 'Main\u001bplates'],
  ['U+0007', 'Main\u0007plates'],
  ['an inner space', 'Main plates'],
  ['leading and trailing spaces', '  Mains  '],
  ['leading and trailing tabs', '\tMains\t'],
  ['accents', 'Pâtisserie Ünïcode'],
];

const ID = '11111111-1111-4111-8111-111111111111';

describe('the form’s own check and CategoryName agree', () => {
  it.each(NAMES)('%s: accepted by the check exactly when the requests accept the trimmed name', (_what, typed) => {
    const checked = checkCategoryName(typed);
    const refusedCreate = fieldsInError(CreateCategoryRequest, { name: checked.name }).includes('name');
    const refusedRename = fieldsInError(UpdateCategoryRequest, {
      categoryId: ID,
      expectedVersion: 1,
      name: checked.name,
    }).includes('name');
    expect(checked.error === null, JSON.stringify(typed)).toBe(!refusedCreate);
    expect(checked.error === null, JSON.stringify(typed)).toBe(!refusedRename);
  });

  it('sends the trimmed name, which the schema accepts once trimmed and refuses untrimmed', () => {
    const checked = checkCategoryName('  Mains  ');
    expect(checked).toEqual({ name: 'Mains', error: null });
    expect(fieldsInError(CreateCategoryRequest, { name: checked.name })).toEqual([]);
    expect(fieldsInError(CreateCategoryRequest, { name: '  Mains  ' })).toEqual(['name']);
  });

  it('trims, then checks empty, length and control characters in that order', () => {
    expect(checkCategoryName('   ')).toEqual({ name: '', error: 'empty' });
    expect(checkCategoryName('x'.repeat(33)).error).toBe('long');
    expect(checkCategoryName('Main\tplates').error).toBe('control');
    expect(checkCategoryName('Main\u001bplates').error).toBe('control');
    expect(checkCategoryName('Main\u0007plates').error).toBe('control');
    // Over-long wins over a control character: the table's order.
    expect(checkCategoryName('\u0007' + 'x'.repeat(40)).error).toBe('long');
  });

  it('counts code points, not UTF-16 units', () => {
    expect(checkCategoryName('🍽'.repeat(32)).error).toBeNull();
    expect(checkCategoryName('🍽'.repeat(33)).error).toBe('long');
    expect(checkCategoryName('x'.repeat(32)).error).toBeNull();
    expect(checkCategoryName('x'.repeat(33)).error).toBe('long');
  });
});
