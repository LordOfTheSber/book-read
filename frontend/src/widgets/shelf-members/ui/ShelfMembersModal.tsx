import React, { useEffect, useState } from 'react';
import { App, Avatar, Button, Empty, Input, List, Modal, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { Shelf, ShelfMember, ShelfRole } from '@/shared/types/library';
import { shelfRoleMeta } from '@/shared/constants/social';
import { useRequestError } from '@/shared/lib/errors';
import { addShelfMember, fetchShelfMembers, removeShelfMember } from '@/entities/shelf';

interface Props {
  shelf: Shelf | null;
  onClose: () => void;
}

const roleOptions = (Object.keys(shelfRoleMeta) as ShelfRole[]).map((role) => ({
  value: role,
  label: `${shelfRoleMeta[role].label} — ${shelfRoleMeta[role].description.toLowerCase()}`
}));

/**
 * Участники совместной полки: семейной или клубной. Зовут по логину — идентификатор чужого
 * пользователя взять неоткуда, да и не нужно.
 */
export const ShelfMembersModal: React.FC<Props> = ({ shelf, onClose }) => {
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [members, setMembers] = useState<ShelfMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<ShelfRole>('CONTRIBUTOR');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!shelf) return;
    let cancelled = false;
    setLoading(true);
    fetchShelfMembers(shelf.id)
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch((error) => {
        if (!cancelled) showRequestError(error, 'Не удалось загрузить участников');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shelf, showRequestError]);

  const invite = async () => {
    if (!shelf || !username.trim()) return;
    setInviting(true);
    try {
      setMembers(await addShelfMember(shelf.id, username.trim(), role));
      setUsername('');
      message.success('Участник добавлен');
    } catch (error) {
      showRequestError(error, 'Не удалось добавить участника');
    } finally {
      setInviting(false);
    }
  };

  const remove = async (userId: string) => {
    if (!shelf) return;
    try {
      setMembers(await removeShelfMember(shelf.id, userId));
    } catch (error) {
      showRequestError(error, 'Не удалось убрать участника');
    }
  };

  return (
    <Modal
      open={Boolean(shelf)}
      title={shelf ? `Участники полки «${shelf.name}»` : 'Участники'}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      {shelf?.canCurate && (
        <Space.Compact style={{ display: 'flex', marginBottom: 16 }}>
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Логин пользователя"
            onPressEnter={invite}
          />
          <Select value={role} onChange={setRole} options={roleOptions} style={{ minWidth: 260 }} />
          <Button type="primary" loading={inviting} disabled={!username.trim()} onClick={invite}>
            Добавить
          </Button>
        </Space.Compact>
      )}

      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : members.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Пока никого нет — полка личная, пока в неё никого не позвали"
        />
      ) : (
        <List
          dataSource={members}
          renderItem={(member) => (
            <List.Item
              actions={
                shelf?.canCurate
                  ? [
                      <Button
                        key="remove"
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(member.user.id)}
                        aria-label="Убрать участника"
                      />
                    ]
                  : undefined
              }
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={<UserOutlined />}
                    src={member.user.hasAvatar ? `/api/v1/users/${member.user.id}/avatar` : undefined}
                  />
                }
                title={member.user.displayName || member.user.username}
                description={
                  <Space size={8}>
                    <Tag color={shelfRoleMeta[member.role].color} bordered={false}>
                      {shelfRoleMeta[member.role].label}
                    </Tag>
                    <Typography.Text type="secondary">{shelfRoleMeta[member.role].description}</Typography.Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
};
