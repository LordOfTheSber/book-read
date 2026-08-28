import React, { useState } from 'react';
import { App, Avatar, Button, Grid, Image, Tag, Typography, Upload, theme } from 'antd';
import type { UploadProps } from 'antd';
import { CameraOutlined, CheckCircleOutlined, ExportOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { uploadAvatarThunk } from '@/entities/auth';
import { PublicProfile } from '@/shared/types/library';
import { roleMeta } from '@/shared/constants/roles';
import { displayFont } from '@/shared/config/brand';
import { formatDate } from '@/shared/lib/date';
import { useRequestError } from '@/shared/lib/errors';
import { pluralize } from '@/shared/lib/plural';

interface Props {
  profile: PublicProfile | null;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

/**
 * Шапка профиля — общая для всех вкладок.
 *
 * Кто вы, сколько за вами читателей и открыта ли страница, видно с любой вкладки: раньше
 * признак публичности лежал переключателем в середине свитка, а узнать, что увидят другие,
 * можно было только уйдя на свою публичную страницу и вернувшись.
 */
export const ProfileHeader: React.FC<Props> = ({ profile }) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const showRequestError = useRequestError();
  const user = useAppSelector((state) => state.auth.user);
  const updatingAvatar = useAppSelector((state) => state.auth.updatingAvatar);
  const [preview, setPreview] = useState(false);

  const avatarSrc =
    user?.avatar && user.avatarContentType ? `data:${user.avatarContentType};base64,${user.avatar}` : undefined;

  const upload: UploadProps['beforeUpload'] = async (file) => {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      message.error('Поддерживаются только PNG, JPEG, WEBP или GIF');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      message.error('Размер файла не должен превышать 2 МБ');
      return Upload.LIST_IGNORE;
    }
    try {
      await dispatch(uploadAvatarThunk(file)).unwrap();
      message.success('Аватар обновлён');
    } catch (error) {
      showRequestError(error, 'Не удалось загрузить аватар');
    }
    // false — загружаем сами через thunk, встроенный аплоад antd не нужен.
    return false;
  };

  const isPublic = profile?.publicProfile;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: isMobile ? 14 : 20,
        flexWrap: 'wrap',
        padding: isMobile ? 16 : 20,
        marginBottom: 14,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG
      }}
    >
      {avatarSrc ? (
        <>
          <Avatar size={isMobile ? 64 : 88} src={avatarSrc} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setPreview(true)} />
          <Image
            src={avatarSrc}
            style={{ display: 'none' }}
            preview={{ visible: preview, onVisibleChange: setPreview }}
          />
        </>
      ) : (
        <Avatar size={isMobile ? 64 : 88} icon={<UserOutlined />} style={{ flexShrink: 0 }} />
      )}

      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Typography.Title
            level={2}
            style={{ margin: 0, fontFamily: displayFont, fontSize: isMobile ? 20 : 24, lineHeight: 1.2 }}
          >
            {profile?.displayName || user?.username || 'Профиль'}
          </Typography.Title>
          {user?.role && (
            <Tag color={roleMeta[user.role]?.color ?? 'default'} bordered={false} style={{ margin: 0 }}>
              {roleMeta[user.role]?.label ?? user.role}
            </Tag>
          )}
        </div>

        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 5 }}>
          {/* Пользователь догружается запросом: до ответа подпись не должна быть «@undefined». */}
          {[user?.username && `@${user.username}`, user?.createdAt ? `с нами с ${formatDate(user.createdAt)}` : undefined]
            .filter(Boolean)
            .join(' · ')}
        </Typography.Text>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Typography.Text type="secondary">
            <Typography.Text strong>{profile?.followerCount ?? 0}</Typography.Text>{' '}
            {pluralize(profile?.followerCount ?? 0, ['подписчик', 'подписчика', 'подписчиков']).replace(/^\d+\s/, '')}
          </Typography.Text>
          <Typography.Text type="secondary">
            <Typography.Text strong>{profile?.followingCount ?? 0}</Typography.Text> в подписках
          </Typography.Text>
          {/* Открыт профиль или закрыт — состояние, а не настройка: его место рядом с именем. */}
          <Typography.Text style={{ color: isPublic ? token.colorSuccess : token.colorTextTertiary, fontSize: 13 }}>
            {isPublic ? <CheckCircleOutlined /> : <LockOutlined />} {isPublic ? 'Профиль открыт' : 'Профиль закрыт'}
          </Typography.Text>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        {user && (
          <Link to={`/u/${user.username}`}>
            <Button icon={<ExportOutlined />}>Моя публичная страница</Button>
          </Link>
        )}
        <Upload showUploadList={false} beforeUpload={upload}>
          <Button icon={<CameraOutlined />} loading={updatingAvatar} aria-label="Сменить аватар">
            {isMobile ? undefined : 'Аватар'}
          </Button>
        </Upload>
      </div>
    </div>
  );
};
