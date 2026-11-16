import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Avatar,
  Button,
  Dropdown,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  MoreOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
  UnlockOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import {
  clearUserSessionSettings,
  loadUsers,
  updateUserBlockedStatus,
  updateUserRole,
  updateUserSessionSettings
} from '@/entities/user';
import { SessionSettings, User, UserRole } from '@/shared/types/library';
import { isAdminLike, isSuperAdmin } from '@/shared/lib/roles';
import { roleMeta, roleOptions } from '@/shared/constants/roles';
import { useRequestError } from '@/shared/lib/errors';
import { formatDateTime } from '@/shared/lib/date';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { useAdminStyles } from './AdminPage.styles';
import { humanDuration } from './SessionsTab';

interface Props {
  sessionSettings: SessionSettings | null;
}

interface UserFormValues {
  role?: UserRole;
  blocked?: boolean;
  sessionTtlMinutes?: number;
  maxSessionLifetimeMinutes?: number;
}

const hasOverride = (user: User) =>
  Boolean(user.sessionTtlOverrideMinutes || user.maxSessionLifetimeOverrideMinutes);

export const UsersTab: React.FC<Props> = ({ sessionSettings }) => {
  const dispatch = useAppDispatch();
  const { list, loading, error } = useAppSelector((state) => state.users);
  const currentUser = useAppSelector((state) => state.auth.user);
  const isSuper = isSuperAdmin(currentUser?.role);
  const isAdmin = isAdminLike(currentUser?.role);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const styles = useAdminStyles();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [editing, setEditing] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [form] = Form.useForm<UserFormValues>();

  useEffect(() => {
    const term = debouncedSearch.trim();
    dispatch(loadUsers({ force: true, username: term || undefined }));
  }, [dispatch, debouncedSearch]);

  const reload = () => {
    const term = debouncedSearch.trim();
    dispatch(loadUsers({ force: true, username: term || undefined }));
  };

  const openModal = (user: User) => {
    setEditing(user);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const currentTtl = editing.sessionTtlOverrideMinutes ?? undefined;
      const currentMax = editing.maxSessionLifetimeOverrideMinutes ?? undefined;
      const updates: Promise<unknown>[] = [];

      if ((values.sessionTtlMinutes ?? undefined) !== currentTtl ||
          (values.maxSessionLifetimeMinutes ?? undefined) !== currentMax) {
        updates.push(
          updateUserSessionSettings(editing.id, {
            sessionTtlMinutes: values.sessionTtlMinutes ?? null,
            maxSessionLifetimeMinutes: values.maxSessionLifetimeMinutes ?? null
          })
        );
      }
      if (isSuper && values.role && values.role !== editing.role) {
        updates.push(updateUserRole(editing.id, values.role));
      }
      if (isSuper && typeof values.blocked === 'boolean' && values.blocked !== editing.blocked) {
        updates.push(updateUserBlockedStatus(editing.id, values.blocked));
      }

      if (updates.length === 0) {
        message.info('Изменений нет');
        setModalOpen(false);
        return;
      }

      await Promise.all(updates);
      message.success('Настройки пользователя обновлены');
      setModalOpen(false);
      reload();
    } catch (err) {
      showRequestError(err, 'Не удалось обновить настройки пользователя');
    } finally {
      setSaving(false);
    }
  };

  const handleClearOverrides = async (user: User) => {
    setPendingUserId(user.id);
    try {
      await clearUserSessionSettings(user.id);
      message.success('Персональные настройки сброшены');
      reload();
    } catch (err) {
      showRequestError(err, 'Не удалось сбросить настройки пользователя');
    } finally {
      setPendingUserId(null);
    }
  };

  const handleToggleBlocked = (user: User) => {
    modal.confirm({
      title: user.blocked ? 'Разблокировать пользователя?' : 'Заблокировать пользователя?',
      content: user.blocked
        ? `${user.username} снова сможет войти в систему.`
        : `${user.username} не сможет войти, активные сессии будут прерваны.`,
      okText: user.blocked ? 'Разблокировать' : 'Заблокировать',
      okButtonProps: { danger: !user.blocked },
      cancelText: 'Отмена',
      onOk: async () => {
        setPendingUserId(user.id);
        try {
          await updateUserBlockedStatus(user.id, !user.blocked);
          message.success(user.blocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
          reload();
        } catch (err) {
          showRequestError(err, 'Не удалось изменить статус пользователя');
        } finally {
          setPendingUserId(null);
        }
      }
    });
  };

  const renderAvatar = (user: User, size: number) =>
    user.avatar && user.avatarContentType ? (
      <Avatar size={size} src={`data:${user.avatarContentType};base64,${user.avatar}`} />
    ) : (
      <Avatar size={size} icon={<UserOutlined />} />
    );

  const renderRole = (role: UserRole) => (
    <Tag color={roleMeta[role]?.color ?? 'default'} bordered={false} style={styles.tag}>
      {roleMeta[role]?.label ?? role}
    </Tag>
  );

  const renderStatus = (blocked: boolean) => (
    <Tag color={blocked ? 'error' : 'success'} bordered={false} style={styles.tag}>
      {blocked ? 'Заблокирован' : 'Активен'}
    </Tag>
  );

  /**
   * Сроки сессии словами, а не в минутах: «480 / 43 200 мин» не отвечает на вопрос, когда
   * человека выкинет, а «8 часов · до 30 дней» отвечает.
   */
  const renderSession = (user: User) => {
    const personal = hasOverride(user);
    const ttl = user.sessionTtlOverrideMinutes ?? sessionSettings?.sessionTtlMinutes;
    const lifetime = user.maxSessionLifetimeOverrideMinutes ?? sessionSettings?.maxSessionLifetimeMinutes;
    if (!ttl && !lifetime) return <Typography.Text type="secondary">—</Typography.Text>;

    const value = (
      <Space direction="vertical" size={0}>
        <Typography.Text type={personal ? undefined : 'secondary'}>
          {humanDuration(ttl)} · до {humanDuration(lifetime)}
        </Typography.Text>
        <Typography.Text type="secondary" style={styles.hint}>
          {personal ? 'своё' : 'как у всех'}
        </Typography.Text>
      </Space>
    );

    return personal ? <Tooltip title="Персональные настройки сессии">{value}</Tooltip> : value;
  };

  const buildMenu = (user: User): MenuProps => ({
    items: [
      {
        key: 'clear',
        label: 'Сбросить персональные настройки',
        disabled: !hasOverride(user),
        onClick: () => handleClearOverrides(user)
      },
      ...(isSuper
        ? [
            { type: 'divider' as const },
            {
              key: 'block',
              label: user.blocked ? 'Разблокировать' : 'Заблокировать',
              icon: user.blocked ? <UnlockOutlined /> : <StopOutlined />,
              danger: !user.blocked,
              onClick: () => handleToggleBlocked(user)
            }
          ]
        : [])
    ]
  });

  const renderActions = (user: User) => (
    <Space size={2}>
      <Tooltip title="Настроить">
        <Button
          type="text"
          shape="circle"
          icon={<SettingOutlined />}
          onClick={() => openModal(user)}
          aria-label="Настроить"
        />
      </Tooltip>
      <Dropdown menu={buildMenu(user)} trigger={['click']} placement="bottomRight">
        <Button
          type="text"
          shape="circle"
          icon={<MoreOutlined />}
          loading={pendingUserId === user.id}
          aria-label="Ещё действия"
        />
      </Dropdown>
    </Space>
  );

  const columns: ColumnsType<User> = useMemo(
    () => [
      {
        title: 'Пользователь',
        dataIndex: 'username',
        render: (_: string, user) => (
          <Space size={10}>
            {renderAvatar(user, 34)}
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{user.username}</Typography.Text>
              {/* Дата заведения ушла под имя: отдельный столбец «Создан» стоил ширины,
                  которой не хватало сессии — а её здесь как раз и правят. */}
              <Typography.Text type="secondary" style={styles.hint}>
                {user.id === currentUser?.id ? 'это вы · ' : ''}с {formatDateTime(user.createdAt)}
              </Typography.Text>
            </Space>
          </Space>
        )
      },
      { title: 'Роль', dataIndex: 'role', width: 150, render: (role: UserRole) => renderRole(role) },
      {
        title: 'Статус',
        dataIndex: 'blocked',
        width: 140,
        render: (blocked: boolean) => renderStatus(blocked)
      },
      { title: 'Сессия', key: 'session', width: 190, render: (_: unknown, user) => renderSession(user) },
      ...(isAdmin
        ? [
            {
              title: '',
              key: 'actions',
              width: 96,
              align: 'right',
              render: (_: unknown, user: User) => renderActions(user)
            } as ColumnsType<User>[number]
          ]
        : [])
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, isSuper, sessionSettings, currentUser?.id, pendingUserId, styles]
  );

  const emptyState = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space direction="vertical" size={4}>
          <Typography.Text strong>
            {search.trim() ? 'Пользователи не найдены' : 'Пользователей пока нет'}
          </Typography.Text>
          {search.trim() && <Typography.Text type="secondary">Попробуйте изменить запрос.</Typography.Text>}
        </Space>
      }
    />
  );

  return (
    <>
      <div style={styles.toolbar}>
        <Input
          allowClear
          size="large"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          prefix={<SearchOutlined style={styles.searchIcon} />}
          placeholder="Поиск по имени пользователя"
        />
      </div>

      {error && <Alert type="error" showIcon message="Не удалось загрузить пользователей" description={error} style={styles.alert} />}

      {isMobile ? (
        <Space direction="vertical" size={12} style={styles.mobileList}>
          {list.length === 0 && !loading ? (
            <div style={styles.empty}>{emptyState}</div>
          ) : (
            list.map((user) => (
              <div key={user.id} style={styles.mobileCard}>
                <div style={styles.mobileHeader}>
                  <Space size={10} align="start">
                    {renderAvatar(user, 40)}
                    <Space direction="vertical" size={4}>
                      <Typography.Text strong>{user.username}</Typography.Text>
                      <Space size={6} wrap>
                        {renderRole(user.role)}
                        {renderStatus(user.blocked)}
                      </Space>
                    </Space>
                  </Space>
                  {isAdmin && renderActions(user)}
                </div>
                <div style={styles.mobileFooter}>
                  {renderSession(user)}
                  <Typography.Text type="secondary" style={styles.hint}>
                    Создан {formatDateTime(user.createdAt)}
                  </Typography.Text>
                </div>
              </div>
            ))
          )}
        </Space>
      ) : (
        <Table<User>
          rowKey={(row) => row.id}
          dataSource={list}
          loading={loading}
          columns={columns}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: emptyState }}
          style={styles.table}
        />
      )}

      <Modal
        title={editing ? `Настройки: ${editing.username}` : 'Настройки пользователя'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={
            editing
              ? {
                  role: editing.role,
                  blocked: editing.blocked,
                  sessionTtlMinutes: editing.sessionTtlOverrideMinutes ?? undefined,
                  maxSessionLifetimeMinutes: editing.maxSessionLifetimeOverrideMinutes ?? undefined
                }
              : undefined
          }
        >
          {isSuper && (
            <>
              <Form.Item label="Роль" name="role" rules={[{ required: true, message: 'Выберите роль' }]}>
                <Select options={roleOptions} />
              </Form.Item>
              <Form.Item label="Доступ" name="blocked" valuePropName="checked">
                <Switch checkedChildren="Заблокирован" unCheckedChildren="Активен" />
              </Form.Item>
            </>
          )}
          <Form.Item
            label="TTL сессии, мин"
            name="sessionTtlMinutes"
            rules={[{ min: 1, type: 'number', message: 'Значение должно быть больше 0' }]}
            extra={
              sessionSettings ? `Общее значение — ${sessionSettings.sessionTtlMinutes} мин` : undefined
            }
          >
            <InputNumber min={1} placeholder="как у всех" style={styles.fullWidth} />
          </Form.Item>
          <Form.Item
            label="Максимальный срок жизни сессии, мин"
            name="maxSessionLifetimeMinutes"
            rules={[{ min: 1, type: 'number', message: 'Значение должно быть больше 0' }]}
            extra={
              sessionSettings
                ? `Общее значение — ${sessionSettings.maxSessionLifetimeMinutes} мин`
                : undefined
            }
          >
            <InputNumber min={1} placeholder="как у всех" style={styles.fullWidth} />
          </Form.Item>
          <Typography.Text type="secondary">
            Пустые поля означают, что применяются общие настройки сессий.
          </Typography.Text>
        </Form>
      </Modal>
    </>
  );
};
