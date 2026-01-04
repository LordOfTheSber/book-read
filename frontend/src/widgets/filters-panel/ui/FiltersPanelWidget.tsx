import React, { useEffect } from 'react';
import { Button, Form, InputNumber, Select, Switch, Flex } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { statusOptions } from '@/shared/constants/status';
import { setFilters } from '@/features/book/set-book-filters';
import { loadBooks } from '@/entities/book';
import { loadBookTypes } from '@/entities/book-type';
import { loadUsers } from '@/entities/user';
import { useFiltersPanelStyles } from './FiltersPanelWidget.styles';
import { isAdminLike } from '@/shared/lib/roles';

export const FiltersPanelWidget: React.FC = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.bookFilters);
  const bookTypes = useAppSelector((state) => state.bookTypes.list);
  const users = useAppSelector((state) => state.users.list);
  const usersLoaded = useAppSelector((state) => state.users.loaded);
  const usersLoading = useAppSelector((state) => state.users.loading);
  const role = useAppSelector((state) => state.auth.user?.role);
  const [form] = Form.useForm();
  const styles = useFiltersPanelStyles();
  const isAdmin = isAdminLike(role);

  useEffect(() => {
    dispatch(loadBookTypes());
  }, [dispatch]);

  useEffect(() => {
    if (isAdmin && !usersLoaded && !usersLoading) {
      dispatch(loadUsers());
    }
  }, [dispatch, isAdmin, usersLoaded, usersLoading]);

  useEffect(() => {
    dispatch(loadBooks(filters));
  }, [dispatch, filters]);

  const onFinish = (values: any) => {
    dispatch(setFilters({ ...filters, ...values, page: 0 }));
  };

  return (
    <Form layout="vertical" form={form} initialValues={filters} onFinish={onFinish}>
      <Flex gap={styles.formGap} vertical>
        <Flex gap={24} wrap>
          <Form.Item name="typeId" label="Тип" style={styles.field(180)}>
            <Select
              placeholder="Все типы"
              allowClear
              options={bookTypes.map((t) => ({ label: t.name, value: t.id }))}
            />
          </Form.Item>
          <Form.Item name="status" label="Статус" style={styles.field(180)}>
            <Select placeholder="Любой" allowClear options={statusOptions.map((s) => ({ label: s.label, value: s.value }))} />
          </Form.Item>
          <Form.Item name="favorite" label="Избранное" valuePropName="checked" style={styles.narrowField}>
            <Switch />
          </Form.Item>
          <Form.Item name="minRating" label="Минимальная оценка" style={styles.field(160)}>
            <InputNumber min={0} max={10} step={0.5} style={styles.numberInput} />
          </Form.Item>
          <Form.Item name="maxRating" label="Максимальная оценка" style={styles.field(160)}>
            <InputNumber min={0} max={10} step={0.5} style={styles.numberInput} />
          </Form.Item>
          <Form.Item name="sort" label="Сортировка" style={styles.field(200)}>
            <Select
              placeholder="Выберите порядок"
              options={[
                { label: 'Обновлено ↓', value: 'updatedAt,desc' },
                { label: 'Обновлено ↑', value: 'updatedAt,asc' },
                { label: 'Название ↑', value: 'title,asc' },
                { label: 'Название ↓', value: 'title,desc' },
                { label: 'Оценка ↓', value: 'rating,desc' },
                { label: 'Оценка ↑', value: 'rating,asc' }
              ]}
            />
          </Form.Item>
          {isAdmin && (
            <Form.Item name="userId" label="Пользователь" style={styles.field(220)}>
              <Select
                allowClear
                placeholder="Все пользователи"
                loading={usersLoading}
                options={users.map((u) => ({ label: u.username, value: u.id }))}
              />
            </Form.Item>
          )}
        </Flex>
        <Flex justify="flex-start" style={styles.actions}>
          <Button type="primary" htmlType="submit" block style={styles.button}>
            Применить фильтры
          </Button>
        </Flex>
      </Flex>
    </Form>
  );
};
