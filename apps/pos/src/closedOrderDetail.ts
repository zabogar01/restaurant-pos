import type { Money } from '@pos/money';
import type { Tender } from './close.js';
import { FIXTURE_ORDERS, bookOrderName, wibTime, type FixtureOrder } from './closedOrders.js';
import type { Adjustment, Modifier } from './orderFixtures.js';
import { reachedClosed, type OrderBook } from './orderStore.js';
import { contributions } from './refund.js';
import { REFUND_COPY, REFUND_STATES, type Draft, type RefundState } from './refundDraft.js';

// POS-06, the closed order a POS-05 row leads to (FE-031, FE-032). The URL
// selects the picture as the artifact does (frost/pos/closed-order.html, driven
// by closed.js:87–180): `?state=&order=&time=&list=` for a fixture row, and
// `?order=<book id>` alone for an order the cashier closed in this session. A
// book order is drawn from the book and nothing else: its lines, tenders,
// change and stored totals (FR-G7, B-10), never recomputed and never a
// fixture's; and once refunded, its refund from the book's record alone. The
// artifact's twenty-seven states are built: the fourteen of FE-031 and the
// thirteen of the refund (refundDraft.ts).

export type DetailState =
  | 'default'
  | 'cash'
  | 'custom'
  | 'quick'
  | 'zero'
  | 'refunded'
  | 'dayclosed'
  | 'reprint'
  | 'reprint-unknown'
  | 'reprint-sent'
  | 'reprint-printed'
  | 'loading'
  | 'error'
  | 'overflow';

export const DETAIL_STATES: ReadonlyArray<{ id: DetailState; label: string }> = [
  { id: 'default', label: 'Card + cash' },
  { id: 'cash', label: 'Cash with change' },
  { id: 'custom', label: 'Custom-named tenders' },
  { id: 'quick', label: 'Quick sale' },
  { id: 'zero', label: 'Zero total' },
  { id: 'refunded', label: 'REFUNDED' },
  { id: 'dayclosed', label: 'Business day closed' },
  { id: 'reprint', label: 'Receipt FAILED' },
  { id: 'reprint-unknown', label: 'Receipt UNKNOWN' },
  { id: 'reprint-sent', label: 'Reprint sent' },
  { id: 'reprint-printed', label: 'Server result · PRINTED' },
  { id: 'loading', label: 'Loading' },
  { id: 'error', label: 'Load failed' },
  { id: 'overflow', label: 'Long order · pinned figures' },
];

/** The copy is the artifact's, verbatim (closed.js:120–132). */
export const DETAIL_COPY = {
  back: '← Closed orders',
  unavailableTitle: 'Closed order',
  closedTag: 'CLOSED',
  refundedTag: 'REFUNDED',
  loading: { title: 'Loading order…', body: 'Reading the stored order.' },
  error: { title: 'Could not load this order', body: 'No order details are available. Try again.', action: 'Retry' },
  contentLabel: 'Charged items and original payment',
  payment: 'Original payment',
  noPayment: 'No payment taken · fully discounted',
  changeGiven: 'Change given',
  cashContribution: 'Cash contribution',
  returned: 'Money returned · full order',
  summary: 'What was charged',
  subtotal: 'Subtotal',
  total: 'Total',
  stored: 'Stored at close · figures do not change with today’s settings.',
  reprint: 'Reprint receipt',
  incidentsLink: 'View receipt incidents',
  incidentsHref: '/pos/incidents',
  why: {
    zero: 'No payment taken · fully discounted.',
    refunded: 'Already refunded · this order is final.',
    dayclosed: 'Refund unavailable · business day closed.',
  },
} as const;

export const note = (time: string, day: string) => `Closed ${time} · Business day ${day} Sep`;
export const chargedHead = (n: number) => `${n} ${n === 1 ? 'line' : 'lines'} · charged items`;

/** A state of the screen: the fourteen of FE-031 and the thirteen of the refund. */
export type ScreenState = DetailState | RefundState;

/** One notice above the lines. `warn` is the amber class (a receipt's failure, a closed day), never the kitchen emergency. */
export type DetailNotice = {
  key: string;
  title: string;
  body?: string;
  warn: boolean;
  link?: { label: string; href: string };
  /** A control that acts on the screen (a button, never a link). */
  action?: { id: 'review-refund' | 'return-to-order'; label: string };
};

export type ReprintResult = 'reprint' | 'reprint-unknown' | 'reprint-sent' | 'reprint-printed';

const RESULTS: Record<ReprintResult, Omit<DetailNotice, 'key'>> = {
  reprint: {
    title: 'Receipt reprint FAILED',
    body: 'The order is still closed.',
    warn: true,
    link: { label: DETAIL_COPY.incidentsLink, href: DETAIL_COPY.incidentsHref },
  },
  'reprint-unknown': {
    title: 'Receipt delivery UNKNOWN',
    body: 'Check the printer before reprinting.',
    warn: true,
    link: { label: DETAIL_COPY.incidentsLink, href: DETAIL_COPY.incidentsHref },
  },
  // The client has no print job to follow: it claims no time and no print (FR-G7, B-16).
  'reprint-sent': { title: 'Reprint sent', warn: false },
  // A printed time appears only in this fixture.
  'reprint-printed': { title: 'Receipt PRINTED · 20:26', body: 'Server-confirmed result. The original charged figures were used.', warn: false },
};

export const reprintResultOf = (state: ScreenState): ReprintResult | undefined =>
  state === 'reprint' || state === 'reprint-unknown' || state === 'reprint-sent' || state === 'reprint-printed' ? state : undefined;

/**
 * What a refund attempt left on the screen. `failed` kept a draft for *Review
 * refund*; `failed-final` kept none (the order is refunded, zero-total or not
 * closed, and nothing can be reviewed); `day-refused` is ruling I-4.
 */
export type RefundOutcome = 'failed' | 'failed-final' | 'day-refused';

/** Whether the order may be refunded at all: not zero-total, not REFUNDED, not on a closed day (FR-H5b, FR-H6, FR-H7). */
export const refundable = (detail: Pick<ClosedDetail, 'zero' | 'refund' | 'closedDay'>): boolean => !detail.zero && !detail.refund && !detail.closedDay;

/**
 * The notices, in the artifact's order (closed.js:125–132): the closed day,
 * REFUNDED, a refund's failure or refusal, then a reprint's result. REFUNDED is
 * built from the refund's own facts: a refund made here names no approver (O6).
 */
export function noticesFor(
  detail: Pick<ClosedDetail, 'closedDay' | 'refund' | 'zero'>,
  result: ReprintResult | undefined,
  outcome?: RefundOutcome
): ReadonlyArray<DetailNotice> {
  const review = outcome === 'failed' && refundable(detail);
  return [
    ...(detail.closedDay
      ? [{ key: 'dayclosed', title: 'This order’s business day is closed', body: 'Reprinting still works. Refunds are unavailable.', warn: true }]
      : []),
    ...(detail.refund
      ? [
          {
            key: 'refunded',
            title: `REFUNDED · ${detail.refund.time}${detail.refund.approvedBy ? ` · approved by ${detail.refund.approvedBy}` : ''}`,
            body: `The whole order was refunded. Reason: ${detail.refund.reason}.`,
            warn: false,
          },
        ]
      : []),
    ...(outcome === 'failed' || outcome === 'failed-final'
      ? [
          {
            key: 'refund-error',
            title: REFUND_COPY.failed,
            body: review ? REFUND_COPY.failedKept : REFUND_COPY.nothing,
            warn: true,
            ...(review && { action: { id: 'review-refund' as const, label: REFUND_COPY.review } }),
          },
        ]
      : []),
    ...(outcome === 'day-refused'
      ? [
          {
            key: 'day-refusal',
            title: REFUND_COPY.dayRefused,
            body: REFUND_COPY.dayRefusedBody,
            warn: true,
            action: { id: 'return-to-order' as const, label: REFUND_COPY.returnToOrder },
          },
        ]
      : []),
    ...(result ? [{ key: 'result', ...RESULTS[result] }] : []),
  ];
}

// ---------------------------------------------------------------------------
// Which order, and what it shows
// ---------------------------------------------------------------------------

export type DetailRequest =
  | { source: 'fixture'; state: ScreenState; fixture: string; time: string | undefined; newDay: boolean }
  | { source: 'book'; id: string };

/** What a state with no `order` shows (closed.js:90). The rest read as `default`. */
const STATE_ORDER: Partial<Record<ScreenState, string>> = {
  'sheet-ac25': 'cash',
  'sheet-custom': 'custom',
  'sheet-zero': 'default',
  'approval-edited': 'default',
  cash: 'cash',
  custom: 'custom',
  quick: 'quick',
  zero: 'zero',
  refunded: 'refunded',
  overflow: 'long',
};

const STATES: ReadonlyArray<{ id: ScreenState }> = [...DETAIL_STATES, ...REFUND_STATES];

const CLOCK = /^\d{2}:\d{2}$/;

/**
 * An order the cashier closed is `?order=<id>` and nothing else; anything with a
 * `state` is the artifact's own scheme (closed.js:90–95).
 */
export function detailRequestFrom(search: string): DetailRequest {
  const params = new URLSearchParams(search);
  const id = params.get('order');
  if (id !== null && !params.has('state')) return { source: 'book', id };
  const requested = params.get('state');
  const state = STATES.find((s) => s.id === requested)?.id ?? 'default';
  const time = params.get('time');
  return {
    source: 'fixture',
    state,
    // The cash-only failure keeps Table 7 whatever `order=` says (closed.js:90, DESIGN-010).
    fixture: state === 'refund-error-cash' ? 'cash' : params.get('order') || STATE_ORDER[state] || 'default',
    time: time !== null && CLOCK.test(time) ? time : undefined,
    newDay: params.get('list') === 'dayclosed',
  };
}

export type DetailLine = { key: string; quantity: number; name: string; modifiers?: ReadonlyArray<Modifier>; amount: Money };

export type ClosedDetail = {
  name: string;
  /** `HH:MM` in WIB. */
  time: string;
  /** The business day's number, as the note says it. */
  day: string;
  lines: ReadonlyArray<DetailLine>;
  tenders: ReadonlyArray<Tender>;
  change: Money;
  total: Money;
  /** The stored figures: the discount's own label and a negative amount, absent when the order carries none (F9). */
  figures: { subtotal: Money; discount?: Adjustment; service?: Adjustment; total: Money };
  /** A zero-total order: nothing was paid and nothing can be refunded (FR-G11). */
  zero: boolean;
  /** Present exactly when the order is REFUNDED. One owner: nothing else says so. */
  refund?: RefundFacts;
  closedDay: boolean;
};

/**
 * What the screen says of a refund. A book order's come from the book's record
 * and nobody's approval is named (O6); only the fixture picture of REFUNDED
 * carries an approver, as the artifact's own copy.
 */
export type RefundFacts = { time: string; reason: string; approvedBy?: string; returned: ReadonlyArray<Tender> };

const FIXTURE_REFUND_TIME = '20:31';
const FIXTURE_REFUND_REASON = 'Wrong dish served';
const FIXTURE_APPROVER = 'M. Iqbal';

const OPEN_DAY = '25';
const NEW_DAY = '26';
const SERVICE = 'Service charge 5%';
const STAFF_MEAL = 'Staff meal 10%';
const COMP = 'Comp 100%';

const BURGER_MODIFIERS: ReadonlyArray<Modifier> = [
  { name: 'Large', delta: 20_000n },
  { name: 'Extra cheese', delta: 15_000n },
];

/** closed.js:133: every fixture order carries the artifact's two lines; the long one carries ten pairs. */
const fixtureLines = (pairs: number): ReadonlyArray<DetailLine> =>
  Array.from({ length: pairs }, (_, i) => [
    { key: `burger-${i}`, quantity: 1, name: 'Burger', modifiers: BURGER_MODIFIERS, amount: 135_000n },
    { key: `soda-${i}`, quantity: 1, name: 'Soda', amount: 30_000n },
  ]).flat();

/** closed.js:96–97. */
function fixtureFigures(order: FixtureOrder, long: boolean): ClosedDetail['figures'] {
  const subtotal = long ? 1_650_000n : 165_000n;
  const discount = order.zero ? 165_000n : order.state === 'quick' ? 0n : long ? 165_000n : 16_500n;
  const service = order.zero ? 0n : order.state === 'quick' ? 8_250n : long ? 74_250n : 7_425n;
  return {
    subtotal,
    ...(discount > 0n && { discount: { label: order.zero ? COMP : STAFF_MEAL, amount: -discount } }),
    service: { label: SERVICE, amount: service },
    // The fixture's own total (closed.js:13–20, :97's `orderTotal`); the long order's is the artifact's 1.559.250.
    total: long ? 1_559_250n : order.total,
  };
}

/** What a fixture address was refunded with when the cashier confirmed it in this screen. Screen state, never the book (rule 13). */
export type FixtureRefund = Draft;

/** The tenders that got money back, each with its allocation, a row at 0 left out. */
const returnedOf = (tenders: ReadonlyArray<Tender>, amounts: ReadonlyArray<Money>): ReadonlyArray<Tender> =>
  tenders.flatMap((t, i) => (amounts[i]! > 0n ? [{ label: t.label, amount: amounts[i]! }] : []));

/**
 * A fixture address: the artifact's order, under the artifact's picture.
 * `closedDay` is the screen's fact (the picture, or a day-refusal's outcome);
 * `confirmed` is a refund the cashier approved here, shown with the chosen
 * reason and allocation and no approver.
 */
export function fixtureDetail(
  request: Extract<DetailRequest, { source: 'fixture' }>,
  { closedDay, confirmed }: { closedDay: boolean; confirmed?: FixtureRefund }
): ClosedDetail {
  const long = request.fixture === 'long';
  const order = FIXTURE_ORDERS.find((o) => o.state === request.fixture) ?? FIXTURE_ORDERS[0]!;
  const figures = fixtureFigures(order, long);
  const tenders = long ? [{ label: 'Card', amount: figures.total }] : order.tenders;
  const refund: RefundFacts | undefined = confirmed
    ? { time: FIXTURE_REFUND_TIME, reason: confirmed.reason, returned: returnedOf(tenders, confirmed.amounts) }
    : order.refunded === true || request.state === 'refunded'
      ? {
          time: FIXTURE_REFUND_TIME,
          reason: FIXTURE_REFUND_REASON,
          approvedBy: FIXTURE_APPROVER,
          returned: returnedOf(tenders, contributions(tenders, figures.total)),
        }
      : undefined;
  return {
    name: order.name,
    time: request.time ?? order.time,
    day: request.newDay ? NEW_DAY : OPEN_DAY,
    lines: fixtureLines(long ? 10 : 1),
    tenders,
    change: order.change ?? 0n,
    total: figures.total,
    figures,
    zero: order.zero === true,
    ...(refund && { refund }),
    closedDay,
  };
}

/**
 * An order the book holds as closed or refunded, drawn from the book alone. A
 * voided line was not charged and is not listed or counted. An id the book does
 * not hold — or holds still open — is `undefined`: no fixture stands in for it.
 * A refunded order's refund is its record's: the time, the reason and the money
 * returned as allocated, never recomputed from the tenders.
 */
export function bookDetail(book: OrderBook, id: string): ClosedDetail | undefined {
  const held = book.orders().find((o) => o.id === id);
  if (!held || !reachedClosed(held.status) || held.closedAt === undefined) return undefined;
  const { totals } = held.order;
  return {
    name: bookOrderName(held.id, held.order),
    time: wibTime(held.closedAt),
    day: OPEN_DAY,
    lines: held.order.groups
      .flatMap((g) => g.lines)
      .filter((line) => line.status !== 'voided')
      .map((line) => ({
        key: line.id,
        quantity: line.quantity,
        name: line.name,
        ...(line.modifiers && line.modifiers.length > 0 && { modifiers: line.modifiers }),
        amount: line.amount,
      })),
    tenders: held.tenders ?? [],
    change: held.change ?? 0n,
    total: totals.total,
    figures: {
      subtotal: totals.subtotal,
      ...(totals.discount && { discount: totals.discount }),
      ...(totals.serviceCharge && { service: totals.serviceCharge }),
      total: totals.total,
    },
    zero: totals.total === 0n,
    ...(held.refunded && {
      refund: {
        time: wibTime(held.refunded.refundedAt),
        reason: held.refunded.reason,
        returned: held.refunded.allocations.map(({ label, amount }) => ({ label, amount })),
      },
    }),
    closedDay: false,
  };
}
