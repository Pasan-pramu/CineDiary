import type {
  CollectionQuery,
  CollectionResult,
  CreateTitleInput,
  UpdateTitleInput,
  Reason,
  WatchEntryInput,
  WatchEntryUpdateInput,
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
    get: () => Promise<{ titleCount: number; watchEntryCount: number }>
  }
}
