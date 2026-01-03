import React, { PropsWithChildren } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { bookReducer } from '@/entities/book';
import { bookTypeReducer } from '@/entities/book-type';
import { sourceReducer } from '@/entities/source';
import { bookFilterReducer } from '@/features/book/set-book-filters';
import { authReducer } from '@/entities/auth';
import { usersReducer } from '@/entities/user';
import { nodesReducer } from '@/entities/node';
import { analyticsReducer } from '@/entities/analytics';

const store = configureStore({
  reducer: {
    auth: authReducer,
    books: bookReducer,
    bookTypes: bookTypeReducer,
    sources: sourceReducer,
    bookFilters: bookFilterReducer,
    users: usersReducer,
    nodes: nodesReducer,
    analytics: analyticsReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const StoreProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return <Provider store={store}>{children}</Provider>;
};
