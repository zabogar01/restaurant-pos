import { useCallback, useEffect, useState } from 'react';
import { App } from './App.js';
import { OrderScreen } from './OrderPanel.js';
import { orderViewFrom, type OrderView } from './orderFixtures.js';
import { useOrderStore } from './orderStore.js';
import { SettlementScreen, settlementStateFrom } from './SettlementScreen.js';

/**
 * A direct settlement fixture visit needs the order the reviewed POS-04
 * artifact's state actually draws (F3c): `pending` keeps the Steak — the live
 * rule (FR-G10) is the whole point of that state; `zero` is the order with
 * the Steak gone under a 100% comp, so nothing is left pending; `error` adds
 * the Fries a rejected close leaves fired behind. Every other fixture state
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
  return { state: 'default', gone: 'steak' };
}

/** The POS client routes full-screen destinations without adding a router dependency. */
export function PosRoutes() {
  const [, setLocation] = useState(() => `${window.location.pathname}${window.location.search}`);
  const path = window.location.pathname;
  const onOrder = /\/order\/?$/.test(path);
  const onSettlement = /\/settlement\/?$/.test(path);
  const [seedView] = useState(() =>
    onOrder
      ? orderViewFrom(window.location.search)
      : onSettlement
        ? settlementSeed(window.location.search)
        : { state: 'default' as const }
  );
  const view = onOrder ? orderViewFrom(window.location.search) : seedView;
  const store = useOrderStore(view);

  const readLocation = useCallback(() => setLocation(`${window.location.pathname}${window.location.search}`), []);

  useEffect(() => {
    window.addEventListener('popstate', readLocation);
    return () => window.removeEventListener('popstate', readLocation);
  }, [readLocation]);

  if (onSettlement) return <SettlementScreen store={store} />;
  if (onOrder) return <OrderScreen view={view} store={store} onLocationChange={readLocation} />;
  return <App />;
}
