import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AutoComplete, Avatar, Button, Card, Collapse, Empty, Input, List, Skeleton, Space, Tag, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Activity, ProfileSummary } from '@/shared/types/library';
import { activityMeta } from '@/shared/constants/social';
import { formatDateTime } from '@/shared/lib/date';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { useRequestError } from '@/shared/lib/errors';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ReviewThreadPanel } from '@/widgets/review-thread';
import { fetchFeed, followUser, searchProfiles } from '@/entities/profile';

/**
 * Лента подписок вместе со своими событиями: пустая лента у нового пользователя бесполезна,
 * а рядом с ней сразу стоит поиск людей — иначе подписаться было бы не на кого.
 */
export const FeedPage: React.FC = () => {
  const showRequestError = useRequestError();
  const [events, setEvents] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<ProfileSummary[]>([]);
  const debouncedQuery = useDebouncedValue(query, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await fetchFeed(50));
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить ленту');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    searchProfiles(debouncedQuery.trim())
      .then((found) => {
        if (!cancelled) setCandidates(found);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const follow = async (username: string) => {
    try {
      await followUser(username);
      setQuery('');
      setCandidates([]);
      await load();
    } catch (error) {
      showRequestError(error, 'Не удалось подписаться');
    }
  };

  return (
    <div>
      <PageHeader
        title="Лента"
        subtitle="Что читают те, на кого вы подписаны"
        actions={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Обновить
          </Button>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <AutoComplete
          style={{ width: '100%', maxWidth: 460 }}
          value={query}
          onChange={setQuery}
          options={candidates.map((candidate) => ({
            value: candidate.username,
            label: (
              <Space size={8} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Space size={8}>
                  <Avatar
                    size={22}
                    icon={<UserOutlined />}
                    src={candidate.hasAvatar ? `/api/v1/users/${candidate.id}/avatar` : undefined}
                  />
                  <span>{candidate.displayName || candidate.username}</span>
                </Space>
                {candidate.followedByMe ? (
                  <Tag bordered={false}>уже в подписках</Tag>
                ) : (
                  <Typography.Link onClick={() => follow(candidate.username)}>подписаться</Typography.Link>
                )}
              </Space>
            )
          }))}
        >
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Найти читателя по логину — показываются только открытые профили"
          />
        </AutoComplete>
      </Card>

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : events.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Пока пусто. Подпишитесь на кого-нибудь — или дочитайте книгу, и здесь появится ваше событие."
        />
      ) : (
        <Card>
          <List
            itemLayout="vertical"
            dataSource={events}
            renderItem={(event) => (
              <List.Item key={event.id}>
                <List.Item.Meta
                  avatar={
                    <Avatar
                      icon={<UserOutlined />}
                      src={event.actor.hasAvatar ? `/api/v1/users/${event.actor.id}/avatar` : undefined}
                    />
                  }
                  title={
                    <Space size={8} wrap>
                      <Link to={`/u/${event.actor.username}`}>
                        <Typography.Text strong>{event.actor.displayName || event.actor.username}</Typography.Text>
                      </Link>
                      <Tag color={activityMeta[event.type].color} bordered={false}>
                        {activityMeta[event.type].label}
                      </Tag>
                      <Typography.Text>{event.subject}</Typography.Text>
                      {event.detail && <Typography.Text type="secondary">· {event.detail}</Typography.Text>}
                    </Space>
                  }
                  description={<Typography.Text type="secondary">{formatDateTime(event.createdAt)}</Typography.Text>}
                />
                {event.type === 'PUBLISHED_REVIEW' && event.itemId && (
                  <Collapse
                    ghost
                    size="small"
                    items={[
                      {
                        key: 'thread',
                        label: 'Обсудить отзыв',
                        children: <ReviewThreadPanel itemId={event.itemId} />
                      }
                    ]}
                  />
                )}
              </List.Item>
            )}
          />
        </Card>
      )}

      <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
        В ленту попадают только открытые профили. Закрыв свой профиль в настройках, вы убираете из чужих
        лент и то, что успели написать раньше.
      </Typography.Paragraph>
    </div>
  );
};
