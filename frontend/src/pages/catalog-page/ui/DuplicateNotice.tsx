import React from 'react';
import { Alert, Button, Space } from 'antd';
import { plural } from '@/shared/lib/plural';
import type { DuplicatePair } from '../model';

interface Props {
  pair: DuplicatePair;
  canMerge: boolean;
  merging: boolean;
  onShow: () => void;
  onMerge: () => void;
}

const books = (count: number) => `${count} ${plural(count, ['книга', 'книги', 'книг'])}`;

/**
 * Подсказка про дубли из макета `Catalog1`.
 *
 * Справочник авторов пополняется сам, когда имя вписывают в карточку книги, — поэтому один
 * человек заводится дважды («Лю Цысинь» и «Cixin Liu»), и увидеть это можно, только пролистав
 * две сотни строк. Пара показывается по одной: список предупреждений люди не читают.
 */
export const DuplicateNotice: React.FC<Props> = ({ pair, canMerge, merging, onShow, onMerge }) => (
  <Alert
    type="warning"
    showIcon
    style={{ marginBottom: 14 }}
    message={
      <>
        Похоже на дубли: «{pair.keep.name}» и «{pair.merge.name}» — {books(pair.keep.itemCount)} и{' '}
        {books(pair.merge.itemCount)}. Объединить в одного автора?
      </>
    }
    action={
      <Space size={8}>
        <Button size="small" onClick={onShow}>
          Посмотреть
        </Button>
        {canMerge && (
          <Button size="small" type="primary" loading={merging} onClick={onMerge}>
            Объединить
          </Button>
        )}
      </Space>
    }
  />
);
