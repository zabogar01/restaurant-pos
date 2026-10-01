// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClosedOrderScreen } from '../src/ClosedOrderScreen.js';
import { DETAIL_STATES, detailRequestFrom } from '../src/closedOrderDetail.js';
import { FIXTURE_ORDERS, cashContribution } from '../src/closedOrders.js';
import { orderTotals } from '../src/discount.js';
import { formatAmount } from '../src/money.js';
import type { OrderLine } from '../src/orderFixtures.js';
import type { OrderBook } from '../src/orderStore.js';
import { PosRoutes } from '../src/PosRoutes.js';
import type { ShownOrder } from '../src/voidFixtures.js';

// FE-031 / POS-06: the closed order a POS-05 row leads to. Read-only: what was
// charged, the original payment and a reprint's four results, never a refund.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let mount = 0;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/pos/order');
});

const press = (el: Element) => act(() => (el as HTMLElement).click());
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const path = () => `${window.location.pathname}${window.location.search}`;

function load(url: string) {
  window.history.replaceState(null, '', url);
  act(() => root.render(<PosRoutes key={++mount} />));
}

const screen = () => host.querySelector('.closed-order')!;
const link = (label: string) => [...screen().querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === label)!;
const reprint = () => screen().querySelector<HTMLButtonElement>('[data-action="reprint"]')!;

/** Everything the screen draws, apart: the header, the note, the notices, the left column's groups and rows, the figures and the actions. */
function draw() {
  const s = screen();
  return {
    name: text(s.querySelector('h1')!),
    tag: s.querySelector('.closed-head .closed-tag')?.textContent ?? '',
    note: s.querySelector('.closed-content > .closed-note')?.textContent ?? '',
    notices: [...s.querySelectorAll('.closed-notice')].map(text),
    left: [...s.querySelectorAll('.closed-content > .closed-group, .closed-content > .closed-line')].map(text),
    totals: [...s.querySelectorAll('.closed-summary dl > div')].map((d) => `${d.querySelector('dt')!.textContent} ${d.querySelector('dd')!.textContent}`),
    stored: s.querySelector('.closed-figures > p') ? text(s.querySelector('.closed-figures > p')!) : '',
    buttons: [...s.querySelectorAll('button')].map(text),
    why: [...s.querySelectorAll('.closed-actions p')].map(text),
    message: s.querySelector('.closed-empty') ? text(s.querySelector('.closed-empty')!) : '',
  };
}

/** The rows of one group of the left column, up to the next group. */
function section(head: string): ReadonlyArray<string> {
  const rows: string[] = [];
  let inside = false;
  for (const el of screen().querySelectorAll('.closed-content > .closed-group, .closed-content > .closed-line')) {
    if (el.classList.contains('closed-group')) inside = text(el) === head;
    else if (inside) rows.push(text(el));
  }
  return rows;
}

const line = (quantity: number, name: string, modifiers: string, amount: string) => `${quantity}${name}${modifiers}${amount}`;
const BURGER = line(1, 'Burger', 'Large (+20.000) · Extra cheese (+15.000)', '135.000');
const SODA = line(1, 'Soda', '', '30.000');
const pay = (label: string, amount: string) => `${label}${amount}`;
const NOTE = (time: string, day = '25') => `Closed ${time} · Business day ${day} Sep`;

const STAFF_TOTALS = ['Subtotal 165.000', 'Staff meal 10% −16.500', 'Service charge 5% 7.425', 'Total 155.925'];
const STORED = 'Stored at close · figures do not change with today’s settings.';
const SPLIT = ['2 lines · charged items', BURGER, SODA, 'Original payment', pay('Card', '100.000'), pay('Cash', '55.925')];

const DEFAULT = {
  name: 'Table 1',
  tag: 'CLOSED',
  note: NOTE('20:14'),
  notices: [] as string[],
  left: SPLIT,
  totals: STAFF_TOTALS,
  stored: STORED,
  buttons: ['Reprint receipt'],
  why: [] as string[],
  message: '',
};

const FAILED = 'Receipt reprint FAILEDThe order is still closed. View receipt incidents';
const UNKNOWN = 'Receipt delivery UNKNOWNCheck the printer before reprinting. View receipt incidents';
const DAY_CLOSED = 'This order’s business day is closedReprinting still works. Refunds are unavailable.';
const REFUNDED = 'REFUNDED · 20:31 · approved by M. IqbalThe whole order was refunded. Reason: Wrong dish served.';
const UNAVAILABLE = { name: 'Closed order', tag: '', note: '', left: [] as string[], totals: [] as string[], stored: '', buttons: [] as string[] };

// ---------------------------------------------------------------------------
// Criterion 1 — the fourteen states as the artifact draws them
// ---------------------------------------------------------------------------

const EXPECTED: Record<string, Partial<typeof DEFAULT>> = {
  default: {},
  cash: {
    name: 'Table 7',
    note: NOTE('20:11'),
    left: ['2 lines · charged items', BURGER, SODA, 'Original payment', pay('Cash', '200.000'), pay('Change given', '−44.075'), pay('Cash contribution', '155.925')],
  },
  custom: {
    name: 'Table 4',
    note: NOTE('20:04'),
    left: [
      '2 lines · charged items',
      BURGER,
      SODA,
      'Original payment',
      pay('Card', '40.000'),
      pay('Card', '30.000'),
      pay('Meal voucher', '20.000'),
      pay('Card', '10.000'),
      pay('Staff account', '20.000'),
      pay('Cash', '35.925'),
    ],
  },
  quick: {
    name: 'Quick sale',
    note: NOTE('19:20'),
    left: ['2 lines · charged items', BURGER, SODA, 'Original payment', pay('Card', '173.250')],
    totals: ['Subtotal 165.000', 'Service charge 5% 8.250', 'Total 173.250'],
  },
  zero: {
    name: 'Table 6',
    note: NOTE('19:41'),
    left: ['2 lines · charged items', BURGER, SODA, 'Original payment', 'No payment taken · fully discounted'],
    totals: ['Subtotal 165.000', 'Comp 100% −165.000', 'Service charge 5% 0', 'Total 0'],
    why: ['No payment taken · fully discounted.'],
  },
  refunded: {
    name: 'Table 3',
    tag: 'REFUNDED',
    note: NOTE('19:58'),
    notices: [REFUNDED],
    left: ['2 lines · charged items', BURGER, SODA, 'Original payment', pay('Cash', '155.925'), 'Money returned · full order', pay('Cash', '155.925')],
    why: ['Already refunded · this order is final.'],
  },
  dayclosed: { notices: [DAY_CLOSED], why: ['Refund unavailable · business day closed.'] },
  reprint: { notices: [FAILED] },
  'reprint-unknown': { notices: [UNKNOWN] },
  'reprint-sent': { notices: ['Reprint sent'] },
  'reprint-printed': { notices: ['Receipt PRINTED · 20:26Server-confirmed result. The original charged figures were used.'] },
  loading: { ...UNAVAILABLE, message: 'Loading order…Reading the stored order.' },
  error: { ...UNAVAILABLE, message: 'Could not load this orderNo order details are available. Try again.Retry', buttons: ['Retry'] },
  overflow: {
    left: [
      '20 lines · charged items',
      ...Array.from({ length: 10 }, () => [BURGER, SODA]).flat(),
      'Original payment',
      pay('Card', '1.559.250'),
    ],
    totals: ['Subtotal 1.650.000', 'Staff meal 10% −165.000', 'Service charge 5% 74.250', 'Total 1.559.250'],
  },
};

describe('criterion 1: every state draws what the artifact draws', () => {
  it('declares the fourteen states this slice builds, in the artifact’s order', () => {
    expect(DETAIL_STATES.map((s) => s.id)).toEqual(Object.keys(EXPECTED));
  });

  for (const { id } of DETAIL_STATES) {
    it(`${id}`, () => {
      load(`/pos/closed-order?state=${id}`);
      expect(draw()).toEqual({ ...DEFAULT, ...EXPECTED[id] });
    });
  }

  it('a state this slice does not build reads as default, and so does none at all', () => {
    for (const url of ['?state=sheet-refund', '?state=nonsense', '?state=approval', '']) {
      load(`/pos/closed-order${url}`);
      expect(draw(), url).toEqual(DEFAULT);
    }
  });

  it('a fixture state with another order shows that order under its picture (closed.js:90–95)', () => {
    load('/pos/closed-order?state=dayclosed&order=cash&time=20%3A11');
    expect(draw()).toMatchObject({ name: 'Table 7', note: NOTE('20:11'), notices: [DAY_CLOSED], why: ['Refund unavailable · business day closed.'] });
    expect(section('Original payment')).toEqual([pay('Cash', '200.000'), pay('Change given', '−44.075'), pay('Cash contribution', '155.925')]);
  });

  it('shows the closing time the row named, and falls back to the order’s own for anything that is not HH:MM', () => {
    load('/pos/closed-order?state=default&order=default&time=21%3A05');
    expect(draw().note).toBe(NOTE('21:05'));
    load('/pos/closed-order?state=default&order=default&time=%3Cb%3Ex');
    expect(draw().note).toBe(NOTE('20:14'));
  });

  it('every state draws a CLOSED or REFUNDED tag only where an order is shown', () => {
    for (const { id } of DETAIL_STATES) {
      load(`/pos/closed-order?state=${id}`);
      const tag = draw().tag;
      expect(tag, id).toBe(id === 'loading' || id === 'error' ? '' : id === 'refunded' ? 'REFUNDED' : 'CLOSED');
    }
  });

  it('the long order’s figures reconcile: subtotal less discount plus service is the total, and the one card tender is the total', () => {
    load('/pos/closed-order?state=overflow');
    expect(draw().left.at(-1)).toBe(pay('Card', '1.559.250'));
    expect(1_650_000n - 165_000n + 74_250n).toBe(1_559_250n);
  });

  it('every fixture order’s stored figures reconcile with its total', () => {
    for (const order of FIXTURE_ORDERS) {
      load(`/pos/closed-order?state=${order.state}&order=${order.state}`);
      const rows = draw().totals.map((r) => r.slice(r.lastIndexOf(' ') + 1));
      expect(rows.at(-1), order.name).toBe(formatAmount(order.total));
    }
  });
});

// ---------------------------------------------------------------------------
// Criterion 2 — a fixture row shows its own order
// ---------------------------------------------------------------------------

/** The list row's own words, to hold the detail to. */
function listRow(a: Element) {
  const [time, name, payment, total] = [...a.children];
  const tenders = [...payment!.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent)
    .join('')
    .trim();
  return { time: text(time!), name: text(name!), tenders, total: text(total!) };
}

const squeeze = (s: string) => s.replace(/ /g, '');

describe('criterion 2: a fixture row shows its own order', () => {
  it('following each of POS-05’s six rows shows the order, time, tenders and total that row showed', () => {
    for (let i = 0; i < 6; i++) {
      load('/pos/closed-orders');
      const row = host.querySelectorAll('.closed-row')[i]!;
      const wanted = listRow(row);
      press(row);
      expect(window.location.pathname).toBe('/pos/closed-order');
      const shown = draw();
      expect(shown.name).toBe(wanted.name);
      expect(shown.note).toBe(NOTE(wanted.time));
      expect(shown.totals.at(-1)).toBe(`Total ${wanted.total}`);
      const tenders = section('Original payment');
      if (wanted.name === 'Table 6') {
        expect(tenders).toEqual(['No payment taken · fully discounted']);
      } else {
        // The list joins `<label> <amount>` with ·; the detail has one row per tender, in the order taken.
        const rowsOfTenders = tenders.filter((t) => !t.startsWith('Change given') && !t.startsWith('Cash contribution'));
        expect(rowsOfTenders.map(squeeze)).toEqual(wanted.tenders.split(' · ').map(squeeze));
      }
    }
  });

  it('the closed-day list’s six rows and the new-day row each lead to their own order under the right picture', () => {
    const names = ['Table 1', 'Table 7', 'Table 4', 'Table 3', 'Table 6', 'Quick sale'];
    for (let i = 0; i < 6; i++) {
      load('/pos/closed-orders?state=dayclosed');
      const rows = [...host.querySelectorAll('.closed-row')];
      const row = rows[i + 1]!; // the open day's one order comes first
      const wanted = listRow(row);
      press(row);
      const shown = draw();
      expect(shown.name).toBe(names[i]);
      expect(shown.note).toBe(NOTE(wanted.time));
      expect(shown.notices).toContain(DAY_CLOSED);
      expect(shown.totals.at(-1)).toBe(`Total ${wanted.total}`);
    }
    load('/pos/closed-orders?state=dayclosed');
    press(host.querySelector('.closed-row')!);
    expect(draw()).toMatchObject({ name: 'Quick sale', note: NOTE('23:40', '26'), notices: [] });
  });

  it('the detail reads the list’s own fixture data: the module exports the six, once', () => {
    expect(FIXTURE_ORDERS.map((o) => o.state)).toEqual(['default', 'cash', 'custom', 'refunded', 'zero', 'quick']);
    for (const order of FIXTURE_ORDERS) {
      load(`/pos/closed-order?state=${order.state}&order=${order.state}&time=${encodeURIComponent(order.time)}`);
      expect(draw().name).toBe(order.name);
      expect(draw().note).toBe(NOTE(order.time));
    }
  });
});

// ---------------------------------------------------------------------------
// The book: a live close, an unknown id, a voided line
// ---------------------------------------------------------------------------

/** Table n by the real route: floor → order → Settle → pay → Close. Returns what the order panel showed at the settle. */
function closeTable(n: number, pay: () => void) {
  press(host.querySelector(`[data-table="${n}"]`)!);
  for (let remove = host.querySelector('.order-line__remove'); remove; remove = host.querySelector('.order-line__remove')) press(remove);
  return settleAndClose(pay);
}

/** What the order panel shows, then Settle, pay and Close. */
function settleAndClose(pay: () => void) {
  const lines = [...host.querySelectorAll('.order-line')].map((l) =>
    [
      l.querySelector('.order-line__quantity')!.textContent,
      l.querySelector('.order-line__name')!.textContent,
      l.querySelector('.order-line__detail')?.textContent ?? '',
      l.querySelector('.order-line__amount')!.textContent,
    ].join('')
  );
  const totals = [...host.querySelectorAll('.totals .totals__row:not(.totals__row--included)')].map(
    (r) => `${r.querySelector('dt')!.textContent} ${r.querySelector('dd')!.textContent}`
  );
  press(host.querySelector('.order-actions [data-action="settle"]')!);
  pay();
  press(host.querySelector('[data-action="close-order"]')!);
  return { lines, totals };
}

const wholeBalanceByCard = () => {
  press(host.querySelector('[data-method="card"]')!);
  press(host.querySelector('[data-action="add-tender"]')!);
};

/** One rupiah by card, then 9.999.999 in cash: the cash is over the balance, so change is given and cash paid only part of the total. */
const cardThenCashWithChange = () => {
  press(host.querySelector('[data-method="card"]')!);
  press(host.querySelector('[data-digit="1"]')!);
  press(host.querySelector('[data-action="add-tender"]')!);
  press(host.querySelector('[data-method="cash"]')!);
  for (let i = 0; i < 7; i++) press(host.querySelector('[data-digit="9"]')!);
  press(host.querySelector('[data-action="add-tender"]')!);
};

const closeAt = (iso: string) => vi.useFakeTimers({ toFake: ['Date'], now: new Date(iso) });
const listLink = () => [...host.querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === 'Closed orders')!;

describe('criterion 3: a live close is shown from the book', () => {
  it('Table 1 closed through the real route: its name, WIB time, own lines, tender and stored totals', () => {
    closeAt('2026-09-25T14:30:00.000Z');
    load('/pos/floor');
    const seen = closeTable(1, wholeBalanceByCard);
    press(listLink());
    const row = host.querySelector<HTMLAnchorElement>('.closed-row')!;
    expect(row.getAttribute('href')).toBe('/pos/closed-order?order=table-1');
    press(row);
    expect(path()).toBe('/pos/closed-order?order=table-1');
    const shown = draw();
    expect(shown.name).toBe('Table 1');
    expect(shown.tag).toBe('CLOSED');
    expect(shown.note).toBe(NOTE('21:30'));
    // Its own lines, as the order panel worded them. (Table 1's seed happens to be the artifact's two lines;
    // the quick sale below is the case the fixture cannot explain.)
    expect(shown.left.slice(1, 1 + seen.lines.length)).toEqual(seen.lines);
    expect(shown.left[0]).toBe(`${seen.lines.length} ${seen.lines.length === 1 ? 'line' : 'lines'} · charged items`);
    // The stored totals, exactly the panel's rows (no tax line: the artifact has none here).
    expect(shown.totals).toEqual(seen.totals);
    const total = shown.totals.at(-1)!.slice('Total '.length);
    expect(section('Original payment')).toEqual([pay('Card', total)]);
    expect(total).not.toBe('0');
    expect(shown.stored).toBe(STORED);
    expect(shown.buttons).toEqual(['Reprint receipt']);
  });

  it('a quick sale closed through the route reads Quick sale, not a fixture’s order', () => {
    closeAt('2026-09-25T14:31:00.000Z');
    load('/pos/floor');
    press([...host.querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === 'New quick sale')!);
    press(host.querySelector('[data-item="steak"]')!);
    press([...host.querySelectorAll('button')].find((b) => text(b) === 'Add to order')!);
    const seen = settleAndClose(wholeBalanceByCard);
    press(listLink());
    press(host.querySelector('.closed-row')!);
    expect(path()).toBe('/pos/closed-order?order=quick-2');
    const shown = draw();
    expect(shown).toMatchObject({ name: 'Quick sale', note: NOTE('21:31'), tag: 'CLOSED' });
    // One Steak from the menu: not the artifact's Burger with two modifiers and a Soda, and not its 155.925.
    expect(seen.lines).toHaveLength(1);
    expect(shown.left.slice(0, 3)).toEqual(['1 line · charged items', seen.lines[0], 'Original payment']);
    expect(shown.left).not.toContain(BURGER);
    expect(shown.totals).toEqual(seen.totals);
    expect(shown.totals.at(-1)).not.toBe('Total 155.925');
    expect(shown.totals.at(-1)).not.toBe('Total 173.250');
    expect(section('Original payment')).toEqual([pay('Card', shown.totals.at(-1)!.slice('Total '.length))]);
  });
});

describe('criterion 4: an unknown book id is an error, not a fixture', () => {
  it('/pos/closed-order?order=table-1 on a fresh load draws the error composition, no line and no money', () => {
    load('/pos/closed-order?order=table-1');
    expect(draw()).toEqual({
      ...DEFAULT,
      ...UNAVAILABLE,
      message: 'Could not load this orderNo order details are available. Try again.Retry',
      buttons: ['Retry'],
      notices: [],
      why: [],
    });
    expect(screen().querySelector('.closed-line')).toBeNull();
    expect(screen().textContent).not.toMatch(/\d\.\d{3}/);
    expect(path()).toBe('/pos/closed-order?order=table-1');
  });

  it('Retry reads the book again, and finds the order once the book holds it', () => {
    const held: BookEntry[] = [];
    const book = stubBook(held);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    expect(draw().message).toMatch(/^Could not load this order/);
    press(screen().querySelector('[data-action="retry-load"]')!);
    expect(draw().message).toMatch(/^Could not load this order/);
    held.push(closedEntry('table-5', { lines: [line_('a', 'Soup', 50_000n)], tenders: [{ label: 'Card', amount: 52_500n }] }));
    press(screen().querySelector('[data-action="retry-load"]')!);
    expect(draw()).toMatchObject({ name: 'Table 5', tag: 'CLOSED' });
  });

  it('an order the book holds still open is not a closed order', () => {
    const book = stubBook([{ ...closedEntry('table-5', { lines: [line_('a', 'Soup', 50_000n)] }), status: 'open', closedAt: undefined }]);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    expect(draw().message).toMatch(/^Could not load this order/);
    expect(screen().querySelector('.closed-line')).toBeNull();
  });

  it('the error picture’s Retry shows default for a fixture address', () => {
    load('/pos/closed-order?state=error');
    press(screen().querySelector('[data-action="retry-load"]')!);
    expect(draw()).toEqual(DEFAULT);
  });
});

// A hand-built book: only `orders()`, which is all POS-06 reads.
type BookEntry = ReturnType<OrderBook['orders']>[number];

const line_ = (id: string, name: string, amount: bigint, status: OrderLine['status'] = 'fired', extra: Partial<OrderLine> = {}): OrderLine => ({
  id,
  quantity: 1,
  name,
  amount,
  status,
  ...extra,
});

function closedEntry(
  id: string,
  { lines, tenders = [], change = 0n, discount }: { lines: OrderLine[]; tenders?: Array<{ label: string; amount: bigint }>; change?: bigint; discount?: Parameters<typeof orderTotals>[1] }
): BookEntry {
  const charged = lines.filter((l) => l.status !== 'voided');
  const order: ShownOrder = {
    title: `Order · ${id}`,
    groups: [{ kind: 'fired', round: 1, firedAt: '2026-09-25T14:00:00.000Z', delivery: 'queued', lines }],
    totals: orderTotals(charged.reduce((sum, l) => sum + l.amount, 0n), discount),
    ...(discount && { applied: discount }),
  };
  return { id, status: 'closed', order, closedAt: '2026-09-25T14:30:00.000Z', tenders, change };
}

const stubBook = (held: BookEntry[]): OrderBook => ({ orders: () => held }) as unknown as OrderBook;

describe('criterion 5: voided lines are not charged', () => {
  it('a book order closed with a voided line lists and counts only the others', () => {
    const book = stubBook([
      closedEntry('table-5', {
        lines: [
          line_('a', 'Soup', 50_000n),
          line_('b', 'Cheesecake', 40_000n, 'voided', { note: 'Voided 20:01 · approved by M. Iqbal' }),
          line_('c', 'Tea', 20_000n, 'fired', { quantity: 3, modifiers: [{ name: 'Iced' }, { name: 'Less sugar', delta: -2_000n }] }),
        ],
        tenders: [{ label: 'Card', amount: 77_000n }],
      }),
    ]);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    const shown = draw();
    expect(shown.left).toEqual([
      '2 lines · charged items',
      line(1, 'Soup', '', '50.000'),
      line(3, 'Tea', 'Iced · Less sugar (−2.000)', '20.000'),
      'Original payment',
      pay('Card', '77.000'),
    ]);
    expect(screen().textContent).not.toMatch(/Cheesecake|Voided/);
    // The stored totals are the order's own: 70.000 subtotal, 5% service charge, 73.500 total.
    expect(shown.totals).toEqual(['Subtotal 70.000', 'Service charge 5% 3.500', 'Total 73.500']);
  });

  it('counts lines, not units', () => {
    const book = stubBook([closedEntry('table-5', { lines: [line_('a', 'Soup', 150_000n, 'fired', { quantity: 3 })] })]);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    expect(draw().left[0]).toBe('1 line · charged items');
  });
});

describe('criterion 6: the cash contribution is the cash tendered less the change', () => {
  it('the helper reads cash tenders only, less the change', () => {
    expect(cashContribution([{ label: 'Cash', amount: 200_000n }], 44_075n)).toBe(155_925n);
    expect(
      cashContribution(
        [
          { label: 'Card', amount: 1n },
          { label: 'Cash', amount: 9_999_999n },
        ],
        9_844_075n
      )
    ).toBe(155_924n);
    expect(cashContribution([{ label: 'Card', amount: 100_000n }], 0n)).toBe(0n);
  });

  it('for the cash fixture both the row and the detail still read 155.925', () => {
    load('/pos/closed-orders');
    expect(text(host.querySelector('.closed-row:nth-child(3) .closed-muted')!)).toBe('Change 44.075 · contribution 155.925');
    load('/pos/closed-order?state=cash');
    expect(section('Original payment')).toContain(pay('Cash contribution', '155.925'));
  });

  it('a book order that took a card then cash with change shows tendered less change on the row and the detail, never the total', () => {
    closeAt('2026-09-25T14:30:00.000Z');
    load('/pos/floor');
    closeTable(9, cardThenCashWithChange);
    press(listLink());
    const row = host.querySelector<HTMLAnchorElement>('.closed-row')!;
    const total = BigInt(text(row.lastElementChild!).replaceAll('.', ''));
    const change = 10_000_000n - total;
    const contribution = 9_999_999n - change;
    expect(contribution).toBe(total - 1n);
    expect(text(row.querySelector('.closed-muted')!)).toBe(`Change ${formatAmount(change)} · contribution ${formatAmount(contribution)}`);
    press(row);
    const paid = section('Original payment');
    expect(paid).toEqual([
      pay('Card', '1'),
      pay('Cash', '9.999.999'),
      pay('Change given', formatAmount(-change)),
      pay('Cash contribution', formatAmount(contribution)),
    ]);
    expect(paid).not.toContain(pay('Cash contribution', formatAmount(total)));
  });
});

// ---------------------------------------------------------------------------
// Criterion 7, 8 — the figures
// ---------------------------------------------------------------------------

describe('criterion 7: no discount row without a discount', () => {
  it('quick and a book order with no discount draw three rows; zero draws Comp 100% at −165.000 and a total of 0', () => {
    load('/pos/closed-order?state=quick');
    expect(draw().totals).toHaveLength(3);
    load('/pos/closed-order?state=zero');
    expect(draw().totals).toEqual(['Subtotal 165.000', 'Comp 100% −165.000', 'Service charge 5% 0', 'Total 0']);
    const book = stubBook([closedEntry('table-5', { lines: [line_('a', 'Soup', 100_000n)], tenders: [{ label: 'Card', amount: 105_000n }] })]);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    expect(draw().totals).toEqual(['Subtotal 100.000', 'Service charge 5% 5.000', 'Total 105.000']);
  });

  it('a book order with a discount shows its stored label and a minus sign, read from the order’s totals', () => {
    const discount = { name: 'Staff meal', value: { kind: 'percent', percent: '10' } } as Parameters<typeof orderTotals>[1];
    const book = stubBook([closedEntry('table-5', { lines: [line_('a', 'Soup', 100_000n)], discount })]);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    expect(draw().totals).toEqual(['Subtotal 100.000', 'Staff meal 10% −10.000', 'Service charge 5% 4.500', 'Total 94.500']);
  });

  it('a book order with a total of 0 reads as no payment taken and offers no refund reason but that', () => {
    const discount = { name: 'Comp', value: { kind: 'percent', percent: '100' } } as Parameters<typeof orderTotals>[1];
    const book = stubBook([closedEntry('table-5', { lines: [line_('a', 'Soup', 100_000n)], discount })]);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    expect(section('Original payment')).toEqual(['No payment taken · fully discounted']);
    expect(draw().why).toEqual(['No payment taken · fully discounted.']);
    expect(draw().totals.at(-1)).toBe('Total 0');
  });
});

describe('criterion 8: a reprint result changes no figure', () => {
  it('every reprint state’s totals, payment and lines equal default’s (AC-13)', () => {
    load('/pos/closed-order?state=default');
    const base = draw();
    for (const id of ['reprint', 'reprint-unknown', 'reprint-sent', 'reprint-printed']) {
      load(`/pos/closed-order?state=${id}`);
      const shown = draw();
      expect(shown.totals, id).toEqual(base.totals);
      expect(shown.left, id).toEqual(base.left);
      expect(shown.stored, id).toBe(base.stored);
      expect(shown.name, id).toBe(base.name);
    }
  });

  it('pressing Reprint changes no figure either', () => {
    load('/pos/closed-order?state=cash');
    const before = draw();
    press(reprint());
    const after = draw();
    expect({ ...after, notices: [] }).toEqual({ ...before, notices: [] });
  });
});

// ---------------------------------------------------------------------------
// Criterion 9 — reprint
// ---------------------------------------------------------------------------

describe('criterion 9: reprint', () => {
  const TIME = /\d{1,2}:\d{2}/;

  it('pressing Reprint receipt shows Reprint sent with no time, in default, zero, refunded and dayclosed, and the other notices stay', () => {
    const wanted: Record<string, string[]> = {
      default: ['Reprint sent'],
      zero: ['Reprint sent'],
      refunded: [REFUNDED, 'Reprint sent'],
      dayclosed: [DAY_CLOSED, 'Reprint sent'],
    };
    for (const [state, notices] of Object.entries(wanted)) {
      load(`/pos/closed-order?state=${state}`);
      const before = draw();
      press(reprint());
      const after = draw();
      expect(after.notices, state).toEqual(notices);
      expect(after.notices.at(-1), state).not.toMatch(TIME);
      expect(after.buttons, state).toEqual(['Reprint receipt']);
      expect(after.why, state).toEqual(before.why);
      expect(after.tag, state).toBe(before.tag);
    }
  });

  it('on a book order it shows Reprint sent too, and changes nothing else', () => {
    const book = stubBook([closedEntry('table-5', { lines: [line_('a', 'Soup', 100_000n)], tenders: [{ label: 'Card', amount: 105_000n }] })]);
    act(() => root.render(<ClosedOrderScreen search="?order=table-5" book={book} />));
    const before = draw();
    press(reprint());
    expect(draw()).toEqual({ ...before, notices: ['Reprint sent'] });
  });

  it('a result replaces the previous result: Reprint sent over a failure, and over itself', () => {
    load('/pos/closed-order?state=reprint');
    press(reprint());
    expect(draw().notices).toEqual(['Reprint sent']);
    press(reprint());
    expect(draw().notices).toEqual(['Reprint sent']);
  });

  it('a failure is the receipt class (amber), never the emergency class, with a client-side link to the incidents screen', () => {
    for (const state of ['reprint', 'reprint-unknown']) {
      load(`/pos/closed-order?state=${state}`);
      const notice = screen().querySelector('.closed-notice')!;
      expect(notice.className).toBe('closed-notice');
      expect(screen().querySelector('.incident--emergency, .emergency-banner')).toBeNull();
      expect(notice.getAttribute('role')).toBe('status');
      const a = link('View receipt incidents');
      expect(a.getAttribute('href')).toBe('/pos/incidents');
      expect(a.tagName).toBe('A');
    }
    // The plain results are not the amber class.
    for (const state of ['reprint-sent', 'reprint-printed', 'refunded']) {
      load(`/pos/closed-order?state=${state}`);
      expect(screen().querySelector('.closed-notice')!.className, state).toBe('closed-notice closed-notice--plain');
    }
  });

  it('the printed time appears only in the printed fixture', () => {
    for (const { id } of DETAIL_STATES) {
      load(`/pos/closed-order?state=${id}`);
      const shown = text(screen().querySelector('.closed-content')?.querySelector('.closed-notice') ?? screen());
      if (id !== 'reprint-printed' && id !== 'refunded' && id !== 'loading' && id !== 'error') {
        expect(shown.match(/PRINTED/), id).toBeNull();
      }
    }
  });

  it('a reprint creates nothing: the incidents screen is untouched and no history entry is made', () => {
    load('/pos/closed-order?state=default');
    const length = window.history.length;
    press(reprint());
    expect(window.history.length).toBe(length);
    expect(path()).toBe('/pos/closed-order?state=default');
  });
});

// ---------------------------------------------------------------------------
// Criterion 10 — no refund, no void
// ---------------------------------------------------------------------------

describe('criterion 10: no refund, no void', () => {
  it('no state draws a Refund or void control, hidden or otherwise, and the three reasons read as the artifact has them', () => {
    for (const { id } of DETAIL_STATES) {
      load(`/pos/closed-order?state=${id}`);
      const s = screen();
      expect(text(s), id).not.toMatch(/refund this|void|release|manager|approval pin/i);
      expect(s.querySelectorAll('[data-action="refund"], [data-action="void"]'), id).toHaveLength(0);
      // The only buttons are Reprint receipt and Retry; the only anchors the way back and the incidents link.
      for (const b of s.querySelectorAll('button')) expect(['Reprint receipt', 'Retry'], id).toContain(text(b));
      for (const a of s.querySelectorAll('a')) expect(['← Closed orders', 'View receipt incidents'], id).toContain(text(a));
      expect(s.querySelectorAll('[hidden], [aria-hidden="true"]'), id).toHaveLength(0);
    }
    const reasons: Record<string, string> = {
      zero: 'No payment taken · fully discounted.',
      refunded: 'Already refunded · this order is final.',
      dayclosed: 'Refund unavailable · business day closed.',
    };
    for (const [state, reason] of Object.entries(reasons)) {
      load(`/pos/closed-order?state=${state}`);
      expect(draw().why).toEqual([reason]);
    }
  });

  it('Reprint receipt is present and live in every state that shows an order, and ungated', () => {
    for (const { id } of DETAIL_STATES) {
      if (id === 'loading' || id === 'error') continue;
      load(`/pos/closed-order?state=${id}`);
      const b = reprint();
      expect(b.tagName, id).toBe('BUTTON');
      expect(b.hasAttribute('disabled'), id).toBe(false);
      expect(b.getAttribute('aria-disabled'), id).toBeNull();
    }
  });

  it('Release is not drawn', () => {
    load('/pos/closed-order');
    expect(text(screen())).not.toMatch(/Release/);
  });
});

// ---------------------------------------------------------------------------
// Criterion 11 — leaving
// ---------------------------------------------------------------------------

describe('criterion 11: leaving keeps the context', () => {
  const sentinel = () => {
    (window as unknown as { __sentinel?: number }).__sentinel = 31;
  };
  const stable = () => expect((window as unknown as { __sentinel?: number }).__sentinel).toBe(31);
  function click(el: Element, init: MouseEventInit = {}) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    act(() => {
      el.dispatchEvent(event);
    });
    return event;
  }

  it('← Closed orders returns to the plain list from the open day', () => {
    load('/pos/closed-orders');
    sentinel();
    click(host.querySelector('.closed-row')!);
    const event = click(link('← Closed orders'));
    expect(event.defaultPrevented).toBe(true);
    expect(path()).toBe('/pos/closed-orders');
    stable();
    expect(host.querySelector('.closed-row')).not.toBeNull();
  });

  it('and to ?state=dayclosed from a closed-day order, and from the new-day order reached with list=dayclosed', () => {
    for (const url of ['/pos/closed-order?state=dayclosed&order=cash&time=20%3A11', '/pos/closed-order?state=quick&order=quick&time=23%3A40&list=dayclosed', '/pos/closed-order?state=dayclosed']) {
      load(url);
      expect(link('← Closed orders').getAttribute('href'), url).toBe('/pos/closed-orders?state=dayclosed');
      sentinel();
      click(link('← Closed orders'));
      expect(path(), url).toBe('/pos/closed-orders?state=dayclosed');
      stable();
    }
  });

  it('every other state leaves for the plain list, and a book order does too', () => {
    for (const { id } of DETAIL_STATES) {
      if (id === 'dayclosed') continue;
      load(`/pos/closed-order?state=${id}`);
      expect(link('← Closed orders').getAttribute('href'), id).toBe('/pos/closed-orders');
    }
    load('/pos/closed-order?order=table-1');
    expect(link('← Closed orders').getAttribute('href')).toBe('/pos/closed-orders');
  });

  it('the incidents link is pushState with the document untouched, and a modified click is left to the browser', () => {
    load('/pos/closed-order?state=reprint');
    sentinel();
    const event = click(link('View receipt incidents'));
    expect(event.defaultPrevented).toBe(true);
    expect(path()).toBe('/pos/incidents');
    stable();

    load('/pos/closed-order?state=reprint');
    let preventedByUs: boolean | undefined;
    const observe = (e: Event) => {
      preventedByUs = e.defaultPrevented;
      e.preventDefault();
    };
    document.body.addEventListener('click', observe);
    click(link('View receipt incidents'), { ctrlKey: true });
    click(link('← Closed orders'), { metaKey: true });
    document.body.removeEventListener('click', observe);
    expect(preventedByUs).toBe(false);
    expect(path()).toBe('/pos/closed-order?state=reprint');
  });

  it('acting is a <button> and going is an <a>', () => {
    load('/pos/closed-order?state=reprint');
    expect(reprint().tagName).toBe('BUTTON');
    expect(link('← Closed orders').tagName).toBe('A');
    expect(link('View receipt incidents').tagName).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// Criterion 12 — touch at 1280×800
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../src/pos.css'), 'utf8');
const rule = (selector: string) => {
  const found = [...css.matchAll(/(^|\n)([^{}]+)\{([^}]*)\}/g)].filter((m) => m[2]!.split(',').map((s) => s.trim()).includes(selector));
  return found.map((m) => m[3]).join('\n');
};

describe('criterion 12: touch at 1280×800 (structure; the lead walks the rendering)', () => {
  it('in overflow the lines scroll in the left column and the summary sits beside it, outside the scroller', () => {
    load('/pos/closed-order?state=overflow');
    const scroller = screen().querySelector<HTMLElement>('.closed-content')!;
    const summary = screen().querySelector('.closed-summary')!;
    expect(scroller.classList.contains('closed-scroll')).toBe(true);
    expect(scroller.getAttribute('tabindex')).toBe('0');
    expect(scroller.getAttribute('role')).toBe('region');
    expect(scroller.querySelectorAll('.closed-line')).toHaveLength(20 + 1);
    expect(scroller.contains(summary)).toBe(false);
    expect(summary.parentElement).toBe(scroller.parentElement);
    expect(summary.contains(screen().querySelector('.closed-figures dl'))).toBe(true);
    expect(summary.contains(reprint())).toBe(true);
    expect(rule('.closed-scroll')).toMatch(/overflow-y:\s*auto/);
    expect(rule('.closed-scroll')).toMatch(/min-height:\s*0/);
    expect(rule('.closed-body')).toMatch(/min-height:\s*0/);
    expect(rule('.closed-body')).toMatch(/display:\s*flex/);
  });

  it('the summary is the order panel’s width, does not shrink, does not scroll, and the column beside it can shrink', () => {
    expect(rule('.closed-summary')).toMatch(/width:\s*var\(--frost-order-panel-width\)/);
    expect(rule('.closed-summary')).toMatch(/flex:\s*none/);
    expect(rule('.closed-summary')).not.toMatch(/overflow/);
    expect(rule('.closed-content')).toMatch(/min-width:\s*0/);
  });

  it('nothing in the scrolling column has a z-index, so a sheet paints over it', () => {
    for (const selector of ['.closed-content', '.closed-line', '.closed-group', '.closed-note', '.closed-notice', '.closed-quantity', '.closed-scroll']) {
      expect(rule(selector), selector).not.toMatch(/z-index/);
    }
    const sticky = [...css.matchAll(/(^|\n)([^{}]+)\{([^}]*)\}/g)].filter((m) => /\.closed-(content|line|group|note|notice)\b/.test(m[2]!) && /position:\s*sticky/.test(m[3]!));
    expect(sticky).toHaveLength(0);
  });

  it('the hover fills of the new controls are scoped to hover-capable devices', () => {
    expect(css).not.toMatch(/\.closed-(line|summary|notice)[^{]*:hover/);
  });
});

describe('the URL scheme', () => {
  it('an order with no state is a book id; anything with a state is the artifact’s own scheme', () => {
    expect(detailRequestFrom('?order=table-1')).toEqual({ source: 'book', id: 'table-1' });
    expect(detailRequestFrom('?state=default&order=table-1')).toMatchObject({ source: 'fixture', fixture: 'table-1' });
    expect(detailRequestFrom('?state=cash')).toMatchObject({ source: 'fixture', state: 'cash', fixture: 'cash' });
    expect(detailRequestFrom('?state=overflow')).toMatchObject({ state: 'overflow', fixture: 'long' });
    expect(detailRequestFrom('')).toMatchObject({ source: 'fixture', state: 'default', fixture: 'default' });
  });

  it('an unknown fixture order under a fixture state is Table 1’s own order, as the artifact reads it — never a book lookup', () => {
    load('/pos/closed-order?state=default&order=table-1');
    expect(draw()).toEqual(DEFAULT);
  });

  it('the trailing slash and the dev state links work', () => {
    load('/pos/closed-order/?state=cash');
    expect(draw().name).toBe('Table 7');
    const nav = [...host.querySelectorAll('.fixture-states a')].map((a) => a.getAttribute('href'));
    expect(nav).toEqual(DETAIL_STATES.map((s) => `?state=${s.id}`));
  });
});
