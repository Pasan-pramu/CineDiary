import type { Title, WatchEntry } from './types'

export interface CineDiaryApi {
  titles: {
    list: () => Promise<Title[]>
    get: (id: number) => Promise<Title | null>
    delete: (id: number) => Promise<void>
  }
  watchEntries: {
    list: (titleId?: number) => Promise<WatchEntry[]>
  }
  stats: {
    get: () => Promise<{ titleCount: number; watchEntryCount: number }>
  }
}
