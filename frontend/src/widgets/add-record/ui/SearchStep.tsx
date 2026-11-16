import React from 'react';
import { Button, Empty, Input, Skeleton, Space, Tooltip, Typography, theme } from 'antd';
import { ScanOutlined } from '@ant-design/icons';
import { ExternalBook } from '@/shared/types/library';
import { CoverThumb } from '@/shared/ui/CoverThumb';
import { describeExternal } from '../model/externalBook';

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (value: string) => void;
  loading: boolean;
  searched: boolean;
  results: ExternalBook[];
  onPick: (book: ExternalBook) => void;
  onManual: () => void;
  onScan: () => void;
  scannerSupported: boolean;
  isMobile: boolean;
}

/**
 * Первый шаг добавления — поиск, а не форма.
 *
 * Восемь полей карточки (название, автор, ISBN, год, язык, объём, издательство, обложка) уже
 * лежат в каталогах, к которым приложение подключено. Набирать их руками имело смысл ровно до
 * того, как появился этот поиск.
 */
export const SearchStep: React.FC<Props> = ({
  query,
  onQueryChange,
  onSearch,
  loading,
  searched,
  results,
  onPick,
  onManual,
  onScan,
  scannerSupported,
  isMobile
}) => {
  const { token } = theme.useToken();

  return (
    <Space direction="vertical" size={12} style={{ display: 'flex' }}>
      <Space.Compact style={{ width: '100%' }}>
        <Input.Search
          allowClear
          size="large"
          autoFocus={!isMobile}
          placeholder="Название, автор или ISBN"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onSearch={onSearch}
          loading={loading}
          enterButton="Найти"
        />
        {/* Кнопка появляется только там, где сканирование вообще возможно. */}
        {scannerSupported && (
          <Tooltip title="Сканировать ISBN камерой">
            <Button size="large" icon={<ScanOutlined />} onClick={onScan} aria-label="Сканировать ISBN" />
          </Tooltip>
        )}
      </Space.Compact>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {scannerSupported
          ? 'Название, автор или ISBN. Значок справа открывает камеру и читает штрихкод.'
          : 'Название, автор или ISBN. Поиск идёт по Open Library и Google Books.'}
      </Typography.Text>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : results.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={searched ? 'Каталоги ничего не нашли' : 'Введите запрос или отсканируйте ISBN'}
        />
      ) : (
        <div>
          {results.map((book, index) => (
            <div
              key={`${book.provider}-${book.externalId ?? index}-${book.title}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: isMobile ? '10px 8px' : 10,
                minHeight: isMobile ? 44 : undefined,
                borderRadius: 12
              }}
            >
              <CoverThumb
                src={book.coverUrl}
                title={book.title}
                width={isMobile ? 44 : 40}
                height={isMobile ? 62 : 58}
                radius={8}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text strong ellipsis={{ tooltip: book.title }} style={{ display: 'block' }}>
                  {book.title}
                </Typography.Text>
                <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
                  {book.authorNames?.join(', ') || 'Автор не указан'}
                </Typography.Text>
                <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
                  {describeExternal(book)}
                </Typography.Text>
              </div>
              <Button
                type={index === 0 ? 'primary' : 'default'}
                onClick={() => onPick(book)}
                style={{ flexShrink: 0, minHeight: isMobile ? 44 : undefined }}
              >
                Выбрать
              </Button>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          paddingTop: 12
        }}
      >
        <Button type="link" style={{ paddingInline: 0 }} onClick={onManual}>
          Не нашлось? Завести вручную
        </Button>
        {results.length > 0 && !isMobile && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Enter — выбрать первое
          </Typography.Text>
        )}
      </div>
    </Space>
  );
};
