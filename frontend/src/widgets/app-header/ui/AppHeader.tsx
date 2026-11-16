import React, { useMemo, useState } from 'react';
import { Avatar, Button, Dropdown, Typography } from 'antd';
import { DownOutlined, PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { primaryNav, visibleGroups, findSection } from '@/shared/config/navigation';
import { useNavGroupColors } from '@/shared/lib/navColors';
import { getRoleLabel } from '@/shared/constants/roles';
import { APP_NAME } from '@/shared/lib/documentTitle';
import { isAdminLike, canEditBooks } from '@/shared/lib/roles';
import { Logo } from '@/shared/ui/Logo';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { logoutThunk } from '@/entities/auth';
import { useYearGoalProgress } from '@/entities/engagement';
import { themeOptions, useThemeMode } from '@/app/providers/ThemeProvider';
import { OfflineQueueChip } from '@/widgets/offline-queue';
import { useAppHeaderStyles } from './AppHeader.styles';

interface Props {
  /** Поиск живёт в оболочке: его открывают и с ⌘K, и кнопкой в шапке. */
  onOpenSearch: () => void;
  onCreateRecord: () => void;
}

/**
 * Шапка по варианту А из макетов: три вкладки ежедневного круга, «Ещё» с подписями групп,
 * поиск по всей библиотеке посередине и одно действие справа.
 *
 * Раньше здесь стояли одиннадцать равноправных пунктов, поиска не было вовсе (он жил внутри
 * страницы «Библиотека» и не искал ни авторов, ни выписок), а кнопка «Добавить запись»
 * существовала только на самой библиотеке — из аналитики за ней приходилось возвращаться.
 */
export const AppHeader: React.FC<Props> = ({ onOpenSearch, onCreateRecord }) => {
  const styles = useAppHeaderStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { mode, setMode } = useThemeMode();
  const groupColors = useNavGroupColors();
  // Живой знак: закладка в логотипе растёт вместе с целью года.
  const goalProgress = useYearGoalProgress(Boolean(user));
  /**
   * Открытость меню держим сами: содержимое у них своё, а не список Ant Design, и без этого
   * меню оставалось висеть на экране после перехода по ссылке внутри него.
   */
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isAdmin = isAdminLike(user?.role);
  const groups = useMemo(() => visibleGroups(isAdmin), [isAdmin]);
  const current = findSection(location.pathname, isAdmin);
  const currentKey = current?.key;
  const inMoreMenu = groups.some((group) => group.items.some((item) => item.key === currentKey));

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/login');
  };

  const avatarSrc =
    user?.avatar && user.avatarContentType
      ? `data:${user.avatarContentType};base64,${user.avatar}`
      : undefined;

  const moreMenu = (
    <div style={styles.moreCard} role="menu" aria-label="Остальные разделы">
      {groups.map((group) => (
        <React.Fragment key={group.key}>
          <div style={styles.groupHeading}>{group.label}</div>
          {group.items.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              role="menuitem"
              className="app-shell-reset app-shell-hover"
              onClick={() => setMoreOpen(false)}
              style={{
                ...styles.menuRow,
                ...(item.key === currentKey ? { fontWeight: 600 } : null)
              }}
            >
              <span style={styles.dot(groupColors[group.key])} />
              {item.label}
            </Link>
          ))}
        </React.Fragment>
      ))}
    </div>
  );

  const profileMenu = (
    <div style={styles.menuCard}>
      <div style={styles.menuHead}>
        <Avatar size={36} src={avatarSrc} icon={<UserOutlined />} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{user?.username}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {getRoleLabel(user?.role)}
          </Typography.Text>
        </div>
      </div>

      <div style={styles.menuSection}>
        <Link
          to="/profile"
          className="app-shell-reset app-shell-hover"
          onClick={() => setProfileOpen(false)}
          style={styles.menuRow}
        >
          Профиль
        </Link>
        {user && (
          <Link
            to={`/u/${user.username}`}
            className="app-shell-reset app-shell-hover"
            onClick={() => setProfileOpen(false)}
            style={styles.menuRow}
          >
            Моя страница
          </Link>
        )}
      </div>

      {/* Тему выбирают один раз, а кнопка держала постоянное место в шапке наравне с действием. */}
      <div style={styles.themeBlock}>
        <div style={styles.themeLabel}>Тема</div>
        <div style={styles.themeRow}>
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="app-shell-reset app-shell-hover"
              onClick={() => setMode(option.value)}
              aria-pressed={mode === option.value}
              style={styles.themeChip(mode === option.value)}
            >
              <span style={{ ...styles.swatch, background: option.swatch }} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.menuFoot}>
        <button
          type="button"
          className="app-shell-reset app-shell-hover"
          onClick={handleLogout}
          style={{ ...styles.menuRow, color: styles.dangerColor }}
        >
          Выйти
        </button>
      </div>
    </div>
  );

  return (
    <div style={styles.header}>
      <div style={styles.inner}>
        <Link to="/" style={styles.brand}>
          <Logo
            size={30}
            goalProgress={goalProgress}
            // Ночью корешок становится бумажным: чернильный знак на чернильной шапке пропадает.
            inverted={mode === 'dark'}
            title={
              goalProgress === undefined
                ? APP_NAME
                : `${APP_NAME} — цель года выполнена на ${Math.round(goalProgress * 100)}%`
            }
          />
          <span style={styles.brandTitle}>{APP_NAME}</span>
        </Link>

        <nav style={styles.tabs} aria-label="Основные разделы">
          {primaryNav.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              className="app-shell-reset app-shell-hover"
              style={styles.tab(item.key === currentKey)}
              aria-current={item.key === currentKey ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Dropdown
            popupRender={() => moreMenu}
            trigger={['click']}
            placement="bottomLeft"
            open={moreOpen}
            onOpenChange={setMoreOpen}
          >
            <button
              type="button"
              className="app-shell-reset app-shell-hover"
              style={styles.tab(inMoreMenu)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              Ещё
              <DownOutlined style={{ fontSize: 10 }} />
            </button>
          </Dropdown>
        </nav>

        <div style={styles.searchSlot}>
          <button
            type="button"
            className="app-shell-reset app-shell-search"
            onClick={onOpenSearch}
            style={styles.searchButton}
          >
            <SearchOutlined />
            <span style={styles.searchLabel}>Поиск по книгам, авторам, выпискам</span>
            <span style={styles.hotkey}>⌘K</span>
          </button>
        </div>

        <div style={styles.actions}>
          <OfflineQueueChip />
          {canEditBooks(user?.role) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreateRecord} aria-label="Добавить запись">
              Добавить
            </Button>
          )}
          {user ? (
            <Dropdown
              popupRender={() => profileMenu}
              trigger={['click']}
              placement="bottomRight"
              open={profileOpen}
              onOpenChange={setProfileOpen}
            >
              <button
                type="button"
                className="app-shell-reset app-shell-hover"
                style={styles.userButton}
                aria-label="Меню профиля"
                aria-expanded={profileOpen}
              >
                <Avatar size={26} src={avatarSrc} icon={<UserOutlined />} />
                <DownOutlined style={{ fontSize: 10 }} />
              </button>
            </Dropdown>
          ) : (
            <Button type="primary" onClick={() => navigate('/login')}>
              Войти
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
