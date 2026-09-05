import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { isAdminLike, isSuperAdmin } from '@/shared/lib/roles';
import { useRequestError } from '@/shared/lib/errors';
import { loadNodes, nodeDiskPercent, nodeHeartbeat } from '@/entities/node';
import { loadUsers } from '@/entities/user';
import { listExports } from '@/entities/export/api/exportApi';
import { fetchSessionSettings } from '@/entities/session-settings/api/sessionSettingsApi';
import { ExportFileInfo, SessionSettings } from '@/shared/types/library';
import { formatBytes } from '@/shared/lib/format';
import { formatRelative } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/plural';
import { OverviewTab } from './OverviewTab';
import { UsersTab } from './UsersTab';
import { SessionsTab } from './SessionsTab';
import { BackupsTab } from './BackupsTab';
import { useAdminStyles } from './AdminPage.styles';

const POLL_INTERVAL_MS = 10_000;

type AdminTab = 'overview' | 'users' | 'sessions' | 'backups';

interface HealthTile {
  label: string;
  value: string;
  hint: string;
  tone: 'ok' | 'warn' | 'danger';
}

/**
 * Администрирование одной страницей по макету `Admin`.
 *
 * До этого в шапке стояло два пункта — «Пользователи» с тремя вкладками и «Узлы», — то есть два
 * места из одиннадцати уходили на раздел, который открывают единицы. Здесь всё собрано под один
 * пункт, а сверху — четыре показателя состояния: понять, всё ли в порядке, можно не открывая
 * вкладок вовсе.
 */
export const AdminPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useAdminStyles();
  const showRequestError = useRequestError();
  const [params, setParams] = useSearchParams();

  const currentUser = useAppSelector((state) => state.auth.user);
  const isSuper = isSuperAdmin(currentUser?.role);
  const isAdmin = isAdminLike(currentUser?.role);
  const users = useAppSelector((state) => state.users.list);
  const nodes = useAppSelector((state) => state.nodes.list);

  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [backups, setBackups] = useState<ExportFileInfo[]>([]);

  const requested = params.get('tab');
  // Копии видит только супер-администратор: адрес с чужой вкладкой открывает обзор, а не пустоту.
  const tab: AdminTab =
    requested === 'users' || requested === 'sessions' || (requested === 'backups' && isSuper)
      ? requested
      : 'overview';

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      setSessionSettings(await fetchSessionSettings());
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить настройки сессий');
    } finally {
      setSettingsLoading(false);
    }
  }, [showRequestError]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadSettings();
    dispatch(loadUsers({ force: true }));
  }, [dispatch, isAdmin, loadSettings]);

  useEffect(() => {
    dispatch(loadNodes());
    const intervalId = window.setInterval(() => dispatch(loadNodes()), POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [dispatch]);

  useEffect(() => {
    // Список копий нужен показателю «последняя копия» на любой вкладке, поэтому живёт здесь;
    // вкладка копий ведёт свой список сама — она его ещё и меняет.
    if (!isSuper) return;
    void listExports()
      .then(setBackups)
      // Отсутствие копий — не повод показывать ошибку поверх всей страницы: показатель просто
      // скажет, что копий нет.
      .catch(() => setBackups([]));
  }, [isSuper]);

  const health = useMemo<HealthTile[]>(() => {
    const alive = nodes.filter((node) => nodeHeartbeat(node.lastReportedAt).state === 'online').length;
    const silent = nodes.find((node) => nodeHeartbeat(node.lastReportedAt).state !== 'online');
    const blocked = users.filter((user) => user.blocked).length;
    const last = [...backups].sort((a, b) => a.lastModifiedAt.localeCompare(b.lastModifiedAt)).at(-1);
    const fullest = [...nodes].sort((a, b) => (nodeDiskPercent(b) ?? 0) - (nodeDiskPercent(a) ?? 0))[0];
    const diskPercent = nodeDiskPercent(fullest);

    return [
      {
        label: 'Узлы',
        value: nodes.length === 0 ? 'нет' : `${alive} из ${nodes.length}`,
        hint: silent ? `${silent.nodeKey} молчит` : 'все на связи',
        tone: nodes.length === 0 ? 'warn' : alive === nodes.length ? 'ok' : 'danger'
      },
      {
        label: 'Пользователи',
        value: String(users.length),
        hint: blocked ? `${pluralize(blocked, ['заблокирован', 'заблокированы', 'заблокированы'])}` : 'блокировок нет',
        tone: blocked ? 'warn' : 'ok'
      },
      {
        label: 'Последняя копия',
        value: last ? formatRelative(last.lastModifiedAt) : 'нет',
        hint: last ? `${formatBytes(last.sizeBytes)} · ночная копия в 02:00` : 'копий не снимали ни разу',
        tone: last ? 'ok' : 'danger'
      },
      {
        label: 'Место на диске',
        value: diskPercent === undefined ? '—' : `${Math.round(diskPercent)}%`,
        hint: fullest
          ? `${formatBytes(fullest.diskFree)} свободно на ${fullest.nodeKey}`
          : 'узлы не отчитывались',
        tone: diskPercent === undefined ? 'warn' : diskPercent > 90 ? 'danger' : diskPercent > 75 ? 'warn' : 'ok'
      }
    ];
  }, [nodes, users, backups]);

  const items = [
    {
      key: 'overview',
      label: 'Обзор',
      children: (
        <OverviewTab
          nodes={nodes}
          backups={backups}
          onOpenBackups={() => setParams({ tab: isSuper ? 'backups' : 'overview' })}
        />
      )
    },
    {
      key: 'users',
      label: `Пользователи · ${users.length}`,
      children: <UsersTab sessionSettings={sessionSettings} />
    },
    ...(isAdmin
      ? [
          {
            key: 'sessions',
            label: 'Сессии',
            children: (
              <SessionsTab
                settings={sessionSettings}
                loading={settingsLoading}
                onSaved={setSessionSettings}
              />
            )
          }
        ]
      : []),
    ...(isSuper
      ? [
          {
            key: 'backups',
            label: `Копии · ${backups.length}`,
            children: <BackupsTab />
          }
        ]
      : [])
  ];

  return (
    <div>
      <PageHeader
        title="Администрирование"
        subtitle="Пользователи, сессии, резервные копии и узлы — в одном разделе"
      />

      <div style={styles.health}>
        {health.map((tile) => (
          // Плитка объявляется группой со своим именем: иначе диктор читает подряд четыре
          // числа без подписей, а «68%» встречается ещё и в метриках узла.
          <div key={tile.label} style={styles.healthTile} role="group" aria-label={tile.label}>
            <span style={styles.dot(styles.accents[tile.tone])} />
            <span style={{ minWidth: 0 }}>
              <Typography.Text type="secondary" style={styles.healthLabel}>
                {tile.label}
              </Typography.Text>
              <Typography.Text style={styles.healthValue}>{tile.value}</Typography.Text>
              <Typography.Text type="secondary" style={styles.healthHint}>
                {tile.hint}
              </Typography.Text>
            </span>
          </div>
        ))}
      </div>

      <Tabs activeKey={tab} items={items} onChange={(key) => setParams({ tab: key })} />
    </div>
  );
};