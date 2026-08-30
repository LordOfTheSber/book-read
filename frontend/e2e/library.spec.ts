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

/**
 * «Добавить запись» открывает поиск по каталогам, а форма на шесть полей лежит за ссылкой
 * «Завести вручную»: в e2e каталоги недоступны, поэтому запись всегда заводится руками.
 */
const addBookManually = async (page: import('@playwright/test').Page, title: string) => {
  await page.getByRole('button', { name: 'Добавить запись' }).first().click();
  await page.getByRole('button', { name: 'Не нашлось? Завести вручную' }).click();
  await page.getByLabel('Название', { exact: true }).fill(title);
};

test('добавленная книга появляется в списке и переживает перезагрузку', async ({ page }) => {
  await registerNewUser(page);
  const title = `Задача трёх тел ${Date.now()}`;

  await addBookManually(page, title);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();

  // Точное совпадение: название записи стоит в строке списка целиком и само по себе.
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  // Перезагрузка проверяет, что запись действительно сохранена, а не только попала в состояние.
  await page.reload();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

/**
 * Карточка доезжает до базы целиком. Издательские поля лежат в свёрнутом блоке, отзыв — на
 * отдельной вкладке, и до правки на сервер уходило только то, что было нарисовано на экране:
 * запись сохранялась, а половина введённого пропадала молча. Проверяется на живом стеке, потому
 * что потеря случалась именно между формой и базой.
 *
 * Заводится запись теперь одним названием, а издание и отзыв заполняются в карточке: при
 * добавлении их не спрашивают — у книги, которую ещё не начали, их попросту нет.
 */
test('карточка сохраняет и издательские поля, и отзыв', async ({ page }) => {
  await registerNewUser(page);
  const title = `Тёмный лес ${Date.now()}`;

  await addBookManually(page, title);
  await page.getByRole('button', { name: 'Добавить и открыть карточку' }).click();

  // По роли, а не по подписи: «Отзыв» подстрокой входит в имя вкладки «Оценка и отзыв».
  await page.getByRole('tab', { name: 'Оценка и отзыв' }).click();
  await page.getByRole('textbox', { name: 'Отзыв' }).fill('Лучшая твёрдая фантастика');

  await page.getByRole('tab', { name: 'Карточка' }).click();
  await page.getByText('Издание и расположение').click();
  await page.getByLabel('ISBN').fill('9785171049676');
  await page.getByLabel('Год издания').fill('2008');
  await page.getByLabel('Язык').fill('ru');
  await page.getByLabel('Переводчик').fill('Ольга Глушкова');
  await page.getByLabel('Шкаф').fill('Гостиная');
  await page.getByLabel('Полка', { exact: true }).fill('Вторая сверху');

  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  // На странице записи название стоит дважды: в хлебных крошках и заголовком.
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  // Перезагрузка отсекает состояние на клиенте: у записи свой адрес, и после неё открывается
  // та же страница — дальше проверяется то, что легло в базу.
  await page.reload();

  await page.getByText('Издание и расположение').click();
  await expect(page.getByLabel('ISBN')).toHaveValue('9785171049676');
  await expect(page.getByLabel('Год издания')).toHaveValue('2008');
  await expect(page.getByLabel('Язык')).toHaveValue('ru');
  await expect(page.getByLabel('Переводчик')).toHaveValue('Ольга Глушкова');
  await expect(page.getByLabel('Шкаф')).toHaveValue('Гостиная');
  await expect(page.getByLabel('Полка', { exact: true })).toHaveValue('Вторая сверху');

  // У сохранённой записи отзыв живёт на своей вкладке.
  await page.getByRole('tab', { name: 'Оценка и отзыв' }).click();
  await expect(page.getByRole('textbox', { name: 'Отзыв' })).toHaveValue('Лучшая твёрдая фантастика');
});

/**
 * Автор — сущность, а не строка: в карточку он вводится именем, а на странице авторов
 * появляется со счётчиком произведений.
 */
test('введённый в карточке автор заводится и попадает на страницу авторов', async ({ page }) => {
  await registerNewUser(page);
  const author = `Лю Цысинь ${Date.now()}`;
  const title = `Тёмный лес ${Date.now()}`;

  await addBookManually(page, title);
  await page.getByLabel('Авторы').fill(author);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();

  // В списке автор идёт подписью под названием.
  await expect(page.getByText(author).first()).toBeVisible();

  // Справочники свёрнуты под «Ещё» и живут одной страницей: одиннадцать равноправных вкладок
  // в шапке не помещались, а четыре одинаковых справочника занимали четверть меню.
  await page.getByRole('button', { name: /Ещё/ }).click();
  await page.getByRole('menuitem', { name: 'Справочники' }).click();
  await expect(page.getByText(author)).toBeVisible();
  // Карточка автора отвечает, что из него прочитано, — ради этого справочник и открывают.
  await expect(page.getByText('Не начато · 1 запись')).toBeVisible();
});

/**
 * Профиль закрыт по умолчанию, и открывает его сам пользователь. Проверяется вся цепочка:
 * переключатель в настройках → страница /u/username → цель года на своей странице целей.
 */
test('открытый профиль появляется на своей странице /u/:username', async ({ page }) => {
  const username = await registerNewUser(page);

  // Профиль разложен по вкладкам, и вкладка стоит в адресе: форма публичной страницы —
  // не первый экран, а `?tab=public`.
  await page.goto('/profile?tab=public');
  await page.getByLabel('Имя для показа').fill('Читатель e2e');
  await page.getByRole('switch').first().click();
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await page.goto(`/u/${username}`);
  await expect(page.getByRole('heading', { name: 'Читатель e2e' })).toBeVisible();
  await expect(page.getByText(`@${username}`)).toBeVisible();
  // Свою страницу не подписывают на себя: вместо кнопки подписки — переход в настройки.
  await expect(page.getByRole('button', { name: 'Настроить профиль' })).toBeVisible();
});

/**
 * Цель года считается от равномерного темпа, поэтому пустая цель ничего не показывает.
 * Форма при этом убрана под карандаш: страница открывается ответом, а не настройкой.
 */
test('цель года заводится и показывает прогресс', async ({ page }) => {
  await registerNewUser(page);

  await page.goto('/goals');
  await expect(page.getByText(/Цель ещё не поставлена/)).toBeVisible();

  await page.getByRole('button', { name: 'Поставить цель' }).click();
  await page.getByLabel('Произведений').fill('40');
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await expect(page.getByText('из 40 книг')).toBeVisible();
  await expect(page.getByText('Осталось')).toBeVisible();
  await expect(page.getByText('40 книг', { exact: true })).toBeVisible();
});

/**
 * Быстрый вход по устройству: пароль спрашивают один раз, дальше устройство узнают само.
 *
 * Проверяется на живом стеке, потому что весь механизм держится на том, чего нет ни в юнит-тестах,
 * ни в MockMvc: httpOnly-куке, которую браузер сам приносит на нужный путь, и отпечатке, который
 * считает страница.
 */
test('запомненное устройство входит без пароля', async ({ page, context }) => {
  const username = await registerNewUser(page);

  // Кука устройства не должна быть доступна странице и ездить в каждый запрос.
  const deviceCookie = (await context.cookies()).find((cookie) => cookie.name === 'DEVICE_TOKEN');
  expect(deviceCookie?.httpOnly).toBe(true);
  expect(deviceCookie?.path).toBe('/api/v1/auth');

  await page.getByRole('button', { name: 'Меню профиля' }).click();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // После своего выхода экран входа ждёт нажатия, а не входит сам.
  await page.getByRole('button', { name: `Продолжить как ${username}` }).click();
  await expect(page.getByRole('button', { name: 'Добавить запись' }).first()).toBeVisible();

  // В новой вкладке отметки «только что вышел» нет — там вход происходит сам собой.
  await page.getByRole('button', { name: 'Меню профиля' }).click();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Добавить запись' }).first()).toBeVisible();
});

test('выход закрывает доступ к библиотеке', async ({ page, context }) => {
  const username = await registerNewUser(page);

  // Имя пользователя переехало с кнопки внутрь меню: в шапке остался только аватар.
  await page.getByRole('button', { name: 'Меню профиля' }).click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти' }).click();

  await expect(page).toHaveURL(/\/login$/);

  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === 'ACCESS_TOKEN')?.value ?? '').toBe('');

  // Прямой заход на защищённую страницу возвращает на вход.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
