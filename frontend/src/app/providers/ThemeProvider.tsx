import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { App as AntdApp, ConfigProvider, theme as antdTheme, ThemeConfig } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { brand, uiFont } from '@/shared/config/brand';
import { alpha, mix } from '@/shared/lib/color';

export type ThemeMode = 'light' | 'dark' | 'teal';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const themeOptions: Array<{ value: ThemeMode; label: string; swatch: string }> = [
  { value: 'light', label: 'Бумага', swatch: brand.paper },
  { value: 'teal', label: 'Бирюзовая', swatch: '#0fbf9f' },
  { value: 'dark', label: 'Ночь', swatch: brand.night.surface }
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

/**
 * Хлебные крошки во всех темах.
 *
 * Ant Design красит промежуточные крошки в `colorTextDescription` — прозрачность 0.45. На бумаге
 * это 3.3:1, ночью 4.3:1: путь наверх («Библиотека») читался хуже подписи под полем и сливался
 * с разделителем, хотя это единственная ссылка из карточки записи обратно в список.
 *
 * Берём уровень «вторичного» текста (0.65), а наведение красим в цвет ссылок темы — так видно
 * и саму надпись, и то, что по ней можно уйти. Название текущей страницы остаётся самым ярким,
 * а разделитель — самым тихим: подняв и его, мы получили бы строку из одинаково громких кусков.
 */
const breadcrumb = (item: string, hover: string) => ({
  itemColor: item,
  linkColor: item,
  linkHoverColor: hover
});

/** Общая для всех тем геометрия и типографика — цвета задаются отдельно. */
const baseToken: ThemeConfig['token'] = {
  fontFamily: uiFont,
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
          // Ночью акцентом становится сама закладка: чернила на чернильном фоне не видны.
          colorPrimary: brand.bookmark,
          colorInfo: brand.bookmark,
          colorLink: '#DE8461',
          colorSuccess: '#5C9E7C',
          colorWarning: brand.amber,
          colorError: '#C25050',
          colorBgLayout: brand.night.layout,
          colorBgContainer: brand.night.surface,
          colorBgElevated: brand.night.elevated,
          colorBorderSecondary: brand.night.border,
          boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
          boxShadowSecondary: '0 4px 16px rgba(0,0,0,0.35)'
        },
        components: {
          Layout: { headerBg: brand.night.surface, bodyBg: brand.night.layout },
          Menu: { itemBg: 'transparent', horizontalItemSelectedColor: brand.bookmark },
          Breadcrumb: breadcrumb('rgba(255, 255, 255, 0.65)', '#DE8461')
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
          Menu: { itemBg: 'transparent' },
          Breadcrumb: breadcrumb('rgba(0, 0, 0, 0.65)', '#0d9488')
        }
      };
    }

    return {
      algorithm: antdTheme.defaultAlgorithm,
      token: {
        ...baseToken,
        // Чернила — основной цвет каркаса. Закладка остаётся единственным тёплым акцентом
        // и живёт на прогрессе, ссылках и активных состояниях, а не на каждой кнопке.
        colorPrimary: brand.ink,
        colorInfo: brand.ink,
        // Производные тона Ant Design считает от основного цвета, и у тёмных чернил они
        // выходят серыми: подсветка вкладки становилась мышиного цвета. Задаём явно —
        // разбавленными чернилами, как в макетах.
        colorPrimaryBg: mix(brand.ink, brand.surface, 0.92),
        colorPrimaryBgHover: mix(brand.ink, brand.surface, 0.86),
        colorPrimaryBorder: mix(brand.ink, brand.surface, 0.76),
        colorPrimaryHover: mix(brand.ink, brand.surface, 0.16),
        colorPrimaryActive: mix(brand.ink, '#000000', 0.16),
        // То же для статусных цветов: чипы «Читаю», «Завершено» и «Заброшено» должны быть
        // бумажными заливками с цветным текстом, а не сплошными пятнами.
        colorInfoBg: mix(brand.ink, brand.surface, 0.92),
        colorInfoBorder: mix(brand.ink, brand.surface, 0.76),
        colorInfoText: brand.ink,
        colorSuccessBg: brand.mossBg,
        colorSuccessBorder: mix(brand.moss, brand.surface, 0.7),
        colorSuccessText: brand.moss,
        colorWarningBg: brand.amberBg,
        colorWarningBorder: mix(brand.amber, brand.surface, 0.7),
        colorWarningText: brand.amber,
        colorErrorBg: brand.waxBg,
        colorErrorBorder: mix(brand.wax, brand.surface, 0.7),
        colorErrorText: brand.wax,
        colorLink: brand.bookmarkText,
        colorLinkHover: brand.bookmarkHover,
        colorSuccess: brand.moss,
        colorWarning: brand.amber,
        colorError: brand.wax,
        colorTextBase: brand.inkText,
        colorBgLayout: brand.paper,
        colorBgContainer: brand.surface,
        colorBgElevated: brand.surface,
        colorBorder: brand.binding,
        colorBorderSecondary: brand.binding,
        // Заливки тоже бумажные, а не серые: холодный серый рядом с тёплым фоном
        // читается как грязное пятно, особенно на больших плоскостях вроде выписок.
        colorFillQuaternary: mix(brand.paperSoft, brand.surface, 0.45),
        colorFillTertiary: brand.paperSoft,
        colorFillSecondary: brand.bindingSoft,
        colorFill: brand.binding,
        boxShadow: `0 1px 2px ${alpha(brand.ink, 0.06)}`,
        boxShadowSecondary: `0 8px 28px ${alpha(brand.ink, 0.1)}`
      },
      components: {
        Layout: { headerBg: brand.surface, bodyBg: brand.paper },
        Menu: { itemBg: 'transparent' },
        // Прогресс — это закладка, а не основной цвет: полоса и ленточка на обложке
        // должны читаться как одна и та же вещь.
        Progress: { defaultColor: brand.bookmark },
        Slider: { trackBg: brand.bookmark, trackHoverBg: brand.bookmarkHover },
        Breadcrumb: breadcrumb(alpha(brand.inkText, 0.65), brand.bookmarkText)
      }
    };
  }, [mode]);

  const value = useMemo<ThemeContextValue>(() => ({ mode, setMode }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={themeConfig} locale={ruRU}>
        {/* App даёт message/modal/notification через контекст: статические
            вызовы antd не видят тему и рисуют светлые окна поверх тёмной. */}
        <AntdApp component={false}>{children}</AntdApp>
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
