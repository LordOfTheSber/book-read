import React, { useState } from 'react';
import { Button, Card, Tooltip, Typography } from 'antd';
import {
  CheckOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  HeartFilled,
  HeartOutlined,
  MessageOutlined,
  StarFilled
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { PublicReview } from '@/shared/types/library';
import { coverUrl } from '@/entities/book';
import { reactToReview, removeReviewReaction } from '@/entities/review';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { formatRelative } from '@/shared/lib/date';
import { formatScore } from '@/shared/lib/format';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';
import { ReviewThreadPanel } from '@/widgets/review-thread';
import { useUserProfilePageStyles } from './UserProfilePage.styles';

interface Props {
  review: PublicReview;
  /** Свой профиль: реакцию на собственный отзыв не ставят, обсуждение остаётся. */
  own?: boolean;
}

/**
 * Отзыв на чужой странице. Автор здесь один на всю страницу, поэтому строки «кто написал»
 * в карточке нет — в отличие от ленты, где она и отличает один пост от другого.
 */
export const PublicReviewCard: React.FC<Props> = ({ review, own }) => {
  const styles = useUserProfilePageStyles();
  const showRequestError = useRequestError();
  const [spoiler, setSpoiler] = useState(false);
  const [thread, setThread] = useState(false);
  /* Счётчик и своя отметка живут здесь: после нажатия их пересчитывает ответ сервера. */
  const [reaction, setReaction] = useState(review.myReaction);
  const [reactionCount, setReactionCount] = useState(review.reactionCount);
  const [busy, setBusy] = useState(false);

  /** Повторное нажатие снимает отметку: отдельной кнопки «убрать» нет намеренно. */
  const toggleLike = async () => {
    setBusy(true);
    try {
      const next = reaction === 'LIKE' ? await removeReviewReaction(review.itemId) : await reactToReview(review.itemId, 'LIKE');
      setReaction(next.myReaction);
      // Сервер отдаёт разбивку по видам реакций; в карточке стоит одна общая цифра.
      setReactionCount(Object.values(next.reactions).reduce((sum, count) => sum + (count ?? 0), 0));
    } catch (error) {
      showRequestError(error, 'Не удалось отметить отзыв');
    } finally {
      setBusy(false);
    }
  };

  const meta = [review.authorNames.join(', ') || 'автор не указан', formatRelative(review.finishedAt)].join(' · ');

  return (
    <Card style={styles.review} styles={{ body: styles.reviewBody }}>
      <Link to={`/library/${review.itemId}`} aria-label={`Открыть «${review.title}»`}>
        <CoverThumb
          src={review.hasCover ? coverUrl(review.itemId) : undefined}
          title={review.title}
          kind={review.kind}
          width={76}
          height={108}
        />
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.reviewTitleRow}>
          <Typography.Title level={3} className="brand-display" style={{ margin: 0, fontSize: 16 }}>
            {review.title}
          </Typography.Title>
          {review.rating != null && (
            <Typography.Text strong style={{ fontSize: 13 }}>
              <StarFilled style={{ color: '#d9a441', marginInlineEnd: 5 }} />
              {formatScore(review.rating)}
            </Typography.Text>
          )}
          {/* Отметка ставится по совпадению названия: библиотека у каждого своя. */}
          {review.inMyLibrary && (
            <Tooltip title="Книга с таким названием есть в вашей библиотеке">
              <span style={styles.owned}>
                <CheckOutlined /> есть у вас
              </span>
            </Tooltip>
          )}
        </div>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 3, fontSize: 13 }}>
          {meta}
        </Typography.Text>

        {review.review && <Typography.Paragraph style={styles.reviewText}>{review.review}</Typography.Paragraph>}

        {spoiler && review.reviewSpoiler && (
          <Typography.Paragraph style={styles.reviewText}>{review.reviewSpoiler}</Typography.Paragraph>
        )}

        <div style={styles.actions}>
          <Button
            shape="round"
            size="small"
            loading={busy}
            disabled={own}
            icon={reaction === 'LIKE' ? <HeartFilled /> : <HeartOutlined />}
            onClick={toggleLike}
          >
            {reactionCount}
          </Button>
          <Button shape="round" size="small" icon={<MessageOutlined />} onClick={() => setThread((open) => !open)}>
            {pluralize(review.commentCount, ['комментарий', 'комментария', 'комментариев'])}
          </Button>
          {/* Спойлер приходит отдельным полем — прячем целиком, а не режем текст. */}
          {review.reviewSpoiler && (
            <Button
              shape="round"
              size="small"
              icon={spoiler ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setSpoiler((open) => !open)}
            >
              {spoiler ? 'Скрыть спойлеры' : 'Спойлеры'}
            </Button>
          )}
        </div>

        {thread && (
          <div style={styles.thread}>
            {/* Реакции уже стоят чипом выше: вторая строка означала бы две правды об одном счётчике. */}
            <ReviewThreadPanel itemId={review.itemId} own={own} reactions={false} />
          </div>
        )}
      </div>
    </Card>
  );
};

