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
  Progress,
  Row,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme
} from 'antd';
import { FireOutlined, TrophyOutlined } from '@ant-design/icons';
import { Achievement, GoalMetric, ReadingGoal, Streak, YearInReview } from '@/shared/types/library';
import { formatDate } from '@/shared/lib/date';
import { useRequestError } from '@/shared/lib/errors';
import { pluralize } from '@/shared/lib/plural';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { BarList } from '@/shared/ui/BarList';
import { MetricList } from '@/shared/ui/MetricList';
import {
  fetchAchievements,
  fetchGoal,
  fetchStreak,
  fetchYearInReview,
  saveGoal
} from '@/entities/engagement';

interface GoalFormValues {
  targetItems?: number;
  targetPages?: number;
  targetMinutes?: number;
}

const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

/** Восемь недель полоски активности: столько же, сколько отдаёт сервер. */
const STREAK_DAYS = 56;

/**
 * Цели и вовлечение. Главное на странице — не проценты, а отставание от равномерного темпа:
 * «12 из 40» в июне и в декабре означают разное, и без графика цифра ни о чём не говорит.
 */
export const GoalsPage: React.FC = () => {
  const { token } = theme.useToken();
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
      form.setFieldsValue({
        targetItems: loadedGoal.items?.target,
        targetPages: loadedGoal.pages?.target,
        targetMinutes: loadedGoal.minutes?.target
      });
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

  const submit = async (values: GoalFormValues) => {
    setSaving(true);
    try {
      setGoal(await saveGoal(year, values));
      message.success('Цель сохранена');
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить цель');
    } finally {
      setSaving(false);
    }
  };

  /** Дни последних восьми недель: серым — пропуски, цветом — дни с чтением. */
  const streakDays = useMemo(() => {
    const read = new Set(streak?.recentDays ?? []);
    const today = new Date();
    return Array.from({ length: STREAK_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (STREAK_DAYS - 1 - index));
      const iso = date.toISOString().slice(0, 10);
      return { iso, active: read.has(iso) };
    });
  }, [streak]);

  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  const renderMetric = (title: string, unit: string, metric?: GoalMetric) => {
    if (!metric) {
      return null;
    }
    return (
      <Col xs={24} md={8} key={title}>
        <Card size="small" title={title}>
          <Progress
            percent={metric.percent}
            status={metric.onTrack ? 'active' : 'exception'}
            format={() => `${metric.done} / ${metric.target}`}
          />
          <MetricList
            items={[
              { label: 'По графику', value: `${metric.expected} ${unit}` },
              {
                label: metric.onTrack ? 'Опережение' : 'Отставание',
                value: metric.onTrack ? 'идёте по плану' : `${metric.behind} ${unit}`
              },
              { label: 'Такими темпами', value: `${metric.projected} ${unit} за год` }
            ]}
          />
        </Card>
      </Col>
    );
  };

  if (loading && !goal) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  return (
    <div>
      <PageHeader
        title="Цели и итоги"
        subtitle="Челлендж года, серия дней с чтением, достижения и «Год в обзоре»"
        actions={
          <Segmented
            value={year}
            onChange={(value) => setYear(Number(value))}
            options={[currentYear - 1, currentYear, currentYear + 1]}
          />
        }
      />

      <Card
        title={`Цель на ${year} год`}
        style={{ marginBottom: 16 }}
        extra={
          goal?.completed ? (
            <Tag color="success" bordered={false}>
              цель взята
            </Tag>
          ) : (
            <Typography.Text type="secondary">
              осталось {pluralize(goal?.daysLeft ?? 0, ['день', 'дня', 'дней'])}
            </Typography.Text>
          )
        }
      >
        <Form form={form} layout="inline" onFinish={submit} style={{ marginBottom: goal?.configured ? 20 : 0 }}>
          <Form.Item name="targetItems" label="Произведений" tooltip="Считается по дате завершения">
            <InputNumber min={1} max={10000} placeholder="40" />
          </Form.Item>
          <Form.Item name="targetPages" label="Страниц" tooltip="Берётся объём дочитанных изданий">
            <InputNumber min={1} max={10000000} placeholder="12000" />
          </Form.Item>
          <Form.Item name="targetMinutes" label="Минут" tooltip="Складывается из времени заходов">
            <InputNumber min={1} max={1000000} placeholder="6000" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Сохранить
            </Button>
          </Form.Item>
        </Form>

        {goal?.configured ? (
          <Row gutter={[16, 16]}>
            {renderMetric('Произведения', 'шт.', goal.items)}
            {renderMetric('Страницы', 'стр.', goal.pages)}
            {renderMetric('Время', 'мин.', goal.minutes)}
          </Row>
        ) : (
          <Typography.Text type="secondary">
            Цель ещё не поставлена. Достаточно любой одной цифры — остальные можно не заполнять.
          </Typography.Text>
        )}
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={10}>
          <Card title="Серия">
            <Space size={16} wrap style={{ marginBottom: 12 }}>
              <StatTile
                label="Сейчас"
                value={streak?.currentStreak ?? 0}
                hint={streak?.readToday ? 'сегодня уже читали' : 'сегодня ещё не отмечались'}
                icon={<FireOutlined />}
                accent="#f97316"
              />
              <StatTile
                label="Рекорд"
                value={streak?.longestStreak ?? 0}
                hint={streak?.lastReadOn ? `последний заход ${formatDate(streak.lastReadOn)}` : 'заходов пока нет'}
              />
            </Space>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {streakDays.map((day) => (
                <Tooltip key={day.iso} title={day.iso}>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: day.active ? token.colorPrimary : token.colorFillSecondary
                    }}
                  />
                </Tooltip>
              ))}
            </div>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
              Серия держится, пока не пропущено два дня подряд: вчерашняя отметка её не рвёт.
            </Typography.Paragraph>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title="Достижения"
            extra={
              <Typography.Text type="secondary">
                <TrophyOutlined /> {unlockedCount} из {achievements.length}
              </Typography.Text>
            }
          >
            <Row gutter={[12, 12]}>
              {achievements.map((achievement) => (
                <Col xs={24} sm={12} key={achievement.code}>
                  <Card size="small" style={{ opacity: achievement.unlocked ? 1 : 0.55 }}>
                    <Space direction="vertical" size={2}>
                      <Typography.Text strong>{achievement.title}</Typography.Text>
                      <Typography.Text type="secondary">{achievement.description}</Typography.Text>
                      <Tag color={achievement.unlocked ? 'success' : 'default'} bordered={false}>
                        {achievement.unlocked ? `получено ${formatDate(achievement.unlockedOn)}` : 'ещё не получено'}
                      </Tag>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Card title={`Год в обзоре · ${year}`}>
        {!review || review.finishedCount === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="За этот год пока нечего подводить" />
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Space size={12} wrap style={{ marginBottom: 16 }}>
                <StatTile label="Дочитано" value={review.finishedCount} />
                <StatTile label="Страниц" value={review.pageCount} />
                <StatTile label="Дней с чтением" value={review.readingDays} hint={`рекорд ${review.longestStreak}`} />
                <StatTile
                  label="Средняя оценка"
                  value={review.averageRating ? review.averageRating.toFixed(1) : '—'}
                />
              </Space>
              <BarList
                total={Math.max(...review.monthly.map((month) => month.count), 1)}
                emptyText="Записей за год нет"
                items={review.monthly.map((month) => ({
                  key: String(month.month),
                  label: MONTH_LABELS[month.month - 1],
                  value: month.count,
                  color: token.colorPrimary
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
                  { label: 'Времени за чтением', value: `${review.minuteCount} мин.` }
                ]}
              />
            </Col>
          </Row>
        )}
      </Card>
    </div>
  );
};
