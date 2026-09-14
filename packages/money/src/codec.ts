export type Money = bigint;

// Canonical: optional leading '-', then '0' alone or a digit string with no
// leading zero. JSON has no bigint, so money crosses the wire as this string.
const CANONICAL = /^(0|-?[1-9][0-9]*)$/;

export function encodeMoney(m: Money): string {
  return m.toString(10);
}

export function decodeMoney(s: string): Money {
  if (typeof s !== 'string' || !CANONICAL.test(s)) {
    throw new Error(`invalid money: ${JSON.stringify(s)}`);
  }
  return BigInt(s);
}
