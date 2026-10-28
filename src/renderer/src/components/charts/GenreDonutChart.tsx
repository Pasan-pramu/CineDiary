import { Star } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useChartColors } from '../../hooks/useChartColors'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { GenreStat } from '../../../../shared/types'
import { ChartEmpty, ChartTooltip } from './ChartParts'
import { genreColorSlot } from './genreColors'

const MAX_SLICES = 5

interface Slice extends GenreStat {
  color: string
  share: number
}

function GenreDonutChart({ genres }: { genres: GenreStat[] }): React.JSX.Element {
  const colors = useChartColors()
  const reducedMotion = usePrefersReducedMotion()

  if (genres.length === 0) {
    return <ChartEmpty>Add genres to your titles to see which stories you reach for.</ChartEmpty>
  }

  // The top genres keep their own color; the rest fold into "Other".
  const total = genres.reduce((sum, genre) => sum + genre.watches, 0)
  const top = genres.slice(0, MAX_SLICES)
  const rest = genres.slice(MAX_SLICES)
  const slices: Slice[] = top.map((genre) => ({
    ...genre,
    color: colors.genres[genreColorSlot(genre.genre)],
    share: genre.watches / total
  }))
  if (rest.length) {
    const watches = rest.reduce((sum, genre) => sum + genre.watches, 0)
    slices.push({
      genre: 'Other',
      watches,
      averageRating: null,
      ratedTitles: 0,
      color: colors.other,
      share: watches / total
    })
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="size-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={slices}
              dataKey="watches"
              nameKey="genre"
              innerRadius="62%"
              outerRadius="100%"
              stroke={colors.surface}
              strokeWidth={2}
              isAnimationActive={!reducedMotion}
            >
              {slices.map((slice) => (
                <Cell key={slice.genre} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              isAnimationActive={!reducedMotion}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const slice = payload[0].payload as Slice
                return (
                  <ChartTooltip
                    title={slice.genre}
                    rows={[
                      { label: 'Watches', value: String(slice.watches), color: slice.color },
                      { label: 'Share', value: `${Math.round(slice.share * 100)}%` },
                      ...(slice.averageRating !== null
                        ? [{ label: 'Avg rating', value: slice.averageRating.toFixed(1) }]
                        : [])
                    ]}
                  />
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full min-w-0 space-y-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.genre} className="flex items-center gap-3">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1 truncate text-[var(--color-text-secondary)]">
              {slice.genre}
            </span>
            {slice.averageRating !== null ? (
              <span
                className="flex items-center gap-1 text-xs tabular-nums text-[var(--color-text-muted)]"
                title={`Average rating of ${slice.ratedTitles} rated ${slice.ratedTitles === 1 ? 'title' : 'titles'}`}
              >
                <Star
                  size={12}
                  className="fill-[var(--color-rating-icon)] text-[var(--color-rating)]"
                />
                {slice.averageRating.toFixed(1)}
              </span>
            ) : null}
            <span className="w-10 text-right text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
              {Math.round(slice.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default GenreDonutChart
