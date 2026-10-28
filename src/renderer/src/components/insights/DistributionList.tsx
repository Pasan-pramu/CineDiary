import { Link } from 'react-router-dom'
import type { Distribution, DistributionItem } from '../../../../shared/types'
import { changeColor, formatChange, formatShare } from '../insightSentences'

interface DistributionListProps {
  distribution: Distribution
  /** Where a row links to (e.g. the Journal filtered by it); none = not clickable. */
  linkFor?: (item: DistributionItem) => string | null
  /** Show each group's average mood change when it has enough data. */
  showChange?: boolean
  emptyText: string
}

/** Count and share per value, with "Not recorded" last and muted (never left out). */
function DistributionList({
  distribution,
  linkFor,
  showChange = false,
  emptyText
}: DistributionListProps): React.JSX.Element {
  if (distribution.total === 0) {
    return <p className="text-sm leading-6 text-[var(--color-text-muted)]">{emptyText}</p>
  }
  const max = Math.max(...distribution.items.map((item) => item.watches))
  return (
    <ul className="space-y-3">
      {distribution.items.map((item) => {
        const notRecorded = item.key === null
        const to = notRecorded ? null : (linkFor?.(item) ?? null)
        const labelClass = `min-w-0 truncate ${notRecorded ? 'italic text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'}`
        return (
          <li key={item.key ?? 'not-recorded'} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              {to ? (
                <Link
                  to={to}
                  className={`${labelClass} hover:underline`}
                  title="Show in the Journal"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={labelClass}>{item.label}</span>
              )}
              <span className="flex shrink-0 items-baseline gap-2 text-xs tabular-nums text-[var(--color-text-muted)]">
                {showChange && item.averageChange !== null ? (
                  <span
                    className="font-semibold"
                    style={{ color: changeColor(item.averageChange) }}
                    title={`Average mood change, based on ${item.changeN} watches with both scores`}
                  >
                    {formatChange(item.averageChange)}
                  </span>
                ) : null}
                <span>
                  {item.watches.toLocaleString()} · {formatShare(item.share)}
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-panel-elevated)]">
              <div
                className={`h-full rounded-full ${notRecorded ? 'bg-[var(--color-text-muted)]/40' : 'bg-[var(--color-accent)]'}`}
                style={{ width: `${(item.watches / max) * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default DistributionList
