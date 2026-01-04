import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Form,
  Grid,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import {
  clearUserSessionSettings,
  loadUsers,
  updateUserBlockedStatus,
  updateUserRole,
  updateUserSessionSettings
} from '@/entities/user';
import { fetchSessionSettings, updateSessionSettings } from '@/entities/session-settings/api/sessionSettingsApi';
import { SessionSettings, User } from '@/shared/types/library';
import {
  requestExport,
  downloadExport,
  listExports,
  deleteExportFile,
  restoreExport
} from '@/entities/export/api/exportApi';
import { useUsersPageStyles } from './UsersPage.styles';
import { isAdminLike, isSuperAdmin } from '@/shared/lib/roles';

export const UsersPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading, error, loaded } = useAppSelector((state) => state.users);
  const currentUser = useAppSelector((state) => state.auth.user);
  const isSuper = isSuperAdmin(currentUser?.role);
  const isAdminLikeRole = isAdminLike(currentUser?.role);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const styles = useUsersPageStyles(isMobile);
  const [searchValue, setSearchValue] = useState('');
  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userActionId, setUserActionId] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [savingUserSettings, setSavingUserSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExportFile, setLastExportFile] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [exports, setExports] = useState<
    { fileName: string; sizeBytes: number; lastModifiedAt: string; downloadUrl?: string }[]
  >([]);
  const [exportsLoading, setExportsLoading] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [settingsForm] = Form.useForm<SessionSettings>();
  const [userForm] = Form.useForm<{
    sessionTtlMinutes?: number;
    maxSessionLifetimeMinutes?: number;
    role?: User['role'];
    blocked?: boolean;
  }>();

  useEffect(() => {
    if (!loaded) {
      dispatch(loadUsers());
    }
  }, [dispatch, loaded]);

  useEffect(() => {
    if (isAdminLikeRole) {
      void loadSessionSettings();
    }
  }, [isAdminLikeRole]);

  useEffect(() => {
    if (isSuper) {
      void loadExports();
    }
  }, [isSuper]);

  const fetchUsersWithSearch = (value?: string) => {
    const term = (value ?? searchValue).trim();
    dispatch(loadUsers({ force: true, username: term || undefined }));
  };

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
      maxSessionLifetimeMinutes: user.maxSessionLifetimeOverrideMinutes ?? undefined,
      role: user.role,
      blocked: user.blocked
    });
  };

  const handleSaveUserSettings = async () => {
    if (!editingUser) return;
    try {
      const values = await userForm.validateFields();
      setSavingUserSettings(true);
      const currentTtl = editingUser.sessionTtlOverrideMinutes ?? undefined;
      const currentMax = editingUser.maxSessionLifetimeOverrideMinutes ?? undefined;
      const updates: Promise<unknown>[] = [];
      const sessionChanged =
        (values.sessionTtlMinutes ?? undefined) !== currentTtl ||
        (values.maxSessionLifetimeMinutes ?? undefined) !== currentMax;
      if (sessionChanged) {
        updates.push(updateUserSessionSettings(editingUser.id, values));
      }
      if (isSuper && values.role && values.role !== editingUser.role) {
        updates.push(updateUserRole(editingUser.id, values.role));
      }
      if (isSuper && typeof values.blocked === 'boolean' && values.blocked !== editingUser.blocked) {
        updates.push(updateUserBlockedStatus(editingUser.id, values.blocked));
      }
      if (updates.length === 0) {
        message.info('Изменений нет');
        return;
      }
      await Promise.all(updates);
      message.success('Настройки пользователя обновлены');
      setUserModalOpen(false);
      fetchUsersWithSearch();
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
      fetchUsersWithSearch();
    } catch (err: any) {
      message.error(getErrorMessage(err, 'Не удалось сбросить настройки пользователя'));
    } finally {
      setUserActionId(null);
    }
  };

  const handleToggleBlocked = async (user: User) => {
    setBlockingUserId(user.id);
    try {
      await updateUserBlockedStatus(user.id, !user.blocked);
      message.success(!user.blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
      fetchUsersWithSearch();
    } catch (err: any) {
      message.error(getErrorMessage(err, 'Не удалось изменить статус пользователя'));
    } finally {
      setBlockingUserId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const info = await requestExport();
      setLastExportFile(info.fileName);
      await loadExports();
      message.success(`Данные сохранены: ${info.fileName}`);
    } catch (err: any) {
      message.error(getErrorMessage(err, 'Не удалось сохранить данные'));
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadExport = async (fileName: string) => {
    setDownloadingFile(fileName);
    try {
      const blob = await downloadExport(fileName);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
      message.success('Файл экспорта скачан');
    } catch (err: any) {
      message.error(getErrorMessage(err, 'Не удалось скачать экспорт'));
    } finally {
      setDownloadingFile(null);
    }
  };

  const loadExports = async () => {
    setExportsLoading(true);
    try {
      const files = await listExports();
      setExports(files);
      if (!lastExportFile && files.length > 0) {
        setLastExportFile(files[0].fileName);
      }
    } catch (err: any) {
      message.error(getErrorMessage(err, 'Не удалось получить список экспортов'));
    } finally {
      setExportsLoading(false);
    }
  };

  const handleDeleteExport = async (fileName: string) => {
    Modal.confirm({
      title: `Удалить файл ${fileName}?`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      onOk: async () => {
        setDeletingFile(fileName);
        try {
          await deleteExportFile(fileName);
          message.success('Файл удалён');
          await loadExports();
        } catch (err: any) {
          message.error(getErrorMessage(err, 'Не удалось удалить файл экспорта'));
        } finally {
          setDeletingFile(null);
        }
      }
    });
  };

  const handleRestoreExport = async (fileName: string) => {
    Modal.confirm({
      title: `Восстановить данные из ${fileName}?`,
      okText: 'Восстановить',
      cancelText: 'Отмена',
      onOk: async () => {
        setRestoringFile(fileName);
        try {
          const result = await restoreExport(fileName);
          message.success(
            `Восстановлено: пользователи ${result.restoredUsers}, записи ${result.restoredItems}, типы ${result.restoredBookTypes}`
          );
          fetchUsersWithSearch();
        } catch (err: any) {
          message.error(getErrorMessage(err, 'Не удалось восстановить данные'));
        } finally {
          setRestoringFile(null);
        }
      }
    });
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

  const roleColors: Record<User['role'], string> = {
    SUPER_ADMIN: 'purple',
    ADMIN: 'blue',
    EDITOR: 'geekblue',
    USER: 'gray'
  };

  const renderRoleTag = (role: User['role']) => <Tag color={roleColors[role] || 'blue'}>{role}</Tag>;

  const renderStatusTag = (blocked: boolean) =>
    blocked ? <Tag color="red">Заблокирован</Tag> : <Tag color="green">Активен</Tag>;

  return (
    <div style={styles.pageContainer}>
      {isSuper && (
        <Card title="Резервное копирование" style={styles.card} headStyle={styles.cardHead} bodyStyle={styles.cardBody}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Сохраните всю базу в JSON-файл на сервере. Файл можно скачать после создания.
          </Typography.Paragraph>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button type="primary" onClick={handleExport} loading={exporting}>
              Сохранить данные
            </Button>
            {lastExportFile && (
              <Button
                onClick={() => handleDownloadExport(lastExportFile)}
                loading={downloadingFile === lastExportFile}
              >
                Скачать {lastExportFile}
              </Button>
            )}
          </Space>
          <Table
            dataSource={exports}
            rowKey={(row) => row.fileName}
            loading={exportsLoading}
            size="small"
            pagination={false}
            scroll={{ x: true }}
            columns={[
              { title: 'Файл', dataIndex: 'fileName' },
              {
                title: 'Размер',
                dataIndex: 'sizeBytes',
                render: (value: number) => `${(value / (1024 * 1024)).toFixed(2)} МБ`
              },
              {
                title: 'Обновлён',
                dataIndex: 'lastModifiedAt',
                render: (value?: string) => (value ? new Date(value).toLocaleString() : '—')
              },
              {
                title: 'Действия',
                render: (_: unknown, record) => (
                  <Space size="small" wrap>
                    <Button
                      size="small"
                      onClick={() => handleDownloadExport(record.fileName)}
                      loading={downloadingFile === record.fileName}
                    >
                      Скачать
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => handleRestoreExport(record.fileName)}
                      loading={restoringFile === record.fileName}
                    >
                      Восстановить
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => handleDeleteExport(record.fileName)}
                      loading={deletingFile === record.fileName}
                    >
                      Удалить
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        </Card>
      )}

      {isAdminLikeRole && (
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
        <div style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="Поиск по username"
            allowClear
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onSearch={(value) => {
              setSearchValue(value);
              fetchUsersWithSearch(value);
            }}
            enterButton="Поиск"
            style={{ maxWidth: isMobile ? '100%' : 320 }}
            loading={loading}
          />
        </div>
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
                        {renderRoleTag(user.role)}
                        {renderStatusTag(user.blocked)}
                        <Typography.Text type="secondary">
                          {renderSessionInfo(user)}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          Создан: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                        </Typography.Text>
                      </div>
                    </Space>
                  </div>
                  {isAdminLikeRole && (
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
                        {isSuper && (
                          <Button
                            size="small"
                            danger={user.blocked}
                            onClick={() => handleToggleBlocked(user)}
                            loading={blockingUserId === user.id}
                          >
                            {user.blocked ? 'Разблокировать' : 'Блокировать'}
                          </Button>
                        )}
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
                  render: (role: User['role']) => renderRoleTag(role)
                },
                {
                  title: 'Статус',
                  dataIndex: 'blocked',
                  render: (blocked: boolean) => renderStatusTag(blocked)
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
                ...(isAdminLikeRole
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
                            {isSuper && (
                              <Button
                                size="small"
                                danger={record.blocked}
                                onClick={() => handleToggleBlocked(record)}
                                loading={blockingUserId === record.id}
                              >
                                {record.blocked ? 'Разблокировать' : 'Блокировать'}
                              </Button>
                            )}
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
          {isSuper && (
            <>
              <Form.Item label="Роль" name="role" rules={[{ required: true, message: 'Выберите роль' }]}>
                <Select
                  options={[
                    { label: 'Супер админ', value: 'SUPER_ADMIN' },
                    { label: 'Админ', value: 'ADMIN' },
                    { label: 'Редактор', value: 'EDITOR' },
                    { label: 'Пользователь', value: 'USER' }
                  ]}
                />
              </Form.Item>
              <Form.Item label="Блокировка" name="blocked" valuePropName="checked">
                <Switch checkedChildren="Заблокирован" unCheckedChildren="Активен" />
              </Form.Item>
            </>
          )}
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
            <InputNumber min={1} placeholder="Использовать глобальное значение" style={{ width: '100%' }} />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            Пустые значения означают использование глобальных настроек.
          </Typography.Paragraph>
        </Form>
      </Modal>
    </div>
  );
};
