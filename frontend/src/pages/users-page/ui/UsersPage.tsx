import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography } from 'antd';
import { httpClient } from '@/shared/api/httpClient';
import { User } from '@/shared/types/library';

export const UsersPage: React.FC = () => {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const { data } = await httpClient.get<User[]>('/users');
        setData(data);
        setError(undefined);
      } catch (error: any) {
        const msg = error.response?.status === 403 ? 'Нет прав для просмотра пользователей' : 'Не удалось загрузить пользователей';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  return (
    <Card title="Пользователи">
      {error && (
        <Typography.Paragraph type="danger" style={{ marginBottom: 12 }}>
          {error}
        </Typography.Paragraph>
      )}
      <Table<User>
        rowKey={(row) => row.id}
        dataSource={data}
        loading={loading}
        pagination={false}
        columns={[
          { title: 'Имя', dataIndex: 'username' },
          {
            title: 'Роль',
            dataIndex: 'role',
            render: (role: string) => <Tag color="blue">{role}</Tag>
          },
          {
            title: 'Создан',
            dataIndex: 'createdAt',
            render: (value?: string) => (value ? new Date(value).toLocaleString() : '—')
          },
          {
            title: 'Обновлён',
            dataIndex: 'updatedAt',
            render: (value?: string) => (value ? new Date(value).toLocaleString() : '—')
          }
        ]}
      />
    </Card>
  );
};
