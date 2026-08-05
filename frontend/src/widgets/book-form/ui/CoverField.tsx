import React, { useState } from 'react';
import { App, Button, Image, Space, Typography, Upload } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
import { LibraryItem } from '@/shared/types/library';
import { coverUrl, deleteCover, uploadCover } from '@/entities/book';
import { useRequestError } from '@/shared/lib/errors';

interface Props {
  item: LibraryItem;
}

const MAX_COVER_BYTES = 5 * 1024 * 1024;

/**
 * Обложка живёт вне карточки: она загружается и удаляется отдельными запросами, потому что
 * хранится в объектном хранилище, а не в БД. Поэтому и правится она только у сохранённой книги.
 */
export const CoverField: React.FC<Props> = ({ item }) => {
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [hasCover, setHasCover] = useState(item.hasCover);
  const [version, setVersion] = useState(item.updatedAt);
  const [busy, setBusy] = useState(false);

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
    <div style={{ marginTop: 8 }}>
      <Typography.Text strong>Обложка</Typography.Text>
      <Space align="start" style={{ display: 'flex', marginTop: 8 }}>
        {hasCover && (
          <Image src={coverUrl(item.id, version)} alt={`Обложка: ${item.title}`} width={96} style={{ borderRadius: 6 }} />
        )}
        <Space direction="vertical">
          <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={handleUpload}>
            <Button icon={<UploadOutlined />} loading={busy}>
              {hasCover ? 'Заменить' : 'Загрузить'}
            </Button>
          </Upload>
          {hasCover && (
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete} loading={busy}>
              Удалить
            </Button>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            PNG, JPEG или WEBP до 5 МБ
          </Typography.Text>
        </Space>
      </Space>
    </div>
  );
};
