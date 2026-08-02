import React, { useEffect, useMemo } from 'react';
import { Form, Input, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createBookTypeThunk, deleteBookTypeThunk, loadBookTypes, updateBookTypeThunk } from '@/entities/book-type';
import { CrudPage } from '@/shared/ui/CrudPage';
import { canEditContent, isAdminLike } from '@/shared/lib/roles';
import { formatDateTime } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/plural';
import { BookType } from '@/shared/types/library';

interface BookTypeFormValues {
  name: string;
}

export const TypesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading } = useAppSelector((state) => state.bookTypes);
  const role = useAppSelector((state) => state.auth.user?.role);

  useEffect(() => {
    dispatch(loadBookTypes());
  }, [dispatch]);

  const columns = useMemo<ColumnsType<BookType>>(
    () => [
      {
        title: 'Название',
        dataIndex: 'name',
        render: (name: string) => <Typography.Text strong>{name}</Typography.Text>
      },
      {
        title: 'Обновлён',
        dataIndex: 'updatedAt',
        width: 190,
        responsive: ['md'],
        render: (value?: string) => <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>
      }
    ],
    []
  );

  return (
    <CrudPage<BookType, BookTypeFormValues>
      items={list}
      loading={loading}
      columns={columns}
      canEdit={canEditContent(role)}
      canDelete={isAdminLike(role)}
      searchMatch={(item, query) => item.name.toLowerCase().includes(query)}
      toFormValues={(item) => ({ name: item.name })}
      formInitialValues={{ name: '' }}
      onCreate={(values) => dispatch(createBookTypeThunk(values)).unwrap()}
      onUpdate={(id, values) => dispatch(updateBookTypeThunk({ id, payload: values })).unwrap()}
      onDelete={(id) => dispatch(deleteBookTypeThunk(id)).unwrap()}
      deleteContent={(item) => `Тип «${item.name}» будет удалён. Книги с этим типом останутся без него.`}
      labels={{
        title: 'Типы книг',
        subtitle: `${pluralize(list.length, ['тип', 'типа', 'типов'])} в справочнике`,
        addButton: 'Добавить тип',
        createTitle: 'Новый тип',
        editTitle: 'Редактирование типа',
        deleteTitle: 'Удалить тип?',
        created: 'Тип добавлен',
        updated: 'Тип обновлён',
        deleted: 'Тип удалён',
        saveError: 'Не удалось сохранить тип',
        deleteError: 'Не удалось удалить тип',
        emptyTitle: 'Типов пока нет',
        emptyHint: 'Типы помогают группировать книги: роман, манга, нон-фикшн.',
        searchPlaceholder: 'Поиск по названию'
      }}
      formFields={
        <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
          <Input placeholder="Например, «Нон-фикшн»" size="large" />
        </Form.Item>
      }
    />
  );
};
