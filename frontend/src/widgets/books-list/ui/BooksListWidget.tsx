import React, { useMemo } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Pagination,
  Row,
  Skeleton,
  Space,
  Progress,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import { DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined, StarFilled } from '@ant-design/icons';
import { LibraryItem } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { addSession, coverUrl, deleteBookThunk, loadBooks } from '@/entities/book';
import { getStatusColor, getStatusLabel } from '@/shared/constants/status';
import { progressQuickSteps, progressUnitLabel, resolveProgressUnit } from '@/shared/constants/format';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { KindTag } from '@/shared/ui/KindTag';
import { formatDate, formatDateTime } from '@/shared/lib/date';
import { formatScore } from '@/shared/lib/format';
import { useRequestError } from '@/shared/lib/errors';
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
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const { items, page, size, total, loading } = useAppSelector((state) => state.books);
  const filters = useAppSelector((state) => state.bookFilters);
  const user = useAppSelector((state) => state.auth.user);
  const role = user?.role;
  const styles = useBooksListStyles();
  const isAdmin = isAdminLike(role);
  const canEdit = canEditBooks(role);

  const confirmDelete = (item: LibraryItem) => {
    modal.confirm({
      title: 'Удалить запись?',
      content: `«${item.title}» будет удалена без возможности восстановления.`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await dispatch(deleteBookThunk(item.id)).unwrap();
          message.success('Запись удалена');
        } catch (error) {
          showRequestError(error, 'Не удалось удалить запись');
        }
      }
    });
  };

  const renderRating = (rating?: number | null) => {
    const value = formatScore(rating);
    if (!value) return <span style={styles.muted}>{dash}</span>;
    return (
      <span style={styles.rating}>
        <StarFilled style={styles.ratingIcon} />
        {value}
      </span>
    );
  };

  /**
   * Быстрое продвижение прямо из списка: заход от текущей позиции без открытия карточки.
   * Ради него сессия и сделана лёгкой — без обязательных полей.
   */
  const advance = async (item: LibraryItem, delta: number) => {
    const current = item.progress?.current ?? 0;
    // Позицию за краем шкалы сервер всё равно обрежет — незачем сохранять её в истории.
    const target = item.progress?.total ? Math.min(current + delta, item.progress.total) : current + delta;
    if (target === current) {
      message.info('Шкала уже пройдена до конца');
      return;
    }
    try {
      await addSession(item.id, { fromPosition: current, toPosition: target });
      await dispatch(loadBooks(filters)).unwrap();
    } catch (error) {
      showRequestError(error, 'Не удалось отметить прогресс');
    }
  };

  const renderProgress = (item: LibraryItem) => {
    const progress = item.progress;
    if (!progress || progress.percent === undefined || progress.percent === null) return null;
    const unitKey = resolveProgressUnit(item);
    const unit = progressUnitLabel[unitKey];
    // Шаг зависит от единицы: «+10 томов» из списка никто не отмечает.
    const step = progressQuickSteps[unitKey][0];
    const complete = progress.percent === 100;

    return (
      <div style={styles.progressBlock} onClick={(e) => e.stopPropagation()}>
        <Progress
          percent={progress.percent}
          size="small"
          showInfo={false}
          status={complete ? 'success' : progress.behindSchedule ? 'exception' : 'normal'}
          style={styles.progressBar}
        />
        <div style={styles.progressMeta}>
          <Typography.Text type="secondary" style={styles.progressText}>
            {`${progress.current ?? 0}/${progress.total} ${unit}`}
          </Typography.Text>
          {canEdit && item.status === 'READING' && !complete && (
            <Button size="small" type="link" style={styles.advanceButton} onClick={() => advance(item, step)}>
              {`+${step}`}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderAuthors = (item: LibraryItem) =>
    item.authors.length > 0 ? item.authors.map((author) => author.name).join(', ') : null;

  /** Серия с номером: «Воспоминания о прошлом Земли, 2.5». */
  const renderSeries = (item: LibraryItem) => {
    if (!item.seriesName) return null;
    return item.orderInSeries !== undefined && item.orderInSeries !== null
      ? `${item.seriesName}, ${item.orderInSeries}`
      : item.seriesName;
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
        title: 'Произведение',
        dataIndex: 'title',
        sorter: true,
        width: '34%',
        render: (_: string, item) => (
          <div style={styles.titleWrap}>
            {/* Обложка в списке: раздел 1 роадмапа ради неё и делался, а таблица её не показывала. */}
            <CoverThumb
              src={item.hasCover ? coverUrl(item.id, item.updatedAt) : undefined}
              title={item.title}
              kind={item.kind}
              width={36}
              height={50}
              style={styles.rowCover}
            />
            <div style={styles.titleCell}>
              <div style={styles.titleRow}>
                {/* Значок вида: иначе сериал и книга в списке выглядят одинаково. */}
                <KindTag kind={item.kind} iconOnly />
                {item.favorite && (
                  <Tooltip title="В избранном">
                    <StarFilled style={styles.favoriteIcon} />
                  </Tooltip>
                )}
                <Typography.Text strong ellipsis={{ tooltip: item.title }}>
                  {item.title}
                </Typography.Text>
              </div>
              {renderAuthors(item) && (
                <Typography.Text type="secondary" ellipsis={{ tooltip: renderAuthors(item) ?? undefined }} style={styles.altTitle}>
                  {renderAuthors(item)}
                </Typography.Text>
              )}
              {item.altTitle && (
                <Typography.Text type="secondary" ellipsis={{ tooltip: item.altTitle }} style={styles.altTitle}>
                  {item.altTitle}
                </Typography.Text>
              )}
            </div>
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
        title: 'Прогресс',
        dataIndex: 'progress',
        width: 190,
        responsive: ['lg'],
        render: (_: unknown, item) => renderProgress(item) ?? <span style={styles.muted}>{dash}</span>
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
              // Раньше называлось «Автор», но теперь у произведения есть настоящие авторы.
              title: 'Добавил',
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

  const onTableChange = (
    pagination: TablePaginationConfig,
    _f: unknown,
    sorter: SorterResult<LibraryItem> | SorterResult<LibraryItem>[]
  ) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const sortValue = activeSorter?.order
      ? `${String(activeSorter.field)},${activeSorter.order === 'descend' ? 'desc' : 'asc'}`
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
              : 'Добавьте первую запись — книгу, сериал или подкаст.'}
          </Typography.Text>
        </Space>
      }
    >
      {hasActiveFilters ? (
        <Button onClick={onResetFilters}>Сбросить фильтры</Button>
      ) : (
        canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            Добавить запись
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
              <Card
                style={styles.card}
                styles={{ body: styles.cardBody }}
                hoverable={canEdit}
                onClick={canEdit ? () => onEdit(item) : undefined}
                cover={
                  // Заглушка обязательна: иначе карточки с обложкой выше остальных на 200 пикселей.
                  <div style={styles.coverWrap}>
                    <CoverThumb
                      src={item.hasCover ? coverUrl(item.id, item.updatedAt) : undefined}
                      title={item.title}
                      kind={item.kind}
                      width="100%"
                      height={200}
                      topOnly
                      style={styles.cardCover}
                    />
                    <div style={styles.coverBadges}>
                      <Tag color={getStatusColor(item.status)} bordered={false} style={styles.tag}>
                        {getStatusLabel(item.status)}
                      </Tag>
                      {item.favorite && (
                        <Tooltip title="В избранном">
                          <span style={styles.favoriteBadge}>
                            <StarFilled />
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                }
              >
                <div style={styles.cardTop}>
                  <KindTag kind={item.kind} />
                  {/* Прочерк вместо оценки уместен в таблице, где у столбца есть заголовок;
                      в карточке он читается как ошибка, поэтому пустое место остаётся пустым. */}
                  {item.rating !== undefined && item.rating !== null && renderRating(item.rating)}
                </div>

                <Typography.Paragraph strong ellipsis={{ rows: 2, tooltip: item.title }} style={styles.cardTitle}>
                  {item.title}
                </Typography.Paragraph>
                {renderAuthors(item) && (
                  <Typography.Paragraph type="secondary" ellipsis={{ rows: 1 }} style={styles.cardAltTitle}>
                    {renderAuthors(item)}
                  </Typography.Paragraph>
                )}
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
                  {renderSeries(item) && (
                    <Tag bordered={false} style={styles.neutralTag}>
                      {renderSeries(item)}
                    </Tag>
                  )}
                </Space>

                {renderProgress(item)}

                <div style={styles.cardFooter}>
                  <span style={styles.muted}>{formatDate(item.updatedAt)}</span>
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
