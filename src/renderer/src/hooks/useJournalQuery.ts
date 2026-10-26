import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { JournalQuery } from '../../../shared/types'
import type { MoodKey } from '../../../shared/constants'

const defaultQuery: JournalQuery = {
  search: '',
  type: 'all',
  reasonId: null,
  moodBefore: null,
  moodImproved: false,
  hasReflection: false
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
    const mood = params.get('mood')
    return {
      search: params.get('q') ?? defaultQuery.search,
      type: type === 'movie' || type === 'series' ? type : defaultQuery.type,
      reasonId: Number.isInteger(reasonId) && reasonId > 0 ? reasonId : null,
      moodBefore: mood ? (mood as MoodKey) : null,
      moodImproved: params.get('improved') === 'true',
      hasReflection: params.get('reflection') === 'true'
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
      hasReflection: 'reflection'
    }[key]
    if (value === '' || value === false || value === null || value === 'all') next.delete(param)
    else next.set(param, String(value))
    setParams(next)
  }

  return { query, params, update, clear: () => setParams(new URLSearchParams()) }
}
