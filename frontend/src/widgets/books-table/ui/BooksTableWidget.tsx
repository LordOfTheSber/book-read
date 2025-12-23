import React, { useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Modal, Space, Table, Tag, message, Form, Input, Select, Switch, Tooltip, Flex, Rate } from 'antd';
import { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, StarFilled, SearchOutlined } from '@ant-design/icons';
import { LibraryItem } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { deleteBookThunk, loadBooks, updateBookThunk, createBookThunk } from '@/entities/book';
import { statusOptions } from '@/shared/constants/status';
import { useBooksTableWidgetStyles } from './BooksTableWidget.styles';
import { loadSources } from '@/entities/source';
import { setFilters } from '@/features/book/set-book-filters';

interface Props {
  onChangePage: (page: number, size: number, sort?: string) => void;
}

const statusLabelMap = Object.fromEntries(statusOptions.map((s) => [s.value, s.label]));
const statusColorMap: Record<string, string> = {
  READING: 'geekblue',
  DROPPED: 'volcano',
  COMPLETED: 'green',
  PLANNED: 'gold'
};

const renderDash = (value?: React.ReactNode) => (value === undefined || value === null || value === '' ? '—' : value);

const formatRating = (rating?: number | null) => {
  if (rating === undefined || rating === null) return '—';
  return Number.isInteger(rating) ? rating : rating.toFixed(1);
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (v: number) => v.toString().padStart(2, '0');

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const BooksTableWidget: React.FC<Props> = ({ onChangePage }) => {
  const dispatch = useAppDispatch();
  const { items, page, size, total, loading } = useAppSelector((state) => state.books);
  const types = useAppSelector((state) => state.bookTypes.list);
  const sources = useAppSelector((state) => state.sources.list);
  const filters = useAppSelector((state) => state.bookFilters);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(filters.q ?? '');
  const [form] = Form.useForm();
  const styles = useBooksTableWidgetStyles();

  const columns: ColumnsType<LibraryItem> = useMemo(
    () => [
      { title: 'Название', dataIndex: 'title', sorter: true, ellipsis: true },
      { title: 'Альтернативное название', dataIndex: 'altTitle', ellipsis: true, render: renderDash },
      {
        title: 'Тип',
        dataIndex: 'typeName',
        ellipsis: true,
        render: renderDash
      },
      {
        title: 'Источник',
        dataIndex: 'sourceName',
        render: (sourceName, record) => {
          if (!sourceName) return renderDash();
          if (!record.sourceUrl) return sourceName;

          return (
            <a href={record.sourceUrl} target="_blank" rel="noreferrer">
              {sourceName}
            </a>
          );
        }
      },
      {
        title: 'Статус',
        dataIndex: 'status',
        render: (status) => (
          <Tag color={statusColorMap[status] || 'default'} bordered={false} style={{ fontWeight: 600 }}>
            {statusLabelMap[status] || status}
          </Tag>
        )
      },
      {
        title: 'Оценка',
        dataIndex: 'rating',
        render: (rating) => formatRating(rating)
      },
      {
        title: 'Избранное',
        dataIndex: 'favorite',
        render: (favorite) =>
          favorite ? (
            <Tag color="gold" bordered={false} icon={<StarFilled />} style={{ fontWeight: 600 }}>
              Избранное
            </Tag>
          ) : (
            renderDash()
          )
      },
      {
        title: 'Обновлено',
        dataIndex: 'updatedAt',
        render: (value) => formatDateTime(value)
      },
      {
        title: 'Действия',
        dataIndex: 'actions',
        render: (_, record) => (
          <Space size="small">
            <Tooltip title="Редактировать">
              <Button
                size="small"
                type="text"
                shape="circle"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
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
      form.setFieldsValue({ ...item, typeId: item.typeId, sourceId: item.sourceId });
    } else {
      setEditing(null);
      form.resetFields();
    }
    setDrawerOpen(true);
  };

  useEffect(() => {
    dispatch(loadSources());
  }, [dispatch]);

  useEffect(() => {
    setSearchValue(filters.q ?? '');
  }, [filters.q]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await dispatch(updateBookThunk({ id: editing.id, payload: values }));
      message.success('Данные обновлены');
    } else {
      await dispatch(createBookThunk(values));
      message.success('Книга добавлена');
    }
    setDrawerOpen(false);
    dispatch(loadBooks(filters));
  };

  const onTableChange = (pagination: TablePaginationConfig, _filters: any, sorter: any) => {
    const sortValue = sorter.order ? `${sorter.field},${sorter.order === 'descend' ? 'desc' : 'asc'}` : filters.sort;
    const currentPage = (pagination.current || 1) - 1;
    const pageSize = pagination.pageSize || size;

    onChangePage(currentPage, pageSize, sortValue);
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    dispatch(setFilters({ ...filters, q: value || undefined, page: 0 }));
  };

  return (
    <>
      <Flex style={styles.toolbar} align="center" wrap>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>
          Добавить книгу
        </Button>
        <Input.Search
          allowClear
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          onSearch={handleSearch}
          placeholder="Поиск по названию"
          enterButton={<SearchOutlined />}
          style={styles.searchInput}
        />
      </Flex>
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
        size="middle"
        bordered={false}
        style={styles.tableSurface}
        onHeaderRow={() => ({ style: styles.headerRow })}
      />

      <Drawer
        title={editing ? 'Редактирование книги' : 'Добавление книги'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        width={720}
        footer={
          <div style={styles.drawerFooter}>
            <Button onClick={() => setDrawerOpen(false)}>Отмена</Button>
            <Button type="primary" onClick={handleSubmit}>
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        }
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{ status: 'PLANNED', favorite: false }}
          style={styles.drawerForm}
        >
          <Form.Item
            name="title"
            label="Название"
            rules={[{ required: true, message: 'Название обязательно' }]}
            style={{ gridColumn: '1 / -1' }}
          >
            <Input />
          </Form.Item>
          <Form.Item name="altTitle" label="Альтернативное название" style={{ gridColumn: '1 / -1' }}>
            <Input />
          </Form.Item>
          <Form.Item name="typeId" label="Тип">
            <Select allowClear options={types.map((t) => ({ label: t.name, value: t.id }))} />
          </Form.Item>
          <Form.Item name="sourceId" label="Источник">
            <Select allowClear options={sources.map((s) => ({ label: s.name, value: s.id }))} />
          </Form.Item>
          <Form.Item name="status" label="Статус" rules={[{ required: true }]}>
            <Select options={statusOptions.map((s) => ({ label: s.label, value: s.value }))} />
          </Form.Item>
          <Form.Item name="rating" label="Оценка">
            <Rate allowClear allowHalf count={10} />
          </Form.Item>
          <Form.Item name="favorite" label="Избранное" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий" style={{ gridColumn: '1 / -1' }}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
};
