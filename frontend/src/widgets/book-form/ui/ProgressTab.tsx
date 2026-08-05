import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Col,
  DatePicker,
  Empty,
  Form,
  InputNumber,
  List,
  Progress,
  Row,
  Space,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  theme
} from 'antd';
import { CheckCircleOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { LibraryItem, ReadingLog, ReadingSession } from '@/shared/types/library';
import { addSession, deleteSession, fetchLogs, fetchSessions } from '@/entities/book';
import { progressQuickSteps, progressUnitLabel, resolveProgressUnit } from '@/shared/constants/format';
import { ratingCriteria } from '@/shared/constants/ratingCriteria';
import { formatDate } from '@/shared/lib/date';
import { formatScore } from '@/shared/lib/format';
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
  const { token } = theme.useToken();
  const showRequestError = useRequestError();
  const [form] = Form.useForm<SessionFormValues>();
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Какая именно кнопка занята: иначе крутится сразу весь ряд быстрых шагов. */
  const [pendingStep, setPendingStep] = useState<number | null>(null);

  const progress = item.progress;
  // Единица нужна и без заданной шкалы: подписи кнопок и полей не должны быть пустыми.
  const unitKey = resolveProgressUnit(item);
  const unit = progressUnitLabel[unitKey];
  const hasScale = progress?.percent !== undefined && progress.percent !== null;
  const done = hasScale && progress?.percent === 100;

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

  const totals = useMemo(() => {
    const minutes = sessions.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
    const covered = sessions.reduce(
      (sum, session) =>
        session.toPosition !== undefined && session.toPosition !== null
          ? sum + Math.max(0, session.toPosition - (session.fromPosition ?? 0))
          : sum,
      0
    );
    return { minutes, covered };
  }, [sessions]);

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
    // Сервер и так обрежет позицию по объёму, но тогда в истории останется заход за краем шкалы.
    const target = progress?.total ? Math.min(current + delta, progress.total) : current + delta;
    if (target === current) {
      message.info('Шкала уже пройдена до конца');
      return;
    }
    setPendingStep(delta);
    try {
      await submitSession({ fromPosition: current, toPosition: target });
    } finally {
      setPendingStep(null);
    }
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

  const heroPanel: React.CSSProperties = {
    padding: 16,
    borderRadius: token.borderRadiusLG,
    border: `1px solid ${done ? token.colorSuccessBorder : token.colorBorderSecondary}`,
    background: token.colorFillQuaternary
  };

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {hasScale ? (
        <div style={heroPanel}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <Typography.Text style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {progress?.percent}%
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {`${progress?.current ?? 0} из ${progress?.total} ${unit}`}
            </Typography.Text>
          </div>
          <Progress
            percent={progress?.percent}
            showInfo={false}
            // Бесконечная анимация «active» шла даже у дочитанной книги и только отвлекала.
            status={done ? 'success' : progress?.behindSchedule ? 'exception' : 'normal'}
            style={{ marginBottom: 4 }}
          />
          <Space size={12} wrap>
            {progress?.remaining ? (
              <Typography.Text type="secondary">{`осталось ${progress.remaining} ${unit}`}</Typography.Text>
            ) : (
              <Typography.Text type="success">
                <CheckCircleOutlined /> Шкала пройдена
              </Typography.Text>
            )}
            {item.attempt > 1 && <Tag bordered={false}>{`Проход №${item.attempt}`}</Tag>}
          </Space>
        </div>
      ) : (
        <Alert
          type="info"
          showIcon
          message="Укажите объём в карточке — тогда появится полоса прогресса."
          description={`Объём измеряется в единицах «${unit}»: их задаёт вид произведения или поле «Единица прогресса».`}
        />
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

      <div>
        <Typography.Text
          type="secondary"
          style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}
        >
          Быстро отметить
        </Typography.Text>
        <Space wrap style={{ marginTop: 8 }}>
          {/* Шаги зависят от единицы: «+50 эпизодов» — не тот жест, что «+50 страниц». */}
          {progressQuickSteps[unitKey].map((step) => (
            <Button
              key={step}
              onClick={() => quickAdvance(step)}
              loading={pendingStep === step}
              disabled={saving && pendingStep !== step}
            >
              {`+${step} ${unit}`}
            </Button>
          ))}
        </Space>
      </div>

      <Form form={form} layout="vertical" onFinish={submitSession}>
        <Row gutter={[12, 0]} align="bottom">
          <Col xs={12} sm={6}>
            <Form.Item name="sessionDate" label="Дата" style={{ marginBottom: 12 }}>
              <DatePicker placeholder="сегодня" format="DD.MM.YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={5}>
            <Form.Item name="fromPosition" label="С позиции" style={{ marginBottom: 12 }}>
              <InputNumber min={0} style={{ width: '100%' }} suffix={unit} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={5}>
            <Form.Item
              name="toPosition"
              label="По позицию"
              style={{ marginBottom: 12 }}
              dependencies={['fromPosition']}
              rules={[
                ({ getFieldValue }) => ({
                  // Ту же проверку делает сервер; здесь она экономит запрос и объясняет ошибку сразу.
                  validator: (_, value) =>
                    value === undefined || value === null || value >= (getFieldValue('fromPosition') ?? 0)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Конец не может быть раньше начала'))
                })
              ]}
            >
              <InputNumber min={0} style={{ width: '100%' }} suffix={unit} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={4}>
            <Form.Item name="durationMinutes" label="Время" style={{ marginBottom: 12 }} tooltip="Сколько длился заход">
              <InputNumber min={1} style={{ width: '100%' }} suffix="мин." />
            </Form.Item>
          </Col>
          <Col xs={24} sm={4}>
            <Form.Item style={{ marginBottom: 12 }}>
              <Button type="primary" htmlType="submit" loading={saving && pendingStep === null} block>
                Записать
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <Typography.Text strong>История заходов</Typography.Text>
          {sessions.length > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {[
                pluralize(sessions.length, ['заход', 'захода', 'заходов']),
                totals.covered > 0 ? `${totals.covered} ${unit}` : null,
                totals.minutes > 0 ? `${totals.minutes} мин.` : null
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography.Text>
          )}
        </div>
        <List
          loading={loading}
          size="small"
          dataSource={sessions}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Заходов пока нет — отметьте первый кнопкой выше"
              />
            )
          }}
          renderItem={(session) => {
            const covered =
              session.toPosition !== undefined && session.toPosition !== null
                ? Math.max(0, session.toPosition - (session.fromPosition ?? 0))
                : null;
            return (
              <List.Item
                actions={[
                  <Tooltip key="delete" title="Удалить заход">
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeSession(session.id)}
                      aria-label="Удалить заход"
                    />
                  </Tooltip>
                ]}
              >
                <Space wrap size={10}>
                  <Typography.Text style={{ minWidth: 108, display: 'inline-block' }}>
                    {formatDate(session.sessionDate)}
                  </Typography.Text>
                  {covered !== null && (
                    <Tag bordered={false} color="blue" style={{ marginInlineEnd: 0 }}>
                      {`+${covered} ${unit}`}
                    </Tag>
                  )}
                  {session.toPosition !== undefined && session.toPosition !== null && (
                    <Typography.Text type="secondary">
                      {`${session.fromPosition ?? 0}–${session.toPosition} ${unit}`}
                    </Typography.Text>
                  )}
                  {session.durationMinutes ? (
                    <Typography.Text type="secondary">{`${session.durationMinutes} мин.`}</Typography.Text>
                  ) : null}
                </Space>
              </List.Item>
            );
          }}
        />
      </div>

      {/* Перечитывания: со второго прохода эта история и становится интересной. */}
      {logs.length > 0 && (
        <div>
          <Typography.Text strong>Проходы</Typography.Text>
          <Timeline
            style={{ marginTop: 12 }}
            items={logs.map((log) => {
              const scores = ratingCriteria
                .filter((criterion) => log[criterion.key] !== undefined && log[criterion.key] !== null)
                .map((criterion) => `${criterion.label.toLowerCase()} ${formatScore(log[criterion.key])}`);
              return {
                key: log.id,
                color: log.finishedAt ? 'green' : 'blue',
                dot: log.finishedAt ? <CheckCircleOutlined /> : <SyncOutlined spin />,
                children: (
                  <Space direction="vertical" size={2} style={{ display: 'flex' }}>
                    <Space wrap size={8}>
                      <Typography.Text strong>{`Проход №${log.attempt}`}</Typography.Text>
                      {log.rating !== undefined && log.rating !== null && (
                        <Tag bordered={false} color="gold" style={{ marginInlineEnd: 0 }}>
                          {`оценка ${formatScore(log.rating)}`}
                        </Tag>
                      )}
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {formatDate(log.startedAt)}
                      {log.finishedAt ? ` — ${formatDate(log.finishedAt)}` : ' — идёт'}
                      {log.durationDays !== undefined && log.durationDays !== null
                        ? `, ${pluralize(log.durationDays, ['день', 'дня', 'дней'])}`
                        : ''}
                    </Typography.Text>
                    {scores.length > 0 && (
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        {scores.join(' · ')}
                      </Typography.Text>
                    )}
                  </Space>
                )
              };
            })}
          />
        </div>
      )}
    </Space>
  );
};
