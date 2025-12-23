import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Space, Table, Tooltip, message, Flex } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createBookTypeThunk, deleteBookTypeThunk, loadBookTypes, updateBookTypeThunk } from '@/entities/book-type';
import { useTypesManagerWidgetStyles } from './TypesManagerWidget.styles';

export const TypesManagerWidget: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading } = useAppSelector((state) => state.bookTypes);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const styles = useTypesManagerWidgetStyles();

  const renderDash = (value?: string | null) => (value ? value : '—');

  useEffect(() => {
    dispatch(loadBookTypes());
  }, [dispatch]);

  const openModal = (id?: string) => {
    if (id) {
      const type = list.find((t) => t.id === id);
      form.setFieldsValue({ name: type?.name });
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
      await dispatch(updateBookTypeThunk({ id: editingId, payload: values }));
      message.success('Тип обновлён');
    } else {
      await dispatch(createBookTypeThunk(values));
      message.success('Тип добавлен');
    }
    setOpen(false);
    dispatch(loadBookTypes());
  };

  const confirmDelete = (id: string) => {
    Modal.confirm({
      title: 'Удалить тип?',
      okText: 'Удалить',
      cancelText: 'Отмена',
      onOk: async () => {
        await dispatch(deleteBookTypeThunk(id));
        message.success('Тип удалён');
        dispatch(loadBookTypes());
      }
    });
  };

  return (
    <>
      <Flex style={styles.toolbar} align="center" justify="space-between">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Добавить тип
        </Button>
      </Flex>
      <Table
        rowKey={(row) => row.id}
        dataSource={list}
        loading={loading}
        pagination={false}
        style={styles.table}
        onHeaderRow={() => ({ style: styles.headerRow })}
        columns={[
          { title: 'Название', dataIndex: 'name', render: renderDash },
          {
            title: 'Действия',
            render: (_, record) => (
              <Space size="small">
                <Tooltip title="Редактировать">
                  <Button
                    size="small"
                    type="text"
                    shape="circle"
                    icon={<EditOutlined />}
                    onClick={() => openModal(record.id)}
                    aria-label="Редактировать"
                  />
                </Tooltip>
                <Tooltip title="Удалить">
                  <Button
                    size="small"
                    danger
                    type="text"
                    shape="circle"
                    icon={<DeleteOutlined />}
                    onClick={() => confirmDelete(record.id)}
                    aria-label="Удалить"
                  />
                </Tooltip>
              </Space>
            )
          }
        ]}
      />

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        okText="Сохранить"
        cancelText="Отмена"
        title={editingId ? 'Редактирование типа' : 'Добавление типа'}
        destroyOnClose
      >
        <Form layout="vertical" form={form} initialValues={{ name: '' }} style={styles.modal}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
            <Input placeholder="Введите название типа" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
