import { httpClient } from '@/shared/api/httpClient';
import { ReactionKind, ReviewThread } from '@/shared/types/library';

/**
 * Обсуждение живёт под произведением: отзыв не самостоятельная сущность, у него нет своего
 * идентификатора — он поле карточки.
 */
export const fetchReviewThread = async (itemId: string) => {
  const { data } = await httpClient.get<ReviewThread>(`/items/${itemId}/review`);
  return data;
};

export const reactToReview = async (itemId: string, kind: ReactionKind) => {
  const { data } = await httpClient.post<ReviewThread>(`/items/${itemId}/review/reactions`, { kind });
  return data;
};

export const removeReviewReaction = async (itemId: string) => {
  const { data } = await httpClient.delete<ReviewThread>(`/items/${itemId}/review/reactions`);
  return data;
};

export const commentOnReview = async (itemId: string, body: string) => {
  const { data } = await httpClient.post<ReviewThread>(`/items/${itemId}/review/comments`, { body });
  return data;
};

export const deleteReviewComment = async (itemId: string, commentId: string) => {
  const { data } = await httpClient.delete<ReviewThread>(`/items/${itemId}/review/comments/${commentId}`);
  return data;
};
