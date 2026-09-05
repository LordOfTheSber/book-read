/**
 * Иконки приложения из знака бренда.
 *
 * Знак живёт в двух местах — `shared/ui/Logo` и `public/favicon.svg`, — а иконки PWA были
 * растровыми и остались от прежнего оформления: синий градиент, который в системном меню
 * выглядел иконкой другого приложения. Здесь они рисуются из той же геометрии, чтобы
 * перерисовка знака не требовала художника.
 *
 * Запуск: `node tools/generate-icons.mjs public` (нужен установленный Chromium от Playwright).
 */
import { chromium } from '@playwright/test';
import path from 'path';

const INK = '#1B2A4A';
const PAPER = '#FBF8F3';
const BOOKMARK = '#C8552F';
const out = process.argv[2] ?? 'public';

/** Знак из shared/ui/Logo: корешок 44×48 с линией сгиба и полной лентой. */
const mark = (size, glyph) => {
  const offset = (size - glyph) / 2;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${PAPER}"/>
      <svg x="${offset}" y="${offset}" width="${glyph}" height="${glyph}" viewBox="0 0 64 64">
        <rect x="10" y="8" width="44" height="48" rx="9" fill="${INK}"/>
        <rect x="18" y="8" width="3" height="48" fill="${PAPER}" opacity="0.22"/>
        <path d="M34 8h11v40l-5.5-6.5L34 48z" fill="${BOOKMARK}"/>
      </svg>
    </svg>`;
};

const icons = [
  { file: 'pwa-192.png', size: 192, glyph: 192 },
  { file: 'pwa-512.png', size: 512, glyph: 512 },
  // Маскируемая: глиф ужат в безопасную зону, иначе система срежет углы вместе с корешком.
  { file: 'pwa-512-maskable.png', size: 512, glyph: 512 * 0.68 },
  { file: 'apple-touch-icon.png', size: 180, glyph: 180 }
];

// Путь к браузеру задаётся переменной там, где Chromium развёрнут отдельно от Playwright.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage();
for (const icon of icons) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(
    `<body style="margin:0">${mark(icon.size, icon.glyph)}</body>`,
    { waitUntil: 'load' }
  );
  await page.screenshot({ path: path.join(out, icon.file), clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
  console.log('нарисовано', icon.file);
}
await browser.close();
