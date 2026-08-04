import React, { useEffect, useMemo, useState } from 'react';
import { Button, Grid } from 'antd';
import { BookOutlined, CheckCircleOutlined, ClockCircleOutlined, PlusOutlined, ReadOutlined, StarOutlined } from '@ant-design/icons';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { setFilters, resetFilters, type BookFilterState } from '@/features/book/set-book-filters';
import { loadBooks } from '@/entities/book';
import { loadBookTypes } from '@/entities/book-type';
import { loadSources } from '@/entities/source';
import { loadAuthors } from '@/entities/author';
import { loadSeries } from '@/entities/series';
import { loadUsers } from '@/entities/user';
import { loadBookAnalytics } from '@/entities/analytics';
import { isAdminLike, canEditBooks } from '@/shared/lib/roles';
import { statusMeta } from '@/shared/constants/status';
import { LibraryItem, ReadingStatus } from '@/shared/types/library';
import { BooksListWidget, type BooksViewMode } from '@/widgets/books-list';
import { BooksToolbarWidget, type ActiveFilterChip } from '@/widgets/books-toolbar';
import { FiltersPanelWidget } from '@/widgets/filters-panel';
import { BookFormDrawer } from '@/widgets/book-form';
import { useBooksPageStyles } from './BooksPage.styles';

const VIEW_MODE_KEY = 'books-view-mode';

const readViewMode = (): BooksViewMode => {
  if (typeof window === 'undefined') return 'table';
  return window.localStorage.getItem(VIEW_MODE_KEY) === 'grid' ? 'grid' : 'table';
};

export const BooksPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.bookFilters);
  const total = useAppSelector((state) => state.books.total);
  const bookTypes = useAppSelector((state) => state.bookTypes.list);
  const authors = useAppSelector((state) => state.authors.list);
  const series = useAppSelector((state) => state.series.list);
  const users = useAppSelector((state) => state.users.list);
  const usersLoaded = useAppSelector((state) => state.users.loaded);
  const usersLoading = useAppSelector((state) => state.users.loading);
  const analytics = useAppSelector((state) => state.analytics.data);
  const analyticsLoading = useAppSelector((state) => state.analytics.loading);
  const role = useAppSelector((state) => state.auth.user?.role);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const styles = useBooksPageStyles();
  const isAdmin = isAdminLike(role);
  const canEdit = canEditBooks(role);

  const [viewMode, setViewMode] = useState<BooksViewMode>(readViewMode);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);

  // Загрузка данных живёт на странице: виджеты только отображают состояние.
  useEffect(() => {
    dispatch(loadBooks(filters));
  }, [dispatch, filters]);

  useEffect(() => {
    dispatch(loadBookTypes());
    dispatch(loadSources());
    dispatch(loadAuthors());
    dispatch(loadSeries());
  }, [dispatch]);

  useEffect(() => {
    dispatch(loadBookAnalytics(filters.userId));
  }, [dispatch, filters.userId, total]);

  useEffect(() => {
    if (isAdmin && !usersLoaded && !usersLoading) {
      dispatch(loadUsers());
    }
  }, [dispatch, isAdmin, usersLoaded, usersLoading]);

  const handleViewModeChange = (mode: BooksViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const handleChangePage = (page: number, size: number, sort?: string) => {
    dispatch(setFilters({ page, size, sort }));
  };

  const handleStatusTile = (status?: ReadingStatus) => {
    dispatch(setFilters({ status: filters.status === status ? undefined : status, page: 0 }));
  };

  const activeFilters = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (filters.status) {
      chips.push({ key: 'status', label: `Статус: ${statusMeta[filters.status as ReadingStatus]?.label ?? filters.status}` });
    }
    if (filters.typeId) {
      const name = bookTypes.find((type) => type.id === filters.typeId)?.name ?? 'выбран';
      chips.push({ key: 'typeId', label: `Тип: ${name}` });
    }
    if (filters.authorId) {
      const name = authors.find((author) => author.id === filters.authorId)?.name ?? 'выбран';
      chips.push({ key: 'authorId', label: `Автор: ${name}` });
    }
    if (filters.seriesId) {
      const name = series.find((item) => item.id === filters.seriesId)?.name ?? 'выбрана';
      chips.push({ key: 'seriesId', label: `Серия: ${name}` });
    }
    if (filters.favorite) {
      chips.push({ key: 'favorite', label: 'Только избранное' });
    }
    if (filters.minRating !== undefined && filters.minRating !== null) {
      chips.push({ key: 'minRating', label: `Оценка от ${filters.minRating}` });
    }
    if (filters.maxRating !== undefined && filters.maxRating !== null) {
      chips.push({ key: 'maxRating', label: `Оценка до ${filters.maxRating}` });
    }
    if (filters.userId) {
      const name = users.find((user) => user.id === filters.userId)?.username ?? 'выбран';
      chips.push({ key: 'userId', label: `Пользователь: ${name}` });
    }
    return chips;
  }, [filters, bookTypes, users, authors, series]);

  const hasActiveFilters = activeFilters.length > 0 || Boolean(filters.q);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: LibraryItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  const statusCount = (status: ReadingStatus) => analytics?.statusBreakdown?.[status] ?? 0;

  const subtitle = analytics
    ? `${analytics.totalItems} книг в коллекции · ${statusCount('READING')} в процессе`
    : 'Личная коллекция книг и статусы чтения';

  return (
    <div style={styles.page}>
      <PageHeader
        title="Моя библиотека"
        subtitle={subtitle}
        actions={
          canEdit && (
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreate}>
              Добавить книгу
            </Button>
          )
        }
      />

      <div style={styles.stats}>
        <StatTile
          label="Всего"
          value={analytics?.totalItems ?? 0}
          icon={<BookOutlined />}
          loading={analyticsLoading && !analytics}
        />
        <StatTile
          label="Читаю"
          value={statusCount('READING')}
          icon={<ReadOutlined />}
          accent={styles.accents.reading}
          active={filters.status === 'READING'}
          loading={analyticsLoading && !analytics}
          onClick={() => handleStatusTile('READING')}
        />
        <StatTile
          label="Завершено"
          value={statusCount('COMPLETED')}
          icon={<CheckCircleOutlined />}
          accent={styles.accents.completed}
          active={filters.status === 'COMPLETED'}
          loading={analyticsLoading && !analytics}
          onClick={() => handleStatusTile('COMPLETED')}
        />
        <StatTile
          label="В планах"
          value={statusCount('PLANNED')}
          icon={<ClockCircleOutlined />}
          accent={styles.accents.planned}
          active={filters.status === 'PLANNED'}
          loading={analyticsLoading && !analytics}
          onClick={() => handleStatusTile('PLANNED')}
        />
        <StatTile
          label="Избранное"
          value={analytics?.favoriteItems ?? 0}
          hint={analytics?.averageRating ? `средняя оценка ${analytics.averageRating.toFixed(1)}` : undefined}
          icon={<StarOutlined />}
          accent={styles.accents.favorite}
          active={Boolean(filters.favorite)}
          loading={analyticsLoading && !analytics}
          onClick={() => dispatch(setFilters({ favorite: filters.favorite ? undefined : true, page: 0 }))}
        />
      </div>

      <BooksToolbarWidget
        search={filters.q ?? ''}
        onSearchChange={(value) => dispatch(setFilters({ q: value || undefined, page: 0 }))}
        sort={filters.sort}
        onSortChange={(value) => dispatch(setFilters({ sort: value, page: 0 }))}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenFilters={() => setFiltersOpen(true)}
        activeFilters={activeFilters}
        onRemoveFilter={(key) => dispatch(setFilters({ [key]: undefined, page: 0 } as Partial<BookFilterState>))}
        onResetFilters={() => dispatch(resetFilters())}
        isMobile={isMobile}
      />

      <BooksListWidget
        viewMode={viewMode}
        isMobile={isMobile}
        onChangePage={handleChangePage}
        onEdit={openEdit}
        onCreate={openCreate}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={() => dispatch(resetFilters())}
      />

      <FiltersPanelWidget open={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <BookFormDrawer open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
};
