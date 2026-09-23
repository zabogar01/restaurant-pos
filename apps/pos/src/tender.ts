import type { Money } from '@pos/money';

export type TenderMethod = 'cash' | 'card';

/**
 * The one gate for adding a drafted tender. F3a deliberately gives both
 * methods the same ceiling; F3b extends this answer when cash may exceed the
 * balance and card may not. Components do not carry a second copy of it.
 */
export function mayAddTender(method: TenderMethod, amount: Money, balance: Money): boolean {
  void method;
  return amount > 0n && amount <= balance;
}
