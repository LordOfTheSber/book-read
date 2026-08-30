import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  InputNumber,
  List,
  Modal,
  Progress,
  Row,
  Segmented,
  Skeleton,
  Space,
  Tooltip,
  Typography,
  theme
} from 'antd';
import { EditOutlined, FireOutlined, TrophyOutlined } from '@ant-design/icons';
import { Achievement, GoalMetric, ReadingGoal, Streak, YearInReview } from '@/shared/types/library';
import { formatDate, toLocalIso } from '@/shared/lib/date';
import { useRequestError } from '@/shared/lib/errors';
import { formatNumber } from '@/shared/lib/format';
import { plural, pluralize } from '@/shared/lib/plural';
import { goalPhrase, streakPhrase } from '@/shared/lib/phrases';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { MetricList } from '@/shared/ui/MetricList';
import { ColumnChart } from '@/shared/ui/ColumnChart';
import {
  fetchAchievements,
  fetchGoal,
  fetchStreak,
  fetchYearInReview,
  resetYearGoal,
  saveGoal
} from '@/entities/engagement';
import { useGoalsPageStyles } from './GoalsPage.styles';

interface GoalFormValues {
  targetItems?: number;
  targetPages?: number;
  targetMinutes?: number;
}

const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

/**
 * Полоса серии: тридцать дней вместо присланных сервером пятидесяти шести. Месяц — тот отрезок,
 * на котором пропуск ещё помнят; за два месяца столбики становятся полосками по три пикселя.
 */
const STREAK_DAYS = 30;

type MetricKey = 'items' | 'pages' | 'minutes';

/** Единицы цели во множественном числе: «12 книг», «1 200 страниц», «40 минут». */
const METRIC_FORMS: Record<MetricKey, [string, string, string]> = {
  items: ['книга', 'книги', 'книг'],
  pages: ['страница', 'страницы', 'страниц'],
  minutes: ['минута', 'минуты', 'минут']
};

const METRIC_TITLES: Record<MetricKey, string> = {
  items: 'Произведения',
  pages: 'Страницы',
  minutes: 'Минуты'
};

const DAYS_IN_WEEK = 7;

/** «1,2» вместо «1.2»: во всём остальном интерфейсе дробная часть отделяется запятой. */
const decimal = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

/** «12 книг», но «11 240 страниц» — разряды у крупных чисел не менее важны, чем форма слова. */
const measure = (value: number, key: MetricKey) => `${formatNumber(value)} ${plural(value, METRIC_FORMS[key])}`;

/**
 * Цели и итоги по макету `Goals1.dc.html`.
 *
 * Страница открывается ответом, а не настройкой: раньше первым экраном стояла форма из трёх
 * полей, то есть вопрос «сколько вы хотите», хотя человек приходит с вопросом «успеваю ли я».
 * Теперь сверху одна цель крупно — кольцо, вывод фразой и четыре числа, — а форма убрана
 * под карандаш. Цели по страницам и минутам остаются, но идут второй строкой.
 */
export const GoalsPage: React.FC = () => {
  const { token } = theme.useToken();
  const styles = useGoalsPageStyles();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [form] = Form.useForm<GoalFormValues>();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [review, setReview] = useState<YearInReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  /** Итоги года раскрываются по нажатию: на первом экране от них нужна одна строка, а не таблица. */
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedGoal, loadedStreak, loadedAchievements, loadedReview] = await Promise.all([
        fetchGoal(year),
        fetchStreak(),
        fetchAchievements(),
        fetchYearInReview(year)
      ]);
      setGoal(loadedGoal);
      setStreak(loadedStreak);
      setAchievements(loadedAchievements);
      setReview(loadedReview);
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить цели');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Поля подставляются при открытии формы, а не при загрузке страницы: сброс перед подстановкой
   * нужен, чтобы цифры прошлого года не уехали на сервер как цель года, для которого её нет.
   */
  const openForm = () => {
    form.resetFields();
    form.setFieldsValue({
      targetItems: goal?.items?.target,
      targetPages: goal?.pages?.target,
      targetMinutes: goal?.minutes?.target
    });
    setFormOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields().catch(() => undefined);
    if (!values) return;
    setSaving(true);
    try {
      setGoal(await saveGoal(year, values));
      // Знак в шапке рисует закладку по цели: без сброса кеша он остался бы на прежней длине.
      resetYearGoal();
      setFormOpen(false);
      message.success('Цель сохранена');
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить цель');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Главная цель — первая заведённая: книги, если они есть, иначе страницы, иначе минуты.
   * Кольцо и числа считаются по ней одной, остальные уходят строкой ниже.
   */
  const primary = useMemo((): { key: MetricKey; metric: GoalMetric } | undefined => {
    if (!goal?.configured) return undefined;
    const order: MetricKey[] = ['items', 'pages', 'minutes'];
    const key = order.find((candidate) => goal[candidate]);
    return key && goal[key] ? { key, metric: goal[key] as GoalMetric } : undefined;
  }, [goal]);

  const secondary = useMemo(() => {
    if (!goal?.configured) return [];
    const order: MetricKey[] = ['items', 'pages', 'minutes'];
    return order
      .filter((key) => goal[key] && key !== primary?.key)
      .map((key) => ({ key, metric: goal[key] as GoalMetric }));
  }, [goal, primary]);

  /**
   * Четыре числа вместо процента: «осталось», «нужно в неделю», «текущий темп» и «прогноз» —
   * это и есть ответ на вопрос «успею ли». Неделя, а не день: книгу за день не читают,
   * и «0,14 книги в день» ничего не значит.
   */
  const numbers = useMemo(() => {
    if (!goal || !primary) return [];
    const { key, metric } = primary;
    const remaining = Math.max(0, metric.target - metric.done);
    const weeksLeft = Math.max(1, goal.daysLeft / DAYS_IN_WEEK);
    const weeksPassed = Math.max(1, goal.daysPassed / DAYS_IN_WEEK);

    return [
      { label: 'Осталось', value: measure(remaining, key) },
      { label: 'Нужно в неделю', value: decimal(remaining / weeksLeft) },
      { label: 'Текущий темп', value: decimal(metric.done / weeksPassed) },
      { label: 'Прогноз', value: measure(Math.round(metric.projected), key) }
    ];
  }, [goal, primary]);

  /** Дни последнего месяца: серым — пропуски, цветом — дни с чтением. */
  const streakDays = useMemo(() => {
    const read = new Set(streak?.recentDays ?? []);
    const today = new Date();
    return Array.from({ length: STREAK_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (STREAK_DAYS - 1 - index));
      const iso = toLocalIso(date);
      return { iso, active: read.has(iso) };
    });
  }, [streak]);

  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  /** Итог года одной строкой — та же выжимка, что стоит на плитках, только словами. */
  const reviewLine = useMemo(() => {
    if (!review || review.finishedCount === 0) return undefined;
    const parts = [
      pluralize(review.finishedCount, ['книга', 'книги', 'книг']),
      `${formatNumber(review.pageCount)} ${plural(review.pageCount, METRIC_FORMS.pages)}`,
      `${pluralize(review.readingDays, ['день', 'дня', 'дней'])} с чтением`
    ];
    const best = review.topRated[0];
    return best ? `${parts.join(', ')}, лучшая книга — «${best.title}»` : parts.join(', ');
  }, [review]);

  if (loading && !goal) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  return (
    <div>
      <PageHeader
        title="Цели и итоги"
        subtitle="Одна цель на год, серия дней с чтением и то, что уже получено"
        actions={
          <Segmented
            value={year}
            onChange={(value) => setYear(Number(value))}
            options={[currentYear - 1, currentYear, currentYear + 1]}
          />
        }
      />

      <Card style={styles.goalCard} styles={{ body: styles.goalBody }}>
        {primary ? (
          <>
            <div style={styles.goalRow}>
              {/* Кольцо — единственная картинка на экране: отставание видно раньше, чем прочитано
                  хоть одно слово. Тревожного цвета у него нет: отстать от плана — не ошибка. */}
              <Progress
                type="circle"
                size={168}
                strokeWidth={9}
                percent={Math.min(100, primary.metric.percent)}
                strokeColor={primary.metric.onTrack ? token.colorSuccess : token.colorPrimary}
                format={() => (
                  <span>
                    <span style={{ display: 'block', fontSize: 40, fontWeight: 700, lineHeight: 1.1 }}>
                      {formatNumber(primary.metric.done)}
                    </span>
                    <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                      {`из ${measure(primary.metric.target, primary.key)}`}
                    </Typography.Text>
                  </span>
                )}
              />

              <div style={styles.goalMain}>
                <Space size={10} align="center" wrap>
                  <Typography.Title level={3} style={{ margin: 0, fontSize: 20 }}>
                    {`Цель на ${year} год`}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {goal?.completed
                      ? 'цель взята'
                      : `до конца года ${pluralize(goal?.daysLeft ?? 0, ['день', 'дня', 'дней'])}`}
                  </Typography.Text>
                </Space>

                {/* Фраза вместо процентов: решение принимают по «впереди или позади», а не по 75 %. */}
                <Typography.Paragraph className="brand-display" style={styles.phrase}>
                  {goalPhrase(goal ?? undefined)}
                </Typography.Paragraph>

                <div style={styles.numbers}>
                  {numbers.map((number, index) => (
                    <div key={number.label} style={index === 0 ? styles.numberCell : styles.numberCellDivided}>
                      <Typography.Text type="secondary" style={styles.numberLabel}>
                        {number.label}
                      </Typography.Text>
                      <span style={styles.number}>{number.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Tooltip title="Изменить цель">
                <Button
                  icon={<EditOutlined />}
                  aria-label="Изменить цель"
                  onClick={openForm}
                  style={{ alignSelf: 'flex-start' }}
                />
              </Tooltip>
            </div>

            {secondary.length > 0 && (
              <div style={styles.secondary}>
                {secondary.map(({ key, metric }) => (
                  <div key={key} style={styles.secondaryItem}>
                    <Typography.Text type="secondary" style={styles.numberLabel}>
                      {METRIC_TITLES[key]}
                    </Typography.Text>
                    <Progress
                      percent={Math.min(100, metric.percent)}
                      showInfo={false}
                      strokeColor={metric.onTrack ? token.colorSuccess : token.colorPrimary}
                      style={{ marginBottom: 4 }}
                    />
                    <Typography.Text style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {`${formatNumber(metric.done)} из ${measure(metric.target, key)}`}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                      {metric.onTrack ? 'идёте по плану' : `отставание ${measure(metric.behind, key)}`}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Цель ещё не поставлена. Достаточно любой одной цифры — остальные можно не заполнять"
          >
            <Button type="primary" onClick={openForm}>
              Поставить цель
            </Button>
          </Empty>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card style={styles.card} styles={{ body: styles.cardBody }}>
            <div style={styles.streakRow}>
              <span aria-hidden style={styles.streakBadge}>
                <FireOutlined />
              </span>
              <div>
                <div style={styles.streakValue}>{streak?.currentStreak ?? 0}</div>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {`дней подряд · рекорд ${streak?.longestStreak ?? 0}`}
                </Typography.Text>
              </div>
            </div>

            <div style={styles.strip}>
              {streakDays.map((day) => (
                <Tooltip key={day.iso} title={formatDate(day.iso)}>
                  <span
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 6,
                      background: day.active ? token.colorWarning : token.colorFillSecondary
                    }}
                  />
                </Tooltip>
              ))}
            </div>
            <div style={styles.stripEnds}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                30 дней назад
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {streak?.readToday ? 'сегодня отмечено' : 'сегодня ещё не отмечено'}
              </Typography.Text>
            </div>

            <Typography.Paragraph style={{ marginTop: 14, marginBottom: 4 }}>
              {streakPhrase(streak ?? undefined)}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              Серия держится, пока не пропущено два дня подряд: вчерашняя отметка её не рвёт.
            </Typography.Text>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            style={styles.card}
            styles={{ body: styles.cardBody }}
            title="Достижения"
            extra={
              <Typography.Text type="secondary">
                <TrophyOutlined /> {`${unlockedCount} из ${achievements.length}`}
              </Typography.Text>
            }
          >
            <div style={styles.achievements}>
              {achievements.map((achievement) => (
                <div key={achievement.code} style={styles.achievement(achievement.unlocked)}>
                  <span aria-hidden style={styles.achievementIcon(achievement.unlocked)}>
                    <TrophyOutlined />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <Typography.Text strong style={{ display: 'block', fontSize: 13 }}>
                      {achievement.title}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {achievement.unlocked
                        ? `получено ${formatDate(achievement.unlockedOn)}`
                        : achievement.description}
                    </Typography.Text>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Итоги года — строкой и кнопкой: год складывается из того же, что уже показано выше,
          и разворачивать его на весь экран каждый раз незачем. */}
      <div style={styles.review}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.reviewTitle}>{`Год в обзоре · ${year}`}</div>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            {reviewLine ?? 'За этот год пока нечего подводить'}
          </Typography.Text>
        </div>
        {reviewLine && (
          <Button type={reviewOpen ? 'default' : 'primary'} onClick={() => setReviewOpen((open) => !open)}>
            {reviewOpen ? 'Свернуть итоги' : 'Смотреть итоги'}
          </Button>
        )}
      </div>

      {reviewOpen && review && (
        <Card style={{ ...styles.card, marginTop: 16 }} styles={{ body: styles.cardBody }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Space size={12} wrap style={{ marginBottom: 16 }}>
                <StatTile label="Дочитано" value={review.finishedCount} />
                <StatTile label="Страниц" value={formatNumber(review.pageCount)} />
                <StatTile label="Дней с чтением" value={review.readingDays} hint={`рекорд ${review.longestStreak}`} />
                <StatTile
                  label="Средняя оценка"
                  value={review.averageRating ? review.averageRating.toFixed(1) : '—'}
                />
              </Space>
              {/* Все двенадцать месяцев, включая пустые: BarList прячет нули, и год без февраля
                  и марта выглядел бы ровным вместо того, чтобы показать провал. */}
              <ColumnChart
                items={review.monthly.map((month) => ({
                  key: String(month.month),
                  label: MONTH_LABELS[month.month - 1],
                  value: month.count,
                  tooltip: `${MONTH_LABELS[month.month - 1]}: ${pluralize(month.count, [
                    'запись',
                    'записи',
                    'записей'
                  ])}`
                }))}
              />
            </Col>

            <Col xs={24} lg={12}>
              <Typography.Text type="secondary">Лучшее за год</Typography.Text>
              <List
                size="small"
                dataSource={review.topRated}
                locale={{ emptyText: 'Оценок за год нет' }}
                renderItem={(item) => (
                  <List.Item key={item.itemId}>
                    <List.Item.Meta
                      title={item.title}
                      description={item.authorNames.join(', ') || 'автор не указан'}
                    />
                    <Typography.Text strong>{item.rating?.toFixed(1)}</Typography.Text>
                  </List.Item>
                )}
              />
              <MetricList
                items={[
                  {
                    label: 'Самое объёмное',
                    value: review.longestItem ? review.longestItem.title : 'не определено'
                  },
                  {
                    label: 'Чаще всего читали',
                    value: review.topAuthors[0]?.name ?? 'не определено'
                  },
                  {
                    label: 'Любимый тип',
                    value: review.topTypes[0] ? `${review.topTypes[0].typeName} · ${review.topTypes[0].count}` : '—'
                  },
                  { label: 'Времени за чтением', value: `${formatNumber(review.minuteCount)} мин.` }
                ]}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Modal
        title={`Цель на ${year} год`}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Typography.Paragraph type="secondary">
            Достаточно любой одной цифры: крупно показывается первая заведённая, остальные идут
            второй строкой.
          </Typography.Paragraph>
          <Form.Item name="targetItems" label="Произведений" tooltip="Считается по дате завершения">
            <InputNumber min={1} max={10000} placeholder="40" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="targetPages" label="Страниц" tooltip="Берётся объём дочитанных изданий">
            <InputNumber min={1} max={10000000} placeholder="12000" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="targetMinutes" label="Минут" tooltip="Складывается из времени заходов">
            <InputNumber min={1} max={1000000} placeholder="6000" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
