import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Collapse,
  Empty,
  List,
  Rate,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography
} from 'antd';
import { FireOutlined, GlobalOutlined, TrophyOutlined, UserOutlined } from '@ant-design/icons';
import { Activity, PublicProfile } from '@/shared/types/library';
import { activityMeta } from '@/shared/constants/social';
import { getMediaKindLabel } from '@/shared/constants/mediaKind';
import { formatDate, formatDateTime } from '@/shared/lib/date';
import { getErrorMessage, useRequestError } from '@/shared/lib/errors';
import { pluralize } from '@/shared/lib/plural';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { ReviewThreadPanel } from '@/widgets/review-thread';
import { fetchProfile, fetchProfileActivity, followUser, unfollowUser } from '@/entities/profile';

/**
 * Страница {@code /u/username}. Закрытый профиль сервер отдаёт как отсутствующий, поэтому здесь
 * не нужно различать «нет такого» и «не показывают»: и то и другое — одна и та же страница.
 */
export const UserProfilePage: React.FC = () => {
  const { username = '' } = useParams();
  const showRequestError = useRequestError();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loaded, events] = await Promise.all([fetchProfile(username), fetchProfileActivity(username, 20)]);
      setProfile(loaded);
      setActivity(events);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Профиль не найден или закрыт'));
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async () => {
    if (!profile) return;
    setFollowing(true);
    try {
      setProfile(profile.followedByMe ? await unfollowUser(profile.username) : await followUser(profile.username));
    } catch (requestError) {
      showRequestError(requestError, 'Не удалось изменить подписку');
    } finally {
      setFollowing(false);
    }
  };

  if (loading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (error || !profile) {
    return (
      <Alert
        type="info"
        showIcon
        message="Профиль недоступен"
        description={error ?? 'Такого пользователя нет или он не открывал свой профиль.'}
      />
    );
  }

  const avatarSrc = profile.hasAvatar ? `/api/v1/users/${profile.id}/avatar` : undefined;

  return (
    <div>
      <PageHeader
        title={profile.displayName || profile.username}
        subtitle={`@${profile.username}${profile.joinedAt ? ` · с нами с ${formatDate(profile.joinedAt)}` : ''}`}
        actions={
          profile.me ? (
            <Link to="/profile">
              <Button>Настроить профиль</Button>
            </Link>
          ) : (
            <Button type={profile.followedByMe ? 'default' : 'primary'} loading={following} onClick={toggleFollow}>
              {profile.followedByMe ? 'Отписаться' : 'Подписаться'}
            </Button>
          )
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space align="start" size={16} wrap>
          <Avatar size={72} src={avatarSrc} icon={<UserOutlined />} />
          <Space direction="vertical" size={6} style={{ maxWidth: 640 }}>
            {profile.bio ? (
              <Typography.Paragraph style={{ marginBottom: 0 }}>{profile.bio}</Typography.Paragraph>
            ) : (
              <Typography.Text type="secondary">О себе пока ничего не написано.</Typography.Text>
            )}
            <Space size={8} wrap>
              <Tag bordered={false}>
                {pluralize(profile.followerCount, ['подписчик', 'подписчика', 'подписчиков'])}
              </Tag>
              <Tag bordered={false}>{profile.followingCount} в подписках</Tag>
              {!profile.publicProfile && (
                <Tag color="warning" bordered={false}>
                  профиль закрыт — его видите только вы
                </Tag>
              )}
            </Space>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <StatTile label="Дочитано" value={profile.finishedCount} />
        </Col>
        <Col xs={12} md={6}>
          <StatTile label="Отзывов" value={profile.reviewCount} />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            label="Средняя оценка"
            value={profile.averageRating ? profile.averageRating.toFixed(1) : '—'}
            hint={profile.averageRating ? 'из 10' : 'оценок пока нет'}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            label="Серия"
            value={profile.currentStreak}
            hint={`${pluralize(profile.achievementCount, ['достижение', 'достижения', 'достижений'])}`}
            icon={<FireOutlined />}
            accent="#f97316"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Отзывы" style={{ marginBottom: 16 }}>
            {profile.reviews.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Отзывов пока нет" />
            ) : (
              <List
                itemLayout="vertical"
                dataSource={profile.reviews}
                renderItem={(review) => (
                  <List.Item key={review.itemId}>
                    <List.Item.Meta
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>{review.title}</Typography.Text>
                          <Tag bordered={false}>{getMediaKindLabel(review.kind)}</Tag>
                          {review.rating !== undefined && (
                            <Rate disabled allowHalf count={5} value={review.rating / 2} style={{ fontSize: 14 }} />
                          )}
                        </Space>
                      }
                      description={
                        <Typography.Text type="secondary">
                          {review.authorNames.join(', ') || 'автор не указан'}
                          {review.finishedAt ? ` · дочитано ${formatDate(review.finishedAt)}` : ''}
                        </Typography.Text>
                      }
                    />
                    <Typography.Paragraph>{review.review}</Typography.Paragraph>
                    {review.reviewSpoiler && (
                      /* Спойлер приходит отдельным полем — прячем целиком, а не режем текст. */
                      <Collapse
                        ghost
                        size="small"
                        items={[
                          {
                            key: 'spoiler',
                            label: 'Показать спойлеры',
                            children: <Typography.Paragraph>{review.reviewSpoiler}</Typography.Paragraph>
                          }
                        ]}
                      />
                    )}
                    <Collapse
                      ghost
                      size="small"
                      items={[
                        {
                          key: 'thread',
                          label: `Обсуждение · ${review.reactionCount} реакций, ${review.commentCount} комментариев`,
                          children: <ReviewThreadPanel itemId={review.itemId} own={profile.me} />
                        }
                      ]}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Открытые полки" style={{ marginBottom: 16 }}>
            {profile.shelves.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Открытых полок нет" />
            ) : (
              <List
                dataSource={profile.shelves}
                renderItem={(shelf) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<GlobalOutlined />}
                      title={shelf.name}
                      description={
                        <Space direction="vertical" size={0}>
                          <Typography.Text type="secondary">
                            {pluralize(shelf.itemCount, ['запись', 'записи', 'записей'])}
                            {shelf.isPublic ? '' : ' · видна только вам'}
                          </Typography.Text>
                          {shelf.description && (
                            <Typography.Text type="secondary">{shelf.description}</Typography.Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card title="Активность">
            {activity.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока тихо" />
            ) : (
              <List
                dataSource={activity}
                renderItem={(event) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={event.type === 'UNLOCKED_ACHIEVEMENT' ? <TrophyOutlined /> : undefined}
                      title={
                        <Space size={8} wrap>
                          <Tag color={activityMeta[event.type].color} bordered={false}>
                            {activityMeta[event.type].label}
                          </Tag>
                          <Typography.Text>{event.subject}</Typography.Text>
                        </Space>
                      }
                      description={
                        <Typography.Text type="secondary">
                          {formatDateTime(event.createdAt)}
                          {event.detail ? ` · ${event.detail}` : ''}
                        </Typography.Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
