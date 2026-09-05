import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Col, DatePicker, Empty, Form, Input, List, Row, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { LibraryItem, Loan } from '@/shared/types/library';
import { createLoan, deleteLoan, fetchItemLoans, returnLoan } from '@/entities/loan';
import { formatDate } from '@/shared/lib/date';
import { useRequestError } from '@/shared/lib/errors';
import { pluralize } from '@/shared/lib/plural';

interface Props {
  item: LibraryItem;
}

interface LoanFormValues {
  borrowerName: string;
  borrowerContact?: string;
  dueOn?: dayjs.Dayjs;
  note?: string;
}

/**
 * Кому отдана книга и когда её ждать обратно. Заёмщик — просто имя: книги чаще отдают тем, кого
 * в сервисе нет, и требовать регистрации ради записи «у Ани с марта» незачем.
 */
export const LoansTab: React.FC<Props> = ({ item }) => {
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [form] = Form.useForm<LoanFormValues>();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLoans(await fetchItemLoans(item.id));
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить историю выдач');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (values: LoanFormValues) => {
    setSaving(true);
    try {
      await createLoan(item.id, {
        borrowerName: values.borrowerName,
        borrowerContact: values.borrowerContact,
        dueOn: values.dueOn?.format('YYYY-MM-DD'),
        note: values.note
      });
      form.resetFields();
      message.success('Книга отмечена как выданная');
      await load();
    } catch (error) {
      showRequestError(error, 'Не удалось записать выдачу');
    } finally {
      setSaving(false);
    }
  };

  const markReturned = async (loan: Loan) => {
    try {
      await returnLoan(loan.id);
      message.success('Книга вернулась');
      await load();
    } catch (error) {
      showRequestError(error, 'Не удалось отметить возврат');
    }
  };

  const remove = async (loan: Loan) => {
    try {
      await deleteLoan(loan.id);
      await load();
    } catch (error) {
      showRequestError(error, 'Не удалось удалить запись');
    }
  };

  const openLoan = loans.find((loan) => !loan.returnedOn);

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {openLoan ? (
        <Typography.Text type={openLoan.overdue ? 'danger' : 'warning'}>
          Экземпляр на руках: {openLoan.borrowerName} —{' '}
          {openLoan.daysOut > 0 ? pluralize(openLoan.daysOut, ['день', 'дня', 'дней']) : 'выдана сегодня'}
          {openLoan.dueOn
            ? `${openLoan.overdue ? ', вернуть обещали ещё ' : ', вернуть обещали '}${formatDate(openLoan.dueOn)}`
            : ''}
          . Пока запись не закрыта, вторую выдачу завести нельзя — сначала отметьте возврат.
        </Typography.Text>
      ) : (
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item
                name="borrowerName"
                label="Кому выдана"
                rules={[{ required: true, message: 'Укажите, кому отдали книгу' }]}
              >
                <Input placeholder="Аня" maxLength={128} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="borrowerContact" label="Контакт">
                <Input placeholder="телефон или @ник" maxLength={255} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="dueOn" label="Вернуть до" tooltip="Без даты напоминать не о чем">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="note" label="Заметка">
            <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} maxLength={2000} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            Отметить выдачу
          </Button>
        </Form>
      )}

      {loans.length === 0 && !loading ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Книгу ещё никому не отдавали" />
      ) : (
        <List
          loading={loading}
          dataSource={loans}
          renderItem={(loan) => (
            <List.Item
              actions={[
                ...(loan.returnedOn
                  ? []
                  : [
                      <Button
                        key="return"
                        size="small"
                        icon={<RollbackOutlined />}
                        onClick={() => markReturned(loan)}
                      >
                        Вернули
                      </Button>
                    ]),
                <Button
                  key="delete"
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(loan)}
                  aria-label="Удалить запись"
                />
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={8}>
                    <Typography.Text strong>{loan.borrowerName}</Typography.Text>
                    {loan.returnedOn ? (
                      <Tag bordered={false}>вернул {formatDate(loan.returnedOn)}</Tag>
                    ) : loan.overdue ? (
                      <Tag color="error" bordered={false}>
                        просрочено
                      </Tag>
                    ) : (
                      <Tag color="processing" bordered={false}>
                        на руках
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Typography.Text type="secondary">
                      Выдана {formatDate(loan.lentOn)}
                      {loan.dueOn ? ` · вернуть до ${formatDate(loan.dueOn)}` : ''}
                      {loan.borrowerContact ? ` · ${loan.borrowerContact}` : ''}
                    </Typography.Text>
                    {loan.note && <Typography.Text type="secondary">{loan.note}</Typography.Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Space>
  );
};
