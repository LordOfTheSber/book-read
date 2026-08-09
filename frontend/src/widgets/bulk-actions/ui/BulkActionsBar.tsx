import React, { useState } from 'react';
import { App, Button, Select, Space, Typography, theme } from 'antd';
import { ClearOutlined, TagsOutlined } from '@ant-design/icons';
import { ReadingStatus } from '@/shared/types/library';
import { statusOptions } from '@/shared/constants/status';
import { bulkUpdateBooks, BulkUpdatePayload, loadBooks } from '@/entities/book';
import { loadTags } from '@/entities/tag';
import { loadShelves } from '@/entities/shelf';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';

interface Props {
  selectedIds: string[];
  onClearSelection: () => void;
}

/**
 * Массовые операции над выделением. Ради них раздел 5 и делался наравне с импортом: разбирать
 * свежий импорт в полсотни строк по одной открытой карточке никто не станет.
 */
export const BulkActionsBar: React.FC<Props> = ({ selectedIds, onClearSelection }) => {
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const filters = useAppSelector((state) => state.bookFilters);
  const tags = useAppSelector((state) => state.tags.list);
  const shelves = useAppSelector((state) => state.shelves.list);
  // На полку, где ты только читатель, положить нечего: сервер откажет, а выбор уже сделан.
  const contributableShelves = shelves.filter((shelf) => shelf.canContribute);
  const [busy, setBusy] = useState(false);
  const [tagNames, setTagNames] = useState<string[]>([]);

  const apply = async (payload: Omit<BulkUpdatePayload, 'itemIds'>, successText: string) => {
    setBusy(true);
    try {
      const result = await bulkUpdateBooks({ itemIds: selectedIds, ...payload });
      // Пропущенные показываются числом: молча потерять часть выделения хуже, чем сказать о ней.
      message.success(
        result.skipped.length > 0
          ? `${successText}. Пропущено чужих записей: ${result.skipped.length}`
          : successText
      );
      await dispatch(loadBooks(filters)).unwrap();
      dispatch(loadTags({ force: true }));
      dispatch(loadShelves({ force: true }));
      onClearSelection();
      setTagNames([]);
    } catch (error) {
      showRequestError(error, 'Не удалось применить изменения');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        padding: '10px 16px',
        borderRadius: token.borderRadiusLG,
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`
      }}
    >
      <Typography.Text strong>
        {`Выбрано ${pluralize(selectedIds.length, ['запись', 'записи', 'записей'])}`}
      </Typography.Text>

      <Select
        placeholder="Проставить статус"
        style={{ minWidth: 180 }}
        value={null}
        disabled={busy}
        options={statusOptions.map((option) => ({ label: option.label, value: option.value }))}
        onChange={(status: ReadingStatus) => apply({ status }, 'Статус проставлен')}
      />

      <Space.Compact>
        <Select
          mode="tags"
          placeholder="Добавить теги"
          style={{ minWidth: 220 }}
          value={tagNames}
          onChange={setTagNames}
          disabled={busy}
          tokenSeparators={[',']}
          options={tags.map((tag) => ({ label: tag.name, value: tag.name }))}
        />
        <Button
          icon={<TagsOutlined />}
          disabled={busy || tagNames.length === 0}
          onClick={() => apply({ addTagNames: tagNames }, 'Теги добавлены')}
        >
          Применить
        </Button>
      </Space.Compact>

      <Select
        placeholder="На полку"
        style={{ minWidth: 180 }}
        value={null}
        disabled={busy || contributableShelves.length === 0}
        options={contributableShelves.map((shelf) => ({
          label: shelf.owned ? shelf.name : `${shelf.name} · @${shelf.ownerUsername}`,
          value: shelf.id
        }))}
        onChange={(addToShelfId: string) => apply({ addToShelfId }, 'Записи добавлены на полку')}
      />

      <Button disabled={busy} onClick={() => apply({ favorite: true }, 'Отмечено избранным')}>
        В избранное
      </Button>
      <Button disabled={busy} onClick={() => apply({ wishlist: true }, 'Добавлено в список желаемого')}>
        В желаемое
      </Button>

      {/* Снятие выделения ничего не портит и восстанавливается парой кликов — подтверждать нечего. */}
      <Button type="text" icon={<ClearOutlined />} disabled={busy} onClick={onClearSelection}>
        Снять выделение
      </Button>
    </div>
  );
};
