import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@pos/tokens/frost.css';
import './pos.css';
import { PosRoutes } from './PosRoutes.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PosRoutes />
  </StrictMode>
);
