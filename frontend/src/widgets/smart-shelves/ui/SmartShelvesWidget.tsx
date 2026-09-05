import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Dropdown, Input, Modal, Space, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { BookOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { applySavedFilter, toSavedFilter } from '@/features/book/set-book-filters';
import { createSmartShelfThunk, deleteSmartShelfThunk, loadSmartShelves } from '@/entities/smart-shelf';
import { useRequestError } from '@/shared/lib/errors';
import { describeFilters } from '@/shared/lib/filterLabels';
import { pluralize } from '@/shared/lib/plural';

/**
 * Умные полки: сохранённый фильтр как объект. Фильтр выдачи и так принимал десяток параметров —
 * не хватало только возможности назвать удачную комбинацию и вернуться к ней завтра.
 */
interface Props {
  /**
   * Окно сохранения может открывать строка применённых фильтров: сохраняют набор там,
   * где его собрали, а не кнопкой в панели, стоящей отдельно от фильтров.
   */
  saveOpen?: boolean;
  onSaveOpenChange?: (open: boolean) => void;
  /** На узком экране остаётся только значок: подпись уводила панель на третью строку. */
  iconOnly?: boolean;
  /**
   * В рельсе полки стоят списком, а не под кнопкой: место под них там уже отведено,
   * и прятать три строки за выпадающим меню незачем.
   */
  variant?: 'button' | 'rail';
}

export const SmartShelvesWidget: React.FC<Props> = ({
  saveOpen: controlledOpen,
  onSaveOpenChange,
  iconOnly,
  variant = 'button'
}) => {
  const dispatch = useAppDispatch();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const filters = useAppSelector((state) => state.bookFilters);
  const shelves = useAppSelector((state) => state.smartShelves.list);
  const bookTypes = useAppSelector((state) => state.bookTypes.list);
  const authors = useAppSelector((state) => state.authors.list);
  const series = useAppSelector((state) => state.series.list);
  const tags = useAppSelector((state) => state.tags.list);
  const shelfList = useAppSelector((state) => state.shelves.list);
  const total = useAppSelector((state) => state.books.total);
  const [ownOpen, setOwnOpen] = useState(false);
  const saveOpen = controlledOpen ?? ownOpen;
  const setSaveOpen = onSaveOpenChange ?? setOwnOpen;
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(loadSmartShelves());
  }, [dispatch]);

  /**
   * Что именно сохранится — теми же словами, что стоят в строке «Показаны:». Раньше окно обещало
   * «текущие фильтры», не показывая их: сохранить набор вслепую и найти в полке не то — обычное дело.
   */
  const conditions = useMemo(
    () => describeFilters(filters, { bookTypes, authors, series, tags, shelves: shelfList }),
    [filters, bookTypes, authors, series, tags, shelfList]
  );

  const handleSave = async () => {
    if (!name.trim()) {
      message.warning('Дайте полке название');
      return;
    }
    setSaving(true);
    try {
      await dispatch(createSmartShelfThunk({ name: name.trim(), filter: toSavedFilter(filters) })).unwrap();
      message.success('Умная полка сохранена');
      setSaveOpen(false);
      setName('');
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить полку');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string, shelfName: string) => {
    modal.confirm({
      title: 'Удалить умную полку?',
      content: `«${shelfName}» перестанет быть доступна; сами записи останутся на месте.`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () => dispatch(deleteSmartShelfThunk(id)).unwrap()
    });
  };

  const menu: MenuProps = {
    items:
      shelves.length > 0
        ? shelves.map((shelf) => ({
            key: shelf.id,
            label: (
              // Применение висит на самом пункте меню; на подписи оно было бы вторым обработчиком.
              <Space size={12} style={{ display: 'flex', justifyContent: 'space-between', minWidth: 200 }}>
                <span>{shelf.name}</span>
                <DeleteOutlined
                  onClick={(event) => {
                    event.stopPropagation();
                    confirmDelete(shelf.id, shelf.name);
                  }}
                />
              </Space>
            ),
            onClick: () => dispatch(applySavedFilter(shelf.filter))
          }))
        : [{ key: 'empty', disabled: true, label: <Typography.Text type="secondary">Полок пока нет</Typography.Text> }]
  };

  return (
    <>
      {variant === 'rail' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shelves.length === 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Сохранённых наборов пока нет
            </Typography.Text>
          )}
          {shelves.map((shelf) => (
            <div key={shelf.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                className="app-shell-reset app-shell-hover"
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 32,
                  padding: '0 8px',
                  borderRadius: 8,
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => dispatch(applySavedFilter(shelf.filter))}
              >
                {shelf.name}
              </button>
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                aria-label={`Удалить умную полку «${shelf.name}»`}
                onClick={() => confirmDelete(shelf.id, shelf.name)}
              />
            </div>
          ))}
        </div>
      ) : (
      /* Отдельной кнопки сохранения в панели больше нет: набор сохраняют там, где его
         собрали — ссылкой в строке применённых фильтров. */
      <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
        <Button size="large" icon={<BookOutlined />} aria-label="Умные полки">
          {iconOnly ? shelves.length || undefined : `Умные полки${shelves.length ? ` (${shelves.length})` : ''}`}
        </Button>
      </Dropdown>
      )}

      <Modal
        title="Сохранить как умную полку"
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={handleSave}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
          <Input
            autoFocus
            placeholder="Например, «Непрочитанная фантастика»"
            value={name}
            maxLength={128}
            onChange={(event) => setName(event.target.value)}
            onPressEnter={handleSave}
          />

          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
              Что сохранится
            </Typography.Text>
            {conditions.length === 0 && !filters.q ? (
              <Typography.Text type="secondary">
                Фильтров сейчас нет — в полку попадёт вся библиотека.
              </Typography.Text>
            ) : (
              <Space size={[6, 6]} wrap>
                {conditions.map((condition) => (
                  <Tag key={condition.key} bordered={false} style={{ borderRadius: 999, paddingInline: 10 }}>
                    {condition.label}
                  </Tag>
                ))}
                {filters.q && (
                  <Tag bordered={false} style={{ borderRadius: 999, paddingInline: 10 }}>
                    {`Запрос: ${filters.q}`}
                  </Tag>
                )}
              </Space>
            )}
          </div>

          <Typography.Text type="secondary">
            {`Сейчас под фильтр попадает ${pluralize(total, ['запись', 'записи', 'записей'])}. Состав не запоминается: полка пересчитывается заново, и новые книги попадут в неё сами.`}
          </Typography.Text>
        </Space>
      </Modal>
    </>
  );
};
