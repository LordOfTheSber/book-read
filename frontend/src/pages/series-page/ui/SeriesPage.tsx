import React, { useEffect, useMemo } from 'react';
import { Button, Form, Input, Progress, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createSeriesThunk, deleteSeriesThunk, loadSeries, updateSeriesThunk } from '@/entities/series';
import { setFilters } from '@/features/book/set-book-filters';
import { CrudPage } from '@/shared/ui/CrudPage';
import { canEditContent, isAdminLike } from '@/shared/lib/roles';
import { pluralize } from '@/shared/lib/plural';
import { Series } from '@/shared/types/library';

interface SeriesFormValues {
  name: string;
  description?: string;
}

export const SeriesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { list, loading } = useAppSelector((state) => state.series);
  const role = useAppSelector((state) => state.auth.user?.role);

  useEffect(() => {
    // Страница справочника всегда перечитывает список: он мог пополниться из карточки книги,
    // и показывать здесь кэш — значит показывать вчерашний справочник.
    dispatch(loadSeries({ force: true }));
  }, [dispatch]);

  const showBooksOf = (series: Series) => {
    dispatch(setFilters({ seriesId: series.id, page: 0 }));
    navigate('/');
  };

  const columns = useMemo<ColumnsType<Series>>(
    () => [
      {
        title: 'Название',
        dataIndex: 'name',
        render: (name: string, series) => (
          <div>
            <Typography.Text strong>{name}</Typography.Text>
            {series.description && (
              <>
                <br />
                <Typography.Text type="secondary" ellipsis={{ tooltip: series.description }}>
                  {series.description}
                </Typography.Text>
              </>
            )}
          </div>
        )
      },
      {
        // Ради этого столбца серия и заводится: видно, сколько цикла осталось.
        title: 'Прогресс по циклу',
        dataIndex: 'completedCount',
        width: 220,
        render: (completed: number, series) =>
          series.itemCount > 0 ? (
            <Space direction="vertical" size={2} style={{ display: 'flex' }}>
              <Progress
                percent={Math.round((completed / series.itemCount) * 100)}
                size="small"
                showInfo={false}
                status={completed >= series.itemCount ? 'success' : 'normal'}
                style={{ margin: 0 }}
              />
              <Space size={10} wrap>
                <Typography.Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {`${completed} из ${series.itemCount} пройдено`}
                </Typography.Text>
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => showBooksOf(series)}>
                  Показать части
                </Button>
              </Space>
            </Space>
          ) : (
            <Typography.Text type="secondary">ничего нет</Typography.Text>
          )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <CrudPage<Series, SeriesFormValues>
      items={list}
      loading={loading}
      columns={columns}
      canEdit={canEditContent(role)}
      canDelete={isAdminLike(role)}
      searchMatch={(item, query) => item.name.toLowerCase().includes(query)}
      toFormValues={(item) => ({ name: item.name, description: item.description })}
      formInitialValues={{ name: '', description: '' }}
      onCreate={(values) => dispatch(createSeriesThunk(values)).unwrap()}
      onUpdate={(id, values) => dispatch(updateSeriesThunk({ id, payload: values })).unwrap()}
      onDelete={(id) => dispatch(deleteSeriesThunk(id)).unwrap()}
      deleteContent={(item) => `Серия «${item.name}» будет удалена. Удалить можно только серию без произведений.`}
      labels={{
        title: 'Серии',
        subtitle: `${pluralize(list.length, ['серия', 'серии', 'серий'])} в справочнике`,
        addButton: 'Добавить серию',
        createTitle: 'Новая серия',
        editTitle: 'Редактирование серии',
        deleteTitle: 'Удалить серию?',
        created: 'Серия добавлена',
        updated: 'Серия обновлена',
        deleted: 'Серия удалена',
        saveError: 'Не удалось сохранить серию',
        deleteError: 'Не удалось удалить серию',
        emptyTitle: 'Серий пока нет',
        emptyHint: 'Серия заводится сама, когда вы вписываете её название в карточку книги.',
        searchPlaceholder: 'Поиск по названию'
      }}
      formFields={
        <>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
            <Input placeholder="Например, «Воспоминания о прошлом Земли»" size="large" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="О чём цикл" />
          </Form.Item>
        </>
      }
    />
  );
};
