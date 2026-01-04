import { Avatar, Button, Drawer, Grid, Layout, Menu, Segmented, Space, Spin, Tag, Tooltip } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import React, { useMemo, useState } from 'react';
import { BulbOutlined, LogoutOutlined, MenuOutlined, UserOutlined } from '@ant-design/icons';
import { useThemeMode } from '@/app/providers/ThemeProvider';
import { Logo } from './Logo';
import { usePageLayoutStyles } from './PageLayout.styles';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { authActions } from '@/entities/auth';
import { isAdminLike } from '@/shared/lib/roles';

const { Header, Content } = Layout;

export const PageLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const selected = useMemo(
    () =>
      location.pathname.startsWith('/profile')
        ? ''
        : location.pathname.startsWith('/types')
          ? 'types'
          : location.pathname.startsWith('/sources')
            ? 'sources'
            : location.pathname.startsWith('/users')
              ? 'users'
              : location.pathname.startsWith('/nodes')
                ? 'nodes'
                : location.pathname.startsWith('/analytics')
                  ? 'analytics'
                  : 'books',
    [location.pathname]
  );
  const { mode, setMode } = useThemeMode();
  const styles = usePageLayoutStyles(isMobile);
  const user = useAppSelector((state) => state.auth.user);
  const loadingUser = useAppSelector((state) => state.auth.loadingUser);
  const token = useAppSelector((state) => state.auth.token);
  const dispatch = useAppDispatch();
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const themeColorMap: Record<typeof mode, string> = {
    light: '#f5f5f5',
    teal: '#0fbf9f',
    dark: '#1f1f1f'
  };
  const themeOrder = ['light', 'teal', 'dark'] as const;
  const handleToggleTheme = () => {
    const currentIndex = themeOrder.indexOf(mode);
    const nextMode = themeOrder[(currentIndex + 1) % themeOrder.length];
    setMode(nextMode);
  };

  const handleLogout = () => {
    dispatch(authActions.logout());
    navigate('/login');
  };

  const avatarSrc = user?.avatar && user.avatarContentType ? `data:${user.avatarContentType};base64,${user.avatar}` : undefined;
  const closeDrawer = () => setDrawerOpen(false);

  const menuItems = [
    { key: 'books', label: <Link to="/">Книги</Link> },
    { key: 'analytics', label: <Link to="/analytics">Аналитика</Link> },
    { key: 'types', label: <Link to="/types">Типы</Link> },
    { key: 'sources', label: <Link to="/sources">Источники</Link> },
    ...(isAdminLike(user?.role)
      ? [
          { key: 'users', label: <Link to="/users">Пользователи</Link> },
          { key: 'nodes', label: <Link to="/nodes">Узлы</Link> }
        ]
      : [])
  ];

  if (token && (loadingUser || !user)) {
    return (
      <div style={styles.loader}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout style={styles.layout}>
      <Header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerTopRow}>
            <div style={styles.brand}>
              <Logo />
              <div style={styles.brandText}>
                <div style={styles.brandTitle}>BookRead</div>
                <div style={styles.brandSubtitle}>Личная библиотека</div>
              </div>
            </div>

            {isMobile ? (
              <Space align="center" size={10}>
                <Tooltip title="Сменить тему" placement="bottom">
                  <Button
                    shape="circle"
                    icon={
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: themeColorMap[mode],
                          boxShadow: '0 0 0 1px rgba(0,0,0,0.08) inset'
                        }}
                      />
                    }
                    onClick={handleToggleTheme}
                    style={styles.mobileThemeButton}
                    aria-label="Сменить тему"
                  />
                </Tooltip>
                <Tooltip title="Меню">
                  <Button
                    icon={<MenuOutlined />}
                    shape="circle"
                    style={styles.mobileMenuButton}
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Меню навигации"
                  />
                </Tooltip>
              </Space>
            ) : (
              <div style={styles.menuContainer}>
                <Menu
                  style={styles.menu}
                  theme="dark"
                  mode="horizontal"
                  selectedKeys={selected ? [selected] : undefined}
                  items={menuItems}
                />
              </div>
            )}
          </div>

          {!isMobile && (
            <div style={styles.headerExtra}>
              {user ? (
                <Space align="center" size={8} wrap>
                  <Tooltip title="Сменить тему" placement="bottom">
                    <Button
                      shape="circle"
                      icon={
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: themeColorMap[mode],
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.08) inset'
                          }}
                        />
                      }
                      onClick={handleToggleTheme}
                      style={{
                        width: 36,
                        height: 36,
                        minWidth: 36,
                        padding: 0,
                        borderColor: 'rgba(255,255,255,0.55)',
                        background: 'rgba(255,255,255,0.12)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
                      }}
                    />
                  </Tooltip>
                  <Button
                    onClick={() => navigate('/profile')}
                    shape="round"
                    icon={<Avatar size="small" src={avatarSrc} icon={<UserOutlined />} />}
                    style={{
                      color: '#fff',
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      paddingInline: 12,
                      borderColor: 'rgba(255,255,255,0.45)',
                      background: 'rgba(255,255,255,0.08)'
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{user.username}</span>
                  </Button>
                  <Tooltip title="Выйти">
                    <Button
                      shape="round"
                      icon={<LogoutOutlined />}
                      onClick={handleLogout}
                      style={{
                        height: 36,
                        paddingInline: 14,
                        color: '#ff4d4f',
                        borderColor: '#ff7a7c',
                        background: 'rgba(255,77,79,0.08)',
                        fontWeight: 600
                      }}
                    >
                      Выйти
                    </Button>
                  </Tooltip>
                </Space>
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
          )}
        </div>
      </Header>
      <Drawer
        placement="right"
        open={isDrawerOpen}
        onClose={closeDrawer}
        bodyStyle={styles.mobileDrawerBody}
        width={320}
        destroyOnClose
        styles={{ header: { display: 'none' } }}
        closable={false}
      >
        <Menu
          style={styles.mobileMenu}
          mode="inline"
          selectedKeys={selected ? [selected] : undefined}
          items={menuItems}
          onClick={() => setDrawerOpen(false)}
        />
        <div style={styles.mobileMenuFooter}>
          {user ? (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Button
                onClick={() => {
                  navigate('/profile');
                  closeDrawer();
                }}
                icon={<Avatar size="small" src={avatarSrc} icon={<UserOutlined />} />}
                block
              >
                Профиль
              </Button>
              <Button
                type="primary"
                icon={<LogoutOutlined />}
                danger
                onClick={() => {
                  handleLogout();
                  closeDrawer();
                }}
                block
              >
                Выйти
              </Button>
            </Space>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" onClick={() => navigate('/login')} block>
                Войти
              </Button>
              <Button onClick={() => navigate('/register')} block>
                Регистрация
              </Button>
              <Segmented
                value={mode}
                onChange={(value) => setMode(value as typeof mode)}
                size="middle"
                options={[
                  { label: 'Светлая', value: 'light' },
                  { label: 'Бирюзовая', value: 'teal' },
                  { label: 'Тёмная', value: 'dark' }
                ]}
              />
            </Space>
          )}
        </div>
      </Drawer>
      <Content style={styles.content}>
        <Outlet />
      </Content>
    </Layout>
  );
};
