import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  Image,
  Row,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Typography,
  Upload,
  theme
} from 'antd';
import type { UploadProps } from 'antd';
import {
  BookOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  HeartOutlined,
  RiseOutlined,
  StarOutlined,
  TagsOutlined,
  TrophyOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { uploadAvatarThunk } from '@/entities/auth';
import { loadBookAnalytics } from '@/entities/analytics';
import { themeOptions, useThemeMode } from '@/app/providers/ThemeProvider';
import { ReadingStatus } from '@/shared/types/library';
import { statusMeta } from '@/shared/constants/status';
import { roleMeta } from '@/shared/constants/roles';
import { formatDate } from '@/shared/lib/date';
import { useRequestError } from '@/shared/lib/errors';
import { pluralize } from '@/shared/lib/plural';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { BarList } from '@/shared/ui/BarList';
import { MetricList } from '@/shared/ui/MetricList';
import { UsageMeter } from '@/shared/ui/UsageMeter';
import { useProfilePageStyles } from './ProfilePage.styles';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

const statusOrder: ReadingStatus[] = ['READING', 'COMPLETED', 'PLANNED', 'DROPPED'];

interface Achievement {
  key: string;
  title: string;
  description: string;
  earned: boolean;
  icon: React.ReactNode;
  color: string;
}

export const ProfilePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useProfilePageStyles();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const { mode, setMode } = useThemeMode();
  const [avatarPreview, setAvatarPreview] = useState(false);

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

  const avatarSrc =
    user?.avatar && user.avatarContentType ? `data:${user.avatarContentType};base64,${user.avatar}` : undefined;

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

  const achievements = useMemo<Achievement[]>(
    () => [
      {
        key: 'first-book',
        title: 'Первый том',
        description: 'Добавьте хотя бы одну книгу, чтобы начать путь читателя.',
        earned: total >= 1,
        icon: <BookOutlined />,
        color: '#f59e0b'
      },
      {
        key: 'finisher',
        title: 'Законченный читатель',
        description: 'Завершите 5 книг — знак настойчивости.',
        earned: completed >= 5,
        icon: <CheckCircleOutlined />,
        color: '#22c55e'
      },
      {
        key: 'collector',
        title: 'Коллекционер избранного',
        description: 'Три книги в избранном показывают ваши вкусы.',
        earned: favorites >= 3,
        icon: <HeartOutlined />,
        color: '#ec4899'
      },
      {
        key: 'focused-genre',
        title: topType ? `Верность типу «${topType.typeName}»` : 'Верность типу',
        description: topType
          ? `В коллекции ${pluralize(topType.count, ['книга', 'книги', 'книг'])} типа «${topType.typeName}».`
          : 'Добавьте книги, чтобы увидеть любимый тип.',
        earned: Boolean(topType && topType.count >= 3),
        icon: <TagsOutlined />,
        color: '#3b82f6'
      },
      {
        key: 'steady',
        title: 'Без брошенных',
        description: 'Держите планку и не бросайте книги на полпути.',
        earned: total > 0 && dropped === 0,
        icon: <RiseOutlined />,
        color: '#14b8a6'
      },
      {
        key: 'rating',
        title: 'Строгий критик',
        description: 'Средняя оценка выше 7,0.',
        earned: (averageRating ?? 0) >= 7,
        icon: <StarOutlined />,
        color: '#a855f7'
      }
    ],
    [averageRating, completed, dropped, favorites, topType, total]
  );

  const earnedCount = achievements.filter((achievement) => achievement.earned).length;

  const handleAvatarUpload: UploadProps['beforeUpload'] = async (file) => {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      message.error('Поддерживаются только PNG, JPEG, WEBP или GIF');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      message.error('Размер файла не должен превышать 2 МБ');
      return Upload.LIST_IGNORE;
    }
    try {
      await dispatch(uploadAvatarThunk(file)).unwrap();
      message.success('Аватар обновлён');
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить аватар');
    }
    // false — загружаем сами через thunk, встроенный аплоад antd не нужен.
    return false;
  };

  return (
    <div style={styles.page}>
      <PageHeader title="Профиль" subtitle="Учётная запись, оформление и статистика чтения" />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={16}>
      <Card style={styles.card} styles={{ body: styles.cardBody }}>
        <div style={styles.identity}>
          {avatarSrc ? (
            <>
              <Avatar
                size={88}
                src={avatarSrc}
                style={styles.avatar}
                onClick={() => setAvatarPreview(true)}
              />
              <Image
                src={avatarSrc}
                style={{ display: 'none' }}
                preview={{ visible: avatarPreview, onVisibleChange: setAvatarPreview }}
              />
            </>
          ) : (
            <Avatar size={88} icon={<UserOutlined />} />
          )}

          <div style={styles.identityMeta}>
            <Typography.Title level={2} style={styles.username}>
              {user?.username}
            </Typography.Title>
            <Space size={8} wrap>
              {user?.role && (
                <Tag color={roleMeta[user.role]?.color ?? 'default'} bordered={false} style={styles.tag}>
                  {roleMeta[user.role]?.label ?? user.role}
                </Tag>
              )}
              {user?.createdAt && (
                <Typography.Text type="secondary">С нами с {formatDate(user.createdAt)}</Typography.Text>
              )}
            </Space>
          </div>

          <div style={styles.identityActions}>
            <Upload showUploadList={false} beforeUpload={handleAvatarUpload}>
              <Button icon={<CameraOutlined />} loading={updatingAvatar}>
                Сменить аватар
              </Button>
            </Upload>
          </div>
        </div>
      </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Оформление" style={styles.card} styles={{ body: styles.cardBody }}>
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
              Тема сохраняется в этом браузере.
            </Typography.Paragraph>
            <Segmented
              block
              value={mode}
              onChange={(value) => setMode(value as typeof mode)}
              options={themeOptions.map((option) => ({ label: option.label, value: option.value }))}
            />
          </Card>
        </Col>
      </Row>

      {analyticsError && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить статистику"
          description={analyticsError}
          style={styles.alert}
        />
      )}

      <div style={styles.stats}>
        <StatTile
          label="Всего книг"
          value={total}
          icon={<BookOutlined />}
          loading={analyticsLoading && !analytics}
        />
        <StatTile
          label="Завершено"
          value={completed}
          hint={completionPercent !== undefined ? `${completionPercent}% коллекции` : undefined}
          icon={<CheckCircleOutlined />}
          accent="#22c55e"
          loading={analyticsLoading && !analytics}
        />
        <StatTile
          label="Избранное"
          value={favorites}
          hint={favoritePercent !== undefined ? `${favoritePercent}% коллекции` : undefined}
          icon={<HeartOutlined />}
          accent="#ec4899"
          loading={analyticsLoading && !analytics}
        />
        <StatTile
          label="Средняя оценка"
          value={averageRating ? averageRating.toFixed(1) : '—'}
          hint={averageRating ? 'из 10' : 'оценок пока нет'}
          icon={<StarOutlined />}
          accent="#f59e0b"
          loading={analyticsLoading && !analytics}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Статусы чтения" style={styles.card} styles={{ body: styles.cardBody }}>
            {analyticsLoading && !analytics ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <BarList
                total={total}
                emptyText="Добавьте книги, чтобы увидеть распределение"
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

        <Col xs={24} lg={12}>
          <Card title="Предпочтения" style={styles.card} styles={{ body: styles.cardBody }}>
            {analyticsLoading && !analytics ? (
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
                <TrophyOutlined /> {earnedCount} из {achievements.length}
              </Typography.Text>
            }
          >
            <div style={styles.achievements}>
              {achievements.map((achievement) => (
                <div key={achievement.key} style={styles.achievementCard(achievement.earned)}>
                  <span style={styles.achievementIcon(achievement.color, achievement.earned)}>
                    {achievement.icon}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <Typography.Text strong>{achievement.title}</Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ margin: '4px 0 8px' }}>
                      {achievement.description}
                    </Typography.Paragraph>
                    <Tag
                      color={achievement.earned ? 'success' : 'default'}
                      bordered={false}
                      style={styles.tag}
                    >
                      {achievement.earned ? 'Получено' : 'В процессе'}
                    </Tag>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
