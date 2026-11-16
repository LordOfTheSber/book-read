import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Space, Switch, Typography } from 'antd';
import {
  fetchMonitoringMetrics,
  updateMonitoringMetricsEnabled,
  updateMonitoringSettings
} from '@/entities/monitoring/api/monitoringApi';
import { UserRole } from '@/shared/types/library';
import { isAdminLike, isSuperAdmin } from '@/shared/lib/roles';
import { getErrorMessage, isFormValidationError } from '@/shared/lib/errors';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

interface Props {
  role?: UserRole;
  /** Метрики перечитываются вместе с настройками: переключатель сбора управляет и пингом. */
  onChanged?: () => void;
}

interface PingSettingsValues {
  pingIntervalSeconds: number;
  pingPath: string;
}

/**
 * Проверка доступности узлов.
 *
 * Настройки лежали внутри вкладки «Запросы» одного узла, хотя относятся ко всем сразу: человек,
 * менявший интервал пинга, не мог знать, что меняет его всей сети. Теперь они стоят отдельной
 * карточкой рядом с узлом и прямо об этом говорят.
 */
export const PingCard: React.FC<Props> = ({ role, onChanged }) => {
  const styles = useNodeDetailPageStyles();
  const [form] = Form.useForm<PingSettingsValues>();
  const canToggle = isAdminLike(role);
  const canEdit = isSuperAdmin(role);

  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchMonitoringMetrics();
      setEnabled(data.enabled);
      setError(null);
      if (data.settings) {
        form.setFieldsValue({
          pingIntervalSeconds: data.settings.pingIntervalSeconds,
          pingPath: data.settings.pingPath
        });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось загрузить настройки проверки'));
    }
  }, [form]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (value: boolean) => {
    setToggling(true);
    try {
      await updateMonitoringMetricsEnabled(value);
      await load();
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось переключить сбор метрик'));
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await updateMonitoringSettings(values);
      await load();
      onChanged?.();
    } catch (err) {
      // Ошибки валидации формы рисует сама форма — на уровень страницы не выносим.
      if (!isFormValidationError(err)) {
        setError(getErrorMessage(err, 'Не удалось сохранить настройки пинга'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      style={styles.card}
      styles={{ body: styles.cardBody }}
      title="Проверка доступности"
      extra={
        <Space size={8}>
          <Typography.Text type="secondary">{enabled ? 'включена' : 'выключена'}</Typography.Text>
          <Switch
            checked={enabled}
            loading={toggling}
            onChange={handleToggle}
            disabled={!canToggle}
            aria-label="Сбор метрик и пинг"
          />
        </Space>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Настройки общие для всех узлов: пинг ходит по одному и тому же адресу с одним интервалом,
        а пока сбор выключен, задержки и ошибки не записываются.
      </Typography.Paragraph>

      {error && <Alert type="error" showIcon message={error} style={styles.alert} />}

      {canEdit ? (
        <Form form={form} layout="vertical" disabled={!enabled}>
          <Form.Item
            label="Интервал, сек"
            name="pingIntervalSeconds"
            rules={[{ required: true, message: 'Укажите интервал' }]}
          >
            <InputNumber min={5} max={3600} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Путь" name="pingPath" rules={[{ required: true, message: 'Укажите путь' }]}>
            <Input placeholder="/api/v1/monitoring/ping" />
          </Form.Item>
          <Button type="primary" onClick={handleSave} loading={saving} disabled={!enabled}>
            Сохранить
          </Button>
        </Form>
      ) : (
        <Typography.Text type="secondary">
          Интервал и путь проверки меняет только суперадминистратор.
        </Typography.Text>
      )}
    </Card>
  );
};
