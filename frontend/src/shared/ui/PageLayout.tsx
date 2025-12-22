import { Layout, Menu, Switch } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import React from 'react';
import { useThemeMode } from '@/app/providers/ThemeProvider';
import { usePageLayoutStyles } from './PageLayout.styles';

const { Header, Content } = Layout;

export const PageLayout: React.FC = () => {
  const location = useLocation();
  const selected = location.pathname.startsWith('/types') ? 'types' : 'books';
  const { mode, toggle } = useThemeMode();
  const styles = usePageLayoutStyles();

  return (
    <Layout style={styles.layout}>
      <Header>
        <div style={styles.headerContent}>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[selected]}
            items={[
              { key: 'books', label: <Link to="/">Книги</Link> },
              { key: 'types', label: <Link to="/types">Типы</Link> }
            ]}
          />
          <div style={styles.headerExtra}>
            Тема
            <Switch
              checkedChildren="Тёмная"
              unCheckedChildren="Светлая"
              checked={mode === 'dark'}
              onChange={toggle}
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
