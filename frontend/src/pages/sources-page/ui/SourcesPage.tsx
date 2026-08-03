import React, { useEffect, useMemo } from 'react';
import { Form, Input, Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createSourceThunk, deleteSourceThunk, loadSources, updateSourceThunk } from '@/entities/source';
import { CrudPage } from '@/shared/ui/CrudPage';
import { canEditContent, isAdminLike } from '@/shared/lib/roles';
import { formatDateTime } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/plural';
import { Source } from '@/shared/types/library';

interface SourceFormValues {
  name: string;
  url: string;
  description?: string;
}

export const SourcesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading } = useAppSelector((state) => state.sources);
  const role = useAppSelector((state) => state.auth.user?.role);

  useEffect(() => {
    dispatch(loadSources());
  }, [dispatch]);

  const columns = useMemo<ColumnsType<Source>>(
    () => [
      {
        title: 'Название',
        dataIndex: 'name',
        width: '28%',
        render: (name: string) => <Typography.Text strong>{name}</Typography.Text>
      },
      {
        title: 'Ссылка',
        dataIndex: 'url',
        width: '26%',
        responsive: ['sm'],
        render: (url?: string) =>
          url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span
                style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {url.replace(/^https?:\/\//, '')}
              </span>
              <LinkOutlined />
            </a>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          )
      },
      {
        title: 'Описание',
        dataIndex: 'description',
        ellipsis: true,
        responsive: ['lg'],
        render: (description?: string) =>
          description || <Typography.Text type="secondary">—</Typography.Text>
      },
      {
        title: 'Обновлён',
        dataIndex: 'updatedAt',
        width: 190,
        responsive: ['xl'],
        render: (value?: string) => <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>
      }
    ],
    []
  );

  return (
    <CrudPage<Source, SourceFormValues>
      items={list}
      loading={loading}
      columns={columns}
      canEdit={canEditContent(role)}
      canDelete={isAdminLike(role)}
      searchMatch={(item, query) =>
        item.name.toLowerCase().includes(query) ||
        (item.url ?? '').toLowerCase().includes(query) ||
        (item.description ?? '').toLowerCase().includes(query)
      }
      toFormValues={(item) => ({ name: item.name, url: item.url, description: item.description })}
      formInitialValues={{ name: '', url: '', description: '' }}
      onCreate={(values) => dispatch(createSourceThunk(values)).unwrap()}
      onUpdate={(id, values) => dispatch(updateSourceThunk({ id, payload: values })).unwrap()}
      onDelete={(id) => dispatch(deleteSourceThunk(id)).unwrap()}
      deleteContent={(item) => `Источник «${item.name}» будет удалён. Книги с этим источником останутся без него.`}
      labels={{
        title: 'Источники',
        subtitle: `${pluralize(list.length, ['источник', 'источника', 'источников'])} в справочнике`,
        addButton: 'Добавить источник',
        createTitle: 'Новый источник',
        editTitle: 'Редактирование источника',
        deleteTitle: 'Удалить источник?',
        created: 'Источник добавлен',
        updated: 'Источник обновлён',
        deleted: 'Источник удалён',
        saveError: 'Не удалось сохранить источник',
        deleteError: 'Не удалось удалить источник',
        emptyTitle: 'Источников пока нет',
        emptyHint: 'Источник — это откуда вы читаете: магазин, библиотека, полка дома.',
        searchPlaceholder: 'Поиск по названию или ссылке'
      }}
      formFields={
        <>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
            <Input placeholder="Например, «Литрес»" size="large" />
          </Form.Item>
          <Form.Item
            name="url"
            label="Ссылка"
            rules={[
              { required: true, message: 'Ссылка обязательна' },
              { type: 'url', message: 'Введите корректную ссылку' }
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Дополнительные детали об источнике" />
          </Form.Item>
        </>
      }
    />
  );
};
