import React from 'react';
import { Button, Card, Dropdown, Space, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';
import { themeOptions, useThemeMode } from '@/app/providers/ThemeProvider';
import { APP_NAME, useDocumentTitle } from '@/shared/lib/documentTitle';
import { Logo } from './Logo';

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Ссылка на соседний экран: «нет аккаунта?» / «уже есть аккаунт?». */
  footer?: React.ReactNode;
}

/**
 * Обёртка для входа и регистрации: эти экраны живут вне основного layout,
 * поэтому фон, шапку с логотипом и выбор темы задаём здесь.
 */
export const AuthLayout: React.FC<Props> = ({ title, subtitle, children, footer }) => {
  const { token } = theme.useToken();
  const { mode, setMode } = useThemeMode();

  useDocumentTitle(title);

  const themeMenu: MenuProps = {
    selectable: false,
    items: themeOptions.map((option) => ({
      key: option.value,
      onClick: () => setMode(option.value),
      label: (
        <Space size={10}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: option.swatch,
              border: `1px solid ${token.colorBorder}`
            }}
          />
          <span style={{ flex: 1 }}>{option.label}</span>
          {mode === option.value && <CheckOutlined style={{ color: token.colorPrimary, fontSize: 12 }} />}
        </Space>
      )
    }))
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: token.colorBgLayout,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        position: 'relative'
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <Dropdown menu={themeMenu} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<BgColorsOutlined />} aria-label="Сменить тему" />
        </Dropdown>
      </div>

      <div style={{ width: '100%', maxWidth: 420 }}>
        <Space size={10} align="center" style={{ marginBottom: 20, justifyContent: 'center', width: '100%' }}>
          <Logo size={32} />
          <Typography.Text style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.2 }}>
            {APP_NAME}
          </Typography.Text>
        </Space>

        <Card
          style={{ marginBottom: 0, borderRadius: token.borderRadiusLG, borderColor: token.colorBorderSecondary }}
          styles={{ body: { padding: 28 } }}
        >
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: subtitle ? 4 : 20 }}>
            {title}
          </Typography.Title>
          {subtitle && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
              {subtitle}
            </Typography.Paragraph>
          )}
          {children}
        </Card>

        {footer && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Typography.Text type="secondary">{footer}</Typography.Text>
          </div>
        )}
      </div>
    </div>
  );
};
