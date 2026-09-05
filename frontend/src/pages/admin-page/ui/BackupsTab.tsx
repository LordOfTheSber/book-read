import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Input, Space, Tag, Tooltip, Typography, Upload } from 'antd';
import type { RcFile } from 'antd/es/upload';
import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
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
import { formatBytes } from '@/shared/lib/format';
import { pluralize } from '@/shared/lib/plural';
import { useRequestError } from '@/shared/lib/errors';
import { useAppDispatch } from '@/shared/lib/hooks';
import { loadUsers } from '@/entities/user';
import { useAdminStyles } from './AdminPage.styles';

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

/** Слово-подтверждение стоит только здесь и у удаления аккаунта — там, где отменить нечем. */
const CONFIRM_WORD = 'ВОССТАНОВИТЬ';

const formatCounts = (counts?: BackupCounts) =>
  Object.entries(counts ?? {})
    .filter(([, value]) => value > 0)
    .map(([section, value]) => `${SECTION_LABELS[section] ?? section} ${value}`)
    .join(', ');

const formatRestored = (result: ImportResult) => {
  const details = formatCounts(result.counts);
  return details ? `Восстановлено: ${details}` : 'Копия пуста — восстанавливать нечего';
};

/** `export-2026-08-21_02-00-00.json` — имя, которое сервер даёт снятой у себя копии. */
const OWN_FILE = /^export-\d{4}-\d{2}-\d{2}_(\d{2})-(\d{2})/;

/**
 * Откуда взялась копия. Принесённые сохраняют своё имя, снятые здесь называются `export-<дата>`,
 * а ночные отличаются от снятых руками только временем: расписание срабатывает в 02:00.
 *
 * Час берётся из имени файла, а не из даты изменения: в имени стоит время сервера — то же, по
 * которому работает расписание, — а дату изменения браузер покажет в своём часовом поясе, и
 * ночная копия у читателя восточнее сервера выглядела бы снятой руками среди дня.
 */
const originOf = (file: ExportFileInfo): { label: string; color: string } => {
  const parsed = OWN_FILE.exec(file.fileName);
  if (!parsed) return { label: 'принесена', color: 'orange' };
  const nightly = parsed[1] === '02' && Number(parsed[2]) < 5;
  return nightly ? { label: 'ночная', color: 'blue' } : { label: 'вручную', color: 'green' };
};

/**
 * Резервные копии по макету `AdminBackups`.
 *
 * Раньше это была таблица файлов с кнопкой «Создать», и восстановление стояло в ней третьей
 * иконкой в ряду — наравне со скачиванием. Но восстановление затирает базу всех пользователей
 * и не отменяется ничем: единственное такое действие в приложении. Здесь оно требует набрать
 * слово целиком, а рядом сказано, что именно исчезнет.
 */
export const BackupsTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useAdminStyles();
  const { message, modal } = App.useApp();
  const showRequestError = useRequestError();
  const [files, setFiles] = useState<ExportFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<ExportFileInfo | null>(null);
  const [confirmWord, setConfirmWord] = useState('');

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

  const totals = useMemo(
    () => ({
      count: files.length,
      size: files.reduce((sum, file) => sum + file.sizeBytes, 0),
      last: files.map((file) => file.lastModifiedAt).sort().at(-1)
    }),
    [files]
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      const info = await requestExport();
      message.success(`Копия снята: ${info.fileName}`);
      await reload();
    } catch (error) {
      showRequestError(error, 'Не удалось снять резервную копию');
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
        message.success(`Копия принесена: ${info.fileName}`);
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

  const closeRestore = () => {
    setRestoring(null);
    setConfirmWord('');
  };

  const handleRestore = async () => {
    if (!restoring) return;
    setBusyFile(restoring.fileName);
    try {
      const result = await restoreExport(restoring.fileName);
      message.success(formatRestored(result), 6);
      dispatch(loadUsers({ force: true }));
      closeRestore();
    } catch (error) {
      showRequestError(error, 'Не удалось восстановить данные');
    } finally {
      setBusyFile(null);
    }
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

  const renderFile = (file: ExportFileInfo, last: boolean) => {
    const origin = originOf(file);
    return (
      <div key={file.fileName} style={styles.listRow(last)}>
        <span style={styles.fileIcon}>
          <FileOutlined />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text strong style={{ display: 'block' }}>
            {file.fileName}
          </Typography.Text>
          <Typography.Text type="secondary" style={styles.hint}>
            {formatDateTime(file.lastModifiedAt)}
          </Typography.Text>
        </span>
        <Tag color={origin.color} bordered={false} style={styles.tag}>
          {origin.label}
        </Tag>
        <Typography.Text type="secondary" style={{ ...styles.numeric, ...styles.hint }}>
          {formatBytes(file.sizeBytes)}
        </Typography.Text>
        <Space size={2}>
          <Tooltip title="Скачать себе">
            <Button
              type="text"
              shape="circle"
              icon={<DownloadOutlined />}
              loading={busyFile === file.fileName}
              onClick={() => handleDownload(file.fileName)}
              aria-label="Скачать"
            />
          </Tooltip>
          <Tooltip title="Развернуть поверх базы">
            <Button
              type="text"
              shape="circle"
              icon={<HistoryOutlined />}
              onClick={() => {
                setRestoring(file);
                setConfirmWord('');
              }}
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
      </div>
    );
  };

  return (
    <div style={styles.columns}>
      <div style={styles.card}>
        <div style={styles.cardHead}>
          <span style={{ minWidth: 0 }}>
            <Typography.Text strong style={{ display: 'block', fontSize: 16 }}>
              Копии базы
            </Typography.Text>
            <Typography.Text type="secondary" style={styles.hint}>
              {files.length === 0
                ? 'копий пока нет'
                : `${pluralize(totals.count, ['файл', 'файла', 'файлов'])} · ${formatBytes(totals.size)} · последняя ${formatDateTime(totals.last)}`}
            </Typography.Text>
          </span>
          <Space size={8} wrap>
            <Upload accept=".json" beforeUpload={handleUpload} showUploadList={false} disabled={uploading}>
              <Button icon={<InboxOutlined />} loading={uploading}>
                Принести файл
              </Button>
            </Upload>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleCreate} loading={creating}>
              Снять копию
            </Button>
          </Space>
        </div>

        {files.length === 0 && !loading ? (
          <div style={styles.empty}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text strong>Копий пока нет</Typography.Text>
                  <Typography.Text type="secondary">
                    Снимите первую — она появится в этом списке.
                  </Typography.Text>
                </Space>
              }
            />
          </div>
        ) : (
          files.map((file, index) => renderFile(file, index === files.length - 1))
        )}

        <div style={{ ...styles.note, marginTop: 14 }}>
          Копия снимается на сервере и лежит там же. Файл, унесённый на свой диск, — единственный,
          который переживёт потерю самого сервера. Обложки лежат в объектном хранилище и в копию
          не входят.
        </div>
      </div>

      <div style={styles.card}>
        <Typography.Text style={styles.groupLabel}>Восстановление — необратимо</Typography.Text>

        {restoring ? (
          <Space direction="vertical" size={16} style={styles.fullWidth}>
            <div style={{ ...styles.danger, marginTop: 0 }}>
              Всё, что появилось после <b>{formatDateTime(restoring.lastModifiedAt)}</b>, исчезнет без
              следа: записи, заходы, выписки и заведённые с тех пор пользователи. Отменить это нельзя.
            </div>
            <Typography.Text type="secondary" style={styles.hint}>
              Сессии тоже восстанавливаются из копии, поэтому вход в приложение, скорее всего,
              придётся повторить — всем сразу.
            </Typography.Text>
            <div>
              <Typography.Text style={{ display: 'block', marginBottom: 6 }}>
                Введите <b>{CONFIRM_WORD}</b>, чтобы продолжить
              </Typography.Text>
              <Input
                value={confirmWord}
                onChange={(event) => setConfirmWord(event.target.value)}
                placeholder={CONFIRM_WORD}
                aria-label="Подтверждение восстановления"
              />
            </div>
            <Space size={10} style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={closeRestore}>Отмена</Button>
              <Button
                type="primary"
                danger
                // Кнопка оживает, когда слово набрано целиком: подтверждение словом и есть
                // единственная преграда перед перезаписью всей базы.
                disabled={confirmWord.trim().toUpperCase() !== CONFIRM_WORD}
                loading={busyFile === restoring.fileName}
                onClick={handleRestore}
              >
                Развернуть
              </Button>
            </Space>
          </Space>
        ) : (
          <Space direction="vertical" size={12} style={styles.fullWidth}>
            <Typography.Text type="secondary">
              Выберите копию в списке слева — здесь появится, что именно потеряется при
              разворачивании и чем это подтвердить.
            </Typography.Text>
            <div style={styles.note}>
              Пока копию разворачивают, приложение закрыто для всех: писать в базу, которую
              перезаписывают, нельзя.
            </div>
          </Space>
        )}
      </div>
    </div>
  );
};
