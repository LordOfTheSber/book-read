import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme as antdTheme, ThemeConfig } from 'antd';
import { AliasToken } from 'antd/es/theme/interface';

type ThemeMode = 'light' | 'dark' | 'teal';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getInitialMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const stored = window.localStorage.getItem('app-theme');
  if (stored === 'dark' || stored === 'teal') {
    return stored;
  }

  return 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('app-theme', mode);
    }
  }, [mode]);

  const themeConfig = useMemo<ThemeConfig>(() => {
    const baseTokens = {
      borderRadius: 12,
      fontFamily: antdTheme.defaultSeed.fontFamily,
      colorPrimary: antdTheme.defaultSeed.colorPrimary,
      boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
      boxShadowSecondary: '0 6px 18px rgba(0,0,0,0.12)',
      margin: 16,
      marginSM: 12,
      paddingXS: 8
    } as ThemeConfig['token'] & Partial<AliasToken>;

    const lightTokens = {
      ...baseTokens,
      colorBgContainer: '#ffffff'
    } as ThemeConfig['token'];

    if (mode === 'teal') {
      return {
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          ...baseTokens,
          colorPrimary: '#0fbf9f',
          colorInfo: '#14d6b1',
          colorBgLayout: '#e9fbf6',
          colorBgContainer: '#f8fffd',
          colorText: '#0f3631',
          colorBorder: '#b9e8df',
          colorLink: '#0fbf9f',
          controlItemBgActive: '#d2f6ed'
        } as ThemeConfig['token'],
        components: {
          Layout: {
            headerBg: 'linear-gradient(120deg, #0fbf9f 0%, #12a4d9 65%, #12d1b8 100%)'
          },
          Segmented: {
            itemSelectedBg: '#d2f6ed'
          }
        }
      } as ThemeConfig;
    }

    const isDark = mode === 'dark';

    return {
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: isDark ? baseTokens : lightTokens
    } as ThemeConfig;
  }, [mode]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    setMode
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeMode = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return ctx;
};
