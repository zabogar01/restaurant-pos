import type { Money } from '@pos/money';

// Money on screen. This installation is IDR at minor-unit precision 0 (FR-M1,
// Phase 0 plan), so one minor unit is one rupiah and the bigint goes to Intl
// exactly as it is. Never through Number(): a double rounds anything past 2^53,
// so 9007199254740993 would render as …992 — B-1 broken on the way to the
// glass. test/money-display.test.ts fails on Number( anywhere in src.
//
// No currency symbol: the reviewed artifact (frost/pos/order.html) sets every
// amount as a bare grouped figure. A negative amount takes the minus sign the
// artifact draws (U+2212), not a hyphen.
const idr = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatAmount(m: Money): string {
  return m < 0n ? `−${idr.format(-m)}` : idr.format(m);
}
