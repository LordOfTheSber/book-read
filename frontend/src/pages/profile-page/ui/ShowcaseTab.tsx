import React, { useEffect, useState } from 'react';
import { Button, Empty, Grid, Progress, Skeleton, Typography, theme } from 'antd';
import { FireOutlined, StarFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { coverUrl, fetchBooks } from '@/entities/book';
import { fetchGoal, fetchStreak, goalProgress } from '@/entities/engagement';
import { setFilters } from '@/features/book/set-book-filters';
import { useAppDispatch } from '@/shared/lib/hooks';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { displayFont } from '@/shared/config/brand';
import { formatScore } from '@/shared/lib/format';
import { remainingPhrase } from '@/shared/lib/phrases';
import { resolveProgressUnit } from '@/shared/constants/format';
import { BookAnalytics, LibraryItem, ReadingGoal, Streak } from '@/shared/types/library';

interface Props {
  analytics?: BookAnalytics | null;
  loading?: boolean;
}

/** Сколько книг видно в «Сейчас читаю» и на полке года: больше в ряд не помещается. */
const READING_SHOWN = 3;
const SHELF_SHOWN = 8;
/** Полка года собирается из того, что понравилось: девятка и выше. */
const SHELF_MIN_RATING = 9;

const SectionTitle: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: token.colorTextTertiary
        }}
      >
        {children}
      </span>
      {aside}
    </div>
  );
};

/**
 * Витрина: профиль показывает книги, а не таблицы.
 *
 * Сводка из плиток и полос не менялась день ото дня — открывать её было незачем. Здесь то, что
 * меняется: что читается сейчас, что понравилось за год и держится ли ритм. Подробные разрезы
 * остаются в «Аналитике», числа — на соседней вкладке.
 */
export const ShowcaseTab: React.FC<Props> = ({ analytics, loading }) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [reading, setReading] = useState<LibraryItem[]>([]);
  const [readingTotal, setReadingTotal] = useState(0);
  const [shelf, setShelf] = useState<LibraryItem[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const year = new Date().getFullYear();

    Promise.allSettled([
      fetchBooks({ status: 'READING', size: READING_SHOWN, page: 0, sort: 'updatedAt,desc' }),
      fetchBooks({
        status: 'COMPLETED',
        minRating: SHELF_MIN_RATING,
        finishedFrom: `${year}-01-01`,
        finishedTo: `${year}-12-31`,
        size: SHELF_SHOWN,
        page: 0,
        sort: 'rating,desc'
      }),
      fetchStreak(),
      fetchGoal()
    ]).then(([readingResult, shelfResult, streakResult, goalResult]) => {
      if (cancelled) return;
      // allSettled, а не all: витрина складывается из четырёх независимых кусков, и молчащая
      // цель года не должна уносить с собой полку «сейчас читаю».
      if (readingResult.status === 'fulfilled') {
        setReading(readingResult.value.content);
        setReadingTotal(readingResult.value.totalElements);
      }
      if (shelfResult.status === 'fulfilled') setShelf(shelfResult.value.content);
      if (streakResult.status === 'fulfilled') setStreak(streakResult.value);
      if (goalResult.status === 'fulfilled') setGoal(goalResult.value);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const openLibrary = (patch: Parameters<typeof setFilters>[0]) => {
    dispatch(setFilters(patch));
    navigate('/');
  };

  if (!ready && loading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  const numbers = [
    { value: analytics?.totalItems ?? 0, label: 'в коллекции' },
    { value: analytics?.statusBreakdown?.COMPLETED ?? 0, label: 'дочитано' },
    { value: analytics?.averageRating ? formatScore(analytics.averageRating) : '—', label: 'средняя оценка' }
  ];

  const share = goalProgress(goal ?? undefined);
  // Мера — та, в которой цель поставлена: книги, страницы или минуты.
  const metric = goal?.items ?? goal?.pages ?? goal?.minutes;
  const metricLabel = goal?.items ? 'книг' : goal?.pages ? 'страниц' : 'минут';

  return (
    <div>
      {/* Три числа — всё, что остаётся от сводки: за остальным есть «Числа» и «Аналитика». */}
      <div
        style={{
          // Три колонки, а не перенос: числа читаются рядом, и «средняя оценка» не должна
          // уезжать одна на вторую строку.
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: screens.md ? 34 : 12,
          padding: screens.md ? '22px 26px' : 18,
          marginBottom: 28,
          borderRadius: token.borderRadiusLG,
          background: token.colorPrimaryBg
        }}
      >
        {numbers.map((number) => (
          <div key={number.label}>
            <div
              style={{
                fontFamily: displayFont,
                fontSize: screens.md ? 34 : 26,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: -0.8,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {number.value}
            </div>
            <div
              style={{
                marginTop: 7,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                color: token.colorTextSecondary
              }}
            >
              {number.label}
            </div>
          </div>
        ))}
      </div>

      <section aria-label="Сейчас читаю" style={{ marginBottom: 32 }}>
        <SectionTitle
          aside={
            readingTotal > READING_SHOWN && (
              <Button type="link" style={{ padding: 0 }} onClick={() => openLibrary({ status: 'READING', page: 0 })}>
                {`Все ${readingTotal}`}
              </Button>
            )
          }
        >
          Сейчас читаю
        </SectionTitle>

        {reading.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Ничего не начато — отметьте книгу «Читаю», и она появится здесь"
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${screens.md ? 260 : 220}px, 1fr))`,
              gap: 20
            }}
          >
            {reading.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: 16, cursor: 'pointer' }} onClick={() => navigate(`/library/${item.id}`)}>
                <CoverThumb
                  src={item.hasCover ? coverUrl(item.id, item.updatedAt) : undefined}
                  title={item.title}
                  kind={item.kind}
                  width={92}
                  height={132}
                  radius={12}
                  progressPercent={item.progress?.percent}
                />
                <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                  <Typography.Text
                    strong
                    style={{ display: 'block', fontFamily: displayFont, fontSize: 16, lineHeight: 1.3 }}
                    ellipsis={{ tooltip: item.title }}
                  >
                    {item.title}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }} ellipsis>
                    {item.authors?.map((author) => author.name).join(', ') || 'Автор не указан'}
                  </Typography.Text>
                  <Progress
                    percent={Math.round(item.progress?.percent ?? 0)}
                    showInfo={false}
                    size="small"
                    style={{ margin: '14px 0 0' }}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {remainingPhrase(item.progress, resolveProgressUnit(item)) ?? 'прогресс не отмечен'}
                  </Typography.Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {shelf.length > 0 && (
        <section aria-label="Лучшее за год" style={{ marginBottom: 32 }}>
          <SectionTitle
            aside={
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {`оценка ${SHELF_MIN_RATING} и выше`}
              </Typography.Text>
            }
          >
            Лучшее за год
          </SectionTitle>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 14 }}
          >
            {shelf.map((item) => (
              <div key={item.id} style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/library/${item.id}`)}>
                <div style={{ position: 'relative' }}>
                  <CoverThumb
                    src={item.hasCover ? coverUrl(item.id, item.updatedAt) : undefined}
                    title={item.title}
                    kind={item.kind}
                    width="100%"
                    height={150}
                    radius={10}
                  />
                  {item.rating !== undefined && item.rating !== null && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 8,
                        bottom: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        height: 22,
                        padding: '0 8px',
                        borderRadius: 999,
                        background: token.colorBgElevated,
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      <StarFilled style={{ color: token.colorWarning, fontSize: 11 }} />
                      {formatScore(item.rating)}
                    </span>
                  )}
                </div>
                <Typography.Text style={{ display: 'block', marginTop: 8, fontSize: 13 }} ellipsis={{ tooltip: item.title }}>
                  {item.title}
                </Typography.Text>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ритм одной строкой: серия и цель года — то, ради чего профиль открывают чаще всего. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: screens.md ? 40 : 20,
          flexWrap: 'wrap',
          padding: screens.md ? '20px 24px' : 16,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 14,
              background: token.colorPrimaryBg,
              color: token.colorPrimary
            }}
          >
            <FireOutlined style={{ fontSize: 21 }} />
          </span>
          <div>
            <div style={{ fontFamily: displayFont, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
              {streak?.currentStreak ?? 0}
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              дней подряд с чтением
            </Typography.Text>
          </div>
        </div>

        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <Typography.Text style={{ fontSize: 13 }}>Цель года</Typography.Text>
            <Typography.Text strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              {metric ? `${metric.done} из ${metric.target} ${metricLabel}` : 'не поставлена'}
            </Typography.Text>
          </div>
          <Progress
            percent={share !== undefined ? Math.round(share * 100) : 0}
            showInfo={false}
            size="small"
            style={{ margin: '9px 0 0' }}
          />
        </div>

        <Button type="link" style={{ padding: 0, flexShrink: 0 }} onClick={() => navigate('/goals')}>
          Цели и достижения
        </Button>
      </div>
    </div>
  );
};
