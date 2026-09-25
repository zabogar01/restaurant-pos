import { useCallback, useEffect, useState } from 'react';
import { App } from './App.js';
import { ControlledOrderScreen } from './OrderPanel.js';
import { incidentStateFrom } from './incidentFixtures.js';
import { IncidentsScreen } from './IncidentsScreen.js';
import { orderViewFrom, type OrderView } from './orderFixtures.js';
import { useOrderStore } from './orderStore.js';
import { usePaymentSession } from './paymentSession.js';
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
  const [seedView] = useState(() =>
    onOrder
      ? orderViewFrom(window.location.search)
      : onSettlement
        ? settlementSeed(window.location.search)
        : { state: 'default' as const }
  );
  const view = onOrder ? orderViewFrom(window.location.search) : seedView;
  const session = usePaymentSession();
  const store = useOrderStore(view, session.active);

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
    session.activate(initialDrafts(settlementFixtureState, store.order.totals.total), settlementFixtureState === 'error');
  }

  const readLocation = useCallback(() => setLocation(`${window.location.pathname}${window.location.search}`), []);

  useEffect(() => {
    window.addEventListener('popstate', readLocation);
    return () => window.removeEventListener('popstate', readLocation);
  }, [readLocation]);

  if (onSettlement) return <ControlledSettlementScreen store={store} session={session} />;
  if (onOrder) return <ControlledOrderScreen view={view} store={store} locked={session.active} onLocationChange={readLocation} />;
  if (onFloor) return <FloorPlaceholder />;
  if (onIncidents) return <IncidentsScreen state={incidentStateFrom(window.location.search)} />;
  return <App />;
}

/**
 * FR-G14's *Back to floor* (rule 9): POS-02 does not exist yet and is F4's.
 * A placeholder route on `?state=incidents`'s precedent (F2h) — named and
 * reached, honest that nothing is built behind it. **The floor's placeholder
 * wording belongs to a designer (F3 review finding 4, P3): this renders the
 * bare device frame and no copy at all.**
 */
function FloorPlaceholder() {
  return <div className="pos-device" />;
}
