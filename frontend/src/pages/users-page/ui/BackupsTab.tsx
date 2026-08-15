import React, { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Empty, Space, Table, Tooltip, Typography, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { RcFile } from 'antd/es/upload';
import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  HistoryOutlined,
  InboxOutlined
} from '@ant-design/icons';
import {
  deleteExportFile,
  downloadExport,
  listExports,
  requestExport,
  restoreExport,
  uploadExport
} from '@/entities/export/api/exportApi';
import { BackupCounts, ExportFileInfo, ImportResult } from '@/shared/types/library';
import { formatDateTime } from '@/shared/lib/date';
import { useRequestError } from '@/shared/lib/errors';
import { useAppDispatch } from '@/shared/lib/hooks';
import { loadUsers } from '@/entities/user';
import { useUsersPageStyles } from './UsersPage.styles';

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${index === 0 ? value : value.toFixed(1)} ${units[index]}`;
};

/**
 * Подписи разделов копии. Порядок здесь задаёт порядок в сводке восстановления, а раздел без
 * подписи не прячется, а показывается своим именем: копия новее интерфейса — не повод молчать
 * о том, что из неё поднялось.
 */
const SECTION_LABELS: Record<string, string> = {
  users: 'пользователей',
  libraryItems: 'произведений',
  bookTypes: 'типов',
  sources: 'источников',
  authors: 'авторов',
  series: 'серий',
  tags: 'тегов',
  shelves: 'полок',
  shelfMembers: 'участников полок',
  smartShelves: 'умных полок',
  itemAuthors: 'связей с авторами',
  itemTags: 'связей с тегами',
  shelfItems: 'записей на полках',
  readingLogs: 'проходов',
  readingSessions: 'заходов',
  quotes: 'выписок',
  loans: 'выдач',
  reviewComments: 'комментариев',
  reviewReactions: 'реакций',
  userFollows: 'подписок',
  activityEvents: 'событий ленты',
  readingGoals: 'целей',
  userAchievements: 'достижений',
  systemNodes: 'узлов',
  sessions: 'сессий',
  sessionSettings: 'настроек сессий',
  monitoringSettings: 'настроек мониторинга'
};

const formatCounts = (counts?: BackupCounts) =>
  Object.entries(counts ?? {})
    .filter(([, value]) => value > 0)
    .map(([section, value]) => `${SECTION_LABELS[section] ?? section} ${value}`)
    .join(', ');

const formatRestored = (result: ImportResult) => {
  const details = formatCounts(result.counts);
  return details ? `Восстановлено: ${details}` : 'Копия пуста — восстанавливать нечего';
};

export const BackupsTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useUsersPageStyles();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const [files, setFiles] = useState<ExportFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await listExports());
    } catch (error) {
      showRequestError(error, 'Не удалось получить список резервных копий');
    } finally {
      setLoading(false);
    }
  }, [showRequestError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const info = await requestExport();
      message.success(`Копия создана: ${info.fileName}`);
      await reload();
    } catch (error) {
      showRequestError(error, 'Не удалось создать резервную копию');
    } finally {
      setCreating(false);
    }
  };

  /**
   * Файл уходит на сервер и встаёт в общий список — восстановление идёт оттуда же, откуда и для
   * снятых здесь копий. Возврат {@code false} гасит собственную загрузку antd: запрос делаем сами.
   */
  const handleUpload = (file: RcFile) => {
    setUploading(true);
    void (async () => {
      try {
        const info = await uploadExport(file as unknown as File);
        message.success(`Копия загружена: ${info.fileName}`);
        await reload();
      } catch (error) {
        showRequestError(error, 'Не удалось загрузить файл копии');
      } finally {
        setUploading(false);
      }
    })();
    return false;
  };

  const handleDownload = async (fileName: string) => {
    setBusyFile(fileName);
    try {
      const blob = await downloadExport(fileName);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showRequestError(error, 'Не удалось скачать резервную копию');
    } finally {
      setBusyFile(null);
    }
  };

  const handleRestore = (file: ExportFileInfo) => {
    modal.confirm({
      title: 'Восстановить данные из копии?',
      width: 480,
      content: (
        <Space direction="vertical" size={8}>
          <Typography.Text>
            Текущее содержимое базы будет заменено данными из <b>{file.fileName}</b>.
          </Typography.Text>
          <Typography.Text type="danger">
            Всё, что добавлено после {formatDateTime(file.lastModifiedAt)}, будет потеряно.
          </Typography.Text>
          <Typography.Text type="secondary">
            Сессии тоже восстанавливаются из копии, поэтому вход в систему, скорее всего,
            придётся повторить.
          </Typography.Text>
        </Space>
      ),
      okText: 'Восстановить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        setBusyFile(file.fileName);
        try {
          const result = await restoreExport(file.fileName);
          message.success(formatRestored(result), 6);
          dispatch(loadUsers({ force: true }));
        } catch (error) {
          showRequestError(error, 'Не удалось восстановить данные');
        } finally {
          setBusyFile(null);
        }
      }
    });
  };

  const handleDelete = (file: ExportFileInfo) => {
    modal.confirm({
      title: 'Удалить резервную копию?',
      content: `Файл ${file.fileName} будет удалён с сервера без возможности восстановления.`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        setBusyFile(file.fileName);
        try {
          await deleteExportFile(file.fileName);
          message.success('Файл удалён');
          await reload();
        } catch (error) {
          showRequestError(error, 'Не удалось удалить файл');
        } finally {
          setBusyFile(null);
        }
      }
    });
  };

  const columns: ColumnsType<ExportFileInfo> = [
    {
      title: 'Файл',
      dataIndex: 'fileName',
      render: (fileName: string) => <Typography.Text strong>{fileName}</Typography.Text>
    },
    {
      title: 'Размер',
      dataIndex: 'sizeBytes',
      width: 120,
      responsive: ['sm'],
      render: (bytes: number) => (
        <Typography.Text type="secondary" style={styles.tabularNumbers}>
          {formatBytes(bytes)}
        </Typography.Text>
      )
    },
    {
      title: 'Создан',
      dataIndex: 'lastModifiedAt',
      width: 180,
      responsive: ['md'],
      render: (value?: string) => <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_: unknown, file) => (
        <Space size={2}>
          <Tooltip title="Скачать">
            <Button
              type="text"
              shape="circle"
              icon={<DownloadOutlined />}
              loading={busyFile === file.fileName}
              onClick={() => handleDownload(file.fileName)}
              aria-label="Скачать"
            />
          </Tooltip>
          <Tooltip title="Восстановить из копии">
            <Button
              type="text"
              shape="circle"
              icon={<HistoryOutlined />}
              onClick={() => handleRestore(file)}
              aria-label="Восстановить"
            />
          </Tooltip>
          <Tooltip title="Удалить файл">
            <Button
              type="text"
              danger
              shape="circle"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(file)}
              aria-label="Удалить"
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <Card
      title="Резервные копии"
      style={styles.card}
      styles={{ body: styles.cardBody }}
      extra={
        <Space size={8}>
          <Upload accept=".json" beforeUpload={handleUpload} showUploadList={false} disabled={uploading}>
            <Button icon={<InboxOutlined />} loading={uploading}>
              Загрузить копию
            </Button>
          </Upload>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleCreate} loading={creating}>
            Создать копию
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={styles.alert}
        message="Копия содержит всю базу целиком"
        description="В JSON-файл на сервере уходят пользователи и профили, библиотека со всеми связями — авторы, серии, теги, полки, — история чтения, выписки, выдачи, социальный слой, цели, достижения, узлы, сессии и настройки. Обложки лежат в объектном хранилище и в файл не входят. Копию можно загрузить со стороны — восстановление идёт из общего списка и заменяет текущие данные."
      />
      <Table<ExportFileInfo>
        rowKey={(row) => row.fileName}
        dataSource={files}
        loading={loading}
        columns={columns}
        pagination={false}
        size="middle"
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text strong>Копий пока нет</Typography.Text>
                  <Typography.Text type="secondary">
                    Создайте первую — она появится в этом списке.
                  </Typography.Text>
                </Space>
              }
            />
          )
        }}
        style={styles.table}
      />
    </Card>
  );
};
