import { describe, expect, it } from 'vitest';
import {
  cashCeilingBoundByChangeLimit,
  mayAddTender,
  settlementPosition,
  tenderMaximum,
  type TenderMethod,
} from '../src/tender.js';

describe('mayAddTender', () => {
  it.each(['cash', 'card'] as const)('%s accepts a positive amount at or below the balance', (method) => {
    expect(mayAddTender(method, 1n, 155_925n)).toBe(true);
    expect(mayAddTender(method, 100_000n, 155_925n)).toBe(true);
    expect(mayAddTender(method, 155_925n, 155_925n)).toBe(true);
  });

  it('cash refuses zero and a negative amount', () => {
    expect(mayAddTender('cash', 0n, 155_925n)).toBe(false);
    expect(mayAddTender('cash', -1n, 155_925n)).toBe(false);
  });

  it('card refuses zero, a negative amount, and an amount over the balance', () => {
    expect(mayAddTender('card', 0n, 155_925n)).toBe(false);
    expect(mayAddTender('card', -1n, 155_925n)).toBe(false);
    expect(mayAddTender('card', 155_926n, 155_925n)).toBe(false);
  });

  it('cash accepts more than the balance, up to the change-limited ceiling (FR-G4)', () => {
    expect(mayAddTender('cash', 155_926n, 155_925n)).toBe(true);
    expect(mayAddTender('cash', 200_000n, 155_925n)).toBe(true);
    expect(mayAddTender('cash', 10_055_924n, 55_925n)).toBe(true);
    expect(mayAddTender('cash', 10_055_925n, 55_925n)).toBe(false);
  });

  // Exhaustive by construction (AC-10): `satisfies Record<TenderMethod, true>`
  // fails to typecheck the moment TenderMethod grows a member this object
  // doesn't list, so nobody has to remember to extend an array by hand.
  const METHODS = { cash: true, card: true } satisfies Record<TenderMethod, true>;
  const NON_CASH_METHODS = (Object.keys(METHODS) as TenderMethod[]).filter((method) => method !== 'cash');

  it.each(NON_CASH_METHODS)('%s is capped at the balance by default, never uncapped (B-5)', (method) => {
    expect(tenderMaximum(method, 155_925n)).toBe(155_925n);
    expect(mayAddTender(method, 155_925n, 155_925n)).toBe(true);
    expect(mayAddTender(method, 155_926n, 155_925n)).toBe(false);
  });
});

describe('tenderMaximum', () => {
  it('caps cash at the balance plus the 9,999,999 change limit', () => {
    expect(tenderMaximum('cash', 55_925n)).toBe(10_055_924n);
  });

  it.each(['cash', 'card'] as const)('%s is zero at zero balance — nothing is left to add', (method) => {
    expect(tenderMaximum(method, 0n)).toBe(0n);
    expect(mayAddTender(method, 1n, 0n)).toBe(false);
    expect(mayAddTender(method, 9_999_999n, 0n)).toBe(false);
  });

  it('caps cash at the 99,999,999 single-tender limit once the change limit would exceed it', () => {
    // 95,000,000 + 9,999,999 = 104,999,999 — over the single-tender cap.
    expect(tenderMaximum('cash', 95_000_000n)).toBe(99_999_999n);
    expect(tenderMaximum('cash', 95_000_000n)).not.toBe(104_999_999n);
  });

  it('is exact to one unit at the boundary where the two caps meet', () => {
    // balance + change limit === single-tender limit exactly at 90,000,000.
    expect(tenderMaximum('cash', 90_000_000n)).toBe(99_999_999n);
    expect(tenderMaximum('cash', 90_000_001n)).toBe(99_999_999n);
  });
});

describe('cashCeilingBoundByChangeLimit', () => {
  it('is true while the change limit is the binding cap', () => {
    expect(cashCeilingBoundByChangeLimit(55_925n)).toBe(true);
    expect(cashCeilingBoundByChangeLimit(90_000_000n)).toBe(true);
  });

  it('is false once the single-tender limit binds instead', () => {
    expect(cashCeilingBoundByChangeLimit(90_000_001n)).toBe(false);
    expect(cashCeilingBoundByChangeLimit(95_000_000n)).toBe(false);
  });
});

describe('settlementPosition', () => {
  it('derives the balance from the total and the drafted tenders', () => {
    expect(settlementPosition(155_925n, [])).toEqual({ balance: 155_925n, change: 0n, tendered: 0n });
    expect(settlementPosition(155_925n, [100_000n])).toEqual({ balance: 55_925n, change: 0n, tendered: 100_000n });
    expect(settlementPosition(155_925n, [100_000n, 55_925n])).toEqual({ balance: 0n, change: 0n, tendered: 155_925n });
  });

  it('clamps the balance at zero and derives change instead of storing it (FR-G4)', () => {
    expect(settlementPosition(155_925n, [200_000n])).toEqual({ balance: 0n, change: 44_075n, tendered: 200_000n });
  });

  it('moves the change when a tender is removed, rather than keeping what Add computed', () => {
    // The over-tender itself removed: change is gone entirely.
    expect(settlementPosition(155_925n, [])).toEqual({ balance: 155_925n, change: 0n, tendered: 0n });
    // An earlier card removed from under a cash over-tender: change shrinks.
    expect(settlementPosition(155_925n, [200_000n])).toEqual({ balance: 0n, change: 44_075n, tendered: 200_000n });
    expect(settlementPosition(55_925n, [200_000n])).toEqual({ balance: 0n, change: 144_075n, tendered: 200_000n });
  });
});
