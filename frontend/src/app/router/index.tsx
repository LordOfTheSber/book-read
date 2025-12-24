import React from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { PageLayout } from '@/shared/ui/PageLayout';
import { BooksPage } from '@/pages/books-page';
import { TypesPage } from '@/pages/types-page';
import { SourcesPage } from '@/pages/sources-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { useAppSelector } from '@/shared/lib/hooks';

const RequireAuth: React.FC = () => {
  const token = useAppSelector((state) => state.auth.token);
  if (!token) {
    return <Navigate to="/login" replace />;
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
          { path: 'sources', element: <SourcesPage /> }
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

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
