import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './app/router';
import { StoreProvider } from './app/providers/StoreProvider';
import { ThemeProvider } from './app/providers/ThemeProvider';
import './app/styles/global.css';
import 'antd/dist/reset.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <StoreProvider>
        <AppRouter />
      </StoreProvider>
    </ThemeProvider>
  </React.StrictMode>
);
