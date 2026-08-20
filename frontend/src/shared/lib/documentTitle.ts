import { useEffect } from 'react';

/** Имя продукта — то же, что в шапке и на экране входа. */
export const APP_NAME = 'BookRead';

/**
 * Заголовок вкладки. Раньше он был один на всё приложение («Library Tracker» — название,
 * которого нет больше нигде), поэтому в истории браузера и в списке открытых вкладок
 * страницы не отличались друг от друга.
 */
export const useDocumentTitle = (title?: string) => {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
};
