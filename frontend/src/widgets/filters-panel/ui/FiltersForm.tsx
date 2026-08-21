import React from 'react';
import { Col, Divider, Form, InputNumber, Row, Select, Space, Switch, Typography, theme } from 'antd';
import type { FormInstance } from 'antd';
import { useAppSelector } from '@/shared/lib/hooks';
import { statusOptions } from '@/shared/constants/status';
import { mediaKindOptionsWithIcon } from '@/shared/constants/mediaKind';
import { isAdminLike } from '@/shared/lib/roles';
import type { BookFilterState } from '@/features/book/set-book-filters';

interface FiltersFormValues {
  kind?: string;
  typeId?: string;
  authorId?: string;
  seriesId?: string;
  tagId?: string;
  shelfId?: string;
  status?: string;
  favorite?: boolean;
  wishlist?: boolean;
  minRating?: number;
  maxRating?: number;
  userId?: string;
}

/**
 * Чипы статуса вместо Segmented: подписи не обрезаются и переносятся по строкам.
 *
 * Каждый чип — настоящая кнопка-переключатель, а не span с обработчиком клика, каким был
 * CheckableTag: тот не попадал в обход по Tab и не отвечал на пробел с Enter, поэтому выбрать
 * статус с клавиатуры было нельзя. Оформление чипа всё равно задавалось здесь целиком.
 */
const StatusChips: React.FC<{ value?: string; onChange?: (value?: string) => void }> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const options = [{ label: 'Любой', value: '' }, ...statusOptions.map((s) => ({ label: s.label, value: s.value }))];

  return (
    <Space size={[8, 8]} wrap role="group" aria-label="Статус">
      {options.map((option) => {
        const checked = (value ?? '') === option.value;
        return (
          <button
            key={option.value || 'any'}
            type="button"
            aria-pressed={checked}
            onClick={() => onChange?.(option.value || undefined)}
            style={{
              font: 'inherit',
              fontSize: 14,
              lineHeight: 1.5,
              cursor: 'pointer',
              borderRadius: 999,
              paddingInline: 14,
              paddingBlock: 5,
              border: `1px solid ${checked ? 'transparent' : token.colorBorder}`,
              background: checked ? token.colorPrimary : 'transparent',
              color: checked ? token.colorTextLightSolid : token.colorText,
              transition: 'background .16s ease, border-color .16s ease'
            }}
          >
            {option.label}
          </button>
        );
      })}
    </Space>
  );
};

interface Props {
  form: FormInstance<FiltersFormValues>;
  /**
   * Панель применяет фильтры кнопкой, рельс — сразу по изменению: там кнопка «Применить»
   * стояла бы под каждым полем и всё время просилась бы нажать.
   */
  onValuesChange?: () => void;
  /**
   * Поля, которые в этом месте не нужны. В рельсе прячутся статус и полка: статус стоит
   * чипами над списком, полки — списком выше в самом рельсе, и второй раз спрашивать
   * то же самое значит показывать два разных ответа на один вопрос.
   */
  hide?: Array<'status' | 'shelfId'>;
}

/** Поля фильтра без обёртки: одни и те же и в панели справа, и в рельсе слева. */
export const FiltersForm: React.FC<Props> = ({ form, onValuesChange, hide = [] }) => {
  const bookTypes = useAppSelector((state) => state.bookTypes.list);
  const authors = useAppSelector((state) => state.authors.list);
  const series = useAppSelector((state) => state.series.list);
  const tags = useAppSelector((state) => state.tags.list);
  const shelves = useAppSelector((state) => state.shelves.list);
  const users = useAppSelector((state) => state.users.list);
  const usersLoading = useAppSelector((state) => state.users.loading);
  const role = useAppSelector((state) => state.auth.user?.role);
  const isAdmin = isAdminLike(role);

  return (
    <Form layout="vertical" form={form} onValuesChange={onValuesChange}>
      {!hide.includes('status') && (
        <Form.Item name="status" label="Статус">
          <StatusChips />
        </Form.Item>
      )}

      <Form.Item name="kind" label="Вид">
        {/* Со значками вид узнаётся так же, как в списке: подписи читать не нужно. */}
        <Select
          placeholder="Все виды"
          allowClear
          showSearch
          optionFilterProp="title"
          options={mediaKindOptionsWithIcon}
        />
      </Form.Item>

      <Form.Item name="typeId" label="Тип">
        <Select
          placeholder="Все типы"
          allowClear
          showSearch
          optionFilterProp="label"
          options={bookTypes.map((t) => ({ label: t.name, value: t.id }))}
        />
      </Form.Item>

      <Form.Item name="authorId" label="Автор">
        <Select
          placeholder="Все авторы"
          allowClear
          showSearch
          optionFilterProp="label"
          options={authors.map((author) => ({ label: author.name, value: author.id }))}
        />
      </Form.Item>

      <Form.Item name="seriesId" label="Серия">
        <Select
          placeholder="Все серии"
          allowClear
          showSearch
          optionFilterProp="label"
          options={series.map((item) => ({ label: item.name, value: item.id }))}
        />
      </Form.Item>

      {/* Тег — контекст в дополнение к типу-жанру, полка — набор, собранный руками. */}
      <Form.Item name="tagId" label="Тег">
        <Select
          placeholder="Все теги"
          allowClear
          showSearch
          optionFilterProp="label"
          options={tags.map((tag) => ({ label: `${tag.name} (${tag.itemCount})`, value: tag.id }))}
        />
      </Form.Item>

      {!hide.includes('shelfId') && (
        <Form.Item name="shelfId" label="Полка">
          <Select
            placeholder="Все полки"
            allowClear
            showSearch
            optionFilterProp="label"
            options={shelves.map((shelf) => ({ label: `${shelf.name} (${shelf.itemCount})`, value: shelf.id }))}
          />
        </Form.Item>
      )}

      <Divider style={{ margin: '8px 0 16px' }} />

      <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Оценка
      </Typography.Text>
      <Row gutter={8} style={{ marginTop: 8 }}>
        <Col span={12}>
          <Form.Item
            name="minRating"
            dependencies={['maxRating']}
            rules={[
              ({ getFieldValue }) => ({
                // Диапазон «от 9 до 3» молча возвращал пустую выдачу — теперь он не применяется.
                validator: (_, value) => {
                  const max = getFieldValue('maxRating');
                  return value === undefined || value === null || max === undefined || max === null || value <= max
                    ? Promise.resolve()
                    : Promise.reject(new Error('«От» больше, чем «до»'));
                }
              })
            ]}
          >
            {/* Подпись «Оценка» стоит над парой полей, к самим полям она не привязана:
                без aria-label диктор объявлял бы их безымянными. */}
            <InputNumber
              min={0}
              max={10}
              step={0.5}
              placeholder="от"
              aria-label="Оценка от"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxRating" dependencies={['minRating']}>
            <InputNumber
              min={0}
              max={10}
              step={0.5}
              placeholder="до"
              aria-label="Оценка до"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="favorite" label="Только избранное" valuePropName="checked" style={{ marginTop: 8 }}>
        <Switch />
      </Form.Item>

      {/* «В планах» и «надо купить» — разные вопросы, поэтому и фильтр отдельный. */}
      <Form.Item name="wishlist" label="Только список желаемого" valuePropName="checked">
        <Switch />
      </Form.Item>

      {isAdmin && (
        <Form.Item name="userId" label="Пользователь">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Все пользователи"
            loading={usersLoading}
            options={users.map((u) => ({ label: u.username, value: u.id }))}
          />
        </Form.Item>
      )}
    </Form>
  );
};

/** Состояние фильтров в значения формы: пустой статус — «любой», а не отсутствие поля. */
export const filtersToFormValues = (filters: BookFilterState): FiltersFormValues => ({
  kind: filters.kind,
  typeId: filters.typeId,
  authorId: filters.authorId,
  seriesId: filters.seriesId,
  tagId: filters.tagId,
  shelfId: filters.shelfId,
  status: filters.status ?? '',
  favorite: filters.favorite ?? false,
  wishlist: filters.wishlist ?? false,
  minRating: filters.minRating,
  maxRating: filters.maxRating,
  userId: filters.userId
});

/** И обратно: пустые значения убираем, иначе уедут в запрос как `status=`. */
export const formValuesToFilters = (values: FiltersFormValues): Partial<BookFilterState> => ({
  ...values,
  status: values.status || undefined,
  favorite: values.favorite || undefined,
  wishlist: values.wishlist || undefined,
  page: 0
});

export type { FiltersFormValues };
