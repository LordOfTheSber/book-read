import React, { PropsWithChildren } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { bookReducer } from '@/entities/book';
import { bookTypeReducer } from '@/entities/book-type';
import { sourceReducer } from '@/entities/source';
import { authorReducer } from '@/entities/author';
import { seriesReducer } from '@/entities/series';
import { bookFilterReducer } from '@/features/book/set-book-filters';
import { authActions, authReducer } from '@/entities/auth';
import { usersReducer } from '@/entities/user';
import { nodesReducer } from '@/entities/node';
import { analyticsReducer } from '@/entities/analytics';
import { setAuthEventHandlers } from '@/shared/api/httpClient';

const store = configureStore({
  reducer: {
    auth: authReducer,
    books: bookReducer,
    bookTypes: bookTypeReducer,
    sources: sourceReducer,
    authors: authorReducer,
    series: seriesReducer,
    bookFilters: bookFilterReducer,
    users: usersReducer,
    nodes: nodesReducer,
    analytics: analyticsReducer
  }
});

// Перехватчик httpClient работает вне React, поэтому о смерти сессии сообщает через колбэк.
setAuthEventHandlers({
  onSessionExpired: () => store.dispatch(authActions.logout())
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const StoreProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return <Provider store={store}>{children}</Provider>;
};
