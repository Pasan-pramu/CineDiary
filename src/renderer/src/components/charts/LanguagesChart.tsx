import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type YAxisTickContentProps
} from 'recharts'
import { useChartColors } from '../../hooks/useChartColors'
import { useCountUp } from '../../hooks/useCountUp'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import {
  NO_SPOKEN_LANGUAGE,
  NOT_RECORDED_LANGUAGE,
  OTHER_LANGUAGES
} from '../../../../shared/languages'
import type { CollectionTypeFilter, LanguageBar, LanguageStats } from '../../../../shared/types'
import { languageSentence } from '../insightSentences'
import { ChartEmpty, ChartTooltip } from './ChartParts'

// The Languages panel on Home and Insights: one bar per language (titles finished, each once),
// "Other" and "Not recorded" last in a neutral color. A bar or its name opens My Collection
// filtered to that language; "Other" only lists its languages in the tooltip.

const ROW_HEIGHT = 36
const NAME_WIDTH = 148
const VALUE_WIDTH = 96
const MAX_NAME_LENGTH = 18

const TYPES: Array<{ value: CollectionTypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'Series' }
]

/** What the counted things are called, for the tooltip and the Collection hint. */
const NOUNS: Record<CollectionTypeFilter, string> = {
  all: 'titles',
  movie: 'movies',
  series: 'series'
}

const EMPTY_TEXT: Record<CollectionTypeFilter, string> = {
  all: 'Finish a watch and its language will show up here.',
  movie: 'Finish a movie and its language will show up here.',
  series: 'Finish a series and its language will show up here.'
}

function formatShare(share: number): string {
  return share > 0 && share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`
}

/** My Collection filtered to this bar's language; null for "Other". */
function collectionPath(bar: LanguageBar, type: CollectionTypeFilter): string | null {
  if (bar.key === OTHER_LANGUAGES) return null
  const params = new URLSearchParams({ language: bar.key })
  if (type !== 'all') params.set('type', type)
  return `/collection?${params.toString()}`
}

/** The Collection shows the watchlist too, so it can have more titles than the bar. */
function collectionHint(bar: LanguageBar, type: CollectionTypeFilter): string {
  const noun = NOUNS[type]
  if (bar.key === NOT_RECORDED_LANGUAGE) {
    return `Opens all your ${noun} without a language, including your watchlist`
  }
  if (bar.key === NO_SPOKEN_LANGUAGE) {
    return `Opens all your ${noun} with no spoken language, including your watchlist`
  }
  return `Opens all your ${bar.label} ${noun}, including your watchlist`
}

function shortName(label: string): string {
  return label.length > MAX_NAME_LENGTH ? `${label.slice(0, MAX_NAME_LENGTH - 1)}…` : label
}

function LanguagesChart({ languages }: { languages: LanguageStats }): React.JSX.Element {
  const [type, setType] = useState<CollectionTypeFilter>('all')
  const breakdown = languages[type]
  const count = useCountUp(breakdown.total > 0 ? breakdown.languageCount : null)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-4">
        <div className="segmented self-start" role="group" aria-label="Show languages of">
          {TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={type === option.value}
              onClick={() => setType(option.value)}
              className="segment"
            >
              {option.label}
            </button>
          ))}
        </div>
        {breakdown.total > 0 ? (
          <div>
            <p className="text-3xl font-semibold leading-none tabular-nums text-[var(--color-text-primary)]">
              {Math.round(count ?? 0)}
              <span className="text-base font-normal text-[var(--color-text-muted)]">
                {' '}
                {breakdown.languageCount === 1 ? 'language' : 'languages'}
              </span>
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              {languageSentence(breakdown, type)}
            </p>
          </div>
        ) : null}
      </div>
      {breakdown.total > 0 ? (
        <LanguageBars bars={breakdown.bars} type={type} />
      ) : (
        <ChartEmpty>{EMPTY_TEXT[type]}</ChartEmpty>
      )}
    </div>
  )
}

function LanguageBars({
  bars,
  type
}: {
  bars: LanguageBar[]
  type: CollectionTypeFilter
}): React.JSX.Element {
  const navigate = useNavigate()
  const colors = useChartColors()
  const reducedMotion = usePrefersReducedMotion()
  const byKey = new Map(bars.map((bar) => [bar.key, bar]))
  const colorOf = (bar: LanguageBar): string =>
    bar.key === OTHER_LANGUAGES || bar.key === NOT_RECORDED_LANGUAGE ? colors.rest : colors.bar
  const open = (bar: LanguageBar | undefined): void => {
    const path = bar ? collectionPath(bar, type) : null
    if (path) void navigate(path)
  }

  // "75% (150)" in a column on the right. An axis, not a LabelList: labels on a Bar only
  // appear once its animation has finished, which never happens while the window is hidden.
  const valueTick = ({ x, y, payload }: YAxisTickContentProps): React.JSX.Element | null => {
    const bar = byKey.get(String(payload.value))
    if (!bar) return null
    return (
      <text
        x={Number(x) + 4}
        y={y}
        dominantBaseline="central"
        fontSize={13}
        fontWeight={600}
        fill={colors.value}
        className="tabular-nums"
      >
        {formatShare(bar.share)}
        <tspan fill={colors.axis} fontWeight={400}>
          {` (${bar.titles.toLocaleString()})`}
        </tspan>
      </text>
    )
  }

  // The language name; a link (keyboard too) unless it's "Other".
  const nameTick = ({ x, y, payload }: YAxisTickContentProps): React.JSX.Element => {
    const bar = byKey.get(String(payload.value))
    const label = bar?.label ?? String(payload.value)
    const text = (
      <text x={12 - NAME_WIDTH} dominantBaseline="central" fontSize={13} fill={colors.label}>
        <title>{label}</title>
        {shortName(label)}
      </text>
    )
    const path = bar ? collectionPath(bar, type) : null
    return (
      <g transform={`translate(${x},${y})`}>
        {path && bar ? (
          <a
            href={`#${path}`}
            aria-label={`${label}: ${formatShare(bar.share)}, ${bar.titles} ${NOUNS[type]}. ${collectionHint(bar, type)}`}
            onClick={(event) => {
              event.preventDefault()
              open(bar)
            }}
          >
            {text}
          </a>
        ) : (
          text
        )}
      </g>
    )
  }

  return (
    <div style={{ height: bars.length * ROW_HEIGHT }}>
      <ResponsiveContainer>
        <BarChart
          data={bars}
          layout="vertical"
          barCategoryGap={9}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis
            yAxisId="name"
            type="category"
            dataKey="key"
            width={NAME_WIDTH}
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={nameTick}
          />
          <YAxis
            yAxisId="value"
            orientation="right"
            type="category"
            dataKey="key"
            width={VALUE_WIDTH}
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={valueTick}
          />
          <Tooltip
            cursor={{ fill: colors.grid }}
            isAnimationActive={!reducedMotion}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const bar = payload[0].payload as LanguageBar
              if (bar.key === OTHER_LANGUAGES) {
                return (
                  <ChartTooltip
                    title={`Other · ${bar.titles.toLocaleString()} ${NOUNS[type]}`}
                    rows={bar.members.map((member) => ({
                      label: member.label,
                      value: member.titles.toLocaleString()
                    }))}
                  />
                )
              }
              return (
                <ChartTooltip
                  title={bar.label}
                  rows={[
                    {
                      label: NOUNS[type].charAt(0).toUpperCase() + NOUNS[type].slice(1),
                      value: bar.titles.toLocaleString(),
                      color: colorOf(bar)
                    },
                    { label: 'Share', value: formatShare(bar.share) }
                  ]}
                  footer={collectionHint(bar, type)}
                />
              )
            }}
          />
          <Bar
            yAxisId="name"
            dataKey="titles"
            radius={[0, 6, 6, 0]}
            background={{ fill: colors.grid, radius: 6 }}
            isAnimationActive={!reducedMotion}
            animationDuration={250}
            onClick={(_data, index) => open(bars[index])}
          >
            {bars.map((bar) => (
              <Cell
                key={bar.key}
                fill={colorOf(bar)}
                cursor={bar.key === OTHER_LANGUAGES ? 'default' : 'pointer'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default LanguagesChart
