import React from 'react';
import { theme } from 'antd';
import {
  BarChartOutlined,
  EllipsisOutlined,
  PlusOutlined,
  ReadOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { findSection } from '@/shared/config/navigation';
import { isAdminLike, canEditBooks } from '@/shared/lib/roles';
import { useAppSelector } from '@/shared/lib/hooks';

interface Props {
  onOpenMore: () => void;
  onCreateRecord: () => void;
  /** Меню «Ещё» открыто: вкладка подсвечена, пока шторка на экране. */
  moreOpen: boolean;
}

export const MOBILE_TAB_BAR_HEIGHT = 72;

/**
 * Нижняя панель телефона: Библиотека · Лента · «+» · Аналитика · Ещё.
 *
 * До этого все разделы прятались под гамбургером в правом верхнем углу — самой дальней точке
 * экрана от большого пальца. Высота слота 72 px, у каждой цели зона нажатия не меньше 44 px.
 */
export const MobileTabBar: React.FC<Props> = ({ onOpenMore, onCreateRecord, moreOpen }) => {
  const { token } = theme.useToken();
  const location = useLocation();
  const role = useAppSelector((state) => state.auth.user?.role);
  const currentKey = findSection(location.pathname, isAdminLike(role))?.key;

  const slot: React.CSSProperties = {
    flex: 1,
    height: MOBILE_TAB_BAR_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const tab = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    minWidth: 44,
    color: active ? token.colorPrimary : token.colorTextTertiary,
    fontSize: 11,
    fontWeight: active ? 600 : 400
  });

  const item = (key: string, path: string, label: string, icon: React.ReactNode) => {
    const active = !moreOpen && key === currentKey;
    return (
      <Link
        key={key}
        to={path}
        className="app-shell-reset"
        style={slot}
        aria-current={active ? 'page' : undefined}
      >
        <span style={tab(active)}>
          <span style={{ fontSize: 21, lineHeight: 1 }}>{icon}</span>
          {label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Разделы"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        height: MOBILE_TAB_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        // Панель вписана в безопасную зону: на телефонах с жестовой полосой нижний ряд
        // иначе оказывается под ней.
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: token.colorBgContainer,
        borderTop: `1px solid ${token.colorBorderSecondary}`
      }}
    >
      {item('books', '/', 'Библиотека', <UnorderedListOutlined />)}
      {item('feed', '/feed', 'Лента', <ReadOutlined />)}

      <div style={slot}>
        {canEditBooks(role) && (
          <button
            type="button"
            className="app-shell-reset"
            onClick={onCreateRecord}
            aria-label="Добавить запись"
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: token.colorPrimary,
              color: token.colorTextLightSolid,
              fontSize: 22
            }}
          >
            <PlusOutlined />
          </button>
        )}
      </div>

      {item('analytics', '/analytics', 'Аналитика', <BarChartOutlined />)}

      <button type="button" className="app-shell-reset" style={slot} onClick={onOpenMore}>
        <span style={tab(moreOpen)}>
          <span style={{ fontSize: 21, lineHeight: 1 }}>
            <EllipsisOutlined />
          </span>
          Ещё
        </span>
      </button>
    </nav>
  );
};
