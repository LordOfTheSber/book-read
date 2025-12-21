import React from 'react';
import { Card } from 'antd';
import { FiltersPanelWidget } from '@/widgets/filters-panel/ui/FiltersPanelWidget';
import { BooksTableWidget } from '@/widgets/books-table/ui/BooksTableWidget';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { setFilters } from '@/features/book/set-book-filters';

export const BooksPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.bookFilters);

  const handleChangePage = (page: number, size: number, sort?: string) => {
    dispatch(setFilters({ ...filters, page, size, sort }));
  };

  return (
    <Card title="Books">
      <FiltersPanelWidget />
      <BooksTableWidget onChangePage={handleChangePage} />
    </Card>
  );
};
