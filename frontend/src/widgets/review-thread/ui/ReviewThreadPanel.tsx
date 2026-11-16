import React, { useEffect, useState } from 'react';
import { App, Avatar, Button, Input, List, Skeleton, Space, Tooltip, Typography } from 'antd';
import { DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { ReactionKind, ReviewThread } from '@/shared/types/library';
import { reactionMeta, reactionOrder } from '@/shared/constants/social';
import { formatDateTime } from '@/shared/lib/date';
import { useRequestError } from '@/shared/lib/errors';
import {
  commentOnReview,
  deleteReviewComment,
  fetchReviewThread,
  reactToReview,
  removeReviewReaction
} from '@/entities/review';

interface Props {
  itemId: string;
  /** Свой отзыв реакцией не отмечают: кнопки прячутся, комментарии остаются. */
  own?: boolean;
  /**
   * Показывать ли строку реакций. В ленте она уже стоит в карточке поста, и вторая такая же
   * под комментариями означала бы две правды об одном и том же счётчике.
   */
  reactions?: boolean;
}

const MAX_COMMENT_LENGTH = 2000;

/**
 * Обсуждение одного отзыва. Тред грузится по требованию — раскрытым под каждым отзывом в ленте
 * он стоил бы запроса на строку, а читают его далеко не у каждой записи.
 */
export const ReviewThreadPanel: React.FC<Props> = ({ itemId, own, reactions = true }) => {
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [thread, setThread] = useState<ReviewThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReviewThread(itemId)
      .then((data) => {
        if (!cancelled) setThread(data);
      })
      .catch((error) => {
        if (!cancelled) showRequestError(error, 'Не удалось загрузить обсуждение');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, showRequestError]);

  /** Повторное нажатие снимает реакцию: отдельная кнопка «убрать» только загромождала бы строку. */
  const toggleReaction = async (kind: ReactionKind) => {
    try {
      const next = thread?.myReaction === kind ? await removeReviewReaction(itemId) : await reactToReview(itemId, kind);
      setThread(next);
    } catch (error) {
      showRequestError(error, 'Не удалось отметить отзыв');
    }
  };

  const submitComment = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      setThread(await commentOnReview(itemId, body));
      setDraft('');
    } catch (error) {
      showRequestError(error, 'Не удалось отправить комментарий');
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (commentId: string) => {
    try {
      setThread(await deleteReviewComment(itemId, commentId));
      message.success('Комментарий удалён');
    } catch (error) {
      showRequestError(error, 'Не удалось удалить комментарий');
    }
  };

  if (loading) {
    return <Skeleton active paragraph={{ rows: 2 }} />;
  }

  if (!thread) {
    return <Typography.Text type="secondary">Обсуждение недоступно</Typography.Text>;
  }

  return (
    <Space direction="vertical" size={12} style={{ display: 'flex' }}>
      {reactions && (
        <Space size={8} wrap>
          {reactionOrder.map((kind) => {
            const count = thread.reactions[kind] ?? 0;
            const mine = thread.myReaction === kind;
            return (
              <Tooltip key={kind} title={own ? 'Свой отзыв реакцией не отмечают' : reactionMeta[kind].label}>
                <Button
                  size="small"
                  type={mine ? 'primary' : 'default'}
                  disabled={own}
                  onClick={() => toggleReaction(kind)}
                >
                  <span aria-hidden>{reactionMeta[kind].emoji}</span> {count}
                </Button>
              </Tooltip>
            );
          })}
        </Space>
      )}

      {thread.comments.length > 0 && (
        <List
          size="small"
          dataSource={thread.comments}
          renderItem={(comment) => (
            <List.Item
              actions={
                comment.canDelete
                  ? [
                      <Button
                        key="delete"
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeComment(comment.id)}
                        aria-label="Удалить комментарий"
                      />
                    ]
                  : undefined
              }
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    size={28}
                    icon={<UserOutlined />}
                    src={comment.author.hasAvatar ? `/api/v1/users/${comment.author.id}/avatar` : undefined}
                  />
                }
                title={
                  <Space size={8}>
                    <Typography.Text strong>{comment.author.displayName || comment.author.username}</Typography.Text>
                    <Typography.Text type="secondary">{formatDateTime(comment.createdAt)}</Typography.Text>
                  </Space>
                }
                description={<Typography.Paragraph style={{ marginBottom: 0 }}>{comment.body}</Typography.Paragraph>}
              />
            </List.Item>
          )}
        />
      )}

      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Что скажете об отзыве?"
          maxLength={MAX_COMMENT_LENGTH}
          autoSize={{ minRows: 1, maxRows: 4 }}
        />
        <Button type="primary" loading={sending} disabled={!draft.trim()} onClick={submitComment}>
          Отправить
        </Button>
      </Space.Compact>
    </Space>
  );
};
