import React, { useEffect, useState } from 'react';
import { Button, Skeleton, Typography, theme } from 'antd';
import { DeleteOutlined, EditOutlined, MergeCellsOutlined, StarFilled } from '@ant-design/icons';
import { coverUrl } from '@/entities/book';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { displayFont } from '@/shared/config/brand';
import { formatScore } from '@/shared/lib/format';
import { pluralize } from '@/shared/lib/plural';
import { Showcase, ShowcaseItem } from '@/shared/types/library';
import type { CatalogRow } from '@/pages/catalog-page/model/catalogEntities';

interface Props {
  rows: CatalogRow[];
  loading?: boolean;
  /** Что показать, когда список пуст: у пустого справочника и у пустого поиска разный текст. */
  empty: React.ReactNode;
  /** Обложки для показанных карточек — грузятся по идентификаторам страницы. */
  fetchShowcase: (ids: string[]) => Promise<Showcase>;
  onOpenLibrary: (row: CatalogRow) => void;
  onEdit?: (row: CatalogRow) => void;
  onDelete?: (row: CatalogRow) => void;
  onMerge?: (row: CatalogRow) => void;
}

/** Столько обложек помещается в ряд карточки; остальное уходит под «+N». */
const COVERS = 4;

/**
 * Что осталось прочитать — фразой, а не долей: «Прочитано всё» и «осталось три» отвечают на
 * вопрос, ради которого справочник и открывают, а «3/5» требует вычитания в уме.
 */
const progressPhrase = (row: CatalogRow) => {
  const total = row.itemCount ?? 0;
  const finished = row.finishedCount ?? 0;
  if (total === 0) return 'Ничего нет в библиотеке';
  if (finished >= total) return 'Прочитано всё, что есть';
  if (finished === 0) return `Не начато · ${pluralize(total, ['запись', 'записи', 'записей'])}`;
  return `Осталось ${pluralize(total - finished, ['запись', 'записи', 'записей'])}`;
};

/**
 * Витрина справочника: карточка вместо строки таблицы.
 *
 * Справочник авторов был списком слов — «имя и сколько в библиотеке». Карточка показывает, что
 * именно этого автора у вас есть, сколько дочитано и как вы его оцениваете: справочник
 * превращается в способ решить, что читать дальше.
 */
export const CatalogShowcase: React.FC<Props> = ({
  rows,
  loading,
  empty,
  fetchShowcase,
  onOpenLibrary,
  onEdit,
  onDelete,
  onMerge
}) => {
  const { token } = theme.useToken();
  const [covers, setCovers] = useState<Showcase>({});

  const ids = rows.map((row) => row.id).join(',');

  useEffect(() => {
    if (!ids) {
      setCovers({});
      return;
    }
    let cancelled = false;
    fetchShowcase(ids.split(','))
      .then((result) => {
        if (!cancelled) setCovers(result);
      })
      // Обложки — украшение карточки: их молчаливое отсутствие лучше экрана с ошибкой.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ids, fetchShowcase]);

  if (loading && rows.length === 0) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: token.margin
      }}
    >
      {rows.map((row) => {
        const shown: ShowcaseItem[] = covers[row.id] ?? [];
        const rest = (row.itemCount ?? 0) - shown.length;
        return (
          <article
            key={row.id}
            style={{
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              padding: `${token.paddingSM}px ${token.padding}px ${token.padding}px`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text
                  strong
                  ellipsis={{ tooltip: row.name }}
                  style={{ display: 'block', fontFamily: displayFont, fontSize: 16 }}
                >
                  {row.name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {row.secondary
                    ? row.secondary
                    : `${pluralize(row.itemCount ?? 0, ['запись', 'записи', 'записей'])} · ${row.finishedCount ?? 0} дочитано`}
                </Typography.Text>
              </div>
              {row.avgRating !== undefined && row.avgRating !== null && (
                <span
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, flexShrink: 0 }}
                >
                  <StarFilled style={{ color: token.colorWarning, fontSize: 13 }} />
                  {formatScore(row.avgRating)}
                </span>
              )}
            </div>

            <div style={{ marginTop: token.marginSM, display: 'flex', gap: 8 }}>
              {shown.slice(0, COVERS).map((item) => (
                <CoverThumb
                  key={item.id}
                  src={item.hasCover ? coverUrl(item.id) : undefined}
                  title={item.title}
                  kind={item.kind}
                  width="100%"
                  height={84}
                  radius={8}
                  // Непрочитанное на витрине приглушено: видно, где цикл остановился.
                  style={{ flex: 1, minWidth: 0, opacity: item.status === 'COMPLETED' ? 1 : 0.45 }}
                />
              ))}
              {shown.length === 0 && (
                <div
                  style={{
                    flex: 1,
                    height: 84,
                    borderRadius: 8,
                    border: `1px dashed ${token.colorBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: token.colorTextTertiary
                  }}
                >
                  Пока ничего нет
                </div>
              )}
              {rest > 0 && (
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 84,
                    borderRadius: 8,
                    border: `1px dashed ${token.colorBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: token.colorTextTertiary
                  }}
                >
                  {`+${rest}`}
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: token.marginSM,
                paddingTop: token.paddingXS,
                borderTop: `1px solid ${token.colorSplit}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 13 }} ellipsis>
                {progressPhrase(row)}
              </Typography.Text>
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <Button type="link" style={{ paddingInline: 4 }} onClick={() => onOpenLibrary(row)}>
                  Все книги
                </Button>
                {onMerge && (
                  <Button
                    type="text"
                    size="small"
                    icon={<MergeCellsOutlined />}
                    onClick={() => onMerge(row)}
                    aria-label={`Объединить «${row.name}» с другой записью`}
                  />
                )}
                {onEdit && (
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => onEdit(row)}
                    aria-label={`Переименовать «${row.name}»`}
                  />
                )}
                {onDelete && (
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(row)}
                    aria-label={`Удалить «${row.name}»`}
                  />
                )}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
};
