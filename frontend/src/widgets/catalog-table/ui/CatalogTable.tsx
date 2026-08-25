import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Skeleton, Typography, theme } from 'antd';
import type { InputRef } from 'antd';
import { DeleteOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons';
import { formatDateTime } from '@/shared/lib/date';
import type { CatalogRow } from '@/pages/catalog-page/model/catalogEntities';

interface Props {
  rows: CatalogRow[];
  loading?: boolean;
  empty: React.ReactNode;
  /** У источников вторая колонка — ссылка, у типов — когда правили. */
  secondColumn: 'url' | 'updatedAt';
  canEdit: boolean;
  canDelete: boolean;
  /** Правка имени прямо в строке; остальные поля открываются окном. */
  onRename: (row: CatalogRow, name: string) => Promise<unknown>;
  onEditAll?: (row: CatalogRow) => void;
  onDelete?: (row: CatalogRow) => void;
}

/**
 * Справочник, которому нечего показать обложками: тип и источник — это слово и, у источника,
 * ссылка. Строка вместо карточки, а переименование — прямо в ней: открывать окно ради одного
 * поля значит четыре нажатия там, где хватает одного.
 */
export const CatalogTable: React.FC<Props> = ({
  rows,
  loading,
  empty,
  secondColumn,
  canEdit,
  canDelete,
  onRename,
  onEditAll,
  onDelete
}) => {
  const { token } = theme.useToken();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const startEdit = (row: CatalogRow) => {
    setEditingId(row.id);
    setDraft(row.name);
  };

  const commit = async (row: CatalogRow) => {
    const name = draft.trim();
    if (!name || name === row.name) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    try {
      await onRename(row, name);
      setEditingId(null);
    } finally {
      // Ошибку показывает вызывающая страница; строка остаётся открытой, чтобы не потерять ввод.
      setSaving(false);
    }
  };

  if (loading && rows.length === 0) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (rows.length === 0) {
    return <>{empty}</>;
  }

  const headerCell: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary
  };

  return (
    <div
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 44,
          padding: `0 ${token.padding}px`,
          background: token.colorFillQuaternary,
          borderBottom: `1px solid ${token.colorBorderSecondary}`
        }}
      >
        <div style={{ flex: 1, ...headerCell }}>Название</div>
        <div style={{ width: 220, ...headerCell }}>{secondColumn === 'url' ? 'Ссылка' : 'Правили'}</div>
        <div style={{ width: 80 }} />
      </div>

      {rows.map((row, index) => (
        <div
          key={row.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: `11px ${token.padding}px`,
            background: editingId === row.id ? token.colorFillQuaternary : undefined,
            borderBottom: index === rows.length - 1 ? undefined : `1px solid ${token.colorSplit}`
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingId === row.id ? (
              <Input
                ref={inputRef}
                value={draft}
                disabled={saving}
                maxLength={128}
                style={{ maxWidth: 320 }}
                aria-label={`Название «${row.name}»`}
                onChange={(event) => setDraft(event.target.value)}
                onPressEnter={() => commit(row)}
                onBlur={() => commit(row)}
                // Esc возвращает прежнее имя: правка в строке не должна быть ловушкой.
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <div>
                <Typography.Text
                  strong
                  style={{ cursor: canEdit ? 'text' : undefined }}
                  onClick={canEdit ? () => startEdit(row) : undefined}
                >
                  {row.name}
                </Typography.Text>
                {row.secondary && (
                  <Typography.Paragraph
                    type="secondary"
                    ellipsis={{ rows: 1, tooltip: row.secondary }}
                    style={{ marginBottom: 0, fontSize: 12 }}
                  >
                    {row.secondary}
                  </Typography.Paragraph>
                )}
              </div>
            )}
          </div>

          <div style={{ width: 220, minWidth: 0 }}>
            {secondColumn === 'url' ? (
              row.url ? (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}
                >
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {row.url}
                  </span>
                  <LinkOutlined style={{ flexShrink: 0 }} />
                </a>
              ) : (
                <Typography.Text type="secondary">—</Typography.Text>
              )
            ) : (
              <Typography.Text type="secondary">{formatDateTime(row.updatedAt)}</Typography.Text>
            )}
          </div>

          <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
            {canEdit && onEditAll && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEditAll(row)}
                aria-label={`Редактировать «${row.name}»`}
              />
            )}
            {canDelete && onDelete && (
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(row)}
                aria-label={`Удалить «${row.name}»`}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
