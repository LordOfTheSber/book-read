export type MediaKind = 'BOOK';
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
