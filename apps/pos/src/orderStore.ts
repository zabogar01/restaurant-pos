import type { Money } from '@pos/money';
import { useCallback, useEffect, useRef, useState } from 'react';
import { orderTotals, type DiscountSnapshot } from './discount.js';
import { closeOrder, type ClosedOrder } from './close.js';
import { fireOrder } from './fire.js';
import { DEFAULT_CATEGORY, MENU_ITEMS, originFacts, type CategoryId } from './menuFixtures.js';
import {
  ORDER_FIXTURES,
  orderIdOf,
  type Modifier,
  type OrderState,
  type OrderLine,
  type OrderVariant,
  type OrderView,
  type RoundGroup,
} from './orderFixtures.js';
import type { ShownOrder } from './voidFixtures.js';

// FE-014: POS-03's one mutable order. A store holds exactly what `ShownOrder`
// holds minus `totals` — title, type, groups, the discount snapshot and its
// note, carried unchanged — seeded once from `ORDER_FIXTURES[view.state]` when
// the screen mounts, and mutated in place from then on. `view.state` changing
// afterwards (the item sheet, the line editor, `eightysix` and the rest are
// all the same order, reached by the same URL scheme the last eleven slices
// used to select a fixture) does **not** reseed: this app has no way to move
// the cashier to a different order mid-session, so a reseed on every state
// change would just be a store that forgets everything the moment a sheet
// opens or closes. Only `?gone=` — the one existing signal a real removal
// already writes — is watched after the first render, so pressing the row's ×
// after the screen is up behaves exactly as seeding with `?gone=` already in
// the URL does.
//
// FE-026: the store is now a **book** — orders keyed by an id, and the one that
// is active. `useOrderStore` is still the active order's store and its return
// shape has not changed, so a book holding one order is the old store (FE-014's
// safety property). An order is seeded from its fixture the first time it
// becomes active, and its mutations persist while another is. The active id is
// set only by the initial URL at mount (its fixture's `orderId`) or by a floor
// press (`useOrderBook`'s openers) — never by `?state=`, which keeps selecting
// fixture states *within* the active order and never reseeds.
//
// Totals are never stored: `toShownOrder` runs `orderTotals` over the live
// lines every time, exactly as `discount.ts` prescribes.

type StoreState = {
  title: string;
  type?: OrderVariant;
  groups: ReadonlyArray<RoundGroup>;
  applied?: DiscountSnapshot;
  appliedNote?: string;
  /** FE-027: set at close, and never unset. A closed order is kept in the book, not deleted, and accepts no change. */
  closed?: Pick<ClosedOrder, 'closedAt' | 'tenders' | 'change'>;
};

export type NewLine = {
  /** Required, never optional: a line the store creates always knows its item (fire.ts's FR-E4 depends on it). */
  itemId: string;
  name: string;
  quantity: number;
  modifiers?: ReadonlyArray<Modifier>;
};

export type OrderStore = {
  order: ShownOrder;
  /**
   * The menu category the rail has selected (FE-023). Not part of the order and
   * not in the URL: it has the store's lifetime, so an item sheet opening and
   * closing never drops the cashier back on Mains. A fresh mount starts there.
   */
  category: CategoryId;
  selectCategory: (category: CategoryId) => void;
  /** Appends a PENDING line, priced from `MENU_ITEMS`. Mutation 1 (item sheet's *Add to order*). */
  addLine: (line: NewLine) => void;
  /** Drops a line outright, from any group, whether or not a fixture ever pre-figured it. Mutation 3 (a row's ×). */
  removeLine: (lineId: string) => void;
  /**
   * Rewrites a line's quantity and recomputes its `amount` from the unit
   * price and its own modifier deltas — never a multiply of the existing
   * amount. Mutation 2.
   *
   * Called by the line editor's *Update to n* (FE-021).
   */
  setQuantity: (lineId: string, quantity: number) => void;
  /**
   * Mutation 4 (FE-022): the fire. Sends every PENDING line as one new `queued`
   * round stamped `firedAt`, through `fireOrder` — which owns every refusal, so a
   * press the panel should not have offered (an 86'd line, a lock, a quick sale,
   * nothing pending) changes nothing. Applied through the functional updater, so
   * a second call in the same tick finds nothing pending.
   */
  fire: (firedAt: string) => void;
  /**
   * Mutation 5 (FE-027): the close. The drafts become the order's tenders and the
   * order is marked closed, through `closeOrder` — which owns every refusal, so a
   * press the screen should not have offered changes nothing. Returns whether it
   * closed. Applied through the functional updater, so a second call in the same
   * tick finds the order closed.
   * Optional so a hand-built store (a test's) need not supply one.
   */
  close?: (closedAt: string, drafts: ReadonlyArray<{ id: string; label: string; amount: Money }>) => boolean;
};

function priceOf(itemId: string): Money {
  const item = MENU_ITEMS.find((i) => i.id === itemId);
  if (!item) throw new Error(`no menu item for itemId ${itemId}`);
  return item.price;
}

/** FR-C2: the unit price is `max(0, base + modifier deltas)`, and a line's amount is that unit × quantity. The clamp is on the unit, never the total. */
function resolveUnit(price: Money, modifiers: ReadonlyArray<Modifier> | undefined): Money {
  const unit = (modifiers ?? []).reduce((sum, m) => sum + (m.delta ?? 0n), price);
  return unit < 0n ? 0n : unit;
}

/**
 * The unit a quantity edit reprices from, and the preview's arithmetic label:
 * the line's own snapshot (B-8, FR-D4). Once a line exists the catalog is never
 * consulted again. A fixture line predates the snapshot, so its unit is its
 * own amount ÷ quantity — exact, since a FR-C2 line's amount is unit × quantity.
 */
export function unitOf(l: OrderLine): Money {
  return l.unitPrice ?? l.amount / BigInt(l.quantity);
}

function dropLine(groups: ReadonlyArray<RoundGroup>, lineId: string): ReadonlyArray<RoundGroup> {
  // Nothing matched: the same groups, so identity says whether the order changed.
  if (!groups.some((g) => g.lines.some((l) => l.id === lineId))) return groups;
  return groups.map((g) => ({ ...g, lines: g.lines.filter((l) => l.id !== lineId) })).filter((g) => g.lines.length > 0);
}

function appendPending(groups: ReadonlyArray<RoundGroup>, line: OrderLine): ReadonlyArray<RoundGroup> {
  const i = groups.findIndex((g) => g.kind === 'pending');
  if (i === -1) return [...groups, { kind: 'pending', lines: [line] }];
  return groups.map((g, gi) => (gi === i ? { ...g, lines: [...g.lines, line] } : g));
}

function rewriteQuantity(groups: ReadonlyArray<RoundGroup>, lineId: string, quantity: number): ReadonlyArray<RoundGroup> {
  if (!groups.some((g) => g.lines.some((l) => l.id === lineId))) return groups;
  return groups.map((g) => ({
    ...g,
    lines: g.lines.map((l) => (l.id === lineId ? { ...l, quantity, amount: unitOf(l) * BigInt(quantity) } : l)),
  }));
}

/** Seeded once per mount: the fixture's own order, with a `?gone=` line already dropped, exactly as `shownOrder` drops it — never under a lock, fixture or derived (F3d rule 4). */
function seed(view: OrderView, locked: boolean): StoreState {
  const fixture = ORDER_FIXTURES[view.state];
  const drop = !originFacts(view).lock && !locked && view.gone ? view.gone : undefined;
  return {
    title: fixture.title,
    ...(fixture.type && { type: fixture.type }),
    groups: drop ? dropLine(fixture.groups, drop) : fixture.groups,
    ...(fixture.applied && { applied: fixture.applied }),
    ...(fixture.appliedNote && { appliedNote: fixture.appliedNote }),
  };
}

/** The table number an order id names (`table-9`, `table-9-2`); undefined for a quick sale. */
function tableOf(orderId: string): string | undefined {
  return /^table-(\d+)(?:-\d+)?$/.exec(orderId)?.[1];
}

const isClosed = (o: StoreState) => o.closed !== undefined;

/** FR-D1's at-most-one applies to open orders: the table's open order, if any, and otherwise the id a new one takes (`table-9`, then `table-9-2`…). */
function tableSlot(orders: Readonly<Record<string, StoreState>>, n: number): { id: string; exists: boolean } {
  const ids = Object.keys(orders).filter((id) => tableOf(id) === String(n));
  const open = ids.find((id) => !isClosed(orders[id]!));
  if (open) return { id: open, exists: true };
  return { id: ids.length === 0 ? `table-${n}` : `table-${n}-${ids.length + 1}`, exists: false };
}

// A no-line order states no charges; a line discounted to zero (`zero`, the
// 100% comp) still states its service and tax rows — the reviewed distinction
// is lines, never money, so it is checked on line count, not on the subtotal
// `orderTotals` would compute. `ORDER_FIXTURES.empty` is the only fixture with
// this bare shape; every other one comes from `serviceAndTax` or `orderTotals`
// and always carries both rows. Which shape an order the *cashier* empties by
// removing every line should draw is a design question, not this slice's.
function totalsFor(lines: ReadonlyArray<OrderLine>, applied: DiscountSnapshot | undefined) {
  if (lines.length === 0) return { subtotal: 0n, total: 0n };
  const subtotal = lines.filter((l) => l.status !== 'voided').reduce((sum, l) => sum + l.amount, 0n);
  return orderTotals(subtotal, applied);
}

/**
 * What the order would read if a PENDING line's quantity were `quantity`: a
 * pure derivation for the line editor's unsaved preview (FE-021). It never
 * writes, and nothing but `setQuantity` changes the order.
 */
export function previewQuantity(order: ShownOrder, lineId: string, quantity: number) {
  const groups = rewriteQuantity(order.groups, lineId, quantity);
  const lines = groups.flatMap((g) => g.lines);
  return { amount: lines.find((l) => l.id === lineId)?.amount ?? 0n, totals: totalsFor(lines, order.applied) };
}

function toShownOrder(data: StoreState): ShownOrder {
  const lines = data.groups.flatMap((g) => g.lines);
  return {
    title: data.title,
    ...(data.type && { type: data.type }),
    totals: totalsFor(lines, data.applied),
    ...(data.applied && { applied: data.applied }),
    ...(data.appliedNote && { appliedNote: data.appliedNote }),
    groups: data.groups,
  };
}

/** F3d's lock, as a fact or — since a payment session belongs to one order (FE-026) — a question asked of the active order's id. */
export type Locked = boolean | ((activeId: string) => boolean);

/** What the book holds: every order that has been opened, and the one the order screen shows. */
type Book = { orders: Readonly<Record<string, StoreState>>; activeId: string };

/**
 * The floor's view of the book (FE-026). `useOrderStore` returns only `store`.
 */
export type OrderBook = {
  /** The order the order screen is showing. Set by the initial URL at mount or by an opener below — never by `?state=`. */
  activeId: string;
  /** An order the book holds, drawn as the panel draws it; `undefined` if it was never opened. Totals come from `orderTotals`. */
  orderFor: (orderId: string) => ShownOrder | undefined;
  /** Makes a fixture's order active, seeding it from that fixture the first time and never after. */
  openFixture: (state: OrderState) => void;
  /** Every order the book holds, open or closed (FE-027: POS-05 will list the closed ones). */
  orders: () => ReadonlyArray<{ id: string; status: 'open' | 'closed'; order: ShownOrder } & Partial<Pick<ClosedOrder, 'closedAt' | 'tenders' | 'change'>>>;
  /** The id of Table `n`'s open order, if it has one. A table whose only order is closed has none: it is free. */
  openOrderIdOf: (n: number) => string | undefined;
  /** Whether the book holds any order, open or closed, for Table `n`. Absent, the floor shows the fixture. */
  hasOrderFor: (n: number) => boolean;
  /** Makes Table `n`'s order active, creating an empty one the first time. Returns its id. */
  openTable: (n: number) => string;
  /** Creates a fresh quick sale from `quick-new` under a new id and makes it active. Returns the id. */
  newQuickSale: () => string;
};

function emptyTable(n: number): StoreState {
  return { title: `Order · T${n}`, groups: [] };
}

/**
 * `locked` (F3d): the own-tab payment-session lock POS-03 derives from
 * PosRoutes, on top of whatever `originFacts(view).lock` already
 * says. It guards the same two things the fixture lock guards — the initial
 * seed's `?gone=` drop and the post-mount effect's — so a `?gone=` mutation
 * walked in through the URL is refused the same way under either lock
 * (rule 4).
 *
 * `showing` (FE-026): whether the screen is drawing the active order. Off on the
 * floor, where nothing has been opened yet and seeding Table 1 at mount would
 * make its tile read the book rather than the floor's own fixture.
 */
export function useOrderStore(view: OrderView, locked: Locked = false): OrderStore {
  return useOrderBook(view, locked).store;
}

export function useOrderBook(view: OrderView, lock: Locked = false, showing = true): { store: OrderStore; book: OrderBook } {
  const lockedOn = (id: string) => (typeof lock === 'function' ? lock(id) : lock);
  const [book, setBook] = useState<Book>(() => {
    const activeId = orderIdOf(ORDER_FIXTURES[view.state]);
    return { orders: showing ? { [activeId]: seed(view, lockedOn(activeId)) } : {}, activeId };
  });
  // FE-026 rule 5: a payment lock belongs to the order the session began on, so
  // it is asked of the active order, never taken as one flag for the whole book.
  const locked = lockedOn(book.activeId);
  const [category, selectCategory] = useState<CategoryId>(DEFAULT_CATEGORY);
  const appliedGone = useRef(view.gone);
  const nextId = useRef(0);
  const nextQuick = useRef(1);
  // What the fire reads at the moment of the press: the view it is on and the
  // session lock. A ref, so `fire` keeps one identity and still asks the
  // current facts rather than the ones it was created under.
  const context = useRef({ view, locked });
  context.current = { view, locked };
  const bookRef = useRef(book);
  bookRef.current = book;

  // The order the screen shows is always in the book: reaching an order route
  // with nothing active yet (Forward from the floor, say) seeds it now, once.
  const held = book.orders[book.activeId];
  if (showing && !held) {
    setBook((prev) => (prev.orders[prev.activeId] ? prev : { ...prev, orders: { ...prev.orders, [prev.activeId]: seed(view, locked) } }));
  }
  const data = held ?? seed(view, locked);

  /** Applies a change to the active order. The same order back means nothing changed. */
  const update = useCallback((change: (prev: StoreState) => StoreState) => {
    setBook((prev) => {
      const current = prev.orders[prev.activeId];
      // A closed order is never editable (FE-027 rule 6).
      if (!current || isClosed(current)) return prev;
      const next = change(current);
      return next === current ? prev : { ...prev, orders: { ...prev.orders, [prev.activeId]: next } };
    });
  }, []);

  useEffect(() => {
    // Lead correction (F3d): `view.gone` going falsy (Cancel always clears it
    // in the same handler that lifts the lock) resets what counts as
    // "already seen", so a later, genuinely fresh `?gone=` — even the same
    // line id — is reconsidered rather than treated as a repeat.
    if (!view.gone) {
      appliedGone.current = undefined;
      return;
    }
    if (view.gone === appliedGone.current) return;
    // Marked seen *before* the lock check, and unconditionally: a refusal
    // must be remembered too, or the lock lifting on its own (`locked` is in
    // the dependency array) would replay a stale `?gone=` nobody re-asked
    // for. This is also what stops a *refused* attempt from being consumed
    // as if it had dropped the line — the bug this correction fixes.
    appliedGone.current = view.gone;
    if (originFacts(view).lock || locked) return;
    update((prev) => ({ ...prev, groups: dropLine(prev.groups, view.gone!) }));
  }, [view.gone, view.state, locked, update]);

  const addLine = useCallback((line: NewLine) => {
    const unitPrice = resolveUnit(priceOf(line.itemId), line.modifiers);
    const newLine: OrderLine = {
      id: `${line.itemId}-${++nextId.current}`,
      quantity: line.quantity,
      name: line.name,
      itemId: line.itemId,
      ...(line.modifiers && line.modifiers.length > 0 && { modifiers: line.modifiers }),
      unitPrice,
      amount: unitPrice * BigInt(line.quantity),
      status: 'pending',
    };
    update((prev) => ({ ...prev, groups: appendPending(prev.groups, newLine) }));
  }, [update]);

  const removeLine = useCallback((lineId: string) => {
    update((prev) => ({ ...prev, groups: dropLine(prev.groups, lineId) }));
  }, [update]);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    update((prev) => ({ ...prev, groups: rewriteQuantity(prev.groups, lineId, quantity) }));
  }, [update]);

  const fire = useCallback((firedAt: string) => {
    const { view, locked } = context.current;
    // The place's own facts, through originFacts: an item sheet draws the state
    // it was opened from, and reading `X[view.state]` would un-86 a held line.
    const { menu, lock } = originFacts(view);
    update((prev) => {
      const result = fireOrder(prev.groups, {
        type: prev.type ?? 'table',
        unavailable: menu.eightySixed ?? [],
        locked: locked || lock !== undefined,
        firedAt,
      });
      return result.refused ? prev : { ...prev, groups: result.groups };
    });
  }, [update]);

  const close = useCallback((closedAt: string, drafts: ReadonlyArray<{ id: string; label: string; amount: Money }>) => {
    // The place's own facts, as the fire reads them. Only another client's lease
    // refuses a close: this tab's own payment session is how a close is reached.
    const { menu, lock } = originFacts(context.current.view);
    const attempt = (order: StoreState) =>
      closeOrder(
        {
          ...(order.type && { type: order.type }),
          groups: order.groups,
          total: totalsFor(order.groups.flatMap((g) => g.lines), order.applied).total,
          locked: lock === 'lease',
          unavailable: menu.eightySixed ?? [],
        },
        drafts,
        closedAt
      );
    const now = bookRef.current.orders[bookRef.current.activeId];
    if (!now || isClosed(now) || attempt(now).refused) return false;
    update((prev) => {
      const result = attempt(prev);
      if (result.refused) return prev;
      const { closedAt: at, tenders, change, groups } = result.closed;
      return { ...prev, groups, closed: { closedAt: at, tenders, change } };
    });
    return true;
  }, [update]);

  const openFixture = useCallback((state: OrderState) => {
    const activeId = orderIdOf(ORDER_FIXTURES[state]);
    setBook((prev) => ({
      activeId,
      orders: prev.orders[activeId] ? prev.orders : { ...prev.orders, [activeId]: seed({ state }, false) },
    }));
  }, []);

  const openTable = useCallback((n: number) => {
    const { id: activeId } = tableSlot(bookRef.current.orders, n);
    setBook((prev) => {
      const slot = tableSlot(prev.orders, n);
      return { activeId: slot.id, orders: slot.exists ? prev.orders : { ...prev.orders, [slot.id]: emptyTable(n) } };
    });
    return activeId;
  }, []);

  const newQuickSale = useCallback(() => {
    // `quick-1` is the fixture `quick`'s order, so the first sale the floor makes is `quick-2`.
    const activeId = `quick-${++nextQuick.current}`;
    setBook((prev) => ({ activeId, orders: { ...prev.orders, [activeId]: seed({ state: 'quick-new' }, false) } }));
    return activeId;
  }, []);

  const orderFor = (orderId: string) => (book.orders[orderId] ? toShownOrder(book.orders[orderId]!) : undefined);

  const orders = () =>
    Object.entries(book.orders).map(([id, o]) => ({
      id,
      status: isClosed(o) ? ('closed' as const) : ('open' as const),
      order: toShownOrder(o),
      ...o.closed,
    }));
  const openOrderIdOf = (n: number) => {
    const slot = tableSlot(book.orders, n);
    return slot.exists ? slot.id : undefined;
  };
  const hasOrderFor = (n: number) => Object.keys(book.orders).some((id) => tableOf(id) === String(n));

  return {
    store: { order: toShownOrder(data), category, selectCategory, addLine, removeLine, setQuantity, fire, close },
    book: { activeId: book.activeId, orderFor, orders, openOrderIdOf, hasOrderFor, openFixture, openTable, newQuickSale },
  };
}
