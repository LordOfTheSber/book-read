import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalSearchModal } from './GlobalSearchModal';
import { renderWithStore } from '@/test/renderWithStore';
import { httpClient } from '@/shared/api/httpClient';

const book = {
  id: 'b1',
  title: 'Задача трёх тел',
  status: 'READING',
  kind: 'BOOK',
  hasCover: false,
  authors: [{ id: 'a1', name: 'Лю Цысинь' }],
  progress: { behindSchedule: false }
};

describe('GlobalSearchModal', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(httpClient);
    mock.onGet('/items').reply(200, { content: [book], totalElements: 1, number: 0, size: 5 });
    mock.onGet('/authors').reply(200, [{ id: 'a1', name: 'Лю Цысинь', itemCount: 3 }]);
    mock
      .onGet('/quotes')
      .reply(200, [{ id: 'q1', itemId: 'b1', itemTitle: 'Задача трёх тел', position: 118, text: 'Не отвечайте!' }]);
  });

  afterEach(() => {
    mock.restore();
    vi.restoreAllMocks();
  });

  const renderModal = (onPickBook = vi.fn()) =>
    renderWithStore(
      <MemoryRouter>
        <GlobalSearchModal open onClose={() => undefined} onPickBook={onPickBook} />
      </MemoryRouter>
    );

  it('ищет разом по записям, авторам и выпискам', async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText('Поиск по библиотеке'), 'цысинь');

    expect(await screen.findByText('Записи')).toBeInTheDocument();
    expect(await screen.findByText('Авторы')).toBeInTheDocument();
    expect(await screen.findByText('Выписки')).toBeInTheDocument();
    expect(screen.getByText('Задача трёх тел')).toBeInTheDocument();
    expect(screen.getByText('3 записи в библиотеке')).toBeInTheDocument();
  });

  /** Одной буквы мало: запрос по ней вернул бы половину библиотеки и лёг бы на сервер. */
  it('молчит, пока введено меньше двух букв', async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText('Поиск по библиотеке'), 'ц');

    await waitFor(() => expect(mock.history.get).toHaveLength(0));
    expect(screen.getByText(/от двух букв/)).toBeInTheDocument();
  });

  it('открывает найденную запись карточкой, а не страницей поиска', async () => {
    const onPickBook = vi.fn();
    renderModal(onPickBook);

    await userEvent.type(screen.getByLabelText('Поиск по библиотеке'), 'цысинь');
    await userEvent.click(await screen.findByText('Задача трёх тел'));

    expect(onPickBook).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }));
  });
});
