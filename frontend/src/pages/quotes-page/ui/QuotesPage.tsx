import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Grid,
  Input,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tooltip,
  Typography,
  theme
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Quote } from '@/shared/types/library';
import { deleteQuote, searchQuotes } from '@/entities/book';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { formatRelative } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';
import { DogEar } from '@/shared/ui/DogEar';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { useQuotesPageStyles } from './QuotesPage.styles';

/** Экранирование для сборки регулярного выражения из пользовательского запроса. */
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type ViewMode = 'wall' | 'books';

/** Книга в левой колонке: собирается из самих выписок, отдельного запроса на это не нужно. */
interface QuoteBook {
  id: string;
  title: string;
  authors: string;
  count: number;
  lastAt: string;
}

/**
 * Выписки: стеной и по книгам (`Quotes1.dc.html`, `Quotes2.dc.html`).
 *
 * Страница начиналась с пустого поля поиска: без запроса не показывалось ничего, хотя выписки —
 * это то, что перечитывают просто так. Теперь они видны сразу кладкой разной высоты, а поиск
 * и фильтр по книге стоят сверху.
 *
 * Второй режим остаётся потому, что вопросы разные: «где-то было про страх» — это поиск по всей
 * стене, а «перечитать перед отзывом» — это одна книга целиком, по страницам.
 */
export const QuotesPage: React.FC = () => {
  const { token } = theme.useToken();
  const styles = useQuotesPageStyles();
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  /**
   * Запрос приходит и из адреса: поиск по ⌘K находит выписку на любой странице и приводит
   * сюда — со своим текстом, а не на пустое поле.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('wall');
  const [bookFilter, setBookFilter] = useState<string>();
  const [newestFirst, setNewestFirst] = useState(true);
  /** Поиск по левой колонке: он ищет книгу, а не текст цитаты, поэтому отдельный. */
  const [bookQuery, setBookQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<string>();
  const debouncedQuery = useDebouncedValue(query, 300);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Адрес держит последний запрос: страницу с найденным можно переслать или обновить.
    setSearchParams(value ? { q: value } : {}, { replace: true });
  };

  const load = useCallback(
    (search: string) => {
      let cancelled = false;
      setLoading(true);
      searchQuotes(search.trim() || undefined)
        .then((found) => {
          if (!cancelled) setQuotes(found);
        })
        .catch((error) => showRequestError(error, 'Не удалось загрузить выписки'))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => load(debouncedQuery), [debouncedQuery, load]);

  /** Книги с числом выписок: и левая колонка, и выпадающий фильтр стены — один и тот же список. */
  const books = useMemo((): QuoteBook[] => {
    const byId = new Map<string, QuoteBook>();
    quotes.forEach((quote) => {
      const existing = byId.get(quote.itemId);
      const createdAt = quote.createdAt ?? '';
      if (existing) {
        existing.count += 1;
        existing.lastAt = existing.lastAt > createdAt ? existing.lastAt : createdAt;
        return;
      }
      byId.set(quote.itemId, {
        id: quote.itemId,
        title: quote.itemTitle,
        authors: (quote.itemAuthorNames ?? []).join(', '),
        count: 1,
        lastAt: createdAt
      });
    });
    return [...byId.values()].sort((a, b) => b.count - a.count);
  }, [quotes]);

  /** Выбранная книга держится, пока она есть в выдаче: после поиска состав книг меняется. */
  const activeBook = useMemo(
    () => books.find((book) => book.id === selectedBook) ?? books[0],
    [books, selectedBook]
  );

  const visible = useMemo(() => {
    const filtered =
      view === 'books'
        ? quotes.filter((quote) => quote.itemId === activeBook?.id)
        : quotes.filter((quote) => !bookFilter || quote.itemId === bookFilter);

    if (view === 'books') {
      // Внутри книги порядок задаёт не дата, а страница: выписки перечитывают по ходу книги.
      return [...filtered].sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
    }
    return [...filtered].sort((a, b) =>
      newestFirst ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '') : (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    );
  }, [quotes, view, activeBook, bookFilter, newestFirst]);

  const matchingBooks = useMemo(() => {
    const needle = bookQuery.trim().toLowerCase();
    if (!needle) return books;
    return books.filter(
      (book) => book.title.toLowerCase().includes(needle) || book.authors.toLowerCase().includes(needle)
    );
  }, [books, bookQuery]);

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

  const openRecord = (itemId: string) => navigate(`/library/${itemId}?tab=quotes`);

  const confirmDelete = (quote: Quote) => {
    modal.confirm({
      title: 'Удалить выписку?',
      content: 'Цитата исчезнет из книги и из этого списка; сама запись останется.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await deleteQuote(quote.itemId, quote.id);
          setQuotes((current) => current.filter((item) => item.id !== quote.id));
          message.success('Выписка удалена');
        } catch (error) {
          showRequestError(error, 'Не удалось удалить выписку');
        }
      }
    });
  };

  const quoteMenu = (quote: Quote) => ({
    items: [
      { key: 'open', label: 'Открыть в карточке', onClick: () => openRecord(quote.itemId) },
      { key: 'delete', label: 'Удалить', danger: true, onClick: () => confirmDelete(quote) }
    ]
  });

  const subtitle = debouncedQuery.trim()
    ? `${pluralize(quotes.length, ['выписка', 'выписки', 'выписок'])} по запросу «${debouncedQuery.trim()}»`
    : `${pluralize(quotes.length, ['выписка', 'выписки', 'выписок'])} из ${pluralize(books.length, [
        'книги',
        'книг',
        'книг'
      ])}`;

  const emptyText = debouncedQuery.trim()
    ? 'Ничего не найдено — попробуйте другую формулировку'
    : 'Выписок пока нет. Они заводятся в карточке записи, на вкладке «Выписки»';

  return (
    <div>
      <PageHeader
        title="Выписки"
        subtitle={subtitle}
        actions={
          <Segmented
            value={view}
            onChange={(value) => setView(value as ViewMode)}
            options={[
              { label: 'Стеной', value: 'wall' },
              { label: 'По книгам', value: 'books' }
            ]}
          />
        }
      />

      {view === 'wall' && (
        <div style={styles.toolbar}>
          <Input
            allowClear
            size="large"
            style={styles.search}
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            placeholder="Искать по тексту выписок и пометкам"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
          />
          <Select
            allowClear
            size="large"
            style={{ minWidth: 200 }}
            placeholder="Все книги"
            value={bookFilter}
            onChange={setBookFilter}
            options={books.map((book) => ({ label: `${book.title} · ${book.count}`, value: book.id }))}
          />
          <Select
            size="large"
            style={{ minWidth: 170 }}
            value={newestFirst ? 'new' : 'old'}
            onChange={(value) => setNewestFirst(value === 'new')}
            options={[
              { label: 'Сначала новые', value: 'new' },
              { label: 'Сначала старые', value: 'old' }
            ]}
          />
        </div>
      )}

      {loading ? (
        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} size="small">
              <Skeleton active paragraph={{ rows: 2 }} title={false} />
            </Card>
          ))}
        </Space>
      ) : quotes.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      ) : view === 'wall' ? (
        <div style={styles.wall}>
          {visible.map((quote) => (
            <div key={quote.id} style={styles.wallCard}>
              {/* Загнутый уголок — метка написанного человеком: выписку видно среди
                  системных карточек боковым зрением, без значка и подписи. */}
              <DogEar>
                <Typography.Paragraph className="brand-display" style={styles.quoteText}>
                  {'«'}
                  {highlight(quote.text)}
                  {'»'}
                </Typography.Paragraph>
                {quote.note && (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
                    {highlight(quote.note)}
                  </Typography.Paragraph>
                )}
                <div style={styles.quoteFooter}>
                  <CoverThumb title={quote.itemTitle} width={30} height={44} radius={6} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Link
                      onClick={() => openRecord(quote.itemId)}
                      style={{ display: 'block', fontSize: 13, fontWeight: 500 }}
                      ellipsis
                    >
                      {quote.itemTitle}
                    </Typography.Link>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {[
                        quote.position != null ? `стр. ${quote.position}` : 'пометка',
                        formatRelative(quote.createdAt)
                      ].join(' · ')}
                    </Typography.Text>
                  </span>
                  <Dropdown menu={quoteMenu(quote)} trigger={['click']}>
                    <Button type="text" size="small" icon={<MoreOutlined />} aria-label="Действия с выпиской" />
                  </Dropdown>
                </div>
              </DogEar>
            </div>
          ))}
        </div>
      ) : (
        <div style={screens.lg ? styles.byBook : styles.byBookNarrow}>
          <Card style={styles.booksCard} styles={{ body: styles.booksBody }}>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder="Книга или автор"
              value={bookQuery}
              onChange={(event) => setBookQuery(event.target.value)}
              style={{ marginBottom: 10 }}
            />
            {matchingBooks.map((book) => {
              const active = book.id === activeBook?.id;
              return (
                <button
                  key={book.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedBook(book.id)}
                  style={styles.bookRow(active)}
                >
                  <CoverThumb title={book.title} width={30} height={44} radius={6} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text strong style={{ display: 'block', fontSize: 13 }} ellipsis>
                      {book.title}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                      {book.authors || 'автор не указан'}
                    </Typography.Text>
                  </span>
                  <span style={styles.bookCount(active)}>{book.count}</span>
                </button>
              );
            })}
            {matchingBooks.length === 0 && (
              <Typography.Text type="secondary" style={{ display: 'block', padding: '8px 10px' }}>
                Таких книг среди выписок нет
              </Typography.Text>
            )}
          </Card>

          <div style={{ minWidth: 0 }}>
            {activeBook && (
              <Card style={styles.bookHeader} styles={{ body: styles.bookHeaderBody }}>
                <CoverThumb title={activeBook.title} width={64} height={90} />
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <Typography.Title level={3} style={{ margin: 0, fontSize: 18 }}>
                    {activeBook.title}
                  </Typography.Title>
                  <Typography.Text type="secondary" style={{ display: 'block', marginTop: 3, fontSize: 13 }}>
                    {activeBook.authors || 'автор не указан'}
                  </Typography.Text>
                  <Space size={8} wrap style={{ marginTop: 10 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {pluralize(activeBook.count, ['выписка', 'выписки', 'выписок'])}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {`последняя ${formatRelative(activeBook.lastAt)}`}
                    </Typography.Text>
                  </Space>
                </div>
                <Space size={8} wrap>
                  <Button onClick={() => navigate(`/library/${activeBook.id}`)}>Открыть карточку</Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openRecord(activeBook.id)}>
                    Выписка
                  </Button>
                </Space>
              </Card>
            )}

            {visible.map((quote) => (
              <div key={quote.id} style={styles.quoteRow}>
                <span style={styles.page}>{quote.position != null ? `стр. ${quote.position}` : 'пометка'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Paragraph className="brand-display" style={styles.quoteBar}>
                    {'«'}
                    {highlight(quote.text)}
                    {'»'}
                  </Typography.Paragraph>
                  {quote.note && (
                    <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
                      {highlight(quote.note)}
                    </Typography.Paragraph>
                  )}
                </span>
                <Space size={0}>
                  <Tooltip title="Править в карточке">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      aria-label={`Править выписку из «${quote.itemTitle}»`}
                      onClick={() => openRecord(quote.itemId)}
                    />
                  </Tooltip>
                  <Tooltip title="Удалить">
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      aria-label={`Удалить выписку из «${quote.itemTitle}»`}
                      onClick={() => confirmDelete(quote)}
                    />
                  </Tooltip>
                </Space>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
