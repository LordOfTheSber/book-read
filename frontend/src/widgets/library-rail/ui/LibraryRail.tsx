import React, { useEffect } from 'react';
import { Button, Form, Typography, theme } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { resetFilters, setFilters } from '@/features/book/set-book-filters';
import {
  FiltersForm,
  filtersToFormValues,
  formValuesToFilters,
  type FiltersFormValues
} from '@/widgets/filters-panel';
import { SmartShelvesWidget } from '@/widgets/smart-shelves';

/** Ширина из макета: уже — фильтры перестают помещаться, шире — список теряет колонки. */
export const LIBRARY_RAIL_WIDTH = 258;

/**
 * Левый рельс рабочего стола: полки, умные полки и фильтры всегда на экране.
 *
 * Форма фильтров здесь та же, что в панели справа, — иначе набор пришлось бы держать в двух
 * экземплярах. Разница только в применении: в рельсе оно происходит сразу, кнопке «Применить»
 * тут не место — она просилась бы нажать после каждого поля.
 */
export const LibraryRail: React.FC = () => {
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.bookFilters);
  const shelves = useAppSelector((state) => state.shelves.list);
  const [form] = Form.useForm<FiltersFormValues>();

  // Фильтры меняются и снаружи — чипами среза, строкой «Показаны:», умной полкой.
  useEffect(() => {
    form.setFieldsValue(filtersToFormValues(filters));
  }, [filters, form]);

  const applyNow = async () => {
    const values = await form.validateFields().catch(() => undefined);
    if (!values) return;
    dispatch(setFilters(formValuesToFilters(values)));
  };

  const card: React.CSSProperties = {
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 12
  };

  const heading: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary,
    marginBottom: 10
  };

  const shelfRow = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    minHeight: 34,
    padding: '0 8px',
    borderRadius: token.borderRadiusSM,
    textAlign: 'left',
    ...(active ? { background: token.colorPrimaryBg, color: token.colorPrimary, fontWeight: 500 } : null)
  });

  return (
    <aside
      aria-label="Полки и фильтры"
      style={{
        width: LIBRARY_RAIL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div style={{ ...card, padding: 8 }}>
        <button
          type="button"
          className="app-shell-reset app-shell-hover"
          style={shelfRow(!filters.shelfId)}
          onClick={() => dispatch(setFilters({ shelfId: undefined, page: 0 }))}
        >
          <span style={{ flex: 1 }}>Все записи</span>
        </button>
        {shelves.map((shelf) => (
          <button
            key={shelf.id}
            type="button"
            className="app-shell-reset app-shell-hover"
            style={shelfRow(filters.shelfId === shelf.id)}
            onClick={() =>
              dispatch(setFilters({ shelfId: filters.shelfId === shelf.id ? undefined : shelf.id, page: 0 }))
            }
          >
            <InboxOutlined style={{ color: token.colorTextQuaternary }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shelf.name}
            </span>
            <span style={{ color: token.colorTextTertiary, fontVariantNumeric: 'tabular-nums' }}>
              {shelf.itemCount}
            </span>
          </button>
        ))}
        {shelves.length === 0 && (
          <Typography.Text type="secondary" style={{ display: 'block', padding: '6px 8px', fontSize: 12 }}>
            Полок пока нет
          </Typography.Text>
        )}
      </div>

      <div style={card}>
        <div style={heading}>Умные полки</div>
        <SmartShelvesWidget variant="rail" />
      </div>

      <div style={card}>
        <div style={{ ...heading, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Фильтры</span>
          <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => dispatch(resetFilters())}>
            Сбросить
          </Button>
        </div>
        <FiltersForm form={form} onValuesChange={applyNow} hide={['status', 'shelfId']} />
      </div>
    </aside>
  );
};
