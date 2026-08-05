import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Col, Empty, Form, Input, InputNumber, List, Row, Space, Tooltip, Typography, theme } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { LibraryItem, Quote } from '@/shared/types/library';
import { addQuote, deleteQuote, fetchQuotes } from '@/entities/book';
import { progressPositionLabel, progressUnitLabel, resolveProgressUnit } from '@/shared/constants/format';
import { useRequestError } from '@/shared/lib/errors';

interface Props {
  item: LibraryItem;
}

interface QuoteFormValues {
  position?: number;
  text: string;
  note?: string;
}

/** Выписки одного произведения: цитата с номером страницы и личной пометкой. */
export const QuotesTab: React.FC<Props> = ({ item }) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const showRequestError = useRequestError();
  const [form] = Form.useForm<QuoteFormValues>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // У сериала цитату привязывают к эпизоду, у аудиокниги — к минуте: подпись идёт от единицы.
  const unitKey = resolveProgressUnit(item);
  const positionLabel = progressPositionLabel[unitKey];
  const unitShort = progressUnitLabel[unitKey];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQuotes(await fetchQuotes(item.id));
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить выписки');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (values: QuoteFormValues) => {
    setSaving(true);
    try {
      await addQuote(item.id, values);
      form.resetFields();
      message.success('Выписка добавлена');
      await load();
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить выписку');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (quoteId: string) => {
    try {
      await deleteQuote(item.id, quoteId);
      await load();
    } catch (error) {
      showRequestError(error, 'Не удалось удалить выписку');
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="text" label="Цитата" rules={[{ required: true, message: 'Текст обязателен' }]}>
          <Input.TextArea rows={3} placeholder="Не отвечайте! Не отвечайте! Не отвечайте!" />
        </Form.Item>
        {/* Раньше строка собиралась из Space: он оборачивает детей в блоки, и «Пометка» не тянулась. */}
        <Row gutter={[12, 0]} align="bottom">
          <Col xs={10} sm={6}>
            <Form.Item name="position" label={`Номер ${positionLabel}`} style={{ marginBottom: 0 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="128" />
            </Form.Item>
          </Col>
          <Col xs={14} sm={12}>
            <Form.Item name="note" label="Пометка" style={{ marginBottom: 0 }}>
              <Input placeholder="Зачем запомнилось" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Form.Item style={{ marginBottom: 0, marginTop: 12 }}>
              <Button type="primary" htmlType="submit" loading={saving} block>
                Добавить
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <List
        loading={loading}
        dataSource={quotes}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Выписок пока нет — сохраните первую цитату" />
          )
        }}
        renderItem={(quote) => (
          <List.Item
            actions={[
              <Tooltip key="delete" title="Удалить выписку">
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(quote.id)}
                  aria-label="Удалить выписку"
                />
              </Tooltip>
            ]}
          >
            <div style={{ minWidth: 0 }}>
              {/* Вертикальная линия слева — обычный типографский признак цитаты. */}
              <Typography.Paragraph
                style={{
                  marginBottom: quote.position || quote.note ? 8 : 0,
                  paddingInlineStart: 12,
                  borderInlineStart: `3px solid ${token.colorBorder}`,
                  fontStyle: 'italic',
                  whiteSpace: 'pre-line'
                }}
              >
                {quote.text}
              </Typography.Paragraph>
              <Space size={12} wrap style={{ paddingInlineStart: 15 }}>
                {quote.position !== undefined && quote.position !== null && (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {`${unitShort} ${quote.position}`}
                  </Typography.Text>
                )}
                {quote.note && (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {quote.note}
                  </Typography.Text>
                )}
              </Space>
            </div>
          </List.Item>
        )}
      />
    </Space>
  );
};
