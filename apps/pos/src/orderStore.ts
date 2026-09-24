import type { Money } from '@pos/money';
import { useCallback, useEffect, useRef, useState } from 'react';
import { orderTotals, type DiscountSnapshot } from './discount.js';
import { MENU_ITEMS } from './menuFixtures.js';
import {
  ORDER_FIXTURES,
  type Modifier,
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
// Totals are never stored: `toShownOrder` runs `orderTotals` over the live
// lines every time, exactly as `discount.ts` prescribes.

type StoreState = {
  title: string;
  type?: OrderVariant;
  groups: ReadonlyArray<RoundGroup>;
  applied?: DiscountSnapshot;
  appliedNote?: string;
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
  return groups.map((g) => ({ ...g, lines: g.lines.filter((l) => l.id !== lineId) })).filter((g) => g.lines.length > 0);
}

function appendPending(groups: ReadonlyArray<RoundGroup>, line: OrderLine): ReadonlyArray<RoundGroup> {
  const i = groups.findIndex((g) => g.kind === 'pending');
  if (i === -1) return [...groups, { kind: 'pending', lines: [line] }];
  return groups.map((g, gi) => (gi === i ? { ...g, lines: [...g.lines, line] } : g));
}

function rewriteQuantity(groups: ReadonlyArray<RoundGroup>, lineId: string, quantity: number): ReadonlyArray<RoundGroup> {
  return groups.map((g) => ({
    ...g,
    lines: g.lines.map((l) => (l.id === lineId ? { ...l, quantity, amount: unitOf(l) * BigInt(quantity) } : l)),
  }));
}

/** Seeded once per mount: the fixture's own order, with a `?gone=` line already dropped, exactly as `shownOrder` drops it — never under a lock, fixture or derived (F3d rule 4). */
function seed(view: OrderView, locked: boolean): StoreState {
  const fixture = ORDER_FIXTURES[view.state];
  const drop = !fixture.lock && !locked && view.gone ? view.gone : undefined;
  return {
    title: fixture.title,
    ...(fixture.type && { type: fixture.type }),
    groups: drop ? dropLine(fixture.groups, drop) : fixture.groups,
    ...(fixture.applied && { applied: fixture.applied }),
    ...(fixture.appliedNote && { appliedNote: fixture.appliedNote }),
  };
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

/**
 * `locked` (F3d): the own-tab payment-session lock POS-03 derives from
 * PosRoutes, on top of whatever `ORDER_FIXTURES[view.state].lock` already
 * says. It guards the same two things the fixture lock guards — the initial
 * seed's `?gone=` drop and the post-mount effect's — so a `?gone=` mutation
 * walked in through the URL is refused the same way under either lock
 * (rule 4).
 */
export function useOrderStore(view: OrderView, locked = false): OrderStore {
  const [data, setData] = useState<StoreState>(() => seed(view, locked));
  const appliedGone = useRef(view.gone);
  const nextId = useRef(0);

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
    if (ORDER_FIXTURES[view.state].lock || locked) return;
    setData((prev) => ({ ...prev, groups: dropLine(prev.groups, view.gone!) }));
  }, [view.gone, view.state, locked]);

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
    setData((prev) => ({ ...prev, groups: appendPending(prev.groups, newLine) }));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setData((prev) => ({ ...prev, groups: dropLine(prev.groups, lineId) }));
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setData((prev) => ({ ...prev, groups: rewriteQuantity(prev.groups, lineId, quantity) }));
  }, []);

  return { order: toShownOrder(data), addLine, removeLine, setQuantity };
}
