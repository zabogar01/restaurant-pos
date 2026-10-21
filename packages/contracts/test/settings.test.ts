import { describe, expect, it } from 'vitest';
import { ErrorBody } from '../src/errors.js';
import { SaveSettingsRequest, SettingsReadView } from '../src/settings.js';

// S2-19 at the schema: each column's rules (PHASE1-S2a Ruling 2), the rate shape and
// bound, the version number and the strictness of the object. The server test proves
// the same refusals reach the wire as VALIDATION_FAILED.

const GOOD = {
  expectedVersion: 1,
  taxRatePpm: '100000',
  serviceChargeRatePpm: '0',
  outletName: 'Warung Contoh',
  address: 'Jl. Contoh 1\nBandung',
  phone: '+62 (22) 555-0100',
  npwpd: null,
  footer: 'Terima kasih',
};

const accepts = (over: Record<string, unknown>) => SaveSettingsRequest.safeParse({ ...GOOD, ...over }).success;

describe('SaveSettingsRequest', () => {
  it('accepts the good request, a first save and a NPWPD', () => {
    expect(accepts({})).toBe(true);
    expect(accepts({ expectedVersion: null })).toBe(true);
    expect(accepts({ npwpd: '01.234.567.8-901.000' })).toBe(true);
  });

  it('holds the outlet name to 1 to 64 trimmed characters with no control character', () => {
    expect(accepts({ outletName: 'x'.repeat(64) })).toBe(true);
    for (const outletName of ['', 'x'.repeat(65), ' A', 'A ', '  ', 'A\u001bB', 'A\u009bB', 'A\nB', 'A\tB', 5, null]) {
      expect(accepts({ outletName }), JSON.stringify(outletName)).toBe(false);
    }
  });

  it('holds the address to 1 to 200 trimmed characters, at most two line feeds and no other control character', () => {
    expect(accepts({ address: 'x'.repeat(200) })).toBe(true);
    expect(accepts({ address: 'A\nB\nC' })).toBe(true);
    for (const address of ['', 'x'.repeat(201), 'A\n', '\nA', 'A\nB\nC\nD', 'A\r\nB', 'A\tB', 'A\u001bB', 'A\u009bB', null]) {
      expect(accepts({ address }), JSON.stringify(address)).toBe(false);
    }
  });

  it('holds the phone to 1 to 32 trimmed digits, spaces and + - . ( ), with no slash and no letter', () => {
    expect(accepts({ phone: '1'.repeat(32) })).toBe(true);
    expect(accepts({ phone: '+62 (22) 555-0100.' })).toBe(true);
    for (const phone of ['', '1'.repeat(33), '022/555', '022 x', ' 022', '022 ', '022\n', '٢٢٢', null]) {
      expect(accepts({ phone }), JSON.stringify(phone)).toBe(false);
    }
  });

  it('takes the NPWPD as null or 1 to 32 trimmed characters with no control character; a blank string is not none', () => {
    expect(accepts({ npwpd: 'n'.repeat(32) })).toBe(true);
    for (const npwpd of ['', ' ', 'n'.repeat(33), ' P', 'P ', 'P\u001b1', 'P\u009b1', 7]) {
      expect(accepts({ npwpd }), JSON.stringify(npwpd)).toBe(false);
    }
    expect(SaveSettingsRequest.safeParse({ ...GOOD, npwpd: undefined }).success).toBe(false);
  });

  it('requires the footer: 1 to 120 trimmed characters with no control character', () => {
    expect(accepts({ footer: 'f'.repeat(120) })).toBe(true);
    for (const footer of ['', 'f'.repeat(121), ' F', 'F ', 'A\nB', 'A\u001bB', null, undefined]) {
      expect(accepts({ footer }), JSON.stringify(footer)).toBe(false);
    }
  });

  it('takes each rate as a canonical string of parts per million from 0 to 1000000', () => {
    for (const key of ['taxRatePpm', 'serviceChargeRatePpm']) {
      for (const ok of ['0', '1', '110000', '1000000']) expect(accepts({ [key]: ok }), `${key} ${ok}`).toBe(true);
      for (const bad of ['1000001', '01', '00', '-1', '+1', '1e5', '1E5', '1.5', '', ' 1', '1 ', '99999999', 110000, 0, null, 1n]) {
        expect(accepts({ [key]: bad }), `${key} ${String(bad)}`).toBe(false);
      }
    }
  });

  it('takes expectedVersion as null or a positive integer', () => {
    for (const ok of [null, 1, 2, 2_147_483_647]) expect(accepts({ expectedVersion: ok }), String(ok)).toBe(true);
    for (const bad of [0, -1, 1.5, '1', 2_147_483_648, undefined, true]) {
      expect(accepts({ expectedVersion: bad }), String(bad)).toBe(false);
    }
  });

  it('refuses a missing field and every extra key, currency, precision, policy, version and author among them', () => {
    for (const key of Object.keys(GOOD)) {
      const { [key]: _omitted, ...rest } = GOOD as Record<string, unknown>;
      expect(SaveSettingsRequest.safeParse(rest).success, `without ${key}`).toBe(false);
    }
    for (const extra of ['currency', 'minorUnitPrecision', 'calculationPolicy', 'version', 'createdBy', 'createdAt', 'x']) {
      expect(accepts({ [extra]: 'USD' }), extra).toBe(false);
    }
  });
});

describe('SettingsReadView', () => {
  const version = {
    version: 1,
    createdAt: '2026-10-21T10:00:00.123Z',
    createdByName: 'Person',
    taxRatePpm: '100000',
    serviceChargeRatePpm: '0',
    outletName: 'Warung',
    address: 'Jl. 1',
    phone: '1',
    npwpd: null,
    footer: 'Terima kasih',
  };
  const installation = { currency: 'IDR', minorUnitPrecision: 0 };

  it('reads a null current (the first run) and a version', () => {
    expect(SettingsReadView.safeParse({ installation, current: null }).success).toBe(true);
    expect(SettingsReadView.safeParse({ installation, current: version }).success).toBe(true);
    expect(SettingsReadView.safeParse({ installation, current: { ...version, createdAt: '2026-10-21T17:00:00+07:00' } }).success).toBe(true);
  });

  it('refuses a rate as a number, a created-at with no offset, a currency not of three capitals and an extra key', () => {
    const refused = [
      { installation, current: { ...version, taxRatePpm: 100000 } },
      { installation, current: { ...version, createdAt: '2026-10-21 10:00:00' } },
      { installation, current: { ...version, version: 0 } },
      { installation, current: { ...version, extra: 1 } },
      { installation: { ...installation, currency: 'idr' }, current: null },
      { installation: { ...installation, minorUnitPrecision: -1 }, current: null },
      { installation: { ...installation, extra: 1 }, current: null },
      { installation },
    ];
    for (const input of refused) expect(SettingsReadView.safeParse(input).success, JSON.stringify(input)).toBe(false);
  });
});

describe('ErrorBody', () => {
  it('knows SETTINGS_CHANGED, with the code alone', () => {
    expect(ErrorBody.safeParse({ error: { code: 'SETTINGS_CHANGED' } }).success).toBe(true);
    expect(ErrorBody.safeParse({ error: { code: 'SETTINGS_CHANGED', details: { retryAfterSeconds: 1 } } }).success).toBe(false);
  });
});
