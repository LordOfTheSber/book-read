import React from 'react';
import {
  AudioOutlined,
  BookOutlined,
  CustomerServiceOutlined,
  PictureOutlined,
  PlaySquareOutlined,
  ReadOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import { MediaKind, ProgressUnit } from '@/shared/types/library';
import { kindColor } from '@/shared/config/brand';
import { alpha, mix } from '@/shared/lib/color';

/** Пресет палитры Ant Design: тёмная тема пересчитывает его сама, в отличие от хардкода. */
export type KindPalette =
  | 'blue'
  | 'purple'
  | 'magenta'
  | 'cyan'
  | 'geekblue'
  | 'volcano'
  | 'orange'
  | 'gold'
  | 'green';

interface MediaKindMeta {
  label: string;
  icon: React.ReactNode;
  palette: KindPalette;
  /** Единица прогресса по умолчанию — та же, что у MediaKind на сервере. */
  defaultUnit: ProgressUnit;
}

/**
 * Виды произведения. Иконка и цвет отличают строки списка друг от друга: без них сериал и книга
 * выглядят одинаково, а трекер перестал быть только книжным.
 */
export const mediaKindMeta: Record<MediaKind, MediaKindMeta> = {
  BOOK: { label: 'Книга', icon: React.createElement(BookOutlined), palette: 'blue', defaultUnit: 'PAGES' },
  COMIC: { label: 'Комикс', icon: React.createElement(PictureOutlined), palette: 'purple', defaultUnit: 'PAGES' },
  MANGA: { label: 'Манга', icon: React.createElement(ReadOutlined), palette: 'magenta', defaultUnit: 'VOLUMES' },
  AUDIOBOOK: {
    label: 'Аудиокнига',
    icon: React.createElement(CustomerServiceOutlined),
    palette: 'cyan',
    defaultUnit: 'MINUTES'
  },
  MOVIE: {
    label: 'Фильм',
    icon: React.createElement(VideoCameraOutlined),
    palette: 'volcano',
    defaultUnit: 'MINUTES'
  },
  SERIES: {
    label: 'Сериал',
    icon: React.createElement(PlaySquareOutlined),
    palette: 'orange',
    defaultUnit: 'EPISODES'
  },
  // Раньше у аниме стоял монитор: он ничего не говорил о виде и путался с сериалом.
  ANIME: { label: 'Аниме', icon: React.createElement(ThunderboltOutlined), palette: 'gold', defaultUnit: 'EPISODES' },
  PODCAST: { label: 'Подкаст', icon: React.createElement(AudioOutlined), palette: 'geekblue', defaultUnit: 'MINUTES' },
  // Ракета не имела отношения к играм; кубок хотя бы про прохождение.
  GAME: { label: 'Игра', icon: React.createElement(TrophyOutlined), palette: 'green', defaultUnit: 'MINUTES' }
};

export const mediaKindOptions = (Object.keys(mediaKindMeta) as MediaKind[]).map((value) => ({
  label: mediaKindMeta[value].label,
  value
}));

/** Те же значки, что и в списке: в выпадающем списке вид узнаётся без чтения подписи. */
export const mediaKindOptionsWithIcon = (Object.keys(mediaKindMeta) as MediaKind[]).map((value) => ({
  value,
  // Поиск и фильтрация идут по label как по строке, поэтому подпись остаётся строкой в title.
  title: mediaKindMeta[value].label,
  label: React.createElement(
    'span',
    { style: { display: 'inline-flex', alignItems: 'center', gap: 8 } },
    mediaKindMeta[value].icon,
    mediaKindMeta[value].label
  )
}));

export const getMediaKindLabel = (kind?: MediaKind) => (kind ? mediaKindMeta[kind]?.label ?? kind : '—');

export const getMediaKindPalette = (kind?: MediaKind): KindPalette => mediaKindMeta[kind as MediaKind]?.palette ?? 'blue';

/**
 * Цвета чипа вида в фирменном стиле: девять оттенков одной насыщенности вместо ярких пресетов
 * Ant Design. Заливка и граница считаются из одного значения — так цвет вида остаётся один
 * и на корешке заглушки, и в чипе, и в корешковой полосе.
 */
export const kindChipColors = (kind: MediaKind | undefined, dark: boolean) => {
  const base = kindColor[kind as MediaKind]?.color ?? kindColor.BOOK.color;

  return dark
    ? { background: alpha(base, 0.26), border: alpha(base, 0.36), text: mix(base, '#FFFFFF', 0.68) }
    : { background: mix(base, '#FFFFFF', 0.9), border: mix(base, '#FFFFFF', 0.78), text: base };
};
