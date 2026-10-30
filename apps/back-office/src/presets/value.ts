import type { PresetValue, PresetView } from '@pos/contracts';
import { checkPrice, type PriceError } from '../item/price.js';
import { priceText } from '../menu/money.js';
import { checkCategoryName, type NameError } from '../menu/name.js';
import { checkRate, percentText, type RateError } from '../settings/rate.js';
import { KIND_FIXED, KIND_PERCENTAGE } from './copy.js';

// BO-07's pure half: the draft the form holds, the checks it makes, how the list is ordered and
// counted, and how a value reads. A preset's value is a percentage (typed as a percent, converted
// to parts per million by `settings/rate.ts`) or a fixed amount (whole rupiah, by `item/price.ts`);
// nothing here reads a number from text, so no float touches money (B-1).

export type Kind = PresetValue['kind'];

/**
 * What the form holds: the name, the selected kind, and one typed buffer per kind (DESIGN.md,
 * "Switching between value kinds"). The buffer of the kind not selected keeps its text, and a
 * kind never starts from the other's: the first visit shows it empty.
 */
export interface Draft {
  name: string;
  kind: Kind;
  percent: string;
  amount: string;
}

/** The draft of an existing record, in the words a manager types; a new preset starts empty. */
export function draftOf(row: PresetView | null): Draft {
  if (row === null) return { name: '', kind: 'PERCENTAGE', percent: '', amount: '' };
  const { value } = row;
  return value.kind === 'PERCENTAGE'
    ? { name: row.name, kind: 'PERCENTAGE', percent: percentText(value.ratePpm), amount: '' }
    : { name: row.name, kind: 'FIXED', percent: '', amount: priceText(value.amount) };
}

export interface Checked {
  /** The trimmed name, which is what a request sends. */
  name: string;
  nameError: NameError | null;
  /** The selected kind's error; the other kind's buffer is never looked at. */
  percentError: RateError | null;
  amountError: PriceError | null;
  /** The value to send, or null while anything about it is refused. */
  value: PresetValue | null;
}

export function checkDraft(draft: Draft): Checked {
  const { name, error: nameError } = checkCategoryName(draft.name);
  if (draft.kind === 'PERCENTAGE') {
    const rate = checkRate(draft.percent);
    return {
      name,
      nameError,
      percentError: rate.ok ? null : rate.error,
      amountError: null,
      value: rate.ok ? { kind: 'PERCENTAGE', ratePpm: rate.ppm } : null,
    };
  }
  const price = checkPrice(draft.amount, 'base');
  return {
    name,
    nameError,
    percentError: null,
    amountError: price.error,
    value: price.error === null ? { kind: 'FIXED', amount: price.value } : null,
  };
}

/** The selected value as the draft compares it: the canonical value if it parses, else what was typed. */
function valueKey(draft: Draft): string {
  if (draft.kind === 'PERCENTAGE') {
    const rate = checkRate(draft.percent);
    return `P:${rate.ok ? rate.ppm : draft.percent.trim()}`;
  }
  const price = checkPrice(draft.amount, 'base');
  return `F:${price.error === null ? price.value : draft.amount.trim()}`;
}

/** Dirty compares the name, the selected kind and the selected value only; the unused buffer never counts. */
export const sameDraft = (a: Draft, b: Draft): boolean => a.name.trim() === b.name.trim() && valueKey(a) === valueKey(b);

/**
 * The rows as the table draws them: active first, inactive second, each group in the order the
 * server answered (creation order). Never sorted by name. The rows themselves stay in server
 * order, so a renamed record keeps its place and a deactivated one appears in its new group at
 * the position its creation gives it.
 */
export const inOrder = (rows: readonly PresetView[]): PresetView[] => [
  ...rows.filter((row) => row.isActive),
  ...rows.filter((row) => !row.isActive),
];

export const countsOf = (rows: readonly PresetView[]): { active: number; inactive: number } => {
  const active = rows.filter((row) => row.isActive).length;
  return { active, inactive: rows.length - active };
};

export const kindText = (kind: Kind): string => (kind === 'PERCENTAGE' ? KIND_PERCENTAGE : KIND_FIXED);

/** A value in the list: a percentage with its sign, or whole rupiah with dot grouping. */
export const valueText = (value: PresetValue): string =>
  value.kind === 'PERCENTAGE' ? `${percentText(value.ratePpm)}%` : priceText(value.amount);

/** A value beside a stale draft: a fixed amount names its currency. */
export const currentValueText = (value: PresetValue): string =>
  value.kind === 'PERCENTAGE' ? valueText(value) : `${valueText(value)} · IDR`;

export const sameValue = (a: PresetValue, b: PresetValue): boolean =>
  a.kind === 'PERCENTAGE' ? b.kind === 'PERCENTAGE' && a.ratePpm === b.ratePpm : b.kind === 'FIXED' && a.amount === b.amount;

/** Active names are unique without regard to case, as the server's index is. */
export const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
