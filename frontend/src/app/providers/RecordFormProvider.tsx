import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { LibraryItem } from '@/shared/types/library';
import { useAppSelector } from '@/shared/lib/hooks';
import { BookFormDrawer } from '@/widgets/book-form';
import { AddRecordModal } from '@/widgets/add-record';

interface RecordFormContextValue {
  openCreate: () => void;
  openEdit: (item: LibraryItem) => void;
}

const RecordFormContext = createContext<RecordFormContextValue | null>(null);

/**
 * Форма записи живёт в оболочке, а не на странице библиотеки.
 *
 * Кнопка «Добавить» стояла только в библиотеке: из аналитики или ленты за ней надо было
 * возвращаться на другую страницу. Теперь действие одно, оно в шапке и на нижней панели
 * телефона, а форму открывает любой экран — включая находку в поиске по ⌘K.
 *
 * Добавление и правка — разные окна: новая запись заводится поиском по каталогам
 * (`AddRecordModal`), а панель с вкладками нужна уже существующей записи.
 */
export const RecordFormProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<LibraryItem | null>(null);
  const items = useAppSelector((state) => state.books.items);

  /**
   * Открытая карточка берётся из стора по идентификатору, а не хранится снимком: заход на вкладке
   * «Прогресс» перечитывает список, и снимок оставлял на экране позицию до этого захода —
   * следующее «+10» отсчитывалось от старого числа. Снимок остаётся запасным вариантом на случай,
   * когда запись выпала из текущей страницы выдачи.
   */
  const editing = useMemo(
    () => items.find((item) => item.id === snapshot?.id) ?? snapshot,
    [items, snapshot]
  );

  const openCreate = useCallback(() => {
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((item: LibraryItem) => {
    setSnapshot(item);
    setEditOpen(true);
  }, []);

  const value = useMemo<RecordFormContextValue>(() => ({ openCreate, openEdit }), [openCreate, openEdit]);

  return (
    <RecordFormContext.Provider value={value}>
      {children}
      <AddRecordModal open={addOpen} onClose={() => setAddOpen(false)} onOpenRecord={openEdit} />
      {/* Панель правки монтируется только с записью: создание ушло в окно добавления. */}
      {editing && <BookFormDrawer open={editOpen} editing={editing} onClose={() => setEditOpen(false)} />}
    </RecordFormContext.Provider>
  );
};

export const useRecordForm = (): RecordFormContextValue => {
  const ctx = useContext(RecordFormContext);
  if (!ctx) {
    throw new Error('useRecordForm must be used within RecordFormProvider');
  }
  return ctx;
};
