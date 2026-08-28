import React from 'react';
import { Avatar, Button, Space, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, StarFilled } from '@ant-design/icons';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { coverUrl } from '@/entities/book';
import { formatScore } from '@/shared/lib/format';
import type { LibraryItem } from '@/shared/types/library';
import { catalogMetaLine, COVERS_IN_CARD, type CatalogEntityKey, type CatalogRow } from '../model';
import { useCatalogStyles } from './CatalogPage.styles';

interface Props {
  entity: CatalogEntityKey;
  rows: CatalogRow[];
  covers: Record<string, LibraryItem[]>;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: CatalogRow) => void;
  onDelete: (row: CatalogRow) => void;
  onOpenLibrary: (row: CatalogRow) => void;
}

/** Две первые буквы имени: аватар автора без картинки не должен быть пустым кругом. */
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

/**
 * Справочник авторов и серий карточками (вариант Б макета `Catalog2`).
 *
 * Таблица «имя — сколько в библиотеке» была списком слов: по ней нельзя решить, что читать
 * дальше. Карточка показывает, что именно у вас есть этого автора, сколько из этого пройдено
 * и как вы его оцениваете — стопка обложек отвечает на вопрос раньше, чем цифры.
 */
export const CatalogCards: React.FC<Props> = ({
  entity,
  rows,
  covers,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onOpenLibrary
}) => {
  const styles = useCatalogStyles();

  return (
    <div style={styles.cards}>
      {rows.map((row) => {
        const items = covers[row.id] ?? [];
        const rating = formatScore(row.averageRating);
        const more = row.itemCount - items.length;

        return (
          <div key={row.id} style={styles.card}>
            <div style={styles.cardHead}>
              <Avatar size={44}>{initials(row.name)}</Avatar>
              <span style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text style={styles.cardName} title={row.name}>
                  {row.name}
                </Typography.Text>
                <Typography.Text type="secondary" style={styles.cardMeta}>
                  {catalogMetaLine(entity, row)}
                </Typography.Text>
              </span>
              {rating && (
                <Tooltip title="Средняя оценка">
                  <span style={styles.rating}>
                    <StarFilled style={styles.ratingIcon} />
                    {rating}
                  </span>
                </Tooltip>
              )}
            </div>

            {items.length > 0 && (
              <div style={styles.covers}>
                {items.slice(0, COVERS_IN_CARD).map((item) => (
                  <span key={item.id} style={styles.cover(Boolean(item.finishedAt))}>
                    <CoverThumb
                      src={item.hasCover ? coverUrl(item.id, item.updatedAt) : undefined}
                      title={item.title}
                      kind={item.kind}
                      width="100%"
                      height={84}
                    />
                  </span>
                ))}
                {more > 0 && <span style={styles.coversMore}>+{more}</span>}
              </div>
            )}

            <div style={styles.cardFoot}>
              <Typography.Text type="secondary" style={styles.hint}>
                {row.progressPhrase}
              </Typography.Text>
              <Space size={2}>
                {row.itemCount > 0 && row.libraryFilter && (
                  <Button type="link" size="small" onClick={() => onOpenLibrary(row)}>
                    Все книги
                  </Button>
                )}
                {canEdit && (
                  <Tooltip title="Переименовать">
                    <Button
                      type="text"
                      shape="circle"
                      icon={<EditOutlined />}
                      onClick={() => onEdit(row)}
                      aria-label={`Переименовать «${row.name}»`}
                    />
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title="Удалить">
                    <Button
                      type="text"
                      danger
                      shape="circle"
                      icon={<DeleteOutlined />}
                      onClick={() => onDelete(row)}
                      aria-label={`Удалить «${row.name}»`}
                    />
                  </Tooltip>
                )}
              </Space>
            </div>
          </div>
        );
      })}
    </div>
  );
};
