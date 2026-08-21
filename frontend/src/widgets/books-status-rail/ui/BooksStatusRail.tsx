import React from 'react';
import { Skeleton, theme } from 'antd';
import { StarFilled } from '@ant-design/icons';
import { statusMeta } from '@/shared/constants/status';
import type { BookAnalytics, ReadingStatus } from '@/shared/types/library';

interface Props {
  analytics?: BookAnalytics | null;
  loading: boolean;
  status?: string;
  favorite?: boolean;
  wishlist?: boolean;
  onSelectStatus: (status?: ReadingStatus) => void;
  onToggleFavorite: () => void;
  onToggleWishlist: () => void;
  isMobile: boolean;
}

/** Порядок как в макете: сначала всё, потом то, что читают, потом остальное по убыванию частоты. */
const statusOrder: ReadingStatus[] = ['READING', 'PLANNED', 'COMPLETED', 'ON_HOLD', 'DROPPED'];

/**
 * Статус-рельс: строка чипов со счётчиками вместо пяти плиток-метрик высотой 76 px.
 *
 * Плитки занимали первый экран целиком и показывали пять чисел, четыре из которых — те же
 * фильтры, что и в панели ниже. Строка чипов говорит то же самое, начинает список примерно
 * на 180 px выше и сразу отвечает, какой срез сейчас открыт.
 */
export const BooksStatusRail: React.FC<Props> = ({
  analytics,
  loading,
  status,
  favorite,
  wishlist,
  onSelectStatus,
  onToggleFavorite,
  onToggleWishlist,
  isMobile
}) => {
  const { token } = theme.useToken();

  if (loading && !analytics) {
    return <Skeleton.Button active block style={{ height: isMobile ? 44 : 34, marginBottom: 14 }} />;
  }

  const chip = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    // На телефоне зона нажатия 44 px: чипы стоят в ряд, и промахнуться мимо соседнего легко.
    height: isMobile ? 44 : 34,
    padding: isMobile ? '0 16px' : '0 14px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontWeight: active ? 500 : 400,
    border: `1px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
    ...(active
      ? { background: token.colorPrimary, color: token.colorTextLightSolid }
      : { background: token.colorBgContainer, color: token.colorText })
  });

  const count = (active: boolean): React.CSSProperties => ({
    fontVariantNumeric: 'tabular-nums',
    color: active ? 'rgba(255,255,255,0.75)' : token.colorTextTertiary
  });

  const anyFilter = Boolean(status) || Boolean(favorite) || Boolean(wishlist);

  const renderChip = (
    key: string,
    label: React.ReactNode,
    value: number | undefined,
    active: boolean,
    onClick: () => void
  ) => (
    <button
      key={key}
      type="button"
      className="app-shell-reset"
      style={chip(active)}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      {value !== undefined && <span style={count(active)}>{value}</span>}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Срезы библиотеки"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        // На узком экране рельс листается вбок, а не переносится: перенос уводил список вниз.
        flexWrap: isMobile ? 'nowrap' : 'wrap',
        overflowX: isMobile ? 'auto' : 'visible',
        paddingBottom: isMobile ? 4 : 0
      }}
    >
      {renderChip('all', 'Всё', analytics?.totalItems, !anyFilter, () => onSelectStatus(undefined))}

      {statusOrder.map((value) =>
        renderChip(
          value,
          statusMeta[value].label,
          analytics?.statusBreakdown?.[value] ?? 0,
          status === value,
          () => onSelectStatus(status === value ? undefined : value)
        )
      )}

      <span
        aria-hidden
        style={{ width: 1, height: 22, background: token.colorBorderSecondary, margin: '0 4px', flexShrink: 0 }}
      />

      {renderChip(
        'favorite',
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <StarFilled style={{ color: favorite ? 'inherit' : token.colorWarning, fontSize: 13 }} />
          Избранное
        </span>,
        analytics?.favoriteItems,
        Boolean(favorite),
        onToggleFavorite
      )}

      {/* У желаемого счётчика нет: сервер не отдаёт его вместе с остальной сводкой,
          а лишний запрос ради одного числа рельс не оправдывает. */}
      {renderChip('wishlist', 'Желаемое', undefined, Boolean(wishlist), onToggleWishlist)}
    </div>
  );
};
