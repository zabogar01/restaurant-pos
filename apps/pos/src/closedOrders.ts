import { RATE_SCALE, rateFromPercent, type Money } from '@pos/money';
import type { Tender } from './close.js';
import type { DiscountSnapshot } from './discount.js';
import { FLOOR_FIXTURES } from './floorFixtures.js';
import { formatAmount } from './money.js';
import { orderVariant } from './orderFixtures.js';
import { tableOf, type OrderBook } from './orderStore.js';

// POS-05, the closed orders list (FE-030), read-only. The fixture state selects
// the picture (frost/pos/closed-orders.html, driven by closed.js); the orders the
// cashier closed in this session are read from the order book and listed beside
// the artifact's six. Nothing here changes an order, and no receipt number is
// kept, shown or searched (ruling I-1).

export type ClosedState =
  | 'default'
  | 'empty'
  | 'loading'
  | 'error'
  | 'overflow'
  | 'nomatch'
  | 'dayclosed'
  | 'dayclosed-start'
  | 'filter-table'
  | 'filter-time'
  | 'filter-amount';

export const CLOSED_STATES: ReadonlyArray<{ id: ClosedState; label: string }> = [
  { id: 'default', label: 'Closed orders' },
  { id: 'empty', label: 'No closed orders' },
  { id: 'loading', label: 'Loading' },
  { id: 'error', label: 'Load failed' },
  { id: 'overflow', label: 'Full trading day' },
  { id: 'nomatch', label: 'No matching orders' },
  { id: 'dayclosed', label: 'Day closed · open day first' },
  { id: 'dayclosed-start', label: 'Day closed · no new-day order yet' },
  { id: 'filter-table', label: 'Touch · table picker' },
  { id: 'filter-time', label: 'Touch · time range' },
  { id: 'filter-amount', label: 'Touch · exact amount' },
];

export function closedStateFrom(search: string): ClosedState {
  const requested = new URLSearchParams(search).get('state');
  return CLOSED_STATES.find((s) => s.id === requested)?.id ?? 'default';
}

/** The two states that draw the amber banner and the closed-day group (F3). */
export const isDayClosed = (state: ClosedState) => state === 'dayclosed' || state === 'dayclosed-start';

/** The copy is the artifact's, verbatim. */
export const CLOSED_COPY = {
  title: 'Closed orders',
  tag: 'DAY OPEN',
  back: '← Floor',
  closedBannerTitle: '25 Sep · Business day closed at 23:14',
  closedBannerBody:
    'The open day’s orders are listed first. Orders from 25 Sep follow, read-only: reprinting still works, refunds are unavailable.',
  openGroup: 'Business day open · 26 Sep',
  closedGroup: 'Closed day · 25 Sep · reprint only',
  openGroupEmpty: 'No orders closed yet in this business day.',
  openGroupNoMatch: 'No matching orders in this business day.',
  closedGroupNoMatch: 'No matching orders from the closed day.',
  filters: { table: 'Table / quick sale', time: 'Closed at', amount: 'Total' },
  reset: 'Reset',
  set: 'Set',
  any: 'Any',
  heads: { closedAt: 'Closed at', order: 'Order', payment: 'Payment taken', total: 'Total' },
  listLabel: 'Closed orders',
  refunded: 'REFUNDED',
  compNoPayment: 'Comp 100% · no payment taken',
  noPayment: 'No payment taken',
  nomatch: { title: 'No matching orders', body: 'No order matches these table, time and amount filters.', action: 'Clear filters' },
  empty: { title: 'No closed orders yet today', body: 'Orders appear here once they are closed.' },
  loading: { title: 'Loading closed orders…', body: 'Reading this business day’s orders.' },
  error: { title: 'Could not load closed orders', body: 'Try again to read this business day.', action: 'Retry' },
  sheet: {
    tag: 'FILTER',
    table: { title: 'Find by table', body: 'Choose the table, or Quick sale.' },
    time: { title: 'Find by closing time', body: 'Closed between · 24-hour time', from: 'From', to: 'To' },
    amount: { title: 'Find by amount', body: 'Match the exact order total. Enter whole rupiah.', total: 'Total' },
    invalid: 'Enter valid HH:MM times, with From no later than To.',
    cancel: 'Cancel',
    apply: 'Apply filter',
    deleteKey: 'Delete last digit',
  },
} as const;

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** A row as the list draws it: every figure already in words, so the screen reads, never computes. */
export type ClosedRow = {
  key: string;
  /** `HH:MM` in the restaurant's zone (PRD section 9). */
  time: string;
  /** `Table n` or `Quick sale` (A5), never `COUNTER`. */
  name: string;
  /** Each tender as `<label> <amount>`, or why none was taken. */
  payment: string;
  /** A cash sale with change: the second line. */
  changeNote?: string;
  total: Money;
  refunded: boolean;
  /** Where the row leads: POS-06, built by the next slice. */
  href: string;
};

const QUICK_SALE = 'Quick sale';
const DETAIL = '/pos/closed-order';

const joined = (parts: ReadonlyArray<string>) => parts.join(' · ');
const tendersText = (tenders: ReadonlyArray<Tender>) => joined(tenders.map((t) => `${t.label} ${formatAmount(t.amount)}`));

/** The business day's clock is WIB, whatever zone the machine runs in (PRD section 9, FR-G11). */
const WIB = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const wibTime = (iso: string): string => WIB.format(new Date(iso));

type FixtureOrder = {
  state: string;
  name: string;
  time: string;
  tenders: ReadonlyArray<Tender>;
  change?: Money;
  total: Money;
  refunded?: boolean;
  zero?: boolean;
};

const tender = (label: string, amount: Money): Tender => ({ label, amount });

// closed.js:13–20. A total is what the artifact's `total()` returns for the row.
const TOTAL = 155_925n;
const QUICK_TOTAL = 173_250n;
const FIXTURE_ORDERS: ReadonlyArray<FixtureOrder> = [
  { state: 'default', name: 'Table 1', time: '20:14', tenders: [tender('Card', 100_000n), tender('Cash', 55_925n)], total: TOTAL },
  { state: 'cash', name: 'Table 7', time: '20:11', tenders: [tender('Cash', 200_000n)], change: 44_075n, total: TOTAL },
  {
    state: 'custom',
    name: 'Table 4',
    time: '20:04',
    tenders: [
      tender('Card', 40_000n),
      tender('Card', 30_000n),
      tender('Meal voucher', 20_000n),
      tender('Card', 10_000n),
      tender('Staff account', 20_000n),
      tender('Cash', 35_925n),
    ],
    total: TOTAL,
  },
  { state: 'refunded', name: 'Table 3', time: '19:58', tenders: [tender('Cash', 155_925n)], total: TOTAL, refunded: true },
  { state: 'zero', name: 'Table 6', time: '19:41', tenders: [], total: 0n, zero: true },
  { state: 'quick', name: QUICK_SALE, time: '19:20', tenders: [tender('Card', 173_250n)], total: QUICK_TOTAL },
];

const NEW_DAY_ORDER: FixtureOrder = { state: 'quick', name: QUICK_SALE, time: '23:40', tenders: [tender('Card', 173_250n)], total: QUICK_TOTAL };

/** closed.js:44: a full trading day is the six orders repeated 36 times, an hour apart every six. */
function overflowOrders(): ReadonlyArray<FixtureOrder & { history: true }> {
  return Array.from({ length: 36 }, (_, i) => ({
    ...FIXTURE_ORDERS[i % FIXTURE_ORDERS.length]!,
    time: `${String(20 - Math.floor(i / 6)).padStart(2, '0')}:${String(54 - (i % 6) * 8).padStart(2, '0')}`,
    history: true as const,
  }));
}

/** Which row the artifact's URL scheme names for a fixture order: `?state=…&order=…&time=…`. */
function fixtureHref(order: FixtureOrder, context: 'list' | 'open-day' | 'closed-day'): string {
  const query =
    context === 'closed-day'
      ? { state: 'dayclosed', order: order.state, time: order.time }
      : { state: order.state, order: order.state, time: order.time, ...(context === 'open-day' && { list: 'dayclosed' }) };
  return `${DETAIL}?${new URLSearchParams(query)}`;
}

function fixtureRow(order: FixtureOrder & { history?: true }, context: 'list' | 'open-day' | 'closed-day', key: string): ClosedRow {
  // closed.js:39: a trading day's custom split is summarised to the labels, in the order they first appear.
  const payment = order.zero
    ? CLOSED_COPY.compNoPayment
    : order.history && order.state === 'custom'
      ? joined([...new Set(order.tenders.map((t) => t.label))])
      : tendersText(order.tenders);
  return {
    key,
    time: order.time,
    name: order.name,
    payment,
    ...(order.change !== undefined && { changeNote: `Change ${formatAmount(order.change)} · contribution ${formatAmount(order.total)}` }),
    total: order.total,
    refunded: order.refunded === true,
    href: fixtureHref(order, context),
  };
}

/** The 100% comp: a percent discount that takes the whole subtotal. */
const isComp = (applied: DiscountSnapshot | undefined) =>
  applied?.value.kind === 'percent' && rateFromPercent(applied.value.percent) === RATE_SCALE;

/**
 * Every order the book holds as closed, newest first. What a row says is read
 * from the book — its id or type for the order, `closedAt` in WIB, its own
 * tenders and change, its own total — and never from a fixture's state name.
 *
 * Newest first is by the instant of `closedAt`. The artifact's six carry only a
 * time of day on the open business day, no instant, and every book order was
 * closed by this cashier after them; so the book's orders list above the
 * fixtures, not interleaved by clock face (the real clock is not 25 Sep).
 */
function bookRows(book: OrderBook): ReadonlyArray<ClosedRow> {
  return book
    .orders()
    .flatMap((o) => (o.status === 'closed' && o.closedAt !== undefined ? [{ ...o, closedAt: o.closedAt }] : []))
    .sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt))
    .map((o) => {
      const tenders = o.tenders ?? [];
      const change = o.change ?? 0n;
      const total = o.order.totals.total;
      const table = tableOf(o.id);
      return {
        key: `book-${o.id}`,
        time: wibTime(o.closedAt),
        name: orderVariant(o.order) === 'quick_sale' ? QUICK_SALE : table ? `Table ${table}` : o.order.title,
        payment: tenders.length > 0 ? tendersText(tenders) : isComp(o.order.applied) ? CLOSED_COPY.compNoPayment : CLOSED_COPY.noPayment,
        ...(change > 0n && { changeNote: `Change ${formatAmount(change)} · contribution ${formatAmount(total)}` }),
        total,
        refunded: false,
        href: `${DETAIL}?${new URLSearchParams({ order: o.id })}`,
      };
    });
}

/**
 * The rows a state's list draws, before any filter. The other states are the
 * artifact's pictures and list only its fixtures; `default` — and the nomatch
 * and filter pictures, which are `default` with something set over it — also
 * lists what the book closed.
 */
export function listedRows(state: ClosedState, book: OrderBook): ReadonlyArray<ClosedRow> {
  if (state === 'overflow') return overflowOrders().map((o, i) => fixtureRow(o, 'list', `history-${i}`));
  if (state === 'empty' || state === 'loading' || state === 'error' || isDayClosed(state)) return [];
  return [...bookRows(book), ...FIXTURE_ORDERS.map((o) => fixtureRow(o, 'list', `fixture-${o.state}`))];
}

/** F3: under the banner the open day lists first, then the closed day, reprint only. */
export function dayGroups(state: ClosedState): { openDay: ReadonlyArray<ClosedRow>; closedDay: ReadonlyArray<ClosedRow> } {
  return {
    openDay: state === 'dayclosed' ? [fixtureRow(NEW_DAY_ORDER, 'open-day', 'newday')] : [],
    closedDay: FIXTURE_ORDERS.map((o) => fixtureRow(o, 'closed-day', `closed-${o.state}`)),
  };
}

// ---------------------------------------------------------------------------
// Filters (A1, F7)
// ---------------------------------------------------------------------------

export type ClosedFilters = {
  /** `Any`, `Quick sale` or `Table n`. */
  table: string;
  /** Inclusive `HH:MM` bounds, or none. */
  time?: { from: string; to: string };
  /** Whole rupiah as typed digits; empty is unset. Compared as a bigint, never a double. */
  amount: string;
};

export const NO_FILTERS: ClosedFilters = { table: CLOSED_COPY.any, amount: '' };

/** The `nomatch` picture is the default list under a table and an amount nothing satisfies. */
export const NOMATCH_FILTERS: ClosedFilters = { table: 'Table 12', amount: '500000' };

export const isFiltering = (f: ClosedFilters) => f.table !== CLOSED_COPY.any || f.time !== undefined || f.amount !== '';

export function matches(row: ClosedRow, f: ClosedFilters): boolean {
  return (
    (f.table === CLOSED_COPY.any || row.name === f.table) &&
    (f.amount === '' || row.total === BigInt(f.amount)) &&
    (!f.time || (row.time >= f.time.from && row.time <= f.time.to))
  );
}

/** *Any*, *Quick sale* and the floor's configured tables (`FLOOR_FIXTURES.default`). */
export const TABLE_CHOICES: ReadonlyArray<string> = [
  CLOSED_COPY.any,
  QUICK_SALE,
  ...FLOOR_FIXTURES.default.tables.map((t) => `Table ${t.n}`),
];

/**
 * The keypad's entry (closed.js:88): digits shift in from the right, a leading
 * zero is dropped, and a digit past `max` is ignored.
 */
export function keyed(value: string, key: string, max: number): string {
  if (key === 'Clear') return '';
  if (key === '←') return value.slice(0, -1);
  return (value === '0' ? '' : value).concat(key).slice(0, max);
}

/** Typed digits as the time field draws them, padded from the left: `800` is `08:00`. */
export const clock = (digits: string): string => {
  const s = digits.padStart(4, '0');
  return `${s.slice(0, 2)}:${s.slice(2)}`;
};

const VALID_CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Whether the drafted range may be applied. It checks what the fields show, so a field never reads valid and is refused. */
export const rangeIsValid = (from: string, to: string): boolean =>
  VALID_CLOCK.test(clock(from)) && VALID_CLOCK.test(clock(to)) && clock(from) <= clock(to);
