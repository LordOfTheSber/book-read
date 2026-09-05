import React from 'react';
import { Button, Card, Segmented, Space, Tag, Typography, theme } from 'antd';
import { CloudSyncOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/shared/lib/hooks';
import { themeOptions, useThemeMode } from '@/app/providers/ThemeProvider';
import { useOfflineQueue } from '@/widgets/offline-queue';
import { MyDataCard } from '@/features/account/manage-my-data';
import { DevicesCard } from '@/features/account/manage-devices';
import { ChangePasswordCard } from '@/features/account/change-password';
import { roleMeta } from '@/shared/constants/roles';
import { formatDate } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/plural';

/**
 * Аккаунт: учётная запись, оформление, состояние синхронизации и выгрузка с удалением.
 *
 * Удаление аккаунта было последним абзацем того же свитка, где лежит статистика чтения.
 * Отдельная вкладка делает разницу между «скачать выгрузку» и «стереть всё» видимой
 * до нажатия — сама зона остаётся в «Моих данных» и отбита цветом там.
 */
export const AccountTab: React.FC = () => {
  const { token } = theme.useToken();
  const { mode, setMode } = useThemeMode();
  const user = useAppSelector((state) => state.auth.user);
  const { online, queued, retry } = useOfflineQueue();

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card title="Учётная запись">
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Логин и роль меняет администратор.
        </Typography.Paragraph>
        <Space size={[8, 8]} wrap>
          {user?.username && <Tag bordered={false}>{`@${user.username}`}</Tag>}
          {user?.role && (
            <Tag color={roleMeta[user.role]?.color ?? 'default'} bordered={false}>
              {roleMeta[user.role]?.label ?? user.role}
            </Tag>
          )}
          {user?.createdAt && <Tag bordered={false}>{`с нами с ${formatDate(user.createdAt)}`}</Tag>}
        </Space>
      </Card>

      <Card title="Оформление">
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Тема сохраняется в этом браузере. Быстрое переключение — в меню профиля в шапке.
        </Typography.Paragraph>
        <Segmented
          block
          value={mode}
          onChange={(value) => setMode(value as typeof mode)}
          options={themeOptions.map((option) => ({ label: option.label, value: option.value }))}
        />
      </Card>

      <ChangePasswordCard />

      <DevicesCard />

      {/*
        Состояние очереди — не украшение: отметки прогресса, сделанные без сети, лежат в браузере,
        и на другом устройстве их не видно. В шапке про это говорит чип, но только пока очередь
        не пуста; здесь состояние видно всегда.
      */}
      <Card title="Офлайн и синхронизация">
        <Space size={12} wrap style={{ marginBottom: 10 }}>
          <Tag
            bordered={false}
            color={queued > 0 ? 'warning' : online ? 'success' : 'default'}
            icon={<CloudSyncOutlined />}
          >
            {queued > 0
              ? `${pluralize(queued, ['правка ждёт', 'правки ждут', 'правок ждут'])} сети`
              : online
                ? 'Всё отправлено'
                : 'Нет сети'}
          </Tag>
          {queued > 0 && (
            <Button size="small" onClick={retry}>
              Отправить
            </Button>
          )}
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13, lineHeight: 1.6 }}>
          Отметки прогресса, сделанные без сети, хранятся в браузере и уходят на сервер сами.
          Пока они здесь, на другом устройстве их не видно.
        </Typography.Paragraph>
      </Card>

      <div style={{ borderRadius: token.borderRadiusLG }}>
        <MyDataCard />
      </div>
    </Space>
  );
};
