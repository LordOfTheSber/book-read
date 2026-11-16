import React from 'react';
import { Avatar, Button, Card, Form, Grid, Input, Switch, Typography, theme } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/shared/lib/hooks';
import { PublicProfile } from '@/shared/types/library';
import { displayFont } from '@/shared/config/brand';
import { formatDate } from '@/shared/lib/date';

export interface ProfileFormValues {
  displayName?: string;
  bio?: string;
  publicProfile: boolean;
}

interface Props {
  form: ReturnType<typeof Form.useForm<ProfileFormValues>>[0];
  profile: PublicProfile | null;
  saving: boolean;
  onSave: (values: ProfileFormValues) => void;
}

/**
 * Публичная страница: слева то, что о себе пишут, справа — то, что из этого получается.
 *
 * Предпросмотр — главное, чего не было: понять, что увидят другие, можно было только уйдя
 * на `/u/:username` и вернувшись обратно. Здесь карточка обновляется по ходу ввода.
 */
export const PublicTab: React.FC<Props> = ({ form, profile, saving, onSave }) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const user = useAppSelector((state) => state.auth.user);
  const values = Form.useWatch([], form) ?? {};

  const avatarSrc =
    user?.avatar && user.avatarContentType ? `data:${user.avatarContentType};base64,${user.avatar}` : undefined;
  const shownName = values.displayName || profile?.displayName || user?.username;
  const shownBio = values.bio ?? profile?.bio;
  const isPublic = values.publicProfile ?? profile?.publicProfile ?? false;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: screens.lg ? 'minmax(0, 1fr) minmax(0, 380px)' : 'minmax(0, 1fr)',
        gap: token.margin,
        alignItems: 'start'
      }}
    >
      <Card title="Кто вы для других">
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {user?.username
            ? `Логин остаётся прежним — он в адресе страницы: /u/${user.username}`
            : 'Логин остаётся прежним — он и есть адрес страницы.'}
        </Typography.Paragraph>

        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="displayName" label="Имя для показа">
            <Input placeholder={user?.username} maxLength={128} />
          </Form.Item>
          <Form.Item name="bio" label="О себе">
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={2000} showCount />
          </Form.Item>

          {/*
            Последствия переключателя названы рядом с ним: «открыт» и «закрыт» сами по себе
            не говорят, что закрытый профиль убирает события и из чужих лент.
          */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 14,
              marginBottom: 16,
              borderRadius: token.borderRadius,
              background: token.colorFillQuaternary
            }}
          >
            <Form.Item name="publicProfile" valuePropName="checked" noStyle>
              <Switch checkedChildren="открыт" unCheckedChildren="закрыт" />
            </Form.Item>
            <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {isPublic
                ? 'Страницу видят другие пользователи сервиса — анонимным посетителям она не открывается. Ваши события попадают в их ленты.'
                : 'Страницу не видит никто, кроме вас. Ваши события пропадают и из чужих лент.'}
            </Typography.Text>
          </div>

          <Button type="primary" htmlType="submit" loading={saving}>
            Сохранить
          </Button>
        </Form>
      </Card>

      <Card
        title="Так вас видят другие"
        extra={user && <Link to={`/u/${user.username}`}>Открыть страницу</Link>}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {avatarSrc ? <Avatar size={56} src={avatarSrc} /> : <Avatar size={56} icon={<UserOutlined />} />}
          <div style={{ minWidth: 0 }}>
            <Typography.Text strong style={{ display: 'block', fontFamily: displayFont, fontSize: 17 }}>
              {shownName}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {[user?.username && `@${user.username}`, user?.createdAt ? `с нами с ${formatDate(user.createdAt)}` : undefined]
                .filter(Boolean)
                .join(' · ')}
            </Typography.Text>
          </div>
        </div>

        {shownBio ? (
          <Typography.Paragraph style={{ marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
            {shownBio}
          </Typography.Paragraph>
        ) : (
          <Typography.Paragraph type="secondary" style={{ marginTop: 14, marginBottom: 0 }}>
            Без описания страница остаётся именем и списком книг.
          </Typography.Paragraph>
        )}

        {!isPublic && (
          <Typography.Paragraph
            type="secondary"
            style={{ marginTop: 14, marginBottom: 0, fontSize: 13 }}
          >
            Пока профиль закрыт, эту карточку видите только вы.
          </Typography.Paragraph>
        )}
      </Card>
    </div>
  );
};
