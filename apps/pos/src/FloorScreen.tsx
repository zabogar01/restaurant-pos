import type { MouseEvent } from 'react';
import { EmergencyBanner } from './EmergencyBanner.js';
import {
  FLOOR_COPY,
  FLOOR_FIXTURES,
  FLOOR_STATES,
  type FloorState,
  type FloorTable,
} from './floorFixtures.js';
import { orderTotals } from './discount.js';
import { formatAmount } from './money.js';
import { followClientSide, isPlainClick } from './navigation.js';
import { FIRE_INCIDENT, ORDER_FIXTURES, type OrderState, type RoundGroup } from './orderFixtures.js';
import type { OrderBook } from './orderStore.js';
import type { PaymentSessions } from './paymentSession.js';
import type { ShownOrder } from './voidFixtures.js';

// POS-02, the floor (FE-026). Tables and one door to a quick sale. The fixture
// state selects the picture (floorFixtures.ts); what an occupied tile *says* is
// read from the order book whenever the book holds that table's order, so a
// table opened, added to and left is drawn from what it now holds, and the
// fixture's figures are only what the floor shows before it does.
//
// Every tile is an anchor that leaves the screen (ruling of 2026-09-17), followed
// client-side after it has told the book which order is now the active one —
// which is why the order store above the route survives the trip. A modified
// click is left to the browser.
//
// **Release is not drawn.** The artifact draws it, but it ends the actor's
// session, which is POS-01 and FR-A territory this slice does not own.

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The status line an order's own groups give: fired rounds, then the lines still
 * pending, or — with none pending — how many items the table holds. An *item* here
 * is a unit ordered, which is how the artifact counts Table 9's three Coffees and two
 * Sodas ("5 items"); the panel's own count is of lines (a design question, in the handoff).
 */
export function statusOf(groups: ReadonlyArray<RoundGroup>): string {
  const rounds = groups.filter((g) => g.kind === 'fired').length;
  const items = groups.flatMap((g) => g.lines).reduce((sum, l) => (l.status === 'voided' ? sum : sum + l.quantity), 0);
  const pending = groups.filter((g) => g.kind === 'pending').flatMap((g) => g.lines).length;
  const fired = rounds > 0 ? `${plural(rounds, 'round')} fired` : undefined;
  return [fired, pending > 0 ? `${plural(pending, 'line')} pending` : fired ? plural(items, 'item') : undefined]
    .filter(Boolean)
    .join(' · ');
}

const lineCount = (order: ShownOrder) => order.groups.flatMap((g) => g.lines).length;

type Tile = {
  n: number;
  open: boolean;
  status: string;
  /** Left of the bottom row: `Open`, or what a payment in progress still owes. */
  note: string;
  total: string | undefined;
  /** The order fixture the tile opens; absent for a table that has only ever been opened empty. */
  state: OrderState | undefined;
};

/**
 * One tile, from the book if it holds the table's order, else from the order
 * fixture it opens — either way derived from the order's own groups (orderTotals,
 * statusOf), never a figure typed on the tile. A table whose order holds no lines
 * is free: nothing to reopen.
 */
function tileFor(table: FloorTable, book: OrderBook, sessions: Pick<PaymentSessions, 'draftsOf'>): Tile {
  // FE-027: FR-D1's at-most-one is of *open* orders. A table whose only order in
  // the book is closed is free, whatever its fixture says; a new press starts a new
  // order under a new id, which is then not the fixture's order.
  const openId = book.openOrderIdOf(table.n);
  if (!openId && book.hasOrderFor(table.n)) return freeTileOf(table);
  const id = openId ?? `table-${table.n}`;
  const held = openId ? book.orderFor(openId) : undefined;
  const fixtureState = !openId || openId === `table-${table.n}` ? table.open?.state : undefined;
  const freeTile = freeTileOf(table);
  if (held ? lineCount(held) === 0 : !fixtureState) return freeTile;

  const order = held ?? fixtureOrder(fixtureState!);
  // A payment in progress is either this order's own session or the fixture's own lock (Table 7's).
  const sessionDrafts = sessions.draftsOf(id);
  const drafted = sessionDrafts
    ? sessionDrafts.reduce((sum, d) => sum + d.amount, 0n)
    : fixtureState && ORDER_FIXTURES[fixtureState].lock
      ? table.open?.drafted
      : undefined;
  const paying = drafted !== undefined;
  return {
    n: table.n,
    open: true,
    status: paying ? 'Payment in progress' : statusOf(order.groups),
    note: paying ? `${formatAmount(order.totals.total - drafted)} outstanding` : FLOOR_COPY.open,
    total: formatAmount(order.totals.total),
    state: fixtureState,
  };
}

const freeTileOf = (table: FloorTable): Tile => ({
  n: table.n,
  open: false,
  status: FLOOR_COPY.free,
  note: FLOOR_COPY.freeAction,
  total: undefined,
  state: undefined,
});

/** A fixture's order as the book would hold it, without seeding the book. */
function fixtureOrder(state: OrderState): ShownOrder {
  const f = ORDER_FIXTURES[state];
  const lines = f.groups.flatMap((g) => g.lines);
  const subtotal = lines.filter((l) => l.status !== 'voided').reduce((sum, l) => sum + l.amount, 0n);
  return { title: f.title, totals: orderTotals(subtotal, f.applied), groups: f.groups };
}

export function FloorScreen({
  state,
  book,
  sessions,
}: {
  state: FloorState;
  book: OrderBook;
  sessions: Pick<PaymentSessions, 'draftsOf'>;
}) {
  const fixture = FLOOR_FIXTURES[state];
  const tiles = fixture.tables.map((table) => tileFor(table, book, sessions));
  const openCount = tiles.filter((t) => t.open).length;

  // Which order a tile opens, and where. An order that holds lines opens at its own
  // fixture's state (or `default`); a table that holds none opens the empty one.
  const enter = (tile: Tile): { destination: string; open: () => void } => {
    if (tile.open) {
      const at = tile.state ?? 'default';
      return { destination: `/pos/order?state=${at}`, open: () => (tile.state ? book.openFixture(tile.state) : book.openTable(tile.n)) };
    }
    return { destination: '/pos/order?state=empty', open: () => book.openTable(tile.n) };
  };

  const go = (event: MouseEvent<HTMLAnchorElement>, destination: string, open: () => void) => {
    if (isPlainClick(event)) open();
    followClientSide(event, destination);
  };

  const subline = fixture.message === 'loading' ? FLOOR_COPY.loadingCount : fixture.message ? undefined : summaryOf(openCount, tiles.length - openCount);
  const quickDestination = '/pos/order?state=quick-new';

  return (
    <>
      <div className="pos-device floor" data-floor-state={state}>
        {fixture.incident && <EmergencyBanner {...FIRE_INCIDENT} />}
        <header className="floor-head">
          <h1>{FLOOR_COPY.title}</h1>
          <span className="floor-sub">{fixture.dayClosed ? FLOOR_COPY.dayClosed : FLOOR_COPY.dayOpen}</span>
          <div className="floor-actor">
            <span>{FLOOR_COPY.actor}</span>
            <span className="floor-idle">{FLOOR_COPY.idle}</span>
          </div>
        </header>
        {fixture.dayClosed && (
          <div className="floor-day">
            <strong>{FLOOR_COPY.closedBannerTitle}</strong>
            <div>{FLOOR_COPY.closedBannerBody}</div>
          </div>
        )}
        {fixture.receiptWarning && (
          <div className="floor-warning">
            <span className="floor-warning__mark" />
            {FLOOR_COPY.receiptWarning}
            <a href="/pos/incidents" onClick={(e) => followClientSide(e, '/pos/incidents')}>
              {FLOOR_COPY.receiptWarningAction}
            </a>
          </div>
        )}
        <div className="floor-toolbar">
          <div>
            <h2>{FLOOR_COPY.tables}</h2>
            {subline && <div className="floor-sub">{subline}</div>}
          </div>
          <div className="floor-tools">
            <a className="floor-action" href="/pos/closed-orders" onClick={(e) => followClientSide(e, '/pos/closed-orders')}>
              {FLOOR_COPY.closedOrders}
            </a>
            <a
              className="floor-action floor-action--primary"
              href={quickDestination}
              onClick={(e) => go(e, quickDestination, () => book.newQuickSale())}
            >
              {FLOOR_COPY.newQuickSale}
            </a>
          </div>
        </div>

        {fixture.message === 'loading' && (
          <section className="floor-message" aria-live="polite">
            <h2>{FLOOR_COPY.loading.title}</h2>
            <p>{FLOOR_COPY.loading.body}</p>
          </section>
        )}
        {fixture.message === 'error' && (
          <section className="floor-message">
            <h2>{FLOOR_COPY.error.title}</h2>
            <p>{FLOOR_COPY.error.body}</p>
            <a className="floor-action" href="/pos/floor" onClick={(e) => followClientSide(e, '/pos/floor')}>
              {FLOOR_COPY.error.action}
            </a>
          </section>
        )}
        {fixture.message === 'empty' && (
          <section className="floor-message">
            <h2>{FLOOR_COPY.empty.title}</h2>
            <p>{FLOOR_COPY.empty.body}</p>
          </section>
        )}

        {tiles.length > 0 && (
          <div className="floor-grid" tabIndex={0} role="region" aria-label={FLOOR_COPY.gridLabel}>
            {tiles.map((tile) => {
              const { destination, open } = enter(tile);
              return (
                <a
                  key={tile.n}
                  className={tile.open ? 'floor-table floor-table--open' : 'floor-table'}
                  href={destination}
                  data-table={tile.n}
                  aria-label={`Table ${tile.n}, ${tile.open ? 'open existing order' : 'free, open new order'}`}
                  onClick={(e) => go(e, destination, open)}
                >
                  <div>
                    <strong>Table {tile.n}</strong>
                    <div className="floor-sub">{tile.status}</div>
                  </div>
                  <div className="floor-table-bottom">
                    <span className="floor-sub">{tile.note}</span>
                    {tile.total && <span className="floor-table-amount">{tile.total}</span>}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
      {import.meta.env.DEV && (
        <nav className="fixture-states" aria-label="Fixture states">
          {FLOOR_STATES.map((s) => (
            <a key={s.id} href={`?state=${s.id}`} aria-current={s.id === state ? 'page' : undefined}>
              {s.label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}

/** `4 open · 8 free`; a floor with nothing open says only how many are free. */
function summaryOf(open: number, free: number): string {
  return open > 0 ? `${open} open · ${free} free` : `${free} free`;
}
