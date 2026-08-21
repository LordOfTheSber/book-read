import React, { useEffect, useRef, useState } from 'react';
import { Badge, Button, Input, Segmented, Select, Tooltip, theme } from 'antd';
import {
  AppstoreOutlined,
  FilterOutlined,
  LayoutOutlined,
  SearchOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import { sortOptions } from '@/shared/constants/status';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import type { BooksViewMode } from '@/widgets/books-list';

/** Список во всю ширину — вариант А макетов; рабочий стол с рельсом — вариант Б. */
export type BooksLayout = 'list' | 'desk';

export interface ActiveFilterChip {
  key: string;
  label: string;
}

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  sort?: string;
  onSortChange: (value: string) => void;
  viewMode: BooksViewMode;
  onViewModeChange: (value: BooksViewMode) => void;
  /** Раскладка страницы: список во всю ширину или рабочий стол с рельсом слева. */
  layout: BooksLayout;
  onLayoutChange: (value: BooksLayout) => void;
  onOpenFilters: () => void;
  /** Число применённых фильтров — на значке кнопки; сами чипы рисует страница под панелью. */
  activeFilterCount: number;
  isMobile: boolean;
  /** Умные полки: панель их только размещает, всё остальное — внутри виджета. */
  smartShelves?: React.ReactNode;
}

export const BooksToolbarWidget: React.FC<Props> = ({
  search,
  onSearchChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  layout,
  onLayoutChange,
  onOpenFilters,
  activeFilterCount,
  isMobile,
  smartShelves
}) => {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState(search);
  const debounced = useDebouncedValue(draft, 400);
  const lastEmitted = useRef(search);

  // Поиск уходит в стор с задержкой, а не на каждый символ.
  useEffect(() => {
    if (debounced === lastEmitted.current) return;
    lastEmitted.current = debounced;
    onSearchChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Внешний сброс фильтров подхватывается полем ввода, но не затирает набранное.
  useEffect(() => {
    if (search === lastEmitted.current) return;
    lastEmitted.current = search;
    setDraft(search);
  }, [search]);

  return (
    <div
      style={{
        display: 'flex',
        // Один ряд, но контейнер остаётся колонкой: иначе внутренняя строка не тянется
        // на всю ширину и поле поиска перестаёт занимать свободное место.
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        marginBottom: 12,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <Input
          allowClear
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder="Поиск по названию, автору, тегам и выпискам"
          size="large"
          style={{ flex: '1 1 260px', minWidth: 200 }}
        />

        {/* Перенос по строкам обязателен: сортировка, фильтры и умные полки в один ряд не
            помещаются на телефоне, и без него страница целиком уезжала вбок на 130 пикселей. */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            flex: isMobile ? '1 1 100%' : '0 0 auto'
          }}
        >
          <Select
            value={sort}
            onChange={onSortChange}
            size="large"
            // Базис на телефоне узкий намеренно: с широким сортировка съедала строку,
            // и умные полки уезжали на третью — список начинался ниже сгиба.
            // minWidth: 0 обязателен — иначе поле не сжимается уже собственной подписи
            // «Сначала новые», строка переполняется и умные полки уезжают на третью.
            style={{
              flex: isMobile ? '1 1 110px' : undefined,
              minWidth: isMobile ? 0 : undefined,
              width: isMobile ? undefined : 200
            }}
            options={sortOptions.map((option) => ({ label: option.label, value: option.value }))}
            placeholder="Сортировка"
          />

          {/* В рабочем столе и фильтры, и умные полки стоят в рельсе слева: те же кнопки
              в панели были бы вторым входом в одно и то же. */}
          {layout === 'list' && (
            <Badge count={activeFilterCount} size="small" offset={[-4, 4]}>
              <Button size="large" icon={<FilterOutlined />} onClick={onOpenFilters}>
                Фильтры
              </Button>
            </Badge>
          )}

          {layout === 'list' && smartShelves}
        </div>

        {/* Рельс забирает 258 px: на телефоне их взять неоткуда, поэтому переключатель
            раскладки живёт рядом с выбором вида и исчезает вместе с ним. */}
        {!isMobile && (
          <Tooltip title={layout === 'desk' ? 'Скрыть рельс полок' : 'Показать рельс полок'}>
            <Button
              size="large"
              icon={<LayoutOutlined />}
              type={layout === 'desk' ? 'primary' : 'default'}
              aria-pressed={layout === 'desk'}
              aria-label={layout === 'desk' ? 'Скрыть рельс полок' : 'Показать рельс полок'}
              onClick={() => onLayoutChange(layout === 'desk' ? 'list' : 'desk')}
            />
          </Tooltip>
        )}

        {!isMobile && (
          <Segmented
            size="large"
            value={viewMode}
            onChange={(value) => onViewModeChange(value as BooksViewMode)}
            options={[
              { value: 'table', icon: <Tooltip title="Списком"><UnorderedListOutlined /></Tooltip> },
              { value: 'grid', icon: <Tooltip title="Карточки"><AppstoreOutlined /></Tooltip> }
            ]}
          />
        )}
      </div>

    </div>
  );
};
