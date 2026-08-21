import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Progress, Skeleton, Tooltip, Typography, theme } from 'antd';
import { advanceProgress, coverUrl, fetchBooks, loadBooks } from '@/entities/book';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { progressQuickSteps, progressUnitLabel, resolveProgressUnit } from '@/shared/constants/format';
import { remainingPhrase } from '@/shared/lib/phrases';
import { useRequestError } from '@/shared/lib/errors';
import type { LibraryItem } from '@/shared/types/library';

interface Props {
  onOpen: (item: LibraryItem) => void;
  /** «Все N» ведёт в тот же список, отфильтрованный по статусу «Читаю». */
  onShowAll: () => void;
}

/** Шесть карточек: больше не помещается в две строки рядом с рельсом. */
const SHELF_SIZE = 6;

/**
 * Полка «Продолжить» — то, ради чего трекер открывают чаще всего.
 *
 * Читаемое сейчас лежало вперемешку с прочитанным и запланированным: чтобы отметить
 * двадцать страниц, приходилось искать книгу в общем списке. Здесь она сверху, и «+N»
 * двигает прогресс без открытия карточки.
 */
export const ContinueShelf: React.FC<Props> = ({ onOpen, onShowAll }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const showRequestError = useRequestError();
  const filters = useAppSelector((state) => state.bookFilters);
  const total = useAppSelector((state) => state.books.total);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const page = await fetchBooks({
        status: 'READING',
        size: SHELF_SIZE,
        page: 0,
        sort: 'updatedAt,desc',
        userId: filters.userId
      });
      setItems(page.content);
      setCount(page.totalElements);
    } catch {
      // Полка — надстройка над списком: её молчаливое отсутствие лучше экрана с ошибкой.
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters.userId]);

  // Перечитывается вместе со списком: «+10» из строки ниже меняет и эту полку.
  useEffect(() => {
    load();
  }, [load, total]);

  const advance = async (item: LibraryItem, delta: number) => {
    try {
      if (!(await advanceProgress(item, delta))) {
        message.info('Шкала уже пройдена до конца');
        return;
      }
      await Promise.all([load(), dispatch(loadBooks(filters)).unwrap()]);
    } catch (error) {
      showRequestError(error, 'Не удалось отметить прогресс');
    }
  };

  if (loading) {
    return <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 20 }} />;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-label="Продолжить" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: token.colorTextTertiary
          }}
        >
          Продолжить
        </span>
        <Button type="link" size="small" style={{ padding: 0 }} onClick={onShowAll}>
          {`Все ${count}`}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {items.map((item) => {
          const unitKey = resolveProgressUnit(item);
          const step = progressQuickSteps[unitKey][0];
          const progress = item.progress;

          return (
            <div
              key={item.id}
              onClick={() => onOpen(item)}
              className="app-shell-hover"
              style={{
                display: 'flex',
                gap: 12,
                padding: 12,
                cursor: 'pointer',
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG
              }}
            >
              <CoverThumb
                src={item.hasCover ? coverUrl(item.id, item.updatedAt) : undefined}
                title={item.title}
                kind={item.kind}
                width={40}
                height={56}
                radius={8}
                progressPercent={progress?.percent ?? undefined}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text strong ellipsis={{ tooltip: item.title }} style={{ display: 'block' }}>
                  {item.title}
                </Typography.Text>

                <Tooltip title={remainingPhrase(progress, unitKey)}>
                  <Progress
                    percent={progress?.percent ?? 0}
                    size="small"
                    showInfo={false}
                    style={{ margin: '6px 0 2px' }}
                  />
                </Tooltip>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {progress?.total
                      ? `${progress.current ?? 0} / ${progress.total} ${progressUnitLabel[unitKey]}`
                      : 'без шкалы'}
                  </Typography.Text>
                  {progress?.total && (
                    <Button
                      size="small"
                      type="link"
                      style={{ padding: 0, height: 'auto' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        advance(item, step);
                      }}
                    >
                      {`+${step}`}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
