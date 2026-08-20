import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Input, Modal, Spin, Typography, theme } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { coverUrl, fetchBooks, searchQuotes } from '@/entities/book';
import { fetchAuthors } from '@/entities/author';
import { setFilters } from '@/features/book/set-book-filters';
import { useAppDispatch } from '@/shared/lib/hooks';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { statusMeta } from '@/shared/constants/status';
import { plural } from '@/shared/lib/plural';
import type { Author, LibraryItem, Quote } from '@/shared/types/library';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Найденную запись открывает оболочка: карточка живёт на уровне layout, а не страницы. */
  onPickBook: (item: LibraryItem) => void;
}

type Row =
  | { kind: 'book'; item: LibraryItem }
  | { kind: 'author'; item: Author }
  | { kind: 'quote'; item: Quote };

const MIN_QUERY = 2;
const PER_GROUP = 5;

const bookMeta = (item: LibraryItem) => {
  const parts: string[] = [];
  const authors = item.authors?.map((author) => author.name).join(', ');
  if (authors) parts.push(authors);
  const status = statusMeta[item.status]?.label;
  if (status) parts.push(status.toLowerCase());
  if (item.progress?.current && item.progress?.total) {
    parts.push(`${item.progress.current} / ${item.progress.total}`);
  }
  return parts.join(' · ');
};

/**
 * Поиск по всей библиотеке с любой страницы.
 *
 * Раньше поиск жил только внутри страницы «Библиотека» и искал одни названия: чтобы найти автора
 * или вспомнить выписку, надо было сначала попасть на нужную страницу. Здесь три группы сразу,
 * и открывается окно с любой страницы по ⌘K.
 */
export const GlobalSearchModal: React.FC<Props> = ({ open, onClose, onPickBook }) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState<LibraryItem[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(query.trim(), 300);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setBooks([]);
      setAuthors([]);
      setQuotes([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || debounced.length < MIN_QUERY) {
      setBooks([]);
      setAuthors([]);
      setQuotes([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    // Три запроса разом: ответ каждого приходит в свою группу, и медленная выписка
    // не задерживает записи.
    Promise.allSettled([
      fetchBooks({ q: debounced, size: PER_GROUP, page: 0 }),
      fetchAuthors(debounced),
      searchQuotes(debounced)
    ])
      .then(([bookResult, authorResult, quoteResult]) => {
        if (cancelled) return;
        setBooks(bookResult.status === 'fulfilled' ? bookResult.value.content.slice(0, PER_GROUP) : []);
        setAuthors(authorResult.status === 'fulfilled' ? authorResult.value.slice(0, PER_GROUP) : []);
        setQuotes(quoteResult.status === 'fulfilled' ? quoteResult.value.slice(0, PER_GROUP) : []);
        setActive(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const rows = useMemo<Row[]>(
    () => [
      ...books.map((item) => ({ kind: 'book' as const, item })),
      ...authors.map((item) => ({ kind: 'author' as const, item })),
      ...quotes.map((item) => ({ kind: 'quote' as const, item }))
    ],
    [books, authors, quotes]
  );

  const openRow = (row: Row) => {
    onClose();
    if (row.kind === 'book') {
      onPickBook(row.item);
      return;
    }
    if (row.kind === 'author') {
      // Автор — это срез библиотеки: показываем его книги там, где с ними работают.
      dispatch(setFilters({ authorId: row.item.id, page: 0 }));
      navigate('/');
      return;
    }
    navigate(`/quotes?q=${encodeURIComponent(row.item.text.slice(0, 60))}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (rows.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % rows.length);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + rows.length) % rows.length);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      openRow(rows[active]);
    }
  };

  const headingStyle: React.CSSProperties = {
    padding: '10px 10px 4px',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary
  };

  const rowStyle = (index: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    minHeight: 44,
    padding: '6px 10px',
    borderRadius: 10,
    textAlign: 'left',
    ...(index === active ? { background: token.colorPrimaryBg } : null)
  });

  const renderRow = (row: Row, index: number) => {
    const key = `${row.kind}-${row.item.id}`;
    const common = {
      key,
      type: 'button' as const,
      className: 'app-shell-reset app-shell-hover',
      style: rowStyle(index),
      onMouseEnter: () => setActive(index),
      onClick: () => openRow(row)
    };

    if (row.kind === 'book') {
      return (
        <button {...common}>
          <CoverThumb
            src={row.item.hasCover ? coverUrl(row.item.id, row.item.updatedAt) : undefined}
            title={row.item.title}
            kind={row.item.kind}
            width={28}
            height={40}
            radius={6}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 500 }}>{row.item.title}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {bookMeta(row.item)}
            </Typography.Text>
          </span>
        </button>
      );
    }

    if (row.kind === 'author') {
      return (
        <button {...common}>
          <CoverThumb title={row.item.name} width={28} height={40} radius={6} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 500 }}>{row.item.name}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {`${row.item.itemCount} ${plural(row.item.itemCount, ['запись', 'записи', 'записей'])} в библиотеке`}
            </Typography.Text>
          </span>
        </button>
      );
    }

    return (
      <button {...common}>
        <CoverThumb title={row.item.itemTitle} width={28} height={40} radius={6} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <Typography.Paragraph style={{ margin: 0, fontWeight: 500 }} ellipsis={{ rows: 2 }}>
            {`«${row.item.text}»`}
          </Typography.Paragraph>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.item.itemTitle}
            {row.item.position ? ` · стр. ${row.item.position}` : ''}
          </Typography.Text>
        </span>
      </button>
    );
  };

  const groups: Array<{ label: string; rows: Row[] }> = [
    { label: 'Записи', rows: rows.filter((row) => row.kind === 'book') },
    { label: 'Авторы', rows: rows.filter((row) => row.kind === 'author') },
    { label: 'Выписки', rows: rows.filter((row) => row.kind === 'quote') }
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      destroyOnHidden
      width={640}
      // Окно поиска стоит вверху экрана, а не по центру: список результатов растёт вниз,
      // и центрированное окно прыгало бы при каждом наборе символа.
      style={{ top: 80, padding: 0 }}
      styles={{ body: { padding: 0 } }}
    >
      <div onKeyDown={onKeyDown}>
        <Input
          autoFocus
          size="large"
          variant="borderless"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          suffix={<span style={{ fontSize: 11, color: token.colorTextTertiary }}>Esc</span>}
          placeholder="Поиск по книгам, авторам, выпискам"
          aria-label="Поиск по библиотеке"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }} />

        <div ref={listRef} style={{ maxHeight: 420, overflowY: 'auto', padding: 8 }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}

          {!loading && debounced.length < MIN_QUERY && (
            <div style={{ padding: '18px 10px', color: token.colorTextTertiary }}>
              Название, автор или строка из выписки — от двух букв.
            </div>
          )}

          {!loading && debounced.length >= MIN_QUERY && rows.length === 0 && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`Ничего не нашлось по «${debounced}»`} />
          )}

          {!loading &&
            groups.map((group) =>
              group.rows.length === 0 ? null : (
                <div key={group.label}>
                  <div style={headingStyle}>{group.label}</div>
                  {group.rows.map((row) => renderRow(row, rows.indexOf(row)))}
                </div>
              )
            )}
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
            fontSize: 12,
            color: token.colorTextTertiary
          }}
        >
          ↑↓ — выбрать · Enter — открыть · Esc — закрыть
        </div>
      </div>
    </Modal>
  );
};
