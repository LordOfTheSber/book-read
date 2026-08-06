import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Radio,
  Result,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { RcFile } from 'antd/es/upload';
import { InboxOutlined } from '@ant-design/icons';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ImportPreview, ImportResultSummary, ImportRow } from '@/shared/types/library';
import { commitImport, previewImport } from '@/entities/import';
import { loadShelves } from '@/entities/shelf';
import { loadTags } from '@/entities/tag';
import { loadBooks } from '@/entities/book';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { getStatusLabel } from '@/shared/constants/status';
import { useRequestError } from '@/shared/lib/errors';

const sourceLabel: Record<ImportPreview['detectedSource'], string> = {
  GOODREADS: 'Goodreads',
  STORYGRAPH: 'StoryGraph',
  LIVELIB: 'LiveLib',
  GENERIC: 'неизвестный формат'
};

/**
 * Импорт своей библиотеки из чужого сервиса. Два шага: разбор ничего не пишет в базу и показывает,
 * что получилось, — потому что чужая выгрузка почти всегда требует правки, а повторный импорт
 * того же файла не должен удваивать библиотеку.
 */
export const ImportPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const shelves = useAppSelector((state) => state.shelves.list);
  const tags = useAppSelector((state) => state.tags.list);
  const filters = useAppSelector((state) => state.bookFilters);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'SKIP' | 'IMPORT_ANYWAY'>('SKIP');
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [shelfId, setShelfId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResultSummary | null>(null);

  useEffect(() => {
    dispatch(loadShelves());
    dispatch(loadTags());
  }, [dispatch]);

  const handleFile = async (file: RcFile) => {
    setBusy(true);
    setResult(null);
    try {
      const parsed = await previewImport(file);
      setPreview(parsed);
      // По умолчанию отмечено всё, что вообще можно завести: снять лишнее проще, чем отметить всё.
      setSelectedLines(parsed.rows.filter((row) => row.errors.length === 0).map((row) => row.line));
      setTagNames([`импорт ${sourceLabel[parsed.detectedSource]}`]);
    } catch (error) {
      showRequestError(error, 'Не удалось разобрать файл');
    } finally {
      setBusy(false);
    }
    // Файл отправляем сами, встроенному загрузчику отдавать нечего.
    return Upload.LIST_IGNORE;
  };

  const selectedRows = useMemo(
    () => (preview?.rows ?? []).filter((row) => selectedLines.includes(row.line)),
    [preview, selectedLines]
  );

  const handleCommit = async () => {
    if (selectedRows.length === 0) {
      message.warning('Не выбрано ни одной строки');
      return;
    }
    setBusy(true);
    try {
      const summary = await commitImport({
        rows: selectedRows,
        tagNames: tagNames.length > 0 ? tagNames : undefined,
        shelfId,
        duplicateStrategy
      });
      setResult(summary);
      setPreview(null);
      setSelectedLines([]);
      dispatch(loadTags({ force: true }));
      dispatch(loadShelves({ force: true }));
      dispatch(loadBooks(filters));
    } catch (error) {
      showRequestError(error, 'Не удалось завершить импорт');
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnsType<ImportRow> = [
    {
      title: 'Строка',
      dataIndex: 'line',
      width: 80
    },
    {
      title: 'Произведение',
      dataIndex: 'title',
      render: (title: string | undefined, row) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{title || '—'}</Typography.Text>
          {row.authorNames && row.authorNames.length > 0 && (
            <Typography.Text type="secondary">{row.authorNames.join(', ')}</Typography.Text>
          )}
          {row.errors.length > 0 && <Typography.Text type="danger">{row.errors.join('; ')}</Typography.Text>}
        </Space>
      )
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 130,
      render: (status?: string) => (status ? getStatusLabel(status) : '—')
    },
    {
      title: 'Оценка',
      dataIndex: 'rating',
      width: 90,
      render: (rating?: number) => rating ?? '—'
    },
    {
      title: 'Дубли',
      dataIndex: 'duplicates',
      width: 220,
      render: (_: unknown, row) =>
        row.duplicates.length === 0 ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <Tooltip title={row.duplicates.map((candidate) => candidate.title).join('; ')}>
            <Tag color="warning" bordered={false}>
              {row.duplicates[0].reason === 'ISBN' ? 'тот же ISBN' : 'похожее название'}
            </Tag>
          </Tooltip>
        )
    }
  ];

  return (
    <Space direction="vertical" size={20} style={{ display: 'flex' }}>
      <PageHeader
        title="Импорт библиотеки"
        subtitle="CSV из Goodreads, StoryGraph или LiveLib — колонки распознаются автоматически"
      />

      {result && (
        <Result
          status="success"
          title={`Заведено записей: ${result.imported}`}
          subTitle={
            [
              result.skippedAsDuplicate > 0 ? `пропущено как дубли: ${result.skippedAsDuplicate}` : null,
              result.failed > 0 ? `не удалось завести: ${result.failed}` : null
            ]
              .filter(Boolean)
              .join(', ') || 'Всё прошло без ошибок'
          }
        >
          {result.errors.length > 0 && (
            <Alert type="warning" message={result.errors.slice(0, 10).join('\n')} style={{ whiteSpace: 'pre-line' }} />
          )}
        </Result>
      )}

      {!preview && (
        <Upload.Dragger accept=".csv,.tsv" beforeUpload={handleFile} showUploadList={false} disabled={busy}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Перетащите сюда файл выгрузки или нажмите, чтобы выбрать</p>
          <p className="ant-upload-hint">
            Ничего не заводится сразу: сначала покажем разбор и найденные совпадения с вашей библиотекой.
          </p>
        </Upload.Dragger>
      )}

      {preview && (
        <Card
          title={
            <Space size={8} wrap>
              <Typography.Text strong>{preview.fileName}</Typography.Text>
              <Tag bordered={false}>{sourceLabel[preview.detectedSource]}</Tag>
              <Typography.Text type="secondary">
                {`строк: ${preview.totalRows} · пригодных: ${preview.validRows} · совпадений: ${preview.duplicateRows}`}
              </Typography.Text>
            </Space>
          }
          extra={
            <Space>
              <Button onClick={() => setPreview(null)} disabled={busy}>
                Другой файл
              </Button>
              <Button type="primary" onClick={handleCommit} loading={busy}>
                {`Завести ${selectedRows.length}`}
              </Button>
            </Space>
          }
        >
          <Form layout="vertical">
            <Space size={16} wrap align="start">
              <Form.Item label="Тег на всю пачку" style={{ minWidth: 260 }}>
                <Select
                  mode="tags"
                  value={tagNames}
                  onChange={setTagNames}
                  placeholder="Например, «импорт Goodreads»"
                  options={tags.map((tag) => ({ label: tag.name, value: tag.name }))}
                />
              </Form.Item>
              <Form.Item label="На полку" style={{ minWidth: 220 }}>
                <Select
                  allowClear
                  value={shelfId}
                  onChange={setShelfId}
                  placeholder="Без полки"
                  options={shelves.map((shelf) => ({ label: shelf.name, value: shelf.id }))}
                />
              </Form.Item>
              <Form.Item label="Что делать с совпадениями">
                <Radio.Group value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value)}>
                  <Radio.Button value="SKIP">Пропустить</Radio.Button>
                  <Radio.Button value="IMPORT_ANYWAY">Завести всё равно</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Space>
          </Form>

          <Table
            rowKey={(row) => row.line}
            columns={columns}
            dataSource={preview.rows}
            size="middle"
            scroll={{ x: 720 }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            rowSelection={{
              selectedRowKeys: selectedLines,
              onChange: (keys) => setSelectedLines(keys.map(Number)),
              getCheckboxProps: (row) => ({ disabled: row.errors.length > 0 })
            }}
          />
        </Card>
      )}
    </Space>
  );
};
