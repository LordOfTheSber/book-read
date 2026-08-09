import React, { useEffect, useMemo } from 'react';
import { Alert, Card, Col, Empty, List, Row, Select, Skeleton, Space, Tag, Typography, theme } from 'antd';
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PauseCircleOutlined,
  ReadOutlined,
  ShoppingOutlined,
  StarOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { analyticsActions, loadBookAnalytics, loadReadingAnalytics } from '@/entities/analytics';
import { loadUsers } from '@/entities/user';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { statusMeta } from '@/shared/constants/status';
import { PeriodStats, ReadingStatus } from '@/shared/types/library';
import { isAdminLike } from '@/shared/lib/roles';
import { BarList } from '@/shared/ui/BarList';
import { ActivityHeatmap } from '@/shared/ui/ActivityHeatmap';
import { ColumnChart } from '@/shared/ui/ColumnChart';
import { formatDate } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/plural';
import { progressUnitGenitive } from '@/shared/constants/format';
import { useAnalyticsPageStyles } from './AnalyticsPage.styles';

const statusOrder: ReadingStatus[] = ['READING', 'ON_HOLD', 'COMPLETED', 'PLANNED', 'DROPPED'];

const statusIcons: Record<ReadingStatus, React.ReactNode> = {
  READING: <ReadOutlined />,
  ON_HOLD: <PauseCircleOutlined />,
  COMPLETED: <CheckCircleOutlined />,
  PLANNED: <ClockCircleOutlined />,
  DROPPED: <StopOutlined />
};

const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

/** `2026-08` → `Авг`; январь подписывается годом, иначе на шкале в два года не за что зацепиться. */
const monthLabel = (period: string) => {
  const [year, month] = period.split('-');
  const index = Number(month) - 1;
  return index === 0 ? year : MONTH_LABELS[index] ?? period;
};

const number = (value: number) => value.toLocaleString('ru-RU');

/** «—» вместо нуля: пустой темп и темп «ноль страниц в день» — разные утверждения. */
const decimal = (value?: number) => (value == null ? '—' : value.toLocaleString('ru-RU'));

export const AnalyticsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const styles = useAnalyticsPageStyles();
  const { data, loading, error, reading, readingLoading, readingError, currentUserId } = useAppSelector(
    (state) => state.analytics
  );
  const { list: users, loaded: usersLoaded, loading: usersLoading } = useAppSelector((state) => state.users);
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = isAdminLike(user?.role);

  useEffect(() => {
    dispatch(loadBookAnalytics(currentUserId));
    dispatch(loadReadingAnalytics(currentUserId));
  }, [dispatch, currentUserId]);

  useEffect(() => {
    if (isAdmin && !usersLoaded && !usersLoading) {
      dispatch(loadUsers());
    }
  }, [dispatch, isAdmin, usersLoaded, usersLoading]);

  const total = data?.totalItems ?? 0;
  const statusCount = (status: ReadingStatus) => data?.statusBreakdown?.[status] ?? 0;
  const isEmpty = !loading && (!data || total === 0);
  const readingSkeleton = readingLoading && !reading;

  const monthColumns = useMemo(
    () =>
      (reading?.byMonth ?? []).map((month) => ({
        key: month.period,
        label: monthLabel(month.period),
        value: month.finished,
        tooltip: `${month.period}: ${pluralize(month.finished, ['запись', 'записи', 'записей'])}, ${pluralize(
          month.pages,
          ['страница', 'страницы', 'страниц']
        )}, ${pluralize(month.minutes, ['минута', 'минуты', 'минут'])}`
      })),
    [reading]
  );

  const yearColumns = useMemo(
    () =>
      (reading?.byYear ?? []).map((year) => ({
        key: year.period,
        label: year.period,
        value: year.finished,
        tooltip: `${year.period}: ${pluralize(year.finished, ['запись', 'записи', 'записей'])}, ${pluralize(
          year.pages,
          ['страница', 'страницы', 'страниц']
        )}`
      })),
    [reading]
  );

  /** Дельта к прошлому году. Пусто, если прошлого года просто не было, — тогда сравнивать не с чем. */
  const yearDelta = (pick: (stats: PeriodStats) => number) => {
    if (!reading) return null;
    const now = pick(reading.currentYear);
    const before = pick(reading.previousYear);
    if (before === 0) return null;
    const percent = Math.round(((now - before) / before) * 100);
    return { percent, positive: percent >= 0 };
  };

  const scopeLabel = currentUserId
    ? `Статистика пользователя ${users.find((u) => u.id === currentUserId)?.username ?? ''}`.trim()
    : isAdmin
      ? 'Сводная статистика по всем пользователям'
      : 'Статистика по вашей коллекции';

  return (
    <div style={styles.page}>
      <PageHeader
        title="Аналитика"
        subtitle={scopeLabel}
        actions={
          isAdmin && (
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Все пользователи"
              style={{ minWidth: 220 }}
              size="large"
              loading={usersLoading}
              value={currentUserId}
              onChange={(value?: string) => dispatch(analyticsActions.setTargetUser(value))}
              options={users.map((u) => ({ label: u.username, value: u.id }))}
            />
          )
        }
      />

      {error && <Alert type="error" showIcon message="Не удалось загрузить аналитику" description={error} style={styles.alert} />}

      <div style={styles.stats}>
        <StatTile label="Всего книг" value={total} icon={<BookOutlined />} loading={loading && !data} />
        {statusOrder.map((status) => (
          <StatTile
            key={status}
            label={statusMeta[status].label}
            value={statusCount(status)}
            hint={total ? `${Math.round((statusCount(status) / total) * 100)}%` : undefined}
            icon={statusIcons[status]}
            accent={token[statusMeta[status].token]}
            loading={loading && !data}
          />
        ))}
        <StatTile
          label="Избранное"
          value={data?.favoriteItems ?? 0}
          hint={data?.averageRating ? `средняя оценка ${data.averageRating.toFixed(1)}` : 'оценок пока нет'}
          icon={<StarOutlined />}
          accent={token.colorWarning}
          loading={loading && !data}
        />
      </div>

      {isEmpty ? (
        <Card style={styles.card} styles={{ body: styles.emptyBody }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text strong>Пока нечего показывать</Typography.Text>
                <Typography.Text type="secondary">
                  Добавьте книги в библиотеку — статистика соберётся автоматически.
                </Typography.Text>
              </Space>
            }
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card title="Распределение по статусам" style={styles.card} styles={{ body: styles.cardBody }}>
              {loading && !data ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : (
                <BarList
                  total={total}
                  items={statusOrder.map((status) => ({
                    key: status,
                    label: statusMeta[status].label,
                    value: statusCount(status),
                    color: token[statusMeta[status].token]
                  }))}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Популярные типы" style={styles.card} styles={{ body: styles.cardBody }}>
              {loading && !data ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : (
                <BarList
                  total={total}
                  emptyText="Типы ещё не добавлены"
                  items={(data?.topTypes ?? []).map((type) => ({
                    key: type.typeId,
                    label: type.typeName,
                    value: type.count,
                    color: token.colorPrimary
                  }))}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Популярные источники" style={styles.card} styles={{ body: styles.cardBody }}>
              {loading && !data ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : (
                <BarList
                  total={total}
                  emptyText="Источники ещё не добавлены"
                  items={(data?.topSources ?? []).map((source) => ({
                    key: source.sourceId,
                    label: source.sourceName,
                    value: source.count,
                    color: token.colorInfo
                  }))}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {!isEmpty && (
        <>
          {readingError && (
            <Alert
              type="warning"
              showIcon
              message="Не удалось загрузить динамику чтения"
              description={readingError}
              style={{ ...styles.alert, marginTop: 16 }}
            />
          )}

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={16}>
              <Card title="Дочитано по месяцам" style={styles.card} styles={{ body: styles.cardBody }}>
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <ColumnChart
                    items={monthColumns}
                    labelEvery={3}
                    emptyText="За два года ничего не дочитано"
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="Дочитано по годам" style={styles.card} styles={{ body: styles.cardBody }}>
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <ColumnChart items={yearColumns} color={token.colorInfo} emptyText="История ещё не набралась" />
                )}
              </Card>
            </Col>

            <Col xs={24}>
              <Card
                title="Календарь активности"
                extra={
                  <Typography.Text type="secondary">
                    {reading ? pluralize(reading.heatmap.length, ['день', 'дня', 'дней']) + ' с чтением' : null}
                  </Typography.Text>
                }
                style={styles.card}
                styles={{ body: styles.cardBody }}
              >
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : (
                  <ActivityHeatmap days={reading?.heatmap ?? []} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                title="Темп чтения"
                extra={
                  reading && (
                    <Typography.Text type="secondary">
                      за {pluralize(reading.pace.windowDays, ['день', 'дня', 'дней'])}
                    </Typography.Text>
                  )
                }
                style={styles.card}
                styles={{ body: styles.cardBody }}
              >
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : (
                  <>
                    <Space size={12} wrap>
                      <StatTile label="Страниц в день чтения" value={decimal(reading?.pace.pagesPerDay)} />
                      <StatTile label="Минут в день чтения" value={decimal(reading?.pace.minutesPerDay)} />
                      <StatTile label="Страниц в час" value={decimal(reading?.pace.pagesPerHour)} />
                      <StatTile
                        label="Дней с чтением"
                        value={number(reading?.pace.activeDays ?? 0)}
                        icon={<ClockCircleOutlined />}
                      />
                    </Space>
                    {/* Оговорка обязательна: темп делится на дни с чтением, и без неё «60 страниц
                        в день» читается как обещание, которого никто не давал. */}
                    <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                      Темп считается по дням, в которые вы читали, а не по всем дням окна.
                    </Typography.Paragraph>
                  </>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="Когда дочитаете" style={styles.card} styles={{ body: styles.cardBody }}>
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : (reading?.forecasts.length ?? 0) === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Нечего прогнозировать: у книг в чтении не заполнен прогресс"
                  />
                ) : (
                  <List
                    size="small"
                    dataSource={reading?.forecasts ?? []}
                    renderItem={(forecast) => (
                      <List.Item
                        extra={
                          forecast.expectedFinish ? (
                            <Typography.Text strong>{formatDate(forecast.expectedFinish)}</Typography.Text>
                          ) : (
                            <Typography.Text type="secondary">темпа пока нет</Typography.Text>
                          )
                        }
                      >
                        <List.Item.Meta
                          title={forecast.title}
                          description={`осталось ${forecast.remaining} ${
                            forecast.unit ? progressUnitGenitive[forecast.unit] : ''
                          }`.trim()}
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="Любимые авторы" style={styles.card} styles={{ body: styles.cardBody }}>
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <BarList
                    emptyText="Авторы ещё не проставлены"
                    items={(reading?.byAuthor ?? []).map((author) => ({
                      key: author.authorId,
                      label: author.authorName,
                      value: author.count
                    }))}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="Языки изданий" style={styles.card} styles={{ body: styles.cardBody }}>
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <BarList
                    emptyText="Язык нигде не указан"
                    items={(reading?.byLanguage ?? []).map((language) => ({
                      key: language.label,
                      label: language.label,
                      value: language.count,
                      color: token.colorSuccess
                    }))}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="Десятилетия" style={styles.card} styles={{ body: styles.cardBody }}>
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <BarList
                    emptyText="Год издания нигде не указан"
                    items={(reading?.byDecade ?? []).map((decade) => ({
                      key: decade.label,
                      label: decade.label,
                      value: decade.count,
                      color: token.colorInfo
                    }))}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="Куплено и прочитано" style={styles.card} styles={{ body: styles.cardBody }}>
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : (
                  <>
                    <Space size={12} wrap>
                      <StatTile
                        label="Куплено"
                        value={number(reading?.purchases.purchased ?? 0)}
                        icon={<ShoppingOutlined />}
                      />
                      <StatTile
                        label="Из них прочитано"
                        value={number(reading?.purchases.finishedOfPurchased ?? 0)}
                        hint={
                          reading && reading.purchases.purchased > 0
                            ? `${Math.round(
                                (reading.purchases.finishedOfPurchased / reading.purchases.purchased) * 100
                              )}%`
                            : undefined
                        }
                        accent={token.colorSuccess}
                      />
                      <StatTile
                        label="Ещё не начато"
                        value={number(reading?.purchases.unreadPurchased ?? 0)}
                        accent={token.colorWarning}
                      />
                    </Space>
                    <div style={{ marginTop: 12 }}>
                      {Object.entries(reading?.purchases.spentByCurrency ?? {}).length === 0 ? (
                        <Typography.Text type="secondary">Цены нигде не проставлены</Typography.Text>
                      ) : (
                        <Space size={8} wrap>
                          <Typography.Text type="secondary">Потрачено:</Typography.Text>
                          {/* По валютам, а не одной суммой: курса в трекере нет, и складывать
                              рубли с евро значило бы его придумать. */}
                          {Object.entries(reading?.purchases.spentByCurrency ?? {}).map(([currency, amount]) => (
                            <Tag key={currency}>
                              {number(amount)} {currency}
                            </Tag>
                          ))}
                        </Space>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="Год к году" style={styles.card} styles={{ body: styles.cardBody }}>
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : !reading ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Данных пока нет" />
                ) : (
                  <Space size={12} wrap>
                    {(
                      [
                        ['Дочитано', (stats: PeriodStats) => stats.finished],
                        ['Страниц', (stats: PeriodStats) => stats.pages],
                        ['Минут', (stats: PeriodStats) => stats.minutes]
                      ] as const
                    ).map(([label, pick]) => {
                      const delta = yearDelta(pick);
                      return (
                        <StatTile
                          key={label}
                          label={`${label} · ${reading.currentYear.period}`}
                          value={number(pick(reading.currentYear))}
                          hint={
                            delta
                              ? `${delta.positive ? '+' : ''}${delta.percent}% к ${reading.previousYear.period}`
                              : `в ${reading.previousYear.period} — ${number(pick(reading.previousYear))}`
                          }
                          accent={delta && !delta.positive ? token.colorWarning : token.colorSuccess}
                        />
                      );
                    })}
                  </Space>
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};
