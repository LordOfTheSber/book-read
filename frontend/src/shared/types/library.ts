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
