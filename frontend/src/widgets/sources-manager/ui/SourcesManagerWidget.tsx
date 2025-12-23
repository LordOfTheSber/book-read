import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Space, Table, message } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createSourceThunk, deleteSourceThunk, loadSources, updateSourceThunk } from '@/entities/source';
import { useSourcesManagerWidgetStyles } from './SourcesManagerWidget.styles';

export const SourcesManagerWidget: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading } = useAppSelector((state) => state.sources);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const styles = useSourcesManagerWidgetStyles();

  useEffect(() => {
    dispatch(loadSources());
  }, [dispatch]);

  const openModal = (id?: string) => {
    if (id) {
      const source = list.find((s) => s.id === id);
      form.setFieldsValue({ name: source?.name, url: source?.url, description: source?.description });
      setEditingId(id);
    } else {
      form.resetFields();
      setEditingId(null);
    }
    setOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editingId) {
      await dispatch(updateSourceThunk({ id: editingId, payload: values }));
      message.success('Источник обновлён');
    } else {
      await dispatch(createSourceThunk(values));
      message.success('Источник добавлен');
    }
    setOpen(false);
    dispatch(loadSources());
  };

  const confirmDelete = (id: string) => {
    Modal.confirm({
      title: 'Удалить источник?',
      okText: 'Удалить',
      cancelText: 'Отмена',
      onOk: async () => {
        await dispatch(deleteSourceThunk(id));
        message.success('Источник удалён');
        dispatch(loadSources());
      }
    });
  };

  return (
    <>
      <Space style={styles.toolbar}>
        <Button type="primary" onClick={() => openModal()}>
          Добавить источник
        </Button>
      </Space>
      <Table
        rowKey={(row) => row.id}
        dataSource={list}
        loading={loading}
        pagination={false}
        style={styles.table}
        columns={[
          { title: 'Название', dataIndex: 'name' },
          {
            title: 'Ссылка',
            dataIndex: 'url',
            render: (url: string) => (
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
            )
          },
          { title: 'Описание', dataIndex: 'description' },
          {
            title: 'Действия',
            render: (_, record) => (
              <Space size="small">
                <Button size="small" onClick={() => openModal(record.id)}>
                  Редактировать
                </Button>
                <Button size="small" danger onClick={() => confirmDelete(record.id)}>
                  Удалить
                </Button>
              </Space>
            )
          }
        ]}
      />

      <Modal open={open} onCancel={() => setOpen(false)} onOk={handleSave} okText="Сохранить" cancelText="Отмена" title={editingId ? 'Редактирование источника' : 'Добавление источника'}>
        <Form layout="vertical" form={form} initialValues={{ name: '', url: '', description: '' }} style={styles.modal}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
            <Input placeholder="Введите название источника" />
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
        </Form>
      </Modal>
    </>
  );
};
