import React from 'react';
import { Form, Input } from 'antd';
import type { AsyncThunk } from '@reduxjs/toolkit';
import { createAuthorThunk, deleteAuthorThunk, loadAuthors, updateAuthorThunk } from '@/entities/author';
import { createSeriesThunk, deleteSeriesThunk, loadSeries, updateSeriesThunk } from '@/entities/series';
import {
  createBookTypeThunk,
  deleteBookTypeThunk,
  loadBookTypes,
  updateBookTypeThunk
} from '@/entities/book-type';
import { createSourceThunk, deleteSourceThunk, loadSources, updateSourceThunk } from '@/entities/source';
import type { RootState } from '@/app/providers/StoreProvider';
import { Author, BookType, Series, Source } from '@/shared/types/library';

/** Четыре справочника живут на одной странице; ключ стоит в адресе: `/catalog?entity=authors`. */
export type CatalogEntityKey = 'authors' | 'series' | 'types' | 'sources';

export const catalogEntityKeys: CatalogEntityKey[] = ['authors', 'series', 'types', 'sources'];

/** Строка любого справочника, приведённая к одному виду: страница дальше не знает, чей это список. */
export interface CatalogRow {
  id: string;
  name: string;
  /** Вторая строка: имя в оригинале, описание цикла, адрес источника. */
  secondary?: string;
  /** Сколько произведений за строкой; у источников и типов счётчика нет. */
  itemCount?: number;
  finishedCount?: number;
  avgRating?: number;
  /** Имя в оригинале нужно поиску дублей отдельно от подписи. */
  altName?: string;
  updatedAt?: string;
  url?: string;
}

interface EntityLabels {
  /** Название в рельсе и в заголовке страницы. */
  label: string;
  /** Формы для счётчика: «214 авторов». */
  forms: [string, string, string];
  addButton: string;
  createTitle: string;
  editTitle: string;
  deleteTitle: string;
  deleteContent: (row: CatalogRow) => string;
  created: string;
  updated: string;
  deleted: string;
  saveError: string;
  deleteError: string;
  emptyTitle: string;
  emptyHint: string;
  searchPlaceholder: string;
}

export interface CatalogEntity {
  key: CatalogEntityKey;
  /**
   * Как показывать: витриной с обложками или таблицей. У авторов и циклов обложки складываются
   * в ответ на вопрос «что из этого у меня есть», у типов и источников показывать нечего.
   */
  view: 'showcase' | 'table';
  labels: EntityLabels;
  select: (state: RootState) => { list: unknown[]; loading: boolean };
  toRow: (item: never) => CatalogRow;
  /** Значения формы правки: у каждого справочника свои поля. */
  toFormValues: (item: never) => Record<string, unknown>;
  formFields: React.ReactNode;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  load: AsyncThunk<any, any, any>;
  create: (values: Record<string, unknown>) => any;
  update: (id: string, values: Record<string, unknown>) => any;
  remove: (id: string) => any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

const authors: CatalogEntity = {
  key: 'authors',
  view: 'showcase',
  labels: {
    label: 'Авторы',
    forms: ['автор', 'автора', 'авторов'],
    addButton: 'Добавить автора',
    createTitle: 'Новый автор',
    editTitle: 'Редактирование автора',
    deleteTitle: 'Удалить автора?',
    deleteContent: (row) => `Автор «${row.name}» будет удалён. Удалить можно только автора без произведений.`,
    created: 'Автор добавлен',
    updated: 'Автор обновлён',
    deleted: 'Автор удалён',
    saveError: 'Не удалось сохранить автора',
    deleteError: 'Не удалось удалить автора',
    emptyTitle: 'Авторов пока нет',
    emptyHint: 'Автор заводится сам, когда вы вписываете имя в карточку книги.',
    searchPlaceholder: 'Найти автора'
  },
  select: (state) => state.authors,
  toRow: (item: Author) => ({
    id: item.id,
    name: item.name,
    secondary: item.altName,
    altName: item.altName,
    itemCount: item.itemCount,
    finishedCount: item.finishedCount,
    avgRating: item.avgRating
  }),
  toFormValues: (item: Author) => ({ name: item.name, altName: item.altName }),
  formFields: (
    <>
      <Form.Item name="name" label="Имя" rules={[{ required: true, message: 'Имя обязательно' }]}>
        <Input placeholder="Например, «Лю Цысинь»" size="large" />
      </Form.Item>
      <Form.Item name="altName" label="Имя в оригинале" tooltip="Например, латиницей: Liu Cixin">
        <Input placeholder="Liu Cixin" />
      </Form.Item>
    </>
  ),
  load: loadAuthors,
  create: (values) => createAuthorThunk(values),
  update: (id, values) => updateAuthorThunk({ id, payload: values }),
  remove: (id) => deleteAuthorThunk(id)
};

const series: CatalogEntity = {
  key: 'series',
  view: 'showcase',
  labels: {
    label: 'Серии',
    forms: ['серия', 'серии', 'серий'],
    addButton: 'Добавить серию',
    createTitle: 'Новая серия',
    editTitle: 'Редактирование серии',
    deleteTitle: 'Удалить серию?',
    deleteContent: (row) => `Серия «${row.name}» будет удалена. Удалить можно только серию без произведений.`,
    created: 'Серия добавлена',
    updated: 'Серия обновлена',
    deleted: 'Серия удалена',
    saveError: 'Не удалось сохранить серию',
    deleteError: 'Не удалось удалить серию',
    emptyTitle: 'Серий пока нет',
    emptyHint: 'Серия заводится сама, когда вы вписываете её название в карточку книги.',
    searchPlaceholder: 'Найти серию'
  },
  select: (state) => state.series,
  toRow: (item: Series) => ({
    id: item.id,
    name: item.name,
    secondary: item.description,
    itemCount: item.itemCount,
    finishedCount: item.completedCount
  }),
  toFormValues: (item: Series) => ({ name: item.name, description: item.description }),
  formFields: (
    <>
      <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
        <Input placeholder="Например, «Воспоминания о прошлом Земли»" size="large" />
      </Form.Item>
      <Form.Item name="description" label="Описание">
        <Input.TextArea rows={3} placeholder="О чём цикл" />
      </Form.Item>
    </>
  ),
  load: loadSeries,
  create: (values) => createSeriesThunk(values),
  update: (id, values) => updateSeriesThunk({ id, payload: values }),
  remove: (id) => deleteSeriesThunk(id)
};

const types: CatalogEntity = {
  key: 'types',
  view: 'table',
  labels: {
    label: 'Типы',
    forms: ['тип', 'типа', 'типов'],
    addButton: 'Добавить тип',
    createTitle: 'Новый тип',
    editTitle: 'Редактирование типа',
    deleteTitle: 'Удалить тип?',
    deleteContent: (row) => `Тип «${row.name}» будет удалён. Книги с этим типом останутся без него.`,
    created: 'Тип добавлен',
    updated: 'Тип обновлён',
    deleted: 'Тип удалён',
    saveError: 'Не удалось сохранить тип',
    deleteError: 'Не удалось удалить тип',
    emptyTitle: 'Типов пока нет',
    emptyHint: 'Типы помогают группировать книги: роман, манга, нон-фикшн.',
    searchPlaceholder: 'Найти тип'
  },
  select: (state) => state.bookTypes,
  toRow: (item: BookType) => ({ id: item.id, name: item.name, updatedAt: item.updatedAt }),
  toFormValues: (item: BookType) => ({ name: item.name }),
  formFields: (
    <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
      <Input placeholder="Например, «Нон-фикшн»" size="large" />
    </Form.Item>
  ),
  load: loadBookTypes,
  create: (values) => createBookTypeThunk(values),
  update: (id, values) => updateBookTypeThunk({ id, payload: values }),
  remove: (id) => deleteBookTypeThunk(id)
};

const sources: CatalogEntity = {
  key: 'sources',
  view: 'table',
  labels: {
    label: 'Источники',
    forms: ['источник', 'источника', 'источников'],
    addButton: 'Добавить источник',
    createTitle: 'Новый источник',
    editTitle: 'Редактирование источника',
    deleteTitle: 'Удалить источник?',
    deleteContent: (row) => `Источник «${row.name}» будет удалён. Книги из него останутся без источника.`,
    created: 'Источник добавлен',
    updated: 'Источник обновлён',
    deleted: 'Источник удалён',
    saveError: 'Не удалось сохранить источник',
    deleteError: 'Не удалось удалить источник',
    emptyTitle: 'Источников пока нет',
    emptyHint: 'Источник — откуда книга: магазин, библиотека, подарок.',
    searchPlaceholder: 'Найти источник'
  },
  select: (state) => state.sources,
  toRow: (item: Source) => ({
    id: item.id,
    name: item.name,
    secondary: item.description,
    url: item.url,
    updatedAt: item.updatedAt
  }),
  toFormValues: (item: Source) => ({ name: item.name, url: item.url, description: item.description }),
  formFields: (
    <>
      <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Название обязательно' }]}>
        <Input placeholder="Например, «Читай-город»" size="large" />
      </Form.Item>
      <Form.Item name="url" label="Ссылка">
        <Input placeholder="https://" />
      </Form.Item>
      <Form.Item name="description" label="Описание">
        <Input.TextArea rows={3} placeholder="Чем этот источник отличается" />
      </Form.Item>
    </>
  ),
  load: loadSources,
  create: (values) => createSourceThunk(values),
  update: (id, values) => updateSourceThunk({ id, payload: values }),
  remove: (id) => deleteSourceThunk(id)
};

export const catalogEntities: Record<CatalogEntityKey, CatalogEntity> = {
  authors,
  series,
  types,
  sources
};

/** Ключ из адреса; всё незнакомое — авторы, самый большой из четырёх справочников. */
export const resolveEntityKey = (value: string | null): CatalogEntityKey =>
  catalogEntityKeys.includes(value as CatalogEntityKey) ? (value as CatalogEntityKey) : 'authors';
