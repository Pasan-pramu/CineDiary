import { useEffect, useState } from 'react'

// Recharts writes colors into SVG attributes, where var() isn't reliable, so we read the
// CSS variables as plain values and read them again whenever the theme can change.

export interface ChartColors {
  surface: string
  grid: string
  axis: string
  /** Text drawn in a chart (bar names), and its stronger variant (values). */
  label: string
  value: string
  /** Single-series bars, and bars that group the rest ("Other", "Not recorded"). */
  bar: string
  rest: string
  movies: string
  series: string
  moodBefore: string
  moodAfter: string
  /** Genre slots; pick one with genreColorSlot() so each genre keeps its color. */
  genres: string[]
  other: string
}

function readChartColors(): ChartColors {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string): string => styles.getPropertyValue(name).trim()
  return {
    surface: read('--color-panel'),
    grid: read('--color-chart-grid'),
    axis: read('--color-text-muted'),
    label: read('--color-text-secondary'),
    value: read('--color-text-primary'),
    bar: read('--color-accent-blue'),
    rest: read('--color-chart-rest'),
    movies: read('--color-chart-movies'),
    series: read('--color-chart-series'),
    moodBefore: read('--color-chart-mood-before'),
    moodAfter: read('--color-chart-mood-after'),
    genres: [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => read(`--color-chart-${slot}`)),
    other: read('--color-chart-other')
  }
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState(readChartColors)

  useEffect(() => {
    const refresh = (): void => setColors(readChartColors())
    // Theme switches set data-theme (or a class) on <html>/<body>; the OS can switch too.
    const observer = new MutationObserver(refresh)
    for (const element of [document.documentElement, document.body]) {
      observer.observe(element, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    }
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    scheme.addEventListener('change', refresh)
    return () => {
      observer.disconnect()
      scheme.removeEventListener('change', refresh)
    }
  }, [])

  return colors
}
