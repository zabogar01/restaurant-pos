import { describe, expect, it } from 'vitest';
import { closeOrder, closeRefusal } from '../src/close.js';
import type { OrderLine, RoundGroup } from '../src/orderFixtures.js';
import { settlementPosition } from '../src/tender.js';

// FE-027 rule 1: the pure close. Refusals are `closeRefusal`'s own; nothing here re-decides them.

const line = (id: string, status: OrderLine['status'], amount = 100_000n): OrderLine => ({ id, quantity: 1, name: id, amount, status });
const fired = (round: number, ...lines: OrderLine[]): RoundGroup => ({ kind: 'fired', round, firedAt: '19:00', delivery: 'queued', lines });
const AT = '2026-09-25T19:42:00.000Z';
const draft = (label: string, amount: bigint) => ({ id: `d-${label}-${amount}`, label, amount });

const paidTable = { groups: [fired(1, line('a', 'fired'))], total: 173_250n };

describe('closeOrder', () => {
  it('closes on an exact card tender', () => {
    const r = closeOrder(paidTable, [draft('Card', 173_250n)], AT);
    expect(r.refused).toBeUndefined();
    expect(r.closed).toMatchObject({ status: 'closed', closedAt: AT, total: 173_250n, change: 0n });
    expect(r.closed!.tenders).toEqual([{ label: 'Card', amount: 173_250n }]);
  });

  it('cash over-tender: tenders are as keyed, change is derived, the recorded total is the order total (B-6)', () => {
    const r = closeOrder(paidTable, [draft('Cash', 200_000n)], AT);
    expect(r.closed!.tenders).toEqual([{ label: 'Cash', amount: 200_000n }]);
    expect(r.closed!.change).toBe(26_750n);
    expect(r.closed!.total).toBe(173_250n);
    expect(r.closed!.change).toBe(settlementPosition(173_250n, [200_000n]).change);
  });

  it('split tender keeps every draft, in order', () => {
    const r = closeOrder(paidTable, [draft('Card', 100_000n), draft('Cash', 100_000n)], AT);
    expect(r.closed!.tenders.map((t) => t.label)).toEqual(['Card', 'Cash']);
    expect(r.closed!.change).toBe(26_750n);
  });

  it('a zero-total order closes with no tenders', () => {
    const r = closeOrder({ groups: [fired(1, line('a', 'fired', 0n))], total: 0n }, [], AT);
    expect(r.closed).toMatchObject({ status: 'closed', total: 0n, change: 0n, tenders: [] });
  });

  it('a quick sale’s pending lines become one queued round at close (FR-E5)', () => {
    const r = closeOrder(
      { type: 'quick_sale', groups: [{ kind: 'pending', lines: [line('a', 'pending'), line('b', 'pending')] }], total: 200_000n },
      [draft('Card', 200_000n)],
      AT
    );
    expect(r.closed!.groups).toHaveLength(1);
    expect(r.closed!.groups[0]).toMatchObject({ kind: 'fired', round: 1, firedAt: AT, delivery: 'queued' });
    expect(r.closed!.groups[0]!.lines.map((l) => l.status)).toEqual(['fired', 'fired']);
  });

  it('a table order closes with its groups unchanged', () => {
    expect(closeOrder(paidTable, [draft('Card', 173_250n)], AT).closed!.groups).toBe(paidTable.groups);
  });

  describe('refusals', () => {
    const pendingTable = { groups: [fired(1, line('a', 'fired')), { kind: 'pending', lines: [line('p', 'pending')] } as RoundGroup], total: 100_000n };

    it('a table order with a pending line', () => {
      const r = closeOrder(pendingTable, [draft('Card', 100_000n)], AT);
      expect(r.closed).toBeUndefined();
      expect(r.refused).toMatchObject({ reason: 'pending' });
    });

    it('a balance outstanding', () => {
      expect(closeOrder(paidTable, [draft('Card', 100_000n)], AT).refused).toEqual({ reason: 'balance' });
      expect(closeOrder(paidTable, [], AT).refused).toEqual({ reason: 'balance' });
    });

    it('locked (another client’s lease)', () => {
      expect(closeOrder({ ...paidTable, locked: true }, [draft('Card', 173_250n)], AT).refused).toEqual({ reason: 'locked' });
    });

    it('is closeRefusal’s own answer, never a second copy of the rules', () => {
      const cases = [
        { order: paidTable, drafts: [173_250n] },
        { order: paidTable, drafts: [100_000n] },
        { order: pendingTable, drafts: [100_000n] },
        { order: pendingTable, drafts: [] },
        { order: { type: 'quick_sale' as const, groups: [{ kind: 'pending', lines: [line('p', 'pending')] } as RoundGroup], total: 100_000n }, drafts: [100_000n] },
        { order: { groups: [] as RoundGroup[], total: 0n }, drafts: [] },
      ];
      for (const { order, drafts } of cases) {
        const expected = closeRefusal(order, settlementPosition(order.total, drafts));
        const r = closeOrder(order, drafts.map((a) => draft('Card', a)), AT);
        expect(r.refused).toEqual(expected);
        expect(r.closed === undefined).toBe(expected !== undefined);
      }
    });
  });
});
