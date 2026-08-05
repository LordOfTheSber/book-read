import React, { useEffect, useState } from 'react';
import { App, Button, Space, Tooltip, Typography, Upload, theme } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
import { LibraryItem, MediaKind } from '@/shared/types/library';
import { coverUrl, deleteCover, uploadCover } from '@/entities/book';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { useRequestError } from '@/shared/lib/errors';

interface Props {
  /** null — книга ещё не сохранена: адреса обложки нет, показываем только заглушку. */
  item: LibraryItem | null;
  /** Название и вид берутся из формы: заглушка меняется вместе с вводом. */
  title: string;
  kind?: MediaKind;
}

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_WIDTH = 132;
const COVER_HEIGHT = 186;

/**
 * Обложка живёт вне карточки: она загружается и удаляется отдельными запросами, потому что
 * хранится в объектном хранилище, а не в БД. Поэтому и правится она только у сохранённой книги.
 * Место у неё первое: обложка — то, по чему запись узнают в списке.
 */
export const CoverField: React.FC<Props> = ({ item, title, kind }) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const showRequestError = useRequestError();
  const [hasCover, setHasCover] = useState(Boolean(item?.hasCover));
  const [version, setVersion] = useState(item?.updatedAt);
  const [busy, setBusy] = useState(false);

  // Панель переиспользуется под другую книгу без размонтирования: состояние обложки нужно сбросить.
  useEffect(() => {
    setHasCover(Boolean(item?.hasCover));
    setVersion(item?.updatedAt);
  }, [item?.id, item?.hasCover, item?.updatedAt]);

  const handleUpload = async (file: RcFile) => {
    if (!item) return Upload.LIST_IGNORE;
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
    if (!item) return;
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
    <div style={{ width: COVER_WIDTH, flexShrink: 0 }}>
      <CoverThumb
        src={item && hasCover ? coverUrl(item.id, version) : undefined}
        title={title || 'Без названия'}
        kind={kind}
        width={COVER_WIDTH}
        height={COVER_HEIGHT}
        radius={token.borderRadiusLG}
        style={{ border: `1px solid ${token.colorBorderSecondary}`, display: 'block' }}
      />

      {item ? (
        <Space size={4} style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
          <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={handleUpload}>
            <Tooltip title="PNG, JPEG или WEBP до 5 МБ">
              <Button size="small" icon={<UploadOutlined />} loading={busy}>
                {hasCover ? 'Заменить' : 'Загрузить'}
              </Button>
            </Tooltip>
          </Upload>
          {hasCover && (
            <Tooltip title="Удалить обложку">
              <Button
                size="small"
                danger
                type="text"
                icon={<DeleteOutlined />}
                onClick={handleDelete}
                loading={busy}
                aria-label="Удалить обложку"
              />
            </Tooltip>
          )}
        </Space>
      ) : (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12, textAlign: 'center' }}>
          Обложку можно загрузить после сохранения
        </Typography.Text>
      )}
    </div>
  );
};
