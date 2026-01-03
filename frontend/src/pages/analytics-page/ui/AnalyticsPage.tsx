import React, { useEffect } from 'react';
import { Card, Col, Empty, Flex, Row, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { analyticsActions, loadBookAnalytics } from '@/entities/analytics';
import { loadUsers } from '@/entities/user';
import { useAnalyticsPageStyles } from './AnalyticsPage.styles';
import { ReadingStatus, User } from '@/shared/types/library';

const statusColorMap: Record<ReadingStatus, string> = {
  READING: 'blue',
  COMPLETED: 'green',
  PLANNED: 'default',
  DROPPED: 'red'
};

export const AnalyticsPage: React.FC = () => {
  const styles = useAnalyticsPageStyles();
  const dispatch = useAppDispatch();
  const { data, loading, error, currentUserId } = useAppSelector((state) => state.analytics);
  const { list: users, loaded: usersLoaded, loading: usersLoading } = useAppSelector((state) => state.users);
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    dispatch(loadBookAnalytics(currentUserId));
  }, [dispatch, currentUserId]);

  useEffect(() => {
    if (isAdmin && !usersLoaded && !usersLoading) {
      dispatch(loadUsers());
    }
  }, [dispatch, isAdmin, usersLoaded, usersLoading]);

  useEffect(() => {
    if (error) {
      message.error(error);
    }
  }, [error]);

  const handleUserChange = (value?: string) => {
    dispatch(analyticsActions.setTargetUser(value));
  };

  const statusData = data
    ? Object.entries(data.statusBreakdown || {}).map(([status, count]) => ({
        status: status as ReadingStatus,
        count
      }))
    : [];

  const sourceData = data?.topSources ?? [];

  return (
    <Card title="Аналитика" style={styles.pageCard} headStyle={styles.pageHead} bodyStyle={styles.pageBody}>
      <Flex gap={styles.contentWrapper.gap} align="start">
        <Flex flex={1} vertical gap={18} style={styles.heroCard as React.CSSProperties}>
          <Typography.Title level={4} style={styles.heroTitle}>
            Аналитика по книгам
          </Typography.Title>
          <Typography.Paragraph style={styles.heroDescription}>
            Следите за прогрессом чтения, популярностью источников и распределением статусов в едином отчёте.
          </Typography.Paragraph>

          {loading && (
            <Flex justify="center" style={{ padding: 32 }}>
              <Spin size="large" />
            </Flex>
          )}

          {!loading && data && (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={styles.cards}>
                <Card>
                  <Statistic title="Всего книг" value={data.totalItems} />
                </Card>
                <Card>
                  <Statistic title="Избранные" value={data.favoriteItems} />
                </Card>
                <Card>
                  <Statistic
                    title="Средний рейтинг"
                    precision={1}
                    value={data.averageRating ?? 0}
                    suffix="/ 10"
                    valueStyle={!data.averageRating ? { color: '#999' } : undefined}
                  />
                </Card>
              </div>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card title="Статусы чтения" extra={<Tag>Всего: {data.totalItems}</Tag>}>
                    {statusData.length === 0 ? (
                      <Empty description="Данных пока нет" />
                    ) : (
                      <Table
                        size="small"
                        rowKey={(row) => row.status}
                        dataSource={statusData}
                        pagination={false}
                        columns={[
                          {
                            title: 'Статус',
                            dataIndex: 'status',
                            render: (status: ReadingStatus) => (
                              <Tag color={statusColorMap[status]}>{status}</Tag>
                            )
                          },
                          { title: 'Количество', dataIndex: 'count' }
                        ]}
                      />
                    )}
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Популярные типы">
                    {data.topTypes.length === 0 ? (
                      <Empty description="Типы ещё не добавлены" />
                    ) : (
                      <Table
                        size="small"
                        rowKey={(row) => row.typeId}
                        dataSource={data.topTypes}
                        pagination={false}
                        columns={[
                          { title: 'Тип', dataIndex: 'typeName' },
                          { title: 'Количество', dataIndex: 'count' }
                        ]}
                      />
                    )}
                  </Card>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card title="Популярные источники">
                    {sourceData.length === 0 ? (
                      <Empty description="Источники ещё не добавлены" />
                    ) : (
                      <Table
                        size="small"
                        rowKey={(row) => row.sourceId}
                        dataSource={sourceData}
                        pagination={false}
                        columns={[
                          { title: 'Источник', dataIndex: 'sourceName' },
                          { title: 'Количество', dataIndex: 'count' }
                        ]}
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            </Space>
          )}

          {!loading && !data && (
            <Empty description="Аналитика недоступна. Добавьте книги, чтобы увидеть статистику." />
          )}
        </Flex>

        <Card style={styles.filtersCard} bodyStyle={styles.filtersCardBodyStyle} bordered={false}>
          <div style={styles.filtersCardBody}>
            <Typography.Title level={5} style={styles.filtersTitle}>
              Параметры отчёта
            </Typography.Title>
            <Typography.Paragraph style={styles.filtersDescription}>
              Выберите пользователя или оставьте пустым, чтобы увидеть общую статистику.
            </Typography.Paragraph>

            {isAdmin ? (
              <Select
                allowClear
                placeholder="Все пользователи"
                style={{ width: '100%' }}
                loading={usersLoading}
                value={currentUserId}
                onChange={handleUserChange}
                options={users.map((u: User) => ({ label: u.username, value: u.id }))}
              />
            ) : (
              <Typography.Text type="secondary">
                Доступна аналитика только по вашему аккаунту.
              </Typography.Text>
            )}
          </div>
        </Card>
      </Flex>
    </Card>
  );
};
