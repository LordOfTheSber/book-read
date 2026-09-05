import React, { useEffect } from 'react';
import { Spin } from 'antd';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { PageLayout } from '@/app/layouts/PageLayout';
import { BooksPage } from '@/pages/books-page';
import { RecordPage } from '@/pages/record-page';
import { CatalogPage } from '@/pages/catalog-page';
import { QuotesPage } from '@/pages/quotes-page';
import { ShelvesPage } from '@/pages/shelves-page';
import { ImportPage } from '@/pages/import-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { AdminPage } from '@/pages/admin-page';
import { NodeDetailPage } from '@/pages/node-detail-page';
import { fetchCurrentUser } from '@/entities/auth';
import { AnalyticsPage } from '@/pages/analytics-page';
import { ProfilePage } from '@/pages/profile-page';
import { UserProfilePage } from '@/pages/user-profile-page';
import { FeedPage } from '@/pages/feed-page';
import { GoalsPage } from '@/pages/goals-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { ForbiddenPage } from '@/pages/forbidden-page';
import { ErrorPage } from '@/pages/error-page';
import { isAdminLike } from '@/shared/lib/roles';

const RequireAuth: React.FC = () => {
  const authenticated = useAppSelector((state) => state.auth.authenticated);
  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const RequireAdmin: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const loadingUser = useAppSelector((state) => state.auth.loadingUser);
  const authenticated = useAppSelector((state) => state.auth.authenticated);

  if (loadingUser || (authenticated && !user)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spin size="large" />
      </div>
    );
  }

  // Отказ показывается, а не прячется переходом: см. `ForbiddenPage`.
  if (!isAdminLike(user?.role)) {
    return <ForbiddenPage />;
  }
  return <Outlet />;
};

const router = createBrowserRouter([
  {
    // Одна на всё дерево: упавшая страница иначе выбрасывает пользователя на стек вызовов.
    errorElement: <ErrorPage />,
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <PageLayout />,
        children: [
          { index: true, element: <BooksPage /> },
          // У записи свой адрес: на неё дают ссылку и открывают в новой вкладке.
          { path: 'library/:id', element: <RecordPage /> },
          { path: 'analytics', element: <AnalyticsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          // Публичный профиль живёт на коротком /u/:username: этот адрес люди пересылают друг другу.
          { path: 'u/:username', element: <UserProfilePage /> },
          { path: 'feed', element: <FeedPage /> },
          { path: 'goals', element: <GoalsPage /> },
          { path: 'catalog', element: <CatalogPage /> },
          // Четыре справочника съехались на одну страницу, но их адреса разосланы и лежат
          // в закладках: старый путь ведёт в тот же справочник, а не в «страница не найдена».
          { path: 'authors', element: <Navigate to="/catalog" replace /> },
          { path: 'series', element: <Navigate to="/catalog?entity=series" replace /> },
          { path: 'types', element: <Navigate to="/catalog?entity=types" replace /> },
          { path: 'sources', element: <Navigate to="/catalog?entity=sources" replace /> },
          { path: 'quotes', element: <QuotesPage /> },
          { path: 'shelves', element: <ShelvesPage /> },
          { path: 'import', element: <ImportPage /> },
          {
            // Пользователи, сессии, копии и узлы — один раздел: по отдельности их открывают
            // единицы, а места в меню они занимали два пункта из одиннадцати.
            path: 'admin',
            element: <RequireAdmin />,
            children: [{ index: true, element: <AdminPage /> }]
          },
          { path: 'users', element: <Navigate to="/admin?tab=users" replace /> },
          {
            path: 'nodes',
            element: <RequireAdmin />,
            children: [
              { index: true, element: <Navigate to="/admin" replace /> },
              // У узла остаётся своя страница: на неё уходят с обзора за подробностями.
              { path: ':nodeId', element: <NodeDetailPage /> }
            ]
          },
          // Внутри layout, а не отдельным экраном: с неизвестного адреса должно быть видно
          // меню, иначе единственный выход — кнопка «назад» в браузере.
          { path: '*', element: <NotFoundPage /> }
        ]
      }
    ]
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorPage />
  },
  {
    path: '/register',
    element: <RegisterPage />,
    errorElement: <ErrorPage />
  }
]);

export const AppRouter: React.FC = () => {
  const dispatch = useAppDispatch();
  const authenticated = useAppSelector((state) => state.auth.authenticated);

  useEffect(() => {
    if (authenticated) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, authenticated]);

  return <RouterProvider router={router} />;
};
