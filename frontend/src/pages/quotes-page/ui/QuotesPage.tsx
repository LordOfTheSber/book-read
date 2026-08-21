import React, { useState } from 'react';
import { Empty, Input, List, Skeleton, Space, Typography, theme } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { BookOutlined } from '@ant-design/icons';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Quote } from '@/shared/types/library';
import { searchQuotes } from '@/entities/book';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';
import { DogEar } from '@/shared/ui/DogEar';

/** Экранирование для сборки регулярного выражения из пользовательского запроса. */
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Поиск по выпискам всей библиотеки. Цитату обычно помнят дословно, а книгу — нет,
 * поэтому вход здесь через текст, а не через карточку.
 */
export const QuotesPage: React.FC = () => {
  const { token } = theme.useToken();
  const showRequestError = useRequestError();
  /**
   * Запрос приходит и из адреса: поиск по ⌘K находит выписку на любой странице и приводит
   * сюда — со своим текстом, а не на пустое поле.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Адрес держит последний запрос: страницу с найденным можно переслать или обновить.
    setSearchParams(value ? { q: value } : {}, { replace: true });
  };

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

  /** Подсветка совпадения: без неё в длинной цитате непонятно, за что она нашлась. */
  const highlight = (text: string) => {
    const needle = debouncedQuery.trim();
    if (!needle) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === needle.toLowerCase() ? (
        <mark key={index} style={{ background: token.colorWarningBg, color: 'inherit', padding: '0 2px' }}>
          {part}
        </mark>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      )
    );
  };

  const subtitle = quotes.length
    ? `${pluralize(quotes.length, ['выписка', 'выписки', 'выписок'])} по запросу «${debouncedQuery.trim()}»`
    : 'Поиск по цитатам и пометкам всей библиотеки';

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <PageHeader title="Выписки" subtitle={subtitle} />

      <Input.Search
        allowClear
        size="large"
        placeholder="Например, «не отвечайте»"
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
      />

      {loading ? (
        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              style={{
                padding: 16,
                borderRadius: token.borderRadiusLG,
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`
              }}
            >
              <Skeleton active paragraph={{ rows: 2 }} title={false} />
            </div>
          ))}
        </Space>
      ) : (
        <List
          dataSource={quotes}
          split={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  query.trim()
                    ? 'Ничего не найдено — попробуйте другую формулировку'
                    : 'Введите запрос, чтобы искать по выпискам'
                }
              />
            )
          }}
          renderItem={(quote) => (
            <List.Item style={{ paddingInline: 0 }}>
              {/* Загнутый уголок — метка написанного человеком: выписку видно среди
                  системных карточек боковым зрением, без значка и подписи. */}
              <DogEar style={{ width: '100%' }}>
                <Typography.Paragraph
                  className="brand-display"
                  style={{
                    marginBottom: 12,
                    paddingInlineEnd: 20,
                    fontSize: 15,
                    fontStyle: 'italic',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {`«`}
                  {highlight(quote.text)}
                  {`»`}
                </Typography.Paragraph>
                <Space size={12} wrap>
                  <Space size={6}>
                    <BookOutlined style={{ color: token.colorTextTertiary }} />
                    <Typography.Text strong>{quote.itemTitle}</Typography.Text>
                  </Space>
                  {quote.position !== undefined && quote.position !== null && (
                    <Typography.Text type="secondary">{`с. ${quote.position}`}</Typography.Text>
                  )}
                  {quote.note && <Typography.Text type="secondary">{quote.note}</Typography.Text>}
                </Space>
              </DogEar>
            </List.Item>
          )}
        />
      )}
    </Space>
  );
};
