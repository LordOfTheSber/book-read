import React, { useEffect } from 'react';
import { Alert, Card, Col, Empty, Row, Select, Skeleton, Space, Typography, theme } from 'antd';
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PauseCircleOutlined,
  ReadOutlined,
  StarOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { analyticsActions, loadBookAnalytics } from '@/entities/analytics';
import { loadUsers } from '@/entities/user';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { statusMeta } from '@/shared/constants/status';
import { ReadingStatus } from '@/shared/types/library';
import { isAdminLike } from '@/shared/lib/roles';
import { BarList } from '@/shared/ui/BarList';
import { useAnalyticsPageStyles } from './AnalyticsPage.styles';

const statusOrder: ReadingStatus[] = ['READING', 'ON_HOLD', 'COMPLETED', 'PLANNED', 'DROPPED'];

const statusIcons: Record<ReadingStatus, React.ReactNode> = {
  READING: <ReadOutlined />,
  ON_HOLD: <PauseCircleOutlined />,
  COMPLETED: <CheckCircleOutlined />,
  PLANNED: <ClockCircleOutlined />,
  DROPPED: <StopOutlined />
};

export const AnalyticsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const styles = useAnalyticsPageStyles();
  const { data, loading, error, currentUserId } = useAppSelector((state) => state.analytics);
  const { list: users, loaded: usersLoaded, loading: usersLoading } = useAppSelector((state) => state.users);
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = isAdminLike(user?.role);

  useEffect(() => {
    dispatch(loadBookAnalytics(currentUserId));
  }, [dispatch, currentUserId]);

  useEffect(() => {
    if (isAdmin && !usersLoaded && !usersLoading) {
      dispatch(loadUsers());
    }
  }, [dispatch, isAdmin, usersLoaded, usersLoading]);

  const total = data?.totalItems ?? 0;
  const statusCount = (status: ReadingStatus) => data?.statusBreakdown?.[status] ?? 0;
  const isEmpty = !loading && (!data || total === 0);

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
    </div>
  );
};
