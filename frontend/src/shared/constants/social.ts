import { ActivityType, ReactionKind, ShelfRole } from '@/shared/types/library';

/**
 * Подписи событий ленты. Событие хранит снимок названия, поэтому фраза здесь без объекта —
 * объект подставляется рядом и берётся из события, а не из текущего состояния библиотеки.
 */
export const activityMeta: Record<ActivityType, { label: string; color: string }> = {
  STARTED_READING: { label: 'начал читать', color: 'processing' },
  FINISHED_READING: { label: 'дочитал', color: 'success' },
  PUBLISHED_REVIEW: { label: 'написал отзыв', color: 'purple' },
  RATED: { label: 'оценил', color: 'gold' },
  SHARED_SHELF: { label: 'открыл полку', color: 'cyan' },
  UNLOCKED_ACHIEVEMENT: { label: 'получил достижение', color: 'volcano' },
  REACHED_GOAL: { label: 'выполнил цель года', color: 'magenta' }
};

export const reactionMeta: Record<ReactionKind, { label: string; emoji: string }> = {
  LIKE: { label: 'Полезно', emoji: '👍' },
  WANT_TO_READ: { label: 'Хочу прочитать', emoji: '📚' },
  DISAGREE: { label: 'Не согласен', emoji: '🤔' }
};

export const reactionOrder: ReactionKind[] = ['LIKE', 'WANT_TO_READ', 'DISAGREE'];

/** Роль внутри полки: отдельно от глобальной — это разные вопросы. */
export const shelfRoleMeta: Record<ShelfRole, { label: string; description: string; color: string }> = {
  VIEWER: { label: 'Читатель', description: 'Видит состав полки', color: 'default' },
  CONTRIBUTOR: { label: 'Соавтор', description: 'Добавляет и снимает свои записи', color: 'blue' },
  CURATOR: { label: 'Куратор', description: 'Правит состав целиком и зовёт участников', color: 'purple' }
};
