export type MediaKind =
  | 'BOOK'
  | 'COMIC'
  | 'MANGA'
  | 'AUDIOBOOK'
  | 'MOVIE'
  | 'SERIES'
  | 'ANIME'
  | 'PODCAST'
  | 'GAME';
export type ReadingStatus = 'READING' | 'ON_HOLD' | 'DROPPED' | 'COMPLETED' | 'PLANNED';
export type ProgressUnit = 'PAGES' | 'MINUTES' | 'EPISODES' | 'VOLUMES';

/** Прогресс со всем, что из него считается на сервере. */
export interface Progress {
  current?: number;
  total?: number;
  unit?: ProgressUnit;
  percent?: number;
  remaining?: number;
  dailyNorm?: number;
  daysLeft?: number;
  behindSchedule: boolean;
}

export interface ReadingSession {
  id: string;
  itemId: string;
  logId?: string;
  sessionDate: string;
  fromPosition?: number;
  toPosition?: number;
  durationMinutes?: number;
  note?: string;
}

/** Один проход по произведению: со второго это перечитывание. */
export interface ReadingLog {
  id: string;
  attempt: number;
  startedAt?: string;
  finishedAt?: string;
  rating?: number;
  ratingPlot?: number;
  ratingStyle?: number;
  ratingCharacters?: number;
  ratingEnding?: number;
  comment?: string;
  sessionCount: number;
  durationDays?: number;
}

export interface Quote {
  id: string;
  itemId: string;
  itemTitle: string;
  position?: number;
  text: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
export type ItemFormat = 'PAPER' | 'EBOOK' | 'AUDIO';

export interface Author {
  id: string;
  name: string;
  altName?: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Автор внутри карточки: без счётчиков и дат. */
export interface AuthorSummary {
  id: string;
  name: string;
  altName?: string;
}

export interface Series {
  id: string;
  name: string;
  description?: string;
  itemCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookType {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Свободная пометка в дополнение к типу: тип — жанр, тег — контекст. Личный, а не общий. */
export interface Tag {
  id: string;
  name: string;
  color?: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Тег внутри карточки: без счётчиков и дат. */
export interface TagSummary {
  id: string;
  name: string;
  color?: string;
}

/** Полка: именованный набор с составом, заданным вручную. */
export interface Shelf {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  itemCount: number;
  ownerId?: string;
  ownerUsername?: string;
  createdAt: string;
  updatedAt: string;
}

/** Произведение в составе полки: публично безопасный набор полей, без приватной заметки. */
export interface ShelfItem {
  id: string;
  kind: MediaKind;
  title: string;
  altTitle?: string;
  authorNames: string[];
  hasCover: boolean;
  rating?: number;
  status: ReadingStatus;
  review?: string;
}

/** Сохранённый фильтр умной полки: повторяет параметры выдачи, кроме страницы и размера. */
export interface SavedFilter {
  query?: string;
  typeId?: string;
  status?: ReadingStatus;
  favorite?: boolean;
  wishlist?: boolean;
  minRating?: number;
  maxRating?: number;
  kind?: MediaKind;
  finishedFrom?: string;
  finishedTo?: string;
  authorId?: string;
  seriesId?: string;
  tagId?: string;
  shelfId?: string;
  sort?: string;
}

export interface SmartShelf {
  id: string;
  name: string;
  description?: string;
  filter: SavedFilter;
  createdAt: string;
  updatedAt: string;
}

/** Находка внешнего каталога: то, из чего собирается карточка одним нажатием. */
export interface ExternalBook {
  provider: 'OPEN_LIBRARY' | 'GOOGLE_BOOKS';
  externalId?: string;
  title: string;
  altTitle?: string;
  authorNames: string[];
  isbn?: string;
  publishedYear?: number;
  language?: string;
  pageCount?: number;
  publisher?: string;
  description?: string;
  coverUrl?: string;
}

/** Похожая запись, уже лежащая в библиотеке. */
export interface DuplicateCandidate {
  id: string;
  title: string;
  authorNames: string[];
  isbn?: string;
  publishedYear?: number;
  hasCover: boolean;
  reason: 'ISBN' | 'TITLE';
}

/** Строка пользовательского импорта: ездит в обе стороны — в превью и обратно на заведение. */
export interface ImportRow {
  line: number;
  title?: string;
  authorNames?: string[];
  isbn?: string;
  publishedYear?: number;
  pageCount?: number;
  seriesName?: string;
  rating?: number;
  status?: ReadingStatus;
  kind?: MediaKind;
  startedAt?: string;
  finishedAt?: string;
  review?: string;
  note?: string;
  tagNames?: string[];
  errors: string[];
  duplicates: DuplicateCandidate[];
}

export interface ImportPreview {
  fileName: string;
  detectedSource: 'GOODREADS' | 'STORYGRAPH' | 'LIVELIB' | 'GENERIC';
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  rows: ImportRow[];
}

export interface ImportResultSummary {
  imported: number;
  skippedAsDuplicate: number;
  failed: number;
  errors: string[];
}

/** Итог массовой правки: пропущенные перечисляются поимённо. */
export interface BulkUpdateResult {
  updated: number;
  skipped: string[];
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
  authors: AuthorSummary[];
  tags: TagSummary[];
  seriesId?: string;
  seriesName?: string;
  orderInSeries?: number;
  isbn?: string;
  publishedYear?: number;
  language?: string;
  pageCount?: number;
  translator?: string;
  format?: ItemFormat;
  bookcase?: string;
  shelf?: string;
  /** Сама обложка приходит отдельным запросом — здесь только признак, что она есть. */
  hasCover: boolean;
  startedAt?: string;
  finishedAt?: string;
  deadline?: string;
  progress?: Progress;
  /** Номер текущего прохода: со второго это перечитывание. */
  attempt: number;
  createdById?: string;
  createdByUsername?: string;
  /** Приватная заметка: видна только владельцу. */
  note?: string;
  /** Публичный отзыв. */
  review?: string;
  /** Часть отзыва со спойлерами — интерфейс прячет её под кат. */
  reviewSpoiler?: string;
  rating?: number;
  ratingPlot?: number;
  ratingStyle?: number;
  ratingCharacters?: number;
  ratingEnding?: number;
  favorite: boolean;
  /** Список желаемого ведётся отдельно от статуса «в планах». */
  wishlist: boolean;
  price?: number;
  currency?: string;
  purchaseUrl?: string;
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

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'USER';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  blocked: boolean;
  avatar?: string;
  avatarContentType?: string;
  createdAt?: string;
  updatedAt?: string;
  sessionTtlOverrideMinutes?: number | null;
  maxSessionLifetimeOverrideMinutes?: number | null;
}

export interface ExportInfo {
  fileName: string;
  path: string;
  downloadUrl?: string;
  exportedAt: string;
  usersCount: number;
  itemsCount: number;
  bookTypesCount: number;
  sourcesCount: number;
  sessionsCount: number;
  systemNodesCount: number;
}

export interface ExportFileInfo {
  fileName: string;
  sizeBytes: number;
  lastModifiedAt: string;
  downloadUrl?: string;
}

export interface ImportResult {
  fileName: string;
  restoredUsers: number;
  restoredItems: number;
  restoredBookTypes: number;
  restoredSources: number;
  restoredSystemNodes: number;
  restoredSessions: number;
}

export interface SystemNode {
  id: string;
  nodeKey: string;
  hostname?: string;
  ip?: string;
  port?: number;
  cpuLoad?: number;
  systemMemoryTotal?: number;
  systemMemoryFree?: number;
  heapUsed?: number;
  heapCommitted?: number;
  heapMax?: number;
  diskTotal?: number;
  diskFree?: number;
  uptimeSeconds?: number;
  lastReportedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookAnalytics {
  totalItems: number;
  favoriteItems: number;
  averageRating?: number;
  statusBreakdown: Record<ReadingStatus, number>;
  topTypes: Array<{ typeId: string; typeName: string; count: number }>;
  topSources: Array<{ sourceId: string; sourceName: string; count: number }>;
}

export interface SessionSettings {
  sessionTtlMinutes: number;
  maxSessionLifetimeMinutes: number;
}

export interface NodeMemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface ProcessInfo {
  pid: number;
  user: string;
  cpuPercent: number;
  memoryPercent: number | null;
  residentMemoryKb: number;
  virtualMemoryKb: number;
  command: string;
}

export interface NodeMemoryDetail {
  nodeId: string;
  nodeKey: string;
  memoryUsage: NodeMemoryUsage;
  v8HeapStatistics?: {
    totalHeapSize: number;
    usedHeapSize: number;
    heapSizeLimit: number;
    totalAvailableSize: number;
    totalPhysicalSize: number;
    mallocedMemory: number;
    peakMallocedMemory: number;
  };
  topProcessesByMemory?: ProcessInfo[];
  timestamp: string;
}

export interface MonitoringGlobalMetrics {
  totalRequests: number;
  errorRequests: number;
  averageDurationMs: number;
  maxDurationMs: number;
  lastRequestAt?: string | null;
}

export interface MonitoringSettings {
  metricsEnabled: boolean;
  pingIntervalSeconds: number;
  pingPath: string;
  updatedAt?: string;
}

export interface EndpointMetrics {
  method: string;
  path: string;
  totalRequests: number;
  errorRequests: number;
  averageDurationMs: number;
  maxDurationMs: number;
  lastDurationMs: number;
  lastRequestAt?: string | null;
}

export interface SlowRequest {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  occurredAt: string;
}

export interface NodeMetricsSnapshot {
  nodeKey: string;
  capturedAt: string;
  global: MonitoringGlobalMetrics;
  endpoints: EndpointMetrics[];
  slowRequests: SlowRequest[];
}

export interface MonitoringMetrics {
  enabled: boolean;
  settings: MonitoringSettings;
  nodes: NodeMetricsSnapshot[];
  generatedAt: string;
}
