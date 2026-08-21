import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Card,
  Col,
  Empty,
  Grid,
  List,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme
} from 'antd';
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
import type { BarListItem } from '@/shared/ui/BarList';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { setFilters } from '@/features/book/set-book-filters';
import { analyticsActions, loadBookAnalytics, loadReadingAnalytics } from '@/entities/analytics';
import { loadUsers } from '@/entities/user';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { statusMeta } from '@/shared/constants/status';
import { MediaKind, PeriodStats, ReadingStatus } from '@/shared/types/library';
import { isAdminLike } from '@/shared/lib/roles';
import { BarList } from '@/shared/ui/BarList';
import { SpineStrip, type SpineShare } from '@/shared/ui/SpineStrip';
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

type DynamicsScale = 'months' | 'years';

type BreakdownKey = 'authors' | 'languages' | 'decades' | 'types' | 'sources';

/** Больше шести строк — это уже справочник, а не «что в библиотеке»: карточка перестаёт читаться. */
const BREAKDOWN_LIMIT = 6;

/**
 * Подписываются только январь и июль: двадцать четыре подписи подряд не помещаются, а январь
 * с годом — единственное место, где видно границу лет. Прореживание «каждый третий» её теряло.
 */
const monthLabel = (period: string): string | undefined => {
  const [year, month] = period.split('-');
  const index = Number(month) - 1;
  if (index === 0) return year;
  if (index === 6) return MONTH_LABELS[index];
  return undefined;
};

const number = (value: number) => value.toLocaleString('ru-RU');

/**
 * Карточка раздела. Управление (переключатель, подпись) на широком экране стоит в шапке справа,
 * а на узком уезжает в тело: в одну строку с заголовком оно там не помещается, и заголовок
 * обрезался многоточием — «Календарь активн…».
 */
const SectionCard: React.FC<{
  title: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, controls, children }) => {
  const screens = Grid.useBreakpoint();
  const styles = useAnalyticsPageStyles();
  const inline = Boolean(screens.md);

  return (
    <Card
      title={title}
      extra={inline ? controls : undefined}
      style={styles.card}
      styles={{ body: styles.cardBody }}
    >
      {!inline && controls && <div style={styles.controls}>{controls}</div>}
      {children}
    </Card>
  );
};

/** «—» вместо нуля: пустой темп и темп «ноль страниц в день» — разные утверждения. */
const decimal = (value?: number) => (value == null ? '—' : value.toLocaleString('ru-RU'));

export const AnalyticsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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

  /** Виды в порядке убывания доли: широкие корешки слева, как на полке. */
  const kindShares = useMemo<SpineShare[]>(
    () =>
      Object.entries(data?.kindBreakdown ?? {})
        .map(([kind, count]) => ({ kind: kind as MediaKind, count: count ?? 0 }))
        .filter((share) => share.count > 0)
        .sort((a, b) => b.count - a.count),
    [data?.kindBreakdown]
  );

  /** Разрез ведёт в библиотеку: у среза аналитики должен быть выход к самим записям. */
  const openKind = (kind: MediaKind) => {
    dispatch(setFilters({ kind, page: 0 }));
    navigate('/');
  };
  const isEmpty = !loading && (!data || total === 0);
  const readingSkeleton = readingLoading && !reading;

  const [dynamicsScale, setDynamicsScale] = useState<DynamicsScale>('months');
  const [breakdown, setBreakdown] = useState<BreakdownKey>('authors');

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

  /**
   * Сравнение с прошлым годом. Сервер отдаёт оба отрезка «с 1 января по этот день», поэтому цифры
   * сопоставимы; дельта не считается, если год назад в этот момент ещё ничего не было.
   */
  const yearComparison = useMemo(() => {
    const metrics: Array<{ label: string; pick: (stats: PeriodStats) => number }> = [
      { label: 'книг', pick: (stats) => stats.finished },
      { label: 'страниц', pick: (stats) => stats.pages },
      { label: 'минут', pick: (stats) => stats.minutes }
    ];

    return metrics.map(({ label, pick }) => {
      const current = reading ? pick(reading.currentYear) : 0;
      const before = reading ? pick(reading.previousYear) : 0;
      const percent = before === 0 ? null : Math.round(((current - before) / before) * 100);
      return {
        label,
        current,
        delta: percent === null ? null : { percent, positive: percent >= 0 }
      };
    });
  }, [reading]);

  /**
   * Все разбивки живут в одной карточке с переключателем: по отдельности это пять почти
   * одинаковых списков подряд, и страница из них состояла больше, чем из графиков.
   */
  const breakdowns = useMemo<Record<BreakdownKey, { label: string; items: BarListItem[] }>>(
    () => ({
      authors: {
        label: 'Авторы',
        items: (reading?.byAuthor ?? []).map((author) => ({
          key: author.authorId,
          label: author.authorName,
          value: author.count
        }))
      },
      languages: {
        label: 'Языки',
        items: (reading?.byLanguage ?? []).map((language) => ({
          key: language.label,
          label: language.label,
          value: language.count,
          color: token.colorSuccess
        }))
      },
      decades: {
        label: 'Десятилетия',
        items: (reading?.byDecade ?? []).map((decade) => ({
          key: decade.label,
          label: decade.label,
          value: decade.count,
          color: token.colorInfo
        }))
      },
      types: {
        label: 'Типы',
        items: (data?.topTypes ?? []).map((type) => ({
          key: type.typeId,
          label: type.typeName,
          value: type.count
        }))
      },
      sources: {
        label: 'Источники',
        items: (data?.topSources ?? []).map((source) => ({
          key: source.sourceId,
          label: source.sourceName,
          value: source.count,
          color: token.colorInfo
        }))
      }
    }),
    [reading, data, token]
  );

  // Пустая вкладка — это пустая карточка с картинкой «нет данных»: справочники заполнены не у всех,
  // и показывать их незаполненность отдельным блоком незачем.
  const breakdownOptions = useMemo(
    () =>
      (Object.keys(breakdowns) as BreakdownKey[])
        .filter((key) => breakdowns[key].items.length > 0)
        .map((key) => ({ label: breakdowns[key].label, value: key })),
    [breakdowns]
  );

  useEffect(() => {
    if (breakdownOptions.length > 0 && !breakdownOptions.some((option) => option.value === breakdown)) {
      setBreakdown(breakdownOptions[0].value);
    }
  }, [breakdownOptions, breakdown]);

  const breakdownAll = breakdowns[breakdown]?.items ?? [];
  const breakdownItems = breakdownAll.slice(0, BREAKDOWN_LIMIT);
  const breakdownHidden = breakdownAll.length - breakdownItems.length;

  const scopeLabel = currentUserId
    ? `Статистика пользователя ${users.find((u) => u.id === currentUserId)?.username ?? ''}`.trim()
    : isAdmin
      ? 'Сводная статистика по всем пользователям'
      : 'Статистика по вашей коллекции';

  return (
    <div>
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
            accent={statusMeta[status].accent}
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
        <>
          {readingError && (
            <Alert
              type="warning"
              showIcon
              message="Не удалось загрузить динамику чтения"
              description={readingError}
              style={styles.alert}
            />
          )}

          <Row gutter={[16, 16]}>
            <Col xs={24}>
              <SectionCard
                title="Динамика чтения"
                controls={
                  <Segmented
                    size="small"
                    value={dynamicsScale}
                    onChange={(value) => setDynamicsScale(value as DynamicsScale)}
                    options={[
                      { label: 'Месяцы', value: 'months' },
                      { label: 'Годы', value: 'years' }
                    ]}
                  />
                }
              >
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <>
                    <ColumnChart
                      items={dynamicsScale === 'months' ? monthColumns : yearColumns}
                      emptyText="Дочитанного за этот период пока нет"
                    />
                    {reading && (
                      <div style={styles.footnote}>
                        <Typography.Text type="secondary">
                          {reading.currentYear.period} против {reading.previousYear.period} за тот же
                          отрезок года:
                        </Typography.Text>
                        {yearComparison.map((metric) => (
                          <Typography.Text key={metric.label}>
                            {metric.label}{' '}
                            <Typography.Text strong>{number(metric.current)}</Typography.Text>
                            {metric.delta && (
                              <Typography.Text type={metric.delta.positive ? 'success' : 'warning'}>
                                {' '}
                                {metric.delta.positive ? '+' : ''}
                                {metric.delta.percent}%
                              </Typography.Text>
                            )}
                          </Typography.Text>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </SectionCard>
            </Col>

            <Col xs={24}>
              <SectionCard
                title="Календарь активности"
                controls={
                  reading && (
                    <Typography.Text type="secondary">
                      {pluralize(reading.heatmap.length, ['день', 'дня', 'дней'])} с чтением за год
                    </Typography.Text>
                  )
                }
              >
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : (
                  <ActivityHeatmap days={reading?.heatmap ?? []} />
                )}
              </SectionCard>
            </Col>

            <Col xs={24}>
              <SectionCard
                title="Темп и прогноз"
                controls={
                  reading && (
                    <Typography.Text type="secondary">
                      за {pluralize(reading.pace.windowDays, ['день', 'дня', 'дней'])}
                    </Typography.Text>
                  )
                }
              >
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : (
                  <Row gutter={[24, 16]}>
                    <Col xs={24} lg={11}>
                      <Space size={12} wrap>
                        <StatTile label="Страниц в день" value={decimal(reading?.pace.pagesPerDay)} />
                        <StatTile label="Минут в день" value={decimal(reading?.pace.minutesPerDay)} />
                        <StatTile label="Страниц в час" value={decimal(reading?.pace.pagesPerHour)} />
                      </Space>
                      {/* Оговорка обязательна: темп делится на дни с чтением, и без неё «60 страниц
                          в день» читается как обещание, которого никто не давал. */}
                      <Typography.Paragraph type="secondary" style={styles.hint}>
                        Считается по {pluralize(reading?.pace.activeDays ?? 0, ['дню', 'дням', 'дням'])} с
                        чтением, а не по всем дням окна.
                      </Typography.Paragraph>
                    </Col>

                    <Col xs={24} lg={13}>
                      {(reading?.forecasts.length ?? 0) === 0 ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Нечего прогнозировать: у книг в чтении не заполнен прогресс"
                        />
                      ) : (
                        <List
                          size="small"
                          header={<Typography.Text type="secondary">Когда дочитаете</Typography.Text>}
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
                    </Col>
                  </Row>
                )}
              </SectionCard>
            </Col>

            <Col xs={24} lg={14}>
              <SectionCard
                title="Что в библиотеке"
                controls={
                  breakdownOptions.length > 1 && (
                    <Segmented
                      size="small"
                      value={breakdown}
                      onChange={(value) => setBreakdown(value as BreakdownKey)}
                      options={breakdownOptions}
                    />
                  )
                }
              >
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 5 }} />
                ) : (
                  <>
                    {/* Корешковая полоса: доли видов произведения одной строкой. Она же —
                        фирменный приём, и нажатие на корешок открывает этот вид в библиотеке. */}
                    {kindShares.length > 0 && (
                      <div style={styles.spineStrip}>
                        <SpineStrip shares={kindShares} onSelect={openKind} />
                      </div>
                    )}
                    {/* База процентов — вся библиотека, а не лидер списка: иначе первый автор
                        всегда «100%», и две разные величины выглядят одинаково. */}
                    <BarList total={total} items={breakdownItems} emptyText="Данных для разбивки пока нет" />
                    {breakdownHidden > 0 && (
                      <Typography.Paragraph type="secondary" style={styles.hint}>
                        и ещё {breakdownHidden} — хвост длинного списка ничего не добавляет к картине
                      </Typography.Paragraph>
                    )}
                  </>
                )}
              </SectionCard>
            </Col>

            <Col xs={24} lg={10}>
              <SectionCard title="Куплено и прочитано">
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
                        label="Прочитано"
                        value={number(reading?.purchases.finishedOfPurchased ?? 0)}
                        hint={
                          reading && reading.purchases.purchased > 0
                            ? `${Math.round(
                                (reading.purchases.finishedOfPurchased / reading.purchases.purchased) * 100
                              )}% покупок`
                            : undefined
                        }
                        accent={token.colorSuccess}
                      />
                      <StatTile
                        label="Не начато"
                        value={number(reading?.purchases.unreadPurchased ?? 0)}
                        accent={token.colorWarning}
                      />
                    </Space>
                    <div style={styles.hint}>
                      {Object.keys(reading?.purchases.spentByCurrency ?? {}).length === 0 ? (
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
              </SectionCard>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};
