import { describe, expect, it } from 'vitest';
import { fireOrder } from '../src/fire.js';
import type { OrderLine, RoundGroup } from '../src/orderFixtures.js';

// FE-022, ARCH-002 §3: the fire as a pure transition. T-1..T-8 are criteria
// 1..8 here, each its own test, each with the red case it would catch.

const line = (id: string, status: OrderLine['status'], over: Partial<OrderLine> = {}): OrderLine => ({
  id,
  quantity: 1,
  name: id,
  itemId: id,
  amount: 10_000n,
  status,
  ...over,
});

const fired = (round: number, lines: OrderLine[], delivery: 'printed' | 'queued' | null = 'printed'): RoundGroup => ({
  kind: 'fired',
  round,
  firedAt: '19:00',
  delivery,
  lines,
});
const pending = (lines: OrderLine[]): RoundGroup => ({ kind: 'pending', lines });

const OPEN = { type: 'table' as const, unavailable: [] as string[], locked: false, firedAt: '20:14' };

const base = (): RoundGroup[] => [
  fired(1, [line('burger', 'fired')]),
  fired(2, [line('soda', 'fired')]),
  pending([line('steak', 'pending'), line('fries', 'pending', { quantity: 2, amount: 80_000n })]),
];

const sum = (groups: ReadonlyArray<RoundGroup>) =>
  groups.flatMap((g) => g.lines).filter((l) => l.status !== 'voided').reduce((s, l) => s + l.amount, 0n);

describe('fireOrder', () => {
  // Red case: a round numbered by group count, by a constant, or by the
  // pending group's position; lines reordered; a pending group left behind.
  it('T-1: the new round is max round + 1, holds exactly the pending lines in order as fired, sits last, and the pending group is gone', () => {
    const result = fireOrder(base(), OPEN);
    expect(result.refused).toBeUndefined();
    expect(result.groups.map((g) => g.kind)).toEqual(['fired', 'fired', 'fired']);
    const last = result.groups[2]!;
    expect(last.kind === 'fired' && last.round).toBe(3);
    expect(last.lines.map((l) => [l.id, l.status])).toEqual([
      ['steak', 'fired'],
      ['fries', 'fired'],
    ]);
    expect(result.groups.some((g) => g.kind === 'pending')).toBe(false);
  });

  it('T-1: numbers from a gap-free maximum, not a count, and starts at 1 when nothing was fired', () => {
    const skipped = fireOrder([fired(4, [line('a', 'fired')]), pending([line('b', 'pending')])], OPEN);
    expect(skipped.groups.map((g) => (g.kind === 'fired' ? g.round : 0))).toEqual([4, 5]);
    const first = fireOrder([pending([line('b', 'pending')])], OPEN);
    expect(first.groups.map((g) => (g.kind === 'fired' ? g.round : 0))).toEqual([1]);
  });

  // Red case: a fire of an order with nothing pending appends an empty round,
  // or returns a fresh array so a second press changes identity.
  it('T-2: with nothing pending it refuses "nothing" and returns the very same groups', () => {
    const groups = [fired(1, [line('burger', 'fired')])];
    const result = fireOrder(groups, OPEN);
    expect(result.refused).toBe('nothing');
    expect(result.groups).toBe(groups);
    const empty: RoundGroup[] = [];
    expect(fireOrder(empty, OPEN).groups).toBe(empty);
  });

  it('T-2: a pending group holding no line is nothing, never an empty round', () => {
    const groups = [fired(1, [line('burger', 'fired')]), pending([])];
    const result = fireOrder(groups, OPEN);
    expect(result.refused).toBe('nothing');
    expect(result.groups).toBe(groups);
  });

  // Red case: the check lives only in the panel, so a caller that skips it
  // (a stale render, a second press) fires an 86'd item.
  it('T-3: a pending 86’d line refuses inside the transition, groups unchanged (B-17, B-20)', () => {
    const groups = base();
    const result = fireOrder(groups, { ...OPEN, unavailable: ['steak'] });
    expect(result.refused).toMatchObject({ names: ['steak'] });
    expect(result.groups).toBe(groups);
  });

  it('T-3: a FIRED 86’d line never blocks', () => {
    const result = fireOrder(base(), { ...OPEN, unavailable: ['burger'] });
    expect(result.refused).toBeUndefined();
  });

  // Red case: lock or quick sale ignored because the panel usually hides the control.
  it('T-4: a lock refuses, groups unchanged (FR-G12, FR-G13)', () => {
    const groups = base();
    const result = fireOrder(groups, { ...OPEN, locked: true });
    expect(result.refused).toBe('locked');
    expect(result.groups).toBe(groups);
  });

  it('T-4: a quick sale refuses, groups unchanged (FR-E5, C-2)', () => {
    const groups = [pending([line('a', 'pending')])];
    const result = fireOrder(groups, { ...OPEN, type: 'quick_sale' });
    expect(result.refused).toBe('quick_sale');
    expect(result.groups).toBe(groups);
  });

  // Red case: a fire that reprices, drops a voided line, or re-sums.
  it('T-5: amounts and the order total are unchanged, and a voided line survives', () => {
    const groups: RoundGroup[] = [
      fired(1, [line('salad', 'voided', { amount: 75_000n }), line('burger', 'fired', { amount: 135_000n })]),
      pending([line('steak', 'pending', { amount: 240_000n })]),
    ];
    const result = fireOrder(groups, OPEN);
    expect(sum(result.groups)).toBe(sum(groups));
    expect(result.groups.flatMap((g) => g.lines).map((l) => [l.id, l.amount])).toEqual([
      ['salad', 75_000n],
      ['burger', 135_000n],
      ['steak', 240_000n],
    ]);
    expect(result.groups[0]!.lines[0]!.status).toBe('voided');
  });

  // Red case: the module stamps its own clock.
  it('T-6: firedAt is the argument exactly as given', () => {
    for (const firedAt of ['20:14', '23:59', 'not a time']) {
      const last = fireOrder(base(), { ...OPEN, firedAt }).groups.at(-1)!;
      expect(last.kind === 'fired' && last.firedAt).toBe(firedAt);
    }
  });

  // Red case: a live fire claims paper (`printed`) or a false emergency.
  it('T-7: the new round is queued', () => {
    const last = fireOrder(base(), OPEN).groups.at(-1)!;
    expect(last.kind === 'fired' && last.delivery).toBe('queued');
  });

  // Red case: the second fire re-sends round 3's lines, or merges into it.
  it('T-8: lines added after a fire form a new pending group and the next fire makes round n+1 with only them', () => {
    const afterFirst = fireOrder(base(), OPEN).groups;
    const withAdd = [...afterFirst, pending([line('coffee', 'pending')])];
    const second = fireOrder(withAdd, { ...OPEN, firedAt: '20:30' }).groups;
    expect(second).toHaveLength(4);
    const last = second[3]!;
    expect(last.kind === 'fired' && last.round).toBe(4);
    expect(last.lines.map((l) => l.id)).toEqual(['coffee']);
    expect(second[2]).toEqual(afterFirst[2]);
  });

  it('does not mutate its input', () => {
    const groups = base();
    const snapshot = structuredClone(groups);
    fireOrder(groups, OPEN);
    expect(groups).toEqual(snapshot);
  });

  it('leaves earlier rounds’ delivery alone, null included', () => {
    const groups = [fired(1, [line('a', 'fired')], null), pending([line('b', 'pending')])];
    const result = fireOrder(groups, OPEN);
    expect(result.groups[0]).toBe(groups[0]);
  });
});
