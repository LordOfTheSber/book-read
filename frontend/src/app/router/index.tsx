import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { PageLayout } from '@/shared/ui/PageLayout';
import { BooksPage } from '@/pages/books-page';
import { TypesPage } from '@/pages/types-page';

const router = createBrowserRouter([
  {
    path: '/',
    element: <PageLayout />,
    children: [
      { index: true, element: <BooksPage /> },
      { path: 'types', element: <TypesPage /> }
    ]
  }
]);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
