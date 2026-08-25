import React from 'react';
import { Button, Tag, Tooltip, Typography, theme } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, GlobalOutlined, TeamOutlined } from '@ant-design/icons';
import { MediaKind, Shelf } from '@/shared/types/library';
import { shelfRoleMeta } from '@/shared/constants/social';
import { kindChipColors, mediaKindMeta } from '@/shared/constants/mediaKind';
import { isDarkSurface } from '@/shared/lib/color';
import { pluralize } from '@/shared/lib/plural';

interface Props {
  shelf: Shelf;
  last: boolean;
  /** Порядковый номер: по нему подбирается тон значка, чтобы полки различались боковым зрением. */
  index: number;
  onOpenLibrary: () => void;
  onPreview: () => void;
  onMembers: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** Девять цветов видов уже выверены по контрасту в обеих темах — значку хватает их по кругу. */
const tints = Object.keys(mediaKindMeta) as MediaKind[];

/**
 * Полка строкой: значок, название с признаками, подпись, счётчик и три действия.
 *
 * Плиткой полка занимала место карточки, ничего этим не показывая: обложек внутри неё нет,
 * а название и описание помещаются в строку.
 */
export const ShelfRow: React.FC<Props> = ({
  shelf,
  last,
  index,
  onOpenLibrary,
  onPreview,
  onMembers,
  onEdit,
  onDelete
}) => {
  const { token } = theme.useToken();
  // Тот же расчёт, что у чипа вида: в тёмной теме заливка и тон считаются от одного значения.
  const tint = kindChipColors(tints[index % tints.length], isDarkSurface(token.colorBgContainer));

  const hint = [
    shelf.description,
    !shelf.owned && shelf.ownerUsername ? `полка @${shelf.ownerUsername}` : undefined
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: `13px ${token.padding}px`,
        borderBottom: last ? undefined : `1px solid ${token.colorSplit}`
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: token.borderRadiusLG,
          flexShrink: 0,
          background: tint.background,
          color: tint.text
        }}
      >
        {/* Две полки корешками — знак набора, а не папки: полка это книги, а не файлы. */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6h16v5H4zM4 13h16v5H4z" strokeLinejoin="round" />
        </svg>
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Typography.Text
            strong
            style={{ cursor: 'pointer' }}
            onClick={onOpenLibrary}
            title="Показать в библиотеке"
          >
            {shelf.name}
          </Typography.Text>
          {shelf.isPublic && (
            <Tooltip title="Полку видно другим пользователям по ссылке">
              <Tag bordered={false} style={{ margin: 0 }} icon={<GlobalOutlined />}>
                общая
              </Tag>
            </Tooltip>
          )}
          {shelf.memberCount > 0 && (
            <Tag bordered={false} style={{ margin: 0 }}>
              {pluralize(shelf.memberCount, ['участник', 'участника', 'участников'])}
            </Tag>
          )}
          {/* Совместная полка нужна участнику там же, где своя, — но перепутать их нельзя. */}
          {!shelf.owned && shelf.myRole && (
            <Tag color={shelfRoleMeta[shelf.myRole].color} bordered={false} style={{ margin: 0 }}>
              {shelfRoleMeta[shelf.myRole].label}
            </Tag>
          )}
        </span>
        {hint && (
          <Typography.Paragraph
            type="secondary"
            ellipsis={{ rows: 1, tooltip: hint }}
            style={{ margin: '3px 0 0', fontSize: 12 }}
          >
            {hint}
          </Typography.Paragraph>
        )}
      </span>

      <Typography.Text
        type="secondary"
        strong
        style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
      >
        {shelf.itemCount}
      </Typography.Text>

      <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <Tooltip title="Показать состав">
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={onPreview} aria-label="Показать состав" />
        </Tooltip>
        <Tooltip title="Участники">
          <Button type="text" size="small" icon={<TeamOutlined />} onClick={onMembers} aria-label="Участники" />
        </Tooltip>
        {onEdit && (
          <Tooltip title="Переименовать">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit} aria-label="Переименовать" />
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip title="Удалить">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={onDelete}
              aria-label="Удалить"
            />
          </Tooltip>
        )}
      </span>
    </div>
  );
};
