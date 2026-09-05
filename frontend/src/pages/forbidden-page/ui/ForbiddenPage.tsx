import React from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/shared/lib/documentTitle';

/**
 * «Сюда нельзя» вместо молчаливого возврата на главную.
 *
 * Раздел администрирования раньше просто перебрасывал обратно в библиотеку: человек, открывший
 * присланную ссылку, видел не отказ, а мигание — и не понимал, ошибся он адресом или сервис
 * сломался. Пустой экран без объяснения — тот же обман, только медленнее (`States.dc.html`).
 */
export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  useDocumentTitle('Раздел недоступен');

  return (
    <Result
      status="403"
      title="Сюда нельзя"
      subTitle="Раздел доступен только администраторам. Если он вам нужен, попросите доступ у того, кто ведёт этот сервис."
      extra={
        <Button type="primary" size="large" onClick={() => navigate('/')}>
          Вернуться в библиотеку
        </Button>
      }
    />
  );
};
