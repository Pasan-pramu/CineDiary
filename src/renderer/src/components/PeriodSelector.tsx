import { CalendarRange } from 'lucide-react'
import { useState } from 'react'
import { getLocalDate } from '../../../shared/constants'
import type { InsightsPeriod, InsightsPreset, LifePeriod } from '../../../shared/types'

const PERIOD_OPTIONS: { value: InsightsPreset; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'six_months', label: 'Last 6 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' }
]

interface PeriodSelectorProps {
  value: InsightsPeriod
  onChange: (period: InsightsPeriod) => void
  /** Life chapters to offer as periods ("Chapter: <name>"). */
  chapters?: LifePeriod[]
}

const optionClass = (active: boolean): string =>
  `rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
    active
      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text-primary)]'
  }`

function PeriodSelector({
  value,
  onChange,
  chapters = []
}: PeriodSelectorProps): React.JSX.Element {
  const custom = typeof value !== 'string' && value.kind === 'range' ? value : null
  const chapterId = typeof value !== 'string' && value.kind === 'chapter' ? value.chapterId : null
  const today = getLocalDate()
  const [editing, setEditing] = useState(false)
  const [from, setFrom] = useState(custom?.from ?? `${today.slice(0, 8)}01`)
  const [to, setTo] = useState(custom?.to ?? today)
  const showCustom = editing || custom !== null
  const valid = from !== '' && to !== '' && from <= to

  return (
    <div className="flex flex-col items-end gap-2">
      <div
        role="radiogroup"
        aria-label="Period"
        className="inline-flex flex-wrap items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-panel)] p-1"
      >
        {PERIOD_OPTIONS.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setEditing(false)
                onChange(option.value)
              }}
              className={optionClass(active)}
            >
              {option.label}
            </button>
          )
        })}
        {chapters.length ? (
          <select
            aria-label="Life chapter"
            value={chapterId ?? ''}
            onChange={(event) => {
              if (!event.target.value) return
              setEditing(false)
              onChange({ kind: 'chapter', chapterId: Number(event.target.value) })
            }}
            className={`h-9 max-w-64 cursor-pointer rounded-lg border-0 px-2 text-[13px] font-semibold ${
              chapterId !== null
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                : 'bg-transparent text-[var(--color-text-muted)]'
            }`}
          >
            <option value="">Chapter…</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                Chapter: {chapter.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          role="radio"
          aria-checked={custom !== null}
          onClick={() => setEditing(true)}
          className={`${optionClass(custom !== null)} inline-flex items-center gap-1.5`}
        >
          <CalendarRange size={14} /> Custom
        </button>
      </div>
      {showCustom ? (
        <form
          className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--color-text-muted)]"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            setEditing(false)
            onChange({ kind: 'range', from, to })
          }}
        >
          <label className="flex items-center gap-2">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="h-9"
            />
          </label>
          <label className="flex items-center gap-2">
            to
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="h-9"
            />
          </label>
          <button
            type="submit"
            disabled={!valid || (custom?.from === from && custom.to === to)}
            className="h-9 rounded-lg bg-[var(--color-accent)] px-3 font-semibold text-[var(--color-on-accent)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            Show
          </button>
        </form>
      ) : null}
    </div>
  )
}

export default PeriodSelector
