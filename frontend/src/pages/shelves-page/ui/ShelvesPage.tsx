import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Grid,
  Input,
  List,
  Modal,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  GlobalOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Shelf, ShelfItem, TagDuplicate, Tag as LibraryTag } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import {
  createShelfThunk,
  deleteShelfThunk,
  fetchShelfItems,
  loadShelves,
  removeShelfItemsThunk,
  updateShelfThunk
} from '@/entities/shelf';
import { deleteTagThunk, fetchTagDuplicates, loadTags, mergeTags, updateTagThunk } from '@/entities/tag';
import { applySavedFilter } from '@/features/book/set-book-filters';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';
import { ShelfMembersModal } from '@/widgets/shelf-members';
import { shelfRoleMeta } from '@/shared/constants/social';
import { kindColor } from '@/shared/config/brand';
import { useShelvesPageStyles } from './ShelvesPage.styles';

interface ShelfFormValues {
  name: string;
  description?: string;
  isPublic?: boolean;
}

/** Столько тегов видно сразу: дальше список перестаёт читаться и превращается в справочник. */
const TAGS_SHOWN = 10;

/** Палитра значков полок — те же цвета, что у видов произведения: другого набора в бренде нет. */
const SHELF_COLORS = Object.values(kindColor).map((entry) => entry.color);

/** Цвет по имени, а не по позиции: полка не должна менять цвет от того, что соседнюю удалили. */
const shelfColor = (name: string) => {
  const sum = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return SHELF_COLORS[sum % SHELF_COLORS.length];
};

/**
 * Полки и теги по макету `Shelves2.dc.html`: две колонки вместо ленты карточек и облака чипов.
 *
 * Полка и тег — разные сущности, и страница показывает это прямо: слева полки с признаком общей
 * и участниками, справа теги с полосой веса. Полоса нужна затем, чтобы дубли и мусор были видны
 * без чтения счётчиков, а «Уборка» показывает то, чего не видно вовсе: две пометки, стоящие
 * на одних и тех же книгах.
 */
export const ShelvesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const styles = useShelvesPageStyles();
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
  const [allTagsShown, setAllTagsShown] = useState(false);
  const [duplicates, setDuplicates] = useState<TagDuplicate[]>([]);
  /**
   * Отклонённые подсказки живут до конца захода: «оставить как есть» — это ответ про сейчас,
   * а не решение навсегда, и хранить его на сервере было бы обещанием, которого никто не давал.
   */
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  const loadDuplicates = useCallback(() => {
    fetchTagDuplicates()
      .then(setDuplicates)
      // Подсказка не должна ронять страницу: без неё справочник остаётся работоспособным.
      .catch(() => setDuplicates([]));
  }, []);

  useEffect(() => {
    dispatch(loadShelves({ force: true }));
    dispatch(loadTags({ force: true }));
    loadDuplicates();
  }, [dispatch, loadDuplicates]);

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
          loadDuplicates();
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

  /**
   * Объединение необратимо и меняет пометки у десятков записей — поэтому последствия называются
   * числами до нажатия, а не после.
   */
  const confirmMerge = (duplicate: TagDuplicate) => {
    modal.confirm({
      title: `Объединить «${duplicate.source.name}» с «${duplicate.target.name}»?`,
      content: `Пометка «${duplicate.source.name}» снимется с ${pluralize(duplicate.source.itemCount, [
        'записи',
        'записей',
        'записей'
      ])} и заменится на «${duplicate.target.name}». Сам тег «${duplicate.source.name}» исчезнет.`,
      okText: 'Объединить',
      cancelText: 'Отмена',
      onOk: async () => {
        setMerging(true);
        try {
          await mergeTags(duplicate.source.id, duplicate.target.id);
          dispatch(loadTags({ force: true }));
          loadDuplicates();
          message.success('Теги объединены');
        } catch (error) {
          showRequestError(error, 'Не удалось объединить теги');
        } finally {
          setMerging(false);
        }
      }
    });
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

  /** Теги идут по весу, а не по алфавиту: полоса сравнивает соседей, и порядок должен помогать. */
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name)),
    [tags]
  );
  const heaviestTag = sortedTags[0]?.itemCount ?? 0;
  const visibleTags = allTagsShown ? sortedTags : sortedTags.slice(0, TAGS_SHOWN);
  const publicCount = shelves.filter((shelf) => shelf.isPublic).length;
  const suggestion = duplicates.find((duplicate) => !dismissed.includes(duplicate.source.id));

  const shelvesColumn = (
    <div>
      <div style={styles.sectionHead}>
        <Typography.Text type="secondary" style={styles.sectionLabel}>
          {`Полки · ${shelves.length}`}
        </Typography.Text>
        <Button type="link" size="small" icon={<PlusOutlined />} onClick={openCreate} style={{ paddingInline: 0 }}>
          Новая полка
        </Button>
      </div>

      {loading && shelves.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : shelves.length === 0 ? (
        <Card style={styles.card}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Полок пока нет — соберите первую: «подарить», «книжный клуб», «на дачу»"
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Новая полка
            </Button>
          </Empty>
        </Card>
      ) : (
        <Card style={styles.card} styles={{ body: styles.listBody }}>
          {shelves.map((shelf, index) => (
            <div key={shelf.id} style={styles.row(index === shelves.length - 1)}>
              <span aria-hidden style={styles.shelfIcon(shelfColor(shelf.name))}>
                <AppstoreOutlined />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <Space size={8} wrap>
                  <Typography.Link strong onClick={() => showInLibrary(shelf.id, undefined)}>
                    {shelf.name}
                  </Typography.Link>
                  {shelf.isPublic && (
                    <Tooltip title="Полку видно другим пользователям по ссылке">
                      <Tag color="processing" bordered={false} icon={<GlobalOutlined />}>
                        общая
                      </Tag>
                    </Tooltip>
                  )}
                  {shelf.memberCount > 0 && (
                    <Tag bordered={false}>
                      {pluralize(shelf.memberCount, ['участник', 'участника', 'участников'])}
                    </Tag>
                  )}
                  {/* Совместная полка нужна участнику там же, где своя, — но перепутать их нельзя. */}
                  {!shelf.owned && shelf.myRole && (
                    <Tag color={shelfRoleMeta[shelf.myRole].color} bordered={false}>
                      {shelfRoleMeta[shelf.myRole].label}
                    </Tag>
                  )}
                </Space>
                <Typography.Text
                  type="secondary"
                  style={{ display: 'block', fontSize: 12, marginTop: 3 }}
                  ellipsis
                >
                  {shelf.description || (!shelf.owned && shelf.ownerUsername ? `полка @${shelf.ownerUsername}` : '—')}
                </Typography.Text>
              </span>
              <Typography.Text type="secondary" style={styles.count}>
                {shelf.itemCount}
              </Typography.Text>
              <Space size={0} style={{ flexShrink: 0 }}>
                <Tooltip title="Показать состав">
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => openPreview(shelf)}
                    aria-label={`Состав полки «${shelf.name}»`}
                  />
                </Tooltip>
                <Tooltip title="Участники">
                  <Button
                    type="text"
                    icon={<TeamOutlined />}
                    onClick={() => setMembersOf(shelf)}
                    aria-label={`Участники полки «${shelf.name}»`}
                  />
                </Tooltip>
                {shelf.canCurate && (
                  <Tooltip title="Переименовать">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(shelf)}
                      aria-label={`Переименовать полку «${shelf.name}»`}
                    />
                  </Tooltip>
                )}
                {shelf.owned && (
                  <Tooltip title="Удалить">
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => confirmDeleteShelf(shelf)}
                      aria-label={`Удалить полку «${shelf.name}»`}
                    />
                  </Tooltip>
                )}
              </Space>
            </div>
          ))}
        </Card>
      )}

      <div style={styles.note}>
        Умные полки — сохранённые фильтры библиотеки — живут отдельно, в панели над списком.
        Здесь только те, что собраны руками.
      </div>
    </div>
  );

  const tagsColumn = (
    <div>
      <div style={styles.sectionHead}>
        <Typography.Text type="secondary" style={styles.sectionLabel}>
          {`Теги · ${tags.length}`}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          по числу записей
        </Typography.Text>
      </div>

      <Card style={styles.card} styles={{ body: styles.tagsBody }}>
        {tags.length === 0 ? (
          <Typography.Text type="secondary" style={{ display: 'block', padding: '8px 0' }}>
            Тегов пока нет — их проще всего завести прямо в карточке произведения: поле «Теги».
          </Typography.Text>
        ) : (
          <>
            {visibleTags.map((tag, index) => (
              <div key={tag.id} style={styles.tagRow(index === visibleTags.length - 1)}>
                {renamingTag === tag.id ? (
                  <Input
                    size="small"
                    autoFocus
                    defaultValue={tag.name}
                    maxLength={64}
                    onBlur={(event) => renameTag(tag, event.target.value)}
                    onPressEnter={(event) => renameTag(tag, (event.target as HTMLInputElement).value)}
                  />
                ) : (
                  <>
                    <Typography.Link
                      style={{ flex: 1, minWidth: 0 }}
                      ellipsis
                      onClick={() => showInLibrary(undefined, tag.id)}
                    >
                      {tag.name}
                    </Typography.Link>
                    {/* Полоса веса: доля от самого частого тега — «мусорные» видно без счётчиков. */}
                    <span aria-hidden style={styles.weight}>
                      <span style={styles.weightFill(heaviestTag ? (tag.itemCount / heaviestTag) * 100 : 0)} />
                    </span>
                    <Typography.Text type="secondary" style={{ ...styles.count, width: 34, textAlign: 'right' }}>
                      {tag.itemCount}
                    </Typography.Text>
                    <Space size={0} style={{ flexShrink: 0 }}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        aria-label={`Переименовать «${tag.name}»`}
                        onClick={() => setRenamingTag(tag.id)}
                      />
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label={`Удалить «${tag.name}»`}
                        onClick={() => confirmDeleteTag(tag)}
                      />
                    </Space>
                  </>
                )}
              </div>
            ))}
            {sortedTags.length > TAGS_SHOWN && (
              <Button type="link" onClick={() => setAllTagsShown((shown) => !shown)} style={{ paddingInline: 8 }}>
                {allTagsShown ? 'Свернуть' : `Показать все ${sortedTags.length}`}
              </Button>
            )}
          </>
        )}
      </Card>

      {suggestion && (
        <Card style={styles.cleanup} title="Уборка">
          <Typography.Paragraph style={{ marginBottom: 12 }}>
            {`Похоже, что «${suggestion.source.name}» и «${suggestion.target.name}» — одно и то же: ${
              suggestion.source.itemCount
            } и ${suggestion.target.itemCount} записей, пересечение ${suggestion.overlap}.`}
          </Typography.Paragraph>
          <Space size={8} wrap>
            <Button
              type="primary"
              icon={<MergeCellsOutlined />}
              loading={merging}
              onClick={() => confirmMerge(suggestion)}
            >
              Объединить
            </Button>
            <Button onClick={() => setDismissed((current) => [...current, suggestion.source.id])}>
              Оставить как есть
            </Button>
          </Space>
        </Card>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Полки и теги"
        subtitle={`Полка — набор, собранный руками; тег — свободная пометка в дополнение к типу · ${pluralize(
          shelves.length,
          ['полка', 'полки', 'полок']
        )}, ${publicCount} общих`}
      />

      <div style={screens.lg ? styles.columns : styles.columnsNarrow}>
        {shelvesColumn}
        {tagsColumn}
      </div>

      <Modal
        title={editing ? 'Полка' : 'Новая полка'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={handleSubmit}
        confirmLoading={saving}
        okText="Сохранить"
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
            label="Публичная"
            valuePropName="checked"
            tooltip="Публичную полку по ссылке увидит любой пользователь сервиса; приватная заметка в состав не входит"
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
                <List.Item.Meta
                  title={item.title}
                  description={item.authorNames.join(', ') || 'Автор не указан'}
                />
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
