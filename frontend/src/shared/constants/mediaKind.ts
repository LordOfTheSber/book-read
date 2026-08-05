import React from 'react';
import {
  AudioOutlined,
  BookOutlined,
  CustomerServiceOutlined,
  DesktopOutlined,
  PictureOutlined,
  PlaySquareOutlined,
  ReadOutlined,
  RocketOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import { MediaKind } from '@/shared/types/library';

interface MediaKindMeta {
  label: string;
  icon: React.ReactNode;
}

/**
 * Виды произведения. Иконка отличает строки списка друг от друга: без неё сериал и книга
 * выглядят одинаково, а трекер перестал быть только книжным.
 */
export const mediaKindMeta: Record<MediaKind, MediaKindMeta> = {
  BOOK: { label: 'Книга', icon: React.createElement(BookOutlined) },
  COMIC: { label: 'Комикс', icon: React.createElement(PictureOutlined) },
  MANGA: { label: 'Манга', icon: React.createElement(ReadOutlined) },
  AUDIOBOOK: { label: 'Аудиокнига', icon: React.createElement(CustomerServiceOutlined) },
  MOVIE: { label: 'Фильм', icon: React.createElement(VideoCameraOutlined) },
  SERIES: { label: 'Сериал', icon: React.createElement(PlaySquareOutlined) },
  ANIME: { label: 'Аниме', icon: React.createElement(DesktopOutlined) },
  PODCAST: { label: 'Подкаст', icon: React.createElement(AudioOutlined) },
  GAME: { label: 'Игра', icon: React.createElement(RocketOutlined) }
};

export const mediaKindOptions = (Object.keys(mediaKindMeta) as MediaKind[]).map((value) => ({
  label: mediaKindMeta[value].label,
  value
}));

export const getMediaKindLabel = (kind?: MediaKind) => (kind ? mediaKindMeta[kind]?.label ?? kind : '—');
