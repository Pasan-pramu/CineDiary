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
