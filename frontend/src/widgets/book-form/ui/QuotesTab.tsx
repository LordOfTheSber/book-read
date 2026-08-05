import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Empty, Form, Input, InputNumber, List, Space, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { LibraryItem, Quote } from '@/shared/types/library';
import { addQuote, deleteQuote, fetchQuotes } from '@/entities/book';
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
  const showRequestError = useRequestError();
  const [form] = Form.useForm<QuoteFormValues>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        <Space align="end" wrap>
          <Form.Item name="position" label="Страница">
            <InputNumber min={0} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="note" label="Пометка" style={{ flex: 1, minWidth: 200 }}>
            <Input placeholder="Зачем запомнилось" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Добавить
            </Button>
          </Form.Item>
        </Space>
      </Form>

      <List
        loading={loading}
        dataSource={quotes}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Выписок пока нет" /> }}
        renderItem={(quote) => (
          <List.Item
            actions={[
              <Button
                key="delete"
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => remove(quote.id)}
                aria-label="Удалить выписку"
              />
            ]}
          >
            <List.Item.Meta
              title={
                <Typography.Paragraph style={{ marginBottom: 0 }}>«{quote.text}»</Typography.Paragraph>
              }
              description={
                <Space size={8} wrap>
                  {quote.position !== undefined && quote.position !== null && (
                    <Typography.Text type="secondary">с. {quote.position}</Typography.Text>
                  )}
                  {quote.note && <Typography.Text type="secondary">{quote.note}</Typography.Text>}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Space>
  );
};
