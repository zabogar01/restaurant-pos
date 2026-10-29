import { describe, expect, it } from 'vitest';
import {
  CreatePresetRequest,
  DeactivatePresetRequest,
  DiscountAmount,
  PresetName,
  PresetResponse,
  PresetValue,
  PresetView,
  PresetsResponse,
  ReactivatePresetRequest,
  UpdatePresetRequest,
} from '../src/discount-presets.js';

const ID = '0b1f3a52-6d0e-4c53-9d5b-2f0f7f6b9a11';
const PERCENT = { kind: 'PERCENTAGE', ratePpm: '100000' } as const;
const FIXED = { kind: 'FIXED', amount: '5000' } as const;

describe('the preset name rule', () => {
  it('accepts 1 to 32 code points with no edge whitespace and no control character', () => {
    for (const name of ['Staff', 'Happy hour', 'a', 'x'.repeat(32), '😀'.repeat(32), 'Two  spaces']) {
      expect(PresetName.safeParse(name).success, name).toBe(true);
    }
  });

  it('refuses an empty, over-long, untrimmed or control-character name', () => {
    for (const name of ['', 'x'.repeat(33), '😀'.repeat(33), ' Staff', 'Staff ', '\tStaff', 'Staff\n', 'St\u0000aff', 'St\u001baff', 'St\u007faff', 'St\u009faff']) {
      expect(PresetName.safeParse(name).success, JSON.stringify(name)).toBe(false);
    }
  });
});

describe('the discount amount', () => {
  it('accepts a canonical minor-unit string from 0 to 99999999', () => {
    for (const amount of ['0', '1', '5000', '99999999']) expect(DiscountAmount.safeParse(amount).success, amount).toBe(true);
  });

  it('refuses a number, a sign, a leading zero, an exponent, a fraction, a space, an empty string and a ninth digit', () => {
    for (const amount of [5000, 0, '-1', '-0', '+5', '01', '1e3', '1.5', ' 5', '5 ', '', '100000000']) {
      expect(DiscountAmount.safeParse(amount).success, String(amount)).toBe(false);
    }
  });
});

describe('the preset value', () => {
  it('accepts a percentage as canonical parts per million from 0 to 1000000', () => {
    for (const ratePpm of ['0', '1', '125000', '1000000']) {
      expect(PresetValue.safeParse({ kind: 'PERCENTAGE', ratePpm }).success, ratePpm).toBe(true);
    }
  });

  it('accepts a fixed amount from 0 to 99999999', () => {
    for (const amount of ['0', '99999999']) expect(PresetValue.safeParse({ kind: 'FIXED', amount }).success, amount).toBe(true);
  });

  it('refuses a number, an over-range or non-canonical rate, and a rate carrying a fixed amount or the reverse', () => {
    const refused: unknown[] = [
      { kind: 'PERCENTAGE', ratePpm: 100000 },
      { kind: 'PERCENTAGE', ratePpm: '1000001' },
      { kind: 'PERCENTAGE', ratePpm: '010' },
      { kind: 'PERCENTAGE', ratePpm: '-1' },
      { kind: 'PERCENTAGE', ratePpm: '1e5' },
      { kind: 'PERCENTAGE', ratePpm: '1.5' },
      { kind: 'PERCENTAGE' },
      { kind: 'PERCENTAGE', ratePpm: '100000', amount: '5000' },
      { kind: 'PERCENTAGE', amount: '5000' },
      { kind: 'FIXED', amount: 5000 },
      { kind: 'FIXED', amount: '100000000' },
      { kind: 'FIXED', amount: '-1' },
      { kind: 'FIXED' },
      { kind: 'FIXED', ratePpm: '100000' },
      { kind: 'FIXED', amount: '5000', ratePpm: '100000' },
      { kind: 'PERCENT', ratePpm: '100000' },
      { ratePpm: '100000' },
      '10%',
      null,
    ];
    for (const value of refused) expect(PresetValue.safeParse(value).success, JSON.stringify(value)).toBe(false);
  });
});

describe('the preset view and responses', () => {
  const view = { presetId: ID, name: 'Staff', value: PERCENT, isActive: true };

  it('is strict: an extra key, a missing key or a date, order or stacking field is refused', () => {
    expect(PresetView.safeParse(view).success).toBe(true);
    expect(PresetView.safeParse({ ...view, value: FIXED, isActive: false }).success).toBe(true);
    for (const extra of ['validFrom', 'displayOrder', 'priority', 'stackable', 'minimumSpend', 'schedule']) {
      expect(PresetView.safeParse({ ...view, [extra]: 1 }).success, extra).toBe(false);
    }
    const { isActive: _isActive, ...without } = view;
    expect(PresetView.safeParse(without).success).toBe(false);
    expect(PresetView.safeParse({ ...view, presetId: 'nope' }).success).toBe(false);
  });

  it('wraps a preset or a list in the catalog version', () => {
    expect(PresetResponse.safeParse({ version: 3, preset: view }).success).toBe(true);
    expect(PresetResponse.safeParse({ version: -1, preset: view }).success).toBe(false);
    expect(PresetResponse.safeParse({ version: 3, preset: view, extra: 1 }).success).toBe(false);
    expect(PresetsResponse.safeParse({ version: 0, presets: [] }).success).toBe(true);
    expect(PresetsResponse.safeParse({ version: 0, presets: [view, { ...view, value: FIXED }] }).success).toBe(true);
    expect(PresetsResponse.safeParse({ presets: [] }).success).toBe(false);
  });
});

describe('the preset requests', () => {
  it('create carries a name and a value, strictly', () => {
    expect(CreatePresetRequest.safeParse({ name: 'Staff', value: PERCENT }).success).toBe(true);
    expect(CreatePresetRequest.safeParse({ name: 'Staff', value: FIXED }).success).toBe(true);
    expect(CreatePresetRequest.safeParse({ name: 'Staff' }).success).toBe(false);
    expect(CreatePresetRequest.safeParse({ value: PERCENT }).success).toBe(false);
    expect(CreatePresetRequest.safeParse({ name: 'Staff', value: PERCENT, isActive: true }).success).toBe(false);
    expect(CreatePresetRequest.safeParse({ name: 'Staff', value: { ...PERCENT, extra: 1 } }).success).toBe(false);
  });

  it('update carries the whole preset under a version, strictly', () => {
    const update = { presetId: ID, expectedVersion: 4, name: 'Staff', value: PERCENT };
    expect(UpdatePresetRequest.safeParse(update).success).toBe(true);
    expect(UpdatePresetRequest.safeParse({ ...update, expectedVersion: 0 }).success).toBe(true);
    for (const bad of [
      { ...update, expectedVersion: undefined },
      { ...update, expectedVersion: -1 },
      { ...update, expectedVersion: 1.5 },
      { ...update, expectedVersion: '4' },
      { ...update, presetId: 'nope' },
      { ...update, name: '' },
      { ...update, value: undefined },
      { ...update, extra: 1 },
    ]) {
      expect(UpdatePresetRequest.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('deactivate and reactivate carry an id and nothing else: no version', () => {
    for (const schema of [DeactivatePresetRequest, ReactivatePresetRequest]) {
      expect(schema.safeParse({ presetId: ID }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ presetId: 'nope' }).success).toBe(false);
      expect(schema.safeParse({ presetId: ID, expectedVersion: 1 }).success).toBe(false);
    }
  });
});
