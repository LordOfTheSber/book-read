import { theme } from 'antd';

export const useProfilePageStyles = (isMobile: boolean) => {
  const { token } = theme.useToken();
  return {
    pageCard: {
      border: 'none',
      borderRadius: 16,
      boxShadow: token.boxShadow,
      background: token.colorBgLayout
    },
    pageHead: {
      padding: '16px 24px',
      fontSize: 20,
      fontWeight: 600
    },
    pageBody: {
      padding: 24
    },
    contentWrapper: {
      gap: 24,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'flex-start'
    },
    heroCard: {
      background: token.colorBgContainer,
      borderRadius: 14,
      boxShadow: token.boxShadowSecondary,
      padding: 18,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 18
    },
    heroBanner: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap' as const,
      width: '100%',
      minWidth: 0,
      padding: 14,
      borderRadius: 12,
      background: `linear-gradient(120deg, ${token.colorPrimary} 0%, ${token.colorPrimaryHover} 70%, ${token.colorInfo} 100%)`,
      color: token.colorWhite
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12
    },
    achievementsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 12
    },
    achievementCard: {
      height: '100%',
      borderRadius: 12
    },
    badgeImage: {
      width: 72,
      height: 72,
      borderRadius: 12,
      boxShadow: token.boxShadowSecondary
    },
    sideCard: {
      background: token.colorBgContainer,
      borderRadius: 14,
      boxShadow: token.boxShadowSecondary,
      padding: 0,
      position: isMobile ? ('static' as const) : ('sticky' as const),
      top: isMobile ? undefined : 24,
      minWidth: isMobile ? 'auto' : 300,
      maxWidth: isMobile ? '100%' : 360,
      width: isMobile ? '100%' : 'auto'
    },
    sideCardBody: {
      padding: 18
    },
    sectionTitle: {
      margin: '0 0 6px'
    },
    secondaryText: {
      color: token.colorTextSecondary
    }
  };
};
