import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Space, Table, message } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { createBookTypeThunk, deleteBookTypeThunk, loadBookTypes, updateBookTypeThunk } from '@/entities/book-type';

export const TypesManagerWidget: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading } = useAppSelector((state) => state.bookTypes);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
      message.success('Updated');
    } else {
      await dispatch(createBookTypeThunk(values));
      message.success('Created');
    }
    setOpen(false);
    dispatch(loadBookTypes());
  };

  const confirmDelete = (id: string) => {
    Modal.confirm({
      title: 'Delete type?',
      onOk: async () => {
        await dispatch(deleteBookTypeThunk(id));
        message.success('Deleted');
        dispatch(loadBookTypes());
      }
    });
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>
          Add type
        </Button>
      </Space>
      <Table
        rowKey={(row) => row.id}
        dataSource={list}
        loading={loading}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          {
            title: 'Actions',
            render: (_, record) => (
              <Space>
                <Button size="small" onClick={() => openModal(record.id)}>
                  Edit
                </Button>
                <Button size="small" danger onClick={() => confirmDelete(record.id)}>
                  Delete
                </Button>
              </Space>
            )
          }
        ]}
      />

      <Modal open={open} onCancel={() => setOpen(false)} onOk={handleSave} title={editingId ? 'Edit type' : 'Add type'}>
        <Form layout="vertical" form={form}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}> 
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
