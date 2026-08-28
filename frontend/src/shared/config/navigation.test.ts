import { describe, expect, it } from 'vitest';
import { findSection, primaryNav, sectionTitle, visibleGroups } from './navigation';

describe('реестр разделов', () => {
  it('наверху остаются три раздела ежедневного круга', () => {
    expect(primaryNav.map((item) => item.label)).toEqual(['Библиотека', 'Аналитика', 'Лента']);
  });

  it('вложенный адрес принадлежит своему разделу, а не корню', () => {
    expect(findSection('/shelves/42')?.key).toBe('shelves');
    // Корень отвечает только за самого себя, иначе он подсвечивался бы на любой странице.
    expect(findSection('/')?.key).toBe('books');
    expect(findSection('/library/42')).toBeUndefined();
  });

  /** Четыре справочника стали одной страницей: сущность выбирается на ней, а не в меню. */
  it('справочники — один пункт меню', () => {
    expect(findSection('/catalog')?.key).toBe('catalog');
    expect(findSection('/catalog')?.label).toBe('Справочники');
  });

  /** Иначе «Библиотека» подсвечивалась бы на профиле и на чужой странице — раздела, которого нет. */
  it('у профиля и чужой страницы своего пункта меню нет', () => {
    expect(findSection('/profile')).toBeUndefined();
    expect(findSection('/u/sber')).toBeUndefined();
    expect(sectionTitle('/profile')).toBe('Профиль');
    expect(sectionTitle('/u/sber')).toBe('Страница читателя');
    // Страница узла открывается с обзора администрирования — имя ей всё равно нужно.
    expect(sectionTitle('/nodes/42')).toBe('Узел');
  });

  it('администраторские разделы видны только администратору, пустой группы не остаётся', () => {
    const forUser = visibleGroups(false);
    const forAdmin = visibleGroups(true);

    expect(forUser.map((group) => group.key)).not.toContain('admin');
    expect(forAdmin.find((group) => group.key === 'admin')?.items.map((item) => item.key)).toEqual([
      'admin'
    ]);
    expect(findSection('/admin', false)).toBeUndefined();
  });
});
