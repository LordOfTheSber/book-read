import React, { useEffect } from 'react';
import { Card, Table, Tag, Typography } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { loadUsers } from '@/entities/user';
import { User } from '@/shared/types/library';

export const UsersPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { list, loading, error, loaded } = useAppSelector((state) => state.users);

  useEffect(() => {
    if (!loaded) {
      dispatch(loadUsers());
    }
  }, [dispatch, loaded]);

  return (
    <Card title="Пользователи">
      {error && (
        <Typography.Paragraph type="danger" style={{ marginBottom: 12 }}>
          {error}
        </Typography.Paragraph>
      )}
      <Table<User>
        rowKey={(row) => row.id}
        dataSource={list}
        loading={loading}
        pagination={false}
        columns={[
          {
            title: 'Аватар',
            dataIndex: 'avatar',
            render: (_: unknown, record) =>
              record.avatar && record.avatarContentType ? (
                <img
                  src={`data:${record.avatarContentType};base64,${record.avatar}`}
                  alt={record.username}
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#e0e0e0'
                  }}
                />
              )
          },
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
