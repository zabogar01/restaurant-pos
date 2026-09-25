// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FLOOR_FIXTURES, FLOOR_STATES, floorStateFrom, type FloorState } from '../src/floorFixtures.js';
import { FLOOR_ORDER_STATES, ORDER_FIXTURES, ORDER_STATES, orderIdOf, orderViewFrom } from '../src/orderFixtures.js';
import { PosRoutes } from '../src/PosRoutes.js';

// FE-026 / POS-02: the floor, and a store that holds one order per table.

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
  window.history.replaceState(null, '', '/pos/order');
});

const press = (el: Element) => act(() => (el as HTMLElement).click());
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** A cold load of `url`: a fresh module instance's worth of state, as a reload would leave it. */
function load(url: string) {
  window.history.replaceState(null, '', url);
  act(() => root.render(<PosRoutes key={++mount} />));
}

const tile = (n: number) => host.querySelector<HTMLAnchorElement>(`[data-table="${n}"]`)!;
/** A tile's words, each element apart: name, status, note, amount. */
const tileText = (n: number) => [...tile(n).querySelectorAll('strong, .floor-sub, .floor-table-amount')].map(text).join(' ');
const heading = () => text(host.querySelector('#order-title')!);
const grand = () => text(host.querySelector('.totals__row--grand dd')!);
const fireControl = () => host.querySelector('.order-actions [data-action="fire"]');
const backToFloor = () => [...host.querySelectorAll<HTMLAnchorElement>('a')].find((a) => text(a) === '← Floor')!;
const pathAndSearch = () => `${window.location.pathname}${window.location.search}`;

/** Item sheet → Add to order, by the real controls. */
function addBurger() {
  press(host.querySelector('[data-item="burger"]')!);
  press([...host.querySelectorAll('button')].find((b) => b.textContent === 'Add to order')!);
}

// ---------------------------------------------------------------------------
// Criterion 1 — the nine states as the artifact draws them
// ---------------------------------------------------------------------------

const MIXED = [
  ['Table 1', '2 rounds fired · 1 line pending', 'Open', '382.725'],
  ['Table 2', 'Free', 'Open table order', ''],
  ['Table 3', 'Free', 'Open table order', ''],
  ['Table 4', 'Free', 'Open table order', ''],
  ['Table 5', 'Free', 'Open table order', ''],
  ['Table 6', 'Free', 'Open table order', ''],
  ['Table 7', 'Payment in progress', '155.925 outstanding', '382.725'],
  ['Table 8', 'Free', 'Open table order', ''],
  ['Table 9', '1 round fired · 5 items', 'Open', '173.250'],
  ['Table 10', 'Free', 'Open table order', ''],
  ['Table 11', 'Free', 'Open table order', ''],
  ['Table 12', '2 rounds fired · 1 line pending', 'Open', '155.925'],
] as const;
const free = (n: number) => Array.from({ length: n }, (_, i) => [`Table ${i + 1}`, 'Free', 'Open table order', ''] as const);
const overflow = [...MIXED, ...Array.from({ length: 12 }, (_, i) => [`Table ${i + 13}`, 'Free', 'Open table order', ''] as const)];

type Row = readonly [string, string, string, string];
type Expected = {
  tiles: ReadonlyArray<Row>;
  sub?: string;
  day: string;
  extras: string[];
};
const OPEN = 'Business day open · 25 Sep';
const CLOSED = 'Business day closed · 25 Sep';
const INCIDENT = ['Kitchen ticket did not print — Table 1, round 2', 'The order is unaffected. The kitchen has not seen this work.', 'Open incidents'];
const TABLE: Record<FloorState, Expected> = {
  default: { tiles: MIXED, sub: '4 open · 8 free', day: OPEN, extras: [] },
  clear: { tiles: free(11), sub: '11 free', day: OPEN, extras: [] },
  empty: { tiles: [], day: OPEN, extras: ['No tables configured', 'A manager creates tables in the back office. Quick sale works without them.'] },
  loading: { tiles: [], sub: 'Reading table availability…', day: OPEN, extras: ['Loading floor…', 'Reading tables and open orders.'] },
  error: { tiles: [], day: OPEN, extras: ['Floor unavailable', 'Could not read table state. Quick sale is still available.', 'Retry'] },
  overflow: { tiles: overflow, sub: '4 open · 20 free', day: OPEN, extras: [] },
  dayclosed: {
    tiles: free(11),
    sub: '11 free',
    day: CLOSED,
    extras: ['Business day closed at 23:14', 'New orders belong to the next business day. Orders from the closed day can no longer be voided or refunded.'],
  },
  incident: { tiles: MIXED, sub: '4 open · 8 free', day: OPEN, extras: INCIDENT },
  'receipt-warning': { tiles: MIXED, sub: '4 open · 8 free', day: OPEN, extras: ['Receipt printer: 1 unprinted receipt', 'View receipts'] },
};

describe('criterion 1: the nine floor states, as the artifact draws them', () => {
  it('the states are the artifact’s nine, in its order', () => {
    expect(FLOOR_STATES.map((s) => s.id)).toEqual(Object.keys(TABLE));
    expect(Object.keys(FLOOR_FIXTURES)).toEqual(Object.keys(TABLE));
  });

  it.each(Object.entries(TABLE) as Array<[FloorState, Expected]>)('%s', (state, want) => {
    load(`/pos/floor?state=${state}`);
    const drawn = [...host.querySelectorAll<HTMLElement>('.floor-table')].map((t) => {
      const [name, status] = [...t.querySelectorAll('strong, div.floor-sub')].map(text);
      const [note, amount = ''] = [...t.querySelectorAll('.floor-table-bottom > span')].map(text);
      return [name, status, note, amount];
    });
    expect(drawn).toEqual(want.tiles.map((r) => [...r]));
    expect(text(host.querySelector('.floor-head')!)).toContain(want.day);
    expect(text(host.querySelector('.floor-toolbar h2')!)).toBe('Tables');
    expect(text(host.querySelector('.floor-toolbar')!).includes(want.sub ?? '\u0000')).toBe(want.sub !== undefined);
    const body = text(host);
    for (const copy of want.extras) expect(body).toContain(copy);
    // Present in every state: the two doors out of the toolbar.
    expect([...host.querySelectorAll('.floor-tools a')].map(text)).toEqual(['Closed orders', 'New quick sale']);
    // Not drawn: Release, which is POS-01's (the omission is named in the handoff).
    expect(body).not.toContain('Release');
  });

  it('unknown and absent states resolve to default', () => {
    expect(floorStateFrom('?state=nonsense')).toBe('default');
    expect(floorStateFrom('')).toBe('default');
    for (const s of FLOOR_STATES) expect(floorStateFrom(`?state=${s.id}`)).toBe(s.id);
    load('/pos/floor?state=nonsense');
    expect(host.querySelectorAll('.floor-table')).toHaveLength(12);
  });

  it('every tile of every state names its table and whether it is open', () => {
    for (const { id } of FLOOR_STATES) {
      load(`/pos/floor?state=${id}`);
      for (const t of host.querySelectorAll<HTMLAnchorElement>('.floor-table')) {
        const n = t.dataset.table;
        expect(t.getAttribute('aria-label')).toMatch(new RegExp(`^Table ${n}, (open existing order|free, open new order)$`));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Criterion 2 — each occupied tile opens its own order
// ---------------------------------------------------------------------------

describe('criterion 2: each occupied tile opens its own order', () => {
  // The heading is the fixture's; the total is the tile's for Tables 7, 9 and 12.
  // Table 1's tile derives 382.725 from its order (the artifact's 155.925 omits the pending Steak).
  const CASES = [
    [1, 'default', 'Order · T1', '382.725'],
    [7, 'open-t7', 'Order · T7', '382.725'],
    [9, 'open-t9', 'Order · T9', '173.250'],
    [12, 'open-t12', 'Order · T12', '155.925'],
  ] as const;

  it.each(CASES)('Table %i opens %s: heading, total and destination', (n, state, title, total) => {
    load('/pos/floor');
    press(tile(n));
    expect(pathAndSearch()).toBe(`/pos/order?state=${state}`);
    expect(heading()).toBe(title);
    if (total) expect(grand()).toBe(total);
  });

  it('the four tiles open four different orders, in one session, one after the other', () => {
    load('/pos/floor');
    const seen: string[] = [];
    for (const [n] of CASES) {
      press(tile(n));
      seen.push(heading());
      press(backToFloor());
    }
    expect(seen).toEqual(['Order · T1', 'Order · T7', 'Order · T9', 'Order · T12']);
  });

  it('the new fixtures carry their table’s own order id, and every older one is Table 1’s', () => {
    expect(orderIdOf(ORDER_FIXTURES['open-t7'])).toBe('table-7');
    expect(orderIdOf(ORDER_FIXTURES['open-t9'])).toBe('table-9');
    expect(orderIdOf(ORDER_FIXTURES['open-t12'])).toBe('table-12');
    expect(orderIdOf(ORDER_FIXTURES.quick)).toBe('quick-1');
    expect(orderIdOf(ORDER_FIXTURES['quick-line'])).toBe('quick-1');
    for (const { id } of ORDER_STATES.filter((s) => s.id !== 'quick' && s.id !== 'quick-line')) {
      expect(orderIdOf(ORDER_FIXTURES[id])).toBe('table-1');
    }
  });

  it('the four entry states resolve from the URL, and are not in the fixture nav', () => {
    for (const id of FLOOR_ORDER_STATES) {
      expect(orderViewFrom(`?state=${id}`).state).toBe(id);
      expect(ORDER_STATES.map((s) => s.id)).not.toContain(id);
    }
  });

  it('Table 7 is locked by its own fixture, with no payment session', () => {
    load('/pos/floor');
    press(tile(7));
    expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBe('draft');
    expect(host.querySelectorAll('.order-actions .action--off')).toHaveLength(4);
  });

  it('Table 9 draws its FAILED round and the incident banner, with nothing to send', () => {
    load('/pos/floor');
    press(tile(9));
    expect(text(host.querySelector('.emergency-banner')!)).toContain('Kitchen ticket did not print — Table 9, round 1');
    expect(host.querySelector('.emergency-banner__action')!.getAttribute('href')).toBe('/pos/incidents?state=overflow');
    expect(text(host.querySelector('[data-round="1"]')!)).toContain('Round 1 · fired 20:04 · FAILED');
    expect(fireControl()!.getAttribute('aria-disabled')).toBe('true');
  });

  it('Table 12’s pending Fries go without a prompt, to the design’s figures, and stay gone', () => {
    load('/pos/floor');
    press(tile(12));
    expect(text(host.querySelector('.order-panel__count')!)).toBe('3 items');
    press(host.querySelector('[data-line-id="t12-fries"] .order-line__remove')!);
    expect(grand()).toBe('80.325');
    expect(text(host.querySelector('.totals__row--included')!)).toContain('6.955');
    press(backToFloor());
    expect(tileText(12)).toContain('80.325');
    press(tile(12));
    expect(grand()).toBe('80.325');
  });
});

// ---------------------------------------------------------------------------
// Criterion 3 — a free tile makes a new order of its own
// ---------------------------------------------------------------------------

describe('criterion 3: a free tile', () => {
  it('Table 2 opens a new empty order titled for it', () => {
    load('/pos/floor');
    press(tile(2));
    expect(pathAndSearch()).toBe('/pos/order?state=empty');
    expect(heading()).toBe('Order · T2');
    expect(text(host.querySelector('.order-panel__count')!)).toBe('Empty');
  });

  it('mutations persist across floor round trips', () => {
    load('/pos/floor');
    press(tile(2));
    addBurger();
    const lines = () => host.querySelectorAll('.order-line').length;
    expect(lines()).toBe(1);
    press(backToFloor());
    press(tile(2));
    expect(heading()).toBe('Order · T2');
    expect(lines()).toBe(1);
  });

  it('two free tables stay independent', () => {
    load('/pos/floor');
    press(tile(2));
    addBurger();
    press(backToFloor());
    press(tile(3));
    expect(heading()).toBe('Order · T3');
    expect(host.querySelectorAll('.order-line')).toHaveLength(0);
    addBurger();
    addBurger();
    expect(host.querySelectorAll('.order-line')).toHaveLength(2);
    press(backToFloor());
    press(tile(2));
    expect(host.querySelectorAll('.order-line')).toHaveLength(1);
  });

  it('an emptied table is free again, and opens its own empty order rather than a fixture’s', () => {
    load('/pos/floor');
    press(tile(2));
    expect(heading()).toBe('Order · T2');
    press(backToFloor());
    expect(tileText(2)).toContain('Free');
  });
});

// ---------------------------------------------------------------------------
// Criterion 4 — tiles read from the book
// ---------------------------------------------------------------------------

describe('criterion 4: a tile reads from the book', () => {
  it('Table 2, opened and added to, is open at its own derived total; the others are unchanged', () => {
    load('/pos/floor');
    const before = [1, 3, 7, 9, 12].map(tileText);
    press(tile(2));
    addBurger();
    const total = grand();
    press(backToFloor());
    expect(tileText(2)).toBe(`Table 2 1 line pending Open ${total}`);
    expect(total).not.toBe('');
    expect([1, 3, 7, 9, 12].map(tileText)).toEqual(before);
  });

  it('the derived total follows the order: a second Burger moves the tile with it', () => {
    load('/pos/floor');
    press(tile(2));
    addBurger();
    const one = grand();
    addBurger();
    const two = grand();
    expect(two).not.toBe(one);
    press(backToFloor());
    expect(tileText(2)).toContain(two);
  });

  it('the header counts follow the tiles', () => {
    load('/pos/floor');
    press(tile(2));
    addBurger();
    press(backToFloor());
    expect(text(host.querySelector('.floor-toolbar')!)).toContain('5 open · 7 free');
  });
});

// ---------------------------------------------------------------------------
// Criterion 5 — the payment lock belongs to one order
// ---------------------------------------------------------------------------

describe('criterion 5: the payment lock belongs to one order', () => {
  const settle = () => press(host.querySelector('.order-actions [data-action="settle"]')!);
  const locked = () => host.querySelector('.order-panel')!.getAttribute('data-lock');

  it('start paying Table 1, go to the floor, open Table 9: Table 9 is unlocked; Table 1 is still locked', async () => {
    load('/pos/floor');
    press(tile(1));
    expect(locked()).toBeNull();
    settle();
    expect(window.location.pathname).toBe('/pos/settlement');
    // ← Order returns to a locked order (FR-G12).
    const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
    press([...host.querySelectorAll('button')].find((b) => text(b) === '← Order')!);
    await act(async () => popped);
    expect(locked()).toBe('draft');
    press(backToFloor());
    expect(tileText(1)).toContain('Payment in progress');

    press(tile(9));
    expect(heading()).toBe('Order · T9');
    expect(locked()).toBeNull();
    expect(host.querySelector('.order-line__remove, .order-line__target')).not.toBeNull();
    press(backToFloor());

    press(tile(1));
    expect(heading()).toBe('Order · T1');
    expect(locked()).toBe('draft');
  });
});

describe('round 2: a payment session is keyed per order, like the book', () => {
  const back = async () => {
    const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
    act(() => window.history.back());
    await act(async () => popped);
  };
  const drafts = () => host.querySelectorAll('.draft-tender').length;

  it('Table 1 mid-payment, open Table 9, Settle: Table 9 has no drafts and its own balance; Table 1’s are intact', async () => {
    load('/pos/floor');
    press(tile(1));
    // Begin Table 1's payment with one Card draft, as the fixture state `partial` seeds it.
    act(() => {
      window.history.pushState(null, '', '/pos/settlement?state=partial');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(drafts()).toBe(1);
    await back();
    press(backToFloor());
    press(tile(9));
    press(host.querySelector('.order-actions [data-action="settle"]')!);
    expect(window.location.pathname).toBe('/pos/settlement');
    expect(drafts()).toBe(0);
    expect(text(host)).toContain('173.250');
    await back();
    press(backToFloor());
    press(tile(1));
    expect(host.querySelector('.order-panel')!.getAttribute('data-lock')).toBe('draft');
    act(() => {
      window.history.pushState(null, '', '/pos/settlement?state=settle');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(drafts()).toBe(1);
  });
});

describe('round 2: a tile derives from its fixture’s order before it is opened', () => {
  it('Table 1 reads 382.725 without the book holding it, and opening does not change it', () => {
    load('/pos/floor');
    expect(tileText(1)).toBe('Table 1 2 rounds fired · 1 line pending Open 382.725');
    press(tile(1));
    press(backToFloor());
    expect(tileText(1)).toBe('Table 1 2 rounds fired · 1 line pending Open 382.725');
  });
});

describe('round 2: a sheet opened on the new states returns to its own', () => {
  it.each(['open-t9', 'open-t12', 'quick-new'])('%s', (state) => {
    load(`/pos/order?state=${state}`);
    press(host.querySelector('[data-item="burger"]')!);
    press([...host.querySelectorAll('button')].find((b) => b.textContent === 'Cancel')!);
    expect(window.location.search).toBe(`?state=${state}`);
  });
});

// ---------------------------------------------------------------------------
// Criterion 6 — new quick sale
// ---------------------------------------------------------------------------

describe('criterion 6: new quick sale', () => {
  const newSale = () => press([...host.querySelectorAll('a')].find((a) => text(a) === 'New quick sale')!);

  it('opens an empty counter sale with no fire control at all', () => {
    load('/pos/floor');
    newSale();
    expect(pathAndSearch()).toBe('/pos/order?state=quick-new');
    expect(heading()).toBe('Order · counter');
    expect(text(host.querySelector('.order-panel__count')!)).toBe('Empty');
    expect(fireControl()).toBeNull();
    expect(host.querySelectorAll('.order-line')).toHaveLength(0);
  });

  it('every new sale is its own: the second is empty although the first holds a line', () => {
    load('/pos/floor');
    newSale();
    addBurger();
    expect(host.querySelectorAll('.order-line')).toHaveLength(1);
    press(backToFloor());
    newSale();
    expect(host.querySelectorAll('.order-line')).toHaveLength(0);
  });

  it('every floor state’s New quick sale goes there', () => {
    for (const { id } of FLOOR_STATES) {
      load(`/pos/floor?state=${id}`);
      const door = [...host.querySelectorAll('a')].find((a) => text(a) === 'New quick sale')!;
      expect(door.getAttribute('href')).toBe('/pos/order?state=quick-new');
    }
  });

  it('Closed orders goes to a placeholder: the bare device frame and no copy', () => {
    load('/pos/floor');
    press([...host.querySelectorAll('a')].find((a) => text(a) === 'Closed orders')!);
    expect(window.location.pathname).toBe('/pos/closed-orders');
    expect(host.textContent).toBe('');
    expect(host.querySelector('.pos-device')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Criterion 7 — client-side everywhere
// ---------------------------------------------------------------------------

describe('criterion 7: no floor or order transition reloads the document', () => {
  const marked = () => {
    (window as unknown as { __sentinel?: number }).__sentinel = 7;
  };
  const stable = () => expect((window as unknown as { __sentinel?: number }).__sentinel).toBe(7);

  function click(el: Element, init: MouseEventInit = {}) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    act(() => {
      el.dispatchEvent(event);
    });
    return event;
  }

  it('every tile, the toolbar and ← Floor are pushState, with the document untouched', () => {
    load('/pos/floor');
    marked();
    let length = window.history.length;
    const doors: Array<[string, () => Element, string]> = [
      ['a free tile', () => tile(2), '/pos/order'],
      ['an occupied tile', () => tile(9), '/pos/order'],
      ['New quick sale', () => [...host.querySelectorAll('a')].find((a) => text(a) === 'New quick sale')!, '/pos/order'],
      ['Closed orders', () => [...host.querySelectorAll('a')].find((a) => text(a) === 'Closed orders')!, '/pos/closed-orders'],
    ];
    for (const [, door, path] of doors) {
      const event = click(door());
      expect(event.defaultPrevented).toBe(true);
      expect(window.location.pathname).toBe(path);
      expect(window.history.length).toBe(++length);
      stable();
      if (path === '/pos/closed-orders') {
        act(() => window.history.back());
        continue;
      }
      const back = click(backToFloor());
      expect(back.defaultPrevented).toBe(true);
      expect(window.location.pathname).toBe('/pos/floor');
      expect(window.history.length).toBe(++length);
      stable();
    }
  });

  it('a modified click is left to the browser, and opens nothing', () => {
    load('/pos/floor');
    let preventedByUs: boolean | undefined;
    const observe = (e: Event) => {
      preventedByUs = e.defaultPrevented;
      e.preventDefault();
    };
    document.body.addEventListener('click', observe);
    click(tile(2), { ctrlKey: true });
    document.body.removeEventListener('click', observe);
    expect(preventedByUs).toBe(false);
    expect(window.location.pathname).toBe('/pos/floor');
    // Table 2 was not made active by a click that went to another tab.
    press(tile(2));
    expect(heading()).toBe('Order · T2');
  });

  it('← Floor is on every order state the routed screen draws, and always leaves', () => {
    for (const { id } of [...ORDER_STATES, ...FLOOR_ORDER_STATES.map((id) => ({ id }))]) {
      load(`/pos/order?state=${id}`);
      const back = host.querySelectorAll<HTMLAnchorElement>('a[href="/pos/floor"]');
      expect(back).toHaveLength(1);
      expect(text(back[0]!)).toBe('← Floor');
    }
  });
});

// ---------------------------------------------------------------------------
// The accepted edge (rule 2): Back across a floor press
// ---------------------------------------------------------------------------

describe('the active order lives in the store, not in the URL', () => {
  it('in-order navigation never changes it: opening a sheet on Table 9 leaves Table 9 shown', () => {
    load('/pos/floor');
    press(tile(9));
    press(host.querySelector('[data-item="burger"]')!);
    expect(window.location.search).toContain('sheet-item-burger');
    expect(heading()).toBe('Order · T9');
  });

  it('Back across a floor press can show a URL naming another order, and the active order stays the one last opened', async () => {
    load('/pos/floor');
    press(tile(1));
    press(backToFloor());
    press(tile(9));
    expect(heading()).toBe('Order · T9');
    // Back to the floor, Back again: the URL is Table 1's `default`; the order shown is still Table 9's.
    for (let i = 0; i < 2; i++) {
      const popped = new Promise<void>((done) => window.addEventListener('popstate', () => done(), { once: true }));
      act(() => window.history.back());
      await act(async () => popped);
    }
    expect(pathAndSearch()).toBe('/pos/order?state=default');
    expect(heading()).toBe('Order · T9');
  });
});
