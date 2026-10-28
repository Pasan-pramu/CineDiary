import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { JournalQuery } from '../../../shared/types'
import { MOODS, type MoodKey } from '../../../shared/constants'

function moodParam(value: string | null): MoodKey | null {
  return MOODS.find((mood) => mood.key === value)?.key ?? null
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
  update: (key: keyof JournalQuery, value: string | boolean | number | null) => void
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

  const update = (key: keyof JournalQuery, value: string | boolean | number | null): void => {
    const next = new URLSearchParams(params)
    const param = {
      search: 'q',
      type: 'type',
      reasonId: 'reason',
      moodBefore: 'mood',
      moodImproved: 'improved',
      hasReflection: 'reflection',
      chapterId: 'chapter',
      feelingOrReason: 'either'
    }[key]
    if (value === '' || value === false || value === null || value === 'all') next.delete(param)
    else next.set(param, String(value))
    setParams(next)
  }

  return { query, params, update, clear: () => setParams(new URLSearchParams()) }
}
