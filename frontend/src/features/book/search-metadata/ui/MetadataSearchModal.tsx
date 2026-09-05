import React, { useState } from 'react';
import { Button, Empty, Input, List, Modal, Skeleton, Space, Tag, Tooltip, Typography, theme } from 'antd';
import { ScanOutlined } from '@ant-design/icons';
import { ExternalBook } from '@/shared/types/library';
import { searchMetadata } from '@/entities/metadata';
import { useRequestError } from '@/shared/lib/errors';
import { IsbnScannerModal, isBarcodeScanningSupported } from '@/features/book/scan-isbn';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Находка уходит в форму карточки: пользователь ещё может всё поправить до сохранения. */
  onPick: (book: ExternalBook) => void;
}

const providerLabel: Record<ExternalBook['provider'], string> = {
  OPEN_LIBRARY: 'Open Library',
  GOOGLE_BOOKS: 'Google Books'
};

/** Строка из одних цифр и дефисов — это ISBN, а не название: искать его надо по своему полю. */
const looksLikeIsbn = (value: string) => /^[\d\s-]{10,17}[\dXx]?$/.test(value.trim());

/**
 * Поиск по внешним каталогам. Самая окупаемая функция раздела 5: вручную библиотеку никто
 * заполнять не станет, а отсюда карточка собирается одним нажатием — вместе с обложкой.
 */
export const MetadataSearchModal: React.FC<Props> = ({ open, onClose, onPick }) => {
  const { token } = theme.useToken();
  const showRequestError = useRequestError();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExternalBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const runSearch = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    try {
      const found = await searchMetadata(
        looksLikeIsbn(trimmed) ? { isbn: trimmed.replace(/[\s-]/g, '') } : { q: trimmed }
      );
      setResults(found);
    } catch (error) {
      showRequestError(error, 'Не удалось поискать в каталогах');
    } finally {
      setLoading(false);
    }
  };

  const handleScanned = (isbn: string) => {
    setQuery(isbn);
    void runSearch(isbn);
  };

  const describe = (book: ExternalBook) =>
    [book.authorNames?.join(', '), book.publishedYear, book.publisher].filter(Boolean).join(' · ');

  return (
    <Modal
      title="Поиск по каталогам"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={720}
    >
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input.Search
            allowClear
            size="large"
            autoFocus
            placeholder="Название, автор или ISBN"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onSearch={runSearch}
            loading={loading}
            enterButton="Найти"
          />
          {/* Кнопка появляется только там, где сканирование вообще возможно. */}
          {isBarcodeScanningSupported() && (
            <Tooltip title="Сканировать ISBN камерой">
              <Button size="large" icon={<ScanOutlined />} onClick={() => setScannerOpen(true)} aria-label="Сканировать ISBN" />
            </Tooltip>
          )}
        </Space.Compact>

        {loading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <List
            dataSource={results}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={searched ? 'Каталоги ничего не нашли' : 'Введите запрос или отсканируйте ISBN'}
                />
              )
            }}
            renderItem={(book) => (
              <List.Item
                actions={[
                  <Button key="pick" type="primary" onClick={() => onPick(book)}>
                    Заполнить
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt=""
                        style={{ width: 44, height: 62, objectFit: 'cover', borderRadius: token.borderRadiusSM }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 62,
                          borderRadius: token.borderRadiusSM,
                          background: token.colorFillTertiary
                        }}
                      />
                    )
                  }
                  title={
                    <Space size={8} wrap>
                      <Typography.Text strong>{book.title}</Typography.Text>
                      <Tag bordered={false}>{providerLabel[book.provider]}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Typography.Text type="secondary">{describe(book)}</Typography.Text>
                      {book.isbn && <Typography.Text type="secondary">{`ISBN ${book.isbn}`}</Typography.Text>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Space>

      <IsbnScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanned} />
    </Modal>
  );
};
