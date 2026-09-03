import React, { useEffect, useState } from 'react';
import { Alert, Input, Modal, Skeleton, Typography } from 'antd';
import { BulkDeletePreview } from '@/shared/types/library';
import { previewBulkDelete } from '@/entities/book';
import { getErrorMessage } from '@/shared/lib/errors';
import { pluralize } from '@/shared/lib/plural';

interface Props {
  open: boolean;
  itemIds: string[];
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/** Слово-подтверждение: набрать его нельзя случайно, а «ОК» — можно. */
const CONFIRMATION = 'удалить';

/** «17 записей, у 4 из них 26 выписок, 12 заходов и 3 отзыва» — последствия, а не название. */
const consequences = (preview: BulkDeletePreview): string => {
  const parts: string[] = [];
  if (preview.quotes > 0) {
    parts.push(
      `у ${preview.itemsWithQuotes} из них ${pluralize(preview.quotes, ['выписка', 'выписки', 'выписок'])}`
    );
  }
  if (preview.sessions > 0) {
    parts.push(pluralize(preview.sessions, ['заход', 'захода', 'заходов']));
  }
  if (preview.reviews > 0) {
    parts.push(pluralize(preview.reviews, ['отзыв', 'отзыва', 'отзывов']));
  }
  return parts.length > 0
    ? `Вместе с записями исчезнут ${parts.join(', ')}. Восстановить их будет нечем.`
    : 'Прогресс и заметки этих записей исчезнут вместе с ними.';
};

/**
 * Удаление пачкой по макету `Dialogs.dc.html`.
 *
 * Заголовок говорит, что произойдёт, кнопка повторяет глагол заголовка, а необратимое действие
 * называет последствия числами и требует набрать слово. Раньше подтверждения показывали только
 * название записи — а вместе с записью удаляются выписки, которых человек не видит в списке.
 */
export const BulkDeleteModal: React.FC<Props> = ({ open, itemIds, onCancel, onConfirm }) => {
  const [preview, setPreview] = useState<BulkDeletePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setError(null);
    setWord('');
    let cancelled = false;
    previewBulkDelete(itemIds)
      .then((loaded) => {
        if (!cancelled) setPreview(loaded);
      })
      .catch((requestError) => {
        if (!cancelled) setError(getErrorMessage(requestError, 'Не удалось посчитать последствия'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, itemIds]);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={preview ? `Удалить ${pluralize(preview.items, ['запись', 'записи', 'записей'])}?` : 'Удалить записи?'}
      onCancel={onCancel}
      onOk={confirm}
      okText="Удалить"
      cancelText="Отмена"
      okButtonProps={{ danger: true, disabled: word.trim().toLowerCase() !== CONFIRMATION || !preview?.items }}
      confirmLoading={busy}
      destroyOnHidden
    >
      {error ? (
        <Alert type="error" showIcon message={error} />
      ) : !preview ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : (
        <>
          <Typography.Paragraph>{consequences(preview)}</Typography.Paragraph>
          {preview.skipped > 0 && (
            <Typography.Paragraph type="secondary">
              {`Чужие записи не удаляются: ${preview.skipped} из выделения останутся на месте.`}
            </Typography.Paragraph>
          )}
          <Typography.Text style={{ display: 'block', marginBottom: 6 }}>
            {`Введите ${CONFIRMATION} для подтверждения`}
          </Typography.Text>
          <Input
            autoFocus
            value={word}
            onChange={(event) => setWord(event.target.value)}
            placeholder={CONFIRMATION}
            aria-label="Слово для подтверждения"
          />
        </>
      )}
    </Modal>
  );
};
