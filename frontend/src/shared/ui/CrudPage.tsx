import React, { useMemo, useState } from 'react';
import { App, Button, Empty, Form, Input, Modal, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useRequestError } from '@/shared/lib/errors';
import { PageHeader } from './PageHeader';

export interface CrudPageLabels {
  /** Заголовок страницы, например «Типы книг». */
  title: string;
  subtitle?: React.ReactNode;
  /** Подпись кнопки создания, например «Добавить тип». */
  addButton: string;
  createTitle: string;
  editTitle: string;
  deleteTitle: string;
  created: string;
  updated: string;
  deleted: string;
  saveError: string;
  deleteError: string;
  emptyTitle: string;
  emptyHint?: string;
  searchPlaceholder?: string;
}

interface Props<T extends { id: string }, V> {
  items: T[];
  loading?: boolean;
  columns: ColumnsType<T>;
  canEdit: boolean;
  canDelete: boolean;
  labels: CrudPageLabels;
  /** Поля формы в модальном окне — общие для создания и редактирования. */
  formFields: React.ReactNode;
  formInitialValues?: Partial<V>;
  toFormValues: (item: T) => Partial<V>;
  onCreate: (values: V) => Promise<unknown>;
  onUpdate: (id: string, values: V) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  /** Локальный поиск по загруженному списку; без него поле поиска не рендерится. */
  searchMatch?: (item: T, query: string) => boolean;
  /** Текст подтверждения удаления — обычно с названием записи. */
  deleteContent?: (item: T) => React.ReactNode;
}

/**
 * Шаблон страницы-справочника: заголовок, поиск, таблица и модальная форма.
 * Типы и Источники устроены одинаково и различаются только колонками,
 * полями формы и подписями.
 */
export function CrudPage<T extends { id: string }, V = Record<string, unknown>>({
  items,
  loading,
  columns,
  canEdit,
  canDelete,
  labels,
  formFields,
  formInitialValues,
  toFormValues,
  onCreate,
  onUpdate,
  onDelete,
  searchMatch,
  deleteContent
}: Props<T, V>) {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const [form] = Form.useForm<V>();
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || !searchMatch) return items;
    return items.filter((item) => searchMatch(item, trimmed));
  }, [items, query, searchMatch]);

  const openModal = (item?: T) => {
    setEditing(item ?? null);
    setOpen(true);
  };

  const handleSave = async () => {
    // Modal результат onOk не ждёт, поэтому отказ валидации всплывал бы необработанным:
    // ошибки под полями пользователь видит, а в консоли оставался unhandled rejection.
    const values = await form.validateFields().catch(() => undefined);
    if (!values) {
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await onUpdate(editing.id, values);
        message.success(labels.updated);
      } else {
        await onCreate(values);
        message.success(labels.created);
      }
      setOpen(false);
    } catch (error) {
      showRequestError(error, labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: T) => {
    modal.confirm({
      title: labels.deleteTitle,
      content: deleteContent?.(item),
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await onDelete(item.id);
          message.success(labels.deleted);
        } catch (error) {
          showRequestError(error, labels.deleteError);
        }
      }
    });
  };

  const tableColumns: ColumnsType<T> = useMemo(() => {
    if (!canEdit && !canDelete) return columns;

    return [
      ...columns,
      {
        title: '',
        key: 'actions',
        width: 96,
        align: 'right',
        render: (_: unknown, item: T) => (
          <Space size={2}>
            {canEdit && (
              <Tooltip title="Редактировать">
                <Button
                  type="text"
                  shape="circle"
                  icon={<EditOutlined />}
                  onClick={() => openModal(item)}
                  aria-label="Редактировать"
                />
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Удалить">
                <Button
                  type="text"
                  danger
                  shape="circle"
                  icon={<DeleteOutlined />}
                  onClick={() => confirmDelete(item)}
                  aria-label="Удалить"
                />
              </Tooltip>
            )}
          </Space>
        )
      }
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, canEdit, canDelete]);

  const isFiltered = Boolean(query.trim());

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>
      <PageHeader
        title={labels.title}
        subtitle={labels.subtitle}
        actions={
          canEdit && (
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openModal()}>
              {labels.addButton}
            </Button>
          )
        }
      />

      {searchMatch && items.length > 0 && (
        <div
          style={{
            padding: 12,
            marginBottom: 20,
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG
          }}
        >
          <Input
            allowClear
            size="large"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            placeholder={labels.searchPlaceholder ?? 'Поиск'}
          />
        </div>
      )}

      <Table
        rowKey={(row) => row.id}
        dataSource={visible}
        loading={loading}
        columns={tableColumns}
        pagination={false}
        size="middle"
        // max-content, а не фикс: на узком экране колонки скрываются через
        // responsive, и таблица должна укладываться без горизонтального скролла.
        scroll={{ x: 'max-content' }}
        style={{
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden'
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text strong>{isFiltered ? 'Ничего не найдено' : labels.emptyTitle}</Typography.Text>
                  {!isFiltered && labels.emptyHint && (
                    <Typography.Text type="secondary">{labels.emptyHint}</Typography.Text>
                  )}
                </Space>
              }
            >
              {!isFiltered && canEdit && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                  {labels.addButton}
                </Button>
              )}
            </Empty>
          )
        }}
      />

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
        title={editing ? labels.editTitle : labels.createTitle}
        destroyOnHidden
      >
        {/* destroyOnHidden пересоздаёт форму на каждое открытие, поэтому
            начальные значения подставляются без ручного setFieldsValue. */}
        <Form
          layout="vertical"
          form={form}
          initialValues={editing ? toFormValues(editing) : formInitialValues}
          style={{ paddingTop: 8 }}
        >
          {formFields}
        </Form>
      </Modal>
    </div>
  );
}
