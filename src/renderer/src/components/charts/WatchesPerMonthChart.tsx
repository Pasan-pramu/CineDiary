import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartColors } from '../../hooks/useChartColors'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { MonthlyWatches } from '../../../../shared/types'
import { ChartEmpty, ChartLegend, ChartTooltip } from './ChartParts'

function monthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00`)
}

function WatchesPerMonthChart({ data }: { data: MonthlyWatches[] }): React.JSX.Element {
  const colors = useChartColors()
  const reducedMotion = usePrefersReducedMotion()

  if (!data.some((month) => month.movies + month.series > 0)) {
    return <ChartEmpty>No finished watches in the last 12 months yet.</ChartEmpty>
  }

  const shortMonth = new Intl.DateTimeFormat(undefined, { month: 'short' })
  const longMonth = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
  const rows = data.map((month) => ({ ...month, label: shortMonth.format(monthDate(month.month)) }))
  const axisTick = { fill: colors.axis, fontSize: 12 }

  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Movies', color: colors.movies },
          { label: 'Series', color: colors.series }
        ]}
      />
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
            <Tooltip
              cursor={{ fill: colors.grid }}
              isAnimationActive={!reducedMotion}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const month = payload[0].payload as MonthlyWatches
                return (
                  <ChartTooltip
                    title={longMonth.format(monthDate(month.month))}
                    rows={[
                      { label: 'Movies', value: String(month.movies), color: colors.movies },
                      { label: 'Series', value: String(month.series), color: colors.series }
                    ]}
                  />
                )
              }}
            />
            {/* The surface-colored stroke leaves a small gap between stacked segments. */}
            <Bar
              dataKey="movies"
              stackId="watches"
              fill={colors.movies}
              stroke={colors.surface}
              strokeWidth={2}
              maxBarSize={24}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="series"
              stackId="watches"
              fill={colors.series}
              stroke={colors.surface}
              strokeWidth={2}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default WatchesPerMonthChart
