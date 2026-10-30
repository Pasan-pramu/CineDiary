import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JournalQuery } from '../../shared/types'
import {
  closeMemoryDatabase,
  insertReasons,
  insertTitle,
  insertWatch,
  openMemoryDatabase,
  titleStatus
} from '../test/memoryDb'
import { getTitle, setTitleStatus } from './titles'
import {
  createPastWatch,
  deleteWatch,
  finishWatch,
  listWatchEntries,
  logFirstWatch,
  searchJournal,
  startWatch,
  updateWatch
} from './watchEntries'

// Title status recomputation and the Journal's filters, on an in-memory diary (no real data).

vi.mock('../db/client', async (original) => ({
  ...(await original<typeof import('../db/client')>()),
  getDatabase: (await import('../test/memoryDb')).currentDatabase
}))

beforeEach(() => {
  openMemoryDatabase()
})
afterEach(() => closeMemoryDatabase())

describe('title status follows its watches', () => {
  it('planned → watching → completed → rewatching → completed', () => {
    insertTitle({ id: 1, status: 'planned' })
    const first = startWatch({ titleId: 1, startedAt: '2026-10-01' })
    expect(titleStatus(1)).toBe('watching')
    expect(first.isRewatch).toBe(false)

    finishWatch({ id: first.id, startedAt: '2026-10-01', completedAt: '2026-10-02' })
    expect(titleStatus(1)).toBe('completed')

    const second = startWatch({ titleId: 1, startedAt: '2026-10-10' })
    expect(titleStatus(1)).toBe('rewatching')
    expect(second.isRewatch).toBe(true)

    finishWatch({ id: second.id, startedAt: '2026-10-10', completedAt: '2026-10-11' })
    expect(titleStatus(1)).toBe('completed')
  })

  it('a logged past watch makes a planned title completed', () => {
    insertTitle({ id: 1, status: 'planned' })
    createPastWatch({ titleId: 1, startedAt: '2025-05-01', completedAt: '2025-05-01' })
    expect(titleStatus(1)).toBe('completed')
  })

  it('deleting watches steps back: rewatching → completed → planned', () => {
    insertTitle({ id: 1, status: 'planned' })
    const past = createPastWatch({ titleId: 1, startedAt: '2025-05-01', completedAt: '2025-05-01' })
    const open = startWatch({ titleId: 1, startedAt: '2026-10-01' })
    expect(titleStatus(1)).toBe('rewatching')
    deleteWatch(open.id)
    expect(titleStatus(1)).toBe('completed')
    deleteWatch(past.id)
    expect(titleStatus(1)).toBe('planned')
  })

  it('editing a finished watch keeps the title completed', () => {
    insertTitle({ id: 1, status: 'planned' })
    const watch = createPastWatch({
      titleId: 1,
      startedAt: '2026-10-01',
      completedAt: '2026-10-02'
    })
    updateWatch({ id: watch.id, startedAt: '2026-09-30', completedAt: '2026-10-03' })
    expect(titleStatus(1)).toBe('completed')
  })

  it('only one watch can be in progress at a time', () => {
    insertTitle({ id: 1, status: 'planned' })
    startWatch({ titleId: 1, startedAt: '2026-10-01' })
    expect(() => startWatch({ titleId: 1, startedAt: '2026-10-02' })).toThrow(/in-progress/)
  })

  describe('dropped stays dropped', () => {
    function droppedTitle(): { open: number; past: number } {
      insertTitle({ id: 1, status: 'planned' })
      const past = createPastWatch({
        titleId: 1,
        startedAt: '2025-01-01',
        completedAt: '2025-01-01'
      })
      const open = startWatch({ titleId: 1, startedAt: '2026-10-01' })
      setTitleStatus(1, 'dropped')
      return { open: open.id, past: past.id }
    }

    it('while you edit a watch', () => {
      const { past } = droppedTitle()
      updateWatch({ id: past, startedAt: '2025-01-01', completedAt: '2025-01-01', thoughts: 'Hm.' })
      expect(titleStatus(1)).toBe('dropped')
    })

    it('while you delete a watch', () => {
      const { past } = droppedTitle()
      deleteWatch(past)
      expect(titleStatus(1)).toBe('dropped')
    })

    it('while you log a past watch', () => {
      droppedTitle()
      createPastWatch({ titleId: 1, startedAt: '2024-01-01', completedAt: '2024-01-01' })
      expect(titleStatus(1)).toBe('dropped')
    })

    it('until you finish the open watch', () => {
      const { open } = droppedTitle()
      finishWatch({ id: open, startedAt: '2026-10-01', completedAt: '2026-10-05' })
      expect(titleStatus(1)).toBe('completed')
    })

    it('until you start a new watch', () => {
      const { open } = droppedTitle()
      deleteWatch(open)
      expect(titleStatus(1)).toBe('dropped')
      startWatch({ titleId: 1, startedAt: '2026-10-20' })
      expect(titleStatus(1)).toBe('rewatching')
    })
  })
})

describe('watch form bugs (v1.1.0)', () => {
  it('Finish & reflect saves changes to the start date, mood before, its score and the note', () => {
    insertTitle({ id: 1 })
    const open = startWatch({
      titleId: 1,
      startedAt: '2026-10-01',
      moodBefore: 'sad',
      moodBeforeScore: 3,
      reasonNote: 'Rough week.'
    })
    const done = finishWatch({
      id: open.id,
      startedAt: '2026-09-28',
      completedAt: '2026-10-02',
      moodBefore: 'stressed',
      moodBeforeScore: 2,
      reasonNote: 'Exams.',
      moodAfter: 'calm',
      moodAfterScore: 7
    })
    expect(done).toMatchObject({
      startedAt: '2026-09-28',
      moodBefore: 'stressed',
      moodBeforeScore: 2,
      reasonNote: 'Exams.',
      moodAfter: 'calm',
      moodAfterScore: 7
    })
  })

  it('editing an in-progress watch keeps it in progress', () => {
    insertTitle({ id: 1 })
    const open = startWatch({ titleId: 1, startedAt: '2026-10-01', moodBefore: 'sad' })
    const edited = updateWatch({
      id: open.id,
      startedAt: '2026-09-30',
      moodBefore: 'lonely',
      moodBeforeScore: 4
    })
    expect(edited.completedAt).toBeNull()
    expect(edited).toMatchObject({ startedAt: '2026-09-30', moodBefore: 'lonely' })
    expect(titleStatus(1)).toBe('watching')
  })

  it('a past watch can be logged while another watch of the title is in progress', () => {
    insertTitle({ id: 1 })
    const open = startWatch({ titleId: 1, startedAt: '2026-10-01' })
    createPastWatch({ titleId: 1, startedAt: '2019-05-01', completedAt: '2019-05-01' })
    expect(listWatchEntries(1)).toHaveLength(2)
    // The open run is untouched; one finished watch plus one open run = rewatching.
    expect(listWatchEntries(1).find((entry) => entry.id === open.id)?.completedAt).toBeNull()
    expect(titleStatus(1)).toBe('rewatching')
  })

  it('a field emptied in Edit is saved as empty (not the old value)', () => {
    insertTitle({ id: 1 })
    const watch = createPastWatch({
      titleId: 1,
      startedAt: '2026-10-01',
      completedAt: '2026-10-01',
      moodBefore: 'sad',
      moodBeforeScore: 3,
      moodAfter: 'happy',
      moodAfterScore: 8,
      reasonNote: 'Why',
      thoughts: 'Lovely.'
    })
    const edited = updateWatch({ id: watch.id, startedAt: '2026-10-01', completedAt: '2026-10-01' })
    expect(edited).toMatchObject({
      moodBefore: null,
      moodBeforeScore: null,
      moodAfter: null,
      moodAfterScore: null,
      reasonNote: null,
      thoughts: null
    })
  })

  it('the rating: a number sets it, null clears it, leaving it out keeps it', () => {
    insertTitle({ id: 1, rating: 6 })
    const watch = createPastWatch({
      titleId: 1,
      startedAt: '2026-10-01',
      completedAt: '2026-10-01',
      rating: 9
    })
    expect(getTitle(1)?.rating).toBe(9)
    updateWatch({ id: watch.id, startedAt: '2026-10-01', completedAt: '2026-10-01' })
    expect(getTitle(1)?.rating).toBe(9)
    updateWatch({ id: watch.id, startedAt: '2026-10-01', completedAt: '2026-10-01', rating: null })
    expect(getTitle(1)?.rating).toBeNull()
  })
})

describe('the watch saved with a new title', () => {
  it('gets its feelings later from the form, and stays in progress while watching', () => {
    insertTitle({ id: 1 })
    const first = logFirstWatch(1, 'watching', '2026-10-30')
    const edited = updateWatch({
      id: first.id,
      startedAt: '2026-10-30',
      moodBefore: 'stressed',
      moodBeforeScore: 3
    })
    expect(edited).toMatchObject({ completedAt: null, moodBefore: 'stressed', moodBeforeScore: 3 })
    expect(titleStatus(1)).toBe('watching')
  })

  it('a finished one keeps its dates when the form is saved with only the dates', () => {
    insertTitle({ id: 1 })
    const first = logFirstWatch(1, 'watched', '2026-10-30')
    const saved = updateWatch({ id: first.id, startedAt: '2026-10-30', completedAt: '2026-10-30' })
    expect(saved).toMatchObject({ completedAt: '2026-10-30', moodBefore: null, moodAfter: null })
    expect(titleStatus(1)).toBe('completed')
  })
})

describe('journal filters', () => {
  const query = (overrides: Partial<JournalQuery> = {}): JournalQuery => ({
    search: '',
    type: 'all',
    reasonId: null,
    moodBefore: null,
    moodImproved: false,
    hasReflection: false,
    chapterId: null,
    feelingOrReason: null,
    ...overrides
  })
  const ids = (result: ReturnType<typeof searchJournal>): number[] =>
    [...result.currentlyWatching, ...result.entries].map((entry) => entry.id).sort((a, b) => a - b)

  beforeEach(() => {
    insertReasons(['Stressed', 'Wanted to laugh'])
    insertTitle({ id: 1, title: 'Paddington 2', status: 'completed' })
    insertTitle({ id: 2, title: 'Ted Lasso', type: 'series', status: 'watching' })
    insertTitle({ id: 3, title: 'Heat', status: 'completed' })
    insertWatch({
      id: 1,
      titleId: 1,
      started: '2026-09-01',
      moodBefore: 'stressed',
      before: 3,
      after: 8,
      thoughts: 'Kindness wins (100% of the time).',
      reasons: [1]
    })
    insertWatch({ id: 2, titleId: 2, started: '2026-10-01', completed: null, reasons: [2] })
    insertWatch({
      id: 3,
      titleId: 3,
      started: '2026-08-01',
      moodBefore: 'sad',
      before: 6,
      after: 4,
      reasonNote: 'Wanted something tense'
    })
    insertWatch({ id: 4, titleId: 1, started: '2025-12-24', before: 5, after: null })
  })

  it('with no filters shows everything; open runs are "currently watching"', () => {
    const result = searchJournal(query())
    expect(result.total).toBe(4)
    expect(result.currentlyWatching.map((entry) => entry.id)).toEqual([2])
    // Newest first.
    expect(result.entries.map((entry) => entry.id)).toEqual([1, 3, 4])
  })

  it('searches titles and written text, taking % and _ literally', () => {
    expect(ids(searchJournal(query({ search: 'paddington' })))).toEqual([1, 4])
    expect(ids(searchJournal(query({ search: 'kindness' })))).toEqual([1])
    expect(ids(searchJournal(query({ search: 'tense' })))).toEqual([3])
    expect(ids(searchJournal(query({ search: '100%' })))).toEqual([1])
    expect(ids(searchJournal(query({ search: '%' })))).toEqual([1])
    expect(ids(searchJournal(query({ search: '_' })))).toEqual([])
  })

  it('filters by type', () => {
    expect(ids(searchJournal(query({ type: 'series' })))).toEqual([2])
    expect(ids(searchJournal(query({ type: 'movie' })))).toEqual([1, 3, 4])
  })

  it('filters by reason and by mood before', () => {
    expect(ids(searchJournal(query({ reasonId: 2 })))).toEqual([2])
    expect(ids(searchJournal(query({ moodBefore: 'sad' })))).toEqual([3])
  })

  it('"Mood improved" needs both scores and a higher one after', () => {
    expect(ids(searchJournal(query({ moodImproved: true })))).toEqual([1])
  })

  it('"Has reflection" counts thoughts and the other reflection fields', () => {
    expect(ids(searchJournal(query({ hasReflection: true })))).toEqual([1])
  })

  it('combines filters with AND', () => {
    expect(ids(searchJournal(query({ moodBefore: 'stressed', moodImproved: true })))).toEqual([1])
    expect(ids(searchJournal(query({ moodBefore: 'sad', moodImproved: true })))).toEqual([])
    expect(ids(searchJournal(query({ search: 'paddington', hasReflection: true })))).toEqual([1])
  })

  it('averages ignore watches without a score', () => {
    const { summary } = searchJournal(query())
    // Before: 3, 6, 5 (watch 2 has none). After: 8, 4 (watches 2 and 4 have none).
    expect(summary.averageMoodBefore).toBeCloseTo(14 / 3)
    expect(summary.averageMoodAfter).toBe(6)
    // Change only where both exist: +5 and −2.
    expect(summary.averageMoodChange).toBe(1.5)
  })
})
