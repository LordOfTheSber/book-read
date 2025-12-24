import React, { useEffect, useState, useMemo } from 'react';
import { Button, Form, Input, Modal, Space, Table, Tooltip, message, Flex } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createBookTypeThunk, deleteBookTypeThunk, loadBookTypes, updateBookTypeThunk } from '@/entities/book-type';
import { useTypesManagerWidgetStyles } from './TypesManagerWidget.styles';
import { AxiosError } from 'axios';

export const TypesManagerWidget: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading } = useAppSelector((state) => state.bookTypes);
  const role = useAppSelector((state) => state.auth.user?.role);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const styles = useTypesManagerWidgetStyles();
  const canEdit = role === 'ADMIN' || role === 'EDITOR';
  const canDelete = role === 'ADMIN';

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

  const showRequestError = (error: unknown, fallback: string) => {
    const axiosError = error as AxiosError<{ message?: string }>;
    if (axiosError.response?.status === 403) {
      message.error('Нет прав для выполнения действия');
      return;
    }
    message.error(axiosError.response?.data?.message || fallback);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editingId) {
        await dispatch(updateBookTypeThunk({ id: editingId, payload: values })).unwrap();
        message.success('Тип обновлён');
      } else {
        await dispatch(createBookTypeThunk(values)).unwrap();
        message.success('Тип добавлен');
      }
      setOpen(false);
      dispatch(loadBookTypes());
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить тип');
    }
  };

  const confirmDelete = (id: string) => {
    Modal.confirm({
      title: 'Удалить тип?',
      okText: 'Удалить',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await dispatch(deleteBookTypeThunk(id)).unwrap();
          message.success('Тип удалён');
          dispatch(loadBookTypes());
        } catch (error) {
          showRequestError(error, 'Не удалось удалить тип');
        }
      }
    });
  };

  const columns = useMemo(
    () => [
      { title: 'Название', dataIndex: 'name', render: renderDash },
      ...(canEdit || canDelete
        ? [
            {
              title: 'Действия',
              render: (_: unknown, record: { id: string }) => (
                <Space size="small">
                  {canEdit && (
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
                  )}
                  {canDelete && (
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
                  )}
                </Space>
              )
            }
          ]
        : [])
    ],
    [canDelete, canEdit]
  );

  return (
    <>
      <Flex style={styles.toolbar} align="center" justify="space-between">
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Добавить тип
          </Button>
        )}
      </Flex>
      <Table
        rowKey={(row) => row.id}
        dataSource={list}
        loading={loading}
        pagination={false}
        style={styles.table}
        onHeaderRow={() => ({ style: styles.headerRow })}
        columns={columns}
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
