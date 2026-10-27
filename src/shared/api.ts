import type {
  AppSettings,
  ConnectivityStatus,
  TitleType,
  TmdbPick,
  TmdbResult,
  TmdbSearchResult,
  DashboardData,
  RecommendationOption,
  RecommendationQuery,
  RecommendationResult,
  CollectionQuery,
  CollectionResult,
  CreateTitleInput,
  Insights,
  InsightsPeriod,
  UpdateTitleInput,
  Reason,
  WatchEntryInput,
  WatchEntryUpdateInput,
  JournalQuery,
  JournalResult,
  PreparedPoster,
  Title,
  WatchEntry
} from './types'

export interface CineDiaryApi {
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
    listReasons: () => Promise<Reason[]>
    createReason: (label: string) => Promise<Reason>
  }
  stats: {
    insights: (period: InsightsPeriod) => Promise<Insights>
  }
  dashboard: {
    get: () => Promise<DashboardData>
  }
  recommendations: {
    options: () => Promise<RecommendationOption[]>
    get: (query: RecommendationQuery) => Promise<RecommendationResult>
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
  }
  tmdb: {
    /** Needs at least 2 characters. */
    search: (query: string) => Promise<TmdbResult<TmdbSearchResult[]>>
    /** A small poster thumbnail as a data URL (null if unavailable). */
    thumbnail: (posterPath: string) => Promise<string | null>
    pick: (type: TitleType, tmdbId: number) => Promise<TmdbResult<TmdbPick>>
    /** Tests the given token, or the saved one when omitted. */
    testConnection: (token?: string) => Promise<TmdbResult<true>>
  }
  connectivity: {
    get: () => Promise<ConnectivityStatus>
    check: () => Promise<ConnectivityStatus>
    /** Returns a function that stops listening. */
    onChange: (listener: (status: ConnectivityStatus) => void) => () => void
  }
}
