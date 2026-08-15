import React, { PropsWithChildren, ReactElement } from 'react';
import { App as AntApp } from 'antd';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react';
import { authReducer } from '@/entities/auth';
import { bookReducer } from '@/entities/book';
import { bookTypeReducer } from '@/entities/book-type';
import { sourceReducer } from '@/entities/source';
import { authorReducer } from '@/entities/author';
import { seriesReducer } from '@/entities/series';
import { tagReducer } from '@/entities/tag';
import { shelfReducer } from '@/entities/shelf';
import { smartShelfReducer } from '@/entities/smart-shelf';
import { usersReducer } from '@/entities/user';
import { analyticsReducer } from '@/entities/analytics';
import { bookFilterReducer } from '@/features/book/set-book-filters';

const rootReducer = combineReducers({
  auth: authReducer,
  books: bookReducer,
  bookTypes: bookTypeReducer,
  sources: sourceReducer,
  authors: authorReducer,
  series: seriesReducer,
  tags: tagReducer,
  shelves: shelfReducer,
  smartShelves: smartShelfReducer,
  bookFilters: bookFilterReducer,
  users: usersReducer,
  analytics: analyticsReducer
});

export type TestRootState = ReturnType<typeof rootReducer>;

/**
 * Тот же набор редьюсеров, что в StoreProvider, но store создаётся под каждый тест: общий
 * синглтон из приложения переносил бы состояние между проверками.
 */
export const createTestStore = (preloadedState?: Partial<TestRootState>) =>
  configureStore({ reducer: rootReducer, preloadedState });

export type TestStore = ReturnType<typeof createTestStore>;

export const renderWithStore = (ui: ReactElement, store: TestStore = createTestStore()) => {
  const Wrapper: React.FC<PropsWithChildren> = ({ children }) => (
    <Provider store={store}>
      {/* Формы показывают результат через App.useApp() — без провайдера он бросает предупреждение. */}
      <AntApp>{children}</AntApp>
    </Provider>
  );

  return { ...render(ui, { wrapper: Wrapper }), store };
};
