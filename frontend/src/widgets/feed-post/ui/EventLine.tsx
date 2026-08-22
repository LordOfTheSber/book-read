import React from 'react';
import { Avatar, Card, Grid, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Activity } from '@/shared/types/library';
import { activityMeta } from '@/shared/constants/social';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { formatDateTime } from '@/shared/lib/date';
import { useFeedPostStyles } from './FeedPost.styles';

interface Props {
  event: Activity;
}

/**
 * Мелкое событие — одна строка: «Аня дочитала „Тёмный лес“ · 512 страниц за 11 дней».
 *
 * Дочитанное и начатое случается на порядок чаще отзывов, и в карточке той же высоты они
 * вытеснили бы из ленты то единственное, ради чего её открывают.
 * <p>
 * Обложка здесь всегда бумажная заглушка: событие несёт снимок названия, а не саму запись, и
 * ходить за настоящей обложкой пришлось бы запросом на строку.
 */
export const EventLine: React.FC<Props> = ({ event }) => {
  const styles = useFeedPostStyles();
  const screens = Grid.useBreakpoint();
  const actorName = event.actor.displayName || event.actor.username;

  return (
    <Card style={styles.card} styles={{ body: styles.lineBody }}>
      <Link to={`/u/${event.actor.username}`}>
        <Avatar
          size={34}
          icon={<UserOutlined />}
          src={event.actor.hasAvatar ? `/api/v1/users/${event.actor.id}/avatar` : undefined}
        />
      </Link>
      <Typography.Text style={styles.lineText}>
        <Link to={`/u/${event.actor.username}`}>
          <Typography.Text strong>{actorName}</Typography.Text>
        </Link>{' '}
        <Typography.Text type="secondary">{activityMeta[event.type].label}</Typography.Text>
        {event.subject && ` «${event.subject}»`}
        {event.detail && <Typography.Text type="secondary"> · {event.detail}</Typography.Text>}
      </Typography.Text>
      {/* Обложка — только у событий вокруг записи: у цели года и достижения книги нет,
          и корешок на их месте обещал бы карточку, которой не существует. */}
      {screens.sm && event.itemId && event.subject && (
        <CoverThumb title={event.subject} width={30} height={44} radius={6} />
      )}
      <Typography.Text type="secondary" style={styles.lineTime}>
        {formatDateTime(event.createdAt)}
      </Typography.Text>
    </Card>
  );
};
