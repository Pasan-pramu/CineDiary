import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { JournalQuery } from '../../../shared/types'
import type { MoodKey } from '../../../shared/constants'

/** Any mood key (moods can be custom); an unknown one simply matches nothing. */
function moodParam(value: string | null): MoodKey | null {
  return value && value.length <= 80 ? value : null
}

type Change = string | boolean | number | null

const PARAMS: Record<keyof JournalQuery, string> = {
  search: 'q',
  type: 'type',
  reasonId: 'reason',
  moodBefore: 'mood',
  moodImproved: 'improved',
  hasReflection: 'reflection',
  chapterId: 'chapter',
  feelingOrReason: 'either'
}

const defaultQuery: JournalQuery = {
  search: '',
  type: 'all',
  reasonId: null,
  moodBefore: null,
  moodImproved: false,
  hasReflection: false,
  chapterId: null,
  feelingOrReason: null
}

export function useJournalQuery(): {
  query: JournalQuery
  params: URLSearchParams
  update: (key: keyof JournalQuery, value: Change) => void
  /** Several filters at once (e.g. the "why" filter sets one field and clears another). */
  updateMany: (changes: Partial<Record<keyof JournalQuery, Change>>) => void
  clear: () => void
} {
  const [params, setParams] = useSearchParams()
  const query = useMemo<JournalQuery>(() => {
    const type = params.get('type')
    const reasonId = Number(params.get('reason'))
    const chapterId = Number(params.get('chapter'))
    return {
      search: params.get('q') ?? defaultQuery.search,
      type: type === 'movie' || type === 'series' ? type : defaultQuery.type,
      reasonId: Number.isInteger(reasonId) && reasonId > 0 ? reasonId : null,
      moodBefore: moodParam(params.get('mood')),
      moodImproved: params.get('improved') === 'true',
      hasReflection: params.get('reflection') === 'true',
      chapterId: Number.isInteger(chapterId) && chapterId > 0 ? chapterId : null,
      feelingOrReason: moodParam(params.get('either'))
    }
  }, [params])

  const updateMany = (changes: Partial<Record<keyof JournalQuery, Change>>): void => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes) as Array<[keyof JournalQuery, Change]>) {
      const param = PARAMS[key]
      if (value === '' || value === false || value === null || value === 'all') next.delete(param)
      else next.set(param, String(value))
    }
    setParams(next)
  }
  const update = (key: keyof JournalQuery, value: Change): void => updateMany({ [key]: value })

  return { query, params, update, updateMany, clear: () => setParams(new URLSearchParams()) }
}
