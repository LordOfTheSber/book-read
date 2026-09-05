import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LibraryItem } from '@/shared/types/library';
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
 * Добавление и правка разошлись: новая запись заводится поиском по каталогам
 * (`AddRecordModal`), а существующая открывается своей страницей `/library/:id`.
 */
export const RecordFormProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();

  const openCreate = useCallback(() => {
    setAddOpen(true);
  }, []);

  /*
   * Шов остался один, а поведение сменилось: раньше здесь открывалась панель, теперь это переход
   * на страницу записи. Поэтому строка списка, полка «Продолжить», находка в ⌘K и «Добавить и
   * открыть карточку» перешли на страницу, не зная об этом.
   */
  const openEdit = useCallback(
    (item: LibraryItem) => {
      navigate(`/library/${item.id}`);
    },
    [navigate]
  );

  const value = useMemo<RecordFormContextValue>(() => ({ openCreate, openEdit }), [openCreate, openEdit]);

  return (
    <RecordFormContext.Provider value={value}>
      {children}
      <AddRecordModal open={addOpen} onClose={() => setAddOpen(false)} onOpenRecord={openEdit} />
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
