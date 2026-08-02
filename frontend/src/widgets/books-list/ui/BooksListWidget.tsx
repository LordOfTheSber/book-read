import React, { useMemo } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Pagination,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined
} from '@ant-design/icons';
import { AxiosError } from 'axios';
import { LibraryItem } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { deleteBookThunk } from '@/entities/book';
import { getStatusColor, getStatusLabel } from '@/shared/constants/status';
import { formatDate, formatDateTime } from '@/shared/lib/date';
import { isAdminLike, canEditBooks, canDeleteBook } from '@/shared/lib/roles';
import { useBooksListStyles } from './BooksListWidget.styles';

export type BooksViewMode = 'table' | 'grid';

interface Props {
  viewMode: BooksViewMode;
  isMobile: boolean;
  onChangePage: (page: number, size: number, sort?: string) => void;
  onEdit: (item: LibraryItem) => void;
  onCreate: () => void;
  /** Есть ли активные фильтры — от этого зависит текст пустого состояния. */
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

const dash = '—';

const formatRating = (rating?: number | null) => {
  if (rating === undefined || rating === null) return null;
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
};

export const BooksListWidget: React.FC<Props> = ({
  viewMode,
  isMobile,
  onChangePage,
  onEdit,
  onCreate,
  hasActiveFilters,
  onResetFilters
}) => {
  const dispatch = useAppDispatch();
  const { items, page, size, total, loading } = useAppSelector((state) => state.books);
  const filters = useAppSelector((state) => state.bookFilters);
  const user = useAppSelector((state) => state.auth.user);
  const role = user?.role;
  const styles = useBooksListStyles();
  const isAdmin = isAdminLike(role);
  const canEdit = canEditBooks(role);

  const confirmDelete = (item: LibraryItem) => {
    Modal.confirm({
      title: 'Удалить книгу?',
      content: `«${item.title}» будет удалена без возможности восстановления.`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await dispatch(deleteBookThunk(item.id)).unwrap();
          message.success('Книга удалена');
        } catch (error) {
          const axiosError = error as AxiosError<{ message?: string }>;
          message.error(
            axiosError.response?.status === 403
              ? 'Нет прав для выполнения действия'
              : axiosError.response?.data?.message || 'Не удалось удалить книгу'
          );
        }
      }
    });
  };

  const renderRating = (rating?: number | null) => {
    const value = formatRating(rating);
    if (!value) return <span style={styles.muted}>{dash}</span>;
    return (
      <span style={styles.rating}>
        <StarFilled style={styles.ratingIcon} />
        {value}
      </span>
    );
  };

  const renderSource = (item: LibraryItem) => {
    if (!item.sourceName) return <span style={styles.muted}>{dash}</span>;
    if (!item.sourceUrl) return item.sourceName;
    return (
      <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={styles.sourceLink}>
        {item.sourceName}
        <LinkOutlined />
      </a>
    );
  };

  const renderActions = (item: LibraryItem) => {
    const deletable = canDeleteBook(role, user?.id, item.createdById);
    if (!canEdit && !deletable) return null;
    return (
      <Space size={2}>
        {canEdit && (
          <Tooltip title="Редактировать">
            <Button type="text" shape="circle" icon={<EditOutlined />} onClick={() => onEdit(item)} aria-label="Редактировать" />
          </Tooltip>
        )}
        {deletable && (
          <Tooltip title="Удалить">
            <Button
              type="text"
              danger
              shape="circle"
              icon={<DeleteOutlined />}
              onClick={() => confirmDelete(item)}
              aria-label="Удалить"
            />
          </Tooltip>
        )}
      </Space>
    );
  };

  const columns: ColumnsType<LibraryItem> = useMemo(
    () => [
      {
        title: 'Книга',
        dataIndex: 'title',
        sorter: true,
        width: '32%',
        render: (_: string, item) => (
          <div style={styles.titleCell}>
            <div style={styles.titleRow}>
              {item.favorite && (
                <Tooltip title="В избранном">
                  <StarFilled style={styles.favoriteIcon} />
                </Tooltip>
              )}
              <Typography.Text strong ellipsis={{ tooltip: item.title }}>
                {item.title}
              </Typography.Text>
            </div>
            {item.altTitle && (
              <Typography.Text type="secondary" ellipsis={{ tooltip: item.altTitle }} style={styles.altTitle}>
                {item.altTitle}
              </Typography.Text>
            )}
          </div>
        )
      },
      {
        title: 'Статус',
        dataIndex: 'status',
        width: 130,
        render: (status: string) => (
          <Tag color={getStatusColor(status)} bordered={false} style={styles.tag}>
            {getStatusLabel(status)}
          </Tag>
        )
      },
      {
        title: 'Тип',
        dataIndex: 'typeName',
        width: 140,
        render: (typeName?: string) =>
          typeName ? (
            <Tag bordered={false} style={styles.neutralTag}>
              {typeName}
            </Tag>
          ) : (
            <span style={styles.muted}>{dash}</span>
          )
      },
      {
        title: 'Источник',
        dataIndex: 'sourceName',
        width: 160,
        responsive: ['lg'],
        render: (_: string, item) => renderSource(item)
      },
      {
        title: 'Оценка',
        dataIndex: 'rating',
        width: 100,
        sorter: true,
        render: (rating?: number) => renderRating(rating)
      },
      {
        title: 'Обновлено',
        dataIndex: 'updatedAt',
        width: 150,
        sorter: true,
        responsive: ['xl'],
        render: (value?: string) => <span style={styles.muted}>{formatDateTime(value)}</span>
      },
      ...(isAdmin
        ? [
            {
              title: 'Автор',
              dataIndex: 'createdByUsername',
              width: 130,
              responsive: ['xl'],
              render: (value?: string) => value || <span style={styles.muted}>{dash}</span>
            } as ColumnsType<LibraryItem>[number]
          ]
        : []),
      ...(canEdit || isAdmin
        ? [
            {
              title: '',
              dataIndex: 'actions',
              width: 96,
              align: 'right',
              render: (_: unknown, item: LibraryItem) => renderActions(item)
            } as ColumnsType<LibraryItem>[number]
          ]
        : [])
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, canEdit, role, user?.id, styles]
  );

  const onTableChange = (pagination: TablePaginationConfig, _f: unknown, sorter: any) => {
    const sortValue = sorter?.order
      ? `${sorter.field},${sorter.order === 'descend' ? 'desc' : 'asc'}`
      : filters.sort;
    onChangePage((pagination.current || 1) - 1, pagination.pageSize || size, sortValue);
  };

  const emptyState = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space direction="vertical" size={4}>
          <Typography.Text strong>{hasActiveFilters ? 'Ничего не найдено' : 'Библиотека пока пуста'}</Typography.Text>
          <Typography.Text type="secondary">
            {hasActiveFilters
              ? 'Попробуйте смягчить фильтры или изменить запрос.'
              : 'Добавьте первую книгу — она появится здесь.'}
          </Typography.Text>
        </Space>
      }
    >
      {hasActiveFilters ? (
        <Button onClick={onResetFilters}>Сбросить фильтры</Button>
      ) : (
        canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            Добавить книгу
          </Button>
        )
      )}
    </Empty>
  );

  const paginationBar = (
    <div style={styles.paginationBar}>
      <Pagination
        current={page + 1}
        pageSize={size}
        total={total}
        showSizeChanger
        size={isMobile ? 'small' : 'default'}
        onChange={(p, s) => onChangePage(p - 1, s, filters.sort)}
        onShowSizeChange={(p, s) => onChangePage(p - 1, s, filters.sort)}
        showTotal={(count, range) => `${range[0]}–${range[1]} из ${count}`}
      />
    </div>
  );

  if (viewMode === 'grid' || isMobile) {
    if (loading && items.length === 0) {
      return (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Col key={index} xs={24} sm={12} xl={8} xxl={6}>
              <Card style={styles.card} styles={{ body: styles.cardBody }}>
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      );
    }

    if (items.length === 0) {
      return <div style={styles.emptyWrapper}>{emptyState}</div>;
    }

    return (
      <>
        <Row gutter={[16, 16]}>
          {items.map((item) => (
            <Col key={item.id} xs={24} sm={12} xl={8} xxl={6}>
              <Card style={styles.card} styles={{ body: styles.cardBody }} hoverable={canEdit} onClick={canEdit ? () => onEdit(item) : undefined}>
                <div style={styles.cardTop}>
                  <Tag color={getStatusColor(item.status)} bordered={false} style={styles.tag}>
                    {getStatusLabel(item.status)}
                  </Tag>
                  {item.favorite ? (
                    <StarFilled style={styles.favoriteIcon} />
                  ) : (
                    <StarOutlined style={styles.mutedIcon} />
                  )}
                </div>

                <Typography.Paragraph strong ellipsis={{ rows: 2, tooltip: item.title }} style={styles.cardTitle}>
                  {item.title}
                </Typography.Paragraph>
                {item.altTitle && (
                  <Typography.Paragraph type="secondary" ellipsis={{ rows: 1 }} style={styles.cardAltTitle}>
                    {item.altTitle}
                  </Typography.Paragraph>
                )}

                <Space size={[6, 6]} wrap style={styles.cardTags}>
                  {item.typeName && (
                    <Tag bordered={false} style={styles.neutralTag}>
                      {item.typeName}
                    </Tag>
                  )}
                  {item.sourceName && (
                    <Tag bordered={false} style={styles.neutralTag}>
                      {item.sourceName}
                    </Tag>
                  )}
                </Space>

                <div style={styles.cardFooter}>
                  <Space size={12}>
                    {renderRating(item.rating)}
                    <span style={styles.muted}>{formatDate(item.updatedAt)}</span>
                  </Space>
                  <div onClick={(e) => e.stopPropagation()}>{renderActions(item)}</div>
                </div>

                {isAdmin && item.createdByUsername && (
                  <Typography.Text type="secondary" style={styles.cardAuthor}>
                    Добавил: {item.createdByUsername}
                  </Typography.Text>
                )}
              </Card>
            </Col>
          ))}
        </Row>
        {paginationBar}
      </>
    );
  }

  return (
    <Table
      rowKey={(record) => record.id}
      columns={columns}
      dataSource={items}
      loading={loading}
      locale={{ emptyText: emptyState }}
      pagination={{
        current: page + 1,
        pageSize: size,
        total,
        showSizeChanger: true,
        showTotal: (count, range) => `${range[0]}–${range[1]} из ${count}`,
        style: styles.tablePagination
      }}
      onChange={onTableChange}
      size="middle"
      scroll={{ x: 720 }}
      style={styles.table}
    />
  );
};
