import React, { useEffect } from 'react';
import { Spin } from 'antd';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { PageLayout } from '@/shared/ui/PageLayout';
import { BooksPage } from '@/pages/books-page';
import { TypesPage } from '@/pages/types-page';
import { SourcesPage } from '@/pages/sources-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { UsersPage } from '@/pages/users-page';
import { NodesPage } from '@/pages/nodes-page';
import { NodeDetailPage } from '@/pages/node-detail-page';
import { fetchCurrentUser } from '@/entities/auth';
import { AnalyticsPage } from '@/pages/analytics-page';
import { ProfilePage } from '@/pages/profile-page';
import { ReaderPage } from '@/pages/reader-page';
import { isAdminLike } from '@/shared/lib/roles';

const RequireAuth: React.FC = () => {
  const token = useAppSelector((state) => state.auth.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const RequireAdmin: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const loadingUser = useAppSelector((state) => state.auth.loadingUser);
  const token = useAppSelector((state) => state.auth.token);

  if (loadingUser || (token && !user)) {
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
          { path: 'reader/:bookId', element: <ReaderPage /> },
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
  const token = useAppSelector((state) => state.auth.token);

  useEffect(() => {
    if (token) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, token]);

  return <RouterProvider router={router} />;
};
