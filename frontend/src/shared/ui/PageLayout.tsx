import { Avatar, Button, Dropdown, Layout, Menu, Segmented, Space, Tag, Typography, Upload, message, Modal } from 'antd';
import type { UploadProps } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import React from 'react';
import { useThemeMode } from '@/app/providers/ThemeProvider';
import { Logo } from './Logo';
import { usePageLayoutStyles } from './PageLayout.styles';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { authActions, uploadAvatarThunk } from '@/entities/auth';

const { Header, Content } = Layout;

export const PageLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = location.pathname.startsWith('/types')
    ? 'types'
    : location.pathname.startsWith('/sources')
      ? 'sources'
      : location.pathname.startsWith('/users')
        ? 'users'
        : location.pathname.startsWith('/nodes')
          ? 'nodes'
          : 'books';
  const { mode, setMode } = useThemeMode();
  const styles = usePageLayoutStyles();
  const user = useAppSelector((state) => state.auth.user);
  const updatingAvatar = useAppSelector((state) => state.auth.updatingAvatar);
  const dispatch = useAppDispatch();
  const [isAvatarPreviewOpen, setAvatarPreviewOpen] = React.useState(false);
  const [isDropdownOpen, setDropdownOpen] = React.useState(false);

  const handleLogout = () => {
    dispatch(authActions.logout());
    navigate('/login');
  };

  const avatarSrc = user?.avatar && user.avatarContentType ? `data:${user.avatarContentType};base64,${user.avatar}` : undefined;

  const handleAvatarUpload: UploadProps['beforeUpload'] = async (file) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      message.error('Поддерживаются только PNG, JPEG, WEBP или GIF');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('Размер файла не должен превышать 2 МБ');
      return Upload.LIST_IGNORE;
    }
    try {
      await dispatch(uploadAvatarThunk(file)).unwrap();
      message.success('Аватар обновлён');
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Не удалось загрузить аватар';
      message.error(msg);
    }
    return false;
  };

  const handleAvatarClick: React.MouseEventHandler = (event) => {
    event.stopPropagation();
    if (!isDropdownOpen) return;
    if (!avatarSrc) {
      message.info('Аватар ещё не загружен');
      return;
    }
    setAvatarPreviewOpen(true);
  };

  React.useEffect(() => {
    if (!isDropdownOpen) {
      setAvatarPreviewOpen(false);
    }
  }, [isDropdownOpen]);

  return (
    <Layout style={styles.layout}>
      <Header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.brand}>
            <Logo />
            <div style={styles.brandText}>
              <div style={styles.brandTitle}>BookRead</div>
              <div style={styles.brandSubtitle}>Личная библиотека</div>
            </div>
          </div>

          <div style={styles.menuContainer}>
            <Menu
              style={styles.menu}
              theme="dark"
              mode="horizontal"
              selectedKeys={[selected]}
              items={[
                { key: 'books', label: <Link to="/">Книги</Link> },
                { key: 'types', label: <Link to="/types">Типы</Link> },
                { key: 'sources', label: <Link to="/sources">Источники</Link> },
                ...(user?.role === 'ADMIN'
                  ? [
                      { key: 'users', label: <Link to="/users">Пользователи</Link> },
                      { key: 'nodes', label: <Link to="/nodes">Узлы</Link> }
                    ]
                  : [])
              ]}
            />
          </div>

          <div style={styles.headerExtra}>
            {user ? (
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                open={isDropdownOpen}
                onOpenChange={setDropdownOpen}
                dropdownRender={() => (
                  <div
                    style={{
                      padding: 12,
                      minWidth: 220,
                      background: mode === 'dark' ? '#1f1f1f' : '#fff',
                      color: mode === 'dark' ? '#fafafa' : undefined,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      borderRadius: 8
                    }}
                  >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Space>
                        <Avatar src={avatarSrc} onClick={handleAvatarClick} style={{ cursor: 'pointer' }}>
                          {user.username.charAt(0).toUpperCase()}
                        </Avatar>
                        <div>
                          <Typography.Text strong>{user.username}</Typography.Text>
                          <br />
                          <Tag color="blue" style={{ marginTop: 4 }}>
                            {user.role}
                          </Tag>
                        </div>
                      </Space>
                      <Upload showUploadList={false} beforeUpload={handleAvatarUpload}>
                        <Button block loading={updatingAvatar}>
                          Изменить аватар
                        </Button>
                      </Upload>
                      <div>
                        <Typography.Text type="secondary">Тема</Typography.Text>
                        <Segmented
                          style={{ marginTop: 8, width: '100%' }}
                          value={mode}
                          onChange={(value) => setMode(value as typeof mode)}
                          options={[
                            { label: 'Светлая', value: 'light' },
                            { label: 'Бирюзовая', value: 'teal' },
                            { label: 'Тёмная', value: 'dark' }
                          ]}
                        />
                      </div>
                      <Button danger type="text" onClick={handleLogout}>
                        Выйти
                      </Button>
                    </Space>
                  </div>
                )}
              >
                <Button type="text" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar size="small" src={avatarSrc} onClick={handleAvatarClick} style={{ cursor: 'pointer' }}>
                    {user.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <span>{user.username}</span>
                </Button>
              </Dropdown>
            ) : (
              <Space>
                <Button type="primary" onClick={() => navigate('/login')}>
                  Войти
                </Button>
                <Button onClick={() => navigate('/register')}>Регистрация</Button>
                <span style={styles.toggleLabel}>Тема</span>
                <Segmented
                  value={mode}
                  onChange={(value) => setMode(value as typeof mode)}
                  size="small"
                  options={[
                    { label: 'Светлая', value: 'light' },
                    { label: 'Бирюзовая', value: 'teal' },
                    { label: 'Тёмная', value: 'dark' }
                  ]}
                />
              </Space>
            )}
          </div>
        </div>
      </Header>
      <Content style={styles.content}>
        <Outlet />
      </Content>

      <Modal
        open={isAvatarPreviewOpen}
        footer={null}
        onCancel={() => setAvatarPreviewOpen(false)}
        centered
        width={360}
        bodyStyle={{ textAlign: 'center' }}
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="Аватар пользователя" style={{ width: '100%', maxHeight: 320, objectFit: 'contain' }} />
        ) : (
          <Typography.Text type="secondary">Аватар отсутствует</Typography.Text>
        )}
      </Modal>
    </Layout>
  );
};
