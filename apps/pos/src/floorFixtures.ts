import type { Money } from '@pos/money';
import type { OrderState } from './orderFixtures.js';

// POS-02's eleven states as fixtures, selected by ?state= as the reviewed artifact
// selects them (docs/design/visual-directions/frost/pos/floor.html). Copy and data
// are the artifact's, verbatim. What is *not* here is what the book knows: an
// occupied table's total and status line are read from the order book whenever
// it holds that table's order (FloorScreen.tsx), and these figures are only what
// the floor shows before it does.

export type FloorState =
  | 'default'
  | 'clear'
  | 'empty'
  | 'loading'
  | 'error'
  | 'overflow'
  | 'dayclosed'
  | 'incident'
  | 'receipt-warning'
  | 'after-close'
  | 'after-close-receipt';

export const FLOOR_STATES: ReadonlyArray<{ id: FloorState; label: string }> = [
  { id: 'default', label: 'Mixed occupancy' },
  { id: 'clear', label: 'All tables free' },
  { id: 'empty', label: 'No tables configured' },
  { id: 'loading', label: 'Loading' },
  { id: 'error', label: 'Error' },
  { id: 'overflow', label: '24 tables — scroll' },
  { id: 'dayclosed', label: 'Business day closed' },
  { id: 'incident', label: 'Kitchen emergency' },
  { id: 'receipt-warning', label: 'Receipt warning' },
  { id: 'after-close', label: 'After Close · Table 1 free' },
  { id: 'after-close-receipt', label: 'After Close · receipt warning' },
];

/**
 * An occupied table as the floor knows it before the book holds its order. Its total and status
 * line are not here: they are derived from the order fixture it opens (FloorScreen.tsx).
 */
export type OpenTable = {
  /** The order fixture the tile opens: `default` for Table 1, and the three `open-t*` states. */
  state: OrderState;
  /** What a payment in progress has already drafted: the tile's *outstanding* is the total less this. */
  drafted?: Money;
};

export type FloorTable = { n: number; open?: OpenTable };

const T1: OpenTable = { state: 'default' };
const T7: OpenTable = { state: 'open-t7', drafted: 226_800n };
const T9: OpenTable = { state: 'open-t9' };
const T12: OpenTable = { state: 'open-t12' };

const OPEN_BY_TABLE: Readonly<Record<number, OpenTable>> = { 1: T1, 7: T7, 9: T9, 12: T12 };

const tables = (count: number, occupied: boolean): ReadonlyArray<FloorTable> =>
  Array.from({ length: count }, (_, i) => {
    const open = occupied ? OPEN_BY_TABLE[i + 1] : undefined;
    return { n: i + 1, ...(open && { open }) };
  });

const MIXED = tables(12, true);
// FE-033: the mixed floor once Table 1 has closed. Free because the book (or, on a fresh load, this fixture) says so.
const MIXED_AFTER_CLOSE: ReadonlyArray<FloorTable> = MIXED.map((t) => (t.n === 1 ? { n: 1 } : t));
const FREE = tables(11, false);

export type FloorFixture = {
  tables: ReadonlyArray<FloorTable>;
  /** The grid is drawn, or a message stands in its place. */
  message?: 'loading' | 'error' | 'empty';
  dayClosed?: boolean;
  incident?: boolean;
  receiptWarning?: boolean;
  /** The artifact's open quick sale (the `quick` order fixture) is drawn on the strip. Its figures are derived, never typed here. */
  quickSale?: boolean;
};

export const FLOOR_FIXTURES: Record<FloorState, FloorFixture> = {
  default: { tables: MIXED, quickSale: true },
  clear: { tables: FREE },
  empty: { tables: [], message: 'empty' },
  loading: { tables: [], message: 'loading' },
  error: { tables: [], message: 'error' },
  overflow: { tables: tables(24, true), quickSale: true },
  dayclosed: { tables: FREE, dayClosed: true },
  incident: { tables: MIXED, incident: true, quickSale: true },
  'receipt-warning': { tables: MIXED, receiptWarning: true, quickSale: true },
  'after-close': { tables: MIXED_AFTER_CLOSE, quickSale: true },
  'after-close-receipt': { tables: MIXED_AFTER_CLOSE, receiptWarning: true, quickSale: true },
};

export function floorStateFrom(search: string): FloorState {
  const requested = new URLSearchParams(search).get('state');
  return FLOOR_STATES.find((s) => s.id === requested)?.id ?? 'default';
}

export const FLOOR_COPY = {
  title: 'Floor',
  actor: 'Ana R. · Cashier',
  idle: '90s',
  dayOpen: 'Business day open · 25 Sep',
  // Lead ruling of 2026-09-30: after the day closed, the header names the day that is open now.
  dayClosed: 'Business day open · 26 Sep',
  closedBannerTitle: 'Business day closed at 23:14',
  closedBannerBody: 'New orders belong to the next business day. Orders from the closed day can no longer be voided or refunded.',
  receiptWarning: 'Receipt printer: 1 unprinted receipt',
  receiptWarningAction: 'View receipts',
  tables: 'Tables',
  loading: { title: 'Loading floor…', body: 'Reading tables and open orders.' },
  error: { title: 'Floor unavailable', body: 'Could not read table state. Quick sale is still available.', action: 'Retry' },
  empty: { title: 'No tables configured', body: 'A manager creates tables in the back office. Quick sale works without them.' },
  loadingCount: 'Reading table availability…',
  closedOrders: 'Closed orders',
  newQuickSale: 'New quick sale',
  free: 'Free',
  freeAction: 'Open table order',
  open: 'Open',
  gridLabel: 'Tables — scroll for more',
  openQuickSale: 'Open quick sale',
  quickSale: 'Quick sale',
  resume: 'Resume',
} as const;
