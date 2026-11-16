import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Card,
  Col,
  Empty,
  Grid,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { applySavedFilter } from '@/features/book/set-book-filters';
import { analyticsActions, loadBookAnalytics, loadReadingAnalytics } from '@/entities/analytics';
import { loadUsers } from '@/entities/user';
import { PageHeader } from '@/shared/ui/PageHeader';
import { MetricList } from '@/shared/ui/MetricList';
import { MediaKind, PeriodStats, SavedFilter } from '@/shared/types/library';
import { isAdminLike } from '@/shared/lib/roles';
import { BarList, type BarListItem } from '@/shared/ui/BarList';
import { SpineStrip, type SpineShare } from '@/shared/ui/SpineStrip';
import { ActivityHeatmap } from '@/shared/ui/ActivityHeatmap';
import { ColumnChart, type ColumnChartItem } from '@/shared/ui/ColumnChart';
import { formatDate } from '@/shared/lib/date';
import { formatNumber, formatScore } from '@/shared/lib/format';
import { pluralize } from '@/shared/lib/plural';
import { readingSummaryPhrase } from '@/shared/lib/phrases';
import { progressUnitGenitive } from '@/shared/constants/format';
import { useAnalyticsPageStyles } from './AnalyticsPage.styles';

const MONTH_LABELS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/**
 * Отрезок отчёта. Сервер отдаёт два года помесячно и все годы целиком, поэтому отрезки считаются
 * здесь, а не запросом на каждое переключение.
 */
type PeriodKey = 'year' | 'half' | 'all' | 'compare';

const PERIOD_OPTIONS: Array<{ label: string; value: PeriodKey }> = [
  { label: 'Год', value: 'year' },
  { label: 'Полгода', value: 'half' },
  { label: 'Всё время', value: 'all' },
  { label: 'Сравнить годы', value: 'compare' }
];

const HALF_YEAR = 6;

const MONTHS_IN_YEAR = 12;

/** Больше шести строк — это уже справочник, а не разрез: карточка перестаёт читаться. */
const BREAKDOWN_LIMIT = 6;

/**
 * Январь подписывается годом: на полугодии отрезок переходит через границу лет, и без этой
 * подписи «янв» стоит там же, где «дек», без всякого признака, что год сменился.
 */
const monthLabel = (period: string): string => {
  const [year, month] = period.split('-');
  const index = Number(month) - 1;
  return index === 0 ? year : MONTH_LABELS[index];
};

/** «—» вместо нуля: пустой темп и темп «ноль страниц в день» — разные утверждения. */
const decimal = (value?: number) => (value == null ? '—' : value.toLocaleString('ru-RU'));

const empty: PeriodStats = { period: '', finished: 0, pages: 0, minutes: 0 };

const sum = (rows: PeriodStats[]): PeriodStats =>
  rows.reduce(
    (acc, row) => ({
      period: '',
      finished: acc.finished + row.finished,
      pages: acc.pages + row.pages,
      minutes: acc.minutes + row.minutes
    }),
    empty
  );

/**
 * Прирост к сопоставимому отрезку. Ничего не считается, когда сравнивать не с чем: год назад
 * в этот момент могло не быть ни одной записи, и «+100%» от нуля — не факт, а деление на ноль.
 */
const growth = (current: number, before?: number) => {
  if (before === undefined || before === 0) return null;
  return Math.round(((current - before) / before) * 100);
};

/**
 * Числа во фразе набираются полужирным: вывод читается взглядом по числам, а сплошной абзац
 * в 20 пунктов взгляду не за что зацепить. Разряды приходят из `formatNumber` неразрывным
 * пробелом, дробная часть — запятой: и то и другое остаётся внутри числа, а точка в конце
 * предложения — уже нет.
 */
const emphasizeNumbers = (text: string): React.ReactNode[] =>
  text
    .split(/(\d+(?:[\u00A0\u202F ]\d{3})*(?:,\d+)?%?)/)
    .filter((part) => part !== '')
    .map((part, index) =>
      /^\d/.test(part) ? (
        <strong key={index}>{part}</strong>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      )
    );

/**
 * Карточка раздела. Управление (переключатель, подпись) на широком экране стоит в шапке справа,
 * а на узком уезжает в тело: в одну строку с заголовком оно там не помещается, и заголовок
 * обрезался многоточием — «Календарь активн…».
 */
const SectionCard: React.FC<{
  title: string;
  controls?: React.ReactNode;
  /** Тянуться ли до высоты соседа по ряду: разрезы выравниваются, календарь с темпом — нет. */
  stretch?: boolean;
  children: React.ReactNode;
}> = ({ title, controls, stretch = true, children }) => {
  const screens = Grid.useBreakpoint();
  const styles = useAnalyticsPageStyles();
  const inline = Boolean(screens.md);

  return (
    <Card
      title={title}
      extra={inline ? controls : undefined}
      style={stretch ? styles.card : { ...styles.card, height: 'auto' }}
      styles={{ body: styles.cardBody }}
    >
      {!inline && controls && <div style={styles.controls}>{controls}</div>}
      {children}
    </Card>
  );
};

/** Разрез коллекции: полосы плюс выход к самим записям, если такой фильтр в библиотеке есть. */
interface Cut {
  key: string;
  title: string;
  items: BarListItem[];
  /**
   * Считать ли доли от всей библиотеки. Типы, языки, десятилетия и источники её делят — там
   * процент осмыслен. Авторы её не делят: у одного автора в собрании из сотен записей выходит
   * пара процентов, все полосы схлопываются в точку, и сравнить лидера со вторым уже нельзя.
   */
  relative?: boolean;
  filter?: (item: BarListItem) => SavedFilter;
}

export const AnalyticsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const styles = useAnalyticsPageStyles();
  const screens = Grid.useBreakpoint();
  const { data, loading, error, reading, readingLoading, readingError, currentUserId } = useAppSelector(
    (state) => state.analytics
  );
  const { list: users, loaded: usersLoaded, loading: usersLoading } = useAppSelector((state) => state.users);
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = isAdminLike(user?.role);

  const [period, setPeriod] = useState<PeriodKey>('year');

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
  const isEmpty = !loading && (!data || total === 0);
  const readingSkeleton = readingLoading && !reading;

  /** Разрез ведёт в библиотеку: у среза аналитики должен быть выход к самим записям. */
  const openLibrary = (filter: SavedFilter) => {
    dispatch(applySavedFilter(filter));
    navigate('/');
  };

  /**
   * Отчёт за выбранный отрезок: итог, с чем он сравнивается и что показывают столбцы.
   *
   * «Год» и «Сравнить годы» берут итог с сервера — тот считает оба отрезка «с 1 января по этот
   * день», и только так числа сопоставимы. Полугодие складывается из помесячных сумм, и ему
   * достаётся сравнение с теми же шестью месяцами год назад из того же окна в два года.
   */
  const report = useMemo(() => {
    if (!reading) return undefined;

    const currentYear = reading.currentYear.period;
    const previousYear = reading.previousYear.period;
    const months = reading.byMonth.filter((month) => month.period.startsWith(`${currentYear}-`));
    const previousMonths = new Map(
      reading.byMonth
        .filter((month) => month.period.startsWith(`${previousYear}-`))
        .map((month) => [month.period.slice(5), month])
    );

    const monthTooltip = (month: PeriodStats) =>
      `${month.period}: ${pluralize(month.finished, ['запись', 'записи', 'записей'])}, ${pluralize(
        month.pages,
        ['страница', 'страницы', 'страниц']
      )}, ${pluralize(month.minutes, ['минута', 'минуты', 'минут'])}`;

    const monthColumn = (month: PeriodStats): ColumnChartItem => ({
      key: month.period,
      label: monthLabel(month.period),
      value: month.finished,
      tooltip: monthTooltip(month)
    });

    if (period === 'all') {
      return {
        scope: 'За всё время',
        comparedTo: undefined,
        totals: sum(reading.byYear),
        previous: undefined,
        paired: false,
        columns: reading.byYear.map((year) => ({
          key: year.period,
          label: year.period,
          value: year.finished,
          tooltip: `${year.period}: ${pluralize(year.finished, ['запись', 'записи', 'записей'])}, ${pluralize(
            year.pages,
            ['страница', 'страницы', 'страниц']
          )}`
        }))
      };
    }

    if (period === 'half') {
      const last = reading.byMonth.slice(-HALF_YEAR);
      // Те же месяцы год назад: окно в два года на это и рассчитано. Если их в окне нет,
      // сравнения не будет — приписывать полугодию прошлогодний итог целиком нельзя.
      const before = reading.byMonth.slice(-HALF_YEAR - MONTHS_IN_YEAR, -MONTHS_IN_YEAR);

      return {
        scope: 'За последние полгода',
        comparedTo: 'за те же месяцы год назад',
        totals: sum(last),
        previous: before.length === HALF_YEAR ? sum(before) : undefined,
        paired: false,
        columns: last.map(monthColumn)
      };
    }

    const paired = period === 'compare';

    return {
      scope: `За ${currentYear} год`,
      comparedTo: 'за тот же отрезок прошлого года',
      totals: reading.currentYear,
      previous: reading.previousYear,
      paired,
      columns: months.map((month) => {
        const before = previousMonths.get(month.period.slice(5));
        return {
          ...monthColumn(month),
          compare: paired ? (before?.finished ?? 0) : undefined,
          tooltip: paired ? (
            <>
              {monthTooltip(month)}
              <br />
              {before ? monthTooltip(before) : `${previousYear}: данных нет`}
            </>
          ) : (
            monthTooltip(month)
          )
        };
      })
    };
  }, [reading, period]);

  /**
   * Пять чисел под фразой. Три первых — за выбранный отрезок и с приростом, два последних —
   * по всей библиотеке: оценка и брошенное не делятся по годам, и подпись об этом говорит,
   * чтобы их не читали как итог периода.
   */
  const numbers = useMemo(() => {
    const totals = report?.totals ?? empty;
    const previous = report?.previous;
    const hours = Math.round(totals.minutes / 60);

    const delta = (current: number, before?: number) => {
      const percent = growth(current, before);
      if (percent === null) return undefined;
      return {
        text: `${percent >= 0 ? '+' : ''}${percent}%`,
        color: percent >= 0 ? token.colorSuccess : token.colorWarning
      };
    };

    return [
      { key: 'finished', label: 'Дочитано', value: formatNumber(totals.finished), delta: delta(totals.finished, previous?.finished) },
      { key: 'pages', label: 'Страниц', value: formatNumber(totals.pages), delta: delta(totals.pages, previous?.pages) },
      {
        key: 'hours',
        label: 'Часов аудио',
        value: formatNumber(hours),
        delta: delta(totals.minutes, previous?.minutes)
      },
      {
        key: 'rating',
        label: 'Средняя оценка',
        value: formatScore(data?.averageRating) ?? '—',
        note: 'по библиотеке'
      },
      {
        key: 'dropped',
        label: 'Брошено',
        value: formatNumber(data?.statusBreakdown?.DROPPED ?? 0),
        note: 'за всё время'
      }
    ];
  }, [report, data, token]);

  const phrase = useMemo(
    () =>
      report
        ? readingSummaryPhrase({
            scope: report.scope,
            finished: report.totals.finished,
            pages: report.totals.pages,
            minutes: report.totals.minutes,
            averageRating: data?.averageRating,
            finishedDelta: growth(report.totals.finished, report.previous?.finished),
            comparedTo: report.comparedTo
          })
        : undefined,
    [report, data]
  );

  /** Виды в порядке убывания доли: широкие корешки слева, как на полке. */
  const kindShares = useMemo<SpineShare[]>(
    () =>
      Object.entries(data?.kindBreakdown ?? {})
        .map(([kind, count]) => ({ kind: kind as MediaKind, count: count ?? 0 }))
        .filter((share) => share.count > 0)
        .sort((a, b) => b.count - a.count),
    [data?.kindBreakdown]
  );

  /**
   * Разрезы стоят рядом карточками, а не прячутся друг за другом в переключателе: сравнивать
   * авторов с типами приходится взглядом, а не по памяти. Пустой справочник карточку не получает.
   */
  const cuts = useMemo<Cut[]>(() => {
    const all: Cut[] = [
      {
        key: 'authors',
        title: 'Авторы',
        items: (reading?.byAuthor ?? []).map((author) => ({
          key: author.authorId,
          label: author.authorName,
          value: author.count
        })),
        filter: (item) => ({ authorId: item.key })
      },
      {
        key: 'types',
        title: 'Типы',
        items: (data?.topTypes ?? []).map((type) => ({
          key: type.typeId,
          label: type.typeName,
          value: type.count
        })),
        relative: true,
        filter: (item) => ({ typeId: item.key })
      },
      {
        key: 'decades',
        title: 'Десятилетия',
        items: (reading?.byDecade ?? []).map((decade) => ({
          key: decade.label,
          label: decade.label,
          value: decade.count,
          color: token.colorInfo
        })),
        relative: true
      },
      {
        key: 'languages',
        title: 'Языки',
        items: (reading?.byLanguage ?? []).map((language) => ({
          key: language.label,
          label: language.label,
          value: language.count,
          color: token.colorSuccess
        })),
        relative: true
      },
      {
        key: 'sources',
        title: 'Источники',
        items: (data?.topSources ?? []).map((source) => ({
          key: source.sourceId,
          label: source.sourceName,
          value: source.count,
          color: token.colorInfo
        })),
        relative: true
      }
    ];

    return all.filter((cut) => cut.items.length > 0);
  }, [reading, data, token]);

  /**
   * Чем год закончится, если ничего не менять. Вывод карточки темпа: список ниже отвечает
   * «когда дочитаю эту книгу», а здесь — «сколько их будет к декабрю».
   */
  const projection = useMemo(() => {
    const finished = reading?.currentYear.finished ?? 0;
    if (finished === 0) return undefined;

    const today = new Date();
    const dayOfYear =
      Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86_400_000) + 1;
    // В первые дни января любой темп даёт трёхзначный прогноз: пары записей мало, чтобы
    // говорить о годе.
    if (dayOfYear < 30) return undefined;

    return Math.round((finished / dayOfYear) * 365);
  }, [reading]);

  const scopeLabel = currentUserId
    ? `Статистика пользователя ${users.find((u) => u.id === currentUserId)?.username ?? ''}`.trim()
    : isAdmin
      ? 'Сводная статистика по всем пользователям'
      : 'Статистика по вашей коллекции';

  const periodSwitch = (
    <Segmented value={period} onChange={(value) => setPeriod(value as PeriodKey)} options={PERIOD_OPTIONS} />
  );

  /*
   * На телефоне переключатель периода стоит своей строкой под заголовком, а не в его действиях:
   * четыре подписи вместе со «Сравнить годы» занимают 331 пиксель, не сжимаются и не переносятся,
   * и рядом с заголовком уносили за собой всю страницу. Строка прокручивается внутри себя —
   * так же, как вкладки.
   */
  const periodRow = !isEmpty && !screens.md && (
    <div style={{ overflowX: 'auto', marginBottom: token.margin }}>{periodSwitch}</div>
  );

  return (
    <div>
      <PageHeader
        title="Аналитика"
        subtitle={scopeLabel}
        actions={
          <>
            {isAdmin && (
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Все пользователи"
                style={{ minWidth: 220 }}
                loading={usersLoading}
                value={currentUserId}
                onChange={(value?: string) => dispatch(analyticsActions.setTargetUser(value))}
                options={users.map((u) => ({ label: u.username, value: u.id }))}
              />
            )}
            {!isEmpty && screens.md && periodSwitch}
          </>
        }
      />

      {periodRow}

      {error && <Alert type="error" showIcon message="Не удалось загрузить аналитику" description={error} style={styles.alert} />}

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

          {/* Отчёт начинается с вывода фразой, а не с восьми одинаковых плиток: сначала
              «что произошло», и только потом графики, по которым это видно. */}
          <Card style={styles.summary} styles={{ body: styles.summaryBody }}>
            {readingSkeleton ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : (
              <>
                <Typography.Paragraph data-testid="analytics-summary" style={styles.phrase}>
                  {phrase ? emphasizeNumbers(phrase) : 'Динамика чтения пока не загрузилась'}
                </Typography.Paragraph>
                <div style={styles.numbers}>
                  {numbers.map((item, index) => (
                    <div
                      key={item.key}
                      style={index === 0 || !screens.md ? styles.numberCell : styles.numberCellDivided}
                    >
                      <Typography.Text type="secondary" style={styles.numberLabel}>
                        {item.label}
                      </Typography.Text>
                      <div style={styles.numberValue}>
                        <span className="brand-display" style={styles.number}>
                          {item.value}
                        </span>
                        {item.delta && (
                          <Typography.Text style={{ color: item.delta.color, fontWeight: 500 }}>
                            {item.delta.text}
                          </Typography.Text>
                        )}
                        {item.note && (
                          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                            {item.note}
                          </Typography.Text>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24}>
              <SectionCard
                title="Динамика чтения"
                controls={
                  report?.paired ? (
                    <div style={styles.legend}>
                      <Typography.Text type="secondary" style={styles.legendItem}>
                        <span
                          style={{
                            ...styles.legendSwatch,
                            background: token.colorFillSecondary,
                            boxShadow: `inset 0 0 0 1px ${token.colorBorder}`
                          }}
                        />
                        {reading?.previousYear.period}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={styles.legendItem}>
                        <span style={{ ...styles.legendSwatch, background: token.colorPrimary }} />
                        {reading?.currentYear.period}
                      </Typography.Text>
                    </div>
                  ) : (
                    <Typography.Text type="secondary">дочитано за период</Typography.Text>
                  )
                }
              >
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <ColumnChart
                    items={report?.columns ?? []}
                    height={140}
                    // Парному столбцу ширины нужно вдвое меньше: рядом стоит прошлый год.
                    maxBarWidth={report?.paired ? 20 : 36}
                    emptyText="Дочитанного за этот период пока нет"
                  />
                )}
              </SectionCard>
            </Col>
          </Row>

          {/* Календарь и темп ростом не равны и равняться не должны: тепловая карта заканчивается
              там, где заканчивается год, и растягивать её до высоты соседа значило бы оставить
              под ней пустое поле в треть экрана. */}
          <Row gutter={[16, 16]} align="top" style={{ marginTop: 16 }}>
            <Col xs={24} lg={15}>
              <SectionCard
                title="Календарь активности"
                stretch={false}
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

            <Col xs={24} lg={9}>
              <SectionCard
                title="Темп и прогноз"
                stretch={false}
                controls={
                  reading && (
                    <Typography.Text type="secondary">
                      за {pluralize(reading.pace.windowDays, ['день', 'дня', 'дней'])}
                    </Typography.Text>
                  )
                }
              >
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <>
                    <MetricList
                      items={[
                        { key: 'pagesPerDay', label: 'Страниц в день', value: decimal(reading?.pace.pagesPerDay) },
                        { key: 'minutesPerDay', label: 'Минут в день', value: decimal(reading?.pace.minutesPerDay) },
                        { key: 'pagesPerHour', label: 'Страниц в час', value: decimal(reading?.pace.pagesPerHour) }
                      ]}
                    />
                    {/* Оговорка обязательна: темп делится на дни с чтением, и без неё «60 страниц
                        в день» читается как обещание, которого никто не давал. */}
                    <Typography.Paragraph type="secondary" style={styles.hint}>
                      Считается по {pluralize(reading?.pace.activeDays ?? 0, ['дню', 'дням', 'дням'])} с
                      чтением, а не по всем дням окна.
                    </Typography.Paragraph>

                    {projection !== undefined && (
                      <div style={styles.note}>
                        При нынешнем темпе {reading?.currentYear.period} год закроется примерно на{' '}
                        {pluralize(projection, ['книге', 'книгах', 'книгах'])}.
                      </div>
                    )}

                    <div style={styles.divider}>
                      {(reading?.forecasts.length ?? 0) === 0 ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Нечего прогнозировать: у книг в чтении не заполнен прогресс"
                        />
                      ) : (
                        <MetricList
                          items={(reading?.forecasts ?? []).map((forecast) => ({
                            key: forecast.itemId,
                            label: (
                              <>
                                {forecast.title}
                                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                                  осталось {forecast.remaining}{' '}
                                  {forecast.unit ? progressUnitGenitive[forecast.unit] : ''}
                                </Typography.Text>
                              </>
                            ),
                            value: forecast.expectedFinish ? (
                              formatDate(forecast.expectedFinish)
                            ) : (
                              <Typography.Text type="secondary">темпа пока нет</Typography.Text>
                            )
                          }))}
                        />
                      )}
                    </div>
                  </>
                )}
              </SectionCard>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {cuts.map((cut) => (
              <Col key={cut.key} xs={24} sm={12} lg={8}>
                <SectionCard title={cut.title}>
                  {readingSkeleton ? (
                    <Skeleton active paragraph={{ rows: 4 }} />
                  ) : (
                    <>
                      {/* База процентов — вся библиотека там, где разрез её делит: иначе лидер
                          списка всегда «100%», и две разные величины выглядят одинаково. */}
                      <BarList
                        total={cut.relative ? total : undefined}
                        items={cut.items.slice(0, BREAKDOWN_LIMIT)}
                        onSelect={cut.filter ? (item) => openLibrary(cut.filter!(item)) : undefined}
                        emptyText="Данных для разбивки пока нет"
                      />
                      {cut.items.length > BREAKDOWN_LIMIT && (
                        <Typography.Paragraph type="secondary" style={styles.hint}>
                          и ещё {cut.items.length - BREAKDOWN_LIMIT} — хвост длинного списка ничего не
                          добавляет к картине
                        </Typography.Paragraph>
                      )}
                    </>
                  )}
                </SectionCard>
              </Col>
            ))}

            {kindShares.length > 0 && (
              <Col xs={24} sm={12} lg={8}>
                <SectionCard title="Виды">
                  {/* Корешковая полоса: доли видов произведения одной строкой. Она же —
                      фирменный приём, и нажатие на корешок открывает этот вид в библиотеке. */}
                  <div style={styles.spineStrip}>
                    <SpineStrip shares={kindShares} onSelect={(kind) => openLibrary({ kind })} />
                  </div>
                </SectionCard>
              </Col>
            )}

            <Col xs={24} sm={12} lg={8}>
              <SectionCard title="Куплено и прочитано">
                {readingSkeleton ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <>
                    <MetricList
                      items={[
                        { key: 'purchased', label: 'Куплено', value: formatNumber(reading?.purchases.purchased ?? 0) },
                        {
                          key: 'finished',
                          label: 'Прочитано из купленного',
                          value:
                            reading && reading.purchases.purchased > 0
                              ? `${formatNumber(reading.purchases.finishedOfPurchased)} · ${Math.round(
                                  (reading.purchases.finishedOfPurchased / reading.purchases.purchased) * 100
                                )}% покупок`
                              : formatNumber(reading?.purchases.finishedOfPurchased ?? 0)
                        },
                        {
                          key: 'unread',
                          label: 'Не начато',
                          value: formatNumber(reading?.purchases.unreadPurchased ?? 0)
                        }
                      ]}
                    />
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
                              {amount.toLocaleString('ru-RU')} {currency}
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
