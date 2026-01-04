import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Image,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message
} from 'antd';
import type { UploadProps } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { uploadAvatarThunk } from '@/entities/auth';
import { useThemeMode } from '@/app/providers/ThemeProvider';
import { loadBookAnalytics } from '@/entities/analytics';
import { ReadingStatus } from '@/shared/types/library';
import { useProfilePageStyles } from './ProfilePage.styles';

const { Title, Paragraph, Text } = Typography;

const createBadge = (background: string, accent: string, glyph: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140" fill="none">
      <rect width="200" height="140" rx="18" fill="${background}" />
      <circle cx="64" cy="72" r="26" fill="${accent}" />
      <text x="50%" y="68" text-anchor="middle" fill="#0f172a" font-size="36" font-weight="700" font-family="Arial">${glyph}</text>
      <text x="50%" y="102" text-anchor="middle" fill="#0f172a" font-size="20" font-weight="700" font-family="Arial">Achievement</text>
    </svg>`
  )}`;

const badgeAssets = {
  gold: createBadge('#fff4d6', '#f6c344', '★'),
  teal: createBadge('#ddfbf5', '#0fbf9f', '❤'),
  purple: createBadge('#f2ecff', '#a855f7', '📖'),
  indigo: createBadge('#e9efff', '#3b82f6', '🏷'),
  sunset: createBadge('#ffe9dc', '#fb923c', '🌿'),
  emerald: createBadge('#e3f9e5', '#22c55e', '⭐')
};

interface Achievement {
  key: string;
  title: string;
  description: string;
  earned: boolean;
  badge: string;
}

export const ProfilePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useProfilePageStyles();
  const { mode, setMode } = useThemeMode();
  const themeColorMap: Record<typeof mode, string> = {
    light: '#f5f5f5',
    teal: '#0fbf9f',
    dark: '#1f1f1f'
  };
  const themeOrder = ['light', 'teal', 'dark'] as const;
  const [isAvatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const handleToggleTheme = () => {
    const currentIndex = themeOrder.indexOf(mode);
    const nextMode = themeOrder[(currentIndex + 1) % themeOrder.length];
    setMode(nextMode);
  };

  const user = useAppSelector((state) => state.auth.user);
  const updatingAvatar = useAppSelector((state) => state.auth.updatingAvatar);
  const analytics = useAppSelector((state) => state.analytics.data);
  const analyticsLoading = useAppSelector((state) => state.analytics.loading);
  const analyticsError = useAppSelector((state) => state.analytics.error);

  useEffect(() => {
    if (user?.id) {
      dispatch(loadBookAnalytics(user.id));
    }
  }, [dispatch, user?.id]);

  useEffect(() => {
    if (analyticsError) {
      message.error(analyticsError);
    }
  }, [analyticsError]);

  const avatarSrc = user?.avatar && user.avatarContentType ? `data:${user.avatarContentType};base64,${user.avatar}` : undefined;

  const statusBreakdown: Record<ReadingStatus, number> =
    analytics?.statusBreakdown ?? { COMPLETED: 0, DROPPED: 0, READING: 0, PLANNED: 0 };

  const totalItems = analytics?.totalItems ?? 0;
  const favoriteItems = analytics?.favoriteItems ?? 0;
  const averageRating = analytics?.averageRating ?? 0;
  const completedCount = statusBreakdown.COMPLETED ?? 0;
  const droppedCount = statusBreakdown.DROPPED ?? 0;
  const readingCount = statusBreakdown.READING ?? 0;
  const plannedCount = statusBreakdown.PLANNED ?? 0;
  const topType = analytics?.topTypes?.[0];
  const topSource = analytics?.topSources?.[0];
  const completionPercent = totalItems ? Math.round((completedCount / totalItems) * 100) : 0;
  const favoritePercent = totalItems ? Math.round((favoriteItems / totalItems) * 100) : 0;

  const achievements = useMemo<Achievement[]>(() => {
    const hasAnalytics = totalItems > 0;
    return [
      {
        key: 'first-book',
        title: 'Первый том',
        description: 'Добавьте хотя бы одну книгу, чтобы начать путь читателя.',
        earned: totalItems >= 1,
        badge: badgeAssets.gold
      },
      {
        key: 'finisher',
        title: 'Законченный читатель',
        description: 'Завершите 5 книг, чтобы получить знак настойчивости.',
        earned: completedCount >= 5,
        badge: badgeAssets.purple
      },
      {
        key: 'collector',
        title: 'Коллекционер избранного',
        description: 'Минимум 3 книги в избранном показывают ваши вкусы.',
        earned: favoriteItems >= 3,
        badge: badgeAssets.teal
      },
      {
        key: 'focused-genre',
        title: topType ? `Верность жанру «${topType.typeName}»` : 'Верность жанру',
        description: topType
          ? `Прочитано ${topType.count} книг типа «${topType.typeName}».`
          : 'Добавьте книги, чтобы увидеть любимый тип.',
        earned: Boolean(topType && topType.count >= 3),
        badge: badgeAssets.indigo
      },
      {
        key: 'steady',
        title: 'Без дропов',
        description: 'Держите планку и не бросайте книги.',
        earned: hasAnalytics && droppedCount === 0,
        badge: badgeAssets.sunset
      },
      {
        key: 'rating',
        title: 'Оценённый читатель',
        description: 'Средний рейтинг выше 7,0.',
        earned: (averageRating ?? 0) >= 7,
        badge: badgeAssets.emerald
      }
    ];
  }, [averageRating, completedCount, droppedCount, favoriteItems, topType, totalItems]);

  const handleAvatarUpload: UploadProps['beforeUpload'] = async (file) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      message.error('Поддерживаются только PNG, JPEG, WEBP или GIF');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('Размер файла не должен превышать 2 МБ');
      return Upload.LIST_IGNORE;
    }
    try {
      await dispatch(uploadAvatarThunk(file)).unwrap();
      message.success('Аватар обновлён');
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Не удалось загрузить аватар';
      message.error(msg);
    }
    return false;
  };

  return (
    <Card title="Профиль" style={styles.pageCard} headStyle={styles.pageHead} bodyStyle={styles.pageBody}>
      <Flex gap={styles.contentWrapper.gap} align="start">
        <Flex flex={1} vertical style={styles.heroCard}>
          <div style={styles.heroBanner}>
            <Space align="center" size={16} wrap>
              {avatarSrc ? (
                <>
                  <Image
                    src={avatarSrc}
                    width={96}
                    height={96}
                    style={{ borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
                    preview={false}
                    onClick={() => setAvatarPreviewOpen(true)}
                  />
                  <Image
                    src={avatarSrc}
                    style={{ display: 'none' }}
                    preview={{
                      visible: isAvatarPreviewOpen,
                      onVisibleChange: (vis) => setAvatarPreviewOpen(vis)
                    }}
                  />
                </>
              ) : (
                <Avatar size={96} style={{ backgroundColor: '#1890ff', cursor: 'default' }}>
                  {user?.username?.charAt(0).toUpperCase()}
                </Avatar>
              )}
              <div>
                <Title level={4} style={{ marginBottom: 4, color: '#fff' }}>
                  {user?.username}
                </Title>
                <Space size="small" wrap>
                  <Tag color="blue">{user?.role}</Tag>
                  {user?.createdAt && (
                    <Tag color="default">Зарегистрирован: {new Date(user.createdAt).toLocaleDateString()}</Tag>
                  )}
                </Space>
                <Paragraph style={{ marginTop: 8, marginBottom: 12, color: 'rgba(255,255,255,0.88)' }}>
                  Личная страница читателя с настройками профиля и достижениями на основе вашей аналитики.
                </Paragraph>
                <Space size="middle" wrap>
                  <Upload showUploadList={false} beforeUpload={handleAvatarUpload}>
                    <Button loading={updatingAvatar} type="primary">
                      Обновить аватар
                    </Button>
                  </Upload>
                  <Tooltip title="Сменить тему">
                    <Button
                      shape="circle"
                      onClick={handleToggleTheme}
                      icon={
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: themeColorMap[mode],
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.08) inset'
                          }}
                        />
                      }
                      style={{
                        borderColor: 'rgba(255,255,255,0.75)',
                        background: 'rgba(255,255,255,0.9)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                      }}
                    />
                  </Tooltip>
                </Space>
              </div>
            </Space>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {analyticsLoading && (
            <Flex justify="center" style={{ padding: 12 }}>
              <Spin />
            </Flex>
          )}

          {!analyticsLoading && (
            <>
              <Row gutter={[12, 12]} style={styles.statsGrid}>
                <Col xs={12} sm={12} md={6}>
                  <Statistic title="Всего книг" value={totalItems} />
                </Col>
                <Col xs={12} sm={12} md={6}>
                  <Statistic title="Избранные" value={favoriteItems} suffix={totalItems ? `(${favoritePercent}%)` : undefined} />
                </Col>
                <Col xs={12} sm={12} md={6}>
                  <Statistic title="Завершено" value={completedCount} suffix={totalItems ? `(${completionPercent}%)` : undefined} />
                </Col>
                <Col xs={12} sm={12} md={6}>
                  <Statistic title="Средний рейтинг" value={averageRating ?? 0} precision={1} suffix="/ 10" />
                </Col>
              </Row>

              <Space direction="vertical" size="small">
                <Text style={styles.sectionTitle}>Статусы чтения</Text>
                <Space size="small" wrap>
                  <Tag color="green">Завершено: {completedCount}</Tag>
                  <Tag color="blue">Читаю: {readingCount}</Tag>
                  <Tag color="default">В планах: {plannedCount}</Tag>
                  <Tag color="red">Дропнуто: {droppedCount}</Tag>
                </Space>
              </Space>

              <Space direction="vertical" size="small">
                <Text style={styles.sectionTitle}>Любимые источники</Text>
                <Paragraph style={styles.secondaryText}>
                  {topSource ? `Чаще всего вы читаете из «${topSource.sourceName}» (${topSource.count} книг).` : 'Данные будут отображены после добавления книг.'}
                </Paragraph>
                <Text style={styles.sectionTitle}>Любимые типы</Text>
                <Paragraph style={styles.secondaryText}>
                  {topType ? `Тип «${topType.typeName}» встречается ${topType.count} раз.` : 'Добавьте книги, чтобы определить любимый тип.'}
                </Paragraph>
              </Space>

              <Divider />

              <Title level={5} style={{ marginBottom: 8 }}>
                Достижения
              </Title>
              <Paragraph style={styles.secondaryText}>
                Значки рассчитываются автоматически на основе вашей аналитики чтения.
              </Paragraph>

              <div style={styles.achievementsGrid}>
                {achievements.map((achievement) => (
                  <Card
                    key={achievement.key}
                    hoverable
                    style={{
                      ...styles.achievementCard,
                      opacity: achievement.earned ? 1 : 0.72,
                      borderColor: achievement.earned ? undefined : '#e5e7eb'
                    }}
                  >
                    <Space align="start" size="middle">
                      <Image src={achievement.badge} width={72} height={72} preview={false} style={styles.badgeImage} />
                      <div>
                        <Title level={5} style={{ margin: 0 }}>
                          {achievement.title}
                        </Title>
                        <Paragraph style={{ margin: '4px 0 8px' }}>{achievement.description}</Paragraph>
                        <Tag color={achievement.earned ? 'green' : 'default'}>
                          {achievement.earned ? 'Получено' : 'В процессе'}
                        </Tag>
                      </div>
                    </Space>
                  </Card>
                ))}
              </div>
            </>
          )}
        </Flex>

        <Card style={styles.sideCard} bodyStyle={styles.sideCardBody} title="Личная аналитика" bordered={false}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text style={styles.sectionTitle}>Прогресс чтения</Text>
              <Progress percent={completionPercent} status="active" strokeColor="#52c41a" />
            </div>
            <div>
              <Text style={styles.sectionTitle}>Доля избранных</Text>
              <Progress
                percent={favoritePercent}
                status={favoritePercent > 40 ? 'success' : 'active'}
                strokeColor={favoritePercent > 40 ? '#13c2c2' : undefined}
              />
            </div>
            <div>
              <Text style={styles.sectionTitle}>Любимый тип</Text>
              <Paragraph style={styles.secondaryText}>
                {topType ? `«${topType.typeName}» — ${topType.count} книг` : 'Ещё не определён'}
              </Paragraph>
            </div>
            <div>
              <Text style={styles.sectionTitle}>Любимый источник</Text>
              <Paragraph style={styles.secondaryText}>
                {topSource ? `«${topSource.sourceName}» — ${topSource.count} книг` : 'Ещё не определён'}
              </Paragraph>
            </div>
          </Space>
        </Card>
      </Flex>
    </Card>
  );
};
