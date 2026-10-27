import { useEffect, useState } from 'react'
import type { Insights, InsightsPeriod } from '../../../shared/types'

export function useInsights(period: InsightsPeriod): {
  insights: Insights | null
  loading: boolean
  failed: boolean
} {
  const [result, setResult] = useState<{ period: InsightsPeriod; insights: Insights | null }>()

  useEffect(() => {
    let cancelled = false
    void window.api.stats
      .insights(period)
      .then((insights) => {
        if (!cancelled) setResult({ period, insights })
      })
      .catch(() => {
        if (!cancelled) setResult({ period, insights: null })
      })
    return () => {
      cancelled = true
    }
  }, [period])

  // Keep showing the previous period's numbers while the next one loads.
  return {
    insights: result?.insights ?? null,
    loading: result?.period !== period,
    failed: result !== undefined && result.insights === null
  }
}
