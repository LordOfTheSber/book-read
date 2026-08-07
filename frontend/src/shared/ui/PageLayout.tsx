import React, { useMemo, useState } from 'react';
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, Space, Spin, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BgColorsOutlined, CheckOutlined, LogoutOutlined, MenuOutlined, UserOutlined } from '@ant-design/icons';
import { themeOptions, useThemeMode } from '@/app/providers/ThemeProvider';
import { Logo } from './Logo';
import { usePageLayoutStyles } from './PageLayout.styles';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { logoutThunk } from '@/entities/auth';
import { isAdminLike } from '@/shared/lib/roles';

const { Header, Content } = Layout;

interface NavItem {
  key: string;
  label: string;
  path: string;
  adminOnly?: boolean;
  /**
   * Пункты справочников не выносятся в шапку по отдельности: их пять, и вместе с остальным
   * меню превращалось в одиннадцать равноправных вкладок, среди которых не видно главного.
   */
  group?: 'catalogues';
}

const navItems: NavItem[] = [
  { key: 'books', label: 'Библиотека', path: '/' },
  { key: 'analytics', label: 'Аналитика', path: '/analytics' },
  { key: 'quotes', label: 'Выписки', path: '/quotes' },
  { key: 'import', label: 'Импорт', path: '/import' },
  { key: 'shelves', label: 'Полки и теги', path: '/shelves', group: 'catalogues' },
  { key: 'authors', label: 'Авторы', path: '/authors', group: 'catalogues' },
  { key: 'series', label: 'Серии', path: '/series', group: 'catalogues' },
  { key: 'types', label: 'Типы', path: '/types', group: 'catalogues' },
  { key: 'sources', label: 'Источники', path: '/sources', group: 'catalogues' },
  { key: 'users', label: 'Пользователи', path: '/users', adminOnly: true },
  { key: 'nodes', label: 'Узлы', path: '/nodes', adminOnly: true }
];

const CATALOGUES_KEY = 'catalogues';

export const PageLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const styles = usePageLayoutStyles(isMobile);
  const { mode, setMode } = useThemeMode();
  const user = useAppSelector((state) => state.auth.user);
  const loadingUser = useAppSelector((state) => state.auth.loadingUser);
  const authenticated = useAppSelector((state) => state.auth.authenticated);
  const dispatch = useAppDispatch();
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const visibleNav = useMemo(
    () => navItems.filter((item) => !item.adminOnly || isAdminLike(user?.role)),
    [user?.role]
  );

  // Профиль не соответствует ни одному пункту меню — там подсветка снимается.
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/profile')) return undefined;
    const match = visibleNav
      .filter((item) => item.path !== '/' && location.pathname.startsWith(item.path))
      .sort((a, b) => b.path.length - a.path.length)[0];

    return match?.key ?? 'books';
  }, [location.pathname, visibleNav]);

  const toMenuItem = (item: NavItem) => ({
    key: item.key,
    label: <Link to={item.path}>{item.label}</Link>
  });

  /**
   * Справочники сворачиваются в один пункт: они нужны эпизодически, а место в шапке
   * отбирали наравне с библиотекой и аналитикой.
   */
  const menuItems: MenuProps['items'] = [
    ...visibleNav.filter((item) => !item.group && !item.adminOnly).map(toMenuItem),
    {
      key: CATALOGUES_KEY,
      label: 'Справочники',
      children: visibleNav.filter((item) => item.group === 'catalogues').map(toMenuItem)
    },
    // Администраторские разделы — после справочников: они и реже нужны, и видны не всем.
    ...visibleNav.filter((item) => item.adminOnly).map(toMenuItem)
  ];

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/login');
  };

  const avatarSrc =
    user?.avatar && user.avatarContentType ? `data:${user.avatarContentType};base64,${user.avatar}` : undefined;

  const themeMenu: MenuProps = {
    selectable: false,
    items: themeOptions.map((option) => ({
      key: option.value,
      onClick: () => setMode(option.value),
      label: (
        <Space size={10}>
          <span style={{ ...styles.swatch, background: option.swatch }} />
          <span style={{ flex: 1 }}>{option.label}</span>
          {mode === option.value && <CheckOutlined style={styles.checkIcon} />}
        </Space>
      )
    }))
  };

  const userMenu: MenuProps = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: 'Профиль', onClick: () => navigate('/profile') },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Выйти', danger: true, onClick: handleLogout }
    ]
  };

  if (authenticated && (loadingUser || !user)) {
    return (
      <div style={styles.loader}>
        <Spin size="large" />
      </div>
    );
  }

  const themeButton = (
    <Dropdown menu={themeMenu} trigger={['click']} placement="bottomRight">
      <Button type="text" icon={<BgColorsOutlined />} aria-label="Сменить тему" />
    </Dropdown>
  );

  return (
    <Layout style={styles.layout}>
      <Header style={styles.header}>
        <div style={styles.headerInner}>
          <Link to="/" style={styles.brand}>
            <Logo size={30} />
            <span style={styles.brandTitle}>BookRead</span>
          </Link>

          {!isMobile && (
            <Menu
              mode="horizontal"
              style={styles.menu}
              selectedKeys={selectedKey ? [selectedKey] : []}
              items={menuItems}
            />
          )}

          <Space size={4} style={styles.headerActions}>
            {themeButton}
            {user ? (
              isMobile ? (
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Меню навигации"
                />
              ) : (
                <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
                  <Button type="text" style={styles.userButton}>
                    <Avatar size={24} src={avatarSrc} icon={<UserOutlined />} />
                    <span style={styles.userName}>{user.username}</span>
                  </Button>
                </Dropdown>
              )
            ) : (
              <Button type="primary" onClick={() => navigate('/login')}>
                Войти
              </Button>
            )}
          </Space>
        </div>
      </Header>

      <Drawer
        placement="right"
        open={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={300}
        title={
          user && (
            <Space>
              <Avatar size={32} src={avatarSrc} icon={<UserOutlined />} />
              <Typography.Text strong>{user.username}</Typography.Text>
            </Space>
          )
        }
        styles={{ body: styles.drawerBody }}
      >
        <Menu
          mode="inline"
          style={styles.drawerMenu}
          selectedKeys={selectedKey ? [selectedKey] : []}
          // На узком экране группа разворачивается сразу: свёрнутая, она прятала бы половину меню.
          defaultOpenKeys={[CATALOGUES_KEY]}
          items={menuItems}
          onClick={() => setDrawerOpen(false)}
        />
        <div style={styles.drawerFooter}>
          <Button
            block
            icon={<UserOutlined />}
            onClick={() => {
              navigate('/profile');
              setDrawerOpen(false);
            }}
          >
            Профиль
          </Button>
          <Button block danger icon={<LogoutOutlined />} onClick={handleLogout}>
            Выйти
          </Button>
        </div>
      </Drawer>

      <Content style={styles.content}>
        <Outlet />
      </Content>
    </Layout>
  );
};
