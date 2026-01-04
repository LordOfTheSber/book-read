import { theme } from 'antd';

export const useProfilePageStyles = () => {
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
      gap: 24
    },
    heroCard: {
      background: token.colorBgContainer,
      borderRadius: 14,
      boxShadow: token.boxShadowSecondary,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    },
    heroBanner: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
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
      position: 'sticky' as const,
      top: 24,
      minWidth: 300,
      maxWidth: 360
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
