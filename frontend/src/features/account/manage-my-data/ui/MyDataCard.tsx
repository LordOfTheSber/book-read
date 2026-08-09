import React, { useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Space, Typography, theme } from 'antd';
import { DeleteOutlined, DownloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ExportFormat, deleteMyAccount, exportMyLibrary } from '@/entities/account';
import { clearAuthSession } from '@/shared/api/authSession';
import { useRequestError } from '@/shared/lib/errors';

/** Слово-подтверждение: одного пароля мало, если человек не читал, что нажимает. */
const CONFIRMATION_WORD = 'УДАЛИТЬ';

interface DeleteFormValues {
  password: string;
  confirmation: string;
}

/**
 * Свои данные: забрать и уйти. Выгрузка не пересекается с административными резервными копиями —
 * те делают снимок всей базы и лежат под другим правом доступа.
 */
export const MyDataCard: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const showRequestError = useRequestError();
  const [form] = Form.useForm<DeleteFormValues>();
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const download = async (format: ExportFormat) => {
    setDownloading(format);
    try {
      const blob = await exportMyLibrary(format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `library.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showRequestError(error, 'Не удалось выгрузить библиотеку');
    } finally {
      setDownloading(null);
    }
  };

  const confirmDelete = async (values: DeleteFormValues) => {
    setDeleting(true);
    try {
      await deleteMyAccount(values.password);
      // Аккаунта больше нет: флаг сессии надо снять до перехода, иначе роутер попробует
      // восстановить вход и упрётся в 401.
      clearAuthSession();
      message.success('Аккаунт удалён');
      navigate('/login', { replace: true });
    } catch (error) {
      showRequestError(error, 'Не удалось удалить аккаунт');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card title="Мои данные">
      <Typography.Paragraph type="secondary">
        Выгрузка содержит только вашу библиотеку. CSV читается обратно страницей импорта и другими
        трекерами, JSON — полный: с историей чтения, выписками, полками и целями.
      </Typography.Paragraph>

      <Space size={8} wrap>
        <Button
          icon={<DownloadOutlined />}
          loading={downloading === 'csv'}
          onClick={() => download('csv')}
        >
          Скачать CSV
        </Button>
        <Button
          icon={<DownloadOutlined />}
          loading={downloading === 'json'}
          onClick={() => download('json')}
        >
          Скачать JSON
        </Button>
      </Space>

      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: `1px solid ${token.colorBorderSecondary}`
        }}
      >
        <Typography.Text strong style={{ color: token.colorError }}>
          Удаление аккаунта
        </Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
          Вместе с аккаунтом удаляются библиотека, история чтения, выписки, полки и цели.
          Восстановить их будет нельзя — сначала скачайте выгрузку.
        </Typography.Paragraph>
        <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteOpen(true)}>
          Удалить аккаунт
        </Button>
      </div>

      <Modal
        open={deleteOpen}
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: token.colorError }} />
            Удалить аккаунт навсегда?
          </Space>
        }
        okText="Удалить аккаунт"
        okButtonProps={{ danger: true, loading: deleting }}
        cancelText="Отмена"
        onOk={() => form.submit()}
        onCancel={() => {
          setDeleteOpen(false);
          form.resetFields();
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={confirmDelete} preserve={false}>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Подтвердите удаление паролем' }]}
          >
            {/* Пароль спрашивается заново: открытая сессия — это ещё и чужой ноутбук. */}
            <Input.Password autoComplete="current-password" placeholder="Ваш пароль" />
          </Form.Item>
          <Form.Item
            name="confirmation"
            label={`Введите «${CONFIRMATION_WORD}», чтобы подтвердить`}
            rules={[
              {
                validator: (_, value) =>
                  value === CONFIRMATION_WORD
                    ? Promise.resolve()
                    : Promise.reject(new Error(`Введите «${CONFIRMATION_WORD}» без кавычек`))
              }
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
