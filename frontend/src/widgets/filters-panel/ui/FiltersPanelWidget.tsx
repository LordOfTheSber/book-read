import React, { useEffect } from 'react';
import { Button, Col, Form, Input, InputNumber, Row, Select, Switch } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { statusOptions } from '@/shared/constants/status';
import { setFilters } from '@/features/book/set-book-filters';
import { loadBooks } from '@/entities/book';
import { loadBookTypes } from '@/entities/book-type';

export const FiltersPanelWidget: React.FC = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.bookFilters);
  const bookTypes = useAppSelector((state) => state.bookTypes.list);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(loadBookTypes());
  }, [dispatch]);

  useEffect(() => {
    dispatch(loadBooks(filters));
  }, [dispatch, filters]);

  const onFinish = (values: any) => {
    dispatch(setFilters({ ...filters, ...values, page: 0 }));
  };

  return (
    <Form layout="vertical" form={form} initialValues={filters} onFinish={onFinish}>
      <Row gutter={16}>
        <Col span={6}>
          <Form.Item name="q" label="Search">
            <Input placeholder="Title or alt title" allowClear />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item name="typeId" label="Type">
            <Select allowClear options={bookTypes.map((t) => ({ label: t.name, value: t.id }))} />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item name="status" label="Status">
            <Select allowClear options={statusOptions.map((s) => ({ label: s.label, value: s.value }))} />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item name="favorite" label="Favorite" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={3}>
          <Form.Item name="minRating" label="Min rating">
            <InputNumber min={0} max={10} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={3}>
          <Form.Item name="maxRating" label="Max rating">
            <InputNumber min={0} max={10} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={4}>
          <Form.Item name="sort" label="Sort by">
            <Select
              options={[
                { label: 'Updated desc', value: 'updatedAt,desc' },
                { label: 'Updated asc', value: 'updatedAt,asc' },
                { label: 'Title asc', value: 'title,asc' },
                { label: 'Title desc', value: 'title,desc' },
                { label: 'Rating desc', value: 'rating,desc' },
                { label: 'Rating asc', value: 'rating,asc' }
              ]}
            />
          </Form.Item>
        </Col>
      </Row>
      <Button type="primary" htmlType="submit">
        Apply
      </Button>
    </Form>
  );
};
