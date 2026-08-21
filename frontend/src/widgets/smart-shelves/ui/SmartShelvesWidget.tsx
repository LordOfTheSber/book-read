import React, { useEffect, useState } from 'react';
import { App, Button, Dropdown, Input, Modal, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { BookOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { applySavedFilter, toSavedFilter } from '@/features/book/set-book-filters';
import { createSmartShelfThunk, deleteSmartShelfThunk, loadSmartShelves } from '@/entities/smart-shelf';
import { useRequestError } from '@/shared/lib/errors';

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
}

export const SmartShelvesWidget: React.FC<Props> = ({
  saveOpen: controlledOpen,
  onSaveOpenChange,
  iconOnly
}) => {
  const dispatch = useAppDispatch();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const filters = useAppSelector((state) => state.bookFilters);
  const shelves = useAppSelector((state) => state.smartShelves.list);
  const [ownOpen, setOwnOpen] = useState(false);
  const saveOpen = controlledOpen ?? ownOpen;
  const setSaveOpen = onSaveOpenChange ?? setOwnOpen;
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(loadSmartShelves());
  }, [dispatch]);

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
      {/* Отдельной кнопки сохранения в панели больше нет: набор сохраняют там, где его
          собрали — ссылкой в строке применённых фильтров. */}
      <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
        <Button size="large" icon={<BookOutlined />} aria-label="Умные полки">
          {iconOnly ? shelves.length || undefined : `Умные полки${shelves.length ? ` (${shelves.length})` : ''}`}
        </Button>
      </Dropdown>

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
        <Space direction="vertical" size={8} style={{ display: 'flex' }}>
          <Typography.Text type="secondary">
            Состав полки не запоминается — сохраняются текущие фильтры, и каждый раз она
            пересчитывается по ним заново.
          </Typography.Text>
          <Input
            autoFocus
            placeholder="Например, «Непрочитанная фантастика»"
            value={name}
            maxLength={128}
            onChange={(event) => setName(event.target.value)}
            onPressEnter={handleSave}
          />
        </Space>
      </Modal>
    </>
  );
};
