import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfilePage } from './UserProfilePage';
import { renderWithStore } from '@/test/renderWithStore';
import { PublicProfile } from '@/shared/types/library';

const fetchProfile = vi.fn();
const fetchProfileActivity = vi.fn();

vi.mock('@/entities/profile/api/profileApi', () => ({
  fetchProfile: (...args: unknown[]) => fetchProfile(...args),
  fetchProfileActivity: (...args: unknown[]) => fetchProfileActivity(...args),
  fetchMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  fetchFollowers: vi.fn(),
  fetchFollowing: vi.fn(),
  searchProfiles: vi.fn(),
  fetchTrending: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ username: 'anna' }) };
});

const profile = (overrides: Partial<PublicProfile> = {}): PublicProfile =>
  ({
    id: 'u-1',
    username: 'anna',
    displayName: 'Аня',
    bio: 'Фэнтези и славянский фольклор',
    hasAvatar: false,
    publicProfile: true,
    me: false,
    followedByMe: false,
    followerCount: 42,
    followingCount: 17,
    finishedCount: 164,
    reviewCount: 1,
    averageRating: 8.7,
    currentStreak: 64,
    achievementCount: 5,
    commonCount: 4,
    shelves: [
      {
        id: 's-1',
        name: 'Фантастика',
        isPublic: true,
        itemCount: 64,
        owned: false,
        canCurate: false,
        canContribute: false,
        memberCount: 0,
        createdAt: '',
        updatedAt: ''
      }
    ],
    reviews: [
      {
        itemId: 'i-1',
        kind: 'BOOK',
        title: 'Тёмный лес',
        authorNames: ['Лю Цысинь'],
        hasCover: false,
        rating: 9,
        review: 'Вторая книга страшнее первой.',
        reactionCount: 18,
        commentCount: 4,
        inMyLibrary: true
      }
    ],
    currentlyReading: [{ id: 'i-2', title: 'Дюна', kind: 'BOOK', status: 'READING', hasCover: false }],
    ...overrides
  }) as PublicProfile;

describe('UserProfilePage', () => {
  beforeEach(() => {
    fetchProfile.mockReset().mockResolvedValue(profile());
    fetchProfileActivity.mockReset().mockResolvedValue([]);
  });

  /**
   * «Есть у вас» и общие книги — то, ради чего вообще ходят к чужому профилю: отзыв на книгу,
   * которая у тебя стоит непрочитанной, читается иначе, чем отзыв на незнакомую.
   */
  it('отмечает книги, которые есть у смотрящего', async () => {
    renderWithStore(<UserProfilePage />);

    expect(await screen.findByText('есть у вас')).toBeInTheDocument();
    expect(screen.getByText('4 общие книги с вами')).toBeInTheDocument();
  });

  it('показывает отзыв первым, а числа и полки — в правой колонке', async () => {
    renderWithStore(<UserProfilePage />);

    expect(await screen.findByText(/Вторая книга страшнее первой/)).toBeInTheDocument();
    expect(screen.getByText('Дочитано')).toBeInTheDocument();
    expect(screen.getByText('164')).toBeInTheDocument();
    expect(screen.getByText('Сейчас читает')).toBeInTheDocument();
  });

  it('переключает вкладку на полки', async () => {
    renderWithStore(<UserProfilePage />);

    await userEvent.click(await screen.findByRole('tab', { name: /Полки/ }));

    expect(await screen.findByRole('button', { name: 'Открыть состав' })).toBeInTheDocument();
  });

  /** Своя страница — предпросмотр чужого взгляда, но отметок «есть у вас» на ней быть не может. */
  it('в своём профиле не показывает общие книги', async () => {
    fetchProfile.mockResolvedValue(profile({ me: true, commonCount: 0 }));
    renderWithStore(<UserProfilePage />);

    expect(await screen.findByRole('link', { name: 'Настроить профиль' })).toBeInTheDocument();
    expect(screen.queryByText(/книги с вами/)).not.toBeInTheDocument();
  });
});
