import { defineConfig, devices } from '@playwright/test';

const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5173);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8080);
const BACKEND_JAR = process.env.E2E_BACKEND_JAR ?? '../backend/target/library-tracker-0.0.1-SNAPSHOT.jar';

/**
 * Сценарии ходят через настоящий стек: собранный бэкенд, dev-сервер Vite с проксированием /api
 * и живую PostgreSQL. Иначе e2e проверял бы моки, а не приложение.
 *
 * Перед запуском нужны собранный jar (`mvn -f ../backend/pom.xml package -DskipTests`) и БД;
 * координаты БД берутся из DB_URL / DB_USER / DB_PASSWORD.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
    // Обычно браузер ставит сам Playwright; переменная нужна там, где Chromium уже развёрнут
    // отдельно и его версия не совпадает с ожидаемой.
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {}
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `java -jar ${BACKEND_JAR}`,
      // Здоровье отдаёт Actuator — тот же endpoint, что опрашивают пробы в Kubernetes.
      url: `http://localhost:${BACKEND_PORT}/actuator/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(BACKEND_PORT),
        DB_URL: process.env.DB_URL ?? 'jdbc:postgresql://localhost:5432/library',
        DB_USER: process.env.DB_USER ?? 'library',
        DB_PASSWORD: process.env.DB_PASSWORD ?? 'library',
        // Секрет одноразовый: тестовый прогон переживать перезапуск не обязан.
        SECURITY_JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret'
      }
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
