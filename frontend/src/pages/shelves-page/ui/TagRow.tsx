import React from 'react';
import { Button, Input, Tooltip, Typography, theme } from 'antd';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import { Tag as LibraryTag } from '@/shared/types/library';

interface Props {
  tag: LibraryTag;
  /** Вес самого частого тега: по нему считается длина полосы у остальных. */
  maxCount: number;
  last: boolean;
  renaming: boolean;
  onOpenLibrary: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

/**
 * Тег строкой с полосой веса.
 *
 * Облаком чипов вес показывался размером шрифта: «фантастика» крупнее «китая» — но насколько,
 * прочитать было нельзя, а сорок разноразмерных чипов читались как мешанина. Полоса даёт тот же
 * ответ ровным списком, и рядом остаётся само число.
 */
export const TagRow: React.FC<Props> = ({
  tag,
  maxCount,
  last,
  renaming,
  onOpenLibrary,
  onStartRename,
  onRename,
  onDelete
}) => {
  const { token } = theme.useToken();
  const percent = maxCount > 0 ? Math.max(2, Math.round((tag.itemCount / maxCount) * 100)) : 0;

  if (renaming) {
    return (
      <div style={{ padding: `11px ${token.paddingXS}px` }}>
        <Input
          size="small"
          autoFocus
          defaultValue={tag.name}
          maxLength={64}
          onBlur={(event) => onRename(event.target.value)}
          onPressEnter={(event) => onRename((event.target as HTMLInputElement).value)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: `11px ${token.paddingXS}px`,
        borderBottom: last ? undefined : `1px solid ${token.colorSplit}`
      }}
    >
      {/*
        Действий у тега три, и вешать их на одну цель нельзя: нажатие на название уводит в
        библиотеку, поэтому переименование и удаление стоят отдельными кнопками.
      */}
      <Typography.Text
        ellipsis={{ tooltip: tag.name }}
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={onOpenLibrary}
        title="Показать в библиотеке"
      >
        {tag.name}
      </Typography.Text>

      <span
        aria-hidden
        style={{
          width: 120,
          height: 6,
          borderRadius: 999,
          background: token.colorFillSecondary,
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        <span style={{ display: 'block', width: `${percent}%`, height: '100%', background: token.colorPrimary }} />
      </span>

      <Typography.Text
        type="secondary"
        style={{ width: 34, textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
      >
        {tag.itemCount}
      </Typography.Text>

      <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <Tooltip title="Переименовать">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={onStartRename}
            aria-label={`Переименовать «${tag.name}»`}
          />
        </Tooltip>
        <Tooltip title="Удалить">
          <Button
            type="text"
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={onDelete}
            aria-label={`Удалить «${tag.name}»`}
          />
        </Tooltip>
      </span>
    </div>
  );
};
