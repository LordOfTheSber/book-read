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

/** Полка внутри карточки: без описания и состава. */
export interface ShelfSummary {
  id: string;
  name: string;
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
  /** Роль спрашивающего внутри полки; у владельца и постороннего её нет. */
  myRole?: ShelfRole;
  owned: boolean;
  canCurate: boolean;
  canContribute: boolean;
  memberCount: number;
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
  /** Полки спрашивающего, на которых лежит запись. */
  shelves: ShelfSummary[];
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

/**
 * Разбивка по разделам копии: ключ — имя раздела, значение — число записей. Отдельного поля
 * на каждую сущность нет намеренно — разделов два десятка, и любой новый ломал бы контракт.
 */
export type BackupCounts = Record<string, number>;

export interface ExportInfo {
  fileName: string;
  path: string;
  downloadUrl?: string;
  schemaVersion: number;
  exportedAt: string;
  usersCount: number;
  itemsCount: number;
  bookTypesCount: number;
  sourcesCount: number;
  sessionsCount: number;
  systemNodesCount: number;
  counts?: BackupCounts;
}

export interface ExportFileInfo {
  fileName: string;
  sizeBytes: number;
  lastModifiedAt: string;
  downloadUrl?: string;
}

export interface ImportResult {
  fileName: string;
  /** Версия формата поднятой копии: по ней видно, насколько старый файл восстановили. */
  schemaVersion: number;
  /** Когда копия была снята, а не когда её восстановили. */
  exportedAt?: string;
  restoredUsers: number;
  restoredItems: number;
  restoredBookTypes: number;
  restoredSources: number;
  restoredSystemNodes: number;
  restoredSessions: number;
  counts?: BackupCounts;
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
  /** Доли видов произведения: из них собирается корешковая полоса. */
  kindBreakdown?: Partial<Record<MediaKind, number>>;
  topTypes: Array<{ typeId: string; typeName: string; count: number }>;
  topSources: Array<{ sourceId: string; sourceName: string; count: number }>;
}

/** Итог периода: `2026-08` для месяцев, `2026` для лет. */
export interface PeriodStats {
  period: string;
  finished: number;
  pages: number;
  minutes: number;
}

export interface DayActivity {
  date: string;
  minutes: number;
  sessions: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface ReadingPace {
  pagesPerDay?: number;
  minutesPerDay?: number;
  pagesPerHour?: number;
  activeDays: number;
  windowDays: number;
}

export interface FinishForecast {
  itemId: string;
  title: string;
  remaining: number;
  unit?: ProgressUnit;
  /** Пусто, если темпа нет: сервер не подставляет выдуманную дату. */
  expectedFinish?: string;
}

export interface PurchaseStats {
  purchased: number;
  finishedOfPurchased: number;
  unreadPurchased: number;
  spentByCurrency: Record<string, number>;
}

/**
 * Аналитика во времени. Отдельный запрос от {@link BookAnalytics}: та висит в шапке списка книг
 * и профиля, и тепловая карта с прогнозами оказалась бы в цене каждого открытия библиотеки.
 */
export interface ReadingAnalytics {
  byMonth: PeriodStats[];
  byYear: PeriodStats[];
  /** Только дни с чтением — пустые достраивает календарь. */
  heatmap: DayActivity[];
  pace: ReadingPace;
  forecasts: FinishForecast[];
  byAuthor: Array<{ authorId: string; authorName: string; count: number }>;
  byLanguage: LabelCount[];
  byDecade: LabelCount[];
  purchases: PurchaseStats;
  currentYear: PeriodStats;
  previousYear: PeriodStats;
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

/** Пользователь в списке: в подписках, в авторе события, в комментарии. Без роли и блокировки. */
export interface ProfileSummary {
  id: string;
  username: string;
  displayName?: string;
  hasAvatar: boolean;
  publicProfile: boolean;
  followedByMe: boolean;
}

/** Отзыв, каким его видит другой пользователь: без приватной заметки, спойлер отдельным полем. */
export interface PublicReview {
  itemId: string;
  kind: MediaKind;
  title: string;
  authorNames: string[];
  hasCover: boolean;
  rating?: number;
  review?: string;
  reviewSpoiler?: string;
  finishedAt?: string;
  reactionCount: number;
  commentCount: number;
}

/** Страница /u/username: шапка, счётчики, открытые полки и последние отзывы. */
export interface PublicProfile {
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  hasAvatar: boolean;
  publicProfile: boolean;
  me: boolean;
  followedByMe: boolean;
  followerCount: number;
  followingCount: number;
  finishedCount: number;
  reviewCount: number;
  averageRating?: number;
  currentStreak: number;
  achievementCount: number;
  joinedAt?: string;
  shelves: Shelf[];
  reviews: PublicReview[];
}

export type ActivityType =
  | 'STARTED_READING'
  | 'FINISHED_READING'
  | 'PUBLISHED_REVIEW'
  | 'RATED'
  | 'SHARED_SHELF'
  | 'UNLOCKED_ACHIEVEMENT'
  | 'REACHED_GOAL';

/** Событие ленты. Подпись — снимок на момент события, поэтому приходит строкой, а не ссылкой. */
export interface Activity {
  id: string;
  type: ActivityType;
  actor: ProfileSummary;
  itemId?: string;
  shelfId?: string;
  subject?: string;
  detail?: string;
  createdAt: string;
}

export type ReactionKind = 'LIKE' | 'WANT_TO_READ' | 'DISAGREE';

export interface ReviewComment {
  id: string;
  author: ProfileSummary;
  body: string;
  createdAt: string;
  canDelete: boolean;
}

/** Обсуждение отзыва: счётчики реакций, своя реакция и плоский список комментариев. */
export interface ReviewThread {
  itemId: string;
  reactions: Partial<Record<ReactionKind, number>>;
  myReaction?: ReactionKind;
  comments: ReviewComment[];
}

/** Роль внутри полки — своя, а не глобальная: она отвечает на вопрос «что можно на этой полке». */
export type ShelfRole = 'VIEWER' | 'CONTRIBUTOR' | 'CURATOR';

export interface ShelfMember {
  id: string;
  user: ProfileSummary;
  role: ShelfRole;
  createdAt: string;
}

/** Выданный экземпляр: заёмщик — просто имя, а не пользователь сервиса. */
export interface Loan {
  id: string;
  itemId: string;
  itemTitle: string;
  borrowerName: string;
  borrowerContact?: string;
  lentOn: string;
  dueOn?: string;
  returnedOn?: string;
  note?: string;
  overdue: boolean;
  daysOut: number;
}

/** Одна цифра цели вместе с графиком: без ожидаемого темпа проценты ни о чём не говорят. */
export interface GoalMetric {
  target: number;
  done: number;
  expected: number;
  percent: number;
  behind: number;
  onTrack: boolean;
  projected: number;
}

export interface ReadingGoal {
  year: number;
  configured: boolean;
  items?: GoalMetric;
  pages?: GoalMetric;
  minutes?: GoalMetric;
  daysLeft: number;
  daysPassed: number;
  completed: boolean;
}

/** Дни подряд с чтением. Вчерашняя отметка серию не рвёт. */
export interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastReadOn?: string;
  readToday: boolean;
  recentDays: string[];
}

export interface Achievement {
  code: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedOn?: string;
}

export interface MonthCount {
  month: number;
  count: number;
}

/** «Год в обзоре»: собирается из тех же срезов, что цель и стрик. */
export interface YearInReview {
  year: number;
  finishedCount: number;
  pageCount: number;
  minuteCount: number;
  readingDays: number;
  longestStreak: number;
  averageRating?: number;
  monthly: MonthCount[];
  topRated: PublicReview[];
  longestItem?: PublicReview;
  topAuthors: AuthorSummary[];
  topTypes: { typeId: string; typeName: string; count: number }[];
}
