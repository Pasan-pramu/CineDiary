import { ArrowRight, Lightbulb } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { MoodKey } from '../../../../shared/constants'
import { promptForMoodOrReason } from '../../../../shared/discoverPrompts'
import type {
  Recommendation,
  RecommendationOption,
  RecommendationResult,
  RecommendationTypeFilter
} from '../../../../shared/types'
import { changeColor, formatChange, watchCount } from '../insightSentences'
import PosterPlaceholder from '../PosterPlaceholder'
import ReasonChip from '../ReasonChip'
import SectionPanel from '../SectionPanel'

const TYPES: { value: RecommendationTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'Series' }
]

function optionId(option: RecommendationOption): string {
  return `${option.kind}:${option.key}`
}

/** Suggestions from your own history: titles that lifted your mood in a similar moment. */
function WhatToWatch(): React.JSX.Element {
  const navigate = useNavigate()
  const [options, setOptions] = useState<RecommendationOption[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [type, setType] = useState<RecommendationTypeFilter>('all')
  const [result, setResult] = useState<{ key: string; value: RecommendationResult } | null>(null)

  useEffect(() => {
    void window.api.recommendations.options().then(setOptions)
  }, [])

  const selected =
    options?.find((option) => optionId(option) === selectedId) ?? options?.[0] ?? null
  const kind = selected?.kind ?? null
  const key = selected?.key ?? null
  const requestKey = kind && key ? `${kind}:${key}|${type}` : null

  useEffect(() => {
    if (!kind || !key) return
    let cancelled = false
    void window.api.recommendations
      .get({
        mood: kind === 'mood' ? (key as MoodKey) : null,
        reasonKey: kind === 'reason' ? key : null,
        type
      })
      .then((value) => {
        if (!cancelled) setResult({ key: `${kind}:${key}|${type}`, value })
      })
    return () => {
      cancelled = true
    }
  }, [kind, key, type])

  const current = result && result.key === requestKey ? result.value : null

  return (
    <SectionPanel
      title="What should I watch?"
      action={
        <div className="flex rounded-[var(--radius-control)] border border-[var(--color-border)] p-0.5">
          {TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              aria-pressed={type === option.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                type === option.value
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <p className="-mt-3 mb-4 text-xs text-[var(--color-text-muted)]">
        Picked from your own history: what lifted your mood in a moment like this.
      </p>
      {options === null ? null : options.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] px-6 text-center text-sm leading-6 text-[var(--color-text-muted)]">
          <Lightbulb size={20} className="text-[var(--color-rating)]" />
          Log your mood before and after a few watches, and suggestions from your own history will
          appear here.
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {options.map((option) => (
              <ReasonChip
                key={optionId(option)}
                label={option.emoji ? `${option.emoji} ${option.label}` : option.label}
                selected={selected !== null && optionId(option) === optionId(selected)}
                onClick={() => setSelectedId(optionId(option))}
              />
            ))}
          </div>
          {current === null ? (
            <div className="min-h-48" />
          ) : !current.enoughData ? (
            <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-5 text-sm leading-6 text-[var(--color-text-muted)]">
              <span className="font-semibold text-[var(--color-text-secondary)]">
                Not enough data yet.
              </span>{' '}
              This needs at least 2 finished watches with a mood before and after.
            </p>
          ) : current.items.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-5 text-sm leading-6 text-[var(--color-text-muted)]">
              Nothing in your history has lifted your mood here yet.
            </p>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-2">
                {current.items.map((item) => (
                  <RecommendationCard
                    key={item.title.id}
                    item={item}
                    label={selected?.label ?? ''}
                    onClick={() => void navigate(`/title/${item.title.id}`)}
                  />
                ))}
              </div>
              <p className="mt-4 text-xs text-[var(--color-text-muted)]">
                Based on {watchCount(current.n)}
              </p>
            </>
          )}
          <SeeMoreLink optionKey={selected?.key ?? null} type={type} />
        </>
      )}
    </SectionPanel>
  )
}

/** "See more →": Discover with the prompt that covers the selected mood or reason. */
function SeeMoreLink({
  optionKey,
  type
}: {
  optionKey: string | null
  type: RecommendationTypeFilter
}): React.JSX.Element {
  const prompt = optionKey ? promptForMoodOrReason(optionKey) : null
  const params = new URLSearchParams()
  if (prompt) params.set('prompt', prompt.key)
  if (type !== 'all') params.set('type', type)
  const search = params.toString()
  return (
    <Link
      to={`/discover${search ? `?${search}` : ''}`}
      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent-light)] hover:underline"
    >
      See more{prompt ? ` for “${prompt.label}”` : ' on Discover'} <ArrowRight size={13} />
    </Link>
  )
}

function RecommendationCard({
  item,
  label,
  onClick
}: {
  item: Recommendation
  label: string
  onClick: () => void
}): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/50 p-3 text-left transition hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-panel-elevated)]"
    >
      <div className="w-16 shrink-0 overflow-hidden rounded-lg shadow-lg shadow-black/20">
        {item.title.posterFile && !failed ? (
          <img
            src={`poster://titles/${item.title.id}`}
            alt=""
            onError={() => setFailed(true)}
            className="aspect-[2/3] w-full object-cover"
          />
        ) : (
          <PosterPlaceholder title={item.title.title} compact />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {item.title.title}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          <span className="font-semibold" style={{ color: changeColor(item.averageChange) }}>
            {formatChange(item.averageChange)}
          </span>{' '}
          on average · based on {watchCount(item.n)}
        </p>
        {/* The "why": the best matching watch, e.g. Stressed: 4 → 8 · "made me feel hopeful". */}
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--color-text-secondary)]">
          {label}: {item.why.before} → {item.why.after}
          {item.why.excerpt ? (
            <span className="italic text-[var(--color-text-muted)]"> · “{item.why.excerpt}”</span>
          ) : null}
        </p>
      </div>
    </button>
  )
}

export default WhatToWatch
