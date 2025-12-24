import React, { useEffect } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { PageLayout } from '@/shared/ui/PageLayout';
import { BooksPage } from '@/pages/books-page';
import { TypesPage } from '@/pages/types-page';
import { SourcesPage } from '@/pages/sources-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { UsersPage } from '@/pages/users-page';
import { fetchCurrentUser } from '@/entities/auth';

const RequireAuth: React.FC = () => {
  const token = useAppSelector((state) => state.auth.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const RequireAdmin: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  if (user?.role !== 'ADMIN') {
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
          { path: 'types', element: <TypesPage /> },
          { path: 'sources', element: <SourcesPage /> },
          {
            path: 'users',
            element: <RequireAdmin />,
            children: [{ index: true, element: <UsersPage /> }]
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
