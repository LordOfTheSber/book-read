import React, { useState } from 'react';
import { Form, Input, Modal } from 'antd';
import type { CatalogEntityMeta, CatalogRow } from '../model';

interface Props {
  meta: CatalogEntityMeta;
  open: boolean;
  /** Правка карточки; при создании — `null`. */
  editing: CatalogRow | null;
  onSubmit: (values: Record<string, string>) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * Окно на создание записи и на правку карточки. Строки таблицы правятся на месте, а карточка
 * автора — здесь: у неё два поля, и разворачивать ради них карточку в форму значит ломать сетку.
 */
export const CatalogFormModal: React.FC<Props> = ({ meta, open, editing, onSubmit, onCancel }) => {
  const [form] = Form.useForm<Record<string, string>>();
  const [saving, setSaving] = useState(false);

  const handleOk = async () => {
    // Modal не ждёт результат onOk: без перехвата отказ валидации остался бы необработанным.
    const values = await form.validateFields().catch(() => undefined);
    if (!values) return;

    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? meta.editTitle : meta.createTitle}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnHidden
    >
      {/* destroyOnHidden пересоздаёт форму на каждое открытие: начальные значения подставляются
          без ручного setFieldsValue. */}
      <Form
        layout="vertical"
        form={form}
        initialValues={editing ? editing.values : {}}
        style={{ paddingTop: 8 }}
      >
        {meta.fields.map((field) => (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            rules={[
              ...(field.required ? [{ required: true, message: `${field.label} — обязательное поле` }] : []),
              ...(field.url ? [{ type: 'url' as const, message: 'Введите корректную ссылку' }] : [])
            ]}
          >
            {field.multiline ? (
              <Input.TextArea rows={3} placeholder={field.placeholder} />
            ) : (
              <Input placeholder={field.placeholder} />
            )}
          </Form.Item>
        ))}
      </Form>
    </Modal>
  );
};
