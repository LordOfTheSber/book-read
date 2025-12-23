import React from 'react';
import { Card, Flex, Typography } from 'antd';
import { FiltersPanelWidget } from '@/widgets/filters-panel/ui/FiltersPanelWidget';
import { BooksTableWidget } from '@/widgets/books-table/ui/BooksTableWidget';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { setFilters } from '@/features/book/set-book-filters';
import { useBooksPageStyles } from './BooksPage.styles';

const { Title, Paragraph } = Typography;

export const BooksPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.bookFilters);
  const styles = useBooksPageStyles();

  const handleChangePage = (page: number, size: number, sort?: string) => {
    dispatch(setFilters({ ...filters, page, size, sort }));
  };

  return (
    <Card title="Книги" style={styles.pageCard} headStyle={styles.pageHead} bodyStyle={styles.pageBody}>
      <Flex gap={styles.contentWrapper.gap} align="start">
        <Flex flex={1} vertical gap={18} style={styles.heroCard as React.CSSProperties}>
          <Title level={4} style={styles.heroTitle}>
            Личная библиотека
          </Title>
          <Paragraph style={styles.heroDescription}>
            Управляйте книгами, обновляйте статусы чтения и держите коллекцию в порядке.
          </Paragraph>
          <BooksTableWidget onChangePage={handleChangePage} />
        </Flex>
        <Card style={styles.filtersCard} bodyStyle={styles.filtersCardBodyStyle} bordered={false}>
          <div style={styles.filtersCardBody}>
            <Title level={5} style={styles.filtersTitle}>
              Фильтры
            </Title>
            <Paragraph style={styles.filtersDescription}>
              Уточните результаты поиска по типу, статусу или рейтингу.
            </Paragraph>
            <FiltersPanelWidget />
          </div>
        </Card>
      </Flex>
    </Card>
  );
};
