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
  isHighlight: boolean
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

/** A reason as Settings and the pickers see it. */
export interface ReasonOption extends Reason {
  isHidden: boolean
  sortOrder: number
  /** How many watches use it (used ones can be hidden, never deleted). */
  uses: number
}

/** A mood (before or after a watch). Entries store `key`. */
export interface Mood {
  id: number
  key: MoodKey
  label: string
  emoji: string
  isCustom: boolean
  isHidden: boolean
  sortOrder: number
  /** How many watches use it as mood before or after. */
  uses: number
}

/** What you can change on a mood or reason (renaming never changes its key). */
export interface MoodInput {
  label: string
  emoji: string
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
  /** Only watches inside this life chapter (by completed date, or start date while open). */
  chapterId: number | null
  /** Mood before = this key, OR a reason with the same name ("Lonely"). */
  feelingOrReason: MoodKey | null
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
  /** Every matching watch (entries + currently watching). */
  total: number
  summary: JournalSummary
}
import type { MoodKey } from './constants'
import type { ChapterColor, Milestone } from './timeline'
import type { AppearanceMode } from './theme'

export type InsightsPreset = 'month' | 'six_months' | 'year' | 'all'

/** A preset, one life chapter, or a custom range (YYYY-MM-DD, both ends inclusive). */
export type InsightsPeriod =
  | InsightsPreset
  | { kind: 'chapter'; chapterId: number }
  | { kind: 'range'; from: string; to: string }

/** YYYY-MM-DD, both ends inclusive; null = open-ended. */
export interface DateRange {
  from: string | null
  to: string | null
}

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

/** One row of a distribution (feelings or reasons). key null = "Not recorded". */
export interface DistributionItem {
  key: string | null
  label: string
  /** Reasons only: the reason's id (for Journal links) and whether it's a custom one. */
  reasonId: number | null
  isCustom: boolean
  watches: number
  /** Share of ALL finished watches in the period (0–1). */
  share: number
  /** Average mood change of these watches; null below the 2-watch minimum (n = changeN). */
  averageChange: number | null
  changeN: number
}

/** Sorted by watches; "Not recorded" comes last (only when there is any). */
export interface Distribution {
  /** Finished watches in the period: the base for every share. */
  total: number
  items: DistributionItem[]
}

export type TimeBucket = 'month' | 'year'

export interface OverTimeSeries {
  key: string
  label: string
  /** One count per bucket. */
  counts: number[]
}

/** The top recorded values per month (or year); watches with nothing recorded are counted aside. */
export interface OverTime {
  bucket: TimeBucket
  /** YYYY-MM or YYYY, oldest first, zero-filled. */
  buckets: string[]
  series: OverTimeSeries[]
  notRecorded: number
}

export interface FeelingsAnalysis {
  period: InsightsPeriod
  from: string | null
  to: string
  /** Movies and series per bucket over the period (the chart for everything but "This month"). */
  watchesOverTime: {
    bucket: TimeBucket
    items: Array<{ key: string; movies: number; series: number }>
  }
  moodBefore: Distribution
  moodAfter: Distribution
  reasons: Distribution
  feelingsOverTime: OverTime
  reasonsOverTime: OverTime
}

export interface ChapterAnalysis {
  chapter: LifePeriod
  from: string
  /** The end date, or today while the chapter is ongoing. */
  to: string
  watches: number
  /** Up to 3 recorded values each; shares are of all the chapter's watches. */
  topReasons: DistributionItem[]
  topFeelings: DistributionItem[]
  mood: { before: MoodAverage; after: MoodAverage; change: MoodAverage }
  topGenres: GenreStat[]
  /** Best titles by mood change (same 2-watch minimum as Insights). */
  helpedMost: MoodRanking<TitleMoodChange>
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
  /** Dark / Light / System (default). */
  appearance: AppearanceMode
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

export interface DiscoverQuery {
  /** A key from DISCOVER_PROMPTS (src/shared/discoverPrompts.ts). */
  prompt: string
  type: RecommendationTypeFilter
  /** Minutes (episode runtime for series); null = any length. */
  maxRuntime: number | null
  /** Off = only titles I haven't watched yet. */
  includeRewatches: boolean
  /** With a max runtime, also show titles whose runtime is unknown. */
  includeUnknownRuntime: boolean
}

/** Why a title is suggested; the UI turns this into the "why" line. */
export type DiscoverWhy =
  | {
      kind: 'history'
      /** e.g. "Felt sad" or "Needed motivation". */
      label: string
      before: number
      after: number
      averageChange: number
      n: number
      note: string | null
    }
  | { kind: 'genre'; genre: string; averageChange: number; n: number }
  | { kind: 'genreFallback'; genre: string }
  | {
      kind: 'revisit'
      favorite: boolean
      rating: number | null
      lastWatched: string
      genre: string | null
      history: { label: string; before: number; after: number; note: string | null } | null
    }

export interface DiscoverItem {
  title: Title
  why: DiscoverWhy
}

export interface DiscoverResult {
  helped: {
    items: DiscoverItem[]
    /** Matching watches with a mood before and after (the 2-watch minimum applies). */
    n: number
    enoughData: boolean
    /** There would be enough without the type and runtime filters. */
    enoughWithoutFilters: boolean
    /** Hidden because "Include rewatches" is off. */
    hidden: boolean
  }
  watchlist: DiscoverItem[]
  revisit: { items: DiscoverItem[]; hidden: boolean }
  /** Titles left out because their runtime is unknown (only with a max runtime). */
  hiddenUnknownRuntime: number
  /** Any finished watch with a mood before and after at all. */
  hasMoodHistory: boolean
}

export interface LifePeriod {
  id: number
  name: string
  startDate: string
  /** null = ongoing. */
  endDate: string | null
  /** A key from CHAPTER_COLORS (src/shared/timeline.ts). */
  color: ChapterColor
  note: string | null
}

export type LifePeriodInput = Omit<LifePeriod, 'id'>

export interface ChapterSummary {
  /** Finished watches inside the chapter. */
  watches: number
  /** Average mood change of those with both scores (n = moodN). */
  averageMoodChange: number | null
  moodN: number
  topGenre: string | null
  /** Most common reason and feeling (mood before), with their share of the chapter's watches. */
  topReason: DistributionItem | null
  topFeeling: DistributionItem | null
}

export interface TimelineQuery {
  search: string
  type: CollectionTypeFilter
  chapterId: number | null
  highlightsOnly: boolean
  reasonId: number | null
  /** Mood before. */
  moodBefore: MoodKey | null
}

export interface TimelineEntry {
  id: number
  title: Pick<Title, 'id' | 'title' | 'type' | 'posterFile'>
  /** Completed date, or start date while in progress. */
  date: string
  completed: boolean
  isRewatch: boolean
  isHighlight: boolean
  moodBefore: MoodKey | null
  moodBeforeScore: number | null
  moodAfter: MoodKey | null
  moodAfterScore: number | null
  reasons: string[]
  note: string | null
  milestones: Milestone[]
  chapterIds: number[]
}

export interface TimelineMonth {
  /** YYYY-MM */
  month: string
  entries: TimelineEntry[]
}

export interface TimelinePage {
  months: TimelineMonth[]
  /** Pass back as `before` to load older months; null when there's nothing older. */
  nextBefore: string | null
}

export interface TimelineOverview {
  total: number
  years: Array<{ year: string; count: number }>
  chapters: Array<LifePeriod & { summary: ChapterSummary }>
}

/** One group of global search results: up to 5 items, and how many matched in total. */
export interface SearchGroup<T> {
  items: T[]
  total: number
}

export interface SearchTitleHit {
  id: number
  title: string
  type: TitleType
  year: number | null
  posterFile: string | null
  /** Why it matched when it wasn't the title itself, e.g. "Genre: Drama" or "Cast: Anne Hathaway". */
  match: string | null
}

export interface SearchJournalHit {
  entryId: number
  titleId: number
  title: string
  posterFile: string | null
  /** Completed date, or start date while in progress. */
  date: string
  /** "Thoughts", "Lessons", "Quote" or "Why I watched". */
  field: string
  /** A short excerpt around the match. */
  snippet: string
}

export interface SearchChapterHit {
  id: number
  name: string
  startDate: string
  endDate: string | null
  color: ChapterColor
  /** An excerpt of the note when the match was there. */
  snippet: string | null
}

export interface GlobalSearchResult {
  /** The trimmed text that was searched ('' when it was too short). */
  query: string
  titles: SearchGroup<SearchTitleHit>
  journal: SearchGroup<SearchJournalHit>
  chapters: SearchGroup<SearchChapterHit>
}

export interface AppInfo {
  version: string
  dataFolder: string
}

// --- Data folder (M11b) ---

/** Where the data was found at startup (the "Can't find your diary" screen when not ok). */
export type DataStartup =
  | { state: 'ok' }
  | { state: 'missing'; folder: string; defaultFolder: string }
  | { state: 'unreadable'; defaultFolder: string }

export interface DataLocationStatus {
  folder: string
  defaultFolder: string
  isDefault: boolean
  /** Where the data was moved from, while that copy still exists and you haven't deleted it. */
  previous: string | null
  /** You already answered the "delete the old copy?" question. */
  previousAnswered: boolean
}

/** A folder picked for "Change data folder…", checked and ready to move to. */
export interface DataMoveTarget {
  folder: string
  /** E.g. automatic backups going to a folder inside the current data folder. */
  warnings: string[]
}

export type DataMoveStep =
  'pausing' | 'safety-backup' | 'copying-database' | 'copying-images' | 'verifying' | 'restarting'
