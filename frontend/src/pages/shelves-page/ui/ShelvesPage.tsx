import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Form, Grid, Input, List, Modal, Skeleton, Switch, Typography, theme } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Shelf, ShelfItem, Tag as LibraryTag } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import {
  createShelfThunk,
  deleteShelfThunk,
  fetchShelfItems,
  loadShelves,
  removeShelfItemsThunk,
  updateShelfThunk
} from '@/entities/shelf';
import { deleteTagThunk, loadTags, mergeTagsThunk, updateTagThunk } from '@/entities/tag';
import { applySavedFilter } from '@/features/book/set-book-filters';
import { findDuplicates } from '@/shared/lib/duplicates';
import { useRequestError } from '@/shared/lib/errors';
import { ShelfMembersModal } from '@/widgets/shelf-members';
import { ShelfRow } from './ShelfRow';
import { TagRow } from './TagRow';

interface ShelfFormValues {
  name: string;
  description?: string;
  isPublic?: boolean;
}

/** Столько тегов видно сразу; остальные разворачиваются по «Показать все». */
const TAGS_SHOWN = 10;

/**
 * Полки и теги — две разные сущности, и страница показывает это прямо: слева полки с признаком
 * общей и участниками, справа теги с полосой веса и уборкой дублей.
 *
 * До этого полки были плитками в три ряда, а теги — облаком чипов внизу: полка занимала место
 * карточки, ничего этим не показывая (обложек в ней нет), а тег терялся среди сорока таких же.
 * Здесь всё видно без прокрутки, а вес тега читается полосой, а не числом в скобках.
 */
export const ShelvesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const shelves = useAppSelector((state) => state.shelves.list);
  const loading = useAppSelector((state) => state.shelves.loading);
  const tags = useAppSelector((state) => state.tags.list);

  const [form] = Form.useForm<ShelfFormValues>();
  const [editing, setEditing] = useState<Shelf | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ shelf: Shelf; items: ShelfItem[] } | null>(null);
  const [membersOf, setMembersOf] = useState<Shelf | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** Идентификатор тега, который сейчас переименовывают: строка на это время становится полем. */
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState(false);
  /** Пары, от объединения которых отказались: подсказка не должна возвращаться на каждый вход. */
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    dispatch(loadShelves({ force: true }));
    dispatch(loadTags({ force: true }));
  }, [dispatch]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (shelf: Shelf) => {
    setEditing(shelf);
    form.setFieldsValue({ name: shelf.name, description: shelf.description, isPublic: shelf.isPublic });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => undefined);
    if (!values) return;
    setSaving(true);
    try {
      const payload = { name: values.name, description: values.description, isPublic: Boolean(values.isPublic) };
      if (editing) {
        await dispatch(updateShelfThunk({ id: editing.id, payload })).unwrap();
        message.success('Полка обновлена');
      } else {
        await dispatch(createShelfThunk(payload)).unwrap();
        message.success('Полка создана');
      }
      setFormOpen(false);
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить полку');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteShelf = (shelf: Shelf) => {
    modal.confirm({
      title: 'Удалить полку?',
      content: `«${shelf.name}» исчезнет, но сами записи останутся в библиотеке.`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await dispatch(deleteShelfThunk(shelf.id)).unwrap();
          message.success('Полка удалена');
        } catch (error) {
          showRequestError(error, 'Не удалось удалить полку');
        }
      }
    });
  };

  const confirmDeleteTag = (tag: LibraryTag) => {
    modal.confirm({
      title: 'Удалить тег?',
      content: `Пометка «${tag.name}» снимется со всех записей; сами записи останутся.`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await dispatch(deleteTagThunk(tag.id)).unwrap();
          message.success('Тег удалён');
        } catch (error) {
          showRequestError(error, 'Не удалось удалить тег');
        }
      }
    });
  };

  const renameTag = async (tag: LibraryTag, name: string) => {
    if (!name.trim() || name.trim() === tag.name) {
      setRenamingTag(null);
      return;
    }
    try {
      await dispatch(updateTagThunk({ id: tag.id, payload: { name: name.trim(), color: tag.color } })).unwrap();
      message.success('Тег переименован');
      setRenamingTag(null);
    } catch (error) {
      showRequestError(error, 'Не удалось переименовать тег');
    }
  };

  const removeFromShelf = async (shelf: Shelf, itemId: string) => {
    try {
      await dispatch(removeShelfItemsThunk({ id: shelf.id, itemIds: [itemId] })).unwrap();
      setPreview((current) =>
        current ? { ...current, items: current.items.filter((item) => item.id !== itemId) } : current
      );
      message.success('Снято с полки');
    } catch (error) {
      showRequestError(error, 'Не удалось снять запись с полки');
    }
  };

  const openPreview = async (shelf: Shelf) => {
    setPreviewLoading(true);
    setPreview({ shelf, items: [] });
    try {
      setPreview({ shelf, items: await fetchShelfItems(shelf.id) });
    } catch (error) {
      showRequestError(error, 'Не удалось открыть полку');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  /**
   * «Показать в библиотеке» — тот же список, но с фильтром: там доступны правка и прогресс.
   * Остальные фильтры сбрасываются: с оставшимся «только избранное» полка выглядела бы полупустой,
   * и понять, почему, было бы неоткуда.
   */
  const showInLibrary = (shelfId?: string, tagId?: string) => {
    dispatch(applySavedFilter({ shelfId, tagId }));
    navigate('/');
  };

  /**
   * Дубли среди тегов: пометка заводится из карточки, и «манга» с «Манга» расходятся в две.
   * Объединение переносит пометки на остающийся тег — пересечение при этом не удваивается.
   */
  const duplicate = useMemo(
    () =>
      findDuplicates(tags.map((tag) => ({ id: tag.id, name: tag.name, itemCount: tag.itemCount }))).find(
        (pair) => !dismissed.includes(`${pair.target.id}:${pair.source.id}`)
      ),
    [tags, dismissed]
  );

  const mergeTags = async (targetId: string, sourceId: string) => {
    try {
      await dispatch(mergeTagsThunk({ targetId, sourceId })).unwrap();
      message.success('Теги объединены');
    } catch (error) {
      showRequestError(error, 'Не удалось объединить теги');
    }
  };

  const maxCount = tags.reduce((max, tag) => Math.max(max, tag.itemCount), 0);
  const sortedTags = useMemo(() => [...tags].sort((a, b) => b.itemCount - a.itemCount), [tags]);
  const shownTags = allTags ? sortedTags : sortedTags.slice(0, TAGS_SHOWN);

  const sectionLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary
  };

  const card: React.CSSProperties = {
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG
  };

  return (
    <div>
      <PageHeader
        title="Полки и теги"
        subtitle="Полка — набор, собранный руками; тег — свободная пометка в дополнение к типу"
      />

      <div
        style={{
          display: 'grid',
          // Полки шире тегов: у полки есть описание и участники, у тега — слово и число.
          gridTemplateColumns: screens.lg ? 'minmax(0, 1.35fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: token.margin,
          alignItems: 'start'
        }}
      >
        <section aria-label="Полки">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              gap: 12
            }}
          >
            <span style={sectionLabel}>{`Полки · ${shelves.length}`}</span>
            <Button type="link" style={{ paddingInline: 0 }} icon={<PlusOutlined />} onClick={openCreate}>
              Новая полка
            </Button>
          </div>

          {loading && shelves.length === 0 ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : shelves.length === 0 ? (
            <div style={{ ...card, padding: token.paddingLG }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Полок пока нет — соберите первую: «подарить», «книжный клуб», «на дачу»"
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Новая полка
                </Button>
              </Empty>
            </div>
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {shelves.map((shelf, index) => (
                <ShelfRow
                  key={shelf.id}
                  shelf={shelf}
                  last={index === shelves.length - 1}
                  index={index}
                  onOpenLibrary={() => showInLibrary(shelf.id, undefined)}
                  onPreview={() => openPreview(shelf)}
                  onMembers={() => setMembersOf(shelf)}
                  onEdit={shelf.canCurate ? () => openEdit(shelf) : undefined}
                  onDelete={shelf.owned ? () => confirmDeleteShelf(shelf) : undefined}
                />
              ))}
            </div>
          )}

          {/* Умные полки живут в рельсе над списком: искать их здесь — первое, что делают. */}
          <div
            style={{
              marginTop: 14,
              padding: `14px ${token.padding}px`,
              borderRadius: token.borderRadiusLG,
              background: token.colorPrimaryBg,
              color: token.colorPrimaryText,
              fontSize: 13,
              lineHeight: 1.6
            }}
          >
            Умные полки — сохранённые фильтры библиотеки — живут отдельно, в панели над списком.
            Здесь только те, что собраны руками.
          </div>
        </section>

        <section aria-label="Теги">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              gap: 12
            }}
          >
            <span style={sectionLabel}>{`Теги · ${tags.length}`}</span>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              по числу записей
            </Typography.Text>
          </div>

          <div style={{ ...card, padding: `8px ${token.paddingSM}px` }}>
            {tags.length === 0 ? (
              <Typography.Paragraph type="secondary" style={{ margin: '12px 8px' }}>
                Тегов пока нет — их проще всего завести прямо в карточке произведения: поле «Теги».
              </Typography.Paragraph>
            ) : (
              <>
                {shownTags.map((tag, index) => (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    maxCount={maxCount}
                    last={index === shownTags.length - 1}
                    renaming={renamingTag === tag.id}
                    onOpenLibrary={() => showInLibrary(undefined, tag.id)}
                    onStartRename={() => setRenamingTag(tag.id)}
                    onRename={(name) => renameTag(tag, name)}
                    onDelete={() => confirmDeleteTag(tag)}
                  />
                ))}
                {sortedTags.length > TAGS_SHOWN && (
                  <Button type="link" style={{ paddingInline: 8 }} onClick={() => setAllTags((value) => !value)}>
                    {allTags ? 'Свернуть' : `Показать все ${sortedTags.length}`}
                  </Button>
                )}
              </>
            )}
          </div>

          {duplicate && (
            <div style={{ ...card, marginTop: 14, padding: `14px ${token.padding}px` }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                Уборка
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
                {`Похоже, что «${duplicate.source.name}» и «${duplicate.target.name}» — одно и то же: `}
                {`${duplicate.source.itemCount} и ${duplicate.target.itemCount} записей.`}
              </Typography.Text>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Button
                  type="primary"
                  size="small"
                  onClick={() =>
                    modal.confirm({
                      title: 'Объединить теги?',
                      content: `Пометка «${duplicate.source.name}» заменится на «${duplicate.target.name}» на всех записях, после чего «${duplicate.source.name}» будет удалена. Отменить это нельзя.`,
                      okText: 'Объединить',
                      cancelText: 'Отмена',
                      onOk: () => mergeTags(duplicate.target.id, duplicate.source.id)
                    })
                  }
                >
                  Объединить
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    setDismissed((current) => [...current, `${duplicate.target.id}:${duplicate.source.id}`])
                  }
                >
                  Оставить как есть
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <Modal
        title={editing ? `Переименовать «${editing.name}»` : 'Новая полка'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={handleSubmit}
        confirmLoading={saving}
        okText={editing ? 'Сохранить' : 'Создать'}
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form layout="vertical" form={form} initialValues={{ isPublic: false }}>
          {/* Полка создаётся пустой, и без этой подсказки непонятно, чем её наполнять. */}
          <Typography.Paragraph type="secondary">
            Полка собирается вручную: отметьте её в карточке произведения (поле «Полки») или выделите
            записи в списке библиотеки и выберите «На полку».
          </Typography.Paragraph>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
            <Input placeholder="Например, «Книжный клуб, весна»" maxLength={128} />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Зачем эта полка и что на неё попадает" />
          </Form.Item>
          <Form.Item
            name="isPublic"
            label="Открыть другим"
            valuePropName="checked"
            tooltip="Полку увидят на вашей публичной странице; приватная заметка в состав не входит"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={preview?.shelf.name}
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        footer={null}
        destroyOnHidden
        width={640}
      >
        {previewLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <List
            dataSource={preview?.items ?? []}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="На полке пока пусто. Записи попадают сюда из карточки — поле «Полки» — или выделением в списке библиотеки"
                />
              )
            }}
            renderItem={(item) => (
              <List.Item
                // Снять с полки нужно оттуда же, где видно состав: иначе единственный путь —
                // открыть карточку и убрать полку в её поле.
                actions={
                  preview?.shelf.canContribute
                    ? [
                        <Button
                          key="remove"
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removeFromShelf(preview.shelf, item.id)}
                          aria-label={`Снять «${item.title}» с полки`}
                        />
                      ]
                    : undefined
                }
              >
                <List.Item.Meta title={item.title} description={item.authorNames.join(', ') || 'Автор не указан'} />
                {item.rating !== undefined && item.rating !== null && (
                  <Typography.Text type="secondary">{item.rating}</Typography.Text>
                )}
              </List.Item>
            )}
          />
        )}
      </Modal>

      <ShelfMembersModal shelf={membersOf} onClose={() => setMembersOf(null)} />
    </div>
  );
};
