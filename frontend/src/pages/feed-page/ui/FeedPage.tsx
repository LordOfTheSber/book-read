import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AutoComplete, Avatar, Button, Card, Col, Empty, Input, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Activity, ProfileSummary, TrendingBook } from '@/shared/types/library';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { useRequestError } from '@/shared/lib/errors';
import { pluralize } from '@/shared/lib/plural';
import { PageHeader } from '@/shared/ui/PageHeader';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { useAppSelector } from '@/shared/lib/hooks';
import { EventLine, ReviewPost } from '@/widgets/feed-post';
import { fetchFeed, fetchTrending, followUser, searchProfiles } from '@/entities/profile';
import { useFeedPageStyles } from './FeedPage.styles';

/**
 * Лента как стена постов, а не журнал строк.
 *
 * Отзыв — главное, что человек пишет в трекере, поэтому он получает карточку целиком: обложка,
 * текст, спойлер под катом, реакции и обсуждение здесь же. Мелкие события сжаты в строку, иначе
 * «начал читать» вытесняет с экрана то единственное, ради чего ленту открывают.
 * <p>
 * Справа — поиск людей (без него подписаться не на кого) и сводка недели: у пустой ленты
 * должно быть хоть что-то, с чего начать.
 */
export const FeedPage: React.FC = () => {
  const showRequestError = useRequestError();
  const styles = useFeedPageStyles();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [events, setEvents] = useState<Activity[]>([]);
  const [trending, setTrending] = useState<TrendingBook[]>([]);
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

  /*
   * Сводка недели грузится отдельно и молча: она стоит сбоку, и её падение не повод показывать
   * ошибку поверх ленты, которая пришла.
   */
  useEffect(() => {
    let cancelled = false;
    fetchTrending()
      .then((found) => {
        if (!cancelled) setTrending(found);
      })
      .catch(() => {
        if (!cancelled) setTrending([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const search = (
    <Card style={styles.railCard} styles={{ body: styles.railBody }}>
      <AutoComplete
        style={{ width: '100%' }}
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
        <Input allowClear prefix={<SearchOutlined />} placeholder="Найти читателя" />
      </AutoComplete>
      <Typography.Text type="secondary" style={styles.railHint}>
        Показываются только открытые профили.
      </Typography.Text>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Лента"
        subtitle="Отзывы и находки тех, на кого вы подписаны"
        actions={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Обновить
          </Button>
        }
      />

      <Row gutter={[20, 20]} align="top">
        <Col xs={24} lg={16} xl={17}>
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : events.length === 0 ? (
            <Card style={styles.railCard} styles={{ body: styles.emptyBody }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Пока пусто. Подпишитесь на кого-нибудь — или дочитайте книгу, и здесь появится ваше событие."
              />
            </Card>
          ) : (
            <div style={styles.posts}>
              {events.map((event) =>
                /* Отзыв без текста — это уже не пост: сервер не отдал его, значит показывать
                   нечего, и событие сжимается в строку, как остальные. */
                event.review ? (
                  <ReviewPost
                    key={event.id}
                    event={event}
                    review={event.review}
                    own={event.actor.id === currentUser?.id}
                  />
                ) : (
                  <EventLine key={event.id} event={event} />
                )
              )}
            </div>
          )}

          <Typography.Paragraph type="secondary" style={styles.notice}>
            В ленту попадают только открытые профили. Закрыв свой профиль в настройках, вы убираете из
            чужих лент и то, что успели написать раньше.
          </Typography.Paragraph>
        </Col>

        <Col xs={24} lg={8} xl={7}>
          <div style={styles.rail}>
            {search}

            {trending.length > 0 && (
              <Card style={styles.railCard} styles={{ body: styles.railBody }}>
                <Typography.Text type="secondary" style={styles.railTitle}>
                  Обсуждают на этой неделе
                </Typography.Text>
                <div style={styles.trending}>
                  {trending.map((book) => (
                    <Link key={book.itemId} to={`/library/${book.itemId}`} style={styles.trendingRow}>
                      <CoverThumb title={book.title} kind={book.kind} width={34} height={48} radius={8} />
                      <span style={styles.trendingText}>
                        <Typography.Text ellipsis={{ tooltip: book.title }} style={styles.trendingTitle}>
                          {book.title}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={styles.trendingHint}>
                          {[
                            book.reviewCount > 0
                              ? pluralize(book.reviewCount, ['отзыв', 'отзыва', 'отзывов'])
                              : undefined,
                            book.commentCount > 0
                              ? pluralize(book.commentCount, ['комментарий', 'комментария', 'комментариев'])
                              : undefined
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Typography.Text>
                      </span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
};
