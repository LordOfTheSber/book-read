import React, { useState } from 'react';
import { Card, Empty, Input, List, Space, Spin, Typography } from 'antd';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Quote } from '@/shared/types/library';
import { searchQuotes } from '@/entities/book';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { useRequestError } from '@/shared/lib/errors';

/**
 * Поиск по выпискам всей библиотеки. Цитату обычно помнят дословно, а книгу — нет,
 * поэтому вход здесь через текст, а не через карточку.
 */
export const QuotesPage: React.FC = () => {
  const showRequestError = useRequestError();
  const [query, setQuery] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);

  React.useEffect(() => {
    if (!debouncedQuery.trim()) {
      setQuotes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchQuotes(debouncedQuery)
      .then((found) => {
        if (!cancelled) setQuotes(found);
      })
      .catch((error) => showRequestError(error, 'Не удалось найти выписки'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <PageHeader title="Выписки" subtitle="Поиск по цитатам и пометкам всей библиотеки" />

      <Input.Search
        allowClear
        size="large"
        placeholder="Например, «не отвечайте»"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <Spin />
        </div>
      ) : (
        <List
          dataSource={quotes}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={query.trim() ? 'Ничего не найдено' : 'Введите запрос, чтобы искать по выпискам'}
              />
            )
          }}
          renderItem={(quote) => (
            <List.Item>
              <Card style={{ width: '100%' }} styles={{ body: { padding: 16 } }}>
                <Typography.Paragraph style={{ marginBottom: 8 }}>«{quote.text}»</Typography.Paragraph>
                <Space size={12} wrap>
                  <Typography.Text strong>{quote.itemTitle}</Typography.Text>
                  {quote.position !== undefined && quote.position !== null && (
                    <Typography.Text type="secondary">с. {quote.position}</Typography.Text>
                  )}
                  {quote.note && <Typography.Text type="secondary">{quote.note}</Typography.Text>}
                </Space>
              </Card>
            </List.Item>
          )}
        />
      )}
    </Space>
  );
};
