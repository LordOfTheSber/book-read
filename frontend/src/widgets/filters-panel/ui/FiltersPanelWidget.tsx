import React, { useEffect } from 'react';
import { Button, Col, Divider, Drawer, Form, Grid, InputNumber, Row, Select, Space, Switch, Tag, Typography, theme } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { statusOptions } from '@/shared/constants/status';
import { mediaKindOptionsWithIcon } from '@/shared/constants/mediaKind';
import { resetFilters, setFilters } from '@/features/book/set-book-filters';
import { isAdminLike } from '@/shared/lib/roles';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FiltersFormValues {
  kind?: string;
  typeId?: string;
  authorId?: string;
  seriesId?: string;
  status?: string;
  favorite?: boolean;
  minRating?: number;
  maxRating?: number;
  userId?: string;
}

/** Чипы статуса вместо Segmented: подписи не обрезаются и переносятся по строкам. */
const StatusChips: React.FC<{ value?: string; onChange?: (value?: string) => void }> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const options = [{ label: 'Любой', value: '' }, ...statusOptions.map((s) => ({ label: s.label, value: s.value }))];

  return (
    <Space size={[8, 8]} wrap>
      {options.map((option) => {
        const checked = (value ?? '') === option.value;
        return (
          <Tag.CheckableTag
            key={option.value || 'any'}
            checked={checked}
            onChange={() => onChange?.(option.value || undefined)}
            style={{
              borderRadius: 999,
              paddingInline: 14,
              paddingBlock: 5,
              fontSize: 14,
              border: `1px solid ${checked ? 'transparent' : token.colorBorder}`,
              background: checked ? token.colorPrimary : 'transparent'
            }}
          >
            {option.label}
          </Tag.CheckableTag>
        );
      })}
    </Space>
  );
};

/**
 * Фильтры вынесены в drawer: они нужны эпизодически и не должны постоянно
 * отъедать треть ширины у списка книг.
 */
export const FiltersPanelWidget: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.bookFilters);
  const bookTypes = useAppSelector((state) => state.bookTypes.list);
  const authors = useAppSelector((state) => state.authors.list);
  const series = useAppSelector((state) => state.series.list);
  const users = useAppSelector((state) => state.users.list);
  const usersLoading = useAppSelector((state) => state.users.loading);
  const role = useAppSelector((state) => state.auth.user?.role);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm<FiltersFormValues>();
  const isAdmin = isAdminLike(role);

  // Drawer открывается с актуальным состоянием фильтров, а не с тем, что было.
  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        kind: filters.kind,
        typeId: filters.typeId,
        authorId: filters.authorId,
        seriesId: filters.seriesId,
        status: filters.status ?? '',
        favorite: filters.favorite ?? false,
        minRating: filters.minRating,
        maxRating: filters.maxRating,
        userId: filters.userId
      });
    }
  }, [open, filters, form]);

  const handleApply = async () => {
    // См. BookFormDrawer: отказ валидации нужно перехватить, иначе он всплывает необработанным.
    const values = await form.validateFields().catch(() => undefined);
    if (!values) {
      return;
    }
    dispatch(
      setFilters({
        ...values,
        // Пустые значения убираем из запроса, иначе уедут в URL как `status=`.
        status: values.status || undefined,
        favorite: values.favorite || undefined,
        page: 0
      })
    );
    onClose();
  };

  const handleReset = () => {
    form.resetFields();
    dispatch(resetFilters());
    onClose();
  };

  return (
    <Drawer
      title="Фильтры"
      placement="right"
      open={open}
      onClose={onClose}
      width={isMobile ? '100%' : 400}
      footer={
        <div style={{ display: 'flex', gap: 12, padding: '12px 24px' }}>
          <Button onClick={handleReset} block>
            Сбросить
          </Button>
          <Button type="primary" onClick={handleApply} block>
            Применить
          </Button>
        </div>
      }
    >
      <Form layout="vertical" form={form}>
        <Form.Item name="status" label="Статус">
          <StatusChips />
        </Form.Item>

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
              <InputNumber min={0} max={10} step={0.5} placeholder="от" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="maxRating" dependencies={['minRating']}>
              <InputNumber min={0} max={10} step={0.5} placeholder="до" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="favorite" label="Только избранное" valuePropName="checked" style={{ marginTop: 8 }}>
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
    </Drawer>
  );
};
