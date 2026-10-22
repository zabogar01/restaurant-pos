import { describe, expect, it } from 'vitest';
import {
  CreateTenderMethodRequest,
  DeactivateTenderMethodRequest,
  ReactivateTenderMethodRequest,
  TenderMethodName,
  TenderMethodResponse,
  TenderMethodView,
  TenderMethodsResponse,
  UpdateTenderMethodRequest,
} from '../src/tender-methods.js';

const ID = '0b1f3a52-6d0e-4c53-9d5b-2f0f7f6b9a11';

describe('the tender method name rule', () => {
  it('accepts 1 to 32 code points with no edge whitespace and no control character', () => {
    for (const name of ['QRIS', 'Bank transfer', 'a', 'x'.repeat(32), 'Gift  card', 'Cash', 'card', '😀'.repeat(32)]) {
      expect(TenderMethodName.safeParse(name).success, name).toBe(true);
    }
  });

  it('10. refuses an empty, over-long, untrimmed or control-character name', () => {
    for (const name of [
      '',
      'x'.repeat(33),
      '😀'.repeat(33),
      ' QRIS',
      'QRIS ',
      '\tQRIS',
      'QRIS\n',
      'QR\u0000IS',
      'QR\tIS',
      'QR\nIS',
      'QR\u007fIS',
      'QR\u009fIS',
    ]) {
      expect(TenderMethodName.safeParse(name).success, JSON.stringify(name)).toBe(false);
    }
  });

  it('refuses a non-string', () => {
    for (const name of [1, null, undefined, {}, ['QRIS']]) {
      expect(TenderMethodName.safeParse(name).success).toBe(false);
    }
  });

  it('does not transform: the parsed name is the name given', () => {
    expect(TenderMethodName.parse('Bank transfer')).toBe('Bank transfer');
  });
});

describe('the tender method requests', () => {
  it('are strict objects: an extra key is refused', () => {
    expect(CreateTenderMethodRequest.safeParse({ name: 'QRIS' }).success).toBe(true);
    expect(CreateTenderMethodRequest.safeParse({ name: 'QRIS', extra: 1 }).success).toBe(false);
    expect(UpdateTenderMethodRequest.safeParse({ tenderMethodId: ID, name: 'QRIS' }).success).toBe(true);
    expect(UpdateTenderMethodRequest.safeParse({ tenderMethodId: ID, name: 'QRIS', extra: 1 }).success).toBe(false);
    for (const schema of [DeactivateTenderMethodRequest, ReactivateTenderMethodRequest]) {
      expect(schema.safeParse({ tenderMethodId: ID }).success).toBe(true);
      expect(schema.safeParse({ tenderMethodId: ID, extra: 1 }).success).toBe(false);
      expect(schema.safeParse({}).success).toBe(false);
    }
  });

  it('refuse a tenderMethodId that is not a UUID', () => {
    for (const tenderMethodId of ['', 'QRIS', '123', ID.slice(1), `${ID}0`, 7, null]) {
      expect(DeactivateTenderMethodRequest.safeParse({ tenderMethodId }).success, String(tenderMethodId)).toBe(false);
      expect(UpdateTenderMethodRequest.safeParse({ tenderMethodId, name: 'QRIS' }).success, String(tenderMethodId)).toBe(
        false
      );
    }
  });

  it('refuse an untrimmed name in create and update', () => {
    expect(CreateTenderMethodRequest.safeParse({ name: ' QRIS' }).success).toBe(false);
    expect(UpdateTenderMethodRequest.safeParse({ tenderMethodId: ID, name: 'QRIS ' }).success).toBe(false);
  });
});

describe('the tender method views', () => {
  it('TenderMethodView is exactly { tenderMethodId, name, isActive }', () => {
    const view = { tenderMethodId: ID, name: 'QRIS', isActive: true };
    expect(TenderMethodView.safeParse(view).success).toBe(true);
    expect(TenderMethodView.safeParse({ ...view, fee: 1 }).success).toBe(false);
    expect(TenderMethodView.safeParse({ tenderMethodId: ID, name: 'QRIS' }).success).toBe(false);
    expect(TenderMethodResponse.safeParse({ tenderMethod: view }).success).toBe(true);
    expect(TenderMethodResponse.safeParse({ tenderMethod: view, extra: 1 }).success).toBe(false);
    expect(TenderMethodsResponse.safeParse({ tenderMethods: [view, view] }).success).toBe(true);
    expect(TenderMethodsResponse.safeParse({ tenderMethods: [] }).success).toBe(true);
    expect(TenderMethodsResponse.safeParse({ tenderMethods: [{ ...view, fee: 1 }] }).success).toBe(false);
  });
});
