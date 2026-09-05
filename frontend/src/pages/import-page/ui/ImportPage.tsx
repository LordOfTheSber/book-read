import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Grid,
  Radio,
  Result,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { RcFile } from 'antd/es/upload';
import { CheckOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatusTag } from '@/shared/ui/StatusTag';
import { ImportPreview, ImportResultSummary, ImportRow, ReadingStatus } from '@/shared/types/library';
import { commitImport, previewImport } from '@/entities/import';
import { loadShelves } from '@/entities/shelf';
import { loadTags } from '@/entities/tag';
import { loadBooks } from '@/entities/book';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { formatNumber, formatScore } from '@/shared/lib/format';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';
import { brand } from '@/shared/config/brand';
import { useImportPageStyles } from './ImportPage.styles';

type DetectedSource = ImportPreview['detectedSource'];

/** Откуда переносят библиотеку: подпись объясняет, где в чужом сервисе искать выгрузку. */
const SOURCES: Array<{ key: DetectedSource; name: string; short: string; hint: string; color: string }> = [
  { key: 'GOODREADS', name: 'Goodreads', short: 'GR', hint: 'CSV из «My Books → Export»', color: brand.amber },
  { key: 'STORYGRAPH', name: 'StoryGraph', short: 'SG', hint: 'CSV из настроек аккаунта', color: brand.plum },
  { key: 'LIVELIB', name: 'LiveLib', short: 'LL', hint: 'CSV выгрузки страницы', color: brand.ink },
  { key: 'GENERIC', name: 'Другой CSV', short: 'CSV', hint: 'свой файл с колонкой названия', color: brand.moss }
];

const SOURCE_LABELS: Record<DetectedSource, string> = {
  GOODREADS: 'Goodreads',
  STORYGRAPH: 'StoryGraph',
  LIVELIB: 'LiveLib',
  GENERIC: 'неизвестный формат'
};

type RowsTab = 'all' | 'duplicates' | 'errors';

/**
 * Перенос библиотеки из чужого сервиса по макету `Import2.dc.html`.
 *
 * Разбор по-прежнему ничего не пишет в базу: чужая выгрузка почти всегда требует правки,
 * а повторный импорт того же файла не должен удваивать библиотеку. Но показывает он теперь
 * не только строки: слева — что приедет, справа — разбор файла и колонки. Колонки и есть
 * главная правка: раньше они «распознавались автоматически», и всё, что не распозналось,
 * пропадало молча — человек узнавал о потере, не найдя в библиотеке своих заметок.
 */
export const ImportPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const styles = useImportPageStyles();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const shelves = useAppSelector((state) => state.shelves.list);
  const tags = useAppSelector((state) => state.tags.list);
  const filters = useAppSelector((state) => state.bookFilters);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  /**
   * Что делать с совпадением — решение построчное: одна и та же книга бывает и ошибкой импорта,
   * и вторым изданием. По умолчанию дубли пропускаются, здесь только исключения.
   */
  const [importAnyway, setImportAnyway] = useState<number[]>([]);
  const [tab, setTab] = useState<RowsTab>('all');
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
      setImportAnyway([]);
      setTab('all');
      setTagNames([`импорт ${SOURCE_LABELS[parsed.detectedSource]}`]);
    } catch (error) {
      showRequestError(error, 'Не удалось разобрать файл');
    } finally {
      setBusy(false);
    }
    // Файл отправляем сами, встроенному загрузчику отдавать нечего.
    return Upload.LIST_IGNORE;
  };

  // Отдельный useMemo, а не `preview?.rows ?? []` в теле: пустой литерал каждый раз новый,
  // и все считалки ниже пересчитывались бы на каждую перерисовку.
  const rows = useMemo(() => preview?.rows ?? [], [preview]);
  const errorRows = useMemo(() => rows.filter((row) => row.errors.length > 0), [rows]);
  const duplicateRows = useMemo(
    () => rows.filter((row) => row.errors.length === 0 && row.duplicates.length > 0),
    [rows]
  );

  /**
   * Что уедет на сервер: годные строки, кроме дублей, оставленных пропущенными. Пропуск делается
   * здесь, а не стратегией на сервере: там она одна на всю пачку, а решение построчное.
   */
  const selectedRows = useMemo(
    () =>
      rows.filter(
        (row) => row.errors.length === 0 && (row.duplicates.length === 0 || importAnyway.includes(row.line))
      ),
    [rows, importAnyway]
  );

  const visibleRows = useMemo(() => {
    if (tab === 'duplicates') return duplicateRows;
    if (tab === 'errors') return errorRows;
    return rows;
  }, [tab, rows, duplicateRows, errorRows]);

  const handleCommit = async () => {
    if (selectedRows.length === 0) {
      message.warning('Нечего заводить: все строки пропущены или с ошибками');
      return;
    }
    setBusy(true);
    try {
      const summary = await commitImport({
        rows: selectedRows,
        tagNames: tagNames.length > 0 ? tagNames : undefined,
        shelfId,
        // Пропуск уже сделан отбором строк: сервер заводит ровно то, что прислали.
        duplicateStrategy: 'IMPORT_ANYWAY'
      });
      setResult(summary);
      setPreview(null);
      setImportAnyway([]);
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
      title: 'Запись',
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
      render: (status?: ReadingStatus) => (status ? <StatusTag status={status} /> : <span>—</span>)
    },
    {
      title: 'Оценка',
      dataIndex: 'rating',
      width: 90,
      render: (rating?: number) => formatScore(rating) ?? '—'
    },
    {
      title: 'Что делать',
      dataIndex: 'duplicates',
      width: 210,
      render: (_: unknown, row) => {
        if (row.errors.length > 0) {
          return <Typography.Text type="secondary">не приедет</Typography.Text>;
        }
        if (row.duplicates.length === 0) {
          return (
            <Typography.Text style={{ color: token.colorSuccessText }}>
              <CheckOutlined /> Новая
            </Typography.Text>
          );
        }
        const skipped = !importAnyway.includes(row.line);
        return (
          <Tooltip
            title={`Похоже на «${row.duplicates[0].title}» — ${
              row.duplicates[0].reason === 'ISBN' ? 'тот же ISBN' : 'похожее название'
            }`}
          >
            <Radio.Group
              size="small"
              value={skipped ? 'skip' : 'import'}
              onChange={(event) =>
                setImportAnyway((current) =>
                  event.target.value === 'import'
                    ? [...current, row.line]
                    : current.filter((line) => line !== row.line)
                )
              }
              options={[
                { label: 'Пропустить', value: 'skip' },
                { label: 'Завести', value: 'import' }
              ]}
              optionType="button"
            />
          </Tooltip>
        );
      }
    }
  ];

  const summary = preview
    ? [
        { label: 'Строк в файле', value: formatNumber(preview.totalRows) },
        {
          label: 'Заведём записей',
          value: formatNumber(selectedRows.length),
          color: token.colorSuccessText
        },
        {
          label: 'Совпало с вашими',
          value: formatNumber(duplicateRows.length),
          color: duplicateRows.length > 0 ? token.colorWarningText : undefined
        },
        {
          label: 'Не разобрано',
          value: formatNumber(errorRows.length),
          color: errorRows.length > 0 ? token.colorErrorText : undefined
        }
      ]
    : [];

  const unrecognized = (preview?.columns ?? []).filter((column) => !column.recognized);

  return (
    <div>
      <PageHeader title="Перенести библиотеку" subtitle="Из другого трекера — или обратно к себе" />

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

      {/* Источник не выбирают: файл сам себя называет. До разбора карточки говорят, где взять
          выгрузку, после — показывают, чем оказался файл. */}
      <div style={styles.sources}>
        {SOURCES.map((source) => (
          <div key={source.key} style={styles.source(preview?.detectedSource === source.key)}>
            <Space size={10}>
              <span aria-hidden style={styles.sourceMark(source.color)}>
                {source.short}
              </span>
              <Typography.Text strong>{source.name}</Typography.Text>
              {preview?.detectedSource === source.key && (
                <Tag color="processing" bordered={false}>
                  этот файл
                </Tag>
              )}
            </Space>
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 9, fontSize: 12 }}>
              {source.hint}
            </Typography.Text>
          </div>
        ))}
      </div>

      {!preview && (
        <Upload.Dragger accept=".csv,.tsv" beforeUpload={handleFile} showUploadList={false} disabled={busy}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Перетащите сюда файл выгрузки или нажмите, чтобы выбрать</p>
          <p className="ant-upload-hint">
            Ничего не заводится сразу: сначала покажем разбор, найденные совпадения и колонки,
            которые не распознались.
          </p>
        </Upload.Dragger>
      )}

      {preview && (
        <div style={screens.lg ? styles.columns : styles.columnsNarrow}>
          <Card
            style={styles.card}
            title={
              <Space direction="vertical" size={0}>
                <Typography.Text strong>Что приедет</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {`${preview.fileName} · ${pluralize(preview.totalRows, ['строка', 'строки', 'строк'])}`}
                </Typography.Text>
              </Space>
            }
            extra={
              <Segmented
                value={tab}
                onChange={(value) => setTab(value as RowsTab)}
                options={[
                  { label: `Все ${rows.length}`, value: 'all' },
                  { label: `Дубли ${duplicateRows.length}`, value: 'duplicates' },
                  { label: `С ошибками ${errorRows.length}`, value: 'errors' }
                ]}
              />
            }
          >
            <Table
              rowKey={(row) => row.line}
              columns={columns}
              dataSource={visibleRows}
              size="middle"
              scroll={{ x: 720 }}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              locale={{ emptyText: tab === 'errors' ? 'Ни одной строки с ошибкой' : 'Совпадений с библиотекой нет' }}
            />

            <div style={styles.footer}>
              <Button onClick={() => setPreview(null)} disabled={busy}>
                Другой файл
              </Button>
              <Button type="primary" onClick={handleCommit} loading={busy}>
                {`Завести ${pluralize(selectedRows.length, ['запись', 'записи', 'записей'])}`}
              </Button>
            </div>
          </Card>

          <div style={styles.side}>
            <Card style={styles.card} title="Разбор файла">
              {summary.map((row, index) => (
                <div key={row.label} style={styles.summaryRow(index === summary.length - 1)}>
                  <Typography.Text type="secondary">{row.label}</Typography.Text>
                  <Typography.Text style={styles.summaryValue(row.color)}>{row.value}</Typography.Text>
                </div>
              ))}
            </Card>

            <Card style={styles.card} title="Колонки">
              <Space size={[7, 7]} wrap>
                {preview.columns.map((column) => (
                  <Tooltip
                    key={column.name}
                    title={
                      column.recognized
                        ? `${column.name} → ${column.target}${column.sample ? `, например «${column.sample}»` : ''}`
                        : `${column.name} не приедет${column.sample ? `: «${column.sample}»` : ''}`
                    }
                  >
                    <span style={styles.column(column.recognized)}>{column.name}</span>
                  </Tooltip>
                ))}
              </Space>
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
                {unrecognized.length === 0
                  ? 'Все колонки файла распознаны — ничего не потеряется.'
                  : `Серые не распознаны и не приедут: ${unrecognized
                      .map((column) => column.name)
                      .join(', ')}. Наведите на колонку, чтобы увидеть пример значения.`}
              </Typography.Paragraph>
            </Card>

            <Card style={styles.card} title="Всем записям пачки">
              <Form layout="vertical">
                <Form.Item label="Тег" style={{ marginBottom: 12 }}>
                  <Select
                    mode="tags"
                    value={tagNames}
                    onChange={setTagNames}
                    placeholder="Например, «импорт Goodreads»"
                    options={tags.map((tag) => ({ label: tag.name, value: tag.name }))}
                  />
                </Form.Item>
                <Form.Item label="На полку" style={{ marginBottom: 0 }}>
                  <Select
                    allowClear
                    value={shelfId}
                    onChange={setShelfId}
                    placeholder="Без полки"
                    options={shelves.map((shelf) => ({ label: shelf.name, value: shelf.id }))}
                  />
                </Form.Item>
              </Form>
            </Card>

            {/* Импорт и выгрузка — одно место: забрать своё должно быть так же просто, как принести. */}
            <Card style={styles.card} title="Обратная выгрузка">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                Свою библиотеку можно забрать в CSV или JSON в любой момент — в профиле, в разделе
                «Мои данные».
              </Typography.Paragraph>
              <Button type="link" style={{ paddingInline: 0 }} onClick={() => navigate('/profile')}>
                Перейти к выгрузке
              </Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
