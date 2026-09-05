import React, { useEffect, useState } from 'react';
import { App, Button, Space, Tooltip, Upload, theme } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { LibraryItem, MediaKind } from '@/shared/types/library';
import { coverUrl, deleteCover, uploadCover } from '@/entities/book';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { useRequestError } from '@/shared/lib/errors';

interface Props {
  item: LibraryItem;
  /** Название и вид берутся из формы: заглушка меняется вместе с вводом. */
  title: string;
  kind?: MediaKind;
  /**
   * Узкий экран: обложка становится боковой, а не во всю ширину карточки. Во всю ширину она
   * на 390 px занимает почти весь экран, и до названия записи приходится прокручивать.
   */
  compact?: boolean;
}

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_HEIGHT = 366;
const COMPACT_WIDTH = 120;
const COMPACT_HEIGHT = 170;

/**
 * Обложка живёт вне карточки: она загружается и удаляется отдельными запросами, потому что
 * хранится в объектном хранилище, а не в БД. Место у неё первое: обложка — то, по чему запись
 * узнают в списке.
 */
export const CoverField: React.FC<Props> = ({ item, title, kind, compact }) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const showRequestError = useRequestError();
  const [hasCover, setHasCover] = useState(Boolean(item.hasCover));
  const [version, setVersion] = useState(item.updatedAt);
  const [busy, setBusy] = useState(false);

  // Страница переиспользуется под другую запись без размонтирования: состояние обложки сбрасываем.
  useEffect(() => {
    setHasCover(Boolean(item.hasCover));
    setVersion(item.updatedAt);
  }, [item.id, item.hasCover, item.updatedAt]);

  const handleUpload = async (file: RcFile) => {
    if (file.size > MAX_COVER_BYTES) {
      message.error('Обложка должна быть меньше 5 МБ');
      return Upload.LIST_IGNORE;
    }
    setBusy(true);
    try {
      const updated = await uploadCover(item.id, file);
      setHasCover(updated.hasCover);
      // Адрес обложки не меняется, поэтому браузеру нужна новая метка версии.
      setVersion(updated.updatedAt);
      message.success('Обложка обновлена');
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить обложку');
    } finally {
      setBusy(false);
    }
    // Загрузку выполняем сами, встроенному загрузчику отдавать нечего.
    return Upload.LIST_IGNORE;
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteCover(item.id);
      setHasCover(false);
      message.success('Обложка удалена');
    } catch (error) {
      showRequestError(error, 'Не удалось удалить обложку');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={compact ? { display: 'flex', gap: 14, alignItems: 'flex-start' } : undefined}>
      <CoverThumb
        src={hasCover ? coverUrl(item.id, version) : undefined}
        title={title || 'Без названия'}
        kind={kind}
        width={compact ? COMPACT_WIDTH : '100%'}
        height={compact ? COMPACT_HEIGHT : COVER_HEIGHT}
        radius={token.borderRadiusLG}
        progressPercent={item.progress?.percent ?? undefined}
        style={{ display: 'block', flexShrink: 0 }}
      />

      <Space
        size={8}
        direction={compact ? 'vertical' : 'horizontal'}
        style={{ marginTop: compact ? 0 : 12, width: '100%' }}
      >
        <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={handleUpload}>
          <Tooltip title="PNG, JPEG или WEBP до 5 МБ">
            <Button icon={<UploadOutlined />} loading={busy}>
              {hasCover ? 'Заменить' : 'Загрузить'}
            </Button>
          </Tooltip>
        </Upload>
        {hasCover && (
          <Tooltip title="Удалить обложку">
            <Button icon={<DeleteOutlined />} onClick={handleDelete} loading={busy} aria-label="Удалить обложку" />
          </Tooltip>
        )}
      </Space>
    </div>
  );
};
