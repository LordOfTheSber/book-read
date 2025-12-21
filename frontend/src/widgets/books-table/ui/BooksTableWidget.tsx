import React, { useMemo, useState } from 'react';
import { Button, Modal, Space, Table, Tag, message, Form, Input, InputNumber, Select, Switch } from 'antd';
import { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { LibraryItem } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { deleteBookThunk, loadBooks, updateBookThunk, createBookThunk } from '@/entities/book';
import { statusOptions } from '@/shared/constants/status';

interface Props {
  onChangePage: (page: number, size: number, sort?: string) => void;
}

const formLayout = {
  labelCol: { span: 6 },
  wrapperCol: { span: 16 }
};

export const BooksTableWidget: React.FC<Props> = ({ onChangePage }) => {
  const dispatch = useAppDispatch();
  const { items, page, size, total, loading } = useAppSelector((state) => state.books);
  const types = useAppSelector((state) => state.bookTypes.list);
  const filters = useAppSelector((state) => state.bookFilters);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: ColumnsType<LibraryItem> = useMemo(
    () => [
      { title: 'Title', dataIndex: 'title', sorter: true },
      { title: 'Alt title', dataIndex: 'altTitle' },
      {
        title: 'Type',
        dataIndex: 'typeName'
      },
      {
        title: 'Status',
        dataIndex: 'status',
        render: (status) => <Tag>{status}</Tag>
      },
      {
        title: 'Rating',
        dataIndex: 'rating'
      },
      {
        title: 'Favorite',
        dataIndex: 'favorite',
        render: (favorite) => (favorite ? '★' : '')
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt'
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        render: (_, record) => (
          <Space>
            <Button size="small" onClick={() => openEdit(record)}>
              Edit
            </Button>
            <Button size="small" danger onClick={() => confirmDelete(record.id)}>
              Delete
            </Button>
          </Space>
        )
      }
    ],
    []
  );

  const confirmDelete = (id: string) => {
    Modal.confirm({
      title: 'Delete book?',
      onOk: async () => {
        await dispatch(deleteBookThunk(id));
        message.success('Deleted');
        dispatch(loadBooks(filters));
      }
    });
  };

  const openEdit = (item?: LibraryItem) => {
    if (item) {
      setEditing(item);
      form.setFieldsValue({ ...item, typeId: item.typeId });
    } else {
      setEditing(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await dispatch(updateBookThunk({ id: editing.id, payload: values }));
      message.success('Updated');
    } else {
      await dispatch(createBookThunk(values));
      message.success('Created');
    }
    setModalOpen(false);
    dispatch(loadBooks(filters));
  };

  const onTableChange = (pagination: TablePaginationConfig, _filters: any, sorter: any) => {
    const sortValue = sorter.order ? `${sorter.field},${sorter.order === 'descend' ? 'desc' : 'asc'}` : filters.sort;
    onChangePage((pagination.current || 1) - 1, pagination.pageSize || size, sortValue);
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openEdit()}>
          Add book
        </Button>
      </Space>
      <Table
        rowKey={(record) => record.id}
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{ current: page + 1, pageSize: size, total }}
        onChange={onTableChange}
      />

      <Modal
        title={editing ? 'Edit book' : 'Add book'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        destroyOnClose
      >
        <Form {...formLayout} form={form} initialValues={{ status: 'PLANNED', favorite: false }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="altTitle" label="Alt title">
            <Input />
          </Form.Item>
          <Form.Item name="typeId" label="Type">
            <Select allowClear options={types.map((t) => ({ label: t.name, value: t.id }))} />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}> 
            <Select options={statusOptions.map((s) => ({ label: s.label, value: s.value }))} />
          </Form.Item>
          <Form.Item name="rating" label="Rating">
            <InputNumber min={0} max={10} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="favorite" label="Favorite" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="comment" label="Comment">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
