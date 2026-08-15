import React, { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Image,
  Input,
  Row,
  Segmented,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
  Upload,
  theme
} from 'antd';
import type { UploadProps } from 'antd';
import { Link } from 'react-router-dom';
import {
  BookOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  HeartOutlined,
  StarOutlined,
  TrophyOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { fetchMyProfile, updateMyProfile } from '@/entities/profile';
import { fetchAchievements } from '@/entities/engagement';
import { Achievement as ServerAchievement, PublicProfile } from '@/shared/types/library';
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
import { MyDataCard } from '@/features/account/manage-my-data';
import { useProfilePageStyles } from './ProfilePage.styles';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

const statusOrder: ReadingStatus[] = ['READING', 'COMPLETED', 'PLANNED', 'DROPPED'];

interface ProfileFormValues {
  displayName?: string;
  bio?: string;
  publicProfile: boolean;
}

export const ProfilePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useProfilePageStyles();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const { mode, setMode } = useThemeMode();
  const [avatarPreview, setAvatarPreview] = useState(false);
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [achievements, setAchievements] = useState<ServerAchievement[]>([]);

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

  // Достижения и настройки публичности приходят с сервера: считать их на клиенте значило бы
  // завести вторую систему достижений, расходящуюся с той, что попадает в ленту.
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyProfile(), fetchAchievements()])
      .then(([profile, unlocked]) => {
        if (cancelled) return;
        setPublicProfile(profile);
        setAchievements(unlocked);
        profileForm.setFieldsValue({
          displayName: profile.displayName,
          bio: profile.bio,
          publicProfile: profile.publicProfile
        });
      })
      .catch((error) => {
        if (!cancelled) showRequestError(error, 'Не удалось загрузить профиль');
      });
    return () => {
      cancelled = true;
    };
  }, [profileForm, showRequestError]);

  const saveProfile = async (values: ProfileFormValues) => {
    setSavingProfile(true);
    try {
      setPublicProfile(await updateMyProfile(values));
      message.success('Профиль сохранён');
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить профиль');
    } finally {
      setSavingProfile(false);
    }
  };

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

  const unlocked = achievements.filter((achievement) => achievement.unlocked);
  const unlockedCount = unlocked.length;

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

      <Card
        title="Публичная страница"
        style={styles.card}
        styles={{ body: styles.cardBody }}
        extra={
          user && (
            <Link to={`/u/${user.username}`}>
              {publicProfile?.publicProfile ? 'Открыть страницу' : 'Посмотреть, пока её видите только вы'}
            </Link>
          )
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Открытый профиль виден другим пользователям сервиса по адресу /u/{user?.username}: имя, описание,
          публичные полки и отзывы. Анонимным посетителям он не открывается. Закрыв профиль, вы убираете
          свои события и из чужих лент.
        </Typography.Paragraph>
        <Form form={profileForm} layout="vertical" onFinish={saveProfile}>
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <Form.Item name="displayName" label="Имя для показа" tooltip="Логин остаётся прежним — он в адресе">
                <Input placeholder={user?.username} maxLength={128} />
              </Form.Item>
            </Col>
            <Col xs={24} md={14}>
              <Form.Item name="bio" label="О себе">
                <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={2000} />
              </Form.Item>
            </Col>
          </Row>
          <Space size={16} wrap>
            <Form.Item name="publicProfile" valuePropName="checked" noStyle>
              <Switch checkedChildren="открыт" unCheckedChildren="закрыт" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={savingProfile}>
              Сохранить
            </Button>
            {publicProfile && (
              <Typography.Text type="secondary">
                {pluralize(publicProfile.followerCount, ['подписчик', 'подписчика', 'подписчиков'])} ·{' '}
                {publicProfile.followingCount} в подписках
              </Typography.Text>
            )}
          </Space>
        </Form>
      </Card>

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
                <TrophyOutlined /> {unlockedCount} из {achievements.length}
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

        <Col xs={24}>
          <MyDataCard />
        </Col>
      </Row>
    </div>
  );
};
