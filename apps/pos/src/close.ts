import type { Money } from '@pos/money';
import { orderVariant, type OrderLine, type OrderVariant, type RoundGroup } from './orderFixtures.js';

/**
 * The order shape `closeRefusal` needs: enough to read the type (FR-G10) and
 * every line's status. `ShownOrder` satisfies this without importing it,
 * keeping this module dependent only on `orderFixtures.ts`, as `tender.ts` is.
 */
export type CloseableOrder = { type?: OrderVariant; groups: ReadonlyArray<RoundGroup> };

export type CloseRefusal =
  | { reason: 'pending'; lines: ReadonlyArray<OrderLine> }
  | { reason: 'balance' };

/**
 * Whether the order may close, and why not (FR-G10, F3a's balance rule). A
 * table order refuses while any line is PENDING — read through `orderVariant`,
 * never `order.type === 'table'` directly, because the field defaults through
 * that function and a bare comparison would silently pass every table fixture
 * that omits it (rule 2's trap). A quick sale's lines are PENDING by nature
 * (F2d, FR-E5) and never block on that account.
 *
 * `pending` is checked first: at a zero-total table order still carrying a
 * pending line, the balance is already zero, so the balance check alone would
 * let it close (rule 5's ruling — FR-G10 wins where the two meet).
 */
export function closeRefusal(order: CloseableOrder, position: { balance: Money }): CloseRefusal | undefined {
  if (orderVariant(order) === 'table') {
    const pending = order.groups.flatMap((g) => g.lines).filter((line) => line.status === 'pending');
    if (pending.length > 0) return { reason: 'pending', lines: pending };
  }
  if (position.balance > 0n) return { reason: 'balance' };
  return undefined;
}
