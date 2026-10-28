import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartColors } from '../../hooks/useChartColors'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { OverTime } from '../../../../shared/types'
import { ChartEmpty, ChartTooltip } from './ChartParts'

// The top values (feelings or reasons) per month or year, as small multiples: one small chart
// per value on a shared scale. Five lines in one chart can't all be told apart by color
// (the chart palette fails the all-pairs color-blind check), so each value gets its own.

interface TopOverTimeChartProps {
  data: OverTime
  /** Which chart color to draw with. */
  tone: 'moodBefore' | 'movies'
  /** "watches without a recorded feeling" */
  notRecordedLabel: string
}

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' })
const longMonthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

function bucketLabel(bucket: string, long: boolean): string {
  if (bucket.length === 4) return bucket
  const date = new Date(`${bucket}-01T00:00:00`)
  return (long ? longMonthFormat : monthFormat).format(date)
}

function TopOverTimeChart({
  data,
  tone,
  notRecordedLabel
}: TopOverTimeChartProps): React.JSX.Element {
  const colors = useChartColors()
  const reducedMotion = usePrefersReducedMotion()
  const color = colors[tone]

  if (data.series.length === 0 || data.buckets.length === 0) {
    return <ChartEmpty>Nothing recorded in this period yet.</ChartEmpty>
  }

  const max = Math.max(1, ...data.series.flatMap((series) => series.counts))
  const first = data.buckets[0]
  const last = data.buckets[data.buckets.length - 1]

  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {data.series.map((series) => {
          const rows = data.buckets.map((bucket, index) => ({
            bucket,
            count: series.counts[index]
          }))
          const total = series.counts.reduce((sum, count) => sum + count, 0)
          return (
            <li key={series.key} className="min-w-0">
              <p className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-semibold text-[var(--color-text-primary)]">
                  {series.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-muted)]">
                  {total.toLocaleString()}
                </span>
              </p>
              <div className="mt-2 h-20">
                <ResponsiveContainer>
                  <AreaChart data={rows} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
                    <XAxis dataKey="bucket" hide />
                    <YAxis hide domain={[0, max]} />
                    <Tooltip
                      cursor={{ stroke: colors.axis, strokeWidth: 1 }}
                      isAnimationActive={!reducedMotion}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0].payload as { bucket: string; count: number }
                        return (
                          <ChartTooltip
                            title={bucketLabel(row.bucket, true)}
                            rows={[{ label: series.label, value: String(row.count), color }]}
                          />
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={color}
                      strokeWidth={2}
                      fill={color}
                      fillOpacity={0.15}
                      dot={false}
                      activeDot={{ r: 4, stroke: colors.surface, strokeWidth: 2 }}
                      isAnimationActive={!reducedMotion}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>{bucketLabel(first, false)}</span>
                <span>{bucketLabel(last, false)}</span>
              </p>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-[var(--color-text-muted)]">
        Same scale in every chart (up to {max} per {data.bucket}).
        {data.notRecorded > 0
          ? ` ${data.notRecorded.toLocaleString()} ${notRecordedLabel} ${data.notRecorded === 1 ? 'is' : 'are'} not shown.`
          : ''}
      </p>
    </div>
  )
}

export default TopOverTimeChart
