import React from 'react';
import { Button, Space, Typography } from 'antd';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AuthLayout } from '@/shared/ui/AuthLayout';

/**
 * Экран на случай, когда страница упала при отрисовке. Без него react-router показывал
 * пользователю «Unexpected Application Error!» со стеком вызовов: ни объяснения, ни выхода —
 * даже меню на таком экране нет, потому что упавшая страница уносит с собой весь layout.
 *
 * Живёт в AuthLayout, а не в PageLayout: шапка приложения ходит в стор и роутер, и на упавшем
 * дереве полагаться на неё нельзя. Из оформления здесь только фон, логотип и выбор темы.
 */
export const ErrorPage: React.FC = () => {
  const error = useRouteError();

  const details = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : undefined;

  return (
    <AuthLayout
      title="Что-то сломалось"
      subtitle="Приложение не смогло показать этот раздел. Обычно помогает перезагрузка — если повторяется, расскажите, что вы открывали."
    >
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        {/* Текст ошибки — не для пользователя, а для того, что он перескажет в обращении. */}
        {details && (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            <Typography.Text code>{details}</Typography.Text>
          </Typography.Paragraph>
        )}
        <Space wrap>
          <Button type="primary" size="large" onClick={() => window.location.reload()}>
            Перезагрузить
          </Button>
          {/* Полная перезагрузка, а не navigate: состояние упавшего дерева восстанавливать нечем. */}
          <Button size="large" onClick={() => window.location.assign('/')}>
            В библиотеку
          </Button>
        </Space>
      </Space>
    </AuthLayout>
  );
};
