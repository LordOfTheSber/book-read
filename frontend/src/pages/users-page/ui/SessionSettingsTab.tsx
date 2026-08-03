import React, { useEffect, useState } from 'react';
import { App, Button, Card, Col, Form, InputNumber, Row, Skeleton, Typography } from 'antd';
import { SessionSettings } from '@/shared/types/library';
import { updateSessionSettings } from '@/entities/session-settings/api/sessionSettingsApi';
import { useRequestError } from '@/shared/lib/errors';
import { useUsersPageStyles } from './UsersPage.styles';

interface Props {
  settings: SessionSettings | null;
  loading: boolean;
  onSaved: (settings: SessionSettings) => void;
}

const formatDuration = (minutes?: number) => {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} д ${restHours} ч` : `${days} д`;
};

export const SessionSettingsTab: React.FC<Props> = ({ settings, loading, onSaved }) => {
  const styles = useUsersPageStyles();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [form] = Form.useForm<SessionSettings>();
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Partial<SessionSettings>>({});

  useEffect(() => {
    if (settings) {
      form.setFieldsValue(settings);
      setPreview(settings);
    }
  }, [settings, form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const updated = await updateSessionSettings(values);
      onSaved(updated);
      message.success('Настройки сессий обновлены');
    } catch (error) {
      showRequestError(error, 'Не удалось обновить настройки сессий');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card title="Общие настройки сессий" style={styles.card} styles={{ body: styles.cardBody }}>
          {loading && !settings ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : (
            <Form
              layout="vertical"
              form={form}
              onValuesChange={(_, values) => setPreview(values)}
              requiredMark={false}
            >
              <Form.Item
                label="Время жизни сессии, мин"
                name="sessionTtlMinutes"
                tooltip="Через сколько минут бездействия пользователя разлогинит"
                rules={[
                  { required: true, message: 'Укажите время жизни сессии' },
                  { min: 1, type: 'number', message: 'Значение должно быть больше 0' }
                ]}
                extra={formatDuration(preview.sessionTtlMinutes)}
              >
                <InputNumber min={1} style={styles.fullWidth} />
              </Form.Item>
              <Form.Item
                label="Максимальный срок жизни сессии, мин"
                name="maxSessionLifetimeMinutes"
                tooltip="Предел, после которого сессия истекает даже при активности"
                rules={[
                  { required: true, message: 'Укажите максимальный срок' },
                  { min: 1, type: 'number', message: 'Значение должно быть больше 0' }
                ]}
                extra={formatDuration(preview.maxSessionLifetimeMinutes)}
              >
                <InputNumber min={1} style={styles.fullWidth} />
              </Form.Item>
              <Button type="primary" onClick={handleSave} loading={saving}>
                Сохранить
              </Button>
            </Form>
          )}
        </Card>
      </Col>

      <Col xs={24} lg={10}>
        <Card title="Как это работает" style={styles.card} styles={{ body: styles.cardBody }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Настройки применяются ко всем пользователям, у которых нет персональных значений.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            <b>Время жизни</b> отсчитывается от последнего запроса: пока пользователь работает, сессия
            продлевается.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            <b>Максимальный срок</b> ограничивает продление сверху — после него нужен повторный вход.
            Персональные значения задаются на вкладке «Пользователи».
          </Typography.Paragraph>
        </Card>
      </Col>
    </Row>
  );
};
