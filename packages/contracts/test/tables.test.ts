import { describe, expect, it } from 'vitest';
import {
  CreateTableRequest,
  DeactivateTableRequest,
  ReactivateTableRequest,
  TableLabel,
  TableResponse,
  TableView,
  TablesResponse,
  UpdateTableRequest,
} from '../src/tables.js';

const ID = '0b1f3a52-6d0e-4c53-9d5b-2f0f7f6b9a11';

describe('the table label rule', () => {
  it('accepts 1 to 32 characters with no edge whitespace and no control character', () => {
    for (const label of ['T1', 'Terrace 12', 'a', 'x'.repeat(32), 'Bar  2', 'Taman ☕']) {
      expect(TableLabel.safeParse(label).success, label).toBe(true);
    }
  });

  it('10. refuses an empty, over-long, untrimmed or control-character label', () => {
    for (const label of [
      '',
      'x'.repeat(33),
      ' T1',
      'T1 ',
      '\tT1',
      'T1\n',
      ' T1',
      'T\u00001',
      'T\t1',
      'T\u007f1',
      'T\u009f1',
    ]) {
      expect(TableLabel.safeParse(label).success, JSON.stringify(label)).toBe(false);
    }
  });

  it('refuses a non-string', () => {
    for (const label of [1, null, undefined, {}, ['T1']]) {
      expect(TableLabel.safeParse(label).success).toBe(false);
    }
  });

  it('does not transform: the parsed label is the label given', () => {
    expect(TableLabel.parse('Terrace 12')).toBe('Terrace 12');
  });
});

describe('the table requests', () => {
  it('are strict objects: an extra key is refused', () => {
    expect(CreateTableRequest.safeParse({ label: 'T1' }).success).toBe(true);
    expect(CreateTableRequest.safeParse({ label: 'T1', extra: 1 }).success).toBe(false);
    expect(UpdateTableRequest.safeParse({ tableId: ID, label: 'T1' }).success).toBe(true);
    expect(UpdateTableRequest.safeParse({ tableId: ID, label: 'T1', extra: 1 }).success).toBe(false);
    for (const schema of [DeactivateTableRequest, ReactivateTableRequest]) {
      expect(schema.safeParse({ tableId: ID }).success).toBe(true);
      expect(schema.safeParse({ tableId: ID, extra: 1 }).success).toBe(false);
      expect(schema.safeParse({}).success).toBe(false);
    }
  });

  it('refuse a tableId that is not a UUID', () => {
    for (const tableId of ['', 'T1', '123', ID.slice(1), `${ID}0`, 7, null]) {
      expect(DeactivateTableRequest.safeParse({ tableId }).success, String(tableId)).toBe(false);
      expect(UpdateTableRequest.safeParse({ tableId, label: 'T1' }).success, String(tableId)).toBe(false);
    }
  });

  it('refuse an untrimmed label in create and update', () => {
    expect(CreateTableRequest.safeParse({ label: ' T1' }).success).toBe(false);
    expect(UpdateTableRequest.safeParse({ tableId: ID, label: 'T1 ' }).success).toBe(false);
  });
});

describe('the table views', () => {
  it('TableView is exactly { tableId, label, isActive }', () => {
    const view = { tableId: ID, label: 'T1', isActive: true };
    expect(TableView.safeParse(view).success).toBe(true);
    expect(TableView.safeParse({ ...view, seats: 4 }).success).toBe(false);
    expect(TableView.safeParse({ tableId: ID, label: 'T1' }).success).toBe(false);
    expect(TableResponse.safeParse({ table: view }).success).toBe(true);
    expect(TableResponse.safeParse({ table: view, extra: 1 }).success).toBe(false);
    expect(TablesResponse.safeParse({ tables: [view, view] }).success).toBe(true);
    expect(TablesResponse.safeParse({ tables: [] }).success).toBe(true);
    expect(TablesResponse.safeParse({ tables: [{ ...view, seats: 4 }] }).success).toBe(false);
  });
});
