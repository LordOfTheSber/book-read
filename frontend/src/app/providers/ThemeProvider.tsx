import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme as antdTheme, ThemeConfig } from 'antd';
import ruRU from 'antd/locale/ru_RU';

export type ThemeMode = 'light' | 'dark' | 'teal';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const themeOptions: Array<{ value: ThemeMode; label: string; swatch: string }> = [
  { value: 'light', label: 'Светлая', swatch: '#f6f7f9' },
  { value: 'teal', label: 'Бирюзовая', swatch: '#0fbf9f' },
  { value: 'dark', label: 'Тёмная', swatch: '#171a21' }
];

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

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Общая для всех тем геометрия и типографика — цвета задаются отдельно. */
const baseToken: ThemeConfig['token'] = {
  fontFamily: fontStack,
  fontSize: 14,
  borderRadius: 10,
  borderRadiusLG: 14,
  borderRadiusSM: 8,
  controlHeight: 36,
  wireframe: false
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('app-theme', mode);
      document.documentElement.dataset.theme = mode;
    }
  }, [mode]);

  const themeConfig = useMemo<ThemeConfig>(() => {
    if (mode === 'dark') {
      return {
        algorithm: antdTheme.darkAlgorithm,
        token: {
          ...baseToken,
          colorPrimary: '#3b82f6',
          colorBgLayout: '#0f1115',
          colorBgContainer: '#171a21',
          colorBgElevated: '#1d212a',
          colorBorderSecondary: '#262b35',
          boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
          boxShadowSecondary: '0 4px 16px rgba(0,0,0,0.35)'
        },
        components: {
          Layout: { headerBg: '#171a21', bodyBg: '#0f1115' },
          Menu: { itemBg: 'transparent', horizontalItemSelectedColor: '#3b82f6' }
        }
      };
    }

    if (mode === 'teal') {
      return {
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          ...baseToken,
          colorPrimary: '#0d9488',
          colorInfo: '#0d9488',
          colorLink: '#0d9488',
          colorBgLayout: '#eef7f5',
          colorBgContainer: '#ffffff',
          colorBorderSecondary: '#d7ebe6',
          boxShadow: '0 1px 2px rgba(13,148,136,0.10)',
          boxShadowSecondary: '0 4px 16px rgba(13,148,136,0.12)'
        },
        components: {
          Layout: { headerBg: '#ffffff', bodyBg: '#eef7f5' },
          Menu: { itemBg: 'transparent' }
        }
      };
    }

    return {
      algorithm: antdTheme.defaultAlgorithm,
      token: {
        ...baseToken,
        colorPrimary: '#2563eb',
        colorBgLayout: '#f6f7f9',
        colorBgContainer: '#ffffff',
        colorBorderSecondary: '#eaecf0',
        boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
        boxShadowSecondary: '0 4px 16px rgba(16,24,40,0.08)'
      },
      components: {
        Layout: { headerBg: '#ffffff', bodyBg: '#f6f7f9' },
        Menu: { itemBg: 'transparent' }
      }
    };
  }, [mode]);

  const value = useMemo<ThemeContextValue>(() => ({ mode, setMode }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={themeConfig} locale={ruRU}>
        {children}
      </ConfigProvider>
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
