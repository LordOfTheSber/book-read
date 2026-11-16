import React from 'react';
import { Alert, Card, Col, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { BookOutlined, CheckCircleOutlined, HeartOutlined, StarOutlined, TrophyOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Achievement, BookAnalytics, ReadingStatus } from '@/shared/types/library';
import { statusMeta } from '@/shared/constants/status';
import { StatTile } from '@/shared/ui/StatTile';
import { BarList } from '@/shared/ui/BarList';
import { MetricList } from '@/shared/ui/MetricList';
import { UsageMeter } from '@/shared/ui/UsageMeter';
import { formatScore } from '@/shared/lib/format';
import { useProfilePageStyles } from './ProfilePage.styles';

interface Props {
  analytics?: BookAnalytics | null;
  loading: boolean;
  error?: string;
  achievements: Achievement[];
}

const statusOrder: ReadingStatus[] = ['READING', 'COMPLETED', 'PLANNED', 'DROPPED'];

/**
 * Числа: то, чем профиль был целиком — плитки, статусы, предпочтения и достижения.
 *
 * Содержимое осталось прежним, но переехало на свою вкладку: на первом экране теперь витрина,
 * которая меняется день ото дня, а сводка ждёт тех, кому она нужна.
 */
export const NumbersTab: React.FC<Props> = ({ analytics, loading, error, achievements }) => {
  const styles = useProfilePageStyles();

  const total = analytics?.totalItems ?? 0;
  const favorites = analytics?.favoriteItems ?? 0;
  const averageRating = analytics?.averageRating;
  const statusCount = (status: ReadingStatus) => analytics?.statusBreakdown?.[status] ?? 0;
  const completed = statusCount('COMPLETED');
  const dropped = statusCount('DROPPED');
  const topType = analytics?.topTypes?.[0];
  const topSource = analytics?.topSources?.[0];
  const completionPercent = total ? Math.round((completed / total) * 100) : undefined;
  const favoritePercent = total ? Math.round((favorites / total) * 100) : undefined;

  const unlocked = achievements.filter((achievement) => achievement.unlocked);
  const pending = loading && !analytics;

  return (
    <div>
      {error && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить статистику"
          description={error}
          style={styles.alert}
        />
      )}

      <div style={styles.stats}>
        <StatTile label="Всего книг" value={total} icon={<BookOutlined />} loading={pending} />
        <StatTile
          label="Завершено"
          value={completed}
          hint={completionPercent !== undefined ? `${completionPercent}% коллекции` : undefined}
          icon={<CheckCircleOutlined />}
          accent={statusMeta.COMPLETED.accent}
          loading={pending}
        />
        <StatTile
          label="Избранное"
          value={favorites}
          hint={favoritePercent !== undefined ? `${favoritePercent}% коллекции` : undefined}
          icon={<HeartOutlined />}
          loading={pending}
        />
        <StatTile
          label="Средняя оценка"
          value={averageRating ? formatScore(averageRating) : '—'}
          hint={averageRating ? 'из 10' : 'оценок пока нет'}
          icon={<StarOutlined />}
          loading={pending}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Статусы чтения" style={styles.card} styles={{ body: styles.cardBody }}>
            {pending ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <BarList
                total={total}
                emptyText="Добавьте книги, чтобы увидеть распределение"
                items={statusOrder.map((status) => ({
                  key: status,
                  label: statusMeta[status].label,
                  value: statusCount(status),
                  color: statusMeta[status].accent
                }))}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Предпочтения" style={styles.card} styles={{ body: styles.cardBody }}>
            {pending ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <>
                <Typography.Text type="secondary" style={styles.hint}>
                  Прогресс чтения
                </Typography.Text>
                <div style={{ marginTop: 6, marginBottom: 16 }}>
                  <UsageMeter percent={completionPercent} width={0} caption="книг завершено" />
                </div>
                <MetricList
                  items={[
                    {
                      label: 'Любимый тип',
                      value: topType ? `${topType.typeName} · ${topType.count}` : 'ещё не определён'
                    },
                    {
                      label: 'Любимый источник',
                      value: topSource ? `${topSource.sourceName} · ${topSource.count}` : 'ещё не определён'
                    },
                    { label: 'Брошено', value: dropped },
                    { label: 'В избранном', value: favorites }
                  ]}
                />
              </>
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title="Достижения"
            style={styles.card}
            styles={{ body: styles.cardBody }}
            extra={
              <Typography.Text type="secondary">
                <TrophyOutlined /> {unlocked.length} из {achievements.length}
              </Typography.Text>
            }
          >
            {unlocked.length === 0 ? (
              <Typography.Text type="secondary">
                Пока ни одного: первое достижение придёт с первым завершённым произведением.
              </Typography.Text>
            ) : (
              <Space size={8} wrap>
                {unlocked.map((achievement) => (
                  <Tag key={achievement.code} color="success" bordered={false} style={styles.tag}>
                    {achievement.title}
                  </Tag>
                ))}
              </Space>
            )}
            <div style={{ marginTop: 12 }}>
              <Link to="/goals">Все достижения, серия и цель года</Link>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
