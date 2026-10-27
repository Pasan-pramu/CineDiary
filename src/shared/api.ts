import type {
  AppSettings,
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
  }
}
