import React from 'react';
import { App, Button, Card, Form, Progress, Select, Space, Switch, Typography, theme } from 'antd';
import { StarFilled } from '@ant-design/icons';
import { LibraryItem, MediaKind } from '@/shared/types/library';
import { advanceProgress } from '@/entities/book';
import { CoverField } from '@/widgets/book-form';
import { statusOptions, getStatusAccent } from '@/shared/constants/status';
import { progressQuickSteps, progressUnitLabel, resolveProgressUnit } from '@/shared/constants/format';
import { formatDate } from '@/shared/lib/date';
import { useRequestError } from '@/shared/lib/errors';

interface Props {
  item: LibraryItem;
  /** Название и вид тянутся из формы: заглушка обложки меняется вместе с вводом. */
  title: string;
  kind?: MediaKind;
  /** Заход изменил позицию — запись и список нужно перечитать. */
  onProgressChanged: () => void;
  /** «Заход» открывает вкладку «Прогресс»: полную форму захода рисует она. */
  onOpenSessions: () => void;
  isMobile?: boolean;
}

const Label: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Typography.Text
    type="secondary"
    style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}
  >
    {children}
  </Typography.Text>
);

/**
 * Колонка состояния записи: обложка, статус, прогресс, срок и два признака.
 *
 * В прежней панели всё это было такими же полями формы, как ISBN и переводчик, и делило ширину
 * с историей заходов. Состояние отвечает на вопрос «где я в этой книге», и на странице оно стоит
 * отдельно от полей: слева — что происходит, справа — что записано.
 */
export const RecordState: React.FC<Props> = ({
  item,
  title,
  kind,
  onProgressChanged,
  onOpenSessions,
  isMobile
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [pendingStep, setPendingStep] = React.useState<number | null>(null);

  const progress = item.progress;
  const unitKey = resolveProgressUnit(item);
  const unit = progressUnitLabel[unitKey];
  const hasScale = progress?.percent !== undefined && progress.percent !== null;
  const steps = progressQuickSteps[unitKey].slice(0, 2);

  const advance = async (delta: number) => {
    setPendingStep(delta);
    try {
      if (!(await advanceProgress(item, delta))) {
        message.info('Шкала уже пройдена до конца');
        return;
      }
      onProgressChanged();
    } catch (error) {
      showRequestError(error, 'Не удалось отметить прогресс');
    } finally {
      setPendingStep(null);
    }
  };

  return (
    <Space direction="vertical" size={12} style={{ display: 'flex' }}>
      <Card size="small" styles={{ body: { padding: 16 } }}>
        <CoverField item={item} title={title} kind={kind} compact={isMobile} />
      </Card>

      <Card size="small" styles={{ body: { padding: 16 } }}>
        <Label>Статус</Label>
        <Form.Item name="status" style={{ marginTop: 10, marginBottom: 0 }}>
          <Select
            options={statusOptions.map((option) => ({
              label: (
                <Space size={8}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      display: 'inline-block',
                      background: getStatusAccent(option.value)
                    }}
                  />
                  {option.label}
                </Space>
              ),
              value: option.value
            }))}
            style={{ width: '100%' }}
          />
        </Form.Item>

        {hasScale && (
          <>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Typography.Text style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {progress?.current ?? 0}
                <Typography.Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
                  {` / ${progress?.total} ${unit}`}
                </Typography.Text>
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                {`${progress?.percent}%`}
              </Typography.Text>
            </div>
            <Progress
              percent={progress?.percent}
              showInfo={false}
              status={progress?.percent === 100 ? 'success' : progress?.behindSchedule ? 'exception' : 'normal'}
              style={{ marginTop: 4, marginBottom: 0 }}
            />
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              {steps.map((step) => (
                <Button
                  key={step}
                  style={{ flex: 1 }}
                  loading={pendingStep === step}
                  onClick={() => advance(step)}
                >
                  {`+${step}`}
                </Button>
              ))}
              {/* Полную форму захода — с датой, отрезком и длительностью — рисует вкладка «Прогресс». */}
              <Button type="link" style={{ flex: 1.4 }} onClick={onOpenSessions}>
                Заход
              </Button>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 13
          }}
        >
          <StateRow label="Начато" value={formatDate(item.startedAt) || '—'} />
          {item.finishedAt && <StateRow label="Завершено" value={formatDate(item.finishedAt)} />}
          <StateRow label="Дочитать к" value={formatDate(item.deadline) || 'не задан'} />
          {/* Норма появляется только при сроке: без него её попросту не из чего считать. */}
          {progress?.dailyNorm ? (
            <StateRow
              label="Норма"
              value={`${Math.ceil(progress.dailyNorm)} ${unit}/день`}
              accent={progress.behindSchedule ? token.colorError : token.colorLink}
            />
          ) : null}
        </div>
      </Card>

      <Card size="small" styles={{ body: { padding: '8px 16px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0' }}>
          <Space size={9}>
            <StarFilled style={{ color: token.colorWarning }} />
            <span>В избранном</span>
          </Space>
          <Form.Item name="favorite" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch aria-label="В избранном" />
          </Form.Item>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 0',
            borderTop: `1px solid ${token.colorBorderSecondary}`
          }}
        >
          {/* Список желаемого — не «собираюсь прочитать», а «надо купить»: он отдельно от статуса. */}
          <span>В желаемом</span>
          <Form.Item name="wishlist" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch aria-label="В желаемом" />
          </Form.Item>
        </div>
      </Card>
    </Space>
  );
};

const StateRow: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: accent }}>
    <Typography.Text type={accent ? undefined : 'secondary'} style={{ color: accent, fontSize: 13 }}>
      {label}
    </Typography.Text>
    <Typography.Text style={{ color: accent, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </Typography.Text>
  </div>
);
