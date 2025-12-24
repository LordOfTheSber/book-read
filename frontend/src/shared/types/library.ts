export type MediaKind = 'BOOK';
export type ReadingStatus = 'READING' | 'DROPPED' | 'COMPLETED' | 'PLANNED';

export interface BookType {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryItem {
  id: string;
  kind: MediaKind;
  title: string;
  altTitle?: string;
  typeId?: string;
  typeName?: string;
  sourceId?: string;
  sourceName?: string;
  sourceUrl?: string;
  createdById?: string;
  createdByUsername?: string;
  comment?: string;
  rating?: number;
  favorite: boolean;
  status: ReadingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface User {
  id: string;
  username: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}
