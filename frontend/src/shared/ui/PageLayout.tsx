import { Layout, Menu, Segmented } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import React from 'react';
import { useThemeMode } from '@/app/providers/ThemeProvider';
import { Logo } from './Logo';
import { usePageLayoutStyles } from './PageLayout.styles';

const { Header, Content } = Layout;

export const PageLayout: React.FC = () => {
  const location = useLocation();
  const selected = location.pathname.startsWith('/types') ? 'types' : 'books';
  const { mode, setMode } = useThemeMode();
  const styles = usePageLayoutStyles();

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
                { key: 'types', label: <Link to="/types">Типы</Link> }
              ]}
            />
          </div>

          <div style={styles.headerExtra}>
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
          </div>
        </div>
      </Header>
      <Content style={styles.content}>
        <Outlet />
      </Content>
    </Layout>
  );
};
