import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';

const fetchMyProfile = vi.fn();
const updateMyProfile = vi.fn();

vi.mock('@/entities/profile', () => ({
  fetchMyProfile: (...args: unknown[]) => fetchMyProfile(...args),
  updateMyProfile: (...args: unknown[]) => updateMyProfile(...args)
}));

vi.mock('@/entities/engagement', () => ({
  fetchAchievements: vi.fn().mockResolvedValue([])
}));

vi.mock('@/entities/analytics/api/analyticsApi', () => ({
  fetchBookAnalytics: vi.fn().mockResolvedValue({ totalItems: 0, favoriteItems: 0, statusBreakdown: {} }),
  fetchTimeAnalytics: vi.fn().mockResolvedValue({}),
  fetchActivityCalendar: vi.fn().mockResolvedValue([])
}));

const profile = {
  username: 'reader',
  displayName: 'Читатель',
  bio: 'люблю твёрдую фантастику',
  publicProfile: false,
  followerCount: 0,
  followingCount: 0
};

const storeWithUser = () =>
  createTestStore({
    auth: {
      user: { id: 'u-1', username: 'reader', role: 'USER' },
      loading: false,
      updatingAvatar: false
    }
  } as never);

const renderPage = () =>
  renderWithStore(
    <MemoryRouter>
      <ThemeProvider>
        <ProfilePage />
      </ThemeProvider>
    </MemoryRouter>,
    storeWithUser()
  );

describe('ProfilePage', () => {
  beforeEach(() => {
    fetchMyProfile.mockReset().mockResolvedValue(profile);
    updateMyProfile.mockReset().mockResolvedValue({ ...profile, publicProfile: true });
  });

  it('подставляет сохранённый профиль в форму', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Имя для показа')).toHaveValue('Читатель'));
    expect(screen.getByLabelText('О себе')).toHaveValue('люблю твёрдую фантастику');
  });

  /**
   * Профиль сервер принимает целиком: правка одного поля не должна стирать остальные, а
   * переключатель публичности — уезжать как «не задан».
   */
  it('сохраняет профиль целиком, когда правят только имя', async () => {
    renderPage();

    const displayName = await screen.findByLabelText('Имя для показа');
    await waitFor(() => expect(displayName).toHaveValue('Читатель'));

    await userEvent.clear(displayName);
    await userEvent.type(displayName, 'Ли');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(updateMyProfile).toHaveBeenCalledWith({
        displayName: 'Ли',
        bio: 'люблю твёрдую фантастику',
        publicProfile: false
      })
    );
  });

  it('отправляет переключатель публичности', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Имя для показа')).toHaveValue('Читатель'));

    await userEvent.click(screen.getByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ publicProfile: true }))
    );
  });
});
