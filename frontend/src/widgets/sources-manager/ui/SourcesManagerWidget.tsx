import React, { useEffect, useState, useMemo } from 'react';
import { Button, Form, Input, Modal, Space, Table, Tooltip, message, Flex } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createSourceThunk, deleteSourceThunk, loadSources, updateSourceThunk } from '@/entities/source';
import { useSourcesManagerWidgetStyles } from './SourcesManagerWidget.styles';
import { AxiosError } from 'axios';

export const SourcesManagerWidget: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading } = useAppSelector((state) => state.sources);
  const role = useAppSelector((state) => state.auth.user?.role);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const styles = useSourcesManagerWidgetStyles();
  const canEdit = role === 'ADMIN' || role === 'EDITOR';
  const canDelete = role === 'ADMIN';

  const renderDash = (value?: string | null) => (value ? value : '—');

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
        await dispatch(updateSourceThunk({ id: editingId, payload: values })).unwrap();
        message.success('Источник обновлён');
      } else {
        await dispatch(createSourceThunk(values)).unwrap();
        message.success('Источник добавлен');
      }
      setOpen(false);
      dispatch(loadSources());
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить источник');
    }
  };

  const confirmDelete = (id: string) => {
    Modal.confirm({
      title: 'Удалить источник?',
      okText: 'Удалить',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await dispatch(deleteSourceThunk(id)).unwrap();
          message.success('Источник удалён');
          dispatch(loadSources());
        } catch (error) {
          showRequestError(error, 'Не удалось удалить источник');
        }
      }
    });
  };

  const columns = useMemo(
    () => [
      { title: 'Название', dataIndex: 'name', render: renderDash },
      {
        title: 'Ссылка',
        dataIndex: 'url',
        render: (url: string) =>
          url ? (
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          ) : (
            renderDash()
          )
      },
      { title: 'Описание', dataIndex: 'description', ellipsis: true, render: renderDash },
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
            Добавить источник
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
        title={editingId ? 'Редактирование источника' : 'Добавление источника'}
        destroyOnClose
      >
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
