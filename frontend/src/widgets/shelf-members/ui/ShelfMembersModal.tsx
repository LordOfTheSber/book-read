import React, { useEffect, useState } from 'react';
import { App, Avatar, Button, Empty, List, Modal, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { ProfileSummary, Shelf, ShelfMember, ShelfRole } from '@/shared/types/library';
import { shelfRoleMeta } from '@/shared/constants/social';
import { useRequestError } from '@/shared/lib/errors';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { addShelfMember, fetchShelfMemberCandidates, fetchShelfMembers, removeShelfMember } from '@/entities/shelf';

interface Props {
  shelf: Shelf | null;
  onClose: () => void;
}

const roleOptions = (Object.keys(shelfRoleMeta) as ShelfRole[]).map((role) => ({
  value: role,
  label: `${shelfRoleMeta[role].label} — ${shelfRoleMeta[role].description.toLowerCase()}`
}));

/**
 * Участники совместной полки: семейной или клубной. Кандидаты приходят списком и сужаются вводом —
 * помнить чужой логин наизусть нельзя требовать от того, кто зовёт родственника на семейную полку.
 * Список отдаётся только куратору этой полки, поэтому перечислением пользователей он не является.
 */
export const ShelfMembersModal: React.FC<Props> = ({ shelf, onClose }) => {
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [members, setMembers] = useState<ShelfMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState<string | undefined>();
  const [role, setRole] = useState<ShelfRole>('CONTRIBUTOR');
  const [inviting, setInviting] = useState(false);
  const [candidates, setCandidates] = useState<ProfileSummary[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const debouncedQuery = useDebouncedValue(candidateQuery, 300);

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

  /** Список обновляется и после приглашения: добавленный должен уйти из кандидатов. */
  useEffect(() => {
    if (!shelf?.canCurate) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setCandidatesLoading(true);
    fetchShelfMemberCandidates(shelf.id, debouncedQuery.trim() || undefined)
      .then((found) => {
        if (!cancelled) setCandidates(found);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setCandidatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shelf, debouncedQuery, members]);

  const invite = async () => {
    if (!shelf || !username) return;
    setInviting(true);
    try {
      setMembers(await addShelfMember(shelf.id, username, role));
      setUsername(undefined);
      setCandidateQuery('');
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
        <Space direction="vertical" size={8} style={{ display: 'flex', marginBottom: 16 }}>
          <Select
            showSearch
            allowClear
            value={username}
            onChange={setUsername}
            onSearch={setCandidateQuery}
            searchValue={candidateQuery}
            // Фильтрует сервер: на клиенте лежат только первые двадцать найденных.
            filterOption={false}
            loading={candidatesLoading}
            placeholder="Выберите пользователя или начните вводить логин"
            notFoundContent={candidatesLoading ? 'Ищем…' : 'Никого не нашлось'}
            style={{ width: '100%' }}
            options={candidates.map((candidate) => ({
              value: candidate.username,
              label: candidate.displayName ? `${candidate.displayName} · @${candidate.username}` : candidate.username
            }))}
          />
          <Space size={8} wrap style={{ display: 'flex' }}>
            <Select value={role} onChange={setRole} options={roleOptions} style={{ minWidth: 280, flex: 1 }} />
            <Button type="primary" loading={inviting} disabled={!username} onClick={invite}>
              Добавить
            </Button>
          </Space>
        </Space>
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
