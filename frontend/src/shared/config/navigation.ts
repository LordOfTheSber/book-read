/**
 * Реестр разделов — один на шапку, меню «Ещё» и нижнюю панель телефона.
 *
 * До этого одиннадцать разделов стояли в шапке равноправными вкладками: «Библиотека» занимала
 * столько же места, сколько «Источники», которые открывают раз в полгода. Наверху остаются три
 * вкладки ежедневного круга, остальное собрано в «Ещё» группами с подписями.
 */

export type NavGroupKey = 'weekly' | 'actions' | 'catalogues' | 'admin';

export interface NavSection {
  key: string;
  label: string;
  path: string;
  adminOnly?: boolean;
}

export interface NavGroup {
  key: NavGroupKey;
  label: string;
  items: NavSection[];
}

/** Верхний уровень: то, что открывают каждый день. */
export const primaryNav: NavSection[] = [
  { key: 'books', label: 'Библиотека', path: '/' },
  { key: 'analytics', label: 'Аналитика', path: '/analytics' },
  { key: 'feed', label: 'Лента', path: '/feed' }
];

/** «Ещё»: подпись группы объясняет, зачем раздел, — «Импорт» это действие, а не справочник. */
export const secondaryNav: NavGroup[] = [
  {
    key: 'weekly',
    label: 'Каждую неделю',
    items: [
      { key: 'goals', label: 'Цели', path: '/goals' },
      { key: 'quotes', label: 'Выписки', path: '/quotes' }
    ]
  },
  {
    key: 'actions',
    label: 'Действия',
    items: [{ key: 'import', label: 'Импорт', path: '/import' }]
  },
  {
    key: 'catalogues',
    // Группа и пункт не могут называться одинаково: «Справочники» внутри «Справочников»
    // читаются как ошибка вёрстки.
    label: 'Устройство библиотеки',
    items: [
      { key: 'shelves', label: 'Полки и теги', path: '/shelves' },
      // Авторы, серии, типы и источники устроены одинаково и собраны в одну страницу
      // с переключателем: четыре пункта меню на них не тратятся.
      { key: 'catalog', label: 'Справочники', path: '/catalog' }
    ]
  },
  {
    key: 'admin',
    label: 'Служебное',
    items: [{ key: 'admin', label: 'Администрирование', path: '/admin', adminOnly: true }]
  }
];

/** Разделы без пункта меню: имя нужно заголовку экрана на телефоне. */
const extraTitles: Array<{ path: string; label: string }> = [
  { path: '/profile', label: 'Профиль' },
  { path: '/u/', label: 'Страница читателя' },
  // Страница узла открывается с обзора администрирования, своего пункта меню у неё нет.
  { path: '/nodes/', label: 'Узел' }
];

export const allSections: NavSection[] = [
  ...primaryNav,
  ...secondaryNav.flatMap((group) => group.items)
];

/** Группы «Ещё» без пустых: у обычного пользователя администрирования нет вовсе. */
export const visibleGroups = (isAdmin: boolean): NavGroup[] =>
  secondaryNav
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.adminOnly || isAdmin) }))
    .filter((group) => group.items.length > 0);

/**
 * Раздел по адресу. Совпадение ищется по самому длинному пути: `/nodes/:id` принадлежит «Узлам»,
 * а не корню, а корень отвечает только за самого себя — иначе он подсвечивался бы везде.
 */
export const findSection = (pathname: string, isAdmin = true): NavSection | undefined => {
  if (pathname === '/') return primaryNav[0];

  return allSections
    .filter((item) => !item.adminOnly || isAdmin)
    .filter((item) => item.path !== '/' && (pathname === item.path || pathname.startsWith(`${item.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
};

/** Заголовок экрана на телефоне: у профиля и чужой страницы пункта меню нет, а имя нужно. */
export const sectionTitle = (pathname: string): string | undefined => {
  const section = findSection(pathname);
  if (section) return section.label;

  return extraTitles.find((entry) => pathname.startsWith(entry.path))?.label;
};
