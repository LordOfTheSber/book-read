import React, { useMemo, useState } from 'react';
import { Button, Modal, Space, Table, Tag, message, Form, Input, InputNumber, Select, Switch } from 'antd';
import { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { LibraryItem } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { deleteBookThunk, loadBooks, updateBookThunk, createBookThunk } from '@/entities/book';
import { statusOptions } from '@/shared/constants/status';
import { useBooksTableWidgetStyles } from './BooksTableWidget.styles';

interface Props {
  onChangePage: (page: number, size: number, sort?: string) => void;
}

const formLayout = {
  labelCol: { span: 7 },
  wrapperCol: { span: 15 }
};

const statusLabelMap = Object.fromEntries(statusOptions.map((s) => [s.value, s.label]));

export const BooksTableWidget: React.FC<Props> = ({ onChangePage }) => {
  const dispatch = useAppDispatch();
  const { items, page, size, total, loading } = useAppSelector((state) => state.books);
  const types = useAppSelector((state) => state.bookTypes.list);
  const filters = useAppSelector((state) => state.bookFilters);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const styles = useBooksTableWidgetStyles();

  const columns: ColumnsType<LibraryItem> = useMemo(
    () => [
      { title: 'Название', dataIndex: 'title', sorter: true },
      { title: 'Альтернативное название', dataIndex: 'altTitle' },
      {
        title: 'Тип',
        dataIndex: 'typeName'
      },
      {
        title: 'Статус',
        dataIndex: 'status',
        render: (status) => <Tag color="blue-inverse">{statusLabelMap[status] || status}</Tag>
      },
      {
        title: 'Оценка',
        dataIndex: 'rating'
      },
      {
        title: 'Избранное',
        dataIndex: 'favorite',
        render: (favorite) => (favorite ? '★' : '—')
      },
      {
        title: 'Обновлено',
        dataIndex: 'updatedAt'
      },
      {
        title: 'Действия',
        dataIndex: 'actions',
        render: (_, record) => (
          <Space size="small">
            <Button size="small" onClick={() => openEdit(record)}>
              Редактировать
            </Button>
            <Button size="small" danger onClick={() => confirmDelete(record.id)}>
              Удалить
            </Button>
          </Space>
        )
      }
    ],
    []
  );

  const confirmDelete = (id: string) => {
    Modal.confirm({
      title: 'Удалить книгу?',
      okText: 'Удалить',
      cancelText: 'Отмена',
      onOk: async () => {
        await dispatch(deleteBookThunk(id));
        message.success('Книга удалена');
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
      message.success('Данные обновлены');
    } else {
      await dispatch(createBookThunk(values));
      message.success('Книга добавлена');
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
      <div style={styles.toolbar}>
        <Button type="primary" onClick={() => openEdit()}>
          Добавить книгу
        </Button>
      </div>
      <Table
        rowKey={(record) => record.id}
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{
          current: page + 1,
          pageSize: size,
          total,
          showSizeChanger: true,
          showTotal: (count, range) => `Книги ${range[0]}–${range[1]} из ${count}`
        }}
        onChange={onTableChange}
      />

      <Modal
        title={editing ? 'Редактирование книги' : 'Добавление книги'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={editing ? 'Сохранить' : 'Добавить'}
        cancelText="Отмена"
        destroyOnClose
      >
        <Form
          {...formLayout}
          form={form}
          initialValues={{ status: 'PLANNED', favorite: false }}
          style={styles.formPadding}
        >
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="altTitle" label="Альтернативное название">
            <Input />
          </Form.Item>
          <Form.Item name="typeId" label="Тип">
            <Select allowClear options={types.map((t) => ({ label: t.name, value: t.id }))} />
          </Form.Item>
          <Form.Item name="status" label="Статус" rules={[{ required: true }]}>
            <Select options={statusOptions.map((s) => ({ label: s.label, value: s.value }))} />
          </Form.Item>
          <Form.Item name="rating" label="Оценка">
            <InputNumber min={0} max={10} step={0.5} style={styles.fullWidth} />
          </Form.Item>
          <Form.Item name="favorite" label="Избранное" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
