import '@pos/contracts/browser';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@pos/tokens/frost.css';
import './office.css';
import { OfficeApp } from './OfficeApp.js';
import { Screens } from './Screens.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OfficeApp>
      <Screens />
    </OfficeApp>
  </StrictMode>
);
