import React from 'react';
import { Card, Form, Grid, Input, Rate, Slider, Space, Typography, theme } from 'antd';
import type { FormInstance } from 'antd';
import { EyeInvisibleOutlined, LockOutlined } from '@ant-design/icons';
import { LibraryItem } from '@/shared/types/library';
import { useAppSelector } from '@/shared/lib/hooks';
import { formatScore } from '@/shared/lib/format';
import { pluralize } from '@/shared/lib/plural';
import { criteriaFilled, criteriaSummary, criteriaValues, criterionHint } from '@/shared/lib/rating';
import { formatDate } from '@/shared/lib/date';
import { ReviewBlock } from './ReviewBlock';

interface Props {
  item: LibraryItem | null;
  form: FormInstance;
}

/** Ширина колонки предпросмотра: карточка отзыва в ней встаёт без переносов. */
const PREVIEW_WIDTH = 340;

const GroupTitle: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
    <Typography.Text
      type="secondary"
      style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}
    >
      {children}
    </Typography.Text>
    {aside && (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {aside}
      </Typography.Text>
    )}
  </div>
);

interface ScoreProps {
  value?: number;
  onChange?: (value?: number) => void;
  /**
   * На телефоне шкала — ползунок, а не звёзды.
   *
   * Десять звёзд с половинками — это строка в 312 пикселей, которая никак не разрывается: на
   * любом телефоне она уезжала за край вместе с числом оценки, а страница ехала вбок. Ужать
   * звёзды до влезающих 18 пикселей нельзя — половина такой звезды это цель в девять пикселей
   * при нижней границе удобного нажатия в сорок четыре. Ползунок тянется во всю ширину, берёт
   * полшага без прицеливания и не переполняет ничего.
   */
  mobile?: boolean;
  /** Подпись для читалок экрана: у ползунка критерия своего видимого ярлыка нет. */
  ariaLabel?: string;
}

/** Ползунок 0–10 с полушагом; ноль наружу уходит пустым значением, а не оценкой «0». */
const ScoreSlider: React.FC<ScoreProps> = ({ value, onChange, ariaLabel }) => (
  <Slider
    min={0}
    max={10}
    step={0.5}
    value={value ?? 0}
    onChange={(next: number) => onChange?.(next || undefined)}
    ariaLabelForHandle={ariaLabel}
    tooltip={{ open: false }}
    style={{ margin: '6px 4px 4px' }}
  />
);

/**
 * Общая оценка: десять звёзд с половинками и число рядом. Без числа десять звёзд читаются
 * как загадка — «это восемь или восемь с половиной».
 */
const OverallScore: React.FC<ScoreProps> = ({ value, onChange, mobile }) => {
  const readout = (
    <Typography.Text
      type={value ? undefined : 'secondary'}
      style={{ fontSize: value ? 20 : 14, fontWeight: value ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}
    >
      {value ? `${formatScore(value)} из 10` : 'не оценено'}
    </Typography.Text>
  );

  if (mobile) {
    return (
      <div>
        {readout}
        <ScoreSlider value={value} onChange={onChange} ariaLabel="Общая оценка" />
      </div>
    );
  }

  return (
    <Space size={14} align="center" wrap>
      <Rate
        allowClear
        allowHalf
        count={10}
        value={value ?? 0}
        // Сброс приходит нулём; наружу он должен уйти пустым значением, а не оценкой «0».
        onChange={(next) => onChange?.(next || undefined)}
        style={{ fontSize: 24 }}
      />
      {readout}
    </Space>
  );
};

/** Шкала критерия: десять плашек вместо звёзд — иначе четыре ряда звёзд спорят с общей оценкой. */
const CriterionScore: React.FC<ScoreProps> = ({ value, onChange, mobile, ariaLabel }) => {
  const { token } = theme.useToken();

  if (mobile) {
    return <ScoreSlider value={value} onChange={onChange} ariaLabel={ariaLabel} />;
  }

  return (
    <Rate
      allowClear
      allowHalf
      count={10}
      value={value ?? 0}
      onChange={(next) => onChange?.(next || undefined)}
      character={
        <span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: 4, background: 'currentColor' }} />
      }
      // Не сжимается: иначе в строке с длинной подписью десятая плашка уезжает на вторую строку.
      // Строка существует только на широком экране — на телефоне здесь ползунок.
      style={{ fontSize: 13, color: token.colorWarning, lineHeight: 1, flexShrink: 0, whiteSpace: 'nowrap' }}
    />
  );
};

/**
 * Оценка целиком: общая шкала, четыре критерия, приватная заметка, публичный отзыв и
 * спойлер-кат — а рядом то, во что это складывается для читателя.
 *
 * Раньше всё лежало одной колонкой подряд, а предпросмотр — в самом низу, куда доскроллит
 * не каждый. Теперь он стоит рядом и обновляется на ходу: видно, что именно увидят другие.
 */
export const RatingTab: React.FC<Props> = ({ item, form }) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const user = useAppSelector((state) => state.auth.user);
  // Предпросмотр строится по текущим значениям формы: кат со спойлерами виден до сохранения.
  const values = Form.useWatch([], form) ?? {};
  const preview = { ...(item ?? {}), ...values } as LibraryItem;

  const reviewLength = (preview.review ?? '').length;
  const criteria = criteriaValues(preview);
  const filled = criteriaFilled(criteria);
  const summary = criteriaSummary(criteria, preview.rating ?? undefined);

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 420px', minWidth: 0 }}>
        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
          <Card size="small" styles={{ body: { padding: '18px 20px' } }}>
            <GroupTitle>Общая оценка</GroupTitle>
            <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
              Ставится отдельно: из критериев она не складывается — вес у каждого свой.
            </Typography.Paragraph>
            <Form.Item name="rating" style={{ marginBottom: 6 }}>
              <OverallScore mobile={isMobile} />
            </Form.Item>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Полшага доступны — 7,5 тоже оценка.
            </Typography.Text>
          </Card>

          <Card size="small" styles={{ body: { padding: '18px 20px' } }}>
            <GroupTitle aside={`необязательны · заполнено ${filled} из ${criteria.length}`}>По критериям</GroupTitle>
            <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 14 }}>
              Четыре шкалы для тех, кто разбирает книгу по частям. В список и в публичный отзыв они
              попадают вместе с общей.
            </Typography.Paragraph>

            <Space direction="vertical" size={10} style={{ display: 'flex' }}>
              {criteria.map((criterion) => {
                const hint = criterionHint(criterion.value, criteria, preview.rating ?? undefined);
                const label = (
                  <Typography.Text style={{ width: isMobile ? undefined : 88, flexShrink: 0, fontSize: 13 }}>
                    {criterion.label}
                  </Typography.Text>
                );
                const score = (
                  <Typography.Text
                    type={criterion.value === undefined ? 'secondary' : undefined}
                    style={{
                      width: isMobile ? undefined : 78,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      fontWeight: criterion.value === undefined ? 400 : 600,
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {criterion.value === undefined ? 'не оценён' : formatScore(criterion.value)}
                  </Typography.Text>
                );
                // Подсказка переносится, а не обрезается: «нажмите, чтобы пост…» бесполезно.
                const note = hint && (
                  <Typography.Text type="secondary" style={{ fontSize: 12, minWidth: 0 }}>
                    {hint}
                  </Typography.Text>
                );
                const field = (
                  <Form.Item name={criterion.key} style={{ marginBottom: 0 }} label={criterion.label} noStyle>
                    <CriterionScore mobile={isMobile} ariaLabel={criterion.label} />
                  </Form.Item>
                );

                // На телефоне подпись и число встают строкой, шкала — под ними во всю ширину:
                // в один ряд они не помещаются никакой ценой.
                return isMobile ? (
                  <div key={criterion.key}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                      {label}
                      {score}
                    </div>
                    {field}
                    {note}
                  </div>
                ) : (
                  <div key={criterion.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {label}
                    {field}
                    {score}
                    {note}
                  </div>
                );
              })}
            </Space>

            {summary && (
              <Typography.Paragraph
                type="secondary"
                style={{ fontSize: 13, marginTop: 14, marginBottom: 0, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}
              >
                {summary}
              </Typography.Paragraph>
            )}
          </Card>

          <Card size="small" styles={{ body: { padding: '18px 20px' } }}>
            {/* Заметка и отзыв разделены: первая для себя, второй — то, что не стыдно показать. */}
            <Form.Item
              name="note"
              label={
                <Space size={6}>
                  <LockOutlined style={{ color: token.colorTextTertiary }} />
                  Заметка
                </Space>
              }
              extra="Видна только вам и не попадёт в публичный отзыв"
            >
              <Input.TextArea rows={3} placeholder="На чём остановились, что купить, о чём не забыть" />
            </Form.Item>

            {/*
              Счётчик — частью подписи, а не через showCount: тот рисуется справа от того же
              места, где стоит extra, и на телефоне «35 символов» ложилось поверх «Публичная
              часть — без спойлеров». Одна строка налезть сама на себя не может.
            */}
            <Form.Item
              name="review"
              label="Отзыв"
              extra={
                reviewLength > 0
                  ? `Публичная часть — без спойлеров · ${pluralize(reviewLength, ['символ', 'символа', 'символов'])}`
                  : 'Публичная часть — без спойлеров'
              }
            >
              <Input.TextArea rows={5} placeholder="Впечатление, которое можно показать другим" />
            </Form.Item>

            <Form.Item
              name="reviewSpoiler"
              label={
                <Space size={6}>
                  <EyeInvisibleOutlined style={{ color: token.colorWarning }} />
                  Под спойлер-катом
                </Space>
              }
              extra="Спрятано, пока читатель сам не раскроет"
              style={{ marginBottom: 0 }}
            >
              <Input.TextArea rows={3} placeholder="Развязка, повороты, финал" />
            </Form.Item>
          </Card>
        </Space>
      </div>

      <div style={{ width: isMobile ? '100%' : PREVIEW_WIDTH, flex: '1 1 280px', minWidth: 0 }}>
        <Card size="small" styles={{ body: { padding: '16px 18px' } }}>
          <GroupTitle aside="обновляется на ходу">Так это увидят другие</GroupTitle>
          {/* Подпись автора — часть предпросмотра: отзыв читают вместе с тем, кто его написал. */}
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            {/* Дата — из сохранённой записи, а не из формы: там она лежит объектом dayjs. */}
            {[user?.username, formatDate(item?.finishedAt) || undefined].filter(Boolean).join(' · ')}
          </Typography.Text>
          <ReviewBlock item={preview} />
        </Card>
      </div>
    </div>
  );
};
