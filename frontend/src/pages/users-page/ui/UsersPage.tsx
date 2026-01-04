import React, { useEffect, useState } from 'react';
import { Avatar, Button, Card, Form, Grid, InputNumber, List, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { clearUserSessionSettings, loadUsers, updateUserSessionSettings } from '@/entities/user';
import { fetchSessionSettings, updateSessionSettings } from '@/entities/session-settings/api/sessionSettingsApi';
import { SessionSettings, User } from '@/shared/types/library';
import { useUsersPageStyles } from './UsersPage.styles';

export const UsersPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading, error, loaded } = useAppSelector((state) => state.users);
  const currentUser = useAppSelector((state) => state.auth.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const styles = useUsersPageStyles(isMobile);
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
    <div style={styles.pageContainer}>
      {isAdmin && (
        <Card title="Глобальные настройки сессий" loading={settingsLoading} style={styles.card} headStyle={styles.cardHead} bodyStyle={styles.cardBody}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Управляйте временем жизни сессий и максимальным сроком продления для всех пользователей.
          </Typography.Paragraph>
          <Form layout={isMobile ? 'vertical' : 'inline'} form={settingsForm} style={styles.settingsForm}>
            <Form.Item
              label="TTL сессии (мин)"
              name="sessionTtlMinutes"
              rules={[{ required: true, message: 'Укажите TTL сессии' }, { min: 1, type: 'number' }]}
            >
              <InputNumber min={1} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item
              label="Максимум (мин)"
              name="maxSessionLifetimeMinutes"
              rules={[
                { required: true, message: 'Укажите максимальный срок' },
                { min: 1, type: 'number', message: 'Значение должно быть больше 0' }
              ]}
            >
              <InputNumber min={1} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSaveGlobal} loading={savingGlobal}>
                Сохранить
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}

      <Card title="Пользователи" style={styles.card} headStyle={styles.cardHead} bodyStyle={styles.cardBody}>
        {error && (
          <Typography.Paragraph type="danger" style={{ marginBottom: 12 }}>
            {error}
          </Typography.Paragraph>
        )}
        {isMobile ? (
          <List
            dataSource={list}
            loading={loading}
            style={styles.mobileList}
            renderItem={(user) => {
              const avatar =
                user.avatar && user.avatarContentType ? (
                  <Avatar src={`data:${user.avatarContentType};base64,${user.avatar}`} />
                ) : (
                  <Avatar>{user.username?.charAt(0).toUpperCase()}</Avatar>
                );
              return (
                <div style={styles.mobileCard} key={user.id}>
                  <div style={styles.mobileHeader}>
                    <Space align="center" size={10}>
                      {avatar}
                      <div style={styles.mobileMeta}>
                        <Typography.Text strong ellipsis>
                          {user.username}
                        </Typography.Text>
                        <Tag color="blue">{user.role}</Tag>
                        <Typography.Text type="secondary">
                          {renderSessionInfo(user)}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          Создан: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                        </Typography.Text>
                      </div>
                    </Space>
                  </div>
                  {isAdmin && (
                    <div style={{ marginTop: 8 }}>
                      <Space style={styles.mobileActions} wrap>
                        <Button size="small" onClick={() => openUserModal(user)}>
                          Настроить
                        </Button>
                        <Button
                          size="small"
                          danger
                          onClick={() => handleClearUserSettings(user)}
                          disabled={!user.sessionTtlOverrideMinutes && !user.maxSessionLifetimeOverrideMinutes}
                          loading={userActionId === user.id}
                        >
                          Сбросить
                        </Button>
                      </Space>
                    </div>
                  )}
                </div>
              );
            }}
          />
        ) : (
          <div style={styles.tableWrapper}>
            <Table<User>
              rowKey={(row) => row.id}
              dataSource={list}
              loading={loading}
              pagination={false}
              size="middle"
              scroll={{ x: true }}
              columns={[
                {
                  title: 'Аватар',
                  dataIndex: 'avatar',
                  responsive: ['sm'],
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
                { title: 'Имя', dataIndex: 'username', ellipsis: true },
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
                  responsive: ['md'],
                  render: (value?: string) => (value ? new Date(value).toLocaleString() : '—')
                },
                {
                  title: 'Обновлён',
                  dataIndex: 'updatedAt',
                  responsive: ['lg'],
                  render: (value?: string) => (value ? new Date(value).toLocaleString() : '—')
                },
                ...(isAdmin
                  ? [
                      {
                        title: 'Действия',
                        render: (_: unknown, record: User) => (
                          <Space wrap>
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
          </div>
        )}
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
    </div>
  );
};
