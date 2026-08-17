/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      /*
       * injectManifest, а не generateSW: правила кеширования у нас содержательные (обложки — одно,
       * запросы библиотеки — другое, `/auth/` — никогда), и описывать их конфигом генератора
       * тяжелее, чем написать сам worker. Плагин при этом всё равно нужен: список файлов сборки
       * с хешами имён руками не собрать.
       */
      strategies: 'injectManifest',
      srcDir: 'src/app/pwa',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      /*
       * В деве service worker выключен намеренно. Playwright гоняет сценарии против `npm run dev`,
       * и зарегистрированный worker с собственным кешем превращается в источник межтестовой
       * флакости. Очередь отложенных изменений при этом живёт на странице, а не в worker, поэтому
       * проверяется и без него.
       */
      devOptions: { enabled: false },
      manifest: {
        name: 'BookRead',
        short_name: 'BookRead',
        description: 'Трекер прочитанного: библиотека, прогресс чтения, цели и выписки',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        // Основной цвет светлой темы, а не умолчание antd: им браузер красит панель
        // установленного приложения, и она не должна спорить с интерфейсом.
        theme_color: '#2563eb',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          // Отдельная иконка под маску Android: там глиф ужат в безопасную зону, иначе
          // система срезала бы углы книги вместе с частью корешка.
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Ant Design и Playwright живут в соседних папках: сюда попадают только юнит-тесты.
    include: ['src/**/*.test.{ts,tsx}'],
    /*
     * Пять секунд по умолчанию не хватает формам Ant Design: панель книги с вкладками
     * монтируется секунды, и под нагрузкой CI отдельные проверки падали по таймауту, ничего
     * не сломав. Пятнадцать — с запасом к самой медленной из них и всё ещё быстро для зависшей.
     */
    testTimeout: 15_000
  }
});
