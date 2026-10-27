export type TitleType = 'movie' | 'series'

export type TitleStatus = 'planned' | 'watching' | 'completed' | 'dropped' | 'rewatching'

export type CollectionTypeFilter = 'all' | TitleType
export type CollectionSort = 'recent' | 'title' | 'rating' | 'year'
export type CollectionSortDirection = 'asc' | 'desc'

export interface Title {
  id: number
  type: TitleType
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  country: string | null
  language: string | null
  runtimeMinutes: number | null
  totalSeasons: number | null
  totalEpisodes: number | null
  status: TitleStatus
  rating: number | null
  isFavorite: boolean
  posterFile: string | null
  backdropFile: string | null
  tmdbId: number | null
  imdbId: string | null
  tmdbSyncedAt: string | null
  genres: string[]
  createdAt: string
  updatedAt: string
}

export interface CollectionQuery {
  search: string
  type: CollectionTypeFilter
  status: TitleStatus | 'all'
  genre: string
  favorite: boolean
  minimumRating: number | null
  sort: CollectionSort
  direction: CollectionSortDirection
}

export interface CollectionResult {
  titles: Title[]
  total: number
}

export interface CreateTitleInput {
  type: TitleType
  title: string
  originalTitle?: string
  /** Set when the details came from TMDB (also sets tmdb_synced_at on create). */
  tmdbId?: number
  imdbId?: string
  year?: number
  genres: string[]
  overview?: string
  country?: string
  language?: string
  runtimeMinutes?: number
  totalSeasons?: number
  totalEpisodes?: number
  status: TitleStatus
  rating?: number
  isFavorite: boolean
  tempPosterFile?: string
}

export interface UpdateTitleInput extends CreateTitleInput {
  id: number
  removePoster?: boolean
}

export interface PreparedPoster {
  tempFile: string
  previewDataUrl: string
}

export interface WatchEntry {
  id: number
  titleId: number
  startedAt: string
  completedAt: string | null
  isRewatch: boolean
  episodesWatched: number
  moodBefore: MoodKey | null
  moodBeforeScore: number | null
  reasonNote: string | null
  moodAfter: MoodKey | null
  moodAfterScore: number | null
  thoughts: string | null
  lessons: string | null
  favoriteCharacter: string | null
  favoriteScene: string | null
  favoriteQuote: string | null
  wouldRewatch: boolean | null
  wouldRecommend: boolean | null
  notes: string | null
  createdAt: string
  updatedAt: string
  reasons: Reason[]
}

export interface Reason {
  id: number
  key: string
  label: string
  isCustom: boolean
}

export interface WatchEntryInput {
  titleId: number
  startedAt: string
  completedAt?: string
  isRewatch?: boolean
  episodesWatched?: number
  moodBefore?: MoodKey
  moodBeforeScore?: number
  reasonIds?: number[]
  reasonNote?: string
  moodAfter?: MoodKey
  moodAfterScore?: number
  thoughts?: string
  lessons?: string
  favoriteCharacter?: string
  favoriteScene?: string
  favoriteQuote?: string
  wouldRewatch?: boolean
  wouldRecommend?: boolean
  notes?: string
  rating?: number
}

export interface WatchEntryUpdateInput extends Omit<WatchEntryInput, 'titleId'> {
  id: number
}

export interface JournalQuery {
  search: string
  type: CollectionTypeFilter
  reasonId: number | null
  moodBefore: MoodKey | null
  moodImproved: boolean
  hasReflection: boolean
}

export interface JournalEntry extends WatchEntry {
  title: Pick<Title, 'id' | 'title' | 'type' | 'posterFile' | 'status'>
}

export interface JournalSummary {
  entriesThisMonth: number
  averageMoodBefore: number | null
  averageMoodAfter: number | null
  averageMoodChange: number | null
}

export interface JournalResult {
  entries: JournalEntry[]
  currentlyWatching: JournalEntry[]
  summary: JournalSummary
}
import type { MoodKey } from './constants'

export type InsightsPeriod = 'month' | 'six_months' | 'year' | 'all'

export interface InsightsTotals {
  movies: number
  series: number
  watches: number
  episodes: number
  hours: number
  averageRating: number | null
  ratedTitles: number
}

export interface MonthlyWatches {
  month: string
  movies: number
  series: number
}

export interface GenreStat {
  genre: string
  watches: number
  averageRating: number | null
  ratedTitles: number
}

export interface MoodAverage {
  average: number | null
  n: number
}

/** Averages over entries that have both mood scores, so before/after/change share one n. */
export interface MoodGroup {
  label: string
  averageBefore: number
  averageAfter: number
  averageChange: number
  n: number
}

export interface ReasonMoodGroup extends MoodGroup {
  reasonKey: string
  isCustom: boolean
}

export interface TitleMoodChange {
  titleId: number
  title: string
  type: TitleType
  posterFile: string | null
  averageChange: number
  n: number
}

/** n = qualifying watches behind the ranking; enoughData = the ranking may be shown. */
export interface MoodRanking<T> {
  items: T[]
  n: number
  enoughData: boolean
}

export interface ReasonCount {
  reasonKey: string
  label: string
  isCustom: boolean
  watches: number
}

export interface ReasonEffectiveness {
  reasonKey: string
  label: string
  bestGenre: MoodGroup | null
  titles: MoodRanking<TitleMoodChange>
}

export interface Insights {
  period: InsightsPeriod
  from: string | null
  to: string
  hasAnyWatches: boolean
  totals: InsightsTotals
  watchesPerMonth: MonthlyWatches[]
  genres: GenreStat[]
  mood: { before: MoodAverage; after: MoodAverage; change: MoodAverage }
  moodByGenre: MoodRanking<MoodGroup>
  moodByReason: MoodRanking<ReasonMoodGroup>
  topTitles: MoodRanking<TitleMoodChange>
  topReasons: ReasonCount[]
  effectiveFor: ReasonEffectiveness[]
  /** Directors of the movies watched in the period; n = those watches. */
  topDirectors: { items: DirectorStat[]; n: number }
}

export interface CastMember {
  name: string
  character: string | null
  order: number
}

export interface CrewMember {
  name: string
  role: 'director' | 'creator'
  order: number
}

export interface TitleCredits {
  cast: CastMember[]
  directors: string[]
  creators: string[]
}

export interface DirectorStat {
  name: string
  watches: number
  titles: number
}

export interface AppSettings {
  displayName: string | null
  /** File name of the custom dashboard banner; changes on every upload (cache key). */
  bannerFile: string | null
  /** The TMDB token itself never leaves the main process. */
  tmdbToken: TmdbTokenStatus
  /** Quietly refresh stale TMDB titles while the app is open (default on). */
  tmdbBackgroundSync: boolean
}

export interface TmdbTokenStatus {
  /** 'unreadable' = stored but can't be decrypted on this computer (e.g. restored backup). */
  state: 'none' | 'saved' | 'unreadable'
  /** Last 4 characters, for the masked display. */
  hint: string | null
}

export interface MoodTrendPoint {
  entryId: number
  title: string
  date: string
  before: number | null
  after: number | null
}

export interface RecentWatch {
  title: Title
  completedAt: string
}

export interface CurrentWatch {
  title: Title
  startedAt: string
  episodesWatched: number
  isRewatch: boolean
}

export interface WatchMemory {
  entryId: number
  title: Title
  completedAt: string
  /** 'on_this_day' = completed on today's date in an earlier year. */
  kind: 'on_this_day' | 'memory'
  moodBefore: MoodKey | null
  moodBeforeScore: number | null
  moodAfter: MoodKey | null
  moodAfterScore: number | null
  excerpt: string | null
}

export interface TimelineItem {
  entryId: number
  title: Pick<Title, 'id' | 'title' | 'type' | 'posterFile' | 'genres'>
  date: string
  completed: boolean
  moodBeforeScore: number | null
  moodAfterScore: number | null
  excerpt: string | null
}

export interface DashboardData {
  hasTitles: boolean
  /** Titles finished for the first time this month (how much the totals grew). */
  newThisMonth: { movies: number; series: number }
  /** Average rating now minus the average before this month; null if there's nothing to compare. */
  ratingChangeThisMonth: number | null
  moodTrend: MoodTrendPoint[]
  recentlyWatched: RecentWatch[]
  currentlyWatching: CurrentWatch[]
  recentlyAdded: Title[]
  favorites: Title[]
  memory: WatchMemory | null
  timeline: TimelineItem[]
}

export type RecommendationTypeFilter = 'all' | TitleType

/** Pick a mood (matches mood before, or the reason with the same key) or a reason. */
export interface RecommendationQuery {
  mood: MoodKey | null
  reasonKey: string | null
  type: RecommendationTypeFilter
}

export interface RecommendationOption {
  kind: 'mood' | 'reason'
  key: string
  label: string
  emoji: string | null
  watches: number
}

export interface Recommendation {
  title: Title
  averageChange: number
  n: number
  /** The best matching watch, for the "why" line. */
  why: { before: number; after: number; excerpt: string | null }
}

export type RecommendationResult = MoodRanking<Recommendation>

export interface ConnectivityStatus {
  online: boolean
  checkedAt: string
}

export type TmdbErrorCode =
  'no_token' | 'unauthorized' | 'rate_limited' | 'timeout' | 'offline' | 'not_found' | 'unknown'

export interface TmdbError {
  code: TmdbErrorCode
  message: string
}

/** TMDB calls never throw across IPC; they return one of these. */
export type TmdbResult<T> = { ok: true; data: T } | { ok: false; error: TmdbError }

export interface TmdbSearchResult {
  tmdbId: number
  type: TitleType
  title: string
  originalTitle: string | null
  year: number | null
  /** TMDB image path (e.g. "/abc.jpg"); fetch a thumbnail via window.api.tmdb.thumbnail. */
  posterPath: string | null
  /** Set when this TMDB title is already in the collection. */
  existingTitleId: number | null
}

/** TMDB details mapped onto the Add Title form fields. */
export interface TmdbTitleDraft {
  type: TitleType
  tmdbId: number
  imdbId: string | null
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  genres: string[]
  country: string | null
  language: string | null
  runtimeMinutes: number | null
  totalSeasons: number | null
  totalEpisodes: number | null
  posterPath: string | null
}

export interface TmdbPick {
  draft: TmdbTitleDraft
  /** The w500 poster, downloaded into the temporary poster folder; null if unavailable. */
  poster: PreparedPoster | null
  existingTitleId: number | null
}

/** Everything TMDB knows about a title that we store. */
export interface TmdbDetails {
  draft: TmdbTitleDraft
  backdropPath: string | null
  cast: CastMember[]
  crew: CrewMember[]
}

/** "Link to TMDB": per field, keep my value or use TMDB's. */
export type LinkChoice = 'mine' | 'tmdb'

export interface TmdbLinkInput {
  titleId: number
  tmdbId: number
  /** One choice per link field (see LINK_FIELDS) plus the poster. */
  choices: Record<string, LinkChoice>
  /** The TMDB poster from the temp poster flow, when "Use TMDB" was chosen for it. */
  tempPosterFile?: string
}

export interface TmdbSyncProgress {
  running: boolean
  done: number
  total: number
  /** Why the last run stopped early, if it did. */
  stoppedReason: 'cancelled' | 'error' | null
  message: string | null
}

export interface BackupCounts {
  titles: number
  watchEntries: number
  posters: number
  backdrops: number
}

export interface BackupStatus {
  /** Last successful, verified backup (manual or automatic), ISO. */
  lastBackupAt: string | null
  autoEnabled: boolean
  autoFolder: string | null
  autoEveryDays: number
  /** The chosen folder is inside the app's own data folder (not a safe place for backups). */
  autoFolderInsideData: boolean
  lastAutoError: string | null
  /** Show the gentle "back up your diary" card on Home. */
  showReminder: boolean
}

/** Backup, export and restore calls never throw across IPC; they return one of these. */
export type BackupOutcome<T = null> =
  { ok: true; data: T } | { ok: false; canceled?: boolean; message: string }

export interface BackupDone {
  file: string
  createdAt: string
  counts: BackupCounts
}

export interface RestorePreview {
  fileName: string
  createdAt: string
  appVersion: string
  kind: 'manual' | 'auto' | 'safety'
  counts: BackupCounts
}
