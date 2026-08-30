import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';

const fetchMyProfile = vi.fn();
const updateMyProfile = vi.fn();
const fetchBooks = vi.fn();

vi.mock('@/entities/profile', () => ({
  fetchMyProfile: (...args: unknown[]) => fetchMyProfile(...args),
  updateMyProfile: (...args: unknown[]) => updateMyProfile(...args)
}));

vi.mock('@/entities/engagement', () => ({
  fetchAchievements: vi.fn().mockResolvedValue([]),
  fetchStreak: vi.fn().mockResolvedValue({ currentStreak: 4, longestStreak: 9, readToday: true, recentDays: [] }),
  fetchGoal: vi.fn().mockResolvedValue({
    year: 2026,
    configured: true,
    items: { target: 48, done: 36, expected: 30, percent: 75, behind: 0, onTrack: true, projected: 50 },
    daysLeft: 100,
    daysPassed: 265,
    completed: false
  }),
  goalProgress: () => 0.75
}));

vi.mock('@/entities/analytics/api/analyticsApi', () => ({
  fetchBookAnalytics: vi.fn().mockResolvedValue({
    totalItems: 248,
    favoriteItems: 12,
    averageRating: 8.4,
    statusBreakdown: { COMPLETED: 186 }
  }),
  fetchTimeAnalytics: vi.fn().mockResolvedValue({}),
  fetchActivityCalendar: vi.fn().mockResolvedValue([])
}));

vi.mock('@/entities/book', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/book')>()),
  fetchBooks: (...args: unknown[]) => fetchBooks(...args)
}));

const profile = {
  username: 'reader',
  displayName: 'Читатель',
  bio: 'люблю твёрдую фантастику',
  publicProfile: false,
  followerCount: 3,
  followingCount: 1
};

const page = <T,>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });

const storeWithUser = () =>
  createTestStore({
    auth: {
      user: { id: 'u-1', username: 'reader', role: 'USER' },
      loading: false,
      updatingAvatar: false
    }
  } as never);

const renderPage = (route = '/profile') =>
  renderWithStore(
    <ThemeProvider>
      <ProfilePage />
    </ThemeProvider>,
    storeWithUser(),
    { route }
  );

/** Форма публичной страницы живёт на своей вкладке — тесты её сначала открывают. */
const openPublicTab = async () => {
  await userEvent.click(await screen.findByRole('tab', { name: 'Публичная страница' }));
  await waitFor(() => expect(screen.getByLabelText('Имя для показа')).toHaveValue('Читатель'));
};

describe('ProfilePage', () => {
  beforeEach(() => {
    fetchMyProfile.mockReset().mockResolvedValue(profile);
    updateMyProfile.mockReset().mockResolvedValue({ ...profile, publicProfile: true });
    fetchBooks.mockReset().mockResolvedValue(page([]));
  });

  /** Кто вы и открыта ли страница видно с любой вкладки — раньше признак лежал в середине свитка. */
  it('держит имя, подписчиков и признак публичности в общей шапке', async () => {
    renderPage();

    expect(await screen.findByText('Читатель')).toBeInTheDocument();
    expect(screen.getByText('Профиль закрыт')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  /** Первым экраном стоит витрина: сводка, которая не менялась день ото дня, ушла на вкладку. */
  it('открывается витриной с тремя числами', async () => {
    renderPage();

    expect(await screen.findByText('248')).toBeInTheDocument();
    expect(screen.getByText('в коллекции')).toBeInTheDocument();
    expect(screen.getByText('8,4')).toBeInTheDocument();
    expect(screen.getByText('дней подряд с чтением')).toBeInTheDocument();
  });

  it('подставляет сохранённый профиль в форму', async () => {
    renderPage();
    await openPublicTab();

    expect(screen.getByLabelText('О себе')).toHaveValue('люблю твёрдую фантастику');
  });

  /**
   * Профиль сервер принимает целиком: правка одного поля не должна стирать остальные, а
   * переключатель публичности — уезжать как «не задан».
   */
  it('сохраняет профиль целиком, когда правят только имя', async () => {
    renderPage();
    await openPublicTab();

    const displayName = screen.getByLabelText('Имя для показа');
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
    await openPublicTab();

    await userEvent.click(screen.getByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ publicProfile: true }))
    );
  });

  /** Понять, что увидят другие, можно было только уйдя на свою страницу и вернувшись. */
  it('показывает предпросмотр карточки по ходу ввода', async () => {
    renderPage();
    await openPublicTab();

    const displayName = screen.getByLabelText('Имя для показа');
    await userEvent.clear(displayName);
    await userEvent.type(displayName, 'Ли Цысинь');

    const preview = await screen.findByText('Так вас видят другие');
    expect(preview).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Ли Цысинь')).toBeInTheDocument());
  });

  /** Вкладка стоит в адресе: на неё дают ссылку и возвращаются после перезагрузки. */
  it('открывает вкладку из адреса', async () => {
    renderPage('/profile?tab=account');

    expect(await screen.findByText('Учётная запись')).toBeInTheDocument();
    expect(screen.getByText(/Тема сохраняется в этом браузере/)).toBeInTheDocument();
  });

  /**
   * Ровно тот путь, которым в форму заходит сквозной сценарий: `/profile?tab=public` и поле
   * по подписи. С переездом формы на вкладку он ломался — открывал первый экран и не находил её.
   */
  it('открывает форму публичной страницы прямо по адресу вкладки', async () => {
    renderPage('/profile?tab=public');

    await waitFor(() => expect(screen.getByLabelText('Имя для показа')).toHaveValue('Читатель'));
    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
  });
});
