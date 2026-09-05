import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Grid,
  List,
  Modal,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography
} from 'antd';
import { AppstoreOutlined, UserOutlined } from '@ant-design/icons';
import { Activity, PublicProfile, Shelf, ShelfItem } from '@/shared/types/library';
import { formatDate } from '@/shared/lib/date';
import { formatScore } from '@/shared/lib/format';
import { getErrorMessage, useRequestError } from '@/shared/lib/errors';
import { plural, pluralize } from '@/shared/lib/plural';
import { useDocumentTitle } from '@/shared/lib/documentTitle';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { coverUrl } from '@/entities/book';
import { fetchProfile, fetchProfileActivity, followUser, unfollowUser } from '@/entities/profile';
import { fetchShelfItems } from '@/entities/shelf';
import { EventLine } from '@/widgets/feed-post';
import { PublicReviewCard } from './PublicReviewCard';
import { useUserProfilePageStyles } from './UserProfilePage.styles';

/**
 * Страница {@code /u/username} по макету `PublicPage.dc.html`.
 *
 * Отзывы, полки и активность лежали тремя карточками подряд, и до отзыва — единственного, ради
 * чего к чужому профилю и ходят, — нужно было прокрутить половину экрана. Теперь отзывы это
 * главное содержимое, остальное сжато в правую колонку, а к каждой книге добавлено то, чего
 * не было вовсе: «есть у вас» и число общих книг.
 *
 * Закрытый профиль сервер отдаёт как отсутствующий, поэтому здесь не нужно различать «нет такого»
 * и «не показывают»: и то и другое — одна и та же страница.
 */
export const UserProfilePage: React.FC = () => {
  const { username = '' } = useParams();
  const styles = useUserProfilePageStyles();
  const screens = Grid.useBreakpoint();
  const showRequestError = useRequestError();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState('reviews');
  const [preview, setPreview] = useState<{ shelf: Shelf; items: ShelfItem[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useDocumentTitle(profile ? profile.displayName || profile.username : 'Страница читателя');

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

  /** Открытая полка, которую нельзя открыть, — тупик: состав показывается прямо отсюда. */
  const openShelf = async (shelf: Shelf) => {
    setPreview({ shelf, items: [] });
    setPreviewLoading(true);
    try {
      setPreview({ shelf, items: await fetchShelfItems(shelf.id) });
    } catch (requestError) {
      showRequestError(requestError, 'Не удалось открыть полку');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return <Skeleton active avatar paragraph={{ rows: 6 }} />;
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

  const stats = [
    { label: 'Дочитано', value: profile.finishedCount },
    { label: 'Отзывов', value: profile.reviewCount },
    { label: 'Оценка', value: profile.averageRating != null ? formatScore(profile.averageRating) : '—' },
    { label: 'Серия', value: profile.currentStreak }
  ];

  const reviewsTab =
    profile.reviews.length === 0 ? (
      <Card style={styles.card}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Отзывов пока нет" />
      </Card>
    ) : (
      <div>
        {profile.reviews.map((review) => (
          <PublicReviewCard key={review.itemId} review={review} own={profile.me} />
        ))}
      </div>
    );

  const shelvesTab =
    profile.shelves.length === 0 ? (
      <Card style={styles.card}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Открытых полок нет" />
      </Card>
    ) : (
      <Card style={styles.card} styles={{ body: styles.cardBody }}>
        <List
          dataSource={profile.shelves}
          renderItem={(shelf) => (
            <List.Item
              actions={[
                <Button key="open" type="link" size="small" onClick={() => openShelf(shelf)}>
                  Открыть состав
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <span aria-hidden style={styles.shelfIcon}>
                    <AppstoreOutlined />
                  </span>
                }
                title={shelf.name}
                description={
                  <Space direction="vertical" size={0}>
                    <Typography.Text type="secondary">
                      {pluralize(shelf.itemCount, ['запись', 'записи', 'записей'])}
                      {shelf.isPublic ? '' : ' · видна только вам'}
                    </Typography.Text>
                    {shelf.description && <Typography.Text type="secondary">{shelf.description}</Typography.Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    );

  const activityTab =
    activity.length === 0 ? (
      <Card style={styles.card}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока тихо" />
      </Card>
    ) : (
      <Space direction="vertical" size={10} style={{ display: 'flex' }}>
        {activity.map((event) => (
          <EventLine key={event.id} event={event} />
        ))}
      </Space>
    );

  return (
    <div>
      <div style={styles.header}>
        <Avatar size={76} src={avatarSrc} icon={<UserOutlined />} style={{ flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Title level={1} className="brand-display" style={styles.name}>
            {profile.displayName || profile.username}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            {`@${profile.username}`}
            {profile.joinedAt ? ` · с нами с ${formatDate(profile.joinedAt)}` : ''}
          </Typography.Text>

          {profile.bio ? (
            <Typography.Paragraph style={styles.bio}>{profile.bio}</Typography.Paragraph>
          ) : (
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 10 }}>
              О себе пока ничего не написано.
            </Typography.Text>
          )}

          <div style={styles.counters}>
            <span>
              <Typography.Text strong>{profile.followerCount}</Typography.Text>{' '}
              <Typography.Text type="secondary">
                {plural(profile.followerCount, ['подписчик', 'подписчика', 'подписчиков'])}
              </Typography.Text>
            </span>
            <span>
              <Typography.Text strong>{profile.followingCount}</Typography.Text>{' '}
              <Typography.Text type="secondary">в подписках</Typography.Text>
            </span>
            {/* Общие книги — единственный ответ на вопрос «а что у нас общего»; в своём профиле его нет. */}
            {!profile.me && profile.commonCount > 0 && (
              <Typography.Text>
                {`${pluralize(profile.commonCount, ['общая книга', 'общие книги', 'общих книг'])} с вами`}
              </Typography.Text>
            )}
            {!profile.publicProfile && (
              <Tag color="warning" bordered={false}>
                профиль закрыт — его видите только вы
              </Tag>
            )}
          </div>
        </div>

        <Space size={8} style={{ flexShrink: 0 }}>
          {profile.me ? (
            <Link to="/profile">
              <Button>Настроить профиль</Button>
            </Link>
          ) : (
            <Button type={profile.followedByMe ? 'default' : 'primary'} loading={following} onClick={toggleFollow}>
              {profile.followedByMe ? 'Отписаться' : 'Подписаться'}
            </Button>
          )}
        </Space>
      </div>

      <div style={screens.lg ? styles.columns : styles.columnsNarrow}>
        <div style={{ minWidth: 0 }}>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              { key: 'reviews', label: `Отзывы · ${profile.reviewCount}`, children: reviewsTab },
              { key: 'shelves', label: `Полки · ${profile.shelves.length}`, children: shelvesTab },
              { key: 'activity', label: 'Активность', children: activityTab }
            ]}
          />
        </div>

        <div style={styles.side}>
          <Card style={styles.card} styles={{ body: styles.cardBody }}>
            <div style={styles.stats}>
              {stats.map((stat) => (
                <div key={stat.label}>
                  <Typography.Text type="secondary" style={styles.statLabel}>
                    {stat.label}
                  </Typography.Text>
                  <span style={styles.statValue}>{stat.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card style={styles.card} styles={{ body: styles.cardBody }} title="Открытые полки">
            {profile.shelves.length === 0 ? (
              <Typography.Text type="secondary">Открытых полок нет</Typography.Text>
            ) : (
              profile.shelves.map((shelf) => (
                <button key={shelf.id} type="button" style={styles.shelfRow} onClick={() => openShelf(shelf)}>
                  <span aria-hidden style={styles.shelfIcon}>
                    <AppstoreOutlined />
                  </span>
                  <Typography.Text style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500 }} ellipsis>
                    {shelf.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    {shelf.itemCount}
                  </Typography.Text>
                </button>
              ))
            )}
          </Card>

          {/* Что человек держит в руках прямо сейчас — самое живое, что есть на его странице. */}
          <Card style={styles.card} styles={{ body: styles.cardBody }} title="Сейчас читает">
            {profile.currentlyReading.length === 0 ? (
              <Typography.Text type="secondary">Сейчас ничего не читает</Typography.Text>
            ) : (
              <div style={styles.covers}>
                {profile.currentlyReading.map((item) => (
                  <Link key={item.id} to={`/library/${item.id}`} aria-label={`Открыть «${item.title}»`}>
                    <CoverThumb
                      src={item.hasCover ? coverUrl(item.id) : undefined}
                      title={item.title}
                      kind={item.kind}
                      width={64}
                      height={90}
                    />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        title={preview?.shelf.name}
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        footer={null}
        destroyOnHidden
        width={640}
      >
        {previewLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <List
            dataSource={preview?.items ?? []}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="На полке пока пусто" /> }}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta title={item.title} description={item.authorNames.join(', ') || 'автор не указан'} />
                {item.rating != null && (
                  <Typography.Text type="secondary">{formatScore(item.rating)} / 10</Typography.Text>
                )}
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
};
