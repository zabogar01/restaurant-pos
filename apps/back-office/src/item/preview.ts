import { checkPrice } from './price.js';

// The per-variant price without modifiers (PHASE1-S4c2b ruling 6; DESIGN-020, "The computed
// price"): the base price plus the variant's change, floored at zero. The sum is BigInt on the
// canonical strings, never a double (B-1). It is display only and is never sent. A sum above the
// largest line total, 99.999.999, is noted and never refused (Q2).

const LARGEST_LINE_TOTAL = 99_999_999n;

export type Preview =
  | { kind: 'sum'; price: string }
  | { kind: 'floor' }
  | { kind: 'over'; price: string }
  | { kind: 'unknown' };

export function previewOf(basePrice: string, change: string): Preview {
  const base = checkPrice(basePrice, 'base');
  const delta = checkPrice(change, 'variant');
  if (base.error !== null || delta.error !== null) return { kind: 'unknown' };
  const sum = BigInt(base.value) + BigInt(delta.value);
  if (sum < 0n) return { kind: 'floor' };
  if (sum > LARGEST_LINE_TOTAL) return { kind: 'over', price: sum.toString() };
  return { kind: 'sum', price: sum.toString() };
}
