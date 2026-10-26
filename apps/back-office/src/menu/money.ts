import { decodeMoney } from '@pos/money';

// A price on screen. This installation is IDR at minor-unit precision 0, so one minor unit is
// one rupiah and the bigint goes to Intl exactly as it is, never through a double (B-1). No
// currency symbol: the column header says IDR. A test scans this folder for floating point.
const idr = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** The stored tax-inclusive base price, as whole rupiah with dot grouping. */
export const priceText = (price: string): string => idr.format(decodeMoney(price));
