import React, { useMemo, useState } from 'react';
import { Avatar, Button, Card, Grid, Space, Tooltip, Typography, theme } from 'antd';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  HeartFilled,
  HeartOutlined,
  MessageOutlined,
  PlusOutlined,
  QuestionOutlined,
  StarFilled,
  UserOutlined
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Activity, PublicReview, ReactionKind } from '@/shared/types/library';
import { activityMeta, reactionMeta } from '@/shared/constants/social';
import { coverUrl } from '@/entities/book';
import { reactToReview, removeReviewReaction } from '@/entities/review';
import { useRequestError } from '@/shared/lib/errors';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { formatDateTime } from '@/shared/lib/date';
import { formatScore } from '@/shared/lib/format';
import { pluralize } from '@/shared/lib/plural';
import { ReviewThreadPanel } from '@/widgets/review-thread';
import { useFeedPostStyles } from './FeedPost.styles';

interface Props {
  event: Activity;
  review: PublicReview;
  /** Свой отзыв реакцией не отмечают: чипы остаются на месте, но не нажимаются. */
  own?: boolean;
}

const REACTION_ICONS: Record<ReactionKind, React.ReactNode> = {
  LIKE: <HeartOutlined />,
  WANT_TO_READ: <PlusOutlined />,
  DISAGREE: <QuestionOutlined />
};

/** «Стругацкие · 1972 · 224 стр.» — подпись под названием из того, что у записи заполнено. */
const metaLine = (review: PublicReview) =>
  [
    review.authorNames.join(', ') || undefined,
    review.publishedYear ? String(review.publishedYear) : undefined,
    review.pageCount ? `${review.pageCount} стр.` : undefined
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Отзыв в ленте — пост, а не строка списка.
 *
 * Отзыв — главное, что человек пишет в трекере, и он получает карточку целиком: обложка, текст,
 * спойлер под катом, реакции и обсуждение прямо здесь. Раскрывающаяся «гармошка» на его месте
 * означала, что самое ценное в ленте по умолчанию свёрнуто.
 */
export const ReviewPost: React.FC<Props> = ({ event, review, own }) => {
  const { token } = theme.useToken();
  const styles = useFeedPostStyles();
  const screens = Grid.useBreakpoint();
  const showRequestError = useRequestError();

  const [spoiler, setSpoiler] = useState(false);
  const [thread, setThread] = useState(false);
  /*
   * Счётчик и своя отметка живут здесь: они приходят вместе с лентой, и после нажатия их
   * пересчитывает ответ сервера. Перезагружать ради этого всю ленту незачем.
   */
  const [reaction, setReaction] = useState<ReactionKind | undefined>(review.myReaction);
  const [reactionCount, setReactionCount] = useState(review.reactionCount);
  const [busy, setBusy] = useState(false);

  const actorName = event.actor.displayName || event.actor.username;
  const meta = useMemo(() => metaLine(review), [review]);

  /** Повторное нажатие снимает отметку: отдельной кнопки «убрать» нет намеренно. */
  const toggle = async (kind: ReactionKind) => {
    setBusy(true);
    try {
      const next = reaction === kind ? await removeReviewReaction(review.itemId) : await reactToReview(review.itemId, kind);
      setReaction(next.myReaction);
      setReactionCount(Object.values(next.reactions).reduce((sum, count) => sum + (count ?? 0), 0));
    } catch (error) {
      showRequestError(error, 'Не удалось отметить отзыв');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card} styles={{ body: styles.body }}>
      <div style={styles.head}>
        <Link to={`/u/${event.actor.username}`}>
          <Avatar
            size={40}
            icon={<UserOutlined />}
            src={event.actor.hasAvatar ? `/api/v1/users/${event.actor.id}/avatar` : undefined}
          />
        </Link>
        <div style={styles.headText}>
          <div>
            <Link to={`/u/${event.actor.username}`}>
              <Typography.Text strong>{actorName}</Typography.Text>
            </Link>{' '}
            <Typography.Text type="secondary">{activityMeta[event.type].label}</Typography.Text>
          </div>
          <Typography.Text type="secondary" style={styles.time}>
            {formatDateTime(event.createdAt)}
          </Typography.Text>
        </div>
        {review.rating != null && (
          <Typography.Text strong style={styles.rating}>
            <StarFilled style={{ color: token.colorWarning }} /> {formatScore(review.rating)}
          </Typography.Text>
        )}
      </div>

      <div style={screens.sm ? styles.bodyRow : styles.bodyColumn}>
        <Link to={`/library/${review.itemId}`} style={{ flexShrink: 0 }}>
          <CoverThumb
            src={review.hasCover ? coverUrl(review.itemId) : undefined}
            title={review.title}
            kind={review.kind}
            width={84}
            height={118}
          />
        </Link>
        <div style={styles.text}>
          <Link to={`/library/${review.itemId}`}>
            <Typography.Text className="brand-display" style={styles.title}>
              {review.title}
            </Typography.Text>
          </Link>
          {meta && (
            <Typography.Text type="secondary" style={styles.meta}>
              {meta}
            </Typography.Text>
          )}
          {review.review && <Typography.Paragraph style={styles.review}>{review.review}</Typography.Paragraph>}
          {review.reviewSpoiler && (
            /* Спойлер приходит отдельным полем — прячем целиком, а не режем текст. */
            <>
              <Button
                size="small"
                shape="round"
                icon={spoiler ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setSpoiler((open) => !open)}
              >
                {spoiler ? 'Скрыть спойлеры' : 'Показать спойлеры'}
              </Button>
              {spoiler && <Typography.Paragraph style={styles.spoiler}>{review.reviewSpoiler}</Typography.Paragraph>}
            </>
          )}
        </div>
      </div>

      <div style={styles.actions}>
        <Space size={8} wrap>
          <Tooltip
            title={own ? 'Свой отзыв реакцией не отмечают' : `${reactionMeta.LIKE.label} · отметок всего ${reactionCount}`}
          >
            <Button
              shape="round"
              disabled={own}
              loading={busy}
              type={reaction === 'LIKE' ? 'primary' : 'default'}
              icon={reaction === 'LIKE' ? <HeartFilled /> : REACTION_ICONS.LIKE}
              onClick={() => toggle('LIKE')}
              /* Без явной подписи диктор читает кнопку как «сердце 24» — знак вместо действия. */
              aria-label={`${reactionMeta.LIKE.label}: ${reactionCount}`}
            >
              {reactionCount}
            </Button>
          </Tooltip>
          <Tooltip title={own ? 'Свой отзыв реакцией не отмечают' : reactionMeta.WANT_TO_READ.label}>
            <Button
              shape="round"
              disabled={own}
              loading={busy}
              type={reaction === 'WANT_TO_READ' ? 'primary' : 'default'}
              icon={REACTION_ICONS.WANT_TO_READ}
              onClick={() => toggle('WANT_TO_READ')}
              aria-label={reactionMeta.WANT_TO_READ.label}
            >
              В свою библиотеку
            </Button>
          </Tooltip>
          <Tooltip title={own ? 'Свой отзыв реакцией не отмечают' : reactionMeta.DISAGREE.label}>
            <Button
              shape="round"
              disabled={own}
              loading={busy}
              type={reaction === 'DISAGREE' ? 'primary' : 'default'}
              icon={REACTION_ICONS.DISAGREE}
              onClick={() => toggle('DISAGREE')}
              aria-label={reactionMeta.DISAGREE.label}
            >
              {reactionMeta.DISAGREE.label}
            </Button>
          </Tooltip>
          {/* Тред грузится по нажатию: раскрытым под каждым постом он стоил бы запроса на карточку. */}
          <Button
            shape="round"
            icon={<MessageOutlined />}
            onClick={() => setThread((open) => !open)}
            aria-label={
              review.commentCount > 0
                ? `Обсуждение: ${pluralize(review.commentCount, ['комментарий', 'комментария', 'комментариев'])}`
                : 'Обсудить отзыв'
            }
          >
            {review.commentCount > 0
              ? pluralize(review.commentCount, ['комментарий', 'комментария', 'комментариев'])
              : 'Обсудить'}
          </Button>
        </Space>
      </div>

      {thread && (
        <div style={styles.thread}>
          <ReviewThreadPanel itemId={review.itemId} own={own} reactions={false} />
        </div>
      )}
    </Card>
  );
};
