import React, { useState } from 'react';
import { Button, Grid, Input, Space, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons';
import { formatDateTime } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/plural';
import type { CatalogEntityMeta, CatalogRow } from '../model';
import { useCatalogStyles } from './CatalogPage.styles';

interface Props {
  meta: CatalogEntityMeta;
  rows: CatalogRow[];
  canEdit: boolean;
  canDelete: boolean;
  onSave: (row: CatalogRow, values: Record<string, string>) => Promise<unknown>;
  onDelete: (row: CatalogRow) => void;
  onOpenLibrary: (row: CatalogRow) => void;
}

/**
 * Типы и источники — строками с правкой на месте (вариант А макета `Catalog1`).
 *
 * Карточки с обложками им не годятся: у типа нет ни книг, ни оценки, показывать в стопке нечего.
 * Зато переименование — единственное, что с ними делают, и ради него открывалось модальное окно
 * с одним полем. Здесь строка сама становится полем: Enter сохраняет, Esc отменяет.
 */
export const CatalogRows: React.FC<Props> = ({
  meta,
  rows,
  canEdit,
  canDelete,
  onSave,
  onDelete,
  onOpenLibrary
}) => {
  const styles = useCatalogStyles();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (row: CatalogRow) => {
    setEditingId(row.id);
    setValues(
      Object.fromEntries(meta.fields.map((field) => [field.key, row.values[field.key] ?? '']))
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setValues({});
  };

  const submit = async (row: CatalogRow) => {
    const required = meta.fields.filter((field) => field.required);
    if (required.some((field) => !values[field.key]?.trim())) return;

    setSaving(true);
    try {
      await onSave(row, values);
      cancelEdit();
    } catch {
      // Об ошибке уже сказала страница; строка остаётся открытой, чтобы набранное не пропало.
    } finally {
      setSaving(false);
    }
  };

  const renderEditor = (row: CatalogRow) => (
    <Space direction="vertical" size={8} style={{ display: 'flex' }}>
      {meta.fields.map((field, index) => (
        <Input
          key={field.key}
          autoFocus={index === 0}
          value={values[field.key] ?? ''}
          placeholder={field.placeholder}
          aria-label={field.label}
          status={field.required && !values[field.key]?.trim() ? 'error' : undefined}
          onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
          onPressEnter={() => void submit(row)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') cancelEdit();
          }}
          style={{ maxWidth: 420 }}
        />
      ))}
    </Space>
  );

  const renderName = (row: CatalogRow) => (
    <Space direction="vertical" size={0}>
      <Typography.Text strong>{row.name}</Typography.Text>
      {/* На узком экране столбцов нет, и счётчик записей уходит под имя: без него строка
          справочника перестаёт отвечать на вопрос «этим вообще пользуются?». */}
      {isMobile && (
        <Typography.Text type="secondary" style={styles.hint}>
          {row.itemCount > 0 ? pluralize(row.itemCount, ['запись', 'записи', 'записей']) : 'ничего нет'}
        </Typography.Text>
      )}
      {row.secondary &&
        (meta.key === 'sources' ? (
          <a href={row.secondary} target="_blank" rel="noreferrer" style={styles.hint}>
            {row.secondary.replace(/^https?:\/\//, '')} <LinkOutlined />
          </a>
        ) : (
          <Typography.Text type="secondary" style={styles.hint}>
            {row.secondary}
          </Typography.Text>
        ))}
    </Space>
  );

  return (
    <div style={styles.table}>
      {!isMobile && (
        <div style={styles.tableHead}>
          <div style={{ flex: 1 }}>Название</div>
          <div style={{ width: 140 }}>В библиотеке</div>
          <div style={{ width: 180 }}>Обновлён</div>
          <div style={{ width: 76 }} />
        </div>
      )}

      {rows.map((row, index) => {
        const editing = editingId === row.id;
        return (
          <div key={row.id} style={styles.row(index === rows.length - 1, editing)}>
            <div style={{ flex: 1, minWidth: 0 }}>{editing ? renderEditor(row) : renderName(row)}</div>

            {!isMobile && (
              <>
                <div style={{ width: 140, ...styles.numeric }}>
                  {row.itemCount > 0 ? (
                    row.libraryFilter ? (
                      <Button type="link" style={{ padding: 0 }} onClick={() => onOpenLibrary(row)}>
                        {pluralize(row.itemCount, ['запись', 'записи', 'записей'])}
                      </Button>
                    ) : (
                      <Typography.Text style={styles.numeric}>
                        {pluralize(row.itemCount, ['запись', 'записи', 'записей'])}
                      </Typography.Text>
                    )
                  ) : (
                    <Typography.Text type="secondary">ничего нет</Typography.Text>
                  )}
                </div>
                <div style={{ width: 180 }}>
                  <Typography.Text type="secondary" style={styles.hint}>
                    {formatDateTime(row.updatedAt)}
                  </Typography.Text>
                </div>
              </>
            )}

            <div style={styles.rowActions}>
              {editing ? (
                <>
                  <Tooltip title="Сохранить">
                    <Button
                      type="text"
                      shape="circle"
                      icon={<CheckOutlined />}
                      loading={saving}
                      onClick={() => void submit(row)}
                      aria-label="Сохранить"
                    />
                  </Tooltip>
                  <Tooltip title="Отменить">
                    <Button
                      type="text"
                      shape="circle"
                      icon={<CloseOutlined />}
                      onClick={cancelEdit}
                      aria-label="Отменить"
                    />
                  </Tooltip>
                </>
              ) : (
                <>
                  {canEdit && (
                    <Tooltip title="Переименовать">
                      <Button
                        type="text"
                        shape="circle"
                        icon={<EditOutlined />}
                        onClick={() => startEdit(row)}
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
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
