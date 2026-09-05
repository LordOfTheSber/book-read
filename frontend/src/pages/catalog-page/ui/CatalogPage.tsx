import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Form, Grid, Input, Modal, Select, Typography, theme } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { useRequestError } from '@/shared/lib/errors';
import { canEditContent, isAdminLike } from '@/shared/lib/roles';
import { findDuplicates } from '@/shared/lib/duplicates';
import { setFilters } from '@/features/book/set-book-filters';
import { fetchAuthorShowcase, mergeAuthorsThunk } from '@/entities/author';
import { fetchSeriesShowcase } from '@/entities/series';
import { CatalogShowcase } from '@/widgets/catalog-showcase';
import { CatalogTable } from '@/widgets/catalog-table';
import { DuplicateNotice } from './DuplicateNotice';
import {
  CatalogEntityKey,
  CatalogRow,
  catalogEntities,
  catalogEntityKeys,
  resolveEntityKey
} from '../model/catalogEntities';

type SortKey = 'name' | 'count' | 'finished';

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: 'count', label: 'Сначала частые' },
  { value: 'name', label: 'По алфавиту' },
  { value: 'finished', label: 'Сначала прочитанные' }
];

/**
 * Справочники — одна страница вместо четырёх.
 *
 * «Авторы», «Серии», «Типы» и «Источники» занимали четыре пункта меню и были устроены одинаково:
 * заголовок, поиск, таблица, окно правки. Здесь они собраны переключателем слева, а показываются
 * по-разному: у авторов и циклов обложки складываются в ответ «что из этого у меня есть», типам
 * и источникам показывать нечего — им остаётся строка с правкой на месте.
 */
export const CatalogPage: React.FC = () => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const { message, modal } = App.useApp();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const showRequestError = useRequestError();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useAppSelector((state) => state.auth.user?.role);

  const entityKey = resolveEntityKey(searchParams.get('entity'));
  const entity = catalogEntities[entityKey];
  const canEdit = canEditContent(role);
  const canDelete = isAdminLike(role);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('count');
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Пары, от объединения которых отказались: подсказка не должна возвращаться на каждый вход. */
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Счётчики в рельсе показывают все четыре справочника, поэтому грузятся все четыре.
  useEffect(() => {
    catalogEntityKeys.forEach((key) => dispatch(catalogEntities[key].load({ force: true })));
  }, [dispatch]);

  // Поиск и сортировка живут внутри справочника: перейдя к источникам, искать автора незачем.
  useEffect(() => {
    setQuery('');
  }, [entityKey]);

  // По селектору на справочник: один, собирающий объект, отдавал бы новую ссылку на каждый
  // рендер, и react-redux перерисовывал бы рельс без причины.
  const counts: Record<CatalogEntityKey, number> = {
    authors: useAppSelector((state) => state.authors.list.length),
    series: useAppSelector((state) => state.series.list.length),
    types: useAppSelector((state) => state.bookTypes.list.length),
    sources: useAppSelector((state) => state.sources.list.length)
  };

  const slice = useAppSelector(entity.select);
  const rows = useMemo(() => (slice.list as never[]).map((item) => entity.toRow(item)), [slice.list, entity]);
  /**
   * Исходные записи по идентификатору. Строка витрины приведена к общему виду и части полей
   * формы не знает: у источника в ней нет ни описания, ни адреса — сохранив её, правка имени
   * стёрла бы и то и другое.
   */
  const byId = useMemo(() => {
    const map = new Map<string, never>();
    (slice.list as never[]).forEach((item) => map.set(entity.toRow(item).id, item));
    return map;
  }, [slice.list, entity]);

  const visible = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const matched = trimmed
      ? rows.filter(
          (row) =>
            row.name.toLowerCase().includes(trimmed) ||
            Boolean(row.secondary?.toLowerCase().includes(trimmed))
        )
      : rows;

    const sorted = [...matched];
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'count') sorted.sort((a, b) => (b.itemCount ?? 0) - (a.itemCount ?? 0) || a.name.localeCompare(b.name));
    if (sort === 'finished') {
      sorted.sort((a, b) => (b.finishedCount ?? 0) - (a.finishedCount ?? 0) || a.name.localeCompare(b.name));
    }
    return sorted;
  }, [rows, query, sort]);

  /**
   * Дубли заводятся сами: имя вписывают руками в карточке, и справочник расходится на две строки.
   * Подсказка ищется только у авторов — только у них есть второе написание того же имени, и
   * только их объединение переносит произведения.
   */
  const duplicate = useMemo(() => {
    if (entityKey !== 'authors' || !canDelete) return undefined;
    return findDuplicates(
      rows.map((row) => ({ id: row.id, name: row.name, altName: row.altName, itemCount: row.itemCount ?? 0 }))
    ).find((pair) => !dismissed.includes(`${pair.target.id}:${pair.source.id}`));
  }, [entityKey, canDelete, rows, dismissed]);

  const openLibrary = (row: CatalogRow) => {
    dispatch(setFilters(entityKey === 'authors' ? { authorId: row.id, page: 0 } : { seriesId: row.id, page: 0 }));
    navigate('/');
  };

  const openForm = (row?: CatalogRow) => {
    setEditing(row ?? null);
    setFormOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields().catch(() => undefined);
    if (!values) return;
    setSaving(true);
    try {
      if (editing) {
        await dispatch(entity.update(editing.id, values)).unwrap();
        message.success(entity.labels.updated);
      } else {
        await dispatch(entity.create(values)).unwrap();
        message.success(entity.labels.created);
      }
      setFormOpen(false);
    } catch (error) {
      showRequestError(error, entity.labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const rename = async (row: CatalogRow, name: string) => {
    try {
      const original = byId.get(row.id);
      await dispatch(entity.update(row.id, { ...(original ? entity.toFormValues(original) : {}), name })).unwrap();
      message.success(entity.labels.updated);
    } catch (error) {
      showRequestError(error, entity.labels.saveError);
      throw error;
    }
  };

  const confirmDelete = (row: CatalogRow) => {
    modal.confirm({
      title: entity.labels.deleteTitle,
      content: entity.labels.deleteContent(row),
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await dispatch(entity.remove(row.id)).unwrap();
          message.success(entity.labels.deleted);
        } catch (error) {
          showRequestError(error, entity.labels.deleteError);
        }
      }
    });
  };

  const mergeAuthors = async (targetId: string, sourceId: string) => {
    try {
      await dispatch(mergeAuthorsThunk({ targetId, sourceId })).unwrap();
      message.success('Авторы объединены');
    } catch (error) {
      showRequestError(error, 'Не удалось объединить авторов');
    }
  };

  /** Витрина просит обложки по показанным идентификаторам — у авторов и циклов свой запрос. */
  const fetchShowcase = useCallback(
    (ids: string[]) => (entityKey === 'authors' ? fetchAuthorShowcase(ids) : fetchSeriesShowcase(ids)),
    [entityKey]
  );

  const isFiltered = Boolean(query.trim());
  const empty = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <span>
          <Typography.Text strong style={{ display: 'block' }}>
            {isFiltered ? 'Ничего не найдено' : entity.labels.emptyTitle}
          </Typography.Text>
          {!isFiltered && <Typography.Text type="secondary">{entity.labels.emptyHint}</Typography.Text>}
        </span>
      }
    >
      {!isFiltered && canEdit && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()}>
          {entity.labels.addButton}
        </Button>
      )}
    </Empty>
  );

  return (
    <div>
      <PageHeader
        title="Справочники"
        documentTitle={`Справочники · ${entity.labels.label}`}
        subtitle="Авторы, серии, типы и источники — четыре страницы, устроенные одинаково, собраны в одну"
      />

      <div
        style={{
          display: 'grid',
          // На широком экране рельс стоит слева колонкой, на узком ложится строкой над списком:
          // четыре пункта в ряд занимают меньше, чем четверть экрана телефона под колонку.
          gridTemplateColumns: screens.lg ? '240px minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: token.margin,
          alignItems: 'start'
        }}
      >
        <nav
          aria-label="Справочники"
          style={{
            display: 'flex',
            flexDirection: screens.lg ? 'column' : 'row',
            flexWrap: 'wrap',
            gap: 4,
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            padding: 8
          }}
        >
          {catalogEntityKeys.map((key) => {
            const active = key === entityKey;
            return (
              <button
                key={key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setSearchParams(key === 'authors' ? {} : { entity: key })}
                style={{
                  font: 'inherit',
                  cursor: 'pointer',
                  flex: '1 1 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  height: 40,
                  padding: '0 12px',
                  borderRadius: token.borderRadius,
                  border: 'none',
                  background: active ? token.colorPrimaryBg : 'transparent',
                  color: active ? token.colorPrimaryText : token.colorText,
                  fontWeight: active ? 600 : 400
                }}
              >
                <span>{catalogEntities[key].labels.label}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontVariantNumeric: 'tabular-nums',
                    color: active ? token.colorPrimaryText : token.colorTextTertiary
                  }}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </nav>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: token.marginSM, flexWrap: 'wrap' }}>
            <Input
              allowClear
              size="large"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder={entity.labels.searchPlaceholder}
              style={{ flex: '1 1 240px', minWidth: 0 }}
            />
            {entity.view === 'showcase' && (
              <Select<SortKey>
                size="large"
                value={sort}
                onChange={setSort}
                options={sortOptions}
                style={{ width: 200 }}
                aria-label="Порядок"
              />
            )}
            {canEdit && (
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openForm()}>
                {entity.labels.addButton}
              </Button>
            )}
          </div>

          {duplicate && (
            <DuplicateNotice
              pair={duplicate}
              onMerge={() => mergeAuthors(duplicate.target.id, duplicate.source.id)}
              onDismiss={() => setDismissed((current) => [...current, `${duplicate.target.id}:${duplicate.source.id}`])}
            />
          )}

          {entity.view === 'showcase' ? (
            <CatalogShowcase
              rows={visible}
              loading={slice.loading}
              empty={empty}
              fetchShowcase={fetchShowcase}
              onOpenLibrary={openLibrary}
              onEdit={canEdit ? openForm : undefined}
              onDelete={canDelete ? confirmDelete : undefined}
            />
          ) : (
            <CatalogTable
              rows={visible}
              loading={slice.loading}
              empty={empty}
              secondColumn={entityKey === 'sources' ? 'url' : 'updatedAt'}
              canEdit={canEdit}
              canDelete={canDelete}
              onRename={rename}
              onEditAll={openForm}
              onDelete={confirmDelete}
            />
          )}
        </div>
      </div>

      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={save}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
        title={editing ? entity.labels.editTitle : entity.labels.createTitle}
        destroyOnHidden
      >
        {/* destroyOnHidden пересоздаёт форму на каждое открытие: начальные значения подставляются
            без ручного setFieldsValue. */}
        <Form
          layout="vertical"
          form={form}
          initialValues={editing ? entity.toFormValues(byId.get(editing.id) as never) : undefined}
          style={{ paddingTop: 8 }}
        >
          {entity.formFields}
        </Form>
      </Modal>
    </div>
  );
};
