import { useEffect, useState } from 'react'
import { periodKey } from '../components/insights/period'
import type {
  FeelingsAnalysis,
  Insights,
  InsightsPeriod,
  LanguageStats
} from '../../../shared/types'
import { logError } from '../errors'

interface Loaded {
  key: string
  insights: Insights | null
  feelings: FeelingsAnalysis | null
  languages: LanguageStats | null
}

/** Insights, the Feelings analysis and the languages for one period, loaded together. */
export function useInsights(period: InsightsPeriod): {
  insights: Insights | null
  feelings: FeelingsAnalysis | null
  languages: LanguageStats | null
  loading: boolean
  failed: boolean
} {
  const [result, setResult] = useState<Loaded>()
  const key = periodKey(period)

  useEffect(() => {
    let cancelled = false
    const current = JSON.parse(key) as InsightsPeriod
    void Promise.all([
      window.api.stats.insights(current),
      window.api.stats.feelings(current),
      window.api.stats.languages(current)
    ])
      .then(([insights, feelings, languages]) => {
        if (!cancelled) setResult({ key, insights, feelings, languages })
      })
      .catch((error: unknown) => {
        // The page shows "Couldn't load your insights"; the details go to the log.
        logError('renderer', error)
        if (!cancelled) setResult({ key, insights: null, feelings: null, languages: null })
      })
    return () => {
      cancelled = true
    }
  }, [key])

  // Keep showing the previous period's numbers while the next one loads.
  return {
    insights: result?.insights ?? null,
    feelings: result?.feelings ?? null,
    languages: result?.languages ?? null,
    loading: result?.key !== key,
    failed: result !== undefined && result.insights === null
  }
}
