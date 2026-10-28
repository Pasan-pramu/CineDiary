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
      <div role="radiogroup" aria-label="Period" className="segmented flex-wrap">
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
              className="segment"
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
            aria-checked={chapterId !== null}
            className={`segment max-w-64 cursor-pointer border-0 [field-sizing:content] ${chapterId === null ? 'bg-transparent' : ''}`}
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
          className="segment inline-flex items-center gap-1.5"
        >
          <CalendarRange size={14} /> Custom
        </button>
      </div>
      {showCustom ? (
        <form
          className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]"
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
              className="field h-9"
            />
          </label>
          <label className="flex items-center gap-2">
            to
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="field h-9"
            />
          </label>
          <button
            type="submit"
            disabled={!valid || (custom?.from === from && custom.to === to)}
            className="btn btn-primary btn-sm"
          >
            Show
          </button>
        </form>
      ) : null}
    </div>
  )
}

export default PeriodSelector
