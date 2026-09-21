import { RATE_SCALE, mulRate, rateFromPercent, taxIncludedIn, type Money } from '@pos/money';
import { formatAmount } from './money.js';
import type { Adjustment, Totals } from './orderFixtures.js';

// The discount rules the POS draws from (FR-F1–F8, B-8, B-21, B-22). Pure: no
// component, no fixture, no state. The sheets ask this module; they never
// decide a gate or a figure themselves.

/** FR-F4's "kind": a percentage of the subtotal, or a fixed amount off it. */
export type DiscountValue = { kind: 'percent'; percent: string } | { kind: 'fixed'; amount: Money };

/** A preset is manager-defined and applied without approval (FR-F2); free-form is typed in and gated (FR-F3). */
export type DiscountSource = 'preset' | 'free-form';

/**
 * What an order carries (FR-F4, B-8): the name, kind and value, copied onto
 * the order when the discount was applied. Everything on screen and every
 * figure is read from here. `presetId` is a reference to live configuration,
 * for reporting only (B-8): nothing in the POS reads it, so a preset edited or
 * deactivated after it was applied (FR-F5) changes nothing an order shows.
 */
export type DiscountSnapshot = {
  source: DiscountSource;
  name: string;
  value: DiscountValue;
  presetId?: string;
};

/** A manager-defined preset as the back office holds it. Deactivated presets leave the picker (FR-F5). */
export type Preset = { id: string; name: string; value: DiscountValue; active: boolean };

export function snapshotOf(preset: Preset): DiscountSnapshot {
  return { source: 'preset', name: preset.name, value: preset.value, presetId: preset.id };
}

/**
 * FR-F8's whole-transition gate, and FR-F2/F3 for an order with nothing
 * applied. It decides from what the order carries now and what would replace
 * it — never from which sheet or button the cashier is standing on:
 *
 *   applied    change          manager?
 *   none       → preset        no   (FR-F2)
 *   none       → free-form     yes  (FR-F3)
 *   preset     → preset        no
 *   preset     remove          no
 *   preset     → free-form     yes
 *   free-form  → preset        yes  (even though a preset alone is ungated)
 *   free-form  remove          yes
 *   free-form  → free-form     yes
 *
 * One discount per order (B-22), so choosing a discount while one is applied
 * is always a replace and always comes through here.
 */
export function needsManager(applied: DiscountSnapshot | undefined, change: { source: DiscountSource } | 'remove'): boolean {
  if (change === 'remove' && !applied) throw new Error('there is no discount to remove');
  if (applied?.source === 'free-form') return true;
  return change !== 'remove' && change.source === 'free-form';
}

/**
 * The amount a discount takes off a subtotal, as a positive bigint. A percent
 * goes through the money package's exact rate arithmetic and rounds half-up
 * once (FR-M3); it never passes through a float. A fixed amount is capped at
 * the subtotal, so no order reaches a negative total (FR-M5).
 */
export function discountAmount(subtotal: Money, value: DiscountValue): Money {
  if (value.kind === 'fixed') {
    if (value.amount < 0n) throw new Error('a discount is never negative');
    return value.amount > subtotal ? subtotal : value.amount;
  }
  const rate = rateFromPercent(value.percent);
  if (rate > RATE_SCALE) throw new Error('a discount is at most 100%');
  return mulRate(subtotal, rate);
}

/** "10%", "50.000 off": the value as the artifact's picker sets it. */
export function valueText(value: DiscountValue): string {
  return value.kind === 'percent' ? `${value.percent}%` : `${formatAmount(value.amount)} off`;
}

/** "Staff meal — 10%": a discount as the picker and the change sheet name it. */
export function discountName(d: { name: string; value: DiscountValue }): string {
  return `${d.name} — ${valueText(d.value)}`;
}

/** "Staff meal 10%": a discount as the order's totals name it. */
export function totalsLabel(d: { name: string; value: DiscountValue }): string {
  return `${d.name} ${valueText(d.value)}`;
}

// The installation's two rates, as the artifact's totals label them. Parsed
// from strings, digit by digit (B-1).
const SERVICE_CHARGE = { label: 'Service charge 5%', rate: rateFromPercent('5') };
const TAX = { label: 'Includes tax 10%', rate: rateFromPercent('10') };

/**
 * The PRD's order of operations (FR-M4, and the worked example): discount,
 * then the discounted subtotal D, then tax contained in D (display only) and
 * the service charge on D, and total = D + service charge. Each step rounds
 * half-up once, in @pos/money.
 *
 * Display only. Pricing is the server's; this reproduces the artifact's own
 * figures so that a state the artifact never drew — a free-form discount on
 * this order, a comp of it — is drawn with the same arithmetic rather than a
 * number typed in by hand. test/discount.test.tsx holds it to the artifact's
 * figures and to AC-4.
 */
export function orderTotals(subtotal: Money, discount?: DiscountSnapshot): Totals {
  const off = discount ? discountAmount(subtotal, discount.value) : 0n;
  const d = subtotal - off;
  const service = mulRate(d, SERVICE_CHARGE.rate);
  const adjustment: Adjustment | undefined = discount && { label: totalsLabel(discount), amount: -off };
  return {
    subtotal,
    ...(adjustment && { discount: adjustment }),
    serviceCharge: { label: SERVICE_CHARGE.label, amount: service },
    total: d + service,
    taxIncluded: { label: TAX.label, amount: taxIncludedIn(d, TAX.rate) },
  };
}

/** What the cashier has typed on the free-form sheet. Text until it is parsed, never a number. */
export type FreeFormEntry = { kind: DiscountValue['kind']; text: string };

export type Parsed = { ok: true; value: DiscountValue } | { ok: false; message: string };

const WHOLE_AMOUNT = /^(0|[1-9][0-9]*)$/;

/**
 * FR-M5's bounds on a typed discount: 0–100% at one part per million, or a
 * whole amount no greater than the subtotal. A percent is parsed by
 * rateFromPercent, which takes the string as typed; an amount by BigInt, which
 * is exact. Neither goes near a double.
 */
export function parseFreeForm(entry: FreeFormEntry, subtotal: Money): Parsed {
  const text = entry.text.trim();
  if (entry.kind === 'percent') {
    let rate: bigint;
    try {
      rate = rateFromPercent(text);
    } catch {
      return { ok: false, message: PERCENT_RULE };
    }
    return rate > RATE_SCALE ? { ok: false, message: PERCENT_RULE } : { ok: true, value: { kind: 'percent', percent: text } };
  }
  if (!WHOLE_AMOUNT.test(text)) return { ok: false, message: amountRule(subtotal) };
  const amount = BigInt(text);
  return amount > subtotal ? { ok: false, message: amountRule(subtotal) } : { ok: true, value: { kind: 'fixed', amount } };
}

// PROVISIONAL COPY. The artifact draws the free-form sheet holding a valid 15%
// and never a refused value, so these have no reviewed wording. Each names the
// rule and the limit, as A7's invalid-field state asks (frost-states.css §2).
const PERCENT_RULE = 'Enter a percentage from 0 to 100.';
const amountRule = (subtotal: Money) => `Enter a whole amount from 0 to ${formatAmount(subtotal)}.`;
