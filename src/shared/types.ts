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
}

export interface AppSettings {
  displayName: string | null
  /** File name of the custom dashboard banner; changes on every upload (cache key). */
  bannerFile: string | null
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
