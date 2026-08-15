import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './app/router';
import { StoreProvider } from './app/providers/StoreProvider';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { registerServiceWorker } from './app/pwa/register';
import './app/styles/global.css';
import 'antd/dist/reset.css';

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <StoreProvider>
      <AppRouter />
    </StoreProvider>
  </ThemeProvider>
);
