import React, { useEffect } from 'react';
import { Spin } from 'antd';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { PageLayout } from '@/shared/ui/PageLayout';
import { BooksPage } from '@/pages/books-page';
import { TypesPage } from '@/pages/types-page';
import { SourcesPage } from '@/pages/sources-page';
import { AuthorsPage } from '@/pages/authors-page';
import { SeriesPage } from '@/pages/series-page';
import { QuotesPage } from '@/pages/quotes-page';
import { ShelvesPage } from '@/pages/shelves-page';
import { ImportPage } from '@/pages/import-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { UsersPage } from '@/pages/users-page';
import { NodesPage } from '@/pages/nodes-page';
import { NodeDetailPage } from '@/pages/node-detail-page';
import { fetchCurrentUser } from '@/entities/auth';
import { AnalyticsPage } from '@/pages/analytics-page';
import { ProfilePage } from '@/pages/profile-page';
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

  if (!isAdminLike(user?.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <PageLayout />,
        children: [
          { index: true, element: <BooksPage /> },
          { path: 'analytics', element: <AnalyticsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'types', element: <TypesPage /> },
          { path: 'sources', element: <SourcesPage /> },
          { path: 'authors', element: <AuthorsPage /> },
          { path: 'series', element: <SeriesPage /> },
          { path: 'quotes', element: <QuotesPage /> },
          { path: 'shelves', element: <ShelvesPage /> },
          { path: 'import', element: <ImportPage /> },
          {
            path: 'users',
            element: <RequireAdmin />,
            children: [{ index: true, element: <UsersPage /> }]
          },
          {
            path: 'nodes',
            element: <RequireAdmin />,
            children: [
              { index: true, element: <NodesPage /> },
              { path: ':nodeId', element: <NodeDetailPage /> }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/register',
    element: <RegisterPage />
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
