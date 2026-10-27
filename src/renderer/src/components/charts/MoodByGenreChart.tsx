import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartColors } from '../../hooks/useChartColors'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { MoodGroup } from '../../../../shared/types'
import { formatChange, watchCount } from '../insightSentences'
import { ChartEmpty, ChartLegend, ChartTooltip } from './ChartParts'

const MAX_GENRES = 6

function MoodByGenreChart({ groups }: { groups: MoodGroup[] }): React.JSX.Element {
  const colors = useChartColors()
  const reducedMotion = usePrefersReducedMotion()

  if (groups.length === 0) {
    return (
      <ChartEmpty>
        Not enough data yet. Log a mood before and after for at least 2 watches in the same genre to
        compare.
      </ChartEmpty>
    )
  }

  // Show the genres with the most evidence behind them.
  const rows = [...groups].sort((a, b) => b.n - a.n).slice(0, MAX_GENRES)
  const axisTick = { fill: colors.axis, fontSize: 12 }

  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Mood before', color: colors.moodBefore },
          { label: 'Mood after', color: colors.moodAfter }
        ]}
      />
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={rows} barGap={2} margin={{ top: 8, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} interval={0} />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
            />
            <Tooltip
              cursor={{ fill: colors.grid }}
              isAnimationActive={!reducedMotion}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const group = payload[0].payload as MoodGroup
                return (
                  <ChartTooltip
                    title={group.label}
                    rows={[
                      {
                        label: 'Before',
                        value: group.averageBefore.toFixed(1),
                        color: colors.moodBefore
                      },
                      {
                        label: 'After',
                        value: group.averageAfter.toFixed(1),
                        color: colors.moodAfter
                      },
                      { label: 'Change', value: formatChange(group.averageChange) }
                    ]}
                    footer={`Based on ${watchCount(group.n)}`}
                  />
                )
              }}
            />
            <Bar
              dataKey="averageBefore"
              fill={colors.moodBefore}
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="averageAfter"
              fill={colors.moodAfter}
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default MoodByGenreChart
