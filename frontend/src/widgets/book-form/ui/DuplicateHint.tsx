import React, { useEffect, useState } from 'react';
import { Alert, Space, Typography } from 'antd';
import { DuplicateCandidate } from '@/shared/types/library';
import { findDuplicates } from '@/entities/book';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';

interface Props {
  title?: string;
  isbn?: string;
  /** Идентификатор правимой записи: сама себе она, разумеется, не дубль. */
  excludeId?: string;
}

const reasonLabel: Record<DuplicateCandidate['reason'], string> = {
  ISBN: 'тот же ISBN',
  TITLE: 'похожее название'
};

/**
 * Подсказка «такое уже есть». Не запрет: второе издание, другой перевод и подарочный экземпляр —
 * законные поводы завести вторую запись, поэтому решает пользователь.
 */
export const DuplicateHint: React.FC<Props> = ({ title, isbn, excludeId }) => {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  // Запрос на каждое нажатие клавиши в поле названия — это запрос на каждую букву.
  const debouncedTitle = useDebouncedValue(title ?? '', 500);
  const debouncedIsbn = useDebouncedValue(isbn ?? '', 500);

  useEffect(() => {
    const trimmedTitle = debouncedTitle.trim();
    const trimmedIsbn = debouncedIsbn.trim();
    // По двум буквам совпадёт половина библиотеки — подсказка начинается с осмысленного ввода.
    if (trimmedTitle.length < 3 && trimmedIsbn.length < 10) {
      setCandidates([]);
      return;
    }

    let cancelled = false;
    findDuplicates({ title: trimmedTitle || undefined, isbn: trimmedIsbn || undefined })
      .then((found) => {
        if (!cancelled) {
          setCandidates(found.filter((candidate) => candidate.id !== excludeId));
        }
      })
      // Отказ подсказки не должен мешать вводу: молча остаёмся без неё.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [debouncedTitle, debouncedIsbn, excludeId]);

  if (candidates.length === 0) {
    return null;
  }

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message="Похоже, такое уже есть в библиотеке"
      description={
        <Space direction="vertical" size={2}>
          {candidates.slice(0, 3).map((candidate) => (
            <Typography.Text key={candidate.id}>
              {`«${candidate.title}»`}
              {candidate.authorNames.length > 0 && ` — ${candidate.authorNames.join(', ')}`}
              <Typography.Text type="secondary">{` (${reasonLabel[candidate.reason]})`}</Typography.Text>
            </Typography.Text>
          ))}
        </Space>
      }
    />
  );
};
