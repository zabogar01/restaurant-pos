import { describe, expect, it } from 'vitest';
import { cashContribution } from '../src/closedOrders.js';
import type { Tender } from '../src/close.js';
import { refundInBook, type Book } from '../src/orderStore.js';
import { contributions, refundOrder, type RefundRefusal, type RefundRequest, type RefundableOrder } from '../src/refund.js';

// FE-032: the refund operation, the walk that fixes its defaults, and the book path
// that applies it. These prove the client's behaviour only: the in-memory stand-in
// for the server's full-refund command. They do not close any acceptance criterion
// that needs the server and PostgreSQL (ADR-002).

const AT = '2026-09-25T15:05:00.000Z';
const CARD_CASH: ReadonlyArray<Tender> = [
  { label: 'Card', amount: 100_000n },
  { label: 'Cash', amount: 55_925n },
];
const order = (over: Partial<RefundableOrder> = {}): RefundableOrder => ({ closed: true, refunded: false, total: 155_925n, tenders: CARD_CASH, ...over });
const request = (over: Partial<RefundRequest> = {}): RefundRequest => ({
  allocations: [
    { position: 0, amount: 100_000n },
    { position: 1, amount: 55_925n },
  ],
  reason: 'Wrong dish served',
  ...over,
});

describe('the walk: each tender’s effective contribution (rule 8)', () => {
  it('a cash order defaults to the cash less its change, never the note', () => {
    expect(contributions([{ label: 'Cash', amount: 200_000n }], 155_925n)).toEqual([155_925n]);
  });

  it('a card then cash with change defaults to the card’s amount and the cash tendered less the change', () => {
    expect(contributions([{ label: 'Card', amount: 1n }, { label: 'Cash', amount: 9_999_999n }], 105_000n)).toEqual([1n, 104_999n]);
  });

  it('two cash tenders of 50.000 and 150.000 on 155.925 default to 50.000 and 105.925', () => {
    expect(
      contributions(
        [
          { label: 'Cash', amount: 50_000n },
          { label: 'Cash', amount: 150_000n },
        ],
        155_925n
      )
    ).toEqual([50_000n, 105_925n]);
  });

  it('no row is negative, the rows sum to the total, and the Cash rows sum to the cash contribution', () => {
    // Each ends in Cash, the tender change is given against (FR-G4): the change is what the tenders pass the total by.
    const cases: ReadonlyArray<{ tenders: ReadonlyArray<Tender>; total: bigint }> = [
      { tenders: [{ label: 'Cash', amount: 200_000n }], total: 155_925n },
      { tenders: CARD_CASH, total: 155_925n },
      { tenders: [{ label: 'Card', amount: 1n }, { label: 'Cash', amount: 9_999_999n }], total: 105_000n },
      { tenders: [{ label: 'Cash', amount: 50_000n }, { label: 'Cash', amount: 150_000n }], total: 155_925n },
      { tenders: [{ label: 'Card', amount: 40_000n }, { label: 'Meal voucher', amount: 10_000n }, { label: 'Card', amount: 30_000n }, { label: 'Cash', amount: 200_000n }], total: 155_925n },
    ];
    for (const { tenders, total } of cases) {
      const change = tenders.reduce((a, t) => a + t.amount, 0n) - total;
      const rows = contributions(tenders, total);
      expect(rows.every((r) => r >= 0n)).toBe(true);
      expect(rows.reduce((a, b) => a + b, 0n)).toBe(total);
      const cashRows = rows.filter((_, i) => tenders[i]!.label === 'Cash').reduce((a, b) => a + b, 0n);
      expect(cashRows).toBe(cashContribution(tenders, change));
    }
  });

  it('a tender after the balance is met contributes nothing', () => {
    expect(contributions([{ label: 'Card', amount: 155_925n }, { label: 'Cash', amount: 10_000n }], 155_925n)).toEqual([155_925n, 0n]);
  });
});

describe('refundOrder: the record', () => {
  it('records the whole order, the allocations above zero in tender order, each with the tender’s position and label', () => {
    const r = refundOrder(order(), request({ allocations: [{ position: 1, amount: 55_925n }, { position: 0, amount: 100_000n }] }), AT);
    expect(r.record).toEqual({
      refundedAt: AT,
      reason: 'Wrong dish served',
      allocations: [
        { position: 0, label: 'Card', amount: 100_000n },
        { position: 1, label: 'Cash', amount: 55_925n },
      ],
      amount: 155_925n,
    });
  });

  it('has no approver, no actor and no approval flag, and never an approver of null', () => {
    const record = refundOrder(order(), request(), AT).record!;
    expect(Object.keys(record).sort()).toEqual(['allocations', 'amount', 'reason', 'refundedAt']);
    expect(JSON.stringify(record, (_, v) => (typeof v === 'bigint' ? String(v) : v))).not.toMatch(/approv|actor|null/i);
  });

  it('trims the reason', () => {
    expect(refundOrder(order(), request({ reason: '  Meal was cold \n' }), AT).record!.reason).toBe('Meal was cold');
  });

  it('discards a zero amount before the sum check, never storing it, and a repeated tender name keeps its own position', () => {
    const three: ReadonlyArray<Tender> = [{ label: 'Card', amount: 40_000n }, { label: 'Card', amount: 30_000n }, { label: 'Cash', amount: 85_925n }];
    const r = refundOrder(order({ tenders: three }), request({ allocations: [{ position: 0, amount: 0n }, { position: 1, amount: 70_000n }, { position: 2, amount: 85_925n }] }), AT);
    expect(r.record!.allocations).toEqual([
      { position: 1, label: 'Card', amount: 70_000n },
      { position: 2, label: 'Cash', amount: 85_925n },
    ]);
  });

  it('a row may exceed its tender’s contribution: only the sum is checked (O2)', () => {
    const r = refundOrder(order(), request({ allocations: [{ position: 0, amount: 0n }, { position: 1, amount: 155_925n }] }), AT);
    expect(r.record!.allocations).toEqual([{ position: 1, label: 'Cash', amount: 155_925n }]);
  });
});

describe('refundOrder: the refusals, in order, each naming itself', () => {
  const refusal = (o: RefundableOrder, r: RefundRequest) => refundOrder(o, r, AT).refused;

  it('not-closed', () => expect(refusal(order({ closed: false }), request())).toBe('not-closed'));
  it('already-refunded', () => expect(refusal(order({ refunded: true }), request())).toBe('already-refunded'));
  it('zero-total', () => expect(refusal(order({ total: 0n, tenders: [] }), request())).toBe('zero-total'));
  it('day-closed', () => expect(refusal(order(), request({ dayClosed: true }))).toBe('day-closed'));
  it('no-reason, empty and only spaces', () => {
    expect(refusal(order(), request({ reason: '' }))).toBe('no-reason');
    expect(refusal(order(), request({ reason: '   ' }))).toBe('no-reason');
  });
  it('not-a-tender: a position outside the order’s tenders, and the same position twice', () => {
    expect(refusal(order(), request({ allocations: [{ position: 0, amount: 100_000n }, { position: 2, amount: 55_925n }] }))).toBe('not-a-tender');
    expect(refusal(order(), request({ allocations: [{ position: -1, amount: 155_925n }] }))).toBe('not-a-tender');
    expect(refusal(order(), request({ allocations: [{ position: 0.5, amount: 155_925n }] }))).toBe('not-a-tender');
    expect(refusal(order(), request({ allocations: [{ position: 0, amount: 100_000n }, { position: 0, amount: 55_925n }] }))).toBe('not-a-tender');
  });
  it('invalid-amount: a negative row, even where the rest sums to the total', () => {
    expect(refusal(order(), request({ allocations: [{ position: 0, amount: 160_000n }, { position: 1, amount: -4_075n }] }))).toBe('invalid-amount');
  });
  it('sum-mismatch: short, over, and nothing allocated', () => {
    expect(refusal(order(), request({ allocations: [{ position: 0, amount: 80_000n }, { position: 1, amount: 55_925n }] }))).toBe('sum-mismatch');
    expect(refusal(order(), request({ allocations: [{ position: 0, amount: 100_000n }, { position: 1, amount: 60_925n }] }))).toBe('sum-mismatch');
    expect(refusal(order(), request({ allocations: [{ position: 0, amount: 0n }] }))).toBe('sum-mismatch');
    expect(refusal(order(), request({ allocations: [] }))).toBe('sum-mismatch');
  });

  it('reports the first that applies', () => {
    const everythingWrong = request({ allocations: [{ position: 9, amount: -1n }], reason: ' ', dayClosed: true });
    const peel: ReadonlyArray<[RefundRefusal, RefundableOrder, RefundRequest]> = [
      ['not-closed', order({ closed: false, refunded: true, total: 0n }), everythingWrong],
      ['already-refunded', order({ refunded: true, total: 0n }), everythingWrong],
      ['zero-total', order({ total: 0n }), everythingWrong],
      ['day-closed', order(), everythingWrong],
      ['no-reason', order(), { ...everythingWrong, dayClosed: false }],
      ['not-a-tender', order(), { ...everythingWrong, dayClosed: false, reason: 'x' }],
      ['invalid-amount', order(), { ...everythingWrong, dayClosed: false, reason: 'x', allocations: [{ position: 0, amount: -1n }] }],
      ['sum-mismatch', order(), { ...everythingWrong, dayClosed: false, reason: 'x', allocations: [{ position: 0, amount: 1n }] }],
    ];
    for (const [expected, o, r] of peel) expect(refusal(o, r), expected).toBe(expected);
  });

  it('a refunded order always answers already-refunded, whatever else is wrong', () => {
    expect(refusal(order({ refunded: true }), request({ allocations: [], reason: '', dayClosed: true }))).toBe('already-refunded');
  });
});

// ---------------------------------------------------------------------------
// The book path: one by-id write, all or nothing, once
// ---------------------------------------------------------------------------

const lines = [{ id: 'a', quantity: 1, name: 'Soup', amount: 100_000n, status: 'fired' as const }];
const closedEntry = (tenders: ReadonlyArray<Tender>, change = 0n) => ({
  title: 'Order · T5',
  groups: [{ kind: 'fired' as const, round: 1, firedAt: '2026-09-25T14:00:00.000Z', delivery: 'queued' as const, lines }],
  closed: { closedAt: '2026-09-25T14:30:00.000Z', tenders, change },
});
// 100.000 of Soup and the 5% service charge: a 105.000 total.
const TENDERS: ReadonlyArray<Tender> = [{ label: 'Card', amount: 60_000n }, { label: 'Cash', amount: 50_000n }];
const book = (): Book => ({
  activeId: 'table-9',
  orders: {
    'table-5': closedEntry(TENDERS, 5_000n),
    'table-9': { title: 'Order · T9', groups: [{ kind: 'pending', lines: [{ ...lines[0]!, id: 'p', status: 'pending' as const }] }] },
  },
});
const full = (position: number, amount: bigint) => ({ position, amount });
const GOOD: RefundRequest = { allocations: [full(0, 60_000n), full(1, 45_000n)], reason: 'Charged in error' };

describe('refundInBook', () => {
  it('writes one field on one order: the record, with the order’s lines, totals, tenders and change untouched', () => {
    const before = book();
    const { book: after, result } = refundInBook(before, 'table-5', GOOD, AT);
    expect(result.record).toEqual({
      refundedAt: AT,
      reason: 'Charged in error',
      allocations: [
        { position: 0, label: 'Card', amount: 60_000n },
        { position: 1, label: 'Cash', amount: 45_000n },
      ],
      amount: 105_000n,
    });
    const held = after.orders['table-5']!;
    expect(held.refunded).toBe(result.record);
    expect(held.closed).toBe(before.orders['table-5']!.closed);
    expect(held.groups).toBe(before.orders['table-5']!.groups);
    expect({ ...held, refunded: undefined }).toEqual({ ...before.orders['table-5']!, refunded: undefined });
    expect(after.orders['table-9']).toBe(before.orders['table-9']);
    expect(after.activeId).toBe('table-9');
    // The input is not mutated.
    expect(before.orders['table-5']!.refunded).toBeUndefined();
  });

  it('a refusal returns the same book object, for each refusal the book can reach', () => {
    const b = book();
    const cases: ReadonlyArray<[RefundRefusal, string, RefundRequest]> = [
      ['unknown-order', 'table-77', GOOD],
      ['not-closed', 'table-9', GOOD],
      ['day-closed', 'table-5', { ...GOOD, dayClosed: true }],
      ['no-reason', 'table-5', { ...GOOD, reason: ' ' }],
      ['not-a-tender', 'table-5', { ...GOOD, allocations: [full(0, 60_000n), full(0, 45_000n)] }],
      ['invalid-amount', 'table-5', { ...GOOD, allocations: [full(0, 110_000n), full(1, -5_000n)] }],
      ['sum-mismatch', 'table-5', { ...GOOD, allocations: [full(0, 60_000n), full(1, 40_000n)] }],
    ];
    for (const [expected, id, r] of cases) {
      const out = refundInBook(b, id, r, AT);
      expect(out.result.refused, expected).toBe(expected);
      expect(out.book, expected).toBe(b);
    }
  });

  it('once only: a second refund answers already-refunded, returns the same book, and the first record stands', () => {
    const first = refundInBook(book(), 'table-5', GOOD, AT);
    const second = refundInBook(first.book, 'table-5', { ...GOOD, reason: 'Another reason', allocations: [full(1, 105_000n)] }, '2026-09-25T16:00:00.000Z');
    expect(second.result.refused).toBe('already-refunded');
    expect(second.book).toBe(first.book);
    expect(second.book.orders['table-5']!.refunded).toBe(first.result.record);
  });

  it('a zero-total order refuses with zero-total', () => {
    const b: Book = { activeId: 'x', orders: { x: { ...closedEntry([]), groups: [] } } };
    expect(refundInBook(b, 'x', GOOD, AT).result.refused).toBe('zero-total');
  });
});
