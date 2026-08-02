import React, { useEffect } from 'react';
import { Button, Col, Drawer, Form, Grid, Input, Rate, Row, Select, Switch, message } from 'antd';
import { AxiosError } from 'axios';
import { LibraryItem } from '@/shared/types/library';
import { statusOptions } from '@/shared/constants/status';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createBookThunk, updateBookThunk } from '@/entities/book';

interface Props {
  open: boolean;
  /** null — создание новой книги. */
  editing: LibraryItem | null;
  onClose: () => void;
}

export const BookFormDrawer: React.FC<Props> = ({ open, editing, onClose }) => {
  const dispatch = useAppDispatch();
  const types = useAppSelector((state) => state.bookTypes.list);
  const sources = useAppSelector((state) => state.sources.list);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();
  const [saving, setSaving] = React.useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({ ...editing, typeId: editing.typeId, sourceId: editing.sourceId });
    } else {
      form.resetFields();
    }
  }, [open, editing, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await dispatch(updateBookThunk({ id: editing.id, payload: values })).unwrap();
        message.success('Данные обновлены');
      } else {
        await dispatch(createBookThunk(values)).unwrap();
        message.success('Книга добавлена');
      }
      onClose();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      message.error(
        axiosError.response?.status === 403
          ? 'Нет прав для выполнения действия'
          : axiosError.response?.data?.message || 'Не удалось сохранить книгу'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={editing ? 'Редактирование книги' : 'Новая книга'}
      open={open}
      onClose={onClose}
      destroyOnHidden
      width={isMobile ? '100%' : 640}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '12px 24px' }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="primary" loading={saving} onClick={handleSubmit}>
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      }
    >
      <Form layout="vertical" form={form} initialValues={{ status: 'PLANNED', favorite: false }}>
        <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
          <Input placeholder="Например, «Задача трёх тел»" size="large" />
        </Form.Item>
        <Form.Item name="altTitle" label="Альтернативное название">
          <Input placeholder="Оригинальное название или перевод" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="typeId" label="Тип">
              <Select allowClear placeholder="Не указан" options={types.map((t) => ({ label: t.name, value: t.id }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="sourceId" label="Источник">
              <Select allowClear placeholder="Не указан" options={sources.map((s) => ({ label: s.name, value: s.id }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="status" label="Статус" rules={[{ required: true }]}>
              <Select options={statusOptions.map((s) => ({ label: s.label, value: s.value }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="favorite" label="Избранное" valuePropName="checked">
              <Switch checkedChildren="Да" unCheckedChildren="Нет" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="rating" label="Оценка" tooltip="Полшага доступны — 7.5 тоже валидная оценка">
          <Rate allowClear allowHalf count={10} style={{ fontSize: 20 }} />
        </Form.Item>
        <Form.Item name="comment" label="Комментарий">
          <Input.TextArea rows={4} placeholder="Заметки, впечатления, на чём остановились" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};
