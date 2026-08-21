import React from 'react';
import { Button, Form, InputNumber, Select, Space, Typography, theme } from 'antd';
import { ExternalBook, MediaKind, ProgressUnit, ReadingStatus } from '@/shared/types/library';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { ChoiceChips } from '@/shared/ui/ChoiceChips';
import { statusOptions } from '@/shared/constants/status';
import { mediaKindOptionsWithIcon } from '@/shared/constants/mediaKind';
import {
  progressUnitLabel,
  progressUnitName,
  progressUnitOptions,
  resolveProgressUnit
} from '@/shared/constants/format';
import { describeExternal } from '../model/externalBook';

interface Props {
  book: ExternalBook;
  /** Полки, куда эту запись действительно дадут положить. На телефоне блока нет. */
  shelfOptions: Array<{ label: string; value: string }>;
  kind?: MediaKind;
  unit?: ProgressUnit;
  onEditDetails: () => void;
  isMobile: boolean;
}

/**
 * Порядок чипов свой, не как в фильтрах: у новой записи «В планах» — значение по умолчанию,
 * и стоять оно должно первым, а не последним в общем списке статусов.
 */
const ADD_STATUS_ORDER: ReadingStatus[] = ['PLANNED', 'READING', 'COMPLETED', 'ON_HOLD', 'DROPPED'];

const statusChipOptions = ADD_STATUS_ORDER.map((value) => ({
  label: statusOptions.find((option) => option.value === value)?.label ?? value,
  value
}));

/**
 * Второй шаг — подтверждение: статус, вид, объём и полка.
 *
 * Оценка, отзыв, заметка, цена, ISBN, шкаф и полка расположения здесь не спрашиваются: у книги,
 * которую ещё не начали, их просто нет. Всё это живёт в карточке записи.
 */
export const ConfirmStep: React.FC<Props> = ({ book, shelfOptions, kind, unit, onEditDetails, isMobile }) => {
  const { token } = theme.useToken();
  const effectiveUnit = resolveProgressUnit({ kind, progressUnit: unit });

  return (
    <Space direction="vertical" size={isMobile ? 16 : 20} style={{ display: 'flex' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <CoverThumb src={book.coverUrl} title={book.title} kind={kind} width={56} height={80} radius={8} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text strong style={{ display: 'block', fontSize: 16 }}>
            {book.title}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block' }}>
            {book.authorNames?.join(', ') || 'Автор не указан'}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {describeExternal(book)}
          </Typography.Text>
          {book.coverUrl && (
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
              обложка подтянется при сохранении
            </Typography.Text>
          )}
        </div>
      </div>

      <Form.Item name="status" label="Статус" style={{ marginBottom: 0 }}>
        <ChoiceChips options={statusChipOptions} ariaLabel="Статус" size={isMobile ? 'large' : 'default'} />
      </Form.Item>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Form.Item name="kind" label="Вид" style={{ flex: '1 1 180px', minWidth: 0, marginBottom: 0 }}>
          <Select options={mediaKindOptionsWithIcon} optionFilterProp="title" size={isMobile ? 'large' : 'middle'} />
        </Form.Item>
        <Form.Item
          name="progressTotal"
          label="Объём"
          style={{ flex: '1 1 120px', minWidth: 0, marginBottom: 0 }}
          tooltip="Шкала прогресса целиком: без неё не работают ни полоса, ни быстрые «+N»"
        >
          <InputNumber
            min={1}
            style={{ width: '100%' }}
            placeholder="400"
            suffix={progressUnitLabel[effectiveUnit]}
            size={isMobile ? 'large' : 'middle'}
          />
        </Form.Item>
        <Form.Item name="progressUnit" label="Единица" style={{ flex: '1 1 140px', minWidth: 0, marginBottom: 0 }}>
          <Select
            allowClear
            placeholder={progressUnitName[effectiveUnit]}
            options={progressUnitOptions}
            size={isMobile ? 'large' : 'middle'}
          />
        </Form.Item>
      </div>

      {/* Полки — только на широком экране: в макете телефона их на этом шаге нет. */}
      {!isMobile && (
        <Form.Item
          name="shelfIds"
          label="На полку — необязательно"
          style={{ marginBottom: 0 }}
          tooltip="Наборы, собранные вручную. Новую полку заводят на странице «Полки и теги»"
        >
          <Select
            mode="multiple"
            allowClear
            placeholder={shelfOptions.length ? 'Выбрать полку' : 'Полок пока нет'}
            options={shelfOptions}
            optionFilterProp="label"
            notFoundContent="Полки создаются на странице «Полки и теги»"
          />
        </Form.Item>
      )}

      <Button
        type="link"
        style={{ paddingInline: 0, alignSelf: 'flex-start', color: token.colorLink }}
        onClick={onEditDetails}
      >
        Поправить данные
      </Button>
    </Space>
  );
};
