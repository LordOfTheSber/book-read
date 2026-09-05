import React, { useEffect, useState } from 'react';
import {
  App,
  Avatar,
  Button,
  Empty,
  InputNumber,
  Modal,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import { EditOutlined, UserOutlined } from '@ant-design/icons';
import { SessionSettings, User } from '@/shared/types/library';
import { updateSessionSettings } from '@/entities/session-settings/api/sessionSettingsApi';
import { clearUserSessionSettings, loadUsers, updateUserSessionSettings } from '@/entities/user';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { useRequestError } from '@/shared/lib/errors';
import { getRoleLabel } from '@/shared/constants/roles';
import { pluralize } from '@/shared/lib/plural';
import { useAdminStyles } from './AdminPage.styles';

interface Props {
  settings: SessionSettings | null;
  loading: boolean;
  onSaved: (settings: SessionSettings) => void;
}

/** Минуты человеку ничего не говорят: 43 200 — это «30 дней», и так их и надо показывать. */
export const humanDuration = (minutes?: number | null) => {
  if (!minutes) return '—';
  if (minutes < 60) return pluralize(minutes, ['минута', 'минуты', 'минут']);
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    const base = pluralize(hours, ['час', 'часа', 'часов']);
    return restMinutes ? `${base} ${restMinutes} мин` : base;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  const base = pluralize(days, ['день', 'дня', 'дней']);
  return restHours ? `${base} ${restHours} ч` : base;
};

const TTL_PRESETS = [30, 120, 480];
const LIFETIME_PRESETS = [10_080, 43_200, 129_600];

const hasOverride = (user: User) =>
  Boolean(user.sessionTtlOverrideMinutes || user.maxSessionLifetimeOverrideMinutes);

/**
 * Сессии по макету `AdminSessions`.
 *
 * До этого «Сессии» были формой из двух чисел с подписями «Время жизни сессии, мин» и
 * «Максимальный срок жизни сессии, мин»: понять по ним, когда человека выкинет из приложения,
 * нельзя. Здесь у каждого числа стоят его последствия словами и три готовых значения, а рядом —
 * список тех, у кого не как у всех: раньше персональные сроки были видны только в чужой карточке.
 */
export const SessionsTab: React.FC<Props> = ({ settings, loading, onSaved }) => {
  const dispatch = useAppDispatch();
  const styles = useAdminStyles();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const users = useAppSelector((state) => state.users.list);

  const [ttl, setTtl] = useState<number | null>(null);
  const [lifetime, setLifetime] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [personalTtl, setPersonalTtl] = useState<number | null>(null);
  const [personalLifetime, setPersonalLifetime] = useState<number | null>(null);
  const [personalSaving, setPersonalSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setTtl(settings.sessionTtlMinutes);
      setLifetime(settings.maxSessionLifetimeMinutes);
    }
  }, [settings]);

  const overrides = users.filter(hasOverride);

  const saveGlobal = async () => {
    if (!ttl || !lifetime) return;
    setSaving(true);
    try {
      const updated = await updateSessionSettings({
        sessionTtlMinutes: ttl,
        maxSessionLifetimeMinutes: lifetime
      });
      onSaved(updated);
      message.success('Общее правило сохранено');
    } catch (error) {
      showRequestError(error, 'Не удалось обновить настройки сессий');
    } finally {
      setSaving(false);
    }
  };

  const openPersonal = (user: User) => {
    setEditing(user);
    setPersonalTtl(user.sessionTtlOverrideMinutes ?? null);
    setPersonalLifetime(user.maxSessionLifetimeOverrideMinutes ?? null);
  };

  const savePersonal = async () => {
    if (!editing) return;
    setPersonalSaving(true);
    try {
      // Пустое поле означает «как у всех»: отдельной кнопки сброса не нужно, но когда пусты оба,
      // персональные настройки снимаются целиком, а не сохраняются двумя null.
      if (personalTtl === null && personalLifetime === null) {
        await clearUserSessionSettings(editing.id);
      } else {
        await updateUserSessionSettings(editing.id, {
          sessionTtlMinutes: personalTtl,
          maxSessionLifetimeMinutes: personalLifetime
        });
      }
      message.success('Настройки пользователя сохранены');
      setEditing(null);
      dispatch(loadUsers({ force: true }));
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить настройки пользователя');
    } finally {
      setPersonalSaving(false);
    }
  };

  const renderField = (
    label: string,
    value: number | null,
    onChange: (next: number | null) => void,
    presets: number[],
    hint: string
  ) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
        <Typography.Text type="secondary">{label}</Typography.Text>
        <Typography.Text type="secondary" style={styles.hint}>
          {humanDuration(value)}
        </Typography.Text>
      </div>
      <Space size={8} wrap style={styles.fullWidth}>
        <InputNumber
          min={1}
          value={value}
          onChange={(next) => onChange(next ?? null)}
          aria-label={label}
          style={{ width: 140 }}
        />
        {presets.map((preset) => (
          <Button
            key={preset}
            type={value === preset ? 'primary' : 'default'}
            onClick={() => onChange(preset)}
          >
            {humanDuration(preset)}
          </Button>
        ))}
      </Space>
      <Typography.Text type="secondary" style={{ ...styles.hint, display: 'block', marginTop: 8 }}>
        {hint}
      </Typography.Text>
    </div>
  );

  return (
    <div style={styles.columns}>
      <div>
        <Typography.Text style={styles.groupLabel}>Общее правило</Typography.Text>
        <div style={styles.card}>
          <Typography.Text strong style={{ display: 'block', fontSize: 16 }}>
            Сколько живёт вход
          </Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 18 }}>
            Действует на всех, у кого нет персонального значения.
          </Typography.Text>

          {renderField(
            'Бездействие до выхода',
            ttl,
            setTtl,
            TTL_PRESETS,
            'Отсчёт идёт от последнего запроса: пока человек работает, вход продлевается сам.'
          )}
          {renderField(
            'Предел продления',
            lifetime,
            setLifetime,
            LIFETIME_PRESETS,
            'Потолок для продлений: после него вход спросят заново, даже если приложение не закрывали.'
          )}

          <div style={{ ...styles.note, marginBottom: 18 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
              Что почувствует человек
            </Typography.Text>
            Работает — вход продлевается сам. Отошёл на {humanDuration(ttl)} — придётся войти заново.
            И в любом случае через {humanDuration(lifetime)} вход спросят снова, даже если приложение
            не закрывали.
          </div>

          <Space size={10}>
            <Button
              onClick={() => {
                setTtl(settings?.sessionTtlMinutes ?? null);
                setLifetime(settings?.maxSessionLifetimeMinutes ?? null);
              }}
              disabled={loading || !settings}
            >
              Вернуть как было
            </Button>
            <Button type="primary" loading={saving} disabled={!ttl || !lifetime} onClick={saveGlobal}>
              Сохранить
            </Button>
          </Space>
        </div>
      </div>

      <div>
        <Typography.Text style={styles.groupLabel}>Персональные исключения</Typography.Text>
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <Typography.Text strong style={{ fontSize: 16 }}>
              У кого не как у всех
            </Typography.Text>
            <Typography.Text type="secondary" style={styles.hint}>
              {overrides.length} из {users.length}
            </Typography.Text>
          </div>

          {overrides.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Typography.Text type="secondary">
                  Персональных сроков ни у кого нет — все живут по общему правилу.
                </Typography.Text>
              }
            />
          ) : (
            overrides.map((user, index) => (
              <div key={user.id} style={styles.listRow(index === overrides.length - 1)}>
                <Avatar
                  size={34}
                  icon={<UserOutlined />}
                  src={
                    user.avatar && user.avatarContentType
                      ? `data:${user.avatarContentType};base64,${user.avatar}`
                      : undefined
                  }
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text strong style={{ display: 'block' }}>
                    {user.username}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={styles.hint}>
                    {getRoleLabel(user.role)}
                  </Typography.Text>
                </span>
                <Tag color="blue" bordered={false} style={styles.tag}>
                  {humanDuration(user.sessionTtlOverrideMinutes ?? settings?.sessionTtlMinutes)} ·{' '}
                  {user.sessionTtlOverrideMinutes ? 'своё' : 'как у всех'}
                </Tag>
                <Tooltip title="Изменить">
                  <Button
                    type="text"
                    shape="circle"
                    icon={<EditOutlined />}
                    onClick={() => openPersonal(user)}
                    aria-label={`Настроить сессии: ${user.username}`}
                  />
                </Tooltip>
              </div>
            ))
          )}

          <div style={{ ...styles.note, marginTop: 14 }}>
            Персональный срок ставится в карточке человека на вкладке «Пользователи». Пустое поле
            означает «как у всех» — отдельной кнопки сброса не нужно.
          </div>
        </div>

        <div style={{ ...styles.card, marginTop: 16 }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Чего здесь пока нет
          </Typography.Text>
          <Typography.Text type="secondary">
            Списка живых входов — «Chrome · Windows, последний запрос минуту назад» — в приложении
            не существует: сессия хранит срок и владельца, но не устройство, с которого вошли.
            Пока этого нет на сервере, показывать здесь нечего, и выдумывать список мы не стали.
          </Typography.Text>
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        title={editing ? `Сессии: ${editing.username}` : 'Сессии'}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={personalSaving}
        onOk={savePersonal}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Space direction="vertical" size={16} style={{ ...styles.fullWidth, paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Typography.Text type="secondary">Своё время жизни сессии</Typography.Text>
            <Switch
              checked={personalTtl !== null || personalLifetime !== null}
              onChange={(checked) => {
                if (checked) {
                  setPersonalTtl(settings?.sessionTtlMinutes ?? null);
                  setPersonalLifetime(settings?.maxSessionLifetimeMinutes ?? null);
                } else {
                  setPersonalTtl(null);
                  setPersonalLifetime(null);
                }
              }}
              aria-label="Своё время жизни сессии"
            />
          </div>

          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
              Бездействие до выхода
            </Typography.Text>
            <InputNumber
              min={1}
              value={personalTtl}
              onChange={(value) => setPersonalTtl(value ?? null)}
              placeholder={`как у всех · ${humanDuration(settings?.sessionTtlMinutes)}`}
              aria-label="Бездействие до выхода"
              style={styles.fullWidth}
            />
          </div>

          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
              Предел продления
            </Typography.Text>
            <InputNumber
              min={1}
              value={personalLifetime}
              onChange={(value) => setPersonalLifetime(value ?? null)}
              placeholder={`как у всех · ${humanDuration(settings?.maxSessionLifetimeMinutes)}`}
              aria-label="Предел продления"
              style={styles.fullWidth}
            />
          </div>

          <div style={styles.note}>
            Пустое поле означает «как у всех». Когда пусты оба, персональные сроки снимаются целиком.
          </div>
        </Space>
      </Modal>
    </div>
  );
};