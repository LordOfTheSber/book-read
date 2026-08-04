import React, { useEffect, useMemo } from 'react';
import { Button, Form, Input, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createAuthorThunk, deleteAuthorThunk, loadAuthors, updateAuthorThunk } from '@/entities/author';
import { setFilters } from '@/features/book/set-book-filters';
import { CrudPage } from '@/shared/ui/CrudPage';
import { canEditContent, isAdminLike } from '@/shared/lib/roles';
import { pluralize } from '@/shared/lib/plural';
import { Author } from '@/shared/types/library';

interface AuthorFormValues {
  name: string;
  altName?: string;
}

export const AuthorsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { list, loading } = useAppSelector((state) => state.authors);
  const role = useAppSelector((state) => state.auth.user?.role);

  useEffect(() => {
    dispatch(loadAuthors());
  }, [dispatch]);

  /** Клик по счётчику ведёт в библиотеку, уже отфильтрованную по этому автору. */
  const showBooksOf = (author: Author) => {
    dispatch(setFilters({ authorId: author.id, page: 0 }));
    navigate('/');
  };

  const columns = useMemo<ColumnsType<Author>>(
    () => [
      {
        title: 'Имя',
        dataIndex: 'name',
        render: (name: string, author) => (
          <div>
            <Typography.Text strong>{name}</Typography.Text>
            {author.altName && (
              <>
                <br />
                <Typography.Text type="secondary">{author.altName}</Typography.Text>
              </>
            )}
          </div>
        )
      },
      {
        title: 'В библиотеке',
        dataIndex: 'itemCount',
        width: 190,
        render: (count: number, author) =>
          count > 0 ? (
            <Button type="link" style={{ padding: 0 }} onClick={() => showBooksOf(author)}>
              {pluralize(count, ['произведение', 'произведения', 'произведений'])}
            </Button>
          ) : (
            <Typography.Text type="secondary">ничего нет</Typography.Text>
          )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <CrudPage<Author, AuthorFormValues>
      items={list}
      loading={loading}
      columns={columns}
      canEdit={canEditContent(role)}
      canDelete={isAdminLike(role)}
      searchMatch={(item, query) =>
        item.name.toLowerCase().includes(query) || Boolean(item.altName?.toLowerCase().includes(query))
      }
      toFormValues={(item) => ({ name: item.name, altName: item.altName })}
      formInitialValues={{ name: '', altName: '' }}
      onCreate={(values) => dispatch(createAuthorThunk(values)).unwrap()}
      onUpdate={(id, values) => dispatch(updateAuthorThunk({ id, payload: values })).unwrap()}
      onDelete={(id) => dispatch(deleteAuthorThunk(id)).unwrap()}
      deleteContent={(item) => `Автор «${item.name}» будет удалён. Удалить можно только автора без произведений.`}
      labels={{
        title: 'Авторы',
        subtitle: `${pluralize(list.length, ['автор', 'автора', 'авторов'])} в справочнике`,
        addButton: 'Добавить автора',
        createTitle: 'Новый автор',
        editTitle: 'Редактирование автора',
        deleteTitle: 'Удалить автора?',
        created: 'Автор добавлен',
        updated: 'Автор обновлён',
        deleted: 'Автор удалён',
        saveError: 'Не удалось сохранить автора',
        deleteError: 'Не удалось удалить автора',
        emptyTitle: 'Авторов пока нет',
        emptyHint: 'Автор заводится сам, когда вы вписываете имя в карточку книги.',
        searchPlaceholder: 'Поиск по имени'
      }}
      formFields={
        <>
          <Form.Item name="name" label="Имя" rules={[{ required: true, message: 'Имя обязательно' }]}>
            <Input placeholder="Например, «Лю Цысинь»" size="large" />
          </Form.Item>
          <Form.Item name="altName" label="Имя в оригинале" tooltip="Например, латиницей: Liu Cixin">
            <Input placeholder="Liu Cixin" />
          </Form.Item>
        </>
      }
    />
  );
};
