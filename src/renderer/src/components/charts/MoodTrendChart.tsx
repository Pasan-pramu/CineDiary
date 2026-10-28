import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useChartColors } from '../../hooks/useChartColors'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { MoodTrendPoint } from '../../../../shared/types'
import { formatChange } from '../insightSentences'
import { ChartEmpty, ChartLegend, ChartTooltip } from './ChartParts'
import { formatShortDay } from '../../format'

/** Mood before and after your last watches, oldest on the left. */
function MoodTrendChart({ points }: { points: MoodTrendPoint[] }): React.JSX.Element {
  const colors = useChartColors()
  const reducedMotion = usePrefersReducedMotion()

  if (points.length < 2) {
    return (
      <ChartEmpty>Log your mood on a couple of watches to see how they make you feel.</ChartEmpty>
    )
  }

  const rows = points.map((point) => ({
    ...point,
    label: formatShortDay(point.date)
  }))
  const axisTick = { fill: colors.axis, fontSize: 12 }
  const dot = (
    color: string
  ): { r: number; fill: string; stroke: string; strokeWidth: number } => ({
    r: 4,
    fill: color,
    stroke: colors.surface,
    strokeWidth: 2
  })

  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Before', color: colors.moodBefore },
          { label: 'After', color: colors.moodAfter }
        ]}
      />
      <div className="h-52">
        <ResponsiveContainer>
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis
              dataKey="entryId"
              tickFormatter={(_value, index) => rows[index]?.label ?? ''}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              minTickGap={16}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 5, 10]}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
            />
            <Tooltip
              cursor={{ stroke: colors.grid, strokeWidth: 1 }}
              isAnimationActive={!reducedMotion}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const point = payload[0].payload as MoodTrendPoint & { label: string }
                return (
                  <ChartTooltip
                    title={point.title}
                    rows={[
                      {
                        label: 'Before',
                        value: point.before?.toString() ?? '–',
                        color: colors.moodBefore
                      },
                      {
                        label: 'After',
                        value: point.after?.toString() ?? '–',
                        color: colors.moodAfter
                      },
                      ...(point.before !== null && point.after !== null
                        ? [{ label: 'Change', value: formatChange(point.after - point.before) }]
                        : [])
                    ]}
                    footer={point.label}
                  />
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="before"
              stroke={colors.moodBefore}
              strokeWidth={2}
              fill="none"
              dot={dot(colors.moodBefore)}
              activeDot={dot(colors.moodBefore)}
              isAnimationActive={!reducedMotion}
            />
            <Area
              type="monotone"
              dataKey="after"
              stroke={colors.moodAfter}
              strokeWidth={2}
              fill={colors.moodAfter}
              fillOpacity={0.1}
              dot={dot(colors.moodAfter)}
              activeDot={dot(colors.moodAfter)}
              isAnimationActive={!reducedMotion}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default MoodTrendChart
