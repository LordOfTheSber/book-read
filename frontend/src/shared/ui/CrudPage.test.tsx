import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrudPage } from './CrudPage';
import { renderWithStore } from '@/test/renderWithStore';

interface Entry {
  id: string;
  name: string;
  altName?: string;
}

interface EntryValues {
  name: string;
  altName?: string;
}

const onCreate = vi.fn();
const onUpdate = vi.fn();
const onDelete = vi.fn();

const columns: ColumnsType<Entry> = [{ title: 'Имя', dataIndex: 'name' }];

const labels = {
  title: 'Авторы',
  addButton: 'Добавить автора',
  createTitle: 'Новый автор',
  editTitle: 'Редактирование автора',
  deleteTitle: 'Удалить автора?',
  created: 'Автор добавлен',
  updated: 'Автор обновлён',
  deleted: 'Автор удалён',
  saveError: 'Не удалось сохранить автора',
  deleteError: 'Не удалось удалить автора',
  emptyTitle: 'Авторов пока нет'
};

const items: Entry[] = [
  { id: 'a-1', name: 'Лю Цысинь', altName: 'Liu Cixin' },
  { id: 'a-2', name: 'Аркадий Стругацкий' }
];

const renderPage = (canEdit = true, canDelete = true) =>
  renderWithStore(
    <CrudPage<Entry, EntryValues>
      items={items}
      columns={columns}
      canEdit={canEdit}
      canDelete={canDelete}
      labels={labels}
      searchMatch={(item, query) => item.name.toLowerCase().includes(query)}
      toFormValues={(item) => ({ name: item.name, altName: item.altName })}
      formInitialValues={{ name: '', altName: '' }}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
      formFields={
        <>
          <Form.Item name="name" label="Имя" rules={[{ required: true, message: 'Имя обязательно' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="altName" label="Имя в оригинале">
            <Input />
          </Form.Item>
        </>
      }
    />
  );

/**
 * Шаблон справочника: по нему сделаны авторы, серии, типы и источники. Проверяется он один раз
 * здесь, потому что ошибка в нём — это ошибка сразу на четырёх страницах.
 */
describe('CrudPage', () => {
  beforeEach(() => {
    onCreate.mockReset().mockResolvedValue(undefined);
    onUpdate.mockReset().mockResolvedValue(undefined);
    onDelete.mockReset().mockResolvedValue(undefined);
  });

  it('отправляет на сервер оба поля новой записи', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Добавить автора/ }));
    await userEvent.type(await screen.findByLabelText('Имя'), 'Тед Чан');
    await userEvent.type(screen.getByLabelText('Имя в оригинале'), 'Ted Chiang');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: 'Тед Чан', altName: 'Ted Chiang' }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('подставляет значения редактируемой записи и сохраняет её по идентификатору', async () => {
    renderPage();

    const row = screen.getByText('Лю Цысинь').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByLabelText('Редактировать'));

    const altName = await screen.findByLabelText('Имя в оригинале');
    await waitFor(() => expect(altName).toHaveValue('Liu Cixin'));
    expect(screen.getByLabelText('Имя')).toHaveValue('Лю Цысинь');

    await userEvent.clear(altName);
    await userEvent.type(altName, 'Cixin Liu');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('a-1', { name: 'Лю Цысинь', altName: 'Cixin Liu' })
    );
  });

  /** Пустое необязательное поле должно уехать пустым, а не потеряться: так стирают старое значение. */
  it('отправляет очищенное необязательное поле', async () => {
    renderPage();

    const row = screen.getByText('Лю Цысинь').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByLabelText('Редактировать'));
    await userEvent.clear(await screen.findByLabelText('Имя в оригинале'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('a-1', { name: 'Лю Цысинь', altName: '' }));
  });

  it('не сохраняет запись без обязательного поля', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Добавить автора/ }));
    await screen.findByLabelText('Имя');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Имя обязательно')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('удаляет запись после подтверждения', async () => {
    renderPage();

    const row = screen.getByText('Аркадий Стругацкий').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByLabelText('Удалить'));

    const confirm = await screen.findByRole('dialog');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('a-2'));
  });

  it('фильтрует список локальным поиском', async () => {
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('Поиск'), 'стругацкий');

    await waitFor(() => expect(screen.queryByText('Лю Цысинь')).not.toBeInTheDocument());
    expect(screen.getByText('Аркадий Стругацкий')).toBeInTheDocument();
  });

  /** Читателю справочник виден, но менять его нечем: кнопок правки быть не должно. */
  it('прячет действия у того, кому нельзя править', () => {
    renderPage(false, false);

    expect(screen.queryByRole('button', { name: /Добавить автора/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Редактировать')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Удалить')).not.toBeInTheDocument();
  });
});
