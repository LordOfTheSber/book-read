import React from 'react';
import { Avatar, theme } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { sectionTitle } from '@/shared/config/navigation';
import { APP_NAME } from '@/shared/lib/documentTitle';
import { useAppSelector } from '@/shared/lib/hooks';
import { OfflineQueueChip } from '@/widgets/offline-queue';

interface Props {
  onOpenSearch: () => void;
}

/**
 * Верхняя строка телефона: имя раздела вместо знака и гамбургера.
 *
 * Разделы переехали вниз, под большой палец, поэтому наверху остаётся только то, чего внизу нет:
 * где ты находишься, поиск и свой профиль. Зоны нажатия — 44 px, как требует макет.
 */
export const MobileTopBar: React.FC<Props> = ({ onOpenSearch }) => {
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const avatarSrc =
    user?.avatar && user.avatarContentType
      ? `data:${user.avatarContentType};base64,${user.avatar}`
      : undefined;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 8px 0 16px',
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: -0.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {sectionTitle(location.pathname) ?? APP_NAME}
      </span>

      <OfflineQueueChip />

      <button
        type="button"
        className="app-shell-reset"
        onClick={onOpenSearch}
        aria-label="Поиск по библиотеке"
        style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <SearchOutlined style={{ fontSize: 19, color: token.colorTextSecondary }} />
      </button>

      <button
        type="button"
        className="app-shell-reset"
        onClick={() => navigate('/profile')}
        aria-label="Профиль"
        style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Avatar size={28} src={avatarSrc} icon={<UserOutlined />} />
      </button>
    </div>
  );
};
