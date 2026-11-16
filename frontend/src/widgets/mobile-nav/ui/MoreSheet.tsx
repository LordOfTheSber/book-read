import React, { useMemo } from 'react';
import { Drawer, theme } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { visibleGroups } from '@/shared/config/navigation';
import { useNavGroupColors } from '@/shared/lib/navColors';
import { isAdminLike } from '@/shared/lib/roles';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { logoutThunk } from '@/entities/auth';
import { themeOptions, useThemeMode } from '@/app/providers/ThemeProvider';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * «Ещё» на телефоне: те же группы, что в шапке, списком в полный экран.
 *
 * Строки высотой 48 px и с одной целью на строку — попасть пальцем в пункт вложенного
 * inline-меню, каким это было раньше, получалось не с первого раза.
 */
export const MoreSheet: React.FC<Props> = ({ open, onClose }) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { mode, setMode } = useThemeMode();
  const groupColors = useNavGroupColors();
  const groups = useMemo(() => visibleGroups(isAdminLike(user?.role)), [user?.role]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const heading: React.CSSProperties = {
    padding: '14px 12px 6px',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary
  };

  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    minHeight: 48,
    padding: '0 12px',
    borderRadius: 10,
    textAlign: 'left'
  };

  return (
    <Drawer
      title="Ещё"
      placement="right"
      width="100%"
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 8, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Список прокручивается сам, чтобы выбор темы оставался внизу экрана, а не уезжал за край. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {groups.map((group) => (
          <div key={group.key}>
            <div style={heading}>{group.label}</div>
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className="app-shell-reset app-shell-hover"
                style={row}
                onClick={() => go(item.path)}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: groupColors[group.key]
                  }}
                />
                <span style={{ flex: 1 }}>{item.label}</span>
                <RightOutlined style={{ fontSize: 13, color: token.colorTextQuaternary }} />
              </button>
            ))}
          </div>
        ))}

        <div style={heading}>Профиль</div>
        <button type="button" className="app-shell-reset app-shell-hover" style={row} onClick={() => go('/profile')}>
          <span style={{ flex: 1 }}>Профиль и настройки</span>
          <RightOutlined style={{ fontSize: 13, color: token.colorTextQuaternary }} />
        </button>
        {user && (
          <button
            type="button"
            className="app-shell-reset app-shell-hover"
            style={row}
            onClick={() => go(`/u/${user.username}`)}
          >
            <span style={{ flex: 1 }}>Моя страница</span>
            <RightOutlined style={{ fontSize: 13, color: token.colorTextQuaternary }} />
          </button>
        )}
        <button
          type="button"
          className="app-shell-reset app-shell-hover"
          style={{ ...row, color: token.colorError }}
          onClick={async () => {
            onClose();
            await dispatch(logoutThunk());
            navigate('/login');
          }}
        >
          Выйти
        </button>
      </div>

      <div style={{ padding: '12px 4px 8px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 9 }}>Тема</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="app-shell-reset app-shell-hover"
              onClick={() => setMode(option.value)}
              aria-pressed={mode === option.value}
              style={{
                flex: 1,
                height: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                borderRadius: 12,
                fontSize: 13,
                border: `1px solid ${mode === option.value ? token.colorPrimary : token.colorBorderSecondary}`,
                color: mode === option.value ? token.colorPrimary : token.colorTextSecondary
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: `1px solid ${token.colorBorder}`,
                  background: option.swatch
                }}
              />
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  );
};
