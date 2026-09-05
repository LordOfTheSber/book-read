import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedPage } from './FeedPage';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';
import { Activity, ProfileSummary, PublicReview, ReviewThread, TrendingBook } from '@/shared/types/library';

const fetchFeed = vi.fn();
const fetchTrending = vi.fn();
const searchProfiles = vi.fn();
const followUser = vi.fn();

vi.mock('@/entities/profile', () => ({
  fetchFeed: (...args: unknown[]) => fetchFeed(...args),
  fetchTrending: (...args: unknown[]) => fetchTrending(...args),
  searchProfiles: (...args: unknown[]) => searchProfiles(...args),
  followUser: (...args: unknown[]) => followUser(...args)
}));

const fetchReviewThread = vi.fn();
const reactToReview = vi.fn();
const removeReviewReaction = vi.fn();

vi.mock('@/entities/review', () => ({
  fetchReviewThread: (...args: unknown[]) => fetchReviewThread(...args),
  reactToReview: (...args: unknown[]) => reactToReview(...args),
  removeReviewReaction: (...args: unknown[]) => removeReviewReaction(...args),
  commentOnReview: vi.fn(),
  deleteReviewComment: vi.fn()
}));

const actor = (id: string, username: string, displayName: string): ProfileSummary => ({
  id,
  username,
  displayName,
  hasAvatar: false,
  publicProfile: true,
  followedByMe: true
});

const review = (overrides: Partial<PublicReview> = {}): PublicReview => ({
  itemId: 'i1',
  kind: 'BOOK',
  title: 'Пикник на обочине',
  authorNames: ['Стругацкие'],
  publishedYear: 1972,
  pageCount: 224,
  hasCover: false,
  rating: 9,
  review: 'Сталкеры не исследователи — они грузчики чуда.',
  reviewSpoiler: 'Желание формулирует не Рэдрик.',
  reactionCount: 24,
  commentCount: 3,
  ...overrides
});

const reviewEvent = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'e1',
  type: 'PUBLISHED_REVIEW',
  actor: actor('u1', 'dmitry', 'Дмитрий'),
  itemId: 'i1',
  subject: 'Пикник на обочине',
  createdAt: '2026-08-22T11:05:00Z',
  review: review(),
  ...overrides
});

const finishedEvent: Activity = {
  id: 'e2',
  type: 'FINISHED_READING',
  actor: actor('u2', 'anna', 'Аня'),
  itemId: 'i2',
  subject: 'Тёмный лес',
  detail: '512 страниц за 11 дней',
  createdAt: '2026-08-22T14:20:00Z'
};

const trending: TrendingBook[] = [
  { itemId: 'i1', kind: 'BOOK', title: 'Пикник на обочине', hasCover: false, reviewCount: 4, commentCount: 6 }
];

const thread = (overrides: Partial<ReviewThread> = {}): ReviewThread => ({
  itemId: 'i1',
  reactions: { LIKE: 25 },
  myReaction: 'LIKE',
  comments: [],
  ...overrides
});

const storeAs = (userId: string) =>
  createTestStore({
    auth: {
      authenticated: true,
      user: { id: userId, username: 'reader', role: 'USER', blocked: false },
      loadingUser: false,
      updatingAvatar: false
    }
  });

/**
 * Пост отзыва ищется по тексту отзыва, а не по названию: название стоит ещё и в сводке недели
 * справа, и по нему нашлись бы две карточки.
 */
const post = () => screen.getByText(/грузчики чуда/).closest('.ant-card') as HTMLElement;

const postShown = () => screen.findByText(/грузчики чуда/);

describe('FeedPage', () => {
  beforeEach(() => {
    [fetchFeed, fetchTrending, searchProfiles, followUser, fetchReviewThread, reactToReview, removeReviewReaction]
      .forEach((mock) => mock.mockReset());
    fetchFeed.mockResolvedValue([reviewEvent(), finishedEvent]);
    fetchTrending.mockResolvedValue(trending);
    fetchReviewThread.mockResolvedValue(thread());
    reactToReview.mockResolvedValue(thread());
    removeReviewReaction.mockResolvedValue(thread({ reactions: { LIKE: 23 }, myReaction: undefined }));
  });

  /** Отзыв — главное, что человек пишет в трекере, и в ленте он разворачивается целиком. */
  it('показывает отзыв постом с обложкой, подписью и текстом', async () => {
    renderWithStore(<FeedPage />);

    await postShown();
    const card = post();
    expect(within(card).getByText('Пикник на обочине')).toBeInTheDocument();
    expect(within(card).getByText('Стругацкие · 1972 · 224 стр.')).toBeInTheDocument();
    expect(within(card).getByText('9')).toBeInTheDocument();
  });

  /** Спойлер приходит отдельным полем — до нажатия его в разметке нет вовсе. */
  it('прячет спойлер под кат', async () => {
    const user = userEvent.setup();
    renderWithStore(<FeedPage />);
    await postShown();

    expect(screen.queryByText(/формулирует не Рэдрик/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Показать спойлеры/ }));

    expect(screen.getByText(/формулирует не Рэдрик/)).toBeInTheDocument();
  });

  /** Мелкие события сжаты в строку: иначе «дочитал» вытесняет с экрана отзывы. */
  it('мелкое событие показывает строкой', async () => {
    renderWithStore(<FeedPage />);
    await postShown();

    const line = screen.getByText('Аня').closest('.ant-card') as HTMLElement;
    expect(within(line).getByText(/дочитал/)).toBeInTheDocument();
    expect(within(line).getByText(/512 страниц за 11 дней/)).toBeInTheDocument();
    // Строка — не пост: ни реакций, ни кнопки обсуждения в ней нет.
    expect(within(line).queryByRole('button')).not.toBeInTheDocument();
  });

  /** Сервер не отдал текст (отзыв удалён, карточка скрыта) — показывать как пост нечего. */
  it('событие без текста отзыва сжимает в строку', async () => {
    fetchFeed.mockResolvedValue([reviewEvent({ review: undefined })]);
    renderWithStore(<FeedPage />);

    expect(await screen.findByText('Дмитрий')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Хочу прочитать' })).not.toBeInTheDocument();
  });

  /** Счётчик пересчитывается из ответа сервера: перезагружать ради него всю ленту незачем. */
  it('отметка пересчитывает счётчик по ответу сервера', async () => {
    const user = userEvent.setup();
    renderWithStore(<FeedPage />);
    await postShown();

    await user.click(within(post()).getByRole('button', { name: 'Полезно: 24' }));

    await waitFor(() => expect(reactToReview).toHaveBeenCalledWith('i1', 'LIKE'));
    expect(await within(post()).findByText('25')).toBeInTheDocument();
  });

  /** Повторное нажатие снимает отметку: отдельной кнопки «убрать» нет намеренно. */
  it('повторное нажатие снимает свою отметку', async () => {
    const user = userEvent.setup();
    fetchFeed.mockResolvedValue([reviewEvent({ review: review({ myReaction: 'LIKE' }) })]);
    renderWithStore(<FeedPage />);
    await postShown();

    await user.click(within(post()).getByRole('button', { name: 'Полезно: 24' }));

    await waitFor(() => expect(removeReviewReaction).toHaveBeenCalledWith('i1'));
    expect(reactToReview).not.toHaveBeenCalled();
  });

  /** Свой отзыв реакцией не отмечают: это накрутка с нулевым смыслом. */
  it('запрещает отмечать собственный отзыв', async () => {
    renderWithStore(<FeedPage />, storeAs('u1'));
    await postShown();

    expect(within(post()).getByRole('button', { name: 'Полезно: 24' })).toBeDisabled();
  });

  /** Тред грузится по нажатию: раскрытым под каждым постом он стоил бы запроса на карточку. */
  it('обсуждение подгружает только по нажатию', async () => {
    const user = userEvent.setup();
    renderWithStore(<FeedPage />);
    await postShown();

    expect(fetchReviewThread).not.toHaveBeenCalled();
    await user.click(within(post()).getByRole('button', { name: 'Обсуждение: 3 комментария' }));

    await waitFor(() => expect(fetchReviewThread).toHaveBeenCalledWith('i1'));
  });

  it('показывает сводку недели сбоку', async () => {
    renderWithStore(<FeedPage />);

    const summary = (await screen.findByText('Обсуждают на этой неделе')).closest('.ant-card') as HTMLElement;
    expect(within(summary).getByText('4 отзыва · 6 комментариев')).toBeInTheDocument();
  });

  /** Сводка стоит сбоку, и её падение — не повод показывать ошибку поверх пришедшей ленты. */
  it('переживает падение сводки', async () => {
    fetchTrending.mockRejectedValue(new Error('нет связи'));
    renderWithStore(<FeedPage />);

    await postShown();
    expect(screen.queryByText('Обсуждают на этой неделе')).not.toBeInTheDocument();
  });

  /** Пустая лента бесполезна без подсказки, с чего начать. */
  it('у пустой ленты объясняет, что делать', async () => {
    fetchFeed.mockResolvedValue([]);
    renderWithStore(<FeedPage />);

    expect(await screen.findByText(/Подпишитесь на кого-нибудь/)).toBeInTheDocument();
  });

  it('подписывается на найденного читателя и обновляет ленту', async () => {
    const user = userEvent.setup();
    searchProfiles.mockResolvedValue([{ ...actor('u9', 'marina', 'Марина'), followedByMe: false }]);
    followUser.mockResolvedValue({});
    renderWithStore(<FeedPage />);
    await postShown();

    await user.type(screen.getByPlaceholderText('Найти читателя'), 'мар');
    await user.click(await screen.findByText('подписаться'));

    await waitFor(() => expect(followUser).toHaveBeenCalledWith('marina'));
    expect(fetchFeed).toHaveBeenCalledTimes(2);
  });
});
