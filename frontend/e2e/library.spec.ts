import { expect, test } from '@playwright/test';

/**
 * Сквозные сценарии на живом стеке: браузер → dev-сервер Vite → бэкенд → PostgreSQL.
 * Здесь проверяется то, чего не видно ни в юнит-тестах фронтенда, ни в MockMvc-тестах бэкенда:
 * что аутентификация на httpOnly-куках вообще работает в браузере.
 */

/** Регистрация уникальна: прогон не должен зависеть от того, что осталось в базе с прошлого раза. */
const uniqueUsername = () => `e2e${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PASSWORD = 'Password123';

const registerNewUser = async (page: import('@playwright/test').Page) => {
  const username = uniqueUsername();

  await page.goto('/register');
  await page.getByLabel('Логин').fill(username);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Повторите пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();

  // Кнопка есть и в шапке страницы, и в заглушке пустого списка.
  await expect(page.getByRole('button', { name: 'Добавить запись' }).first()).toBeVisible();
  return username;
};

test('регистрация приводит на страницу библиотеки, а токен остаётся в httpOnly-куке', async ({ page, context }) => {
  await registerNewUser(page);

  const cookies = await context.cookies();
  const accessToken = cookies.find((cookie) => cookie.name === 'ACCESS_TOKEN');

  expect(accessToken?.httpOnly).toBe(true);
  // Токен не должен оседать в localStorage: там его достаёт любой XSS.
  const stored = await page.evaluate(() => JSON.stringify(window.localStorage));
  expect(stored).not.toContain(accessToken?.value ?? 'ACCESS_TOKEN');
});

test('добавленная книга появляется в списке и переживает перезагрузку', async ({ page }) => {
  await registerNewUser(page);
  const title = `Задача трёх тел ${Date.now()}`;

  await page.getByRole('button', { name: 'Добавить запись' }).first().click();
  await page.getByLabel('Название', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();

  await expect(page.getByText(title)).toBeVisible();

  // Перезагрузка проверяет, что запись действительно сохранена, а не только попала в состояние.
  await page.reload();
  await expect(page.getByText(title)).toBeVisible();
});

/**
 * Автор — сущность, а не строка: в карточку он вводится именем, а на странице авторов
 * появляется со счётчиком произведений.
 */
test('введённый в карточке автор заводится и попадает на страницу авторов', async ({ page }) => {
  await registerNewUser(page);
  const author = `Лю Цысинь ${Date.now()}`;
  const title = `Тёмный лес ${Date.now()}`;

  await page.getByRole('button', { name: 'Добавить запись' }).first().click();
  await page.getByLabel('Название', { exact: true }).fill(title);
  await page.getByLabel('Авторы').fill(author);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();

  // В списке автор идёт подписью под названием.
  await expect(page.getByText(author).first()).toBeVisible();

  // Справочники свёрнуты в группу: одиннадцать равноправных вкладок в шапке не помещались.
  await page.getByRole('menuitem', { name: 'Справочники' }).hover();
  await page.getByRole('link', { name: 'Авторы' }).click();
  await expect(page.getByText(author)).toBeVisible();
  await expect(page.getByRole('button', { name: /1 произведение/ })).toBeVisible();
});

/**
 * Профиль закрыт по умолчанию, и открывает его сам пользователь. Проверяется вся цепочка:
 * переключатель в настройках → страница /u/username → цель года на своей странице целей.
 */
test('открытый профиль появляется на своей странице /u/:username', async ({ page }) => {
  const username = await registerNewUser(page);

  await page.goto('/profile');
  await page.getByLabel('Имя для показа').fill('Читатель e2e');
  await page.getByRole('switch').first().click();
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await page.goto(`/u/${username}`);
  await expect(page.getByRole('heading', { name: 'Читатель e2e' })).toBeVisible();
  await expect(page.getByText(`@${username}`)).toBeVisible();
  // Свою страницу не подписывают на себя: вместо кнопки подписки — переход в настройки.
  await expect(page.getByRole('button', { name: 'Настроить профиль' })).toBeVisible();
});

/** Цель года считается от равномерного темпа, поэтому пустая цель ничего не показывает. */
test('цель года заводится и показывает прогресс', async ({ page }) => {
  await registerNewUser(page);

  await page.goto('/goals');
  await expect(page.getByText(/Цель ещё не поставлена/)).toBeVisible();

  await page.getByLabel('Произведений').fill('40');
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await expect(page.getByText('0 / 40')).toBeVisible();
  await expect(page.getByText('Такими темпами')).toBeVisible();
});

test('выход закрывает доступ к библиотеке', async ({ page, context }) => {
  const username = await registerNewUser(page);

  await page.getByRole('button', { name: new RegExp(username) }).click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();

  await expect(page).toHaveURL(/\/login$/);

  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === 'ACCESS_TOKEN')?.value ?? '').toBe('');

  // Прямой заход на защищённую страницу возвращает на вход.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
