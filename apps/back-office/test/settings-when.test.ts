import { describe, expect, it } from 'vitest';
import { whenText } from '../src/settings/when.js';

// Ruling 5. `createdAt` is shown as `D Mon YYYY, HH:MM`: 24-hour, an English three-letter month,
// in the browser's time zone. The inputs are built from local clock readings, so the cases
// hold in whatever zone the machine is in.

const local = (year: number, month: number, day: number, hour: number, minute: number): string =>
  new Date(year, month - 1, day, hour, minute).toISOString();

describe('the version facts date', () => {
  it.each([
    [local(2026, 10, 12, 14, 5), '12 Oct 2026, 14:05'],
    [local(2026, 3, 5, 9, 7), '5 Mar 2026, 09:07'],
    [local(2026, 1, 1, 0, 0), '1 Jan 2026, 00:00'],
    [local(2026, 12, 31, 23, 59), '31 Dec 2026, 23:59'],
    [local(2027, 2, 28, 12, 0), '28 Feb 2027, 12:00'],
    [local(2026, 5, 17, 1, 30), '17 May 2026, 01:30'],
  ])('%s is %s', (iso, shown) => {
    expect(whenText(iso)).toBe(shown);
  });

  it('uses the browser’s zone, not UTC', () => {
    const iso = '2026-10-12T14:05:00.000Z';
    const at = new Date(iso);
    const hours = String(at.getHours()).padStart(2, '0');
    expect(whenText(iso).endsWith(`${hours}:${String(at.getMinutes()).padStart(2, '0')}`)).toBe(true);
  });
});
