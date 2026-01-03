import React, { useEffect, useState } from 'react';
import { Button, Card, Form, InputNumber, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { clearUserSessionSettings, loadUsers, updateUserSessionSettings } from '@/entities/user';
import { fetchSessionSettings, updateSessionSettings } from '@/entities/session-settings/api/sessionSettingsApi';
import { SessionSettings, User } from '@/shared/types/library';

export const UsersPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading, error, loaded } = useAppSelector((state) => state.users);
  const currentUser = useAppSelector((state) => state.auth.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userActionId, setUserActionId] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [savingUserSettings, setSavingUserSettings] = useState(false);
  const [settingsForm] = Form.useForm<SessionSettings>();
  const [userForm] = Form.useForm<{
    sessionTtlMinutes?: number;
    maxSessionLifetimeMinutes?: number;
  }>();

  useEffect(() => {
    if (!loaded) {
      dispatch(loadUsers());
    }
  }, [dispatch, loaded]);

  useEffect(() => {
    if (isAdmin) {
      void loadSessionSettings();
    }
  }, [isAdmin]);

  const loadSessionSettings = async () => {
    setSettingsLoading(true);
    try {
      const settings = await fetchSessionSettings();
      setSessionSettings(settings);
      settingsForm.setFieldsValue(settings);
    } catch (err: any) {
      message.error(getErrorMessage(err, 'Не удалось загрузить настройки сессий'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveGlobal = async () => {
    try {
      const values = await settingsForm.validateFields();
      setSavingGlobal(true);
      const updated = await updateSessionSettings(values);
      setSessionSettings(updated);
      message.success('Настройки сессий обновлены');
    } catch (err: any) {
      if (!err?.errorFields) {
        message.error(getErrorMessage(err, 'Не удалось обновить настройки сессий'));
      }
    } finally {
      setSavingGlobal(false);
    }
  };

  const openUserModal = (user: User) => {
    setEditingUser(user);
    setUserModalOpen(true);
    userForm.setFieldsValue({
      sessionTtlMinutes: user.sessionTtlOverrideMinutes ?? undefined,
      maxSessionLifetimeMinutes: user.maxSessionLifetimeOverrideMinutes ?? undefined
    });
  };

  const handleSaveUserSettings = async () => {
    if (!editingUser) return;
    try {
      const values = await userForm.validateFields();
      setSavingUserSettings(true);
      await updateUserSessionSettings(editingUser.id, values);
      message.success('Настройки пользователя обновлены');
      setUserModalOpen(false);
      dispatch(loadUsers(true));
    } catch (err: any) {
      if (!err?.errorFields) {
        message.error(getErrorMessage(err, 'Не удалось обновить настройки пользователя'));
      }
    } finally {
      setSavingUserSettings(false);
    }
  };

  const handleClearUserSettings = async (user: User) => {
    setUserActionId(user.id);
    try {
      await clearUserSessionSettings(user.id);
      message.success('Настройки пользователя сброшены');
      dispatch(loadUsers(true));
    } catch (err: any) {
      message.error(getErrorMessage(err, 'Не удалось сбросить настройки пользователя'));
    } finally {
      setUserActionId(null);
    }
  };

  const renderSessionInfo = (record: User) => {
    const hasOverride = record.sessionTtlOverrideMinutes || record.maxSessionLifetimeOverrideMinutes;
    if (hasOverride) {
      return (
        <Space direction="vertical" size={0}>
          <Typography.Text>
            TTL: {record.sessionTtlOverrideMinutes ? `${record.sessionTtlOverrideMinutes} мин` : '—'}
          </Typography.Text>
          <Typography.Text type="secondary">
            Макс: {record.maxSessionLifetimeOverrideMinutes ? `${record.maxSessionLifetimeOverrideMinutes} мин` : '—'}
          </Typography.Text>
        </Space>
      );
    }
    if (sessionSettings) {
      return (
        <Typography.Text type="secondary">
          По умолчанию ({sessionSettings.sessionTtlMinutes}/{sessionSettings.maxSessionLifetimeMinutes} мин)
        </Typography.Text>
      );
    }
    return '—';
  };

  const getErrorMessage = (err: any, fallback: string) =>
    err?.response?.data?.message || err?.message || fallback;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {isAdmin && (
        <Card title="Глобальные настройки сессий" loading={settingsLoading}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Управляйте временем жизни сессий и максимальным сроком продления для всех пользователей.
          </Typography.Paragraph>
          <Form layout="inline" form={settingsForm}>
            <Form.Item
              label="TTL сессии (мин)"
              name="sessionTtlMinutes"
              rules={[{ required: true, message: 'Укажите TTL сессии' }, { min: 1, type: 'number' }]}
            >
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item
              label="Максимум (мин)"
              name="maxSessionLifetimeMinutes"
              rules={[
                { required: true, message: 'Укажите максимальный срок' },
                { min: 1, type: 'number', message: 'Значение должно быть больше 0' }
              ]}
            >
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSaveGlobal} loading={savingGlobal}>
                Сохранить
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}

      <Card title="Пользователи">
        {error && (
          <Typography.Paragraph type="danger" style={{ marginBottom: 12 }}>
            {error}
          </Typography.Paragraph>
        )}
        <Table<User>
          rowKey={(row) => row.id}
          dataSource={list}
          loading={loading}
          pagination={false}
          columns={[
            {
              title: 'Аватар',
              dataIndex: 'avatar',
              render: (_: unknown, record) =>
                record.avatar && record.avatarContentType ? (
                  <img
                    src={`data:${record.avatarContentType};base64,${record.avatar}`}
                    alt={record.username}
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#e0e0e0'
                    }}
                  />
                )
            },
            { title: 'Имя', dataIndex: 'username' },
            {
              title: 'Роль',
              dataIndex: 'role',
              render: (role: string) => <Tag color="blue">{role}</Tag>
            },
            {
              title: 'Сессия',
              render: (_: unknown, record) => renderSessionInfo(record)
            },
            {
              title: 'Создан',
              dataIndex: 'createdAt',
              render: (value?: string) => (value ? new Date(value).toLocaleString() : '—')
            },
            {
              title: 'Обновлён',
              dataIndex: 'updatedAt',
              render: (value?: string) => (value ? new Date(value).toLocaleString() : '—')
            },
            ...(isAdmin
              ? [
                  {
                    title: 'Действия',
                    render: (_: unknown, record: User) => (
                      <Space>
                        <Button size="small" onClick={() => openUserModal(record)}>
                          Настроить
                        </Button>
                        <Button
                          size="small"
                          danger
                          onClick={() => handleClearUserSettings(record)}
                          disabled={
                            !record.sessionTtlOverrideMinutes && !record.maxSessionLifetimeOverrideMinutes
                          }
                          loading={userActionId === record.id}
                        >
                          Сбросить
                        </Button>
                      </Space>
                    )
                  }
                ]
              : [])
          ]}
        />
      </Card>

      <Modal
        title={editingUser ? `Настройки сессии: ${editingUser.username}` : 'Настройки сессии'}
        open={userModalOpen}
        onCancel={() => {
          setUserModalOpen(false);
          setEditingUser(null);
        }}
        onOk={handleSaveUserSettings}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={savingUserSettings}
        destroyOnClose
      >
        <Form layout="vertical" form={userForm}>
          <Form.Item
            label="TTL сессии (мин)"
            name="sessionTtlMinutes"
            rules={[{ min: 1, type: 'number', message: 'TTL должен быть больше 0' }]}
          >
            <InputNumber min={1} placeholder="Использовать глобальный TTL" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Максимальный срок (мин)"
            name="maxSessionLifetimeMinutes"
            rules={[{ min: 1, type: 'number', message: 'Значение должно быть больше 0' }]}
          >
            <InputNumber
              min={1}
              placeholder="Использовать глобальное значение"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            Пустые значения означают использование глобальных настроек.
          </Typography.Paragraph>
        </Form>
      </Modal>
    </Space>
  );
};
