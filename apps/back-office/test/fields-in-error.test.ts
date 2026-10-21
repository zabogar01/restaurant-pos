import { CreateTableRequest, UpdateTableRequest } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { fieldsInError } from '../src/forms/fieldsInError.js';
import { checkLabel } from '../src/tables/label.js';

// Consult C2 section 2: the field list is built in the back office, from the form's own
// check, before the core is called, and carries nothing that is not a field of the schema.

const ID = '6f1c5f0e-3f43-4a52-9f5b-0d2a6c3b8c11';

describe('fieldsInError', () => {
  it('is empty for a body the schema accepts', () => {
    expect(fieldsInError(CreateTableRequest, { label: 'Table 1' })).toEqual([]);
  });

  it('names the label for an empty, an over-long and a control-character label', () => {
    for (const label of ['', 'x'.repeat(33), 'Table\u0007 2', ' padded']) {
      expect(fieldsInError(CreateTableRequest, { label }), JSON.stringify(label)).toEqual(['label']);
    }
  });

  it('names the schema’s own fields in the schema’s key order, each once', () => {
    expect(fieldsInError(UpdateTableRequest, { label: '', tableId: 'not-a-uuid' })).toEqual(['tableId', 'label']);
    expect(fieldsInError(UpdateTableRequest, { tableId: ID, label: '' })).toEqual(['label']);
  });

  it('never names a key the schema does not have', () => {
    // An extra key is an `unrecognized_keys` issue with an empty path: it cannot contribute.
    expect(fieldsInError(CreateTableRequest, { label: 'Table 1', secretKey: 1 })).toEqual([]);
    expect(fieldsInError(CreateTableRequest, { label: '', secretKey: 1 })).toEqual(['label']);
    // A body that is not an object has no path at all.
    expect(fieldsInError(CreateTableRequest, 'nope')).toEqual([]);
    expect(fieldsInError(CreateTableRequest, null)).toEqual([]);
  });
});

describe('the form’s own check and the contract agree', () => {
  const labels = [
    'Table 1', 'T', 'x'.repeat(32), 'Terrace ABCDEFGHIJKLMNOPQRSTUVWX', 'Ünïcode 🍽', 'a b',
    '', ' ', '   ', 'x'.repeat(33), 'Table\u0007 2', 'a\u0000b', '\u001f',
  ];

  it.each(labels)('%j: accepted by the form exactly when CreateTableRequest accepts it', (typed) => {
    const checked = checkLabel(typed);
    const refused = fieldsInError(CreateTableRequest, { label: checked.label }).includes('label');
    expect(checked.error === null, JSON.stringify(typed)).toBe(!refused);
  });

  it('trims, then checks empty, length and control characters in that order', () => {
    expect(checkLabel('  Table 1  ')).toEqual({ label: 'Table 1', error: null });
    expect(checkLabel('   ')).toEqual({ label: '', error: 'empty' });
    expect(checkLabel('x'.repeat(33)).error).toBe('long');
    expect(checkLabel('Table\u0007 2').error).toBe('control');
    // Over-long wins over a control character: D's order.
    expect(checkLabel('\u0007' + 'x'.repeat(40)).error).toBe('long');
  });

  it('counts UTF-16 units, as the contract does', () => {
    expect(checkLabel('🍽'.repeat(16)).error).toBeNull();
    expect(checkLabel('🍽'.repeat(17)).error).toBe('long');
  });
});
