import { Layout, Menu } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import React from 'react';

const { Header, Content } = Layout;

export const PageLayout: React.FC = () => {
  const location = useLocation();
  const selected = location.pathname.startsWith('/types') ? 'types' : 'books';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selected]}
          items={[
            { key: 'books', label: <Link to="/">Books</Link> },
            { key: 'types', label: <Link to="/types">Types</Link> }
          ]}
        />
      </Header>
      <Content style={{ padding: '24px' }}>
        <Outlet />
      </Content>
    </Layout>
  );
};
