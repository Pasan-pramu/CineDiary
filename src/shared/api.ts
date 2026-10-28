import type { AppearanceMode, ResolvedTheme } from './theme'
import type {
  AppSettings,
  LifePeriod,
  LifePeriodInput,
  TimelineOverview,
  TimelinePage,
  TimelineQuery,
  DiscoverQuery,
  DiscoverResult,
  BackupDone,
  BackupOutcome,
  BackupStatus,
  RestorePreview,
  ConnectivityStatus,
  TitleType,
  TmdbPick,
  TmdbResult,
  TmdbSearchResult,
  TitleCredits,
  TmdbLinkInput,
  TmdbSyncProgress,
  DashboardData,
  RecommendationOption,
  RecommendationQuery,
  RecommendationResult,
  CollectionQuery,
  CollectionResult,
  CreateTitleInput,
  ChapterAnalysis,
  FeelingsAnalysis,
  AppInfo,
  GlobalSearchResult,
  Insights,
  InsightsPeriod,
  UpdateTitleInput,
  Mood,
  DataLocationStatus,
  DataMoveStep,
  DataMoveTarget,
  DataStartup,
  MoodInput,
  ReasonOption,
  WatchEntryInput,
  WatchEntryUpdateInput,
  JournalQuery,
  JournalResult,
  PreparedPoster,
  Title,
  WatchEntry
} from './types'

export interface CineDiaryApi {
  /** Where the data lives, and moving it ("Change data folder…"). */
  dataLocation: {
    /** Found at startup? If not, the page shows "Can't find your diary" and nothing else. */
    startup: DataStartup
    status: () => Promise<DataLocationStatus>
    /** Folder picker + checks; `canceled` when you close the picker. */
    chooseTarget: () => Promise<BackupOutcome<DataMoveTarget>>
    /** Backs up, copies, verifies, switches and restarts the app (resolves just before). */
    move: (folder: string) => Promise<BackupOutcome>
    onProgress: (listener: (step: DataMoveStep) => void) => () => void
    /** Deletes CineDiary's files in the old folder (nothing else there). */
    deleteOld: () => Promise<BackupOutcome<string[]>>
    keepOld: () => Promise<void>
    /** On the "Can't find your diary" screen: */
    retry: () => Promise<void>
    chooseExisting: () => Promise<BackupOutcome>
    useDefault: () => Promise<void>
  }
  titles: {
    list: () => Promise<Title[]>
    get: (id: number) => Promise<Title | null>
    delete: (id: number) => Promise<void>
    listGenres: () => Promise<string[]>
    create: (input: CreateTitleInput) => Promise<Title>
    update: (input: UpdateTitleInput) => Promise<Title>
    setStatus: (id: number, status: 'dropped' | 'watching' | 'rewatching') => Promise<Title>
    toggleFavorite: (id: number) => Promise<Title>
    collection: (query: CollectionQuery) => Promise<CollectionResult>
    /** Cast and directors/creators from TMDB (empty for manual titles). */
    credits: (id: number) => Promise<TitleCredits>
  }
  posters: {
    pick: () => Promise<PreparedPoster | null>
    prepareDropped: (file: File) => Promise<PreparedPoster>
  }
  watchEntries: {
    list: (titleId?: number) => Promise<WatchEntry[]>
    journal: (query: JournalQuery) => Promise<JournalResult>
    start: (input: WatchEntryInput) => Promise<WatchEntry>
    finish: (input: WatchEntryUpdateInput) => Promise<WatchEntry>
    create: (input: WatchEntryInput) => Promise<WatchEntry>
    update: (input: WatchEntryUpdateInput) => Promise<WatchEntry>
    delete: (id: number) => Promise<void>
    incrementEpisodes: (id: number) => Promise<WatchEntry>
    /** Marks a watch as a highlight on the timeline (or unmarks it). */
    setHighlight: (id: number, isHighlight: boolean) => Promise<WatchEntry>
  }
  /** Moods: hidden ones included; only unused custom ones can be deleted. */
  moods: {
    list: () => Promise<Mood[]>
    create: (input: MoodInput) => Promise<Mood>
    update: (id: number, input: MoodInput) => Promise<Mood>
    setHidden: (id: number, hidden: boolean) => Promise<Mood>
    /** Every mood id once, in the new order. */
    reorder: (ids: number[]) => Promise<Mood[]>
    delete: (id: number) => Promise<void>
  }
  /** Reasons, with the same rules as moods. */
  reasons: {
    list: () => Promise<ReasonOption[]>
    create: (label: string) => Promise<ReasonOption>
    rename: (id: number, label: string) => Promise<ReasonOption>
    setHidden: (id: number, hidden: boolean) => Promise<ReasonOption>
    reorder: (ids: number[]) => Promise<ReasonOption[]>
    delete: (id: number) => Promise<void>
  }
  stats: {
    insights: (period: InsightsPeriod) => Promise<Insights>
    /** Feelings, reasons and watches over time for the same period. */
    feelings: (period: InsightsPeriod) => Promise<FeelingsAnalysis>
    /** Every life chapter, analysed (newest first). */
    chapters: () => Promise<ChapterAnalysis[]>
  }
  dashboard: {
    get: () => Promise<DashboardData>
  }
  recommendations: {
    options: () => Promise<RecommendationOption[]>
    get: (query: RecommendationQuery) => Promise<RecommendationResult>
    /** The Discover page's three groups for one prompt. */
    discover: (query: DiscoverQuery) => Promise<DiscoverResult>
  }
  settings: {
    get: () => Promise<AppSettings>
    setDisplayName: (name: string) => Promise<AppSettings>
    /** Opens a file dialog; returns the unchanged settings when cancelled. */
    pickBanner: () => Promise<AppSettings>
    removeBanner: () => Promise<AppSettings>
    /** Encrypts and stores the token; the renderer only ever gets the masked status back. */
    setTmdbToken: (token: string) => Promise<AppSettings>
    removeTmdbToken: () => Promise<AppSettings>
    setTmdbBackgroundSync: (on: boolean) => Promise<AppSettings>
    /** Dark / Light / System; the page and the Windows title bar follow at once. */
    setAppearance: (mode: AppearanceMode) => Promise<AppSettings>
  }
  search: {
    /** Titles, journal text and chapters (2+ characters, up to 5 of each). */
    global: (text: string) => Promise<GlobalSearchResult>
  }
  app: {
    info: () => Promise<AppInfo>
    /** Opens userData/logs in the file manager. */
    openLogs: () => Promise<BackupOutcome>
    /** Writes a renderer error to the local error log (message and stack only). */
    logError: (report: { source: string; message: string; stack: string | null }) => void
  }
  theme: {
    current: () => Promise<ResolvedTheme>
    /** Called when the shown theme changes (setting, or Windows' theme under "System"). */
    onChange: (listener: (theme: ResolvedTheme) => void) => () => void
  }
  tmdb: {
    /** Needs at least 2 characters. */
    search: (query: string) => Promise<TmdbResult<TmdbSearchResult[]>>
    /** A small poster thumbnail as a data URL (null if unavailable). */
    thumbnail: (posterPath: string) => Promise<string | null>
    pick: (type: TitleType, tmdbId: number) => Promise<TmdbResult<TmdbPick>>
    /** Tests the given token, or the saved one when omitted. */
    testConnection: (token?: string) => Promise<TmdbResult<true>>
    /** Links a manual title; only fields chosen as "Use TMDB" change. */
    link: (input: TmdbLinkInput) => Promise<TmdbResult<Title>>
    /** Starts "Refresh all TMDB data now"; progress arrives via onSyncProgress. */
    refreshAll: () => Promise<TmdbSyncProgress>
    cancelRefresh: () => Promise<void>
    syncProgress: () => Promise<TmdbSyncProgress>
    onSyncProgress: (listener: (progress: TmdbSyncProgress) => void) => () => void
  }
  timeline: {
    /** Whole months, newest first, before `before` (YYYY-MM); null = from the newest. */
    page: (query: TimelineQuery, before: string | null) => Promise<TimelinePage>
    overview: (query: TimelineQuery) => Promise<TimelineOverview>
    /** Every life chapter, newest first (no summaries). */
    chapters: () => Promise<LifePeriod[]>
    createChapter: (input: LifePeriodInput) => Promise<LifePeriod>
    updateChapter: (id: number, input: LifePeriodInput) => Promise<LifePeriod>
    deleteChapter: (id: number) => Promise<void>
  }
  backup: {
    status: () => Promise<BackupStatus>
    /** Asks where to save, writes the backup, then verifies it. */
    create: () => Promise<BackupOutcome<BackupDone>>
    chooseAutoFolder: () => Promise<BackupStatus>
    setAuto: (options: {
      enabled?: boolean
      everyDays?: 1 | 3 | 7 | 14 | 30
    }) => Promise<BackupStatus>
    snoozeReminder: () => Promise<BackupStatus>
    /** Asks for a backup file, unpacks and checks it. Nothing changes yet. */
    pickRestore: () => Promise<BackupOutcome<RestorePreview>>
    cancelRestore: () => Promise<void>
    /** Safety backup, swap the data, relaunch. Only returns if something went wrong. */
    restore: () => Promise<BackupOutcome>
    exportJson: () => Promise<BackupOutcome<string>>
    exportCsv: () => Promise<BackupOutcome<string>>
    openDataFolder: () => Promise<BackupOutcome>
    openBackupsFolder: () => Promise<BackupOutcome>
  }
  connectivity: {
    get: () => Promise<ConnectivityStatus>
    check: () => Promise<ConnectivityStatus>
    /** Returns a function that stops listening. */
    onChange: (listener: (status: ConnectivityStatus) => void) => () => void
  }
}
