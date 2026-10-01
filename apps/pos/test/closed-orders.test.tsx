// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSED_STATES, keyed, rangeIsValid, wibTime, type ClosedState } from '../src/closedOrders.js';
import { PosRoutes } from '../src/PosRoutes.js';

// FE-030 / POS-05: the closed orders list, its three touch filters and the
// closed-day grouping. Read-only.

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

const back = async () => {
  const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
  act(() => window.history.back());
  await act(async () => popped);
};
const link = (label: string) => [...host.querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === label)!;
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === label)!;
const action = (name: string) => host.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]');
const key = (k: string) => press(host.querySelector(`.keypad [data-key="${k}"]`)!);
const keys = (digits: string) => [...digits].forEach(key);
/** The time sheet's two fields, each cleared and keyed. */
function range(from: string, to: string) {
  for (const [field, digits] of [['from', from], ['to', to]] as const) {
    press(host.querySelector(`[data-field="${field}"]`)!);
    key('Clear');
    keys(digits);
  }
}

/** One row, each cell apart: the payment cell is its tender text, its change line, and its tag. */
function rowOf(a: Element) {
  const [time, name, pay, total] = [...a.children];
  return {
    time: text(time!),
    name: text(name!),
    pay: [...pay!.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('')
      .trim(),
    note: pay!.querySelector('.closed-muted')?.textContent ?? '',
    tag: pay!.querySelector('.closed-tag')?.textContent ?? '',
    total: text(total!),
    href: a.getAttribute('href'),
  };
}
const rows = () => [...host.querySelectorAll('.closed-row')].map(rowOf);
const names = () => rows().map((r) => r.name);
const toolbar = () => [...host.querySelectorAll('.closed-filter')].map((f) => text(f.querySelector('button')!));
const emptyBox = () => host.querySelector('.closed-empty');

// The artifact's six (closed.js:13–20).
const SIX = [
  { time: '20:14', name: 'Table 1', pay: 'Card 100.000 · Cash 55.925', note: '', tag: '', total: '155.925', href: '/pos/closed-order?state=default&order=default&time=20%3A14' },
  { time: '20:11', name: 'Table 7', pay: 'Cash 200.000', note: 'Change 44.075 · contribution 155.925', tag: '', total: '155.925', href: '/pos/closed-order?state=cash&order=cash&time=20%3A11' },
  {
    time: '20:04',
    name: 'Table 4',
    pay: 'Card 40.000 · Card 30.000 · Meal voucher 20.000 · Card 10.000 · Staff account 20.000 · Cash 35.925',
    note: '',
    tag: '',
    total: '155.925',
    href: '/pos/closed-order?state=custom&order=custom&time=20%3A04',
  },
  { time: '19:58', name: 'Table 3', pay: 'Cash 155.925', note: '', tag: 'REFUNDED', total: '155.925', href: '/pos/closed-order?state=refunded&order=refunded&time=19%3A58' },
  { time: '19:41', name: 'Table 6', pay: 'Comp 100% · no payment taken', note: '', tag: '', total: '0', href: '/pos/closed-order?state=zero&order=zero&time=19%3A41' },
  { time: '19:20', name: 'Quick sale', pay: 'Card 173.250', note: '', tag: '', total: '173.250', href: '/pos/closed-order?state=quick&order=quick&time=19%3A20' },
];

const DAY_OPEN = 'Business day open · 25 Sep';
const BANNER = '25 Sep · Business day closed at 23:14The open day’s orders are listed first. Orders from 25 Sep follow, read-only: reprinting still works, refunds are unavailable.';
const CLOSED_GROUP = 'Closed day · 25 Sep · reprint only';
const NOMATCH = 'No matching ordersNo order matches these table, time and amount filters.Clear filters';

type Expectation = {
  rows?: ReadonlyArray<ReturnType<typeof rowOf>>;
  rowCount?: number;
  message?: string;
  toolbar?: ReadonlyArray<string>;
  banner?: boolean;
  dialog?: string;
};
const ANY = ['Any · Set', 'Any · Set', 'Any · Set'];

// ---------------------------------------------------------------------------
// Criterion 1 — the eleven states as the artifact draws them
// ---------------------------------------------------------------------------

const EXPECTED: Record<ClosedState, Expectation> = {
  default: { rows: SIX },
  empty: { message: 'No closed orders yet todayOrders appear here once they are closed.' },
  loading: { message: 'Loading closed orders…Reading this business day’s orders.' },
  error: { message: 'Could not load closed ordersTry again to read this business day.Retry' },
  overflow: { rowCount: 36 },
  nomatch: { message: NOMATCH, toolbar: ['Table 12 · Set', 'Any · Set', '500.000 · Set'] },
  dayclosed: { banner: true },
  'dayclosed-start': { banner: true },
  'filter-table': { rows: SIX, dialog: 'Find by tableFILTER' },
  'filter-time': { rows: SIX, dialog: 'Find by closing timeFILTER' },
  'filter-amount': { rows: SIX, dialog: 'Find by amountFILTER' },
};

describe('criterion 1: every state draws what the artifact draws', () => {
  it('declares the artifact’s eleven states, in its order', () => {
    expect(CLOSED_STATES.map((s) => s.id)).toEqual(Object.keys(EXPECTED));
  });

  for (const { id } of CLOSED_STATES) {
    it(`${id}: header, toolbar, day line or banner, and rows or message`, () => {
      load(`/pos/closed-orders?state=${id}`);
      const want = EXPECTED[id];
      const screen = host.querySelector('.closed')!;
      expect(screen.getAttribute('data-closed-state')).toBe(id);

      // The header: ← Floor, the h1, the tag, the actor and the idle figure. No Release.
      expect(text(host.querySelector('.closed-head')!)).toBe('← FloorClosed ordersDAY OPENAna R. · Cashier90s');
      expect(host.querySelector('a[href="/pos/lock"], [data-action="release"]')).toBeNull();
      expect(text(host)).not.toContain('Release');

      // The day line, or the amber banner instead of it.
      if (want.banner) {
        expect(text(host.querySelector('.closed-notice')!)).toBe(BANNER);
        expect(text(host)).not.toContain(DAY_OPEN);
      } else {
        expect(text(host.querySelector('.closed-note')!)).toBe(DAY_OPEN);
        expect(host.querySelector('.closed-notice')).toBeNull();
      }

      // The toolbar: three filters, each showing its value, and Reset. No Search.
      expect(toolbar()).toEqual(want.toolbar ?? ANY);
      expect([...host.querySelectorAll('.closed-toolbar > button')].map(text)).toEqual(['Reset']);
      expect(button('Search')).toBeUndefined();

      // Column heads, then the list.
      expect([...host.querySelector('.closed-listhead')!.children].map(text)).toEqual(['Closed at', 'Order', 'Payment taken', 'Total']);
      if (want.rows) expect(rows()).toEqual(want.rows);
      if (want.rowCount !== undefined) expect(rows()).toHaveLength(want.rowCount);
      if (want.message) {
        expect(rows()).toHaveLength(0);
        expect(text(emptyBox()!)).toBe(want.message);
      }
      if (want.dialog) expect(text(dialog()!.querySelector('.sheet__head')!)).toBe(want.dialog);
      else expect(dialog()).toBeNull();
    });
  }

  it('overflow lists the artifact’s 36 rows: the six repeated, an hour apart every six', () => {
    load('/pos/closed-orders?state=overflow');
    const all = rows();
    expect(all).toHaveLength(36);
    expect(all[0]).toMatchObject({ time: '20:54', name: 'Table 1', pay: 'Card 100.000 · Cash 55.925', total: '155.925' });
    expect(all[5]).toMatchObject({ time: '20:14', name: 'Quick sale', total: '173.250' });
    expect(all[6]).toMatchObject({ time: '19:54', name: 'Table 1' });
    expect(all[35]).toMatchObject({ time: '15:14', name: 'Quick sale' });
    // closed.js:39: a trading day’s Table 4 summarises its split to the labels.
    expect(all[2]).toMatchObject({ name: 'Table 4', pay: 'Card · Meal voucher · Staff account · Cash' });
    expect(all[3]).toMatchObject({ name: 'Table 3', tag: 'REFUNDED' });
  });

  it('dayclosed lists the open day’s one quick sale, then the six under the closed-day group', () => {
    load('/pos/closed-orders?state=dayclosed');
    const groups = [...host.querySelectorAll('.closed-group')].map(text);
    expect(groups).toEqual(['Business day open · 26 Sep', CLOSED_GROUP]);
    expect(rows()).toHaveLength(7);
    expect(rows()[0]).toMatchObject({ time: '23:40', name: 'Quick sale', pay: 'Card 173.250', total: '173.250' });
    expect(rows().slice(1).map((r) => r.name)).toEqual(SIX.map((r) => r.name));
  });

  it('dayclosed-start’s first group says no order has closed in the new business day', () => {
    load('/pos/closed-orders?state=dayclosed-start');
    expect([...host.querySelectorAll('.closed-group')].map(text)).toEqual(['Business day open · 26 Sep', CLOSED_GROUP]);
    expect(text(host.querySelector('.closed-scroll .closed-note')!)).toBe('No orders closed yet in this business day.');
    expect(rows()).toHaveLength(6);
  });

  it('an unknown ?state= draws default', () => {
    load('/pos/closed-orders?state=nonsense');
    expect(host.querySelector('.closed')!.getAttribute('data-closed-state')).toBe('default');
  });

  it('error’s Retry shows default; Reset on empty shows default', () => {
    load('/pos/closed-orders?state=error');
    press(button('Retry'));
    expect(rows()).toEqual(SIX);
    load('/pos/closed-orders?state=empty');
    press(button('Reset'));
    expect(rows()).toEqual(SIX);
  });
});

// ---------------------------------------------------------------------------
// Criteria 2 to 4 — what the book closed
// ---------------------------------------------------------------------------

/** Table n by the real route: floor → order → Settle → Card for the whole balance → Close. Returns to the floor. */
function closeTable(n: number) {
  press(host.querySelector(`[data-table="${n}"]`)!);
  // A table order will not close with a line pending (FR-G10): take each one off.
  for (let remove = host.querySelector('.order-line__remove'); remove; remove = host.querySelector('.order-line__remove')) press(remove);
  press(host.querySelector('.order-actions [data-action="settle"]')!);
  press(host.querySelector('[data-method="card"]')!);
  press(host.querySelector('[data-action="add-tender"]')!);
  press(host.querySelector('[data-action="close-order"]')!);
}

function closeQuickSale() {
  press(link('New quick sale'));
  press(host.querySelector('[data-item="burger"]')!);
  press(button('Add to order'));
  press(host.querySelector('.order-actions [data-action="settle"]')!);
  press(host.querySelector('[data-method="card"]')!);
  press(host.querySelector('[data-action="add-tender"]')!);
  press(host.querySelector('[data-action="close-order"]')!);
}

/** 2026-09-25T14:30Z is 21:30 in WIB. */
const closeAt = (iso: string) => vi.useFakeTimers({ toFake: ['Date'], now: new Date(iso) });

describe('criteria 2 and 4: a live close is listed, newest first', () => {
  it('Table 1 closed through the real route is listed with its WIB time, tenders and total, above the fixtures', () => {
    closeAt('2026-09-25T14:30:00.000Z');
    load('/pos/floor');
    closeTable(1);
    press(link('Closed orders'));
    expect(path()).toBe('/pos/closed-orders');
    const [live, ...rest] = rows();
    expect(rest).toEqual(SIX);
    expect(live).toMatchObject({ time: '21:30', name: 'Table 1', href: '/pos/closed-order?order=table-1', tag: '', note: '' });
    // One card tender for the whole of what the order totals: the row’s two figures are the same fact.
    expect(live!.pay).toBe(`Card ${live!.total}`);
    expect(live!.total).not.toBe('0');
  });

  it('a quick sale closed the same way reads Quick sale', () => {
    closeAt('2026-09-25T14:31:00.000Z');
    load('/pos/floor');
    closeQuickSale();
    press(link('Closed orders'));
    const [live] = rows();
    expect(live).toMatchObject({ time: '21:31', name: 'Quick sale', href: '/pos/closed-order?order=quick-2' });
    expect(live!.pay).toBe(`Card ${live!.total}`);
    expect(names().filter((n) => n === 'Quick sale')).toHaveLength(2);
  });

  it('book orders are newest first among themselves, and above the fixtures', () => {
    closeAt('2026-09-25T14:30:00.000Z');
    load('/pos/floor');
    closeTable(9);
    vi.setSystemTime(new Date('2026-09-25T14:45:00.000Z'));
    closeTable(12);
    press(link('Closed orders'));
    expect(rows().slice(0, 3).map((r) => [r.time, r.name])).toEqual([
      ['21:45', 'Table 12'],
      ['21:30', 'Table 9'],
      ['20:14', 'Table 1'],
    ]);
  });

  it('is listed in default and under a filter over it, and not in the pictures that list only the fixtures', () => {
    closeAt('2026-09-25T14:30:00.000Z');
    load('/pos/floor');
    closeTable(9);
    press(link('Closed orders'));
    expect(rows()).toHaveLength(7);
    press(action('filter-table'));
    press(host.querySelector('[data-value="Table 9"]')!);
    press(action('apply-filter'));
    expect(names()).toEqual(['Table 9']);
    // The other states are pictures: they list their own fixtures only.
    for (const state of ['overflow', 'dayclosed', 'dayclosed-start', 'empty']) {
      window.history.pushState(null, '', `/pos/closed-orders?state=${state}`);
      act(() => window.dispatchEvent(new PopStateEvent('popstate')));
      expect(names()).not.toContain('Table 9');
    }
  });

  it('a zero-total table order closed live reads its own words, never a fixture’s', () => {
    closeAt('2026-09-25T14:30:00.000Z');
    // The fixture `zero` is the order a 100% comp leaves, and a cold visit to its settlement seeds it.
    load('/pos/settlement?state=zero');
    press(host.querySelector('[data-action="close-order"]')!);
    press(link('Closed orders'));
    const [live] = rows();
    expect(live).toMatchObject({ time: '21:30', name: 'Table 1', pay: 'Comp 100% · no payment taken', total: '0', note: '' });
  });
});

describe('criterion 3: WIB, not the machine’s zone', () => {
  it('2026-09-25T13:14:00.000Z is 20:14, in any process time zone', () => {
    const before = process.env.TZ;
    try {
      for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Jakarta', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        expect(wibTime('2026-09-25T13:14:00.000Z')).toBe('20:14');
      }
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });

  it('crosses midnight on the 24-hour clock: 17:05Z is 00:05, not 24:05', () => {
    expect(wibTime('2026-09-25T17:05:00.000Z')).toBe('00:05');
    expect(wibTime('2026-09-25T16:59:00.000Z')).toBe('23:59');
  });

  it('the listed row shows it', () => {
    closeAt('2026-09-25T13:14:00.000Z');
    load('/pos/floor');
    closeTable(9);
    press(link('Closed orders'));
    expect(rows()[0]).toMatchObject({ time: '20:14', name: 'Table 9' });
  });
});

// ---------------------------------------------------------------------------
// Criterion 5 — no receipt number
// ---------------------------------------------------------------------------

describe('criterion 5: no receipt number anywhere', () => {
  it('no state, row, column head, filter or sheet names or shows one', () => {
    for (const { id } of CLOSED_STATES) {
      load(`/pos/closed-orders?state=${id}`);
      const screen = host.querySelector('.closed')!;
      expect(text(screen), id).not.toMatch(/receipt|invoice|\bno\.|number|#/i);
      expect(screen.querySelector('input'), id).toBeNull();
    }
    // The sheets: every one of the three.
    for (const sheet of ['table', 'time', 'amount']) {
      load(`/pos/closed-orders?state=filter-${sheet}`);
      expect(text(dialog()!)).not.toMatch(/receipt|invoice|number|#/i);
    }
  });

  it('a row’s link names the order, never a receipt', () => {
    load('/pos/closed-orders');
    for (const r of rows()) expect(r.href).not.toMatch(/receipt/i);
  });
});

// ---------------------------------------------------------------------------
// Criterion 6 — filters apply at once and combine
// ---------------------------------------------------------------------------

describe('criterion 6: filters apply at once and combine', () => {
  const setTable = (name: string) => {
    press(action('filter-table'));
    press(host.querySelector(`[data-value="${name}"]`)!);
    press(action('apply-filter'));
  };
  const setAmount = (digits: string) => {
    press(action('filter-amount'));
    key('Clear');
    keys(digits);
    press(action('apply-filter'));
  };

  it('Table 7 lists only Table 7, with no further press; amount 155.925 keeps it; Table 12 matches nothing; Reset shows all six', () => {
    load('/pos/closed-orders');
    setTable('Table 7');
    expect(names()).toEqual(['Table 7']);
    expect(toolbar()).toEqual(['Table 7 · Set', 'Any · Set', 'Any · Set']);
    expect(dialog()).toBeNull();

    setAmount('155925');
    expect(names()).toEqual(['Table 7']);
    expect(toolbar()).toEqual(['Table 7 · Set', 'Any · Set', '155.925 · Set']);

    setTable('Table 12');
    expect(rows()).toHaveLength(0);
    expect(text(emptyBox()!)).toBe(NOMATCH);

    press(action('reset'));
    expect(rows()).toEqual(SIX);
    expect(toolbar()).toEqual(ANY);
  });

  it('Clear filters on the no-match composition resets all three', () => {
    load('/pos/closed-orders?state=nomatch');
    press(button('Clear filters'));
    expect(rows()).toEqual(SIX);
    expect(toolbar()).toEqual(ANY);
  });

  it('Quick sale is a table choice of its own, and amount alone matches the exact total', () => {
    load('/pos/closed-orders');
    setTable('Quick sale');
    expect(names()).toEqual(['Quick sale']);
    setTable('Any');
    setAmount('173250');
    expect(names()).toEqual(['Quick sale']);
    setAmount('155925');
    expect(names()).toEqual(['Table 1', 'Table 7', 'Table 4', 'Table 3']);
    setAmount('0');
    expect(names()).toEqual(['Table 6']);
  });

  it('the table picker offers Any, Quick sale and the floor’s twelve tables', () => {
    load('/pos/closed-orders?state=filter-table');
    expect([...dialog()!.querySelectorAll('[data-value]')].map(text)).toEqual([
      'Any',
      'Quick sale',
      ...Array.from({ length: 12 }, (_, i) => `Table ${i + 1}`),
    ]);
  });

  it('the amount is compared as a bigint: a figure past 2^53 matches nothing and throws nothing', () => {
    load('/pos/closed-orders');
    setAmount('999999999');
    expect(rows()).toHaveLength(0);
    expect(text(emptyBox()!)).toBe(NOMATCH);
  });

  it('applying a filter from a filter or nomatch picture leaves it for default', () => {
    load('/pos/closed-orders?state=filter-table');
    press(host.querySelector('[data-value="Table 3"]')!);
    press(action('apply-filter'));
    expect(names()).toEqual(['Table 3']);
    expect(rows()[0]!.tag).toBe('REFUNDED');
  });

  it('filters apply over overflow’s rows', () => {
    load('/pos/closed-orders?state=overflow');
    setTable('Table 7');
    expect(rows()).toHaveLength(6);
    expect(new Set(names())).toEqual(new Set(['Table 7']));
  });
});

// ---------------------------------------------------------------------------
// Criterion 7 — the time filter validates
// ---------------------------------------------------------------------------

describe('criterion 7: the time filter validates', () => {
  const INVALID = 'Enter valid HH:MM times, with From no later than To.';
  const field = (f: 'from' | 'to') => press(host.querySelector(`[data-field="${f}"]`)!);
  const open = () => press(action('filter-time'));
  const fields = () => [...host.querySelectorAll('[data-field]')].map(text);

  it('opens on 18:00 to 21:00', () => {
    load('/pos/closed-orders');
    open();
    expect(fields()).toEqual(['From 18:00', 'To 21:00']);
  });

  it('From 21:00 To 18:00 is refused with the artifact’s copy, the sheet stays open, and the list is unchanged', () => {
    load('/pos/closed-orders');
    open();
    range('2100', '1800');
    press(action('apply-filter'));
    expect(text(host.querySelector('.closed-invalid')!)).toBe(INVALID);
    expect(host.querySelector('.closed-invalid')!.getAttribute('role')).toBe('alert');
    expect(dialog()).not.toBeNull();
    expect(toolbar()).toEqual(ANY);
    expect(rows()).toEqual(SIX);
  });

  it('25:00 and 12:60 are refused', () => {
    load('/pos/closed-orders');
    open();
    range('1800', '2500');
    press(action('apply-filter'));
    expect(host.querySelector('.closed-invalid')).not.toBeNull();
    range('1800', '1260');
    press(action('apply-filter'));
    expect(host.querySelector('.closed-invalid')).not.toBeNull();
    expect(dialog()).not.toBeNull();
    expect(rows()).toEqual(SIX);
  });

  it('typing again clears the refusal', () => {
    load('/pos/closed-orders');
    open();
    range('2100', '1800');
    press(action('apply-filter'));
    key('1');
    expect(host.querySelector('.closed-invalid')).toBeNull();
  });

  it('19:50 to 20:05 lists Table 4 (20:04) and Table 3 (19:58) and nothing else', () => {
    load('/pos/closed-orders');
    open();
    range('1950', '2005');
    press(action('apply-filter'));
    expect(dialog()).toBeNull();
    expect(names()).toEqual(['Table 4', 'Table 3']);
    expect(toolbar()).toEqual(['Any · Set', '19:50–20:05 · Set', 'Any · Set']);
  });

  it('the bounds are inclusive: 20:04 to 20:04 lists Table 4; 19:58 to 20:11 lists four', () => {
    load('/pos/closed-orders');
    open();
    range('2004', '2004');
    press(action('apply-filter'));
    expect(names()).toEqual(['Table 4']);
    open();
    range('1958', '2011');
    press(action('apply-filter'));
    expect(names()).toEqual(['Table 7', 'Table 4', 'Table 3']);
  });

  it('digits shift in from the right, so 8 0 0 is the 08:00 the field shows, and it applies', () => {
    load('/pos/closed-orders');
    open();
    field('from');
    key('Clear');
    keys('800');
    expect(fields()[0]).toBe('From 08:00');
    press(action('apply-filter'));
    expect(toolbar()[1]).toBe('08:00–21:00 · Set');
    expect(rows()).toEqual(SIX);
  });

  it('reopening starts from what is applied, and a cancelled edit is not kept', () => {
    load('/pos/closed-orders');
    open();
    range('1950', '2005');
    press(action('apply-filter'));
    open();
    expect(fields()).toEqual(['From 19:50', 'To 20:05']);
    range('0000', '0100');
    press(action('cancel-filter'));
    expect(toolbar()[1]).toBe('19:50–20:05 · Set');
    open();
    expect(fields()).toEqual(['From 19:50', 'To 20:05']);
  });

  it('applies inside the closed-day grouping, with the artifact’s per-group copy', () => {
    load('/pos/closed-orders?state=dayclosed');
    open();
    range('1950', '2005');
    press(action('apply-filter'));
    expect([...host.querySelectorAll('.closed-group, .closed-note, .closed-row')].map((e) => text(e).slice(0, 40))).toEqual([
      'Business day open · 26 Sep',
      'No matching orders in this business day.',
      CLOSED_GROUP,
      expect.stringContaining('Table 4'),
      expect.stringContaining('Table 3'),
    ]);
  });
});

describe('the pure rules', () => {
  it('keyed: delete, clear, a dropped leading zero, and a digit past the limit ignored', () => {
    expect(keyed('1234', '←', 4)).toBe('123');
    expect(keyed('', '←', 4)).toBe('');
    expect(keyed('1234', 'Clear', 4)).toBe('');
    expect(keyed('0', '8', 4)).toBe('8');
    expect(keyed('1800', '5', 4)).toBe('1800');
    expect(keyed('123456789', '1', 9)).toBe('123456789');
  });

  it('rangeIsValid reads what the fields show', () => {
    expect(rangeIsValid('1800', '2100')).toBe(true);
    expect(rangeIsValid('800', '2100')).toBe(true);
    expect(rangeIsValid('', '')).toBe(true);
    expect(rangeIsValid('2359', '2359')).toBe(true);
    expect(rangeIsValid('2400', '2400')).toBe(false);
    expect(rangeIsValid('1860', '2100')).toBe(false);
    expect(rangeIsValid('2101', '2100')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Criterion 8 — nomatch is not empty
// ---------------------------------------------------------------------------

describe('criterion 8: nomatch is not empty', () => {
  it('nomatch says no order matches and offers Clear filters; empty says none has closed and offers no reset', () => {
    load('/pos/closed-orders?state=nomatch');
    expect(text(emptyBox()!)).toContain('No matching orders');
    expect(button('Clear filters')).toBeDefined();
    expect(text(emptyBox()!)).not.toContain('No closed orders yet today');

    load('/pos/closed-orders?state=empty');
    expect(text(emptyBox()!)).toContain('No closed orders yet today');
    expect(emptyBox()!.querySelector('button')).toBeNull();
    expect(text(emptyBox()!)).not.toContain('No matching orders');
    expect(button('Clear filters')).toBeUndefined();
  });

  it('a filter that matches nothing is nomatch, never empty', () => {
    load('/pos/closed-orders');
    press(action('filter-amount'));
    keys('1');
    press(action('apply-filter'));
    expect(text(emptyBox()!)).toBe(NOMATCH);
  });
});

// ---------------------------------------------------------------------------
// Criterion 9 — the closed-day grouping
// ---------------------------------------------------------------------------

describe('criterion 9: the closed-day grouping', () => {
  it('the new-day quick sale links with list=dayclosed; the six link with state=dayclosed', () => {
    load('/pos/closed-orders?state=dayclosed');
    const [newDay, ...old] = rows();
    expect(newDay!.href).toBe('/pos/closed-order?state=quick&order=quick&time=23%3A40&list=dayclosed');
    expect(old.map((r) => r.href)).toEqual(
      ['default', 'cash', 'custom', 'refunded', 'zero', 'quick'].map((o, i) => `/pos/closed-order?state=dayclosed&order=${o}&time=${SIX[i]!.time.replace(':', '%3A')}`)
    );
    // The groups are two, in that order, and the six sit under the second.
    const children = [...host.querySelector('.closed-scroll')!.children].map((c) => (c.className === 'closed-row' ? 'row' : c.className));
    expect(children).toEqual(['closed-listhead', 'closed-group', 'row', 'closed-group', 'row', 'row', 'row', 'row', 'row', 'row']);
  });

  it('the closed-day refunded row is still tagged, and its link is not the refundable context', () => {
    load('/pos/closed-orders?state=dayclosed');
    const refunded = rows().find((r) => r.name === 'Table 3')!;
    expect(refunded.tag).toBe('REFUNDED');
    expect(refunded.href).toContain('state=dayclosed');
  });

  it('filters apply to both groups: Table 7 keeps one closed-day row, and a no-match open group says so', () => {
    load('/pos/closed-orders?state=dayclosed');
    press(action('filter-table'));
    press(host.querySelector('[data-value="Table 7"]')!);
    press(action('apply-filter'));
    expect(names()).toEqual(['Table 7']);
    expect(text(host.querySelector('.closed-note')!)).toBe('No matching orders in this business day.');
    // Quick sale matches the open day and the closed day both.
    press(action('filter-table'));
    press(host.querySelector('[data-value="Quick sale"]')!);
    press(action('apply-filter'));
    expect(names()).toEqual(['Quick sale', 'Quick sale']);
    expect(host.querySelector('.closed-note')).toBeNull();
  });

  it('when neither group matches, the single No matching orders composition stands in both', () => {
    load('/pos/closed-orders?state=dayclosed');
    press(action('filter-table'));
    press(host.querySelector('[data-value="Table 12"]')!);
    press(action('apply-filter'));
    expect(text(emptyBox()!)).toBe(NOMATCH);
    expect(host.querySelectorAll('.closed-group')).toHaveLength(0);
    press(button('Clear filters'));
    expect(host.querySelectorAll('.closed-group')).toHaveLength(2);
  });

  it('a closed-day group with nothing matching says so under its own heading', () => {
    load('/pos/closed-orders?state=dayclosed');
    press(action('filter-time'));
    range('2330', '2350');
    press(action('apply-filter'));
    expect(names()).toEqual(['Quick sale']);
    expect(text(host.querySelectorAll('.closed-note')[0]!)).toBe('No matching orders from the closed day.');
  });

  it('Reset in a closed-day state returns to that state, not to default', () => {
    load('/pos/closed-orders?state=dayclosed-start');
    press(action('reset'));
    expect(host.querySelector('.closed-notice')).not.toBeNull();
    expect(host.querySelector('.closed')!.getAttribute('data-closed-state')).toBe('dayclosed-start');
  });
});

// ---------------------------------------------------------------------------
// Criterion 10 — the closed-day entry and exit
// ---------------------------------------------------------------------------

describe('criterion 10: the closed-day entry and exit', () => {
  it('from the closed-day floor, Closed orders keeps the context, and ← Floor returns to it', () => {
    load('/pos/floor?state=dayclosed');
    const entry = link('Closed orders');
    expect(entry.getAttribute('href')).toBe('/pos/closed-orders?state=dayclosed');
    press(entry);
    expect(path()).toBe('/pos/closed-orders?state=dayclosed');
    expect(host.querySelector('.closed-notice')).not.toBeNull();
    const exit = link('← Floor');
    expect(exit.getAttribute('href')).toBe('/pos/floor?state=dayclosed');
    press(exit);
    expect(path()).toBe('/pos/floor?state=dayclosed');
    expect(host.querySelector('.floor')!.getAttribute('data-floor-state')).toBe('dayclosed');
  });

  it('dayclosed-start leaves for the closed-day floor too', () => {
    load('/pos/closed-orders?state=dayclosed-start');
    expect(link('← Floor').getAttribute('href')).toBe('/pos/floor?state=dayclosed');
  });

  it('from the default floor, both are the plain routes', () => {
    load('/pos/floor');
    expect(link('Closed orders').getAttribute('href')).toBe('/pos/closed-orders');
    press(link('Closed orders'));
    expect(link('← Floor').getAttribute('href')).toBe('/pos/floor');
    press(link('← Floor'));
    expect(path()).toBe('/pos/floor');
  });

  it('every other floor state’s Closed orders is the plain route', () => {
    for (const state of ['default', 'clear', 'empty', 'loading', 'error', 'overflow', 'incident', 'receipt-warning']) {
      load(`/pos/floor?state=${state}`);
      expect(link('Closed orders').getAttribute('href'), state).toBe('/pos/closed-orders');
    }
  });

  it('a default list’s ← Floor is not the closed-day floor, even from a filter picture', () => {
    for (const state of ['default', 'empty', 'overflow', 'nomatch', 'filter-table']) {
      load(`/pos/closed-orders?state=${state}`);
      expect(link('← Floor').getAttribute('href'), state).toBe('/pos/floor');
    }
  });
});

// ---------------------------------------------------------------------------
// Criterion 11 — client-side, and the dialog behaves
// ---------------------------------------------------------------------------

describe('criterion 11: client-side, and the dialog behaves', () => {
  const marked = () => {
    (window as unknown as { __sentinel?: number }).__sentinel = 11;
  };
  const stable = () => expect((window as unknown as { __sentinel?: number }).__sentinel).toBe(11);
  function click(el: Element, init: MouseEventInit = {}) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    act(() => {
      el.dispatchEvent(event);
    });
    return event;
  }

  it('every row and ← Floor is pushState, with the document untouched', async () => {
    load('/pos/closed-orders');
    marked();
    let length = window.history.length;
    const row = host.querySelector<HTMLAnchorElement>('.closed-row')!;
    const event = click(row);
    expect(event.defaultPrevented).toBe(true);
    expect(path()).toBe('/pos/closed-order?state=default&order=default&time=20%3A14');
    expect(window.history.length).toBe(++length);
    stable();
    await back();
    expect(path()).toBe('/pos/closed-orders');
    const leave = click(link('← Floor'));
    expect(leave.defaultPrevented).toBe(true);
    expect(path()).toBe('/pos/floor');
    stable();
  });

  it('every row of the list states is an anchor that leaves, and nothing else on the list is', async () => {
    for (const state of ['default', 'dayclosed']) {
      load(`/pos/closed-orders?state=${state}`);
      const count = host.querySelectorAll('.closed-row').length;
      for (let i = 0; i < count; i++) {
        const r = host.querySelectorAll('.closed-row')[i]!;
        expect(r.tagName).toBe('A');
        expect(click(r).defaultPrevented, state).toBe(true);
        expect(window.location.pathname).toBe('/pos/closed-order');
        await back();
        expect(window.location.pathname).toBe('/pos/closed-orders');
      }
    }
    expect(host.querySelectorAll('.closed-scroll button, .closed-scroll [role="button"]')).toHaveLength(0);
  });

  it('a modified click is left to the browser, and goes nowhere', () => {
    load('/pos/closed-orders');
    let preventedByUs: boolean | undefined;
    const observe = (e: Event) => {
      preventedByUs = e.defaultPrevented;
      e.preventDefault();
    };
    document.body.addEventListener('click', observe);
    click(host.querySelector('.closed-row')!, { ctrlKey: true });
    click(link('← Floor'), { metaKey: true });
    document.body.removeEventListener('click', observe);
    expect(preventedByUs).toBe(false);
    expect(path()).toBe('/pos/closed-orders');
  });

  it('acting is a <button> and going is an <a>: the filters and Reset are buttons, no filter is disabled', () => {
    load('/pos/closed-orders');
    for (const el of host.querySelectorAll('.closed-toolbar button')) {
      expect(el.tagName).toBe('BUTTON');
      expect(el.hasAttribute('disabled')).toBe(false);
    }
    expect(host.querySelectorAll('.closed-toolbar a')).toHaveLength(0);
  });

  it('each filter sheet takes focus when it opens, is aria-modal and named, and leaves the screen behind it inert', () => {
    load('/pos/closed-orders');
    for (const name of ['table', 'time', 'amount']) {
      press(action(`filter-${name}`));
      const d = dialog()!;
      expect(document.activeElement).toBe(d);
      expect(d.getAttribute('aria-modal')).toBe('true');
      expect(d.getAttribute('aria-labelledby')).toBe('sheet-title');
      expect(host.querySelector('#sheet-title')).not.toBeNull();
      expect(host.querySelector('.closed-head')!.hasAttribute('inert')).toBe(true);
      expect(host.querySelector('.closed-toolbar')!.hasAttribute('inert')).toBe(true);
      expect(host.querySelector('.closed-scroll')!.hasAttribute('inert')).toBe(true);
      press(action('cancel-filter'));
      expect(dialog()).toBeNull();
      expect(host.querySelector('.closed-toolbar')!.hasAttribute('inert')).toBe(false);
    }
  });

  it('Cancel and Escape close the sheet with nothing changed, whatever was typed or chosen', () => {
    load('/pos/closed-orders');
    press(action('filter-table'));
    press(host.querySelector('[data-value="Table 7"]')!);
    press(action('cancel-filter'));
    expect(toolbar()).toEqual(ANY);
    expect(rows()).toEqual(SIX);

    press(action('filter-amount'));
    keys('1559');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(dialog()).toBeNull();
    expect(toolbar()).toEqual(ANY);
    expect(rows()).toEqual(SIX);

    press(action('filter-time'));
    key('Clear');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(toolbar()).toEqual(ANY);
  });

  it('an applied filter is kept when the next sheet is cancelled', () => {
    load('/pos/closed-orders');
    press(action('filter-table'));
    press(host.querySelector('[data-value="Table 7"]')!);
    press(action('apply-filter'));
    press(action('filter-amount'));
    keys('5');
    press(action('cancel-filter'));
    expect(toolbar()).toEqual(['Table 7 · Set', 'Any · Set', 'Any · Set']);
    expect(names()).toEqual(['Table 7']);
  });

  it('the keypad names its delete key, and every sheet button is a <button>', () => {
    load('/pos/closed-orders?state=filter-amount');
    expect(host.querySelector('.keypad [data-key="←"]')!.getAttribute('aria-label')).toBe('Delete last digit');
    expect(host.querySelectorAll('.keypad .key')).toHaveLength(12);
    expect(dialog()!.querySelectorAll('a')).toHaveLength(0);
  });

  it('amount keys show the grouped figure, delete one digit, and clear', () => {
    load('/pos/closed-orders?state=filter-amount');
    const shown = () => text(dialog()!.querySelector('output')!);
    expect(shown()).toBe('Any');
    keys('155925');
    expect(shown()).toBe('155.925');
    key('←');
    expect(shown()).toBe('15.592');
    key('Clear');
    expect(shown()).toBe('Any');
    keys('12345678901');
    expect(shown()).toBe('123.456.789');
  });
});

describe('the route a row leads to', () => {
  it('/pos/closed-order with a book id the fresh book does not hold is the error composition, and keeps the order in its query', () => {
    load('/pos/closed-order?order=table-1');
    const screen = host.querySelector('.closed-order')!;
    expect(text(screen.querySelector('.closed-empty')!)).toBe('Could not load this orderNo order details are available. Try again.Retry');
    expect(screen.querySelector('.closed-line')).toBeNull();
    expect(path()).toBe('/pos/closed-order?order=table-1');
  });

  it('/pos/closed-orders is the list, not the placeholder, with or without a trailing slash', () => {
    load('/pos/closed-orders/');
    expect(host.querySelector('.closed')).not.toBeNull();
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
  it('the toolbar sits outside the scroller and the heads inside it, sticky, so a space-taking scrollbar narrows them with the rows', () => {
    load('/pos/closed-orders?state=overflow');
    const scroller = host.querySelector('.closed-scroll')!;
    expect(scroller.contains(host.querySelector('.closed-listhead'))).toBe(true);
    expect(scroller.contains(host.querySelector('.closed-toolbar'))).toBe(false);
    expect(scroller.firstElementChild!.className).toBe('closed-listhead');
    expect(rule('.closed-listhead')).toMatch(/position:\s*sticky/);
    expect(rule('.closed-listhead')).toMatch(/top:\s*0/);
    expect(rule('.closed-scroll')).toMatch(/overflow-y:\s*auto/);
    expect(rule('.closed-scroll')).toMatch(/min-height:\s*0/);
    expect(scroller.getAttribute('tabindex')).toBe('0');
    expect(scroller.getAttribute('role')).toBe('region');
  });

  it('the sticky heads sit under an open sheet and its scrim: no z-index, so the later positioned sheet paints over them', () => {
    // A positioned element with a z-index paints above a later `position: absolute; z-index: auto` sibling.
    expect(rule('.closed-listhead')).not.toMatch(/z-index/);
    expect(rule('.closed-scroll')).not.toMatch(/z-index/);
    expect(rule('.sheet')).not.toMatch(/z-index/);
    load('/pos/closed-orders?state=filter-table');
    const device = host.querySelector('.closed')!;
    const order = [...device.children];
    // The sheet and scrim follow the scroller in the same stacking context.
    expect(order.indexOf(host.querySelector('.sheet')!)).toBeGreaterThan(order.indexOf(host.querySelector('.closed-scroll')!));
    expect(order.indexOf(host.querySelector('.sheet-scrim')!)).toBeGreaterThan(order.indexOf(host.querySelector('.closed-scroll')!));
  });

  it('heads and rows share the one column token and one padding', () => {
    const grid = rule('.closed-listhead');
    expect(grid).toMatch(/grid-template-columns:\s*var\(--frost-closed-list-columns\)/);
    expect(grid).toMatch(/padding:\s*var\(--frost-space-3\) var\(--frost-space-5\)/);
    expect(rule('.closed-row')).toMatch(/min-height:\s*var\(--frost-action-height\)/);
    expect(css).toMatch(/\.closed-listhead,\s*\.closed-row\s*\{[^}]*var\(--frost-closed-list-columns\)/);
  });

  it('the heads are not drawn outside the scroller in any state', () => {
    for (const { id } of CLOSED_STATES) {
      load(`/pos/closed-orders?state=${id}`);
      expect(host.querySelector('.closed-scroll > .closed-listhead'), id).not.toBeNull();
      expect(host.querySelectorAll('.closed-listhead'), id).toHaveLength(1);
    }
  });
});

describe('read-only', () => {
  it('no state draws a control that changes an order: no refund, reprint, void or close', () => {
    for (const { id } of CLOSED_STATES) {
      load(`/pos/closed-orders?state=${id}`);
      expect(text(host.querySelector('.closed')!), id).not.toMatch(/refund this|reprint receipt|void|close order/i);
    }
  });
});
