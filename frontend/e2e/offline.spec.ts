import { expect, test } from '@playwright/test';

/**
 * Офлайн-сценарий на живом стеке. Service worker в деве выключен намеренно, и он здесь не нужен:
 * очередь отложенных правок живёт на странице, а не в worker, — потому что продлевать истёкший
 * токен умеет только перехватчик httpClient.
 */

const uniqueUsername = () => `e2e${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PASSWORD = 'Password123';

const registerNewUser = async (page: import('@playwright/test').Page) => {
  const username = uniqueUsername();

  await page.goto('/register');
  await page.getByLabel('Логин').fill(username);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Повторите пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();

  // Пятисекундного ожидания по умолчанию первой отрисовке после регистрации не всегда хватает:
  // на холодном старте проверка падала, ничего при этом не сломав.
  await expect(page.getByRole('button', { name: 'Добавить запись' }).first()).toBeVisible({ timeout: 15_000 });
  return username;
};

const addBook = async (page: import('@playwright/test').Page, title: string) => {
  await page.getByRole('button', { name: 'Добавить запись' }).first().click();
  await page.getByLabel('Название', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  // Название всплывает и в списке, и в уведомлении об успехе: берём строго карточку.
  await expect(page.getByText(title, { exact: true })).toBeVisible();
};

test('правка без сети ложится в очередь и доезжает после её возвращения', async ({ page }) => {
  await registerNewUser(page);
  const title = `Дюна ${Date.now()}`;
  await addBook(page, title);

  // Обрываем только правку записи: остальное приложение должно продолжать работать.
  await page.route('**/api/v1/items/*', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.abort('internetdisconnected');
      return;
    }
    await route.continue();
  });

  await page.getByLabel('Редактировать').first().click();
  await page.getByLabel('Альтернативное название').fill('Dune');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();

  // Правка не потеряна и не молчит: чип в шапке показывает, сколько ждёт отправки.
  await expect(page.getByText(/1 правка не ушла|1 правка ждёт сети/)).toBeVisible();

  await page.unroute('**/api/v1/items/*');
  // Возврат сети приложение узнаёт от браузера — эмулируем то же событие.
  await page.evaluate(() => window.dispatchEvent(new Event('online')));

  await expect(page.getByText(/правка не ушла|правка ждёт сети|Нет сети/)).toBeHidden();

  // Правка действительно доехала до сервера, а не осталась в состоянии страницы.
  await page.reload();
  await page.getByLabel('Редактировать').first().click();
  await expect(page.getByLabel('Альтернативное название')).toHaveValue('Dune');
});

test('очередь не хранит ничего, похожего на учётные данные', async ({ page, context }) => {
  await registerNewUser(page);
  const title = `Гиперион ${Date.now()}`;
  await addBook(page, title);

  await page.route('**/api/v1/items/*', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.abort('internetdisconnected');
      return;
    }
    await route.continue();
  });

  await page.getByLabel('Редактировать').first().click();
  await page.getByLabel('Альтернативное название').fill('Hyperion');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText(/1 правка не ушла|1 правка ждёт сети/)).toBeVisible();

  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('library-tracker-offline');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('pending-mutations').objectStore('pending-mutations').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return JSON.stringify(rows);
  });

  expect(stored).toContain('Hyperion');

  // Куки остаются httpOnly, и в хранилище очереди им делать нечего.
  const cookies = await context.cookies();
  for (const cookie of cookies) {
    expect(stored).not.toContain(cookie.value);
  }
});
