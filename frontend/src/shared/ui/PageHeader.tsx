import React from 'react';
import { Grid, Space, Typography, theme } from 'antd';
import { useDocumentTitle } from '@/shared/lib/documentTitle';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Кнопки основного действия справа (на мобильном переносятся вниз). */
  actions?: React.ReactNode;
  /** Заголовок вкладки, когда видимый заголовок не строка (узел, публичный профиль). */
  documentTitle?: string;
  /**
   * На телефоне заголовок не показывается: имя раздела уже стоит в верхней строке оболочки,
   * и второй такой же занимает четверть экрана. Подпись при этом остаётся — в ней счётчики.
   */
  hideTitleOnMobile?: boolean;
}

/**
 * Заголовок страницы вместо обёртки в Card: страница начинается с контента,
 * а не с рамки внутри рамки.
 *
 * Отсюда же берётся заголовок вкладки: он всегда совпадает с тем, что человек видит
 * на странице, и не расходится с ним при добавлении новых разделов.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  documentTitle,
  hideTitleOnMobile
}) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  useDocumentTitle(documentTitle ?? (typeof title === 'string' ? title : undefined));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'flex-end',
        justifyContent: 'space-between',
        gap: token.marginSM,
        marginBottom: token.margin
      }}
    >
      <div style={{ minWidth: 0 }}>
        {!(isMobile && hideTitleOnMobile) && (
          <Typography.Title
            level={2}
            style={{ margin: 0, fontSize: isMobile ? 24 : 30, lineHeight: 1.2, letterSpacing: -0.4 }}
          >
            {title}
          </Typography.Title>
        )}
        {subtitle && (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {actions && (
        <Space size={8} wrap style={{ flexShrink: 0 }}>
          {actions}
        </Space>
      )}
    </div>
  );
};
