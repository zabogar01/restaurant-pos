import { useCallback, useEffect, useState } from 'react';
import { App } from './App.js';
import { OrderScreen } from './OrderPanel.js';
import { orderViewFrom } from './orderFixtures.js';
import { useOrderStore } from './orderStore.js';
import { SettlementScreen } from './SettlementScreen.js';

/** The POS client routes full-screen destinations without adding a router dependency. */
export function PosRoutes() {
  const [, setLocation] = useState(() => `${window.location.pathname}${window.location.search}`);
  const path = window.location.pathname;
  const onOrder = /\/order\/?$/.test(path);
  const onSettlement = /\/settlement\/?$/.test(path);
  // A direct fixture visit needs the same settled table order the reviewed
  // POS-04 artifact draws: the default table after its pending Steak is gone.
  // A real departure from POS-03 seeds from that screen instead and persists
  // across the route change, which is the flow this slice exists to prove.
  const [seedView] = useState(() =>
    onOrder ? orderViewFrom(window.location.search) : onSettlement ? { state: 'default' as const, gone: 'steak' } : { state: 'default' as const }
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
