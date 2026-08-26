import { describe, expect, it } from 'vitest';
import { findSection, primaryNav, sectionTitle, visibleGroups } from './navigation';

describe('реестр разделов', () => {
  it('наверху остаются три раздела ежедневного круга', () => {
    expect(primaryNav.map((item) => item.label)).toEqual(['Библиотека', 'Аналитика', 'Лента']);
  });

  it('вложенный адрес принадлежит своему разделу, а не корню', () => {
    expect(findSection('/nodes/42')?.key).toBe('nodes');
    expect(findSection('/')?.key).toBe('books');
  });

  /** Четыре справочника съехались на одну страницу, и в меню от них остаётся один пункт. */
  it('справочники стоят в меню одним пунктом', () => {
    const catalogues = visibleGroups(false).find((group) => group.key === 'catalogues');

    expect(catalogues?.items.map((item) => item.key)).toEqual(['shelves', 'catalog']);
    expect(findSection('/catalog')?.label).toBe('Справочники');
  });

  /** Иначе «Библиотека» подсвечивалась бы на профиле и на чужой странице — раздела, которого нет. */
  it('у профиля и чужой страницы своего пункта меню нет', () => {
    expect(findSection('/profile')).toBeUndefined();
    expect(findSection('/u/sber')).toBeUndefined();
    expect(sectionTitle('/profile')).toBe('Профиль');
    expect(sectionTitle('/u/sber')).toBe('Страница читателя');
  });

  it('администраторские разделы видны только администратору, пустой группы не остаётся', () => {
    const forUser = visibleGroups(false);
    const forAdmin = visibleGroups(true);

    expect(forUser.map((group) => group.key)).not.toContain('admin');
    expect(forAdmin.find((group) => group.key === 'admin')?.items.map((item) => item.key)).toEqual([
      'users',
      'nodes'
    ]);
    expect(findSection('/users', false)).toBeUndefined();
  });
});
