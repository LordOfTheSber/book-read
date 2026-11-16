import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewThreadPanel } from './ReviewThreadPanel';
import { renderWithStore } from '@/test/renderWithStore';
import { ReviewThread } from '@/shared/types/library';

const fetchReviewThread = vi.fn();
const reactToReview = vi.fn();
const removeReviewReaction = vi.fn();
const commentOnReview = vi.fn();
const deleteReviewComment = vi.fn();

vi.mock('@/entities/review', () => ({
  fetchReviewThread: (...args: unknown[]) => fetchReviewThread(...args),
  reactToReview: (...args: unknown[]) => reactToReview(...args),
  removeReviewReaction: (...args: unknown[]) => removeReviewReaction(...args),
  commentOnReview: (...args: unknown[]) => commentOnReview(...args),
  deleteReviewComment: (...args: unknown[]) => deleteReviewComment(...args)
}));

const thread = (overrides: Partial<ReviewThread> = {}): ReviewThread => ({
  itemId: 'item-1',
  reactions: { LIKE: 2 },
  comments: [],
  ...overrides
});

describe('ReviewThreadPanel', () => {
  beforeEach(() => {
    [fetchReviewThread, reactToReview, removeReviewReaction, commentOnReview, deleteReviewComment].forEach((mock) =>
      mock.mockReset()
    );
    fetchReviewThread.mockResolvedValue(thread());
    reactToReview.mockResolvedValue(thread({ reactions: { LIKE: 3 }, myReaction: 'LIKE' }));
    removeReviewReaction.mockResolvedValue(thread({ reactions: { LIKE: 2 } }));
    commentOnReview.mockResolvedValue(
      thread({
        comments: [
          {
            id: 'c-1',
            author: {
              id: 'u-1',
              username: 'reader',
              hasAvatar: false,
              publicProfile: true,
              followedByMe: false
            },
            body: 'Согласен',
            createdAt: '2026-08-07T10:00:00Z',
            canDelete: true
          }
        ]
      })
    );
  });

  it('показывает счётчики реакций', async () => {
    renderWithStore(<ReviewThreadPanel itemId="item-1" />);

    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  /** Повторное нажатие снимает реакцию: отдельной кнопки «убрать» нет намеренно. */
  it('снимает свою реакцию повторным нажатием', async () => {
    fetchReviewThread.mockResolvedValue(thread({ myReaction: 'LIKE' }));
    renderWithStore(<ReviewThreadPanel itemId="item-1" />);

    const buttons = await screen.findAllByRole('button');
    await userEvent.click(buttons[0]);

    await waitFor(() => expect(removeReviewReaction).toHaveBeenCalledWith('item-1'));
    expect(reactToReview).not.toHaveBeenCalled();
  });

  it('ставит реакцию, если своей ещё нет', async () => {
    renderWithStore(<ReviewThreadPanel itemId="item-1" />);

    const buttons = await screen.findAllByRole('button');
    await userEvent.click(buttons[0]);

    await waitFor(() => expect(reactToReview).toHaveBeenCalledWith('item-1', 'LIKE'));
  });

  /** Свой отзыв реакцией не отмечают: это накрутка с нулевым смыслом. */
  it('запрещает отмечать собственный отзыв', async () => {
    renderWithStore(<ReviewThreadPanel itemId="item-1" own />);

    const buttons = await screen.findAllByRole('button');
    expect(buttons[0]).toBeDisabled();
  });

  it('отправляет комментарий без пробелов по краям', async () => {
    renderWithStore(<ReviewThreadPanel itemId="item-1" />);

    const input = await screen.findByPlaceholderText('Что скажете об отзыве?');
    await userEvent.type(input, '  Согласен  ');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => expect(commentOnReview).toHaveBeenCalledWith('item-1', 'Согласен'));
    expect(await screen.findByText('Согласен')).toBeInTheDocument();
  });
});
