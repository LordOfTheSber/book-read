import React, { useEffect, useState } from 'react';
import { Grid, Layout, Spin, theme } from 'antd';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useAppSelector } from '@/shared/lib/hooks';
import { AppHeader } from '@/widgets/app-header';
import { GlobalSearchModal } from '@/widgets/global-search';
import { MobileTabBar, MobileTopBar, MoreSheet, MOBILE_TAB_BAR_HEIGHT } from '@/widgets/mobile-nav';
import { RecordFormProvider, useRecordForm } from '@/app/providers/RecordFormProvider';

const { Content } = Layout;

/**
 * Оболочка приложения: шапка варианта А на большом экране и нижняя панель на телефоне.
 *
 * Всё, что действует поверх страниц, живёт здесь: поиск по ⌘K, единственное действие
 * «Добавить» и форма записи, которую открывают и шапка, и поиск, и сами страницы.
 */
const Shell: React.FC = () => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { openCreate, openEdit } = useRecordForm();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // ⌘K — привычное сочетание для поиска по всему; Ctrl+K на тот же случай в Windows и Linux.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      {/* Скроллит страница целиком, а router сам прокрутку не трогает: со дна списка книг
          переход в «Аналитику» открывал её с середины. Назад-вперёд позицию возвращают. */}
      <ScrollRestoration />

      {isMobile ? (
        <MobileTopBar onOpenSearch={() => setSearchOpen(true)} />
      ) : (
        <AppHeader onOpenSearch={() => setSearchOpen(true)} onCreateRecord={openCreate} />
      )}

      <Content
        style={{
          // Под нижней панелью прячется её высота плюс вырез телефона: без вычета
          // последняя строка списка оказывалась под панелью и не нажималась.
          padding: isMobile
            ? `16px 12px calc(${MOBILE_TAB_BAR_HEIGHT + 24}px + env(safe-area-inset-bottom))`
            : '28px 24px 48px'
        }}
      >
        {/* Та же полоса, что и у шапки: без неё на широком мониторе логотип стоял по краю
            центрированной шапки, а заголовок страницы — по краю экрана. */}
        <div style={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>
          <Outlet />
        </div>
      </Content>

      {isMobile && (
        <>
          <MobileTabBar
            moreOpen={moreOpen}
            onOpenMore={() => setMoreOpen(true)}
            onCreateRecord={openCreate}
          />
          <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
        </>
      )}

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPickBook={openEdit}
      />
    </Layout>
  );
};

export const PageLayout: React.FC = () => {
  const { token } = theme.useToken();
  const user = useAppSelector((state) => state.auth.user);
  const loadingUser = useAppSelector((state) => state.auth.loadingUser);
  const authenticated = useAppSelector((state) => state.auth.authenticated);

  if (authenticated && (loadingUser || !user)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: token.colorBgLayout
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <RecordFormProvider>
      <Shell />
    </RecordFormProvider>
  );
};
