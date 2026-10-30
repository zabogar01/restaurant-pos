// The preset records the BO-07 tests share, with no DOM and no screen in reach, so a pure test
// can import them.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export type Value = { kind: 'PERCENTAGE'; ratePpm: string } | { kind: 'FIXED'; amount: string };
export interface Preset {
  presetId: string;
  name: string;
  value: Value;
  isActive: boolean;
}

export const percent = (ratePpm: string): Value => ({ kind: 'PERCENTAGE', ratePpm });
export const fixed = (amount: string): Value => ({ kind: 'FIXED', amount });

export const preset = (n: number, name: string, value: Value, isActive = true): Preset => ({
  presetId: id(n),
  name,
  value,
  isActive,
});

// Created in this order: Staff meal, Regular customer (inactive), Birthday, Anniversary.
export const STAFF = preset(1, 'Staff meal', percent('500000'));
export const REGULAR = preset(2, 'Regular customer', fixed('10000'), false);
export const BIRTHDAY = preset(3, 'Birthday', percent('123456'));
export const ANNIVERSARY = preset(4, 'Anniversary', fixed('99999999'));

export const PRESETS = [STAFF, REGULAR, BIRTHDAY, ANNIVERSARY];
