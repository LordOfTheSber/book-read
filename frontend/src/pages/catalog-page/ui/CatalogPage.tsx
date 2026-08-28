import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Grid, Input, Segmented, Select, Space, Spin, Typography } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { useRequestError } from '@/shared/lib/errors';
import { canEditContent, isAdminLike } from '@/shared/lib/roles';
import { pluralize } from '@/shared/lib/plural';
import {
  createAuthorThunk,
  deleteAuthorThunk,
  loadAuthors,
  mergeAuthorsThunk,
  updateAuthorThunk
} from '@/entities/author';
import { createSeriesThunk, deleteSeriesThunk, loadSeries, updateSeriesThunk } from '@/entities/series';
import {
  createBookTypeThunk,
  deleteBookTypeThunk,
  loadBookTypes,
  updateBookTypeThunk
} from '@/entities/book-type';
import { createSourceThunk, deleteSourceThunk, loadSources, updateSourceThunk } from '@/entities/source';
import { loadBookAnalytics } from '@/entities/analytics';
import { setFilters } from '@/features/book/set-book-filters';
import {
  authorRow,
  catalogMeta,
  catalogSortOptions,
  CATALOG_ENTITIES,
  findDuplicatePairs,
  isCatalogEntity,
  searchMatches,
  seriesRow,
  sortRows,
  sourceRow,
  typeRow,
  useCatalogCovers,
  type CatalogEntityKey,
  type CatalogRow,
  type CatalogSort
} from '../model';
import { CatalogCards } from './CatalogCards';
import { CatalogRows } from './CatalogRows';
import { CatalogFormModal } from './CatalogFormModal';
import { DuplicateNotice } from './DuplicateNotice';
import { useCatalogStyles } from './CatalogPage.styles';

/** Карточки показываются порциями: на каждую уходит запрос за обложками. */
const CARDS_STEP = 12;

/**
 * Четыре справочника одной страницей (макеты `Catalog1` и `Catalog2`).
 *
 * Раньше это были четыре одинаковые страницы в меню — «Авторы», «Серии», «Типы», «Источники», —
 * собранные из общего компонента и занимавшие четыре пункта из одиннадцати. Здесь они стали
 * одной страницей с переключателем слева. Варианты макета не спорят, а делят справочники между
 * собой: у авторов и серий есть книги, и они показываются карточками с обложками; у типов и
 * источников показывать нечего, им остаётся строка с правкой на месте.
 */
export const CatalogPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const styles = useCatalogStyles();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [params, setParams] = useSearchParams();
  const raw = params.get('entity');
  const entity: CatalogEntityKey = isCatalogEntity(raw) ? raw : 'authors';
  const meta = catalogMeta(entity);

  const role = useAppSelector((state) => state.auth.user?.role);
  const canEdit = canEditContent(role);
  const canDelete = isAdminLike(role);

  const authors = useAppSelector((state) => state.authors);
  const series = useAppSelector((state) => state.series);
  const bookTypes = useAppSelector((state) => state.bookTypes);
  const sources = useAppSelector((state) => state.sources);
  const analytics = useAppSelector((state) => state.analytics.data);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CatalogSort>(catalogSortOptions(meta.view)[0].value);
  const [visibleCount, setVisibleCount] = useState(CARDS_STEP);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    // Справочник всегда перечитывается: он пополняется из карточки книги, и кэш здесь —
    // это вчерашний справочник.
    if (entity === 'authors') dispatch(loadAuthors({ force: true }));
    if (entity === 'series') dispatch(loadSeries({ force: true }));
    if (entity === 'types') dispatch(loadBookTypes());
    if (entity === 'sources') dispatch(loadSources());
  }, [dispatch, entity]);

  useEffect(() => {
    // Счётчики в рельсе показывают все четыре справочника сразу, поэтому списки нужны все.
    dispatch(loadAuthors());
    dispatch(loadSeries());
    dispatch(loadBookTypes());
    dispatch(loadSources());
    // Числа записей по типам и источникам живут в аналитике: своих счётчиков у них нет.
    dispatch(loadBookAnalytics(undefined));
  }, [dispatch]);

  useEffect(() => {
    setQuery('');
    setSort(catalogSortOptions(catalogMeta(entity).view)[0].value);
    setVisibleCount(CARDS_STEP);
  }, [entity]);

  const typeCounts = useMemo(
    () => new Map((analytics?.topTypes ?? []).map((type) => [type.typeId, type.count])),
    [analytics]
  );
  const sourceCounts = useMemo(
    () => new Map((analytics?.topSources ?? []).map((source) => [source.sourceId, source.count])),
    [analytics]
  );

  const rows = useMemo<CatalogRow[]>(() => {
    switch (entity) {
      case 'series':
        return series.list.map(seriesRow);
      case 'types':
        return bookTypes.list.map((type) => typeRow(type, typeCounts.get(type.id) ?? 0));
      case 'sources':
        return sources.list.map((source) => sourceRow(source, sourceCounts.get(source.id) ?? 0));
      default:
        return authors.list.map(authorRow);
    }
  }, [entity, authors.list, series.list, bookTypes.list, sources.list, typeCounts, sourceCounts]);

  const loading =
    (entity === 'authors' && authors.loading) ||
    (entity === 'series' && series.loading) ||
    (entity === 'types' && bookTypes.loading) ||
    (entity === 'sources' && sources.loading);

  const visible = useMemo(
    () => sortRows(rows.filter((row) => searchMatches(row, query)), sort),
    [rows, query, sort]
  );
  const shown = meta.view === 'cards' ? visible.slice(0, visibleCount) : visible;
  const covers = useCatalogCovers(entity, meta.view === 'cards' ? shown.map((row) => row.id) : []);

  /** Подсказка про дубли есть только у авторов: они одни заводятся сами из карточки книги. */
  const duplicate = useMemo(
    () => (entity === 'authors' ? findDuplicatePairs(authors.list)[0] : undefined),
    [entity, authors.list]
  );

  const counts: Record<CatalogEntityKey, number> = {
    authors: authors.list.length,
    series: series.list.length,
    types: bookTypes.list.length,
    sources: sources.list.length
  };

  const openLibrary = (row: CatalogRow) => {
    if (!row.libraryFilter) return;
    dispatch(setFilters({ ...row.libraryFilter, page: 0 }));
    navigate('/');
  };

  const save = async (row: CatalogRow | null, values: Record<string, string>) => {
    const payload = {
      name: values.name?.trim(),
      altName: values.altName?.trim() || undefined,
      description: values.description?.trim() || undefined,
      url: values.url?.trim()
    };

    try {
      switch (entity) {
        case 'authors':
          await (row
            ? dispatch(updateAuthorThunk({ id: row.id, payload })).unwrap()
            : dispatch(createAuthorThunk(payload)).unwrap());
          break;
        case 'series':
          await (row
            ? dispatch(updateSeriesThunk({ id: row.id, payload })).unwrap()
            : dispatch(createSeriesThunk(payload)).unwrap());
          break;
        case 'types':
          await (row
            ? dispatch(updateBookTypeThunk({ id: row.id, payload })).unwrap()
            : dispatch(createBookTypeThunk(payload)).unwrap());
          break;
        default:
          await (row
            ? dispatch(updateSourceThunk({ id: row.id, payload })).unwrap()
            : dispatch(createSourceThunk(payload)).unwrap());
      }
      message.success(row ? 'Запись обновлена' : 'Запись добавлена');
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить запись справочника');
      throw error;
    }
  };

  const remove = (row: CatalogRow) => {
    modal.confirm({
      title: `Удалить «${row.name}»?`,
      content:
        row.itemCount > 0
          ? `Записей с этой ссылкой: ${row.itemCount}. Удалить можно только то, чем ничего не пользуется.`
          : 'Запись справочника будет удалена.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          switch (entity) {
            case 'authors':
              await dispatch(deleteAuthorThunk(row.id)).unwrap();
              break;
            case 'series':
              await dispatch(deleteSeriesThunk(row.id)).unwrap();
              break;
            case 'types':
              await dispatch(deleteBookTypeThunk(row.id)).unwrap();
              break;
            default:
              await dispatch(deleteSourceThunk(row.id)).unwrap();
          }
          message.success('Запись удалена');
        } catch (error) {
          showRequestError(error, 'Не удалось удалить запись справочника');
        }
      }
    });
  };

  const mergeDuplicate = () => {
    if (!duplicate) return;
    modal.confirm({
      title: 'Объединить авторов?',
      content: `Книги автора «${duplicate.merge.name}» перейдут к «${duplicate.keep.name}», а сам он исчезнет из справочника. Книги при этом не пропадут.`,
      okText: 'Объединить',
      cancelText: 'Отмена',
      onOk: async () => {
        setMerging(true);
        try {
          await dispatch(
            mergeAuthorsThunk({ sourceId: duplicate.merge.id, targetId: duplicate.keep.id })
          ).unwrap();
          message.success('Авторы объединены');
        } catch (error) {
          showRequestError(error, 'Не удалось объединить авторов');
        } finally {
          setMerging(false);
        }
      }
    });
  };

  const switcher = isMobile ? (
    <Segmented
      block
      value={entity}
      onChange={(value) => setParams({ entity: String(value) })}
      options={CATALOG_ENTITIES.map((item) => ({ label: item.label, value: item.key }))}
      style={{ marginBottom: 14 }}
    />
  ) : (
    <div style={styles.rail}>
      {CATALOG_ENTITIES.map((item) => {
        const active = item.key === entity;
        return (
          <button
            key={item.key}
            type="button"
            style={styles.railItem(active)}
            aria-current={active ? 'page' : undefined}
            onClick={() => setParams({ entity: item.key })}
          >
            <span style={{ flex: 1 }}>{item.label}</span>
            <span style={styles.railCount(active)}>{counts[item.key]}</span>
          </button>
        );
      })}
    </div>
  );

  const content = (
    <div>
      <div style={styles.toolbar}>
        <Input
          allowClear
          size="large"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          prefix={<SearchOutlined style={styles.muted} />}
          placeholder={meta.searchPlaceholder}
          style={{ flex: 1, minWidth: 200 }}
        />
        <Select
          size="large"
          value={sort}
          onChange={setSort}
          options={catalogSortOptions(meta.view)}
          style={{ width: 200 }}
          aria-label="Порядок"
        />
        {canEdit && (
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            {isMobile ? 'Добавить' : meta.addButton}
          </Button>
        )}
      </div>

      {duplicate && (
        <DuplicateNotice
          pair={duplicate}
          canMerge={canEdit}
          merging={merging}
          onShow={() => setQuery(duplicate.merge.name)}
          onMerge={mergeDuplicate}
        />
      )}

      {loading && rows.length === 0 ? (
        <div style={{ ...styles.empty, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : shown.length === 0 ? (
        <div style={styles.empty}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text strong>
                  {query.trim() ? 'Ничего не найдено' : meta.emptyTitle}
                </Typography.Text>
                {!query.trim() && <Typography.Text type="secondary">{meta.emptyHint}</Typography.Text>}
              </Space>
            }
          />
        </div>
      ) : meta.view === 'cards' ? (
        <>
          <CatalogCards
            entity={entity}
            rows={shown}
            covers={covers}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={(row) => {
              setEditing(row);
              setFormOpen(true);
            }}
            onDelete={remove}
            onOpenLibrary={openLibrary}
          />
          {visible.length > shown.length && (
            <div style={styles.more}>
              <Button onClick={() => setVisibleCount((count) => count + CARDS_STEP)}>
                Показать ещё ({visible.length - shown.length})
              </Button>
            </div>
          )}
        </>
      ) : (
        <CatalogRows
          meta={meta}
          rows={shown}
          canEdit={canEdit}
          canDelete={canDelete}
          onSave={(row, values) => save(row, values)}
          onDelete={remove}
          onOpenLibrary={openLibrary}
        />
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Справочники"
        subtitle={`${meta.label} · ${pluralize(counts[entity], meta.words)} в справочнике`}
      />

      {isMobile ? (
        <>
          {switcher}
          {content}
        </>
      ) : (
        <div style={styles.layout(true)}>
          {switcher}
          {content}
        </div>
      )}

      <CatalogFormModal
        meta={meta}
        open={formOpen}
        editing={editing}
        onSubmit={(values) => save(editing, values)}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
};
