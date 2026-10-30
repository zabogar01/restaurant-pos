import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CreatePresetRequest, DiscountAmount, PresetName, RatePpm, UpdatePresetRequest } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import { fieldsInError } from '../src/forms/fieldsInError.js';
import { checkPrice } from '../src/item/price.js';
import { checkCategoryName } from '../src/menu/name.js';
import { checkRate } from '../src/settings/rate.js';
import {
  checkDraft,
  countsOf,
  currentValueText,
  draftOf,
  inOrder,
  kindText,
  sameDraft,
  sameName,
  valueText,
  type Draft,
} from '../src/presets/value.js';
import { ANNIVERSARY, BIRTHDAY, REGULAR, STAFF, fixed, percent, preset } from './presets-data.js';

// BO-07's three checks against the contract (PHASE1-S6b rulings 3 to 5; criterion 4) and its pure
// half: the order, the counts, the value text and the draft. The name check is BO-03's, the rate
// BO-08's and the amount BO-04's; each is held here against the schema it must agree with.

const ID = '11111111-1111-4111-8111-111111111111';

const NAMES: Array<[string, string]> = [
  ['empty', ''],
  ['spaces only', '   '],
  ['one character', 'S'],
  ['32 characters', 'x'.repeat(32)],
  ['33 characters', 'x'.repeat(33)],
  ['32 emoji', '🍽'.repeat(32)],
  ['33 emoji', '🍽'.repeat(33)],
  ['an inner tab', 'Staff\tmeal'],
  ['ESC', 'Staff\u001bmeal'],
  ['U+0007', 'Staff\u0007meal'],
  ['an inner space', 'Staff meal'],
  ['leading and trailing spaces', '  Staff meal  '],
];

describe('the name check and PresetName agree', () => {
  it.each(NAMES)('%s: accepted by the check exactly when the requests accept the trimmed name', (_what, typed) => {
    const checked = checkCategoryName(typed);
    const value = { kind: 'PERCENTAGE' as const, ratePpm: '100000' };
    const schema = PresetName.safeParse(checked.name).success;
    const refusedCreate = fieldsInError(CreatePresetRequest, { name: checked.name, value }).includes('name');
    const refusedUpdate = fieldsInError(UpdatePresetRequest, {
      presetId: ID,
      expectedVersion: 1,
      name: checked.name,
      value,
    }).includes('name');
    expect(checked.error === null, JSON.stringify(typed)).toBe(schema);
    expect(checked.error === null, JSON.stringify(typed)).toBe(!refusedCreate);
    expect(checked.error === null, JSON.stringify(typed)).toBe(!refusedUpdate);
  });

  it('sends the trimmed name, which the schema accepts once trimmed and refuses untrimmed', () => {
    const checked = checkCategoryName('  Staff meal  ');
    expect(checked).toEqual({ name: 'Staff meal', error: null });
    expect(PresetName.safeParse(checked.name).success).toBe(true);
    expect(PresetName.safeParse('  Staff meal  ').success).toBe(false);
  });

  it('counts code points: 32 emoji pass and 33 are refused, as the schema does', () => {
    expect(checkCategoryName('🍽'.repeat(32)).error).toBeNull();
    expect(checkCategoryName('🍽'.repeat(33)).error).toBe('long');
    expect(PresetName.safeParse('🍽'.repeat(32)).success).toBe(true);
    expect(PresetName.safeParse('🍽'.repeat(33)).success).toBe(false);
  });
});

describe('the percentage check, the conversion to parts per million, and RatePpm', () => {
  const CONVERSIONS: Array<[string, string]> = [
    ['10', '100000'],
    ['10%', '100000'],
    ['12,3456', '123456'],
    ['12.3456', '123456'],
    ['0', '0'],
    ['100', '1000000'],
    ['100,0000', '1000000'],
    ['0,0001', '1'],
    [',5', '5000'],
    ['5,', '50000'],
  ];

  it.each(CONVERSIONS)('typed %j sends %j, which RatePpm accepts', (typed, ppm) => {
    const checked = checkRate(typed);
    expect(checked).toEqual({ ok: true, ppm });
    expect(RatePpm.safeParse(ppm).success).toBe(true);
    const draft: Draft = { name: 'A', kind: 'PERCENTAGE', percent: typed, amount: '' };
    expect(checkDraft(draft).value).toEqual({ kind: 'PERCENTAGE', ratePpm: ppm });
  });

  it('refuses 100,0001 as over, exactly where RatePpm refuses its parts per million', () => {
    expect(checkRate('100,0001')).toEqual({ ok: false, error: 'over' });
    expect(RatePpm.safeParse('1000001').success).toBe(false);
    expect(RatePpm.safeParse('1000000').success).toBe(true);
  });

  it('refuses in the table’s order: empty, negative, format, decimals, over', () => {
    expect(checkRate('').ok).toBe(false);
    expect(checkRate('  ')).toEqual({ ok: false, error: 'empty' });
    expect(checkRate('-1')).toEqual({ ok: false, error: 'negative' });
    expect(checkRate('1.000,5')).toEqual({ ok: false, error: 'format' });
    expect(checkRate('10,50000')).toEqual({ ok: false, error: 'decimals' });
    expect(checkRate('101')).toEqual({ ok: false, error: 'over' });
  });
});

describe('the amount check and DiscountAmount', () => {
  const ACCEPTED: Array<[string, string]> = [
    ['0', '0'],
    ['5.000', '5000'],
    ['5000', '5000'],
    ['10.000', '10000'],
    ['99.999.999', '99999999'],
    ['99999999', '99999999'],
    ['007', '7'],
  ];

  it.each(ACCEPTED)('typed %j sends %j, which DiscountAmount accepts', (typed, amount) => {
    const checked = checkPrice(typed, 'base');
    expect(checked).toEqual({ value: amount, error: null });
    expect(DiscountAmount.safeParse(amount).success).toBe(true);
    const draft: Draft = { name: 'A', kind: 'FIXED', percent: '', amount: typed };
    expect(checkDraft(draft).value).toEqual({ kind: 'FIXED', amount });
  });

  it('agrees on both bounds: 0 and 99.999.999 pass, 100.000.000 is refused by both', () => {
    expect(checkPrice('100.000.000', 'base')).toEqual({ value: null, error: 'bounds' });
    expect(checkPrice('100000000', 'base')).toEqual({ value: null, error: 'bounds' });
    expect(DiscountAmount.safeParse('100000000').success).toBe(false);
    expect(DiscountAmount.safeParse('99999999').success).toBe(true);
    expect(DiscountAmount.safeParse('0').success).toBe(true);
  });

  it('refuses a minus sign, a malformed grouping and an empty field, in that order', () => {
    expect(checkPrice('', 'base').error).toBe('empty');
    expect(checkPrice('-5', 'base').error).toBe('negative');
    expect(checkPrice('1000.5', 'base').error).toBe('format');
    expect(checkPrice('1.00', 'base').error).toBe('format');
  });
});

describe('the draft', () => {
  it('validates only the selected kind: a bad percentage buffer is ignored under Fixed amount', () => {
    const draft: Draft = { name: 'Gift', kind: 'FIXED', percent: 'not a number', amount: '5.000' };
    expect(checkDraft(draft)).toEqual({
      name: 'Gift',
      nameError: null,
      percentError: null,
      amountError: null,
      value: { kind: 'FIXED', amount: '5000' },
    });
  });

  it('zero is accepted for both kinds', () => {
    expect(checkDraft({ name: 'Free', kind: 'PERCENTAGE', percent: '0', amount: '' }).value).toEqual({
      kind: 'PERCENTAGE',
      ratePpm: '0',
    });
    expect(checkDraft({ name: 'Free', kind: 'FIXED', percent: '', amount: '0' }).value).toEqual({
      kind: 'FIXED',
      amount: '0',
    });
  });

  it('an existing record opens in the words a manager types, with the other buffer empty', () => {
    expect(draftOf(BIRTHDAY)).toEqual({ name: 'Birthday', kind: 'PERCENTAGE', percent: '12,3456', amount: '' });
    expect(draftOf(ANNIVERSARY)).toEqual({ name: 'Anniversary', kind: 'FIXED', percent: '', amount: '99.999.999' });
    expect(draftOf(null)).toEqual({ name: '', kind: 'PERCENTAGE', percent: '', amount: '' });
  });

  it('is dirty by name, selected kind and selected value only', () => {
    const open = draftOf(STAFF);
    expect(sameDraft(open, { ...open })).toBe(true);
    // The unused buffer never counts.
    expect(sameDraft(open, { ...open, amount: '5.000' })).toBe(true);
    // The same value typed another way is the same value.
    expect(sameDraft(open, { ...open, percent: '50,0' })).toBe(true);
    expect(sameDraft(open, { ...open, name: 'Staff lunch' })).toBe(false);
    expect(sameDraft(open, { ...open, percent: '51' })).toBe(false);
    expect(sameDraft(open, { ...open, kind: 'FIXED', amount: '' })).toBe(false);
  });
});

describe('the list', () => {
  it('draws active first and inactive second, each group in the order the server answered, never by name', () => {
    const rows = [STAFF, REGULAR, BIRTHDAY, ANNIVERSARY];
    expect(inOrder(rows).map((p) => p.name)).toEqual(['Staff meal', 'Birthday', 'Anniversary', 'Regular customer']);
    // A deactivated first record lands in its new group by creation order, not at the end.
    const deactivated = [{ ...STAFF, isActive: false }, REGULAR, BIRTHDAY, ANNIVERSARY];
    expect(inOrder(deactivated).map((p) => p.name)).toEqual(['Birthday', 'Anniversary', 'Staff meal', 'Regular customer']);
  });

  it('counts the groups', () => {
    expect(countsOf([STAFF, REGULAR, BIRTHDAY, ANNIVERSARY])).toEqual({ active: 3, inactive: 1 });
    expect(countsOf([])).toEqual({ active: 0, inactive: 0 });
  });

  it('writes a percentage with its sign and a decimal comma, and whole rupiah with dot grouping', () => {
    expect(valueText(percent('500000'))).toBe('50%');
    expect(valueText(percent('123456'))).toBe('12,3456%');
    expect(valueText(percent('0'))).toBe('0%');
    expect(valueText(fixed('99999999'))).toBe('99.999.999');
    expect(valueText(fixed('10000'))).toBe('10.000');
    expect(currentValueText(fixed('10000'))).toBe('10.000 · IDR');
    expect(currentValueText(percent('500000'))).toBe('50%');
    expect(kindText('PERCENTAGE')).toBe('Percentage');
    expect(kindText('FIXED')).toBe('Fixed amount');
  });

  it('compares names without regard to case', () => {
    expect(sameName('staff MEAL', 'Staff meal')).toBe(true);
    expect(sameName('Staff', 'Staff meal')).toBe(false);
    expect(preset(9, 'x', percent('1')).isActive).toBe(true);
  });
});

describe('no floating point on the money path (B-1)', () => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/presets');
  for (const file of readdirSync(dir)) {
    it(`${file} calls no parseFloat, parseInt, Number(, Math.round or toFixed`, () => {
      const code = readFileSync(join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code.match(/parseFloat|parseInt|\bNumber\(|Math\.round|toFixed/g) ?? []).toEqual([]);
    });
  }
});
