import React, { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  theme
} from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, GlobalOutlined, PlusOutlined, TagsOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Shelf, ShelfItem, Tag as LibraryTag } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import {
  createShelfThunk,
  deleteShelfThunk,
  fetchShelfItems,
  loadShelves,
  updateShelfThunk
} from '@/entities/shelf';
import { deleteTagThunk, loadTags, updateTagThunk } from '@/entities/tag';
import { setFilters } from '@/features/book/set-book-filters';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';

interface ShelfFormValues {
  name: string;
  description?: string;
  isPublic?: boolean;
}

/**
 * Полки и теги — два способа резать библиотеку, и живут они на одной странице: полка это набор,
 * собранный руками, тег — свободная пометка. Тип (жанр) остаётся в своём справочнике.
 */
export const ShelvesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { token } = theme.useToken();
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
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const renameTag = (tag: LibraryTag) => {
    let name = tag.name;
    modal.confirm({
      title: 'Переименовать тег',
      content: <Input defaultValue={tag.name} maxLength={64} onChange={(event) => (name = event.target.value)} />,
      okText: 'Сохранить',
      cancelText: 'Отмена',
      onOk: async () => {
        if (!name.trim() || name.trim() === tag.name) return;
        try {
          await dispatch(updateTagThunk({ id: tag.id, payload: { name: name.trim(), color: tag.color } })).unwrap();
          message.success('Тег переименован');
        } catch (error) {
          showRequestError(error, 'Не удалось переименовать тег');
        }
      }
    });
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

  /** «Показать в библиотеке» — тот же список, но с фильтром: там доступны правка и прогресс. */
  const showInLibrary = (shelfId?: string, tagId?: string) => {
    dispatch(setFilters({ shelfId, tagId, page: 0 }));
    navigate('/');
  };

  return (
    <Space direction="vertical" size={20} style={{ display: 'flex' }}>
      <PageHeader
        title="Полки и теги"
        subtitle="Полка — набор, собранный руками; тег — свободная пометка в дополнение к типу"
        actions={
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreate}>
            Новая полка
          </Button>
        }
      />

      {loading && shelves.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : shelves.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Полок пока нет — соберите первую: «подарить», «книжный клуб», «на дачу»"
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Новая полка
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {shelves.map((shelf) => (
            <Col key={shelf.id} xs={24} sm={12} xl={8}>
              <Card
                title={
                  <Space size={8}>
                    <Typography.Text strong ellipsis>
                      {shelf.name}
                    </Typography.Text>
                    {shelf.isPublic && (
                      <Tooltip title="Полку видно другим пользователям по ссылке">
                        <GlobalOutlined style={{ color: token.colorPrimary }} />
                      </Tooltip>
                    )}
                  </Space>
                }
                extra={
                  <Space size={0}>
                    <Tooltip title="Показать состав">
                      <Button type="text" icon={<EyeOutlined />} onClick={() => openPreview(shelf)} aria-label="Показать состав" />
                    </Tooltip>
                    <Tooltip title="Переименовать">
                      <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(shelf)} aria-label="Переименовать" />
                    </Tooltip>
                    <Tooltip title="Удалить">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => confirmDeleteShelf(shelf)}
                        aria-label="Удалить"
                      />
                    </Tooltip>
                  </Space>
                }
              >
                <Space direction="vertical" size={8} style={{ display: 'flex' }}>
                  <Typography.Text type="secondary">
                    {pluralize(shelf.itemCount, ['запись', 'записи', 'записей'])}
                  </Typography.Text>
                  {shelf.description && (
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                      {shelf.description}
                    </Typography.Paragraph>
                  )}
                  <Button type="link" style={{ paddingInline: 0 }} onClick={() => showInLibrary(shelf.id, undefined)}>
                    Показать в библиотеке
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Card
        title={
          <Space size={8}>
            <TagsOutlined />
            <span>Теги</span>
          </Space>
        }
      >
        {tags.length === 0 ? (
          <Typography.Text type="secondary">
            Тегов пока нет — их проще всего завести прямо в карточке произведения.
          </Typography.Text>
        ) : (
          <Space size={[8, 8]} wrap>
            {tags.map((tag) => (
              <Tag
                key={tag.id}
                color={tag.color ?? undefined}
                closable
                onClose={(event) => {
                  event.preventDefault();
                  confirmDeleteTag(tag);
                }}
                onDoubleClick={() => renameTag(tag)}
                style={{ borderRadius: 999, paddingInline: 12, paddingBlock: 4, cursor: 'pointer' }}
              >
                <span onClick={() => showInLibrary(undefined, tag.id)}>{`${tag.name} · ${tag.itemCount}`}</span>
              </Tag>
            ))}
          </Space>
        )}
      </Card>

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
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="На полке пока пусто" /> }}
            renderItem={(item) => (
              <List.Item>
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
    </Space>
  );
};
