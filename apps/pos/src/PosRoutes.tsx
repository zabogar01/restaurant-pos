import { useCallback, useEffect, useState } from 'react';
import { App } from './App.js';
import { FloorScreen } from './FloorScreen.js';
import { floorStateFrom } from './floorFixtures.js';
import { ControlledOrderScreen } from './OrderPanel.js';
import { incidentStateFrom } from './incidentFixtures.js';
import { IncidentsScreen } from './IncidentsScreen.js';
import { orderViewFrom, type OrderView } from './orderFixtures.js';
import { useOrderBook } from './orderStore.js';
import { usePaymentSessions } from './paymentSession.js';
import { beginsSession, ControlledSettlementScreen, initialDrafts, settlementStateFrom } from './SettlementScreen.js';

/**
 * A direct settlement fixture visit needs the order the reviewed POS-04
 * artifact's state actually draws (F3c): `pending` keeps the Steak — the live
 * rule (FR-G10) is the whole point of that state; `zero` is the order with
 * the Steak gone under a 100% comp, so nothing is left pending; `error` adds
 * the Fries a rejected close leaves fired behind; `ceiling-single` is the 100.000.000 order under Staff meal 10%
 * whose 94.500.000 balance binds the single-tender cap (FE-020). Every other fixture state
 * keeps F3a's original seed, the default table after its pending Steak is
 * gone. A real departure from POS-03 seeds from that screen instead and
 * persists across the route change, which is the flow this slice exists to
 * prove.
 */
function settlementSeed(search: string): OrderView {
  const settlementState = settlementStateFrom(search);
  if (settlementState === 'pending') return { state: 'default' };
  if (settlementState === 'zero') return { state: 'zero', gone: 'steak' };
  if (settlementState === 'error') return { state: 'settle-error' };
  if (settlementState === 'ceiling-single') return { state: 'settle-ceiling' };
  return { state: 'default', gone: 'steak' };
}

/** The POS client routes full-screen destinations without adding a router dependency. */
export function PosRoutes() {
  const [, setLocation] = useState(() => `${window.location.pathname}${window.location.search}`);
  const path = window.location.pathname;
  const onOrder = /\/order\/?$/.test(path);
  const onSettlement = /\/settlement\/?$/.test(path);
  const onFloor = /\/floor\/?$/.test(path);
  const onIncidents = /\/incidents\/?$/.test(path);
  const onClosedOrders = /\/closed-orders\/?$/.test(path);
  const [seedView] = useState(() =>
    onOrder
      ? orderViewFrom(window.location.search)
      : onSettlement
        ? settlementSeed(window.location.search)
        : { state: 'default' as const }
  );
  const view = onOrder ? orderViewFrom(window.location.search) : seedView;
  // FE-026: a payment session belongs to one order, like the book's orders. The
  // lock is asked of the active order's own session; the screens are handed that
  // one, so another order's drafts are never on Table 9's settlement.
  const sessions = usePaymentSessions();
  const { store, book } = useOrderBook(view, (activeId) => sessions.isActive(activeId), onOrder || onSettlement);
  const session = sessions.forOrder(book.activeId);
  const locked = session.active;

  // F3d, rule 1: the session begins on Settle and on any direct
  // `/pos/settlement` visit, and never re-seeds while already active — its
  // drafts beat a fixture's. This is a render-time state adjustment (React's
  // documented "adjust state while rendering" pattern), not an effect: the
  // first paint of the visit already carries the seeded drafts, with no
  // unseeded flash while an effect caught up a tick later. `leaselost` and
  // `settle-takeover` are lease/identity fixtures, never this cashier's own
  // payment, so they never open one (rules 3, 9, 10).
  const settlementFixtureState = settlementStateFrom(window.location.search);
  if (onSettlement && !session.active && beginsSession(settlementFixtureState)) {
    session.activate(
      initialDrafts(settlementFixtureState, store.order.totals.total),
      settlementFixtureState === 'error'
    );
  }

  const readLocation = useCallback(() => setLocation(`${window.location.pathname}${window.location.search}`), []);

  useEffect(() => {
    window.addEventListener('popstate', readLocation);
    return () => window.removeEventListener('popstate', readLocation);
  }, [readLocation]);

  if (onSettlement) return <ControlledSettlementScreen store={store} session={session} />;
  if (onOrder) return <ControlledOrderScreen view={view} store={store} locked={locked} showFloorLink onLocationChange={readLocation} />;
  if (onFloor) return <FloorScreen state={floorStateFrom(window.location.search)} book={book} sessions={sessions} />;
  if (onClosedOrders) return <ClosedOrdersPlaceholder />;
  if (onIncidents) return <IncidentsScreen state={incidentStateFrom(window.location.search)} />;
  return <App />;
}

/**
 * POS-05 is DESIGN-009's: a placeholder route on `?state=incidents`'s precedent
 * (F2h) — named and reached, honest that nothing is built behind it. Like the
 * floor's placeholder before it, it renders the bare device frame and no copy.
 */
function ClosedOrdersPlaceholder() {
  return <div className="pos-device" />;
}
