import React, { useEffect, useMemo, useState } from 'react';
import { Button, Grid, Tag, Typography, theme } from 'antd';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { setFilters, resetFilters, type BookFilterState } from '@/features/book/set-book-filters';
import { loadBooks } from '@/entities/book';
import { loadBookTypes } from '@/entities/book-type';
import { loadSources } from '@/entities/source';
import { loadAuthors } from '@/entities/author';
import { loadSeries } from '@/entities/series';
import { loadTags } from '@/entities/tag';
import { loadShelves } from '@/entities/shelf';
import { loadUsers } from '@/entities/user';
import { loadBookAnalytics } from '@/entities/analytics';
import { isAdminLike, canEditBooks } from '@/shared/lib/roles';
import { pluralize } from '@/shared/lib/plural';
import { describeFilters } from '@/shared/lib/filterLabels';
import { ReadingStatus } from '@/shared/types/library';
import { BooksListWidget, type BooksViewMode } from '@/widgets/books-list';
import { BooksToolbarWidget, type BooksLayout } from '@/widgets/books-toolbar';
import { FiltersPanelWidget } from '@/widgets/filters-panel';
import { BulkActionsBar } from '@/widgets/bulk-actions';
import { SmartShelvesWidget } from '@/widgets/smart-shelves';
import { BooksStatusRail } from '@/widgets/books-status-rail';
import { LibraryRail } from '@/widgets/library-rail';
import { ContinueShelf } from '@/widgets/continue-shelf';
import { useRecordForm } from '@/app/providers/RecordFormProvider';

const VIEW_MODE_KEY = 'books-view-mode';
const LAYOUT_KEY = 'books-layout';

/** Раскладка запоминается рядом с видом списка: вернувшись, человек видит то, что оставил. */
const readLayout = (): BooksLayout => {
  if (typeof window === 'undefined') return 'list';
  return window.localStorage.getItem(LAYOUT_KEY) === 'desk' ? 'desk' : 'list';
};

const appliedRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 14
};

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
  const tags = useAppSelector((state) => state.tags.list);
  const shelves = useAppSelector((state) => state.shelves.list);
  const users = useAppSelector((state) => state.users.list);
  const usersLoaded = useAppSelector((state) => state.users.loaded);
  const usersLoading = useAppSelector((state) => state.users.loading);
  const analytics = useAppSelector((state) => state.analytics.data);
  const analyticsLoading = useAppSelector((state) => state.analytics.loading);
  const role = useAppSelector((state) => state.auth.user?.role);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const isAdmin = isAdminLike(role);
  const canEdit = canEditBooks(role);
  // Добавление и редактирование живут в оболочке: действие «Добавить» одно на всё приложение.
  const { openCreate, openEdit } = useRecordForm();

  const [viewMode, setViewMode] = useState<BooksViewMode>(readViewMode);
  const [layout, setLayout] = useState<BooksLayout>(readLayout);
  // Рельс отнимает 258 px: на телефоне их взять неоткуда, там остаётся drawer.
  const showRail = layout === 'desk' && !isMobile;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveShelfOpen, setSaveShelfOpen] = useState(false);
  /** Выделение для массовых операций: живёт на странице, потому что панель действий над списком. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Загрузка данных живёт на странице: виджеты только отображают состояние.
  useEffect(() => {
    dispatch(loadBooks(filters));
  }, [dispatch, filters]);

  /**
   * Выделение переживает листание намеренно — отметить записи на двух страницах и применить
   * действие разом это нормально. А вот смену фильтров оно переживать не должно: панель обещала
   * применить правку к записям, которых в текущей выдаче уже нет.
   */
  const filterSignature = JSON.stringify({ ...filters, page: 0, size: 0, sort: '' });
  useEffect(() => {
    setSelectedIds([]);
  }, [filterSignature]);

  useEffect(() => {
    dispatch(loadBookTypes());
    dispatch(loadSources());
    dispatch(loadAuthors());
    dispatch(loadSeries());
    dispatch(loadTags());
    dispatch(loadShelves());
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

  const handleLayoutChange = (value: BooksLayout) => {
    setLayout(value);
    window.localStorage.setItem(LAYOUT_KEY, value);
  };

  const handleChangePage = (page: number, size: number, sort?: string) => {
    dispatch(setFilters({ page, size, sort }));
  };

  // Подписи условий считает общий помощник: их же показывает пустой экран и окно умной полки,
  // и расходиться эти три места не должны — человек сохраняет ровно то, что видит.
  const activeFilters = useMemo(
    () => describeFilters(filters, { bookTypes, authors, series, tags, shelves, users }),
    [filters, bookTypes, users, authors, series, tags, shelves]
  );

  const hasActiveFilters = activeFilters.length > 0 || Boolean(filters.q);

  const statusCount = (status: ReadingStatus) => analytics?.statusBreakdown?.[status] ?? 0;

  const subtitle = analytics
    ? `${pluralize(analytics.totalItems, ['запись', 'записи', 'записей'])} в коллекции · ${statusCount(
        'READING'
      )} в процессе`
    : 'Личный дневник прочитанного и просмотренного';

  return (
    <div>
      {/* Кнопки действия здесь больше нет: «Добавить» стоит в шапке и доступно с любой
          страницы — на библиотеке она была вторым таким же экземпляром. */}
      <PageHeader title="Моя библиотека" subtitle={subtitle} hideTitleOnMobile />

      {/* Пять плиток высотой 76 px занимали первый экран и повторяли фильтры из панели ниже.
          Строка чипов говорит то же самое и поднимает начало списка примерно на 180 px. */}
      <BooksStatusRail
        analytics={analytics}
        loading={analyticsLoading}
        status={filters.status}
        favorite={filters.favorite}
        wishlist={filters.wishlist}
        onSelectStatus={(status) => dispatch(setFilters({ status, page: 0 }))}
        onToggleFavorite={() => dispatch(setFilters({ favorite: filters.favorite ? undefined : true, page: 0 }))}
        onToggleWishlist={() => dispatch(setFilters({ wishlist: filters.wishlist ? undefined : true, page: 0 }))}
        isMobile={isMobile}
      />

      {/* Рабочий стол: полки и фильтры уезжают в постоянный рельс слева, а над списком
          встаёт то, что читается прямо сейчас. Список при этом тот же. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        {showRail && <LibraryRail />}

        <div style={{ flex: 1, minWidth: 0 }}>
          {showRail && (
            <ContinueShelf
              onOpen={openEdit}
              onShowAll={() => dispatch(setFilters({ status: 'READING', page: 0 }))}
            />
          )}

        <BooksToolbarWidget
          search={filters.q ?? ''}
          onSearchChange={(value) => dispatch(setFilters({ q: value || undefined, page: 0 }))}
          sort={filters.sort}
          onSortChange={(value) => dispatch(setFilters({ sort: value, page: 0 }))}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onOpenFilters={() => setFiltersOpen(true)}
          layout={layout}
          onLayoutChange={handleLayoutChange}
          activeFilterCount={activeFilters.length}
          isMobile={isMobile}
          smartShelves={
            <SmartShelvesWidget saveOpen={saveShelfOpen} onSaveOpenChange={setSaveShelfOpen} iconOnly={isMobile} />
          }
        />

        {/* Что именно сейчас показано — строкой под панелью, а не внутри неё: набор фильтров
            относится к списку, и сохранять его как умную полку логично здесь же. */}
        {activeFilters.length > 0 && (
          <div style={appliedRowStyle}>
            <Typography.Text type="secondary">Показаны:</Typography.Text>
            {activeFilters.map((filter) => (
              <Tag
                key={filter.key}
                closable
                onClose={(event) => {
                  event.preventDefault();
                  dispatch(setFilters({ [filter.key]: undefined, page: 0 } as Partial<BookFilterState>));
                }}
                bordered={false}
                style={{ borderRadius: 999, paddingInline: 10, background: token.colorFillQuaternary, marginInlineEnd: 0 }}
              >
                {filter.label}
              </Tag>
            ))}
            <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => dispatch(resetFilters())}>
              Сбросить всё
            </Button>
            <Typography.Text type="secondary">·</Typography.Text>
            <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setSaveShelfOpen(true)}>
              Сохранить как умную полку
            </Button>
          </div>
        )}

        {/* Панель массовых операций появляется только при выделении и не занимает места впустую. */}
        {canEdit && selectedIds.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <BulkActionsBar selectedIds={selectedIds} onClearSelection={() => setSelectedIds([])} />
          </div>
        )}

        <BooksListWidget
          viewMode={viewMode}
          isMobile={isMobile}
          onChangePage={handleChangePage}
          onEdit={openEdit}
          onCreate={openCreate}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={() => dispatch(resetFilters())}
          activeFilters={activeFilters}
          onRemoveFilter={(key) => dispatch(setFilters({ [key]: undefined, page: 0 } as Partial<BookFilterState>))}
          query={filters.q}
          onClearQuery={() => dispatch(setFilters({ q: undefined, page: 0 }))}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />

              </div>
      </div>

<FiltersPanelWidget open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
};
