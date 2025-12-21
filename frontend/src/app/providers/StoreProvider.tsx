import React, { PropsWithChildren } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { bookReducer } from '@/entities/book';
import { bookTypeReducer } from '@/entities/book-type';
import { bookFilterReducer } from '@/features/book/set-book-filters';

const store = configureStore({
  reducer: {
    books: bookReducer,
    bookTypes: bookTypeReducer,
    bookFilters: bookFilterReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const StoreProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return <Provider store={store}>{children}</Provider>;
};
