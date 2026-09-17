import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@pos/tokens/frost.css';
import './pos.css';
import { App } from './App.js';
import { OrderScreen } from './OrderPanel.js';

// Two fixture screens, no router: /pos/ is the lock screen (POS-01) and
// /pos/order is the order panel (POS-03, F2a). Each takes its own ?state=.
const orderScreen = /\/order\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {orderScreen ? <OrderScreen /> : <App />}
  </StrictMode>
);
