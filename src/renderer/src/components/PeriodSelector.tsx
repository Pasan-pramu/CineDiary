import type { InsightsPeriod } from '../../../shared/types'

const PERIOD_OPTIONS: { value: InsightsPeriod; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'six_months', label: 'Last 6 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' }
]

interface PeriodSelectorProps {
  value: InsightsPeriod
  onChange: (period: InsightsPeriod) => void
}

function PeriodSelector({ value, onChange }: PeriodSelectorProps): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="Period"
      className="inline-flex flex-wrap gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-panel)] p-1"
    >
      {PERIOD_OPTIONS.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
              active
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default PeriodSelector
