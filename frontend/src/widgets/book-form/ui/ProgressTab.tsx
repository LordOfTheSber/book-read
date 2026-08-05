import React, { useCallback, useEffect, useState } from 'react';
import { App, Alert, Button, DatePicker, Empty, Form, InputNumber, List, Progress, Space, Tag, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { LibraryItem, ReadingLog, ReadingSession } from '@/shared/types/library';
import { addSession, deleteSession, fetchLogs, fetchSessions } from '@/entities/book';
import { progressUnitLabel } from '@/shared/constants/format';
import { ratingCriteria } from '@/shared/constants/ratingCriteria';
import { formatDate } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';

interface Props {
  item: LibraryItem;
  /** Прогресс меняется вне карточки, поэтому список книг нужно перечитать. */
  onProgressChanged: () => void;
}

interface SessionFormValues {
  sessionDate?: dayjs.Dayjs;
  fromPosition?: number;
  toPosition?: number;
  durationMinutes?: number;
}

/** Заходы, прогресс и история перечитываний одного произведения. */
export const ProgressTab: React.FC<Props> = ({ item, onProgressChanged }) => {
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [form] = Form.useForm<SessionFormValues>();
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const progress = item.progress;
  const unit = progress?.unit ? progressUnitLabel[progress.unit] : '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedSessions, loadedLogs] = await Promise.all([fetchSessions(item.id), fetchLogs(item.id)]);
      setSessions(loadedSessions);
      setLogs(loadedLogs);
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить историю чтения');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    load();
  }, [load]);

  const submitSession = async (values: SessionFormValues) => {
    setSaving(true);
    try {
      await addSession(item.id, {
        sessionDate: values.sessionDate?.format('YYYY-MM-DD'),
        fromPosition: values.fromPosition,
        toPosition: values.toPosition,
        durationMinutes: values.durationMinutes
      });
      form.resetFields();
      message.success('Заход записан');
      await load();
      onProgressChanged();
    } catch (error) {
      showRequestError(error, 'Не удалось записать заход');
    } finally {
      setSaving(false);
    }
  };

  /** Быстрое «+N»: заход от текущей позиции, без открытия формы. */
  const quickAdvance = async (delta: number) => {
    const current = progress?.current ?? 0;
    await submitSession({ fromPosition: current, toPosition: current + delta });
  };

  const removeSession = async (sessionId: string) => {
    try {
      await deleteSession(item.id, sessionId);
      await load();
      onProgressChanged();
    } catch (error) {
      showRequestError(error, 'Не удалось удалить заход');
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {progress?.percent !== undefined && progress.percent !== null ? (
        <div>
          <Progress percent={progress.percent} status={progress.behindSchedule ? 'exception' : 'active'} />
          <Typography.Text type="secondary">
            {progress.current ?? 0} из {progress.total} {unit}
            {progress.remaining ? `, осталось ${progress.remaining}` : ''}
          </Typography.Text>
        </div>
      ) : (
        <Typography.Text type="secondary">
          Укажите объём в карточке — тогда появится полоса прогресса.
        </Typography.Text>
      )}

      {progress?.dailyNorm !== undefined && progress.dailyNorm !== null && (
        <Alert
          type={progress.behindSchedule ? 'warning' : 'info'}
          showIcon
          message={
            progress.behindSchedule
              ? `Отставание от графика: нужно ${progress.dailyNorm} ${unit} в день`
              : `Чтобы успеть к сроку: ${progress.dailyNorm} ${unit} в день`
          }
          description={
            progress.daysLeft !== undefined && progress.daysLeft !== null
              ? progress.daysLeft >= 0
                ? `Остался ${pluralize(progress.daysLeft, ['день', 'дня', 'дней'])}`
                : 'Срок уже прошёл'
              : undefined
          }
        />
      )}

      <Space wrap>
        <Button size="small" onClick={() => quickAdvance(10)} loading={saving}>
          +10 {unit}
        </Button>
        <Button size="small" onClick={() => quickAdvance(50)} loading={saving}>
          +50 {unit}
        </Button>
      </Space>

      <Form form={form} layout="inline" onFinish={submitSession} style={{ rowGap: 8 }}>
        <Form.Item name="sessionDate" label="Дата">
          <DatePicker placeholder="сегодня" style={{ width: 140 }} />
        </Form.Item>
        <Form.Item name="fromPosition" label="с">
          <InputNumber min={0} style={{ width: 90 }} />
        </Form.Item>
        <Form.Item name="toPosition" label="по">
          <InputNumber min={0} style={{ width: 90 }} />
        </Form.Item>
        <Form.Item name="durationMinutes" label="мин.">
          <InputNumber min={1} style={{ width: 90 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            Записать
          </Button>
        </Form.Item>
      </Form>

      <div>
        <Typography.Text strong>История заходов</Typography.Text>
        <List
          loading={loading}
          size="small"
          dataSource={sessions}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Заходов пока нет" /> }}
          renderItem={(session) => (
            <List.Item
              actions={[
                <Button
                  key="delete"
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeSession(session.id)}
                  aria-label="Удалить заход"
                />
              ]}
            >
              <Space wrap>
                <Typography.Text>{formatDate(session.sessionDate)}</Typography.Text>
                {session.toPosition !== undefined && session.toPosition !== null && (
                  <Typography.Text type="secondary">
                    {session.fromPosition ?? 0}–{session.toPosition} {unit}
                  </Typography.Text>
                )}
                {session.durationMinutes && (
                  <Typography.Text type="secondary">{session.durationMinutes} мин.</Typography.Text>
                )}
              </Space>
            </List.Item>
          )}
        />
      </div>

      {/* Перечитывания: со второго прохода эта история и становится интересной. */}
      {logs.length > 0 && (
        <div>
          <Typography.Text strong>Проходы</Typography.Text>
          <List
            size="small"
            dataSource={logs}
            renderItem={(log) => (
              <List.Item>
                <Space wrap>
                  <Tag color={log.finishedAt ? 'success' : 'processing'}>Проход {log.attempt}</Tag>
                  <Typography.Text type="secondary">
                    {formatDate(log.startedAt)}
                    {log.finishedAt ? ` — ${formatDate(log.finishedAt)}` : ' — идёт'}
                  </Typography.Text>
                  {log.durationDays !== undefined && log.durationDays !== null && (
                    <Typography.Text type="secondary">
                      {pluralize(log.durationDays, ['день', 'дня', 'дней'])}
                    </Typography.Text>
                  )}
                  {log.rating !== undefined && log.rating !== null && (
                    <Typography.Text type="secondary">оценка {log.rating}</Typography.Text>
                  )}
                  {/* История оценок: при перечитывании они обычно расходятся. */}
                  {ratingCriteria
                    .filter((criterion) => log[criterion.key] !== undefined && log[criterion.key] !== null)
                    .map((criterion) => (
                      <Typography.Text type="secondary" key={criterion.key}>
                        {criterion.label.toLowerCase()} {log[criterion.key]}
                      </Typography.Text>
                    ))}
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}
    </Space>
  );
};
