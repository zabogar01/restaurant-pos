import { describe, expect, it } from 'vitest';
import { mayAddTender } from '../src/tender.js';

describe('mayAddTender', () => {
  it.each(['cash', 'card'] as const)('%s accepts a positive amount at or below the balance', (method) => {
    expect(mayAddTender(method, 1n, 155_925n)).toBe(true);
    expect(mayAddTender(method, 100_000n, 155_925n)).toBe(true);
    expect(mayAddTender(method, 155_925n, 155_925n)).toBe(true);
  });

  it.each(['cash', 'card'] as const)('%s refuses zero, a negative amount, and an amount over the balance', (method) => {
    expect(mayAddTender(method, 0n, 155_925n)).toBe(false);
    expect(mayAddTender(method, -1n, 155_925n)).toBe(false);
    expect(mayAddTender(method, 155_926n, 155_925n)).toBe(false);
  });
});
