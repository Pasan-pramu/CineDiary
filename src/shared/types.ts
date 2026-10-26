export type TitleType = 'movie' | 'series'

export type TitleStatus = 'planned' | 'watching' | 'completed' | 'dropped' | 'rewatching'

export interface Title {
  id: number
  type: TitleType
  title: string
  status: TitleStatus
  rating: number | null
  isFavorite: boolean
  imdbId: string | null
  tmdbId: number | null
  posterFile: string | null
}

export interface WatchEntry {
  id: number
  titleId: number
  startedAt: string
  completedAt: string | null
}
