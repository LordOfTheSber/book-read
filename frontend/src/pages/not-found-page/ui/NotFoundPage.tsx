import React from 'react';
import { Button, Result } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/shared/lib/documentTitle';

/**
 * Заглушка вместо аварийного экрана роутера. Без неё опечатка в адресе или устаревшая
 * ссылка выбрасывали пользователя на «Unexpected Application Error» — экран разработчика,
 * из которого нет пути обратно в приложение.
 */
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useDocumentTitle('Страница не найдена');

  return (
    <Result
      status="404"
      title="Такой страницы нет"
      subTitle={`Адрес «${location.pathname}» не соответствует ни одному разделу. Возможно, ссылка устарела.`}
      extra={
        <Button type="primary" size="large" onClick={() => navigate('/')}>
          В библиотеку
        </Button>
      }
    />
  );
};
