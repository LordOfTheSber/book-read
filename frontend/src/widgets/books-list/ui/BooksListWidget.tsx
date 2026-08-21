import React from 'react';
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Pagination,
  Row,
  Skeleton,
  Space,
  Progress,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import { DeleteOutlined, EditOutlined, InboxOutlined, LinkOutlined, PlusOutlined, StarFilled } from '@ant-design/icons';
import { LibraryItem } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { addSession, coverUrl, deleteBookThunk, loadBooks } from '@/entities/book';
import { StatusTag } from '@/shared/ui/StatusTag';
import { progressQuickSteps, progressUnitLabel, resolveProgressUnit } from '@/shared/constants/format';
import { deadlinePhrase, remainingPhrase } from '@/shared/lib/phrases';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { KindTag } from '@/shared/ui/KindTag';
import { formatDate } from '@/shared/lib/date';
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
  /** Выделение для массовых операций живёт на странице: панель действий рисуется над списком. */
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const dash = '—';

/** Ширины колонок строки — те же, что в макете: по ним же расставлена шапка списка. */
const COL = { status: 118, progress: 210, rating: 78, updated: 118, actions: 76 };

export const BooksListWidget: React.FC<Props> = ({
  viewMode,
  isMobile,
  onChangePage,
  onEdit,
  onCreate,
  hasActiveFilters,
  onResetFilters,
  selectedIds,
  onSelectionChange
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

  const toggleSelection = (id: string, checked: boolean) => {
    onSelectionChange(checked ? [...selectedIds, id] : selectedIds.filter((selected) => selected !== id));
  };

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
    // Процент сам по себе ничего не решает: подсказка переводит его в «успею или нет».
    const phrase = remainingPhrase(progress, unitKey) ?? deadlinePhrase(progress, unitKey);

    return (
      <div style={styles.progressBlock} onClick={(e) => e.stopPropagation()}>
        <Tooltip title={phrase}>
          <Progress
            percent={progress.percent}
            size="small"
            showInfo={false}
            status={complete ? 'success' : progress.behindSchedule ? 'exception' : 'normal'}
            style={styles.progressBar}
          />
        </Tooltip>
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

  /** Одна запись строкой: шесть колонок макета вместо таблицы Ant Design. */
  const renderRow = (item: LibraryItem, last: boolean) => {
    const selected = selectedIds.includes(item.id);
    const authors = renderAuthors(item);

    return (
      <div
        key={item.id}
        style={styles.listRow(last, selected)}
        onClick={canEdit ? () => onEdit(item) : undefined}
        className={canEdit ? 'app-shell-hover' : undefined}
      >
        {canEdit && (
          <span onClick={(event) => event.stopPropagation()} style={{ display: 'flex', flexShrink: 0 }}>
            <Checkbox
              checked={selected}
              onChange={(event) => toggleSelection(item.id, event.target.checked)}
              aria-label={`Выбрать «${item.title}»`}
            />
          </span>
        )}

        <div style={{ ...styles.titleWrap, flex: 1 }}>
          <CoverThumb
            src={item.hasCover ? coverUrl(item.id, item.updatedAt) : undefined}
            title={item.title}
            kind={item.kind}
            width={36}
            height={48}
            radius={8}
            // Закладка из обложки: в списке из полусотни строк начатое видно до чтения цифр.
            progressPercent={item.progress?.percent ?? undefined}
            style={styles.rowCover}
          />
          <div style={styles.titleCell}>
            <div style={styles.titleRow}>
              <span style={styles.rowTitle}>{item.title}</span>
              <KindTag kind={item.kind} />
              {item.favorite && (
                <Tooltip title="В избранном">
                  <StarFilled style={styles.favoriteIcon} />
                </Tooltip>
              )}
            </div>
            {(authors || item.altTitle) && <div style={styles.rowMeta}>{authors ?? item.altTitle}</div>}
          </div>
        </div>

        <div style={{ width: COL.status, flexShrink: 0 }}>
          <StatusTag status={item.status} style={styles.tag} />
        </div>

        <div style={{ width: COL.progress, flexShrink: 0 }}>{renderProgress(item)}</div>

        <div style={{ width: COL.rating, flexShrink: 0 }}>{renderRating(item.rating)}</div>

        <div style={{ width: COL.updated, flexShrink: 0, ...styles.muted, fontSize: 13 }}>
          {formatDate(item.updatedAt)}
        </div>

        <div
          style={{ width: COL.actions, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}
          onClick={(event) => event.stopPropagation()}
        >
          {renderActions(item)}
        </div>
      </div>
    );
  };

  /**
   * Строка телефона по Mobile1: обложка, название, автор и прогресс с «+N» прямо в строке.
   * Шесть колонок на 390 px не помещаются, а крупные карточки давали одну запись на экран.
   */
  const renderMobileRow = (item: LibraryItem, last: boolean) => (
    <div
      key={item.id}
      style={styles.mobileRow(last)}
      onClick={canEdit ? () => onEdit(item) : undefined}
    >
      <CoverThumb
        src={item.hasCover ? coverUrl(item.id, item.updatedAt) : undefined}
        title={item.title}
        kind={item.kind}
        width={44}
        height={62}
        radius={8}
        progressPercent={item.progress?.percent ?? undefined}
        style={styles.rowCover}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.titleRow}>
          <span style={styles.rowTitle}>{item.title}</span>
          {item.favorite && <StarFilled style={styles.favoriteIcon} />}
        </div>
        {renderAuthors(item) && <div style={styles.rowMeta}>{renderAuthors(item)}</div>}
        <div style={{ marginTop: 8 }}>
          {renderProgress(item) ?? (
            <Space size={8}>
              <StatusTag status={item.status} style={styles.tag} />
              <KindTag kind={item.kind} iconOnly />
            </Space>
          )}
        </div>
      </div>
      {canEdit && (
        <span onClick={(event) => event.stopPropagation()} style={{ display: 'flex', flexShrink: 0 }}>
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onChange={(event) => toggleSelection(item.id, event.target.checked)}
            aria-label={`Выбрать «${item.title}»`}
          />
        </span>
      )}
    </div>
  );

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

  if (viewMode === 'grid' && !isMobile) {
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
                      progressPercent={item.progress?.percent ?? undefined}
                      style={styles.cardCover}
                    />
                    <div style={styles.coverBadges}>
                      <Space size={8}>
                        {/* Выделение доступно и в сетке: на телефоне другого режима просто нет. */}
                        {canEdit && (
                          <span onClick={(event) => event.stopPropagation()} style={styles.selectBadge}>
                            <Checkbox
                              checked={selectedIds.includes(item.id)}
                              onChange={(event) => toggleSelection(item.id, event.target.checked)}
                              aria-label={`Выбрать «${item.title}»`}
                            />
                          </span>
                        )}
                        <StatusTag status={item.status} style={styles.tag} />
                      </Space>
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
                      {renderSource(item)}
                    </Tag>
                  )}
                  {renderSeries(item) && (
                    <Tag bordered={false} style={styles.neutralTag}>
                      {renderSeries(item)}
                    </Tag>
                  )}
                  {/* Теги — то, ради чего они и заводятся: видеть контекст записи, не открывая её. */}
                  {item.tags?.map((tag) => (
                    <Tag key={tag.id} color={tag.color ?? undefined} bordered={false} style={styles.tag}>
                      {tag.name}
                    </Tag>
                  ))}
                  {/* Полка со значком: иначе её не отличить от тега, а это разные вещи. */}
                  {item.shelves?.map((shelf) => (
                    <Tag key={shelf.id} bordered={false} icon={<InboxOutlined />} style={styles.neutralTag}>
                      {shelf.name}
                    </Tag>
                  ))}
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

  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  if (loading && items.length === 0) {
    return (
      <div style={styles.table}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} style={{ padding: '14px 16px' }}>
            <Skeleton active paragraph={{ rows: 1 }} />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div style={styles.emptyWrapper}>{emptyState}</div>;
  }

  return (
    <div style={styles.table}>
      {/* Шапка списка — подписи колонок, а не кнопки сортировки: порядок задаётся одним
          выбором в панели выше, и два места для одного и того же расходились между собой. */}
      {!isMobile && (
        <div style={styles.listHead}>
          {canEdit && (
            <span style={{ display: 'flex', flexShrink: 0 }}>
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && items.some((item) => selectedIds.includes(item.id))}
                onChange={(event) =>
                  onSelectionChange(
                    event.target.checked
                      ? Array.from(new Set([...selectedIds, ...items.map((item) => item.id)]))
                      : selectedIds.filter((id) => !items.some((item) => item.id === id))
                  )
                }
                aria-label="Выбрать все записи на странице"
              />
            </span>
          )}
          <span style={{ flex: 1, minWidth: 0 }}>Запись</span>
          <span style={{ width: COL.status, flexShrink: 0 }}>Статус</span>
          <span style={{ width: COL.progress, flexShrink: 0 }}>Прогресс</span>
          <span style={{ width: COL.rating, flexShrink: 0 }}>Оценка</span>
          <span style={{ width: COL.updated, flexShrink: 0 }}>Обновлено</span>
          <span style={{ width: COL.actions, flexShrink: 0 }} />
        </div>
      )}

      {items.map((item, index) =>
        isMobile
          ? renderMobileRow(item, index === items.length - 1)
          : renderRow(item, index === items.length - 1)
      )}

      <div style={styles.listFooter}>
        <Pagination
          current={page + 1}
          pageSize={size}
          total={total}
          showSizeChanger={!isMobile}
          size={isMobile ? 'small' : 'default'}
          onChange={(p, s) => onChangePage(p - 1, s, filters.sort)}
          onShowSizeChange={(p, s) => onChangePage(p - 1, s, filters.sort)}
          showTotal={(count, range) => `${range[0]}–${range[1]} из ${count}`}
        />
      </div>
    </div>
  );
};
