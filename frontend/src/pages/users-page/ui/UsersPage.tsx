import React, { useCallback, useEffect, useState } from 'react';
import { Tabs } from 'antd';
import { CloudDownloadOutlined, ClockCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/shared/lib/hooks';
import { PageHeader } from '@/shared/ui/PageHeader';
import { isAdminLike, isSuperAdmin } from '@/shared/lib/roles';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';
import { fetchSessionSettings } from '@/entities/session-settings/api/sessionSettingsApi';
import { SessionSettings } from '@/shared/types/library';
import { UsersTab } from './UsersTab';
import { SessionSettingsTab } from './SessionSettingsTab';
import { BackupsTab } from './BackupsTab';

export const UsersPage: React.FC = () => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const usersCount = useAppSelector((state) => state.users.list.length);
  const isSuper = isSuperAdmin(currentUser?.role);
  const isAdmin = isAdminLike(currentUser?.role);
  const showRequestError = useRequestError();

  // Глобальные настройки сессий нужны обеим вкладкам: на «Сессиях» их правят,
  // в списке пользователей они показываются как значения по умолчанию.
  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      setSessionSettings(await fetchSessionSettings());
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить настройки сессий');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadSettings();
    }
  }, [isAdmin, loadSettings]);

  const tabs = [
    {
      key: 'users',
      label: (
        <span>
          <TeamOutlined /> Пользователи
        </span>
      ),
      children: <UsersTab sessionSettings={sessionSettings} />
    },
    ...(isAdmin
      ? [
          {
            key: 'sessions',
            label: (
              <span>
                <ClockCircleOutlined /> Сессии
              </span>
            ),
            children: (
              <SessionSettingsTab
                settings={sessionSettings}
                loading={settingsLoading}
                onSaved={setSessionSettings}
              />
            )
          }
        ]
      : []),
    ...(isSuper
      ? [
          {
            key: 'backups',
            label: (
              <span>
                <CloudDownloadOutlined /> Резервные копии
              </span>
            ),
            children: <BackupsTab />
          }
        ]
      : [])
  ];

  return (
    <div>
      <PageHeader
        title="Пользователи"
        subtitle={
          usersCount
            ? pluralize(usersCount, ['учётная запись', 'учётные записи', 'учётных записей'])
            : 'Управление доступом и сессиями'
        }
      />
      <Tabs items={tabs} />
    </div>
  );
};
