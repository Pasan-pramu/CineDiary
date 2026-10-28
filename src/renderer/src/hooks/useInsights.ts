import { useEffect, useState } from 'react'
import { periodKey } from '../components/insights/period'
import type { FeelingsAnalysis, Insights, InsightsPeriod } from '../../../shared/types'
import { logError } from '../errors'

interface Loaded {
  key: string
  insights: Insights | null
  feelings: FeelingsAnalysis | null
}

/** Insights and the Feelings analysis for one period, loaded together. */
export function useInsights(period: InsightsPeriod): {
  insights: Insights | null
  feelings: FeelingsAnalysis | null
  loading: boolean
  failed: boolean
} {
  const [result, setResult] = useState<Loaded>()
  const key = periodKey(period)

  useEffect(() => {
    let cancelled = false
    const current = JSON.parse(key) as InsightsPeriod
    void Promise.all([window.api.stats.insights(current), window.api.stats.feelings(current)])
      .then(([insights, feelings]) => {
        if (!cancelled) setResult({ key, insights, feelings })
      })
      .catch((error: unknown) => {
        // The page shows "Couldn't load your insights"; the details go to the log.
        logError('renderer', error)
        if (!cancelled) setResult({ key, insights: null, feelings: null })
      })
    return () => {
      cancelled = true
    }
  }, [key])

  // Keep showing the previous period's numbers while the next one loads.
  return {
    insights: result?.insights ?? null,
    feelings: result?.feelings ?? null,
    loading: result?.key !== key,
    failed: result !== undefined && result.insights === null
  }
}
