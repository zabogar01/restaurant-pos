import { CreateTenderMethodRequest, type TenderMethodView } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { fieldsInError } from '../src/forms/fieldsInError.js';
import { checkMethodName, orderedMethods, sameName } from '../src/settings/methods.js';

// BO-08's method name (DESIGN-018, "Method name (S3)"; PHASE1-S3b criteria 1 and 3): the form's
// own check and the contract's `TenderMethodName` agree on every boundary, the check counts
// code points, and the list is ordered by the client.

const NAMES: Array<[string, string]> = [
  ['empty', ''],
  ['spaces only', '   '],
  ['one character', 'Q'],
  ['32 characters', 'x'.repeat(32)],
  ['33 characters', 'x'.repeat(33)],
  ['32 emoji', '🍽'.repeat(32)],
  ['33 emoji', '🍽'.repeat(33)],
  ['an inner tab', 'Bank\ttransfer'],
  ['ESC', 'Bank\u001btransfer'],
  ['U+0007', 'Bank\u0007transfer'],
  ['an inner space', 'Bank transfer'],
  ['leading and trailing spaces', '  GoPay  '],
  ['leading and trailing tabs', '\tGoPay\t'],
  ['accents', 'Qris Ünïcode'],
];

describe('the form’s own check and TenderMethodName agree', () => {
  it.each(NAMES)('%s: accepted by the check exactly when CreateTenderMethodRequest accepts the trimmed name', (_what, typed) => {
    const checked = checkMethodName(typed);
    const refused = fieldsInError(CreateTenderMethodRequest, { name: checked.name }).includes('name');
    expect(checked.error === null, JSON.stringify(typed)).toBe(!refused);
  });

  it('sends the trimmed name, which the schema accepts once trimmed and refuses untrimmed', () => {
    const checked = checkMethodName('  GoPay  ');
    expect(checked).toEqual({ name: 'GoPay', error: null });
    expect(fieldsInError(CreateTenderMethodRequest, { name: checked.name })).toEqual([]);
    expect(fieldsInError(CreateTenderMethodRequest, { name: '  GoPay  ' })).toEqual(['name']);
  });

  it('trims, then checks empty, length and control characters in that order', () => {
    expect(checkMethodName('   ')).toEqual({ name: '', error: 'empty' });
    expect(checkMethodName('x'.repeat(33)).error).toBe('long');
    expect(checkMethodName('Bank\ttransfer').error).toBe('control');
    expect(checkMethodName('Bank\u001btransfer').error).toBe('control');
    expect(checkMethodName('Bank\u0007transfer').error).toBe('control');
    // Over-long wins over a control character: the table's order.
    expect(checkMethodName('\u0007' + 'x'.repeat(40)).error).toBe('long');
  });

  it('counts code points, not UTF-16 units', () => {
    expect(checkMethodName('🍽'.repeat(32)).error).toBeNull();
    expect(checkMethodName('🍽'.repeat(33)).error).toBe('long');
    expect(checkMethodName('x'.repeat(32)).error).toBeNull();
    expect(checkMethodName('x'.repeat(33)).error).toBe('long');
  });
});

const view = (name: string, isActive: boolean, n: number): TenderMethodView => ({
  tenderMethodId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  name,
  isActive,
});

describe('the list’s order', () => {
  it('puts active before inactive, then names in natural case-insensitive order', () => {
    const rows = [view('qris', false, 1), view('GoPay 10', true, 2), view('Bank transfer', true, 3), view('GoPay 2', true, 4)];
    expect(orderedMethods(rows).map((r) => r.name)).toEqual(['Bank transfer', 'GoPay 2', 'GoPay 10', 'qris']);
  });

  it('is case-insensitive and keeps the server’s order for names that tie', () => {
    const rows = [view('b', true, 1), view('A', true, 2), view('a', true, 3), view('B', true, 4)];
    expect(orderedMethods(rows).map((r) => r.tenderMethodId.slice(-1))).toEqual(['2', '3', '1', '4']);
  });

  it('does not change the list it is given', () => {
    const rows = [view('b', true, 1), view('a', true, 2)];
    orderedMethods(rows);
    expect(rows.map((r) => r.name)).toEqual(['b', 'a']);
  });
});

describe('sameName', () => {
  it('compares case-insensitively', () => {
    expect(sameName('GoPay', 'gopay')).toBe(true);
    expect(sameName('QRIS', 'qris')).toBe(true);
    expect(sameName('GoPay', 'GoPay 2')).toBe(false);
  });

  it('matches the server’s lower(name) index: accents and digits make a different name', () => {
    expect(sameName('Cafe', 'Café')).toBe(false);
    expect(sameName('GoPay 2', 'GoPay 02')).toBe(false);
  });
});
