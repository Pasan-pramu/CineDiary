import type { LucideIcon } from 'lucide-react'
import { useCountUp } from '../hooks/useCountUp'

export type StatTone = 'accent' | 'blue' | 'positive' | 'rating' | 'favorite'

const toneClasses: Record<StatTone, string> = {
  accent: 'bg-[var(--color-accent)]/15 text-[var(--color-accent-light)]',
  blue: 'bg-[var(--color-accent-blue)]/15 text-[var(--color-accent-blue)]',
  positive: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
  rating: 'bg-[var(--color-rating)]/15 text-[var(--color-rating)]',
  favorite: 'bg-[var(--color-favorite)]/15 text-[var(--color-favorite)]'
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  /** null shows a dash, e.g. an average with no data yet. */
  value: number | null
  format?: (value: number) => string
  tone?: StatTone
  /** Small line under the number, e.g. "+3 this month" or "based on 12 watches". */
  trend?: React.ReactNode
}

function formatWhole(value: number): string {
  return Math.round(value).toLocaleString()
}

function StatCard({
  icon: Icon,
  label,
  value,
  format = formatWhole,
  tone = 'accent',
  trend
}: StatCardProps): React.JSX.Element {
  const shown = useCountUp(value)
  return (
    <div className="flex items-start gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] ${toneClasses[tone]}`}
      >
        <Icon size={21} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] text-[var(--color-text-muted)]">{label}</p>
        <p className="mt-1 text-[26px] font-semibold leading-tight tabular-nums text-[var(--color-text-primary)]">
          <span aria-hidden="true">{shown === null ? '–' : format(shown)}</span>
          <span className="sr-only">{value === null ? 'No data yet' : format(value)}</span>
        </p>
        {trend ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{trend}</p> : null}
      </div>
    </div>
  )
}

export default StatCard
