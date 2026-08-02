import React, { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Empty, Space, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CloudUploadOutlined, DeleteOutlined, DownloadOutlined, HistoryOutlined } from '@ant-design/icons';
import {
  deleteExportFile,
  downloadExport,
  listExports,
  requestExport,
  restoreExport
} from '@/entities/export/api/exportApi';
import { ExportFileInfo } from '@/shared/types/library';
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

export const BackupsTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useUsersPageStyles();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const [files, setFiles] = useState<ExportFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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
        </Space>
      ),
      okText: 'Восстановить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        setBusyFile(file.fileName);
        try {
          const result = await restoreExport(file.fileName);
          message.success(
            `Восстановлено: пользователей ${result.restoredUsers}, книг ${result.restoredItems}, типов ${result.restoredBookTypes}`
          );
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
        <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleCreate} loading={creating}>
          Создать копию
        </Button>
      }
    >
      <Alert
        type="info"
        showIcon
        style={styles.alert}
        message="Копия содержит всю базу целиком"
        description="Пользователи, книги, типы, источники и сессии сохраняются в JSON-файл на сервере. Восстановление заменяет текущие данные."
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
